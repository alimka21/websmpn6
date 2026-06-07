// server/routes/public.ts
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { withCache, invalidateByPrefix } from '../lib/cache';

const router = Router();

router.get('/berita', async (req, res, next) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const kategori = req.query.kategori as string | undefined;
    const skip = (page - 1) * limit;

    const cacheKey = `pub:berita:${limit}:${page}:${kategori || 'all'}`;
    const result = await withCache(cacheKey, 600, async () => {
      const where = {
        status: 'PUBLISHED',
        ...(kategori && kategori !== 'all' ? { kategori } : {})
      };

      const data = await prisma.berita.findMany({
        where,
        skip,
        take: limit,
        orderBy: { publishedAt: 'desc' }
      });
      const total = await prisma.berita.count({ where });
      return { data, total, page, limit, kategori: kategori || null };
    });

    res.json(result);
  } catch(error) { next(error); }
});

router.get('/berita/:slug', async (req, res, next) => {
  try {
    const slug = req.params.slug;
    const berita = await withCache(`pub:berita:slug:${slug}`, 600, () =>
      prisma.berita.findUnique({ where: { slug } })
    );
    if (!berita || berita.status !== 'PUBLISHED') {
      return res.status(404).json({ error: 'Berita tidak ditemukan' });
    }
    res.json(berita);
  } catch(error) { next(error); }
});

// Singleton: SiteConfig untuk landing page. Auto-create kalau belum ada.
router.get('/site-config', async (req, res, next) => {
  try {
    const config = await withCache('pub:site-config', 300, async () => {
      let c = await prisma.siteConfig.findFirst();
      if (!c) c = await prisma.siteConfig.create({ data: {} });
      return c;
    });
    res.json(config);
  } catch (error) { next(error); }
});

// Public form: alumni daftar diri sendiri. Tidak butuh auth.
// Status default TIDAK_DIKETAHUI sampai admin verifikasi/update.
// Anti-spam ringan: cek duplikasi by NIS (kalau diisi) + size limit body.
const VALID_ALUMNI_STATUS = new Set(['BEKERJA', 'KULIAH', 'WIRAUSAHA', 'TIDAK_DIKETAHUI']);
router.post('/alumni/register', async (req, res, next) => {
  try {
    const { nama, nis, tahunLulus, jurusan, status, instansi, posisi, kontak } = req.body;

    // Validasi minimum
    if (!nama || typeof nama !== 'string' || nama.trim().length < 3) {
      return res.status(400).json({ error: 'Nama wajib diisi (min 3 karakter)' });
    }
    const tahun = Number(tahunLulus);
    if (!Number.isFinite(tahun) || tahun < 1900 || tahun > 2100) {
      return res.status(400).json({ error: 'Tahun lulus tidak valid' });
    }
    const finalStatus = String(status ?? 'TIDAK_DIKETAHUI').toUpperCase();
    if (!VALID_ALUMNI_STATUS.has(finalStatus)) {
      return res.status(400).json({ error: 'Status tidak valid' });
    }

    // Idempotent ringan: kalau NIS diisi & sudah ada, return error supaya
    // tidak duplikat. Tanpa NIS, alumni baru selalu di-insert (admin yang
    // verifikasi belakangan).
    const cleanNis = nis ? String(nis).trim() : null;
    if (cleanNis) {
      const existing = await prisma.alumni.findFirst({ where: { nis: cleanNis } });
      if (existing) {
        return res.status(409).json({
          error: 'Data dengan NIS ini sudah terdaftar. Hubungi admin sekolah jika perlu perubahan.',
        });
      }
    }

    const created = await prisma.alumni.create({
      data: {
        nama: nama.trim(),
        nis: cleanNis,
        tahunLulus: tahun,
        jurusan: jurusan ? String(jurusan).trim() || null : null,
        status: finalStatus,
        instansi: instansi ? String(instansi).trim() || null : null,
        posisi: posisi ? String(posisi).trim() || null : null,
        kontak: kontak ? String(kontak).trim() || null : null,
      },
    });
    // Self-register alumni is unverified — alumni stats hanya hitung verified,
    // jadi sebenarnya tidak ngubah angka. Tapi invalidasi tetap supaya admin
    // dashboard yang baca raw count langsung fresh saat verifikasi nanti.
    invalidateByPrefix('pub:alumni');
    res.status(201).json({ success: true, id: created.id });
  } catch (error) { next(error); }
});

router.get('/alumni/stats', async (req, res, next) => {
  try {
    // Cache pendek (30s) — landing perlu data fresh setelah admin verify/add
    // alumni di tab tracer. groupBy lebih efisien daripada findMany + reduce.
    const stats = await withCache('pub:alumni:stats', 30, async () => {
      const [byStatus, byTahun] = await Promise.all([
        prisma.alumni.groupBy({
          by: ['status'],
          where: { isVerified: true },
          _count: { _all: true },
        }),
        prisma.alumni.groupBy({
          by: ['tahunLulus'],
          where: { isVerified: true },
          _count: { _all: true },
        }),
      ]);

      const perStatus: Record<string, number> = {};
      for (const g of byStatus) perStatus[g.status] = g._count._all;

      const perTahun: Record<number, number> = {};
      for (const g of byTahun) perTahun[g.tahunLulus] = g._count._all;

      return { perTahun, perStatus };
    });
    res.json(stats);
  } catch(error) { next(error); }
});

