import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware';

// Upload foto presensi guru (datang/pulang)
const uploadsBase    = path.dirname(process.env.UPLOAD_PATH || path.join(__dirname, '../../uploads/berita'));
const presensiPath   = path.join(uploadsBase, 'presensi');
const uploadBaseUrl  = process.env.UPLOAD_BASE_URL || '';
if (!fs.existsSync(presensiPath)) fs.mkdirSync(presensiPath, { recursive: true });

const uploadPresensi = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, presensiPath),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, `presensi-${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB (sudah dikompres 640x480 JPEG 0.8)
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) cb(null, true);
    else cb(new Error('Format foto harus JPEG, PNG, atau WEBP'));
  },
});

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

/** Format Date ke "HH.mm" dalam timezone WIB — dipakai untuk response kiosk.
 *  Hostinger berjalan UTC; tanpa timeZone 07:30 WIB akan tampil "00.30". */
function fmtWIB(d: Date): string {
  return d.toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' });
}

/** Bangun target waktu masuk/pulang dalam WIB dari string "HH:mm".
 *  Diperlukan agar perhitungan keterlambatan benar di server UTC. */
function buildTargetWIB(referensi: Date, hhmm: string): Date {
  const [jam, menit] = hhmm.split(':').map(Number);
  // Geser ke WIB untuk ambil tanggal lokalnya
  const wibDate = new Date(referensi.getTime() + 7 * 60 * 60 * 1000);
  const dateStr  = wibDate.toISOString().slice(0, 10); // "YYYY-MM-DD" versi WIB
  return new Date(`${dateStr}T${String(jam).padStart(2, '0')}:${String(menit).padStart(2, '0')}:00+07:00`);
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
// POST /api/presensi/upload/foto — Upload foto presensi (publik, dipanggil sebelum datang/pulang)
router.post('/upload/foto', uploadPresensi.single('foto'), async (req, res, next) => {
  try {
    if (!process.env.UPLOAD_PATH || !process.env.UPLOAD_BASE_URL) {
      return res.status(500).json({ error: 'UPLOAD_PATH atau UPLOAD_BASE_URL belum dikonfigurasi' });
    }
    if (!req.file) return res.status(400).json({ error: 'File foto tidak ditemukan' });
    const url = `${uploadBaseUrl}/uploads/presensi/${req.file.filename}`;
    res.json({ url });
  } catch (err) { next(err); }
});

// Digunakan oleh halaman kiosk untuk mengisi dropdown
// ─────────────────────────────────────────────────────────────────────────────

router.get('/guru-list', async (req, res, next) => {
  try {
    const today = tanggalHariIni();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const list = await prisma.guru.findMany({
      where: { user: { isActive: true } },
      select: {
        id: true,
        nama: true,
        nip: true,
        presensiGuru: {
          where: {
            tanggal: {
              gte: today,
              lt: tomorrow
            }
          },
          select: { waktuDatang: true, waktuPulang: true, autoCheckout: true },
        },
      },
      orderBy: { nama: 'asc' },
    });

    res.json(
      list.map((g: any) => {
        const presensi = g.presensiGuru[0];
        return {
          id: g.id,
          nama: g.nama,
          nip: g.nip,
          statusHariIni: presensi ? {
            sudahDatang: !!presensi.waktuDatang,
            sudahPulang: !!presensi.waktuPulang,
            waktuDatang: presensi.waktuDatang ? fmtWIB(new Date(presensi.waktuDatang)) : undefined,
            waktuPulang: presensi.waktuPulang ? fmtWIB(new Date(presensi.waktuPulang)) : undefined,
          } : undefined,
        };
      })
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
    const { guruId, latitude, longitude, fotoUrl } = req.body;
    if (!guruId) return res.status(400).json({ error: 'guruId wajib diisi' });

    const guru = await prisma.guru.findUnique({ where: { id: guruId } });
    if (!guru) return res.status(404).json({ error: 'Guru tidak ditemukan' });

    if (!fotoUrl) {
      return res.status(400).json({ error: 'Foto wajib diambil untuk verifikasi' });
    }
    if (latitude == null || longitude == null) {
      return res.status(400).json({ error: 'Lokasi wajib diaktifkan untuk presensi' });
    }

    const cfg = await prisma.pengaturanPresensi.findFirst();
    if (!cfg || cfg.latitudeSekolah === 0 || cfg.longitudeSekolah === 0) {
      return res.status(500).json({ error: 'Pengaturan lokasi sekolah belum dikonfigurasi oleh admin' });
    }

    const jarak = Math.round(
      hitungJarakMeter(latitude, longitude, cfg.latitudeSekolah, cfg.longitudeSekolah)
    );

    if (jarak > cfg.radiusMeter) {
      return res.status(403).json({
        error: `Anda berada di luar jangkauan sekolah.\n\nJarak Anda: ${jarak} meter\nBatas maksimal: ${cfg.radiusMeter} meter\n\nSilakan datang ke sekolah untuk melakukan presensi.`,
        jarak,
        radiusMeter: cfg.radiusMeter,
      });
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
      create:  { guruId, tanggal: today, waktuDatang: new Date(), fotoDatang: fotoUrl },
      update:  { waktuDatang: new Date(), fotoDatang: fotoUrl },
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
    const { guruId, latitude, longitude, fotoUrl } = req.body;
    if (!guruId) return res.status(400).json({ error: 'guruId wajib diisi' });

    const guru = await prisma.guru.findUnique({ where: { id: guruId } });
    if (!guru) return res.status(404).json({ error: 'Guru tidak ditemukan' });

    if (!fotoUrl) {
      return res.status(400).json({ error: 'Foto wajib diambil untuk verifikasi' });
    }
    if (latitude == null || longitude == null) {
      return res.status(400).json({ error: 'Lokasi wajib diaktifkan untuk presensi' });
    }

    const cfg = await prisma.pengaturanPresensi.findFirst();
    if (!cfg || cfg.latitudeSekolah === 0 || cfg.longitudeSekolah === 0) {
      return res.status(500).json({ error: 'Pengaturan lokasi sekolah belum dikonfigurasi oleh admin' });
    }

    const jarak = Math.round(
      hitungJarakMeter(latitude, longitude, cfg.latitudeSekolah, cfg.longitudeSekolah)
    );

    if (jarak > cfg.radiusMeter) {
      return res.status(403).json({
        error: `Anda berada di luar jangkauan sekolah.\n\nJarak Anda: ${jarak} meter\nBatas maksimal: ${cfg.radiusMeter} meter\n\nSilakan datang ke sekolah untuk melakukan presensi.`,
        jarak,
        radiusMeter: cfg.radiusMeter,
      });
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
      data: { waktuPulang: new Date(), fotoPulang: fotoUrl, autoCheckout: false },
    });

    res.json({ success: true, nama: guru.nama, waktuPulang: record.waktuPulang });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3c. GET /api/presensi/guru/recent - Recent activity hari ini untuk kiosk
// ─────────────────────────────────────────────────────────────────────────────

router.get('/guru/recent', async (req, res, next) => {
  try {
    const today = tanggalHariIni();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const limit = Number(req.query.limit) || 10;

    const cfg = await prisma.pengaturanPresensi.findFirst();
    const jamMasukDefault = cfg?.jamMasukDefault || '07:00';

    const data = await prisma.presensiGuru.findMany({
      where: {
        tanggal: {
          gte: today,
          lt: tomorrow
        }
      },
      orderBy: { waktuDatang: 'desc' },
      take: limit,
      select: {
        id: true,
        waktuDatang: true,
        waktuPulang: true,
        autoCheckout: true,
        guru: { select: { nama: true, nip: true } },
      },
    });

    const result = data.map(p => {
      let keterlambatan = 0;
      let totalJam = 0;

      if (p.waktuDatang) {
        const targetMasuk = buildTargetWIB(p.waktuDatang, jamMasukDefault);
        if (p.waktuDatang > targetMasuk) {
          keterlambatan = Math.floor((p.waktuDatang.getTime() - targetMasuk.getTime()) / 60_000);
        }
        if (p.waktuPulang) {
          totalJam = Math.floor((p.waktuPulang.getTime() - p.waktuDatang.getTime()) / 60_000);
        }
      }

      return {
        id: p.id,
        nama: p.guru.nama,
        nip: p.guru.nip,
        waktuDatang: p.waktuDatang ? fmtWIB(p.waktuDatang) : null,
        waktuPulang: p.waktuPulang ? fmtWIB(p.waktuPulang) : null,
        keterlambatan,
        totalJam,
        autoCheckout: p.autoCheckout,
      };
    });

    res.json(result);
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3d. GET /api/presensi/siswa/recent - Recent activity hari ini untuk kiosk
// ─────────────────────────────────────────────────────────────────────────────

router.get('/siswa/recent', async (req, res, next) => {
  try {
    const today = tanggalHariIni();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const limit = Number(req.query.limit) || 10;

    const cfg = await prisma.pengaturanPresensi.findFirst();
    const jamMasukDefault = cfg?.jamMasukDefault || '07:00';

    const data = await prisma.presensiSiswa.findMany({
      where: {
        tanggal: {
          gte: today,
          lt: tomorrow
        }
      },
      orderBy: { waktuDatang: 'desc' },
      take: limit,
      select: {
        id: true,
        waktuDatang: true,
        siswa: {
          select: {
            nama: true,
            nis: true,
            kelasId: true,
            kelas: { select: { id: true, nama: true } },
          },
        },
      },
    });

    const result = data.map(p => {
      let tepatWaktu = true;
      let keterlambatan = 0;

      const targetMasuk = buildTargetWIB(p.waktuDatang, jamMasukDefault);
      if (p.waktuDatang > targetMasuk) {
        tepatWaktu = false;
        keterlambatan = Math.floor((p.waktuDatang.getTime() - targetMasuk.getTime()) / 60_000);
      }

      return {
        id: p.id,
        nama: p.siswa.nama,
        nis: p.siswa.nis,
        kelas: p.siswa.kelas?.nama || '-',
        kelasId: p.siswa.kelasId || '',
        waktu: fmtWIB(p.waktuDatang),
        tepatWaktu,
        keterlambatan,
      };
    });

    res.json(result);
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. GET /api/presensi/guru/dashboard
// Query: page, tanggal (YYYY-MM-DD) | bulan + tahun
// Respons: { data, total, page, totalPages }
// Kolom: no, nama, nip, waktuDatang, waktuPulang, durasi(menit), foto, autoCheckout, keterlambatan, totalJam
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

    // Ambil jam masuk default untuk hitung keterlambatan
    const cfg = await prisma.pengaturanPresensi.findFirst();
    const jamMasukDefault = cfg?.jamMasukDefault || '07:00';

    const data = rows.map((p: any, i: number) => {
      let keterlambatan = 0;
      let totalJam = 0;

      if (p.waktuDatang) {
        const targetMasuk = buildTargetWIB(p.waktuDatang, jamMasukDefault);
        if (p.waktuDatang > targetMasuk) {
          keterlambatan = Math.floor((p.waktuDatang.getTime() - targetMasuk.getTime()) / 60_000);
        }
        if (p.waktuPulang) {
          totalJam = Math.floor((p.waktuPulang.getTime() - p.waktuDatang.getTime()) / 60_000);
        }
      }

      return {
        no:           skip + i + 1,
        id:           p.id,
        nama:         p.guru.nama,
        nip:          p.guru.nip,
        tanggal:      p.tanggal,
        waktuDatang:  p.waktuDatang,
        waktuPulang:  p.waktuPulang,
        autoCheckout: p.autoCheckout,
        fotoDatang:   p.fotoDatang,
        fotoPulang:   p.fotoPulang,
        durasi:       totalJam || null,
        keterlambatan, // dalam menit
        totalJam,      // dalam menit (sama dengan durasi)
      };
    });

    res.json({ data, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// 5a. GET /api/presensi/siswa/cari?nis=xxx
// Lookup siswa by NIS (untuk kiosk) tanpa submit presensi
// ─────────────────────────────────────────────────────────────────────────────

router.get('/siswa/cari', async (req, res, next) => {
  try {
    const nis = req.query.nis ? String(req.query.nis).trim() : '';
    if (!nis) return res.status(400).json({ error: 'NIS wajib diisi' });

    const siswa = await prisma.siswa.findUnique({
      where: { nis },
      select: { id: true, nama: true, nis: true, kelas: { select: { nama: true } } },
    });

    if (!siswa) {
      return res.status(404).json({ error: `Siswa dengan NIS "${nis}" tidak ditemukan.` });
    }

    res.json({
      id: siswa.id,
      nama: siswa.nama,
      nis: siswa.nis,
      kelas: siswa.kelas?.nama ?? '-',
    });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// 5b. POST /api/presensi/siswa
// Body: { siswaId } atau { nis }
// Catat waktuDatang siswa
// ─────────────────────────────────────────────────────────────────────────────

router.post('/siswa', async (req, res, next) => {
  try {
    const { siswaId, nis } = req.body;
    if (!siswaId && !nis) {
      return res.status(400).json({ error: 'siswaId atau nis wajib diisi' });
    }

    // Lookup siswa by ID atau NIS
    const where = siswaId ? { id: siswaId } : { nis: String(nis).trim() };
    const siswa = await prisma.siswa.findUnique({
      where,
      select: { id: true, nama: true, nis: true, kelas: { select: { nama: true } } },
    });

    if (!siswa) {
      return res.status(404).json({
        error: siswaId
          ? 'Siswa tidak ditemukan.'
          : `Siswa dengan NIS "${nis}" tidak ditemukan.`,
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
      koordinatSekolah, // Format: "-5.148011655370297, 119.54943519565128" (Google Maps)
      radiusMeter,
      jamMasukDefault,
      jamPulangDefault,
    } = req.body;

    // Parse koordinat dari format Google Maps
    let latitudeSekolah = 0;
    let longitudeSekolah = 0;

    if (koordinatSekolah && typeof koordinatSekolah === 'string') {
      const parts = koordinatSekolah.split(',').map(s => s.trim());
      if (parts.length === 2) {
        latitudeSekolah = Number(parts[0]);
        longitudeSekolah = Number(parts[1]);

        // Validasi range
        if (isNaN(latitudeSekolah) || isNaN(longitudeSekolah)) {
          return res.status(400).json({ error: 'Format koordinat tidak valid. Contoh: -5.148011, 119.549435' });
        }
        if (latitudeSekolah < -90 || latitudeSekolah > 90) {
          return res.status(400).json({ error: 'Latitude harus antara -90 dan 90' });
        }
        if (longitudeSekolah < -180 || longitudeSekolah > 180) {
          return res.status(400).json({ error: 'Longitude harus antara -180 dan 180' });
        }
      } else {
        return res.status(400).json({ error: 'Format koordinat tidak valid. Gunakan format: latitude, longitude' });
      }
    }

    const payload = {
      latitudeSekolah,
      longitudeSekolah,
      radiusMeter: Number(radiusMeter) || 100,
      jamMasukDefault: String(jamMasukDefault || '07:00').trim(),
      jamPulangDefault: String(jamPulangDefault || '15:30').trim(),
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

// GET /api/presensi/siswa/stats — statistik hari ini untuk kiosk
router.get('/siswa/stats', async (req, res, next) => {
  try {
    const today = tanggalHariIni();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Total siswa
    const totalSiswa = await prisma.siswa.count();

    // Hadir hari ini
    const hadirCount = await prisma.presensiSiswa.count({
      where: {
        tanggal: {
          gte: today,
          lt: tomorrow
        }
      }
    });

    // Per kelas summary
    const kelasList = await prisma.kelas.findMany({
      select: {
        id: true,
        nama: true,
        _count: { select: { siswa: true } },
        siswa: {
          select: {
            id: true,
            presensiSiswa: {
              where: {
                tanggal: {
                  gte: today,
                  lt: tomorrow
                }
              },
              select: { id: true }
            }
          }
        }
      },
      orderBy: { nama: 'asc' }
    });

    const kelasSummary = kelasList.map(k => ({
      id: k.id,
      nama: k.nama,
      totalSiswa: k._count.siswa,
      hadirCount: k.siswa.filter(s => s.presensiSiswa.length > 0).length
    }));

    res.json({ totalSiswa, hadirCount, kelasSummary });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3f. GET /api/presensi/siswa/belum-hadir - Siswa yang belum hadir hari ini
// ─────────────────────────────────────────────────────────────────────────────

router.get('/siswa/belum-hadir', async (req, res, next) => {
  try {
    const today = tanggalHariIni();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const kelasId = req.query.kelasId as string | undefined;

    // Query siswa yang belum hadir
    const siswaList = await prisma.siswa.findMany({
      where: {
        ...(kelasId && kelasId !== 'ALL' ? { kelasId } : {}),
        presensiSiswa: {
          none: {
            tanggal: {
              gte: today,
              lt: tomorrow
            }
          }
        }
      },
      select: {
        id: true,
        nama: true,
        nis: true,
        kelas: {
          select: {
            id: true,
            nama: true
          }
        }
      },
      orderBy: { nama: 'asc' }
    });

    const result = siswaList.map(s => ({
      id: s.id,
      nama: s.nama,
      nis: s.nis,
      kelas: s.kelas?.nama || '-',
      kelasId: s.kelas?.id || ''
    }));

    res.json(result);
  } catch (err) { next(err); }
});

export default router;
