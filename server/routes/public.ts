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

// ─────────────────────────────────────────────────────────────────────────────
// Verifikasi kode akses presensi (publik)
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Daftar kelas (untuk dropdown filter dashboard publik)
// ─────────────────────────────────────────────────────────────────────────────

router.get('/kelas', async (_req, res, next) => {
  try {
    const kelas = await withCache('pub:kelas', 300, () =>
      prisma.kelas.findMany({
        select: { id: true, nama: true, tingkat: true, tahunAjaran: true },
        orderBy: [{ tingkat: 'asc' }, { nama: 'asc' }],
      })
    );
    res.json(kelas);
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard Kehadiran Publik
// ─────────────────────────────────────────────────────────────────────────────

router.get('/dashboard/kehadiran', async (req, res, next) => {
  try {
    const { mode, tanggal, dari, sampai, kelasId } = req.query as Record<string, string>;

    // Bangun filter tanggal
    let tanggalFilter: { gte: Date; lt: Date } | undefined;

    if (mode === 'hari' || (!mode && tanggal)) {
      const base = tanggal ? new Date(tanggal) : new Date();
      const start = new Date(base); start.setHours(0, 0, 0, 0);
      const end   = new Date(base); end.setHours(23, 59, 59, 999);
      end.setDate(end.getDate() + 1); end.setHours(0, 0, 0, 0);
      tanggalFilter = { gte: start, lt: end };
    } else if (mode === 'rentang' && dari && sampai) {
      const start = new Date(dari);  start.setHours(0, 0, 0, 0);
      const end   = new Date(sampai); end.setDate(end.getDate() + 1); end.setHours(0, 0, 0, 0);
      tanggalFilter = { gte: start, lt: end };
    }
    // mode === 'semua' → tanggalFilter tetap undefined (ambil semua)

    const kelasWhere = kelasId ? { kelasId } : {};

    // Ambil semua siswa sesuai filter kelas
    const siswas = await prisma.siswa.findMany({
      where: kelasWhere,
      select: { id: true, nama: true, kelas: { select: { nama: true } } },
      orderBy: { nama: 'asc' },
    });

    const siswaIds = siswas.map(s => s.id);
    if (siswaIds.length === 0) {
      return res.json({ summary: { totalSiswa: 0, hadir: 0, sakit: 0, izin: 0, alfa: 0 }, rows: [] });
    }

    // Ambil data hadir (PresensiSiswa) dan absensi (AbsensiSiswa) secara paralel
    const [presensiList, absensiList] = await Promise.all([
      prisma.presensiSiswa.findMany({
        where: {
          siswaId: { in: siswaIds },
          ...(tanggalFilter ? { tanggal: tanggalFilter } : {}),
        },
        select: { siswaId: true },
      }),
      prisma.absensiSiswa.findMany({
        where: {
          siswaId: { in: siswaIds },
          ...(tanggalFilter ? { tanggal: tanggalFilter } : {}),
        },
        select: { siswaId: true, status: true },
      }),
    ]);

    // Hitung per siswa
    const hadirCount: Record<string, number> = {};
    for (const p of presensiList) {
      hadirCount[p.siswaId] = (hadirCount[p.siswaId] || 0) + 1;
    }

    const absenCount: Record<string, { sakit: number; izin: number; alfa: number }> = {};
    for (const a of absensiList) {
      if (!absenCount[a.siswaId]) absenCount[a.siswaId] = { sakit: 0, izin: 0, alfa: 0 };
      if (a.status === 'SAKIT') absenCount[a.siswaId].sakit++;
      else if (a.status === 'IZIN') absenCount[a.siswaId].izin++;
      else if (a.status === 'ALFA') absenCount[a.siswaId].alfa++;
    }

    const rows = siswas.map(s => {
      const hadir = hadirCount[s.id] || 0;
      const { sakit = 0, izin = 0, alfa = 0 } = absenCount[s.id] || {};
      const totalHari = hadir + sakit + izin + alfa;
      const persen = totalHari > 0 ? Math.round((hadir / totalHari) * 1000) / 10 : null;
      return { siswaId: s.id, nama: s.nama, kelas: s.kelas.nama, hadir, sakit, izin, alfa, totalHari, persen };
    });

    // Hanya tampilkan siswa yang ada data (hadir atau absen > 0)
    const rowsWithData = rows.filter(r => r.totalHari > 0);

    const summary = rowsWithData.reduce(
      (acc, r) => ({ ...acc, hadir: acc.hadir + r.hadir, sakit: acc.sakit + r.sakit, izin: acc.izin + r.izin, alfa: acc.alfa + r.alfa }),
      { totalSiswa: siswas.length, hadir: 0, sakit: 0, izin: 0, alfa: 0 }
    );

    res.json({ summary, rows: rowsWithData });
  } catch (error) {
    next(error);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// REQ-008: Potensi — endpoint publik
// ─────────────────────────────────────────────────────────────────────────────

router.get('/jenis-kebaikan', async (_req, res, next) => {
  try {
    const data = await withCache('pub:jenis-kebaikan', 600, () =>
      prisma.jenisKebaikan.findMany({ where: { isActive: true }, orderBy: { nama: 'asc' }, select: { id: true, nama: true, poin: true } })
    );
    res.json(data);
  } catch (err) { next(err); }
});

router.get('/jenis-pelanggaran', async (_req, res, next) => {
  try {
    const data = await withCache('pub:jenis-pelanggaran', 600, () =>
      prisma.jenisPelanggaran.findMany({ where: { isActive: true }, orderBy: { nama: 'asc' }, select: { id: true, nama: true, poin: true } })
    );
    res.json(data);
  } catch (err) { next(err); }
});

// Daftar guru untuk dropdown form lapor
router.get('/guru', async (_req, res, next) => {
  try {
    const data = await withCache('pub:guru-list', 300, () =>
      prisma.guru.findMany({
        select: { id: true, nama: true },
        orderBy: { nama: 'asc' },
      })
    );
    res.json(data);
  } catch (err) { next(err); }
});

// Siswa berdasarkan kelas untuk dropdown form lapor
router.get('/siswa-by-kelas', async (req, res, next) => {
  try {
    const kelasId = (req.query.kelasId as string || '').trim();
    if (!kelasId) return res.json([]);
    const data = await prisma.siswa.findMany({
      where: { kelasId },
      select: { id: true, nama: true, nis: true },
      orderBy: { nama: 'asc' },
    });
    res.json(data);
  } catch (err) { next(err); }
});

// Cari siswa by nama/NIS untuk form lapor
router.get('/siswa-search', async (req, res, next) => {
  try {
    const q = (req.query.q as string || '').trim();
    if (!q || q.length < 2) return res.json([]);
    const data = await prisma.siswa.findMany({
      where: {
        OR: [
          { nama: { contains: q } },
          { nis: { contains: q } },
        ],
      },
      select: { id: true, nama: true, nis: true, kelas: { select: { id: true, nama: true } } },
      take: 10,
      orderBy: { nama: 'asc' },
    });
    res.json(data);
  } catch (err) { next(err); }
});

// Submit laporan potensi (publik)
router.post('/laporan-potensi', async (req, res, next) => {
  try {
    const { siswaId, namaPelapor, tipe, jenisId, keterangan, buktiUrl } = req.body as {
      siswaId: string;
      namaPelapor: string;
      tipe: 'KEBAIKAN' | 'PELANGGARAN';
      jenisId: string;
      keterangan?: string;
      buktiUrl?: string;
    };

    if (!siswaId || !namaPelapor?.trim() || !tipe || !jenisId) {
      return res.status(400).json({ error: 'Semua field wajib wajib diisi' });
    }
    if (tipe !== 'KEBAIKAN' && tipe !== 'PELANGGARAN') {
      return res.status(400).json({ error: 'Tipe harus KEBAIKAN atau PELANGGARAN' });
    }

    let poin = 0;
    let jenisKebaikanId: string | null = null;
    let jenisPelanggaranId: string | null = null;

    if (tipe === 'KEBAIKAN') {
      const jenis = await prisma.jenisKebaikan.findUnique({ where: { id: jenisId } });
      if (!jenis || !jenis.isActive) return res.status(400).json({ error: 'Jenis kebaikan tidak valid' });
      poin = jenis.poin;
      jenisKebaikanId = jenis.id;
    } else {
      const jenis = await prisma.jenisPelanggaran.findUnique({ where: { id: jenisId } });
      if (!jenis || !jenis.isActive) return res.status(400).json({ error: 'Jenis pelanggaran tidak valid' });
      poin = jenis.poin;
      jenisPelanggaranId = jenis.id;
    }

    await prisma.laporanPotensi.create({
      data: {
        siswaId,
        namaPelapor: namaPelapor.trim(),
        tipe,
        jenisKebaikanId,
        jenisPelanggaranId,
        poin,
        keterangan: keterangan?.trim() || null,
        buktiUrl: buktiUrl || null,
      },
    });

    res.json({ success: true });
  } catch (err) { next(err); }
});

// Dashboard potensi publik
router.get('/dashboard/potensi', async (req, res, next) => {
  try {
    const { dari, sampai, kelasId, filter } = req.query as Record<string, string>;

    const tanggalFilter: any = {};
    if (dari)   { const d = new Date(dari);   d.setHours(0,0,0,0); tanggalFilter.gte = d; }
    if (sampai) { const d = new Date(sampai); d.setDate(d.getDate()+1); d.setHours(0,0,0,0); tanggalFilter.lt = d; }

    const siswas = await prisma.siswa.findMany({
      where: kelasId ? { kelasId } : {},
      select: { id: true, nama: true, nis: true, kelas: { select: { nama: true } } },
      orderBy: { nama: 'asc' },
    });

    const siswaIds = siswas.map(s => s.id);
    const tFilter = Object.keys(tanggalFilter).length ? { tanggal: tanggalFilter } : {};

    const laporan = await prisma.laporanPotensi.findMany({
      where: { siswaId: { in: siswaIds }, ...tFilter },
      select: { siswaId: true, tipe: true, poin: true },
    });

    const acc: Record<string, { totalKebaikan: number; totalPelanggaran: number }> = {};
    for (const l of laporan) {
      if (!acc[l.siswaId]) acc[l.siswaId] = { totalKebaikan: 0, totalPelanggaran: 0 };
      if (l.tipe === 'KEBAIKAN') acc[l.siswaId].totalKebaikan += l.poin;
      else acc[l.siswaId].totalPelanggaran += l.poin;
    }

    let rows = siswas.map(s => ({
      siswaId: s.id,
      nama: s.nama,
      nis: s.nis,
      kelas: s.kelas.nama,
      totalKebaikan: acc[s.id]?.totalKebaikan || 0,
      totalPelanggaran: acc[s.id]?.totalPelanggaran || 0,
      neto: (acc[s.id]?.totalKebaikan || 0) - (acc[s.id]?.totalPelanggaran || 0),
    })).filter(r => r.totalKebaikan > 0 || r.totalPelanggaran > 0);

    if (filter === 'positif') rows = rows.filter(r => r.neto > 0);
    else if (filter === 'negatif') rows = rows.filter(r => r.neto < 0);

    rows.sort((a, b) => b.neto - a.neto);

    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/presensi/verify-akses', async (req, res, next) => {
  try {
    const { jenis, kode } = req.body as { jenis: string; kode: string };

    if (!jenis || !kode) {
      return res.status(400).json({ error: 'Parameter jenis dan kode wajib diisi' });
    }
    if (jenis !== 'guru' && jenis !== 'siswa') {
      return res.status(400).json({ error: 'Jenis harus guru atau siswa' });
    }

    const cfg = await prisma.pengaturanPresensi.findFirst();

    const kodeTarget = jenis === 'guru' ? cfg?.kodeAksesGuru : cfg?.kodeAksesSiswa;

    if (!kodeTarget) {
      return res.status(403).json({ error: 'Kode akses belum dikonfigurasi oleh admin' });
    }

    if (kode.trim() !== kodeTarget) {
      return res.status(403).json({ error: 'Kode akses salah' });
    }

    res.json({ valid: true });
  } catch (error) {
    next(error);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// REQ-009: Dashboard Tugas Publik
// ─────────────────────────────────────────────────────────────────────────────

router.get('/dashboard/tugas', async (req, res, next) => {
  try {
    const kelasId        = req.query.kelasId as string | undefined;
    const mataPelajaran  = req.query.mataPelajaran as string | undefined;
    const filter         = (req.query.filter as string) || 'semua'; // semua | lengkap | kurang

    if (!kelasId) {
      return res.json({ columns: [], rows: [] });
    }

    // ── 1. Ambil ujian yang masuk ke dashboard untuk kelas ini ──
    const ujianList = await prisma.ujian.findMany({
      where: {
        masukkanKeDashboard: true,
        kelas: { some: { kelasId } },
        ...(mataPelajaran ? { mataPelajaran } : {}),
      },
      select: {
        id: true, judul: true, jenisNilai: true, materiNilai: true, mataPelajaran: true, createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // ── 2. Ambil kolom nilai manual untuk kelas ini ──
    const kolomList = await prisma.kolomNilai.findMany({
      where: {
        kelasTarget: { some: { kelasId } },
        ...(mataPelajaran ? { mataPelajaran } : {}),
      },
      select: {
        id: true, judul: true, jenis: true, materi: true, mataPelajaran: true, tanggal: true,
      },
      orderBy: { tanggal: 'asc' },
    });

    // ── 3. Gabung kolom (sorted by tanggal/createdAt asc) ──
    type ColMeta = { id: string; colKey: string; judul: string; jenis: string; materi: string; mataPelajaran: string; sumber: 'ujian' | 'manual'; tanggal: Date };
    const columns: ColMeta[] = [
      ...ujianList.map(u => ({
        id: u.id, colKey: `ujian_${u.id}`,
        judul: u.judul, jenis: u.jenisNilai || 'UH',
        materi: u.materiNilai || '', mataPelajaran: u.mataPelajaran,
        sumber: 'ujian' as const, tanggal: u.createdAt,
      })),
      ...kolomList.map(k => ({
        id: k.id, colKey: `manual_${k.id}`,
        judul: k.judul, jenis: k.jenis,
        materi: k.materi, mataPelajaran: k.mataPelajaran,
        sumber: 'manual' as const, tanggal: k.tanggal,
      })),
    ].sort((a, b) => a.tanggal.getTime() - b.tanggal.getTime());

    // ── 4. Ambil siswa di kelas ──
    const siswaList = await prisma.siswa.findMany({
      where: { kelasId },
      include: { kelas: { select: { nama: true } } },
      orderBy: { nama: 'asc' },
    });

    if (siswaList.length === 0 || columns.length === 0) {
      return res.json({ columns, rows: [] });
    }

    const siswaIds = siswaList.map(s => s.id);
    const ujianIds = ujianList.map(u => u.id);
    const kolomIds = kolomList.map(k => k.id);

    // ── 5. Ambil nilai ujian (SesiUjian) ──
    const sesiList = ujianIds.length > 0
      ? await prisma.sesiUjian.findMany({
          where: { ujianId: { in: ujianIds }, siswaId: { in: siswaIds }, status: { in: ['SELESAI', 'AUTO_SUBMIT'] } },
          select: { ujianId: true, siswaId: true, nilaiAkhir: true },
        })
      : [];

    // ── 6. Ambil nilai manual (NilaiSiswa) ──
    const nilaiManualList = kolomIds.length > 0
      ? await prisma.nilaiSiswa.findMany({
          where: { kolomNilaiId: { in: kolomIds }, siswaId: { in: siswaIds } },
          select: { kolomNilaiId: true, siswaId: true, nilai: true },
        })
      : [];

    // Index per (kolId|siswaId)
    const sesiMap = new Map<string, number | null>();
    for (const s of sesiList) sesiMap.set(`${s.ujianId}|${s.siswaId}`, s.nilaiAkhir ?? null);
    const nilaiMap = new Map<string, number | null>();
    for (const n of nilaiManualList) nilaiMap.set(`${n.kolomNilaiId}|${n.siswaId}`, n.nilai ?? null);

    // ── 7. Build rows ──
    const rows = siswaList.map(siswa => {
      const nilaiPerKolom: Record<string, number | null> = {};
      let allFilled = true;
      for (const col of columns) {
        const v = col.sumber === 'ujian'
          ? (sesiMap.get(`${col.id}|${siswa.id}`) ?? null)
          : (nilaiMap.get(`${col.id}|${siswa.id}`) ?? null);
        nilaiPerKolom[col.colKey] = v;
        if (v === null) allFilled = false;
      }
      return {
        siswaId: siswa.id,
        nama: siswa.nama,
        nis: siswa.nis,
        kelas: siswa.kelas.nama,
        nilai: nilaiPerKolom,
        keterangan: allFilled ? 'Lengkap' : 'Kurang Lengkap',
      };
    });

    // ── 8. Filter Lengkap / Kurang ──
    const filtered = filter === 'lengkap'
      ? rows.filter(r => r.keterangan === 'Lengkap')
      : filter === 'kurang'
      ? rows.filter(r => r.keterangan === 'Kurang Lengkap')
      : rows;

    res.json({
      columns: columns.map(c => ({ colKey: c.colKey, judul: c.judul, jenis: c.jenis, materi: c.materi, mataPelajaran: c.mataPelajaran, sumber: c.sumber })),
      rows: filtered,
    });
  } catch (err) { next(err); }
});

// Export Excel dashboard tugas
router.get('/dashboard/tugas/export-excel', async (req, res, next) => {
  try {
    const kelasId       = req.query.kelasId as string | undefined;
    const mataPelajaran = req.query.mataPelajaran as string | undefined;
    const filter        = (req.query.filter as string) || 'semua';

    if (!kelasId) return res.status(400).json({ error: 'kelasId wajib diisi' });

    // Reuse the same logic via internal fetch
    const kelas = await prisma.kelas.findUnique({ where: { id: kelasId }, select: { nama: true } });

    // Kolom ujian
    const ujianList = await prisma.ujian.findMany({
      where: { masukkanKeDashboard: true, kelas: { some: { kelasId } }, ...(mataPelajaran ? { mataPelajaran } : {}) },
      select: { id: true, judul: true, jenisNilai: true, materiNilai: true, mataPelajaran: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    const kolomList = await prisma.kolomNilai.findMany({
      where: { kelasTarget: { some: { kelasId } }, ...(mataPelajaran ? { mataPelajaran } : {}) },
      select: { id: true, judul: true, jenis: true, materi: true, mataPelajaran: true, tanggal: true },
      orderBy: { tanggal: 'asc' },
    });

    type ColMeta = { id: string; colKey: string; judul: string; jenis: string; materi: string; sumber: 'ujian' | 'manual'; tanggal: Date };
    const columns: ColMeta[] = [
      ...ujianList.map(u => ({ id: u.id, colKey: `ujian_${u.id}`, judul: u.judul, jenis: u.jenisNilai || 'UH', materi: u.materiNilai || '', sumber: 'ujian' as const, tanggal: u.createdAt })),
      ...kolomList.map(k => ({ id: k.id, colKey: `manual_${k.id}`, judul: k.judul, jenis: k.jenis, materi: k.materi, sumber: 'manual' as const, tanggal: k.tanggal })),
    ].sort((a, b) => a.tanggal.getTime() - b.tanggal.getTime());

    const siswaList = await prisma.siswa.findMany({
      where: { kelasId },
      include: { kelas: { select: { nama: true } } },
      orderBy: { nama: 'asc' },
    });

    const ujianIds  = ujianList.map(u => u.id);
    const kolomIds  = kolomList.map(k => k.id);
    const siswaIds  = siswaList.map(s => s.id);

    const sesiList  = ujianIds.length > 0
      ? await prisma.sesiUjian.findMany({ where: { ujianId: { in: ujianIds }, siswaId: { in: siswaIds }, status: { in: ['SELESAI', 'AUTO_SUBMIT'] } }, select: { ujianId: true, siswaId: true, nilaiAkhir: true } })
      : [];
    const nilaiManual = kolomIds.length > 0
      ? await prisma.nilaiSiswa.findMany({ where: { kolomNilaiId: { in: kolomIds }, siswaId: { in: siswaIds } }, select: { kolomNilaiId: true, siswaId: true, nilai: true } })
      : [];

    const sesiMap  = new Map<string, number | null>(sesiList.map(s => [`${s.ujianId}|${s.siswaId}`, s.nilaiAkhir ?? null]));
    const nilaiMap = new Map<string, number | null>(nilaiManual.map(n => [`${n.kolomNilaiId}|${n.siswaId}`, n.nilai ?? null]));

    const rows = siswaList.map(siswa => {
      const nilaiPerKolom: Record<string, number | null> = {};
      let allFilled = true;
      for (const col of columns) {
        const v = col.sumber === 'ujian' ? (sesiMap.get(`${col.id}|${siswa.id}`) ?? null) : (nilaiMap.get(`${col.id}|${siswa.id}`) ?? null);
        nilaiPerKolom[col.colKey] = v;
        if (v === null) allFilled = false;
      }
      return { siswa, nilaiPerKolom, keterangan: allFilled ? 'Lengkap' : 'Kurang Lengkap' };
    });

    const filtered = filter === 'lengkap' ? rows.filter(r => r.keterangan === 'Lengkap')
      : filter === 'kurang' ? rows.filter(r => r.keterangan === 'Kurang Lengkap') : rows;

    const ExcelJS = await import('exceljs');
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Rekap Nilai');

    // Header row 1: judul kolom
    const headerRow = ['No', 'Nama Siswa', 'NIS', 'Kelas', ...columns.map(c => c.judul), 'Keterangan'];
    ws.addRow(headerRow);
    // Header row 2: jenis • materi
    const subRow = ['', '', '', '', ...columns.map(c => `${c.jenis}${c.materi ? ' • ' + c.materi : ''}`), ''];
    ws.addRow(subRow);

    filtered.forEach((row, i) => {
      ws.addRow([i + 1, row.siswa.nama, row.siswa.nis, row.siswa.kelas.nama, ...columns.map(c => row.nilaiPerKolom[c.colKey] ?? ''), row.keterangan]);
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="rekap-nilai-${kelas?.nama || kelasId}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) { next(err); }
});

// Daftar mata pelajaran yang tersedia untuk kelas tertentu (filter dropdown)
router.get('/dashboard/tugas/mata-pelajaran', async (req, res, next) => {
  try {
    const kelasId = req.query.kelasId as string | undefined;
    if (!kelasId) return res.json([]);

    const [ujianMapel, kolomMapel] = await Promise.all([
      prisma.ujian.findMany({
        where: { masukkanKeDashboard: true, kelas: { some: { kelasId } } },
        select: { mataPelajaran: true },
        distinct: ['mataPelajaran'],
      }),
      prisma.kolomNilai.findMany({
        where: { kelasTarget: { some: { kelasId } } },
        select: { mataPelajaran: true },
        distinct: ['mataPelajaran'],
      }),
    ]);

    const set = new Set([...ujianMapel.map(u => u.mataPelajaran), ...kolomMapel.map(k => k.mataPelajaran)]);
    res.json([...set].sort());
  } catch (err) { next(err); }
});

export default router;