// Statistik publik: jumlah siswa aktif (role SISWA). Cache 60s.
router.get('/stats', async (req, res, next) => {
  try {
    const stats = await withCache('pub:stats', 60, async () => {
      const totalSiswa = await prisma.user.count({ where: { role: 'SISWA' } });
      return { totalSiswa };
    });
    res.json(stats);
  } catch(error) { next(error); }
});

// ─────────────────────────────────────────────────────────────────────────────
// Public Presensi Guru
// ─────────────────────────────────────────────────────────────────────────────
router.get('/presensi/guru', async (req, res, next) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;
    const search = String(req.query.search || '').trim();
    const tanggal = req.query.tanggal ? String(req.query.tanggal) : null;
    const bulan = req.query.bulan ? Number(req.query.bulan) : null;
    const tahun = req.query.tahun ? Number(req.query.tahun) : null;

    // Filter tanggal
    let dateFilter: any = {};
    if (tanggal) {
      // Per tanggal
      const d = new Date(tanggal);
      d.setHours(0, 0, 0, 0);
      dateFilter = { tanggal: d };
    } else if (bulan && tahun) {
      // Per bulan
      const start = new Date(tahun, bulan - 1, 1);
      const end = new Date(tahun, bulan, 0, 23, 59, 59, 999);
      dateFilter = { tanggal: { gte: start, lte: end } };
    } else {
      // Default hari ini
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      dateFilter = { tanggal: today };
    }

    // Filter search nama guru
    const guruWhere: any = {};
    if (search) {
      guruWhere.OR = [
        { nama: { contains: search, mode: 'insensitive' } },
        { nip: { contains: search, mode: 'insensitive' } },
      ];
    }

    const where = {
      ...dateFilter,
      guru: guruWhere,
    };

    const [data, total] = await Promise.all([
      prisma.presensiGuru.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ tanggal: 'desc' }, { waktuDatang: 'desc' }],
        select: {
          id: true,
          tanggal: true,
          waktuDatang: true,
          waktuPulang: true,
          autoCheckout: true,
          guru: {
            select: {
              id: true,
              nama: true,
              nip: true,
            },
          },
        },
      }),
      prisma.presensiGuru.count({ where }),
    ]);

    const rows = data.map((p, idx) => {
      let durasi: number | null = null;
      if (p.waktuDatang && p.waktuPulang) {
        durasi = Math.floor((p.waktuPulang.getTime() - p.waktuDatang.getTime()) / 60_000);
      }
      return {
        no: skip + idx + 1,
        id: p.id,
        nama: p.guru.nama,
        nip: p.guru.nip,
        tanggal: p.tanggal.toISOString(),
        waktuDatang: p.waktuDatang ? p.waktuDatang.toISOString() : null,
        waktuPulang: p.waktuPulang ? p.waktuPulang.toISOString() : null,
        durasi,
        autoCheckout: p.autoCheckout,
      };
    });

    res.json({
      data: rows,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Public Presensi Siswa
// ─────────────────────────────────────────────────────────────────────────────
router.get('/presensi/siswa', async (req, res, next) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;
    const search = String(req.query.search || '').trim();
    const tanggal = req.query.tanggal ? String(req.query.tanggal) : null;
    const bulan = req.query.bulan ? Number(req.query.bulan) : null;
    const tahun = req.query.tahun ? Number(req.query.tahun) : null;

    // Filter tanggal
    let dateFilter: any = {};
    if (tanggal) {
      const d = new Date(tanggal);
      d.setHours(0, 0, 0, 0);
      dateFilter = { tanggal: d };
    } else if (bulan && tahun) {
      const start = new Date(tahun, bulan - 1, 1);
      const end = new Date(tahun, bulan, 0, 23, 59, 59, 999);
      dateFilter = { tanggal: { gte: start, lte: end } };
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      dateFilter = { tanggal: today };
    }

    // Filter search
    const siswaWhere: any = {};
    if (search) {
      siswaWhere.OR = [
        { nama: { contains: search, mode: 'insensitive' } },
        { nis: { contains: search, mode: 'insensitive' } },
      ];
    }

    const where = {
      ...dateFilter,
      siswa: siswaWhere,
    };

    const [data, total] = await Promise.all([
      prisma.presensiSiswa.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ tanggal: 'desc' }, { waktuDatang: 'desc' }],
        select: {
          id: true,
          tanggal: true,
          waktuDatang: true,
          siswa: {
            select: {
              id: true,
              nama: true,
              nis: true,
              kelas: {
                select: {
                  nama: true,
                },
              },
            },
          },
        },
      }),
      prisma.presensiSiswa.count({ where }),
    ]);

    const rows = data.map((p, idx) => ({
      no: skip + idx + 1,
      id: p.id,
      nis: p.siswa.nis,
      nama: p.siswa.nama,
      kelas: p.siswa.kelas?.nama || '—',
      tanggal: p.tanggal.toISOString(),
      waktuDatang: p.waktuDatang.toISOString(),
    }));

    res.json({
      data: rows,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
