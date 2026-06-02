import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware';

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// Utils
// ─────────────────────────────────────────────────────────────────────────────

/** Haversine — kembalikan jarak dalam meter antara dua koordinat */
function hitungJarakMeter(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6_371_000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Midnight lokal hari ini */
function tanggalHariIni(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Parse "HH:mm" → Date hari ini dengan jam tersebut */
function jamKeDate(hhmm: string): Date {
  const [jam, menit] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(jam, menit, 0, 0);
  return d;
}

// ─────────────────────────────────────────────────────────────────────────────
// Auto-Checkout Cron
// Dijalankan setiap menit. Guru yang belum pulang dan sudah lewat
// jam_pulang_default akan di-checkout otomatis.
// ─────────────────────────────────────────────────────────────────────────────

async function jalankanAutoCheckout(): Promise<void> {
  try {
    const cfg = await prisma.pengaturanPresensi.findFirst();
    if (!cfg) return;

    const sekarang = new Date();
    const batasWaktu = jamKeDate(cfg.jamPulangDefault);

    if (sekarang < batasWaktu) return;

    const { count } = await prisma.presensiGuru.updateMany({
      where: {
        tanggal: tanggalHariIni(),
        waktuDatang: { not: null },
        waktuPulang: null,
        autoCheckout: false,
      },
      data: {
        waktuPulang: batasWaktu,
        autoCheckout: true,
      },
    });

    if (count > 0) {
      console.log(`[AutoCheckout] ${count} guru di-checkout otomatis (${cfg.jamPulangDefault})`);
    }
  } catch (err) {
    console.error('[AutoCheckout] Error:', err);
  }
}

export function startAutoCheckoutCron(): void {
  setInterval(jalankanAutoCheckout, 60_000);
  console.log('[AutoCheckout] Cron aktif — interval 1 menit');
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. GET /api/presensi/guru-list
// Daftar semua guru aktif + status presensi hari ini
// Digunakan oleh halaman kiosk untuk mengisi dropdown
// ─────────────────────────────────────────────────────────────────────────────

router.get('/guru-list', async (req, res, next) => {
  try {
    const today = tanggalHariIni();
    const list = await prisma.guru.findMany({
      where: { user: { isActive: true } },
      select: {
        id: true,
        nama: true,
        nip: true,
        presensiGuru: {
          where: { tanggal: today },
          select: { waktuDatang: true, waktuPulang: true, autoCheckout: true },
        },
      },
      orderBy: { nama: 'asc' },
    });

    res.json(
      list.map((g: any) => ({
        id: g.id,
        nama: g.nama,
        nip: g.nip,
        presensiHariIni: g.presensiGuru[0] ?? null,
      }))
    );
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. POST /api/presensi/guru/datang
// Body: { guruId, latitude?, longitude?, fotoBase64? }
// Validasi geofencing lalu catat waktuDatang
// ─────────────────────────────────────────────────────────────────────────────

router.post('/guru/datang', async (req, res, next) => {
  try {
    const { guruId, latitude, longitude, fotoBase64 } = req.body;
    if (!guruId) return res.status(400).json({ error: 'guruId wajib diisi' });

    const guru = await prisma.guru.findUnique({ where: { id: guruId } });
    if (!guru) return res.status(404).json({ error: 'Guru tidak ditemukan' });

    // Geofencing — hanya divalidasi jika koordinat dikirim
    if (latitude != null && longitude != null) {
      const cfg = await prisma.pengaturanPresensi.findFirst();
      if (cfg && (cfg.latitudeSekolah !== 0 || cfg.longitudeSekolah !== 0)) {
        const jarak = Math.round(
          hitungJarakMeter(latitude, longitude, cfg.latitudeSekolah, cfg.longitudeSekolah)
        );
        if (jarak > cfg.radiusMeter) {
          return res.status(400).json({
            error: `Anda berada ${jarak} m dari sekolah. Batas radius: ${cfg.radiusMeter} m.`,
            jarak,
            radiusMeter: cfg.radiusMeter,
          });
        }
      }
    }

    const today = tanggalHariIni();
    const existing = await prisma.presensiGuru.findUnique({
      where: { guruId_tanggal: { guruId, tanggal: today } },
    });

    if (existing?.waktuDatang) {
      return res.status(409).json({
        error: `${guru.nama} sudah mencatat kehadiran hari ini.`,
        waktuDatang: existing.waktuDatang,
      });
    }

    const record = await prisma.presensiGuru.upsert({
      where: { guruId_tanggal: { guruId, tanggal: today } },
      create:  { guruId, tanggal: today, waktuDatang: new Date(), fotoDatang: fotoBase64 ?? null },
      update:  { waktuDatang: new Date(), fotoDatang: fotoBase64 ?? null },
    });

    res.json({ success: true, nama: guru.nama, waktuDatang: record.waktuDatang });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. POST /api/presensi/guru/pulang
// Body: { guruId, latitude?, longitude?, fotoBase64? }
// Validasi geofencing lalu catat waktuPulang
// ─────────────────────────────────────────────────────────────────────────────

router.post('/guru/pulang', async (req, res, next) => {
  try {
    const { guruId, latitude, longitude, fotoBase64 } = req.body;
    if (!guruId) return res.status(400).json({ error: 'guruId wajib diisi' });

    const guru = await prisma.guru.findUnique({ where: { id: guruId } });
    if (!guru) return res.status(404).json({ error: 'Guru tidak ditemukan' });

    // Geofencing
    if (latitude != null && longitude != null) {
      const cfg = await prisma.pengaturanPresensi.findFirst();
      if (cfg && (cfg.latitudeSekolah !== 0 || cfg.longitudeSekolah !== 0)) {
        const jarak = Math.round(
          hitungJarakMeter(latitude, longitude, cfg.latitudeSekolah, cfg.longitudeSekolah)
        );
        if (jarak > cfg.radiusMeter) {
          return res.status(400).json({
            error: `Anda berada ${jarak} m dari sekolah. Batas radius: ${cfg.radiusMeter} m.`,
            jarak,
            radiusMeter: cfg.radiusMeter,
          });
        }
      }
    }

    const today = tanggalHariIni();
    const existing = await prisma.presensiGuru.findUnique({
      where: { guruId_tanggal: { guruId, tanggal: today } },
    });

    if (!existing?.waktuDatang) {
      return res.status(400).json({ error: `${guru.nama} belum mencatat kehadiran hari ini.` });
    }
    if (existing.waktuPulang) {
      return res.status(409).json({
        error: `${guru.nama} sudah mencatat kepulangan hari ini.`,
        waktuPulang: existing.waktuPulang,
      });
    }

    const record = await prisma.presensiGuru.update({
      where: { guruId_tanggal: { guruId, tanggal: today } },
      data: { waktuPulang: new Date(), fotoPulang: fotoBase64 ?? null, autoCheckout: false },
    });

    res.json({ success: true, nama: guru.nama, waktuPulang: record.waktuPulang });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. GET /api/presensi/guru/dashboard
// Query: page, tanggal (YYYY-MM-DD) | bulan + tahun
// Respons: { data, total, page, totalPages }
// Kolom: no, nama, nip, waktuDatang, waktuPulang, durasi(menit), foto, autoCheckout
// ─────────────────────────────────────────────────────────────────────────────

router.get('/guru/dashboard', async (req, res, next) => {
  try {
    const page  = Math.max(1, Number(req.query.page) || 1);
    const limit = 15;
    const skip  = (page - 1) * limit;

    let where: any = {};

    if (req.query.tanggal) {
      const d = new Date(String(req.query.tanggal));
      d.setHours(0, 0, 0, 0);
      where = { tanggal: d };
    } else if (req.query.bulan && req.query.tahun) {
      const start = new Date(Number(req.query.tahun), Number(req.query.bulan) - 1, 1);
      const end   = new Date(Number(req.query.tahun), Number(req.query.bulan), 1);
      where = { tanggal: { gte: start, lt: end } };
    } else {
      where = { tanggal: tanggalHariIni() };
    }

    const [rows, total] = await Promise.all([
      prisma.presensiGuru.findMany({
        where,
        include: { guru: { select: { id: true, nama: true, nip: true } } },
        orderBy: [{ tanggal: 'desc' }, { waktuDatang: 'asc' }],
        skip,
        take: limit,
      }),
      prisma.presensiGuru.count({ where }),
    ]);

    const data = rows.map((p: any, i: number) => ({
      no:           skip + i + 1,
      id:           p.id,
      nama:         p.guru.nama,
      nip:          p.guru.nip,
      tanggal:      p.tanggal,
      waktuDatang:  p.waktuDatang,
      waktuPulang:  p.waktuPulang,
      autoCheckout: p.autoCheckout,
      fotoDatang:   p.fotoDatang,   // Base64 — dirender di frontend
      fotoPulang:   p.fotoPulang,
      durasi:       p.waktuDatang && p.waktuPulang
        ? Math.round((p.waktuPulang.getTime() - p.waktuDatang.getTime()) / 60_000)
        : null,
    }));

    res.json({ data, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. POST /api/presensi/siswa
// Body: { nis }
// Lookup siswa by NIS (RFID scan), catat waktuDatang
// ─────────────────────────────────────────────────────────────────────────────

router.post('/siswa', async (req, res, next) => {
  try {
    const { nis } = req.body;
    if (!nis) return res.status(400).json({ error: 'NIS wajib diisi' });

    const siswa = await prisma.siswa.findUnique({
      where: { nis: String(nis).trim() },
      select: { id: true, nama: true, nis: true, kelas: { select: { nama: true } } },
    });

    if (!siswa) {
      return res.status(404).json({
        error: `Siswa dengan NIS "${nis}" tidak ditemukan.`,
      });
    }

    const today = tanggalHariIni();
    const existing = await prisma.presensiSiswa.findUnique({
      where: { siswaId_tanggal: { siswaId: siswa.id, tanggal: today } },
    });

    if (existing) {
      return res.status(409).json({
        sudahAbsen: true,
        nama:        siswa.nama,
        kelas:       siswa.kelas?.nama ?? '-',
        waktuDatang: existing.waktuDatang,
        error:       `${siswa.nama} sudah tercatat hadir hari ini.`,
      });
    }

    const record = await prisma.presensiSiswa.create({
      data: { siswaId: siswa.id, tanggal: today, waktuDatang: new Date() },
    });

    res.json({
      success: true,
      nama:        siswa.nama,
      nis:         siswa.nis,
      kelas:       siswa.kelas?.nama ?? '-',
      waktuDatang: record.waktuDatang,
    });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. GET /api/presensi/pengaturan  — publik (dibutuhkan kiosk)
// ─────────────────────────────────────────────────────────────────────────────

router.get('/pengaturan', async (req, res, next) => {
  try {
    const cfg = await prisma.pengaturanPresensi.findFirst();
    res.json(cfg ?? {
      latitudeSekolah:  0,
      longitudeSekolah: 0,
      radiusMeter:      100,
      jamMasukDefault:  '07:00',
      jamPulangDefault: '15:30',
    });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. PUT /api/presensi/pengaturan  — SUPER_ADMIN only
// Body: { latitudeSekolah, longitudeSekolah, radiusMeter, jamMasukDefault, jamPulangDefault }
// ─────────────────────────────────────────────────────────────────────────────

router.put('/pengaturan', requireAuth, requireRole(['SUPER_ADMIN']), async (req, res, next) => {
  try {
    const {
      latitudeSekolah, longitudeSekolah, radiusMeter,
      jamMasukDefault, jamPulangDefault,
    } = req.body;

    const payload = {
      latitudeSekolah:  Number(latitudeSekolah),
      longitudeSekolah: Number(longitudeSekolah),
      radiusMeter:      Number(radiusMeter),
      jamMasukDefault:  String(jamMasukDefault).trim(),
      jamPulangDefault: String(jamPulangDefault).trim(),
    };

    const existing = await prisma.pengaturanPresensi.findFirst();
    const data = existing
      ? await prisma.pengaturanPresensi.update({ where: { id: existing.id }, data: payload })
      : await prisma.pengaturanPresensi.create({ data: payload });

    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

// 8. GET /api/presensi/siswa/dashboard — SUPER_ADMIN
// Query: page, tanggal | bulan + tahun, search (nama/nis)

router.get('/siswa/dashboard', requireAuth, requireRole(['SUPER_ADMIN']), async (req, res, next) => {
  try {
    const page   = Math.max(1, Number(req.query.page) || 1);
    const limit  = 15;
    const skip   = (page - 1) * limit;
    const search = String(req.query.search || '').trim();

    let tanggalWhere: any = {};
    if (req.query.tanggal) {
      const d = new Date(String(req.query.tanggal));
      d.setHours(0, 0, 0, 0);
      tanggalWhere = { tanggal: d };
    } else if (req.query.bulan && req.query.tahun) {
      const start = new Date(Number(req.query.tahun), Number(req.query.bulan) - 1, 1);
      const end   = new Date(Number(req.query.tahun), Number(req.query.bulan), 1);
      tanggalWhere = { tanggal: { gte: start, lt: end } };
    } else {
      tanggalWhere = { tanggal: tanggalHariIni() };
    }

    const siswaWhere = search
      ? { OR: [{ nama: { contains: search } }, { nis: { contains: search } }] }
      : undefined;

    const where: any = {
      ...tanggalWhere,
      ...(siswaWhere ? { siswa: siswaWhere } : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.presensiSiswa.findMany({
        where,
        include: {
          siswa: { select: { id: true, nama: true, nis: true, kelas: { select: { nama: true } } } },
        },
        orderBy: [{ tanggal: 'desc' }, { waktuDatang: 'asc' }],
        skip,
        take: limit,
      }),
      prisma.presensiSiswa.count({ where }),
    ]);

    const data = rows.map((p: any, i: number) => ({
      no:          skip + i + 1,
      id:          p.id,
      nis:         p.siswa.nis,
      nama:        p.siswa.nama,
      kelas:       p.siswa.kelas?.nama ?? '-',
      tanggal:     p.tanggal,
      waktuDatang: p.waktuDatang,
    }));

    res.json({ data, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
});

// 9. PATCH /api/presensi/guru/:id — SUPER_ADMIN (koreksi manual)
// Body: { waktuDatang?, waktuPulang? }

router.patch('/guru/:id', requireAuth, requireRole(['SUPER_ADMIN']), async (req, res, next) => {
  try {
    const { waktuDatang, waktuPulang } = req.body;

    const existing = await prisma.presensiGuru.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Data presensi tidak ditemukan' });

    const data: any = { autoCheckout: false };
    if (waktuDatang !== undefined) data.waktuDatang = waktuDatang ? new Date(waktuDatang) : null;
    if (waktuPulang !== undefined) data.waktuPulang = waktuPulang ? new Date(waktuPulang) : null;

    const updated = await prisma.presensiGuru.update({
      where: { id: req.params.id },
      data,
    });

    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

// 10. DELETE /api/presensi/guru/:id — SUPER_ADMIN

router.delete('/guru/:id', requireAuth, requireRole(['SUPER_ADMIN']), async (req, res, next) => {
  try {
    await prisma.presensiGuru.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// 11. DELETE /api/presensi/siswa/:id — SUPER_ADMIN

router.delete('/siswa/:id', requireAuth, requireRole(['SUPER_ADMIN']), async (req, res, next) => {
  try {
    await prisma.presensiSiswa.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
