// server/routes/admin.ts
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import ExcelJS from 'exceljs';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware';
import { getPaginationParams, buildPaginatedResult } from '../lib/pagination';
import { withCache, invalidateByPrefix } from '../lib/cache';
import { toTitleCase } from '../lib/format';
import {
  validate,
  CreateUserSchema, UpdateUserSchema, BulkDeleteSchema, ResetPasswordSchema,
  CreateKelasSchema, UpdateKelasSchema,
  CreateLogoMitraSchema, UpdateLogoMitraSchema,
} from '../lib/validate';

const router = Router();

// ── Timezone helpers (server Hostinger = UTC, semua display ikut timezone sekolah) ─────
const TZ_OFFSETS_ADMIN: Record<string, string> = {
  'Asia/Jakarta':  '+07:00',
  'Asia/Makassar': '+08:00',
  'Asia/Jayapura': '+09:00',
};
const tzOffAdm = (tz: string) => TZ_OFFSETS_ADMIN[tz] || '+07:00';

const fmtWIB = (d: Date, tz: string = 'Asia/Jakarta') =>
  d.toLocaleTimeString('id-ID', { timeZone: tz, hour: '2-digit', minute: '2-digit' });
const fmtDateWIB = (d: Date, tz: string = 'Asia/Jakarta') =>
  d.toLocaleDateString('id-ID', { timeZone: tz, day: 'numeric', month: 'short', year: 'numeric' });
/** Bangun target waktu masuk/pulang dari string "HH:mm" sesuai timezone sekolah. */
function buildTargetWIB(referensi: Date, hhmm: string, tz: string = 'Asia/Jakarta'): Date {
  const [jam, menit] = hhmm.split(':').map(Number);
  const dateStr = referensi.toLocaleDateString('en-CA', { timeZone: tz });
  return new Date(`${dateStr}T${String(jam).padStart(2, '0')}:${String(menit).padStart(2, '0')}:00${tzOffAdm(tz)}`);
}
/** Midnight lokal untuk suatu date-string ("YYYY-MM-DD" atau Date) sesuai timezone. */
function wibMidnight(d: string | Date, tz: string = 'Asia/Jakarta'): Date {
  const str = typeof d === 'string' ? d : d.toLocaleDateString('en-CA', { timeZone: tz });
  return new Date(`${str}T00:00:00${tzOffAdm(tz)}`);
}
router.use(requireAuth, requireRole(['SUPER_ADMIN']));

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Multer Configuration untuk Upload Gambar Berita
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const uploadPath = process.env.UPLOAD_PATH || path.join(__dirname, '../../uploads/berita');
const uploadBaseUrl = process.env.UPLOAD_BASE_URL || '';

// Base uploads directory (parent of berita/)
const uploadsBase   = path.dirname(uploadPath);
const guruFotoPath  = path.join(uploadsBase, 'guru');
const siteImagePath = path.join(uploadsBase, 'site');

for (const dir of [uploadPath, guruFotoPath, siteImagePath]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const sanitized = file.originalname.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9.-]/g, '');
    const filename = `${Date.now()}-${sanitized}`;
    cb(null, filename);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Format file tidak didukung. Gunakan JPEG, PNG, WEBP, atau GIF.'));
    }
  }
});

const uploadGuru = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, guruFotoPath),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, `guru-${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) cb(null, true);
    else cb(new Error('Format foto harus JPEG, PNG, atau WEBP'));
  },
});

const uploadSite = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, siteImagePath),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, `site-${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/x-icon', 'image/vnd.microsoft.icon'].includes(file.mimetype)) cb(null, true);
    else cb(new Error('Format gambar harus JPEG, PNG, WEBP, GIF, atau ICO'));
  },
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Upload Gambar untuk Rich Text Editor
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

router.post('/upload/berita', upload.single('image'), async (req, res, next) => {
  try {
    if (!process.env.UPLOAD_PATH || !process.env.UPLOAD_BASE_URL) {
      return res.status(500).json({
        error: 'UPLOAD_PATH atau UPLOAD_BASE_URL belum dikonfigurasi di environment variables'
      });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'File gambar tidak ditemukan' });
    }

    const url = `${uploadBaseUrl}/uploads/berita/${req.file.filename}`;
    res.json({ url });
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/upload/site — Upload gambar pengaturan situs (logo, favicon, hero, kepsek, profil)
router.post('/upload/site', uploadSite.single('image'), async (req, res, next) => {
  try {
    if (!process.env.UPLOAD_PATH || !process.env.UPLOAD_BASE_URL) {
      return res.status(500).json({ error: 'UPLOAD_PATH atau UPLOAD_BASE_URL belum dikonfigurasi' });
    }
    if (!req.file) return res.status(400).json({ error: 'File gambar tidak ditemukan' });
    const url = `${uploadBaseUrl}/uploads/site/${req.file.filename}`;
    res.json({ url });
  } catch (err) { next(err); }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Upload & Hapus Foto Profil Guru
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

router.post('/guru/:guruId/foto', uploadGuru.single('foto'), async (req, res, next) => {
  try {
    if (!process.env.UPLOAD_PATH || !process.env.UPLOAD_BASE_URL) {
      return res.status(500).json({ error: 'UPLOAD_PATH atau UPLOAD_BASE_URL belum dikonfigurasi' });
    }
    if (!req.file) return res.status(400).json({ error: 'File foto tidak ditemukan' });

    const guru = await prisma.guru.findUnique({ where: { id: req.params.guruId }, select: { fotoUrl: true } });
    if (!guru) return res.status(404).json({ error: 'Guru tidak ditemukan' });

    // Hapus file lama jika ada dan tersimpan lokal
    if (guru.fotoUrl) {
      const oldFile = path.join(guruFotoPath, path.basename(guru.fotoUrl));
      if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
    }

    const url = `${uploadBaseUrl}/uploads/guru/${req.file.filename}`;
    await prisma.guru.update({ where: { id: req.params.guruId }, data: { fotoUrl: url } });
    invalidateByPrefix('pub:profil-guru');

    res.json({ url });
  } catch (error) { next(error); }
});

router.delete('/guru/:guruId/foto', async (req, res, next) => {
  try {
    const guru = await prisma.guru.findUnique({ where: { id: req.params.guruId }, select: { fotoUrl: true } });
    if (!guru) return res.status(404).json({ error: 'Guru tidak ditemukan' });

    if (guru.fotoUrl) {
      const oldFile = path.join(guruFotoPath, path.basename(guru.fotoUrl));
      if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
    }

    await prisma.guru.update({ where: { id: req.params.guruId }, data: { fotoUrl: null } });
    invalidateByPrefix('pub:profil-guru');

    res.json({ success: true });
  } catch (error) { next(error); }
});

router.get('/stats', async (req, res, next) => {
  try {
    const stats = await withCache('admin:stats', 120, async () => {
      const [totalSiswa, totalGuru, totalAlumni, totalUjian, totalBerita] = await Promise.all([
        prisma.siswa.count(),
        prisma.guru.count(),
        prisma.alumni.count(),
        prisma.ujian.count(),
        prisma.berita.count()
      ]);

      return { totalSiswa, totalGuru, totalAlumni, totalUjian, totalBerita };
    });
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

// Users
router.get('/users', async (req, res, next) => {
  try {
    const { role } = req.query;
    const whereCondition = role ? { role: String(role) } : {};
    const { page, limit, skip } = getPaginationParams(req.query);

    // Select eksplisit — JANGAN return password hash ke frontend (security).
    const [users, total] = await prisma.$transaction([
      prisma.user.findMany({
        where: whereCondition,
        skip, take: limit,
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
          admin: { select: { id: true, nama: true } },
          guru:  { select: {
            id: true,
            nama: true,
            nip: true,
            mataPelajaran: true,
            fotoUrl: true,
            guruMataPelajaran: { select: { id: true, nama: true }, orderBy: { nama: 'asc' } },
            kelas: { select: { id: true, nama: true }, orderBy: { nama: 'asc' } },
            guruKelas: { select: { kelas: { select: { id: true, nama: true } } }, orderBy: { kelas: { nama: 'asc' } } }
          } },
          siswa: { select: { id: true, nama: true, nis: true, rfidKode: true, kelasId: true, kelas: { select: { id: true, nama: true, tingkat: true, guru: { select: { id: true, nama: true } } } } } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where: whereCondition }),
    ]);

    res.json(buildPaginatedResult(users, total, page, limit));
  } catch (error) {
    next(error);
  }
});

router.post('/users', validate(CreateUserSchema), async (req, res, next) => {
  try {
    const { email, password, role, nama, nip, mataPelajaran, mataPelajaranList, nis, rfidKode: newRfidKode, kelasId } = req.body;

    if (!email || !password || !role || !nama) {
      return res.status(400).json({ error: 'Data wajib tidak lengkap' });
    }

    // Cek dupe natural key sebelum insert supaya pesan error jelas
    const emailExist = await prisma.user.findUnique({ where: { email } });
    if (emailExist) {
      return res.status(409).json({ error: `Email "${email}" sudah dipakai akun lain` });
    }
    if (role === 'SISWA' && nis) {
      const nisExist = await prisma.siswa.findUnique({ where: { nis: String(nis) } });
      if (nisExist) {
        return res.status(409).json({ error: `NIS "${nis}" sudah dipakai siswa lain — NIS harus unik` });
      }
    }
    if (role === 'GURU' && nip) {
      const nipExist = await prisma.guru.findUnique({ where: { nip: String(nip) } });
      if (nipExist) {
        return res.status(409).json({ error: `NIP "${nip}" sudah dipakai guru lain — NIP harus unik` });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Normalisasi daftar mapel — gabung mataPelajaran (legacy) + mataPelajaranList
    const mapelList: string[] = Array.isArray(mataPelajaranList)
      ? mataPelajaranList.map((m: string) => toTitleCase(m))
      : mataPelajaran ? [toTitleCase(mataPelajaran)] : [];
    const mapelLegacy = mapelList[0] || mataPelajaran || '';

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        role,
        ...(role === 'SUPER_ADMIN' ? { admin: { create: { nama: toTitleCase(nama) } } } : {}),
        ...(role === 'GURU' ? {
          guru: {
            create: {
              nama: toTitleCase(nama),
              nip,
              mataPelajaran: mapelLegacy,
              guruMataPelajaran: mapelList.length > 0
                ? { create: mapelList.map(n => ({ nama: n })) }
                : undefined,
            },
          },
        } : {}),
        ...(role === 'SISWA' ? { siswa: { create: { nama: toTitleCase(nama), nis, kelasId, ...(newRfidKode ? { rfidKode: newRfidKode } : {}) } } } : {})
      }
    });

    invalidateByPrefix('admin:stats');
    invalidateByPrefix('guru:stats:');
    invalidateByPrefix('guru:kelas:');
    res.json(user);
  } catch (error) {
    next(error);
  }
});

router.patch('/users/:id', validate(UpdateUserSchema), async (req, res, next) => {
  try {
    const { email, isActive, nama, nis, rfidKode, nip, mataPelajaran, mataPelajaranList, kelasId } = req.body;

    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return res.status(404).json({ error: 'Pengguna tidak ditemukan' });

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: req.params.id },
        data: {
          ...(email && { email }),
          ...(isActive !== undefined && { isActive })
        }
      });

      if (user.role === 'GURU') {
        // Sync GuruMataPelajaran jika dikirim
        if (Array.isArray(mataPelajaranList)) {
          const mapelList = mataPelajaranList.map((m: string) => toTitleCase(m));
          const guru = await tx.guru.findUnique({ where: { userId: req.params.id }, select: { id: true } });
          if (guru) {
            await tx.guruMataPelajaran.deleteMany({ where: { guruId: guru.id } });
            if (mapelList.length > 0) {
              await tx.guruMataPelajaran.createMany({
                data: mapelList.map((n: string) => ({ guruId: guru.id, nama: n })),
                skipDuplicates: true,
              });
            }
          }
        }
        const mapelLegacy = Array.isArray(mataPelajaranList) && mataPelajaranList.length > 0
          ? mataPelajaranList[0]
          : mataPelajaran;
        await tx.guru.update({
          where: { userId: req.params.id },
          data: {
            ...(nama && { nama: toTitleCase(nama) }),
            ...(nip && { nip }),
            ...(mapelLegacy && { mataPelajaran: toTitleCase(mapelLegacy) }),
          }
        });
      } else if (user.role === 'SISWA') {
        await tx.siswa.update({
          where: { userId: req.params.id },
          data: {
            ...(nama && { nama: toTitleCase(nama) }),
            ...(nis && { nis }),
            ...(kelasId && { kelasId }),
            // rfidKode: null menghapus, string mengisi, undefined tidak mengubah
            ...(rfidKode !== undefined && { rfidKode: rfidKode === '' ? null : rfidKode }),
          }
        });
      }
    });

    invalidateByPrefix('admin:stats');
    invalidateByPrefix('guru:stats:');
    invalidateByPrefix('guru:kelas:');
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.delete('/users/:id', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: { siswa: true, guru: true },
    });
    if (!user) return res.status(404).json({ error: 'Pengguna tidak ditemukan' });

    if (user.role === 'SISWA' && user.siswa) {
      const siswaId = user.siswa.id;
      await prisma.$transaction(async (tx) => {
        const sesiIds = (await tx.sesiUjian.findMany({ where: { siswaId }, select: { id: true } })).map(s => s.id);
        if (sesiIds.length > 0) {
          await tx.jawaban.deleteMany({ where: { sesiId: { in: sesiIds } } });
          await tx.pelanggaran.deleteMany({ where: { sesiId: { in: sesiIds } } });
          await tx.sesiUjian.deleteMany({ where: { id: { in: sesiIds } } });
        }
        await tx.presensiSiswa.deleteMany({ where: { siswaId } });
        await tx.siswa.delete({ where: { id: siswaId } });
        await tx.user.delete({ where: { id: req.params.id } });
      });
    } else if (user.role === 'GURU' && user.guru) {
      const guruId = user.guru.id;
      await prisma.$transaction(async (tx) => {
        // Cek apakah guru masih menjadi wali kelas dengan siswa aktif
        const kelasAktif = await tx.kelas.count({ where: { guruId, siswa: { some: {} } } });
        if (kelasAktif > 0) {
          const err: any = new Error(
            `Guru masih menjadi wali kelas dari ${kelasAktif} kelas yang memiliki siswa. Pindahkan siswa ke kelas lain terlebih dahulu.`,
          );
          err.status = 400;
          throw err;
        }

        await tx.presensiGuru.deleteMany({ where: { guruId } });

        // Hapus kelas kosong (tanpa siswa) — cascade DB: guruKelas, ujianKelas, kolomNilaiKelas
        await tx.kelas.deleteMany({ where: { guruId } });

        // Hapus semua ujian guru — cascade DB (onDelete: Cascade): sesiUjian → jawaban/pelanggaran,
        // soal → opsi/jawaban, ujianKelas
        await tx.ujian.deleteMany({ where: { guruId } });

        // Hapus kolom nilai + cascade NilaiSiswa dan KolomNilaiKelas
        // (KolomNilai.guruId tidak punya onDelete: Cascade di schema — harus manual)
        await tx.kolomNilai.deleteMany({ where: { guruId } });

        // Hapus user (cascade DB: guru → guruKelas, guruMataPelajaran, presensiGuru)
        await tx.user.delete({ where: { id: req.params.id } });
      });
    } else {
      await prisma.user.delete({ where: { id: req.params.id } });
    }

    invalidateByPrefix('admin:stats');
    invalidateByPrefix('guru:stats:');
    invalidateByPrefix('guru:kelas:');
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.post('/users/bulk-delete', validate(BulkDeleteSchema), async (req, res, next) => {
  try {
    const { ids } = req.body as { ids: string[] };
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids wajib diisi' });

    await prisma.$transaction(async (tx) => {
      const users = await tx.user.findMany({
        where: { id: { in: ids } },
        include: { siswa: true },
      });
      const siswaIds = users.filter(u => u.role === 'SISWA' && u.siswa).map(u => u.siswa!.id);
      if (siswaIds.length > 0) {
        const sesiIds = (await tx.sesiUjian.findMany({ where: { siswaId: { in: siswaIds } }, select: { id: true } })).map(s => s.id);
        if (sesiIds.length > 0) {
          await tx.jawaban.deleteMany({ where: { sesiId: { in: sesiIds } } });
          await tx.pelanggaran.deleteMany({ where: { sesiId: { in: sesiIds } } });
          await tx.sesiUjian.deleteMany({ where: { id: { in: sesiIds } } });
        }
        await tx.presensiSiswa.deleteMany({ where: { siswaId: { in: siswaIds } } });
        await tx.siswa.deleteMany({ where: { id: { in: siswaIds } } });
      }
      await tx.user.deleteMany({ where: { id: { in: ids } } });
    });

    invalidateByPrefix('admin:stats');
    invalidateByPrefix('guru:stats:');
    invalidateByPrefix('guru:kelas:');
    res.json({ success: true, deleted: ids.length });
  } catch (error) {
    next(error);
  }
});

// ── Import: download template Excel (siswa | guru) ────────
router.get('/users/import-template', async (req, res, next) => {
  try {
    const type = String(req.query.type ?? '');
    if (type !== 'siswa' && type !== 'guru') {
      return res.status(400).json({ error: 'type harus "siswa" atau "guru"' });
    }

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(type === 'siswa' ? 'Template Siswa' : 'Template Guru');

    if (type === 'siswa') {
      // Kelas reference sheet — biar user bisa pilih dari daftar kelas yg ada
      const kelas = await prisma.kelas.findMany({ orderBy: [{ tingkat: 'asc' }, { nama: 'asc' }] });

      ws.columns = [
        { header: 'NIS',        key: 'nis',       width: 16 },
        { header: 'Nama',       key: 'nama',      width: 32 },
        { header: 'Nama Kelas', key: 'kelas',     width: 24 },
        { header: 'Kode RFID (opsional)', key: 'rfidKode', width: 24 },
      ];
      ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      ws.getRow(1).eachCell(c => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
        c.alignment = { horizontal: 'center' };
      });
      // Contoh baris
      ws.addRow({ nis: '2025010', nama: 'Contoh Nama Siswa', kelas: kelas[0]?.nama ?? 'X IPA 1', rfidKode: '' });

      // Sheet kedua: daftar kelas yg valid
      const refSheet = wb.addWorksheet('Daftar Kelas');
      refSheet.columns = [
        { header: 'Nama Kelas', key: 'nama',        width: 24 },
        { header: 'Tingkat',    key: 'tingkat',     width: 10 },
        { header: 'Tahun Ajaran', key: 'tahun',     width: 16 },
      ];
      refSheet.getRow(1).font = { bold: true };
      kelas.forEach(k => refSheet.addRow({ nama: k.nama, tingkat: k.tingkat, tahun: k.tahunAjaran }));
    } else {
      ws.columns = [
        { header: 'NIP',           key: 'nip',  width: 22 },
        { header: 'Nama',          key: 'nama', width: 32 },
        { header: 'Email',         key: 'email', width: 32 },
        { header: 'Mata Pelajaran', key: 'mapel', width: 22 },
        { header: 'Password (opsional)', key: 'password', width: 20 },
      ];
      ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      ws.getRow(1).eachCell(c => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
        c.alignment = { horizontal: 'center' };
      });
      ws.addRow({
        nip: '198000000000000000', nama: 'Contoh Nama Guru',
        email: 'contoh@sekolah.sch.id', mapel: 'Matematika', password: '',
      });
      // Note row
      const noteRow = ws.addRow([]);
      noteRow.getCell(1).value = 'Catatan: Kosongkan kolom Password untuk pakai default (NIP).';
      noteRow.getCell(1).font = { italic: true, color: { argb: 'FF6B7280' } };
      ws.mergeCells(`A${noteRow.number}:E${noteRow.number}`);
    }

    const buf = await wb.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="template-import-${type}.xlsx"`);
    res.send(Buffer.from(buf));
  } catch (error) {
    next(error);
  }
});

// ── Import: bulk insert siswa atau guru ────────────────────
// Body: { type: 'siswa'|'guru', items: Array<{...}> }
// Response: { created, skipped, failed: Array<{row, message}> }
router.post('/users/import', async (req, res, next) => {
  try {
    const { type, items } = req.body as { type?: string; items?: any[] };
    if (type !== 'siswa' && type !== 'guru') {
      return res.status(400).json({ error: 'type harus "siswa" atau "guru"' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items kosong' });
    }
    if (items.length > 500) {
      return res.status(400).json({ error: 'Maksimal 500 baris per import' });
    }

    let created = 0;
    let skipped = 0;
    const failed: { row: number; message: string }[] = [];

    if (type === 'siswa') {
      // ── Pass 1: validasi in-memory, kumpulkan row valid ──
      const kelasList = await prisma.kelas.findMany();
      const kelasByNama = new Map(kelasList.map(k => [k.nama.toLowerCase().trim(), k.id]));

      type SiswaRow = { rowNumber: number; nis: string; nama: string; kelasId: string; email: string; rfidKode?: string };
      const valid: SiswaRow[] = [];

      for (let i = 0; i < items.length; i++) {
        const row = items[i];
        const rowNumber = i + 2;
        const nis = String(row.nis ?? '').trim();
        const nama = String(row.nama ?? '').trim();
        const kelasNama = String(row.kelas ?? '').trim();
        const rfidKode = String(row.rfidKode ?? row['Kode RFID (opsional)'] ?? '').trim() || undefined;

        if (!nis || !nama || !kelasNama) {
          failed.push({ row: rowNumber, message: 'NIS, Nama, dan Nama Kelas wajib diisi' });
          continue;
        }
        const kelasId = kelasByNama.get(kelasNama.toLowerCase());
        if (!kelasId) {
          failed.push({ row: rowNumber, message: `Kelas "${kelasNama}" tidak ditemukan` });
          continue;
        }
        valid.push({ rowNumber, nis, nama, kelasId, email: `${nis}@siswa.sch.id`, rfidKode });
      }

      // ── Pass 2: filter yang sudah ada di DB (1 query, bukan N findUnique) ──
      const emails = valid.map(v => v.email);
      const existingUsers = emails.length === 0
        ? []
        : await prisma.user.findMany({
            where: { email: { in: emails } },
            select: { email: true },
          });
      const existingEmailSet = new Set(existingUsers.map(u => u.email));
      const toInsert = valid.filter(v => !existingEmailSet.has(v.email));
      skipped = valid.length - toInsert.length;

      if (toInsert.length > 0) {
        // ── Pass 3: bcrypt parallel (CPU-bound, ~10x faster vs serial) ──
        const hashes = await Promise.all(toInsert.map(v => bcrypt.hash(v.nis, 10)));

        // ── Pass 4: createMany User (1 query) ──
        try {
          await prisma.user.createMany({
            data: toInsert.map((v, idx) => ({
              email: v.email,
              password: hashes[idx],
              role: 'SISWA',
            })),
            skipDuplicates: true,
          });

          // ── Pass 5: ambil userId yg baru terbuat (1 query) ──
          const newUsers = await prisma.user.findMany({
            where: { email: { in: toInsert.map(v => v.email) } },
            select: { id: true, email: true },
          });
          const userIdByEmail = new Map(newUsers.map(u => [u.email, u.id]));

          // ── Pass 6: createMany Siswa (1 query) ──
          const siswaRows = toInsert
            .map(v => ({
              userId: userIdByEmail.get(v.email),
              nis: v.nis,
              nama: v.nama,
              kelasId: v.kelasId,
              ...(v.rfidKode ? { rfidKode: v.rfidKode } : {}),
            }))
            .filter((s): s is { userId: string; nis: string; nama: string; kelasId: string } =>
              typeof s.userId === 'string'
            );
          const result = await prisma.siswa.createMany({
            data: siswaRows,
            skipDuplicates: true,
          });
          created = result.count;
        } catch (err: any) {
          // Kalau bulk gagal sepenuhnya, semua row dianggap failed.
          for (const v of toInsert) {
            failed.push({ row: v.rowNumber, message: err.message ?? 'Gagal insert (bulk)' });
          }
        }
      }
    } else {
      // ── type === 'guru' ──
      type GuruRow = { rowNumber: number; nip: string; nama: string; email: string; mapel: string; password: string };
      const valid: GuruRow[] = [];

      for (let i = 0; i < items.length; i++) {
        const row = items[i];
        const rowNumber = i + 2;
        const nip = String(row.nip ?? '').trim();
        const nama = String(row.nama ?? '').trim();
        const email = String(row.email ?? '').trim();
        const mapel = String(row.mapel ?? row.mataPelajaran ?? '').trim();
        const password = String(row.password ?? '').trim();

        if (!nip || !nama || !email || !mapel) {
          failed.push({ row: rowNumber, message: 'NIP, Nama, Email, dan Mata Pelajaran wajib diisi' });
          continue;
        }
        if (!email.includes('@')) {
          failed.push({ row: rowNumber, message: 'Format email tidak valid' });
          continue;
        }
        valid.push({ rowNumber, nip, nama, email, mapel, password });
      }

      // Filter duplikat email (1 query)
      const emails = valid.map(v => v.email);
      const existingUsers = emails.length === 0
        ? []
        : await prisma.user.findMany({
            where: { email: { in: emails } },
            select: { email: true },
          });
      const existingEmailSet = new Set(existingUsers.map(u => u.email));
      const toInsert = valid.filter(v => !existingEmailSet.has(v.email));
      skipped = valid.length - toInsert.length;

      if (toInsert.length > 0) {
        const hashes = await Promise.all(toInsert.map(v => bcrypt.hash(v.password || v.nip, 10)));

        try {
          await prisma.user.createMany({
            data: toInsert.map((v, idx) => ({
              email: v.email,
              password: hashes[idx],
              role: 'GURU',
            })),
            skipDuplicates: true,
          });

          const newUsers = await prisma.user.findMany({
            where: { email: { in: toInsert.map(v => v.email) } },
            select: { id: true, email: true },
          });
          const userIdByEmail = new Map(newUsers.map(u => [u.email, u.id]));

          const guruRows = toInsert
            .map(v => ({
              userId: userIdByEmail.get(v.email),
              nip: v.nip,
              nama: v.nama,
              mataPelajaran: v.mapel,
            }))
            .filter((g): g is { userId: string; nip: string; nama: string; mataPelajaran: string } =>
              typeof g.userId === 'string'
            );
          const result = await prisma.guru.createMany({
            data: guruRows,
            skipDuplicates: true,
          });
          created = result.count;

          // Seed GuruMataPelajaran dari kolom mapel
          const newGurus = await prisma.guru.findMany({
            where: { userId: { in: guruRows.map(g => g.userId) } },
            select: { id: true, mataPelajaran: true },
          });
          if (newGurus.length > 0) {
            await prisma.guruMataPelajaran.createMany({
              data: newGurus.map(g => ({ guruId: g.id, nama: g.mataPelajaran })),
              skipDuplicates: true,
            });
          }
        } catch (err: any) {
          for (const v of toInsert) {
            failed.push({ row: v.rowNumber, message: err.message ?? 'Gagal insert (bulk)' });
          }
        }
      }
    }

    invalidateByPrefix('admin:stats');
    invalidateByPrefix('guru:stats:');
    invalidateByPrefix('guru:kelas:');
    res.json({ created, skipped, failed });
  } catch (error) {
    next(error);
  }
});

router.post('/users/:id/reset-password', validate(ResetPasswordSchema), async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: { guru: true, siswa: true }
    });
    if (!user) return res.status(404).json({ error: 'Pengguna tidak ditemukan' });

    let resetTo = 'password123';
    if (user.role === 'SISWA' && user.siswa) resetTo = user.siswa.nis;
    else if (user.role === 'GURU' && user.guru?.nip) resetTo = user.guru.nip;

    const hashed = await bcrypt.hash(resetTo, 10);
    await prisma.user.update({ where: { id: req.params.id }, data: { password: hashed } });

    res.json({ success: true, resetTo });
  } catch (error) {
    next(error);
  }
});

// Kelas (admin)
router.get('/kelas', async (req, res, next) => {
  try {
    const kelas = await prisma.kelas.findMany({
      include: {
        guru: { select: { id: true, nama: true } },
        guruKelas: { include: { guru: { select: { id: true, nama: true, mataPelajaran: true } } } },
        _count: { select: { siswa: true } }
      },
      orderBy: [{ tingkat: 'asc' }, { nama: 'asc' }]
    });
    res.json(kelas);
  } catch (error) { next(error); }
});

// Set daftar guru pengajar di kelas (sync penuh — replace all)
router.put('/kelas/:id/guru', async (req, res, next) => {
  try {
    const { teacherIds } = req.body as { teacherIds: string[] };
    if (!Array.isArray(teacherIds)) {
      return res.status(400).json({ error: 'teacherIds wajib berupa array' });
    }
    // Sync: hapus semua GuruKelas lama untuk kelas ini, lalu buat yang baru
    await prisma.$transaction(async (tx) => {
      await tx.guruKelas.deleteMany({ where: { kelasId: req.params.id } });
      if (teacherIds.length > 0) {
        await tx.guruKelas.createMany({
          data: teacherIds.map(guruId => ({ guruId, kelasId: req.params.id })),
          skipDuplicates: true,
        });
      }
    });
    invalidateByPrefix('guru:kelas:');
    res.json({ success: true });
  } catch (error) { next(error); }
});

router.post('/kelas', validate(CreateKelasSchema), async (req, res, next) => {
  try {
    const { nama, tingkat, tahunAjaran, guruId } = req.body;
    if (!nama || !tingkat || !tahunAjaran || !guruId) {
      return res.status(400).json({ error: 'Semua field wajib diisi' });
    }
    const kelas = await prisma.kelas.create({ data: { nama: toTitleCase(nama), tingkat, tahunAjaran, guruId } });
    invalidateByPrefix(`guru:kelas:${guruId}`);
    invalidateByPrefix(`guru:stats:${guruId}`);
    res.status(201).json(kelas);
  } catch (error) { next(error); }
});

router.patch('/kelas/:id', validate(UpdateKelasSchema), async (req, res, next) => {
  try {
    const { nama, tingkat, tahunAjaran, guruId } = req.body;
    const kelas = await prisma.kelas.update({
      where: { id: req.params.id },
      data: {
        ...(nama && { nama: toTitleCase(nama) }),
        ...(tingkat && { tingkat }),
        ...(tahunAjaran && { tahunAjaran }),
        ...(guruId && { guruId })
      }
    });
    // Tidak tahu pasti guru lama vs baru — invalidate semua.
    invalidateByPrefix('guru:kelas:');
    invalidateByPrefix('guru:stats:');
    res.json(kelas);
  } catch (error) { next(error); }
});

router.delete('/kelas/:id', async (req, res, next) => {
  try {
    const kelas = await prisma.kelas.findUnique({ where: { id: req.params.id } });
    if (!kelas) return res.status(404).json({ error: 'Kelas tidak ditemukan atau sudah dihapus.' });

    const jumlahSiswa = await prisma.siswa.count({ where: { kelasId: req.params.id } });
    if (jumlahSiswa > 0) {
      return res.status(400).json({ error: `Tidak bisa menghapus kelas yang masih memiliki ${jumlahSiswa} siswa. Pindahkan siswa ke kelas lain terlebih dahulu.` });
    }

    await prisma.$transaction(async (tx) => {
      await tx.guruKelas.deleteMany({ where: { kelasId: req.params.id } });
      await tx.kolomNilaiKelas.deleteMany({ where: { kelasId: req.params.id } });
      await tx.ujianKelas.deleteMany({ where: { kelasId: req.params.id } });
      await tx.kelas.delete({ where: { id: req.params.id } });
    });

    invalidateByPrefix('guru:kelas:');
    invalidateByPrefix('guru:stats:');
    res.json({ success: true });
  } catch (error) { next(error); }
});

// Berita CMS
router.get('/berita', async (req, res, next) => {
  try {
    const { page, limit, skip } = getPaginationParams(req.query);
    const [berita, total] = await prisma.$transaction([
      prisma.berita.findMany({
        skip, take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.berita.count(),
    ]);
    res.json(buildPaginatedResult(berita, total, page, limit));
  } catch(error) {
    next(error);
  }
});

router.post('/berita', async (req, res, next) => {
  try {
    const { judul, ...rest } = req.body;
    const result = await prisma.berita.create({ data: { judul: toTitleCase(judul), ...rest } });
    invalidateByPrefix('pub:berita');
    invalidateByPrefix('admin:stats');
    res.status(201).json(result);
  } catch(error) {
    next(error);
  }
});

router.patch('/berita/:id', async (req, res, next) => {
  try {
    const { judul, ...rest } = req.body;
    const result = await prisma.berita.update({
      where: { id: req.params.id },
      data: { ...(judul && { judul: toTitleCase(judul) }), ...rest }
    });
    invalidateByPrefix('pub:berita');
    res.json(result);
  } catch(error) {
    next(error);
  }
});

router.delete('/berita/:id', async (req, res, next) => {
  try {
    await prisma.berita.delete({ where: { id: req.params.id } });
    invalidateByPrefix('pub:berita');
    invalidateByPrefix('admin:stats');
    res.json({ success: true });
  } catch(error) {
    next(error);
  }
});

// Duplikat berita
router.post('/berita/:id/duplikat', async (req, res, next) => {
  try {
    const original = await prisma.berita.findUnique({
      where: { id: req.params.id }
    });

    if (!original) {
      return res.status(404).json({ error: 'Berita tidak ditemukan' });
    }

    // Copy semua field dengan override
    const { id, slug, createdAt, updatedAt, ...data } = original;
    const duplicated = await prisma.berita.create({
      data: {
        ...data,
        judul: `Salinan — ${original.judul}`,
        slug: `salinan-${original.slug}-${Date.now()}`,
        status: 'DRAFT',
        publishedAt: null
      }
    });

    invalidateByPrefix('pub:berita');
    res.status(201).json(duplicated);
  } catch(error) {
    next(error);
  }
});

// Alumni
router.get('/alumni', async (req, res, next) => {
  try {
    const { page, limit, skip } = getPaginationParams(req.query);
    const [alumni, total] = await prisma.$transaction([
      prisma.alumni.findMany({
        skip, take: limit,
        orderBy: { tahunLulus: 'desc' },
      }),
      prisma.alumni.count(),
    ]);
    res.json(buildPaginatedResult(alumni, total, page, limit));
  } catch(error) {
    next(error);
  }
});

router.post('/alumni', async (req, res, next) => {
  try {
    // Admin-created alumni langsung verified (tidak perlu moderate diri sendiri).
    const result = await prisma.alumni.create({
      data: { ...req.body, isVerified: req.body.isVerified ?? true },
    });
    invalidateByPrefix('pub:alumni');
    invalidateByPrefix('admin:stats');
    res.status(201).json(result);
  } catch(error) {
    next(error);
  }
});

// Batch verify / unverify alumni — dipakai admin di tracer untuk approve
// banyak alumni yang daftar via form publik sekaligus.
router.post('/alumni/verify', async (req, res, next) => {
  try {
    const { ids, isVerified } = req.body as { ids?: string[]; isVerified?: boolean };
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids kosong' });
    }
    const result = await prisma.alumni.updateMany({
      where: { id: { in: ids } },
      data: { isVerified: isVerified !== false },
    });
    invalidateByPrefix('pub:alumni');
    res.json({ success: true, updated: result.count });
  } catch (error) { next(error); }
});

router.patch('/alumni/:id', async (req, res, next) => {
  try {
    const result = await prisma.alumni.update({
      where: { id: req.params.id },
      data: req.body
    });
    invalidateByPrefix('pub:alumni');
    res.json(result);
  } catch(error) {
    next(error);
  }
});

router.delete('/alumni/:id', async (req, res, next) => {
  try {
    await prisma.alumni.delete({ where: { id: req.params.id } });
    invalidateByPrefix('pub:alumni');
    invalidateByPrefix('admin:stats');
    res.json({ success: true });
  } catch(error) {
    next(error);
  }
});

// ── Ujian (admin view-all + delete) ─────────────────────
// Admin punya hak baca semua ujian dari seluruh guru + bisa hapus
// untuk kepentingan housekeeping. Edit konten ujian/soal tetap di
// tangan guru pemilik via /api/guru/ujian/*.
router.get('/ujian', async (req, res, next) => {
  try {
    const { page, limit, skip } = getPaginationParams(req.query);
    const [ujianList, total] = await prisma.$transaction([
      prisma.ujian.findMany({
        skip, take: limit,
        include: {
          guru: { select: { id: true, nama: true, nip: true, mataPelajaran: true } },
          kelas: { include: { kelas: { select: { id: true, nama: true, tingkat: true } } } },
          _count: { select: { soal: true, sesiUjian: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.ujian.count(),
    ]);
    res.json(buildPaginatedResult(ujianList, total, page, limit));
  } catch (error) { next(error); }
});

router.get('/ujian/:id', async (req, res, next) => {
  try {
    const ujian = await prisma.ujian.findUnique({
      where: { id: req.params.id },
      include: {
        guru: { select: { id: true, nama: true, nip: true, mataPelajaran: true } },
        kelas: { include: { kelas: true } },
        soal: { include: { opsi: true }, orderBy: { nomor: 'asc' } },
        _count: { select: { sesiUjian: true } },
      },
    });
    if (!ujian) return res.status(404).json({ error: 'Ujian tidak ditemukan' });
    res.json(ujian);
  } catch (error) { next(error); }
});

router.delete('/ujian/:id', async (req, res, next) => {
  try {
    const ujian = await prisma.ujian.findUnique({ where: { id: req.params.id } });
    if (!ujian) return res.status(404).json({ error: 'Ujian tidak ditemukan' });
    // Admin bisa force-delete — SesiUjian → Jawaban/Pelanggaran cascade via DB FK.
    await prisma.ujian.delete({ where: { id: req.params.id } });
    invalidateByPrefix('admin:stats');
    res.json({ success: true });
  } catch (error) { next(error); }
});

// ── Import alumni: template Excel ──────────────────────
router.get('/alumni/import-template', async (req, res, next) => {
  try {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Template Alumni');

    ws.columns = [
      { header: 'Nama',         key: 'nama',       width: 28 },
      { header: 'NIS',          key: 'nis',        width: 14 },
      { header: 'Tahun Lulus',  key: 'tahunLulus', width: 14 },
      { header: 'Jurusan',      key: 'jurusan',    width: 18 },
      { header: 'Status',       key: 'status',     width: 16 },
      { header: 'Instansi',     key: 'instansi',   width: 24 },
      { header: 'Posisi',       key: 'posisi',     width: 22 },
      { header: 'Kontak',       key: 'kontak',     width: 24 },
    ];
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).eachCell(c => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
      c.alignment = { horizontal: 'center' };
    });

    ws.addRow({
      nama: 'Contoh Nama Alumni', nis: '2021001', tahunLulus: 2024,
      jurusan: 'IPA', status: 'KULIAH', instansi: 'Universitas Indonesia',
      posisi: 'Mahasiswa Teknik', kontak: '08123456789',
    });

    const noteRow = ws.addRow([]);
    noteRow.getCell(1).value = 'Status valid: BEKERJA, KULIAH, WIRAUSAHA, TIDAK_DIKETAHUI. Wajib: Nama, Tahun Lulus, Status.';
    noteRow.getCell(1).font = { italic: true, color: { argb: 'FF6B7280' } };
    ws.mergeCells(`A${noteRow.number}:H${noteRow.number}`);

    const buf = await wb.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="template-import-alumni.xlsx"');
    res.send(Buffer.from(buf));
  } catch (error) { next(error); }
});

// ── Import alumni: bulk insert ─────────────────────────
router.post('/alumni/import', async (req, res, next) => {
  try {
    const { items } = req.body as { items?: any[] };
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items kosong' });
    }
    if (items.length > 500) {
      return res.status(400).json({ error: 'Maksimal 500 baris per import' });
    }

    const VALID_STATUS = new Set(['BEKERJA', 'KULIAH', 'WIRAUSAHA', 'TIDAK_DIKETAHUI']);

    let created = 0;
    let skipped = 0;
    const failed: { row: number; message: string }[] = [];

    // ── Pass 1: validasi in-memory ──
    type AlumniRow = {
      rowNumber: number;
      nama: string;
      nis: string | null;
      tahunLulus: number;
      jurusan: string | null;
      status: string;
      instansi: string | null;
      posisi: string | null;
      kontak: string | null;
    };
    const valid: AlumniRow[] = [];

    for (let i = 0; i < items.length; i++) {
      const row = items[i];
      const rowNumber = i + 2;
      const nama = String(row.nama ?? '').trim();
      const nis = String(row.nis ?? '').trim() || null;
      const tahunLulusRaw = row.tahunLulus;
      const tahunLulus = Number(tahunLulusRaw);
      const jurusan = String(row.jurusan ?? '').trim() || null;
      const status = String(row.status ?? '').trim().toUpperCase();
      const instansi = String(row.instansi ?? '').trim() || null;
      const posisi = String(row.posisi ?? '').trim() || null;
      const kontak = String(row.kontak ?? '').trim() || null;

      if (!nama || !tahunLulusRaw || !status) {
        failed.push({ row: rowNumber, message: 'Nama, Tahun Lulus, dan Status wajib diisi' });
        continue;
      }
      if (!Number.isFinite(tahunLulus) || tahunLulus < 1900 || tahunLulus > 2100) {
        failed.push({ row: rowNumber, message: `Tahun Lulus "${tahunLulusRaw}" tidak valid` });
        continue;
      }
      if (!VALID_STATUS.has(status)) {
        failed.push({ row: rowNumber, message: `Status "${status}" tidak valid (BEKERJA/KULIAH/WIRAUSAHA/TIDAK_DIKETAHUI)` });
        continue;
      }
      valid.push({ rowNumber, nama, nis, tahunLulus, jurusan, status, instansi, posisi, kontak });
    }

    // ── Pass 2: filter duplikat NIS (1 query, bukan N findFirst) ──
    const nisList = valid.map(v => v.nis).filter((n): n is string => !!n);
    const existingAlumni = nisList.length === 0
      ? []
      : await prisma.alumni.findMany({
          where: { nis: { in: nisList } },
          select: { nis: true },
        });
    const existingNisSet = new Set(existingAlumni.map(a => a.nis).filter((n): n is string => !!n));
    const toInsert = valid.filter(v => !v.nis || !existingNisSet.has(v.nis));
    skipped = valid.length - toInsert.length;

    // ── Pass 3: createMany (1 query) ──
    if (toInsert.length > 0) {
      try {
        const result = await prisma.alumni.createMany({
          data: toInsert.map(({ rowNumber, ...rest }) => rest),
          skipDuplicates: true,
        });
        created = result.count;
      } catch (err: any) {
        for (const v of toInsert) {
          failed.push({ row: v.rowNumber, message: err.message ?? 'Gagal insert (bulk)' });
        }
      }
    }

    if (created > 0) {
      invalidateByPrefix('pub:alumni');
      invalidateByPrefix('admin:stats');
    }
    res.json({ created, skipped, failed });
  } catch (error) { next(error); }
});

router.get('/alumni/export', async (req, res, next) => {
  try {
    const alumni = await prisma.alumni.findMany({ orderBy: [{ tahunLulus: 'desc' }, { nama: 'asc' }] });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Data Alumni');

    ws.columns = [
      { width: 5 }, { width: 28 }, { width: 14 }, { width: 10 },
      { width: 20 }, { width: 16 }, { width: 24 }, { width: 22 }, { width: 24 }
    ];

    ws.mergeCells('A1:I1');
    const titleCell = ws.getCell('A1');
    titleCell.value = 'DATA ALUMNI';
    titleCell.font = { bold: true, size: 14 };
    titleCell.alignment = { horizontal: 'center' };

    ws.addRow([]);

    const hRow = ws.addRow(['No', 'Nama', 'NIS', 'Thn Lulus', 'Jurusan', 'Status', 'Instansi', 'Posisi', 'Kontak']);
    hRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    hRow.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
      cell.alignment = { horizontal: 'center' };
    });

    const statusLabel: Record<string, string> = {
      BEKERJA: 'Bekerja', KULIAH: 'Kuliah',
      WIRAUSAHA: 'Wirausaha', TIDAK_DIKETAHUI: 'Tidak Diketahui'
    };

    alumni.forEach((al, idx) => {
      ws.addRow([
        idx + 1, al.nama, al.nis ?? '-', al.tahunLulus,
        al.jurusan ?? '-', statusLabel[al.status] ?? al.status,
        al.instansi ?? '-', al.posisi ?? '-', al.kontak ?? '-'
      ]);
    });

    const buf = await wb.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="data-alumni.xlsx"');
    res.send(Buffer.from(buf));
  } catch(error) {
    next(error);
  }
});

// ── SiteConfig (admin update) ──────────────────────────
// Whitelist field — biar request body tidak bisa nyelundupin field
// yang tidak diinginkan (misal id, updatedAt).
const SITE_CONFIG_FIELDS = [
  'namaSekolah', 'jenjang', 'tagline', 'deskripsi',
  'logoUrl', 'faviconUrl', 'heroImageUrl',
  'heroBadge', 'heroTitle', 'heroSubtitle',
  'profilImageUrl', 'sejarah',
  'visi', 'misi', 'tujuan',
  'statSiswaValue', 'statSiswaLabel',
  'statGuruValue', 'statGuruLabel',
  'statTahunValue', 'statTahunLabel',
  'statAlumniLabel',
  'kepsekNama', 'kepsekJabatan', 'kepsekFotoUrl', 'kepsekSambutan',
  'fiturUnggulan',
  'alamat', 'telepon', 'email', 'whatsapp', 'mapsEmbedUrl',
  'facebook', 'instagram', 'twitter', 'youtube', 'tiktok',
] as const;

// Decode base64 dari frontend (workaround WAF LiteSpeed yang block
// payload mengandung Google Maps embed URL atau JSON panjang).
// Frontend prefix value dengan "__b64:" — kita unwrap di sini.
function decodeB64(v: any): any {
  if (typeof v !== 'string' || !v.startsWith('__b64:')) return v;
  try {
    return Buffer.from(v.slice(6), 'base64').toString('utf8');
  } catch {
    return v; // fallback ke raw kalau decode gagal
  }
}

router.patch('/site-config', async (req, res, next) => {
  try {
    // Unwrap full-payload base64 envelope kalau frontend kirim _payload_b64.
    // Workaround Hostinger anti-bot interstitial yg trigger saat body
    // mengandung base64 image besar + Google Maps URL + JSON panjang
    // bareng. Detector cuma lihat 1 string opaque, bukan banyak field.
    let body: Record<string, any> = req.body || {};
    if (typeof body._payload_b64 === 'string') {
      try {
        const decoded = Buffer.from(body._payload_b64, 'base64').toString('utf8');
        body = JSON.parse(decoded);
      } catch (err: any) {
        return res.status(400).json({ error: 'Payload terenkripsi tidak valid' });
      }
    }

    const data: Record<string, any> = {};
    for (const key of SITE_CONFIG_FIELDS) {
      if (body[key] !== undefined) data[key] = decodeB64(body[key]);
    }

    let config = await prisma.siteConfig.findFirst();
    if (!config) {
      config = await prisma.siteConfig.create({ data });
    } else {
      config = await prisma.siteConfig.update({
        where: { id: config.id },
        data,
      });
    }
    invalidateByPrefix('pub:site-config');
    res.json(config);
  } catch (error) { next(error); }
});

// ── Activity Log ─────────────────────────────────────────────────────────────
// Menggabungkan aktivitas guru (buat ujian, input presensi) dan
// siswa (selesaikan ujian) dari beberapa tabel, diurutkan terbaru.
router.get('/activity', async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 30, 100);

    const [sesiSelesai, ujianBaru, presensiGuru] = await Promise.all([
      // Siswa menyelesaikan ujian
      prisma.sesiUjian.findMany({
        where: { status: { in: ['SELESAI', 'AUTO_SUBMIT'] }, selesaiAt: { not: null } },
        orderBy: { selesaiAt: 'desc' },
        take: limit,
        select: {
          id: true,
          selesaiAt: true,
          status: true,
          nilaiAkhir: true,
          siswa: { select: { nama: true, nis: true } },
          ujian: { select: { judul: true, mataPelajaran: true } },
        },
      }),
      // Guru membuat ujian
      prisma.ujian.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          judul: true,
          mataPelajaran: true,
          createdAt: true,
          guru: { select: { nama: true } },
        },
      }),
      // Guru clock-in presensi
      prisma.presensiGuru.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          tanggal: true,
          waktuDatang: true,
          waktuPulang: true,
          createdAt: true,
          guru: { select: { nama: true } },
        },
      }),
    ]);

    type ActivityItem = {
      id: string;
      type: 'ujian_selesai' | 'ujian_baru' | 'presensi_guru';
      timestamp: string;
      actor: string;
      actorRole: 'siswa' | 'guru';
      description: string;
      meta?: string;
    };

    const items: ActivityItem[] = [
      ...sesiSelesai.map(s => ({
        id: `sesi-${s.id}`,
        type: 'ujian_selesai' as const,
        timestamp: s.selesaiAt!.toISOString(),
        actor: s.siswa?.nama ?? '—',
        actorRole: 'siswa' as const,
        description: `Menyelesaikan ujian "${s.ujian?.judul ?? '—'}"`,
        meta: s.nilaiAkhir !== null ? `Nilai: ${Math.round(s.nilaiAkhir * 100) / 100}` : (s.status === 'AUTO_SUBMIT' ? 'Auto-submit' : undefined),
      })),
      ...ujianBaru.map(u => ({
        id: `ujian-${u.id}`,
        type: 'ujian_baru' as const,
        timestamp: u.createdAt.toISOString(),
        actor: u.guru?.nama ?? '—',
        actorRole: 'guru' as const,
        description: `Membuat ujian baru: "${u.judul}"`,
        meta: u.mataPelajaran ?? undefined,
      })),
      ...presensiGuru.map(p => ({
        id: `presensi-${p.id}`,
        type: 'presensi_guru' as const,
        timestamp: p.createdAt.toISOString(),
        actor: p.guru?.nama ?? '—',
        actorRole: 'guru' as const,
        description: `Clock-in presensi`,
        meta: p.waktuDatang ? fmtWIB(new Date(p.waktuDatang)) : '—',
      })),
    ];

    // Sort gabungan descending, ambil limit teratas
    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    res.json(items.slice(0, limit));
  } catch (error) { next(error); }
});

// ─────────────────────────────────────────────────────────────────────────────
// Export Presensi Guru to Excel
// ─────────────────────────────────────────────────────────────────────────────

router.get('/presensi/guru/export', async (req, res, next) => {
  try {
    const bulan = Number(req.query.bulan);
    const tahun = Number(req.query.tahun);

    if (!bulan || !tahun) {
      return res.status(400).json({ error: 'Parameter bulan dan tahun wajib diisi' });
    }

    const start = new Date(tahun, bulan - 1, 1);
    const end = new Date(tahun, bulan, 1);

    const data = await prisma.presensiGuru.findMany({
      where: { tanggal: { gte: start, lt: end } },
      include: { guru: { select: { nama: true, nip: true } } },
      orderBy: [{ tanggal: 'asc' }, { waktuDatang: 'asc' }],
    });

    // Get jam masuk default dan timezone
    const cfg = await prisma.pengaturanPresensi.findFirst();
    const jamMasukDefault = cfg?.jamMasukDefault || '07:00';
    const tz = cfg?.timezone || 'Asia/Jakarta';

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Presensi Guru');

    // Header
    ws.columns = [
      { header: 'No', key: 'no', width: 5 },
      { header: 'Tanggal', key: 'tanggal', width: 12 },
      { header: 'Nama Guru', key: 'nama', width: 30 },
      { header: 'NIP', key: 'nip', width: 20 },
      { header: 'Jam Datang', key: 'jamDatang', width: 12 },
      { header: 'Jam Pulang', key: 'jamPulang', width: 12 },
      { header: 'Keterlambatan (menit)', key: 'keterlambatan', width: 20 },
      { header: 'Total Jam (menit)', key: 'totalJam', width: 20 },
      { header: 'Status', key: 'status', width: 15 },
    ];

    // Style header
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE3F2FD' } };

    // Data
    data.forEach((p, idx) => {
      let keterlambatan = 0;
      let totalJam = 0;

      if (p.waktuDatang) {
        const targetMasuk = buildTargetWIB(p.waktuDatang, jamMasukDefault, tz);
        if (p.waktuDatang > targetMasuk) {
          keterlambatan = Math.floor((p.waktuDatang.getTime() - targetMasuk.getTime()) / 60_000);
        }
        if (p.waktuPulang) {
          totalJam = Math.floor((p.waktuPulang.getTime() - p.waktuDatang.getTime()) / 60_000);
        }
      }

      ws.addRow({
        no: idx + 1,
        tanggal: fmtDateWIB(p.tanggal, tz),
        nama: p.guru.nama,
        nip: p.guru.nip,
        jamDatang: p.waktuDatang ? fmtWIB(p.waktuDatang, tz) : '—',
        jamPulang: p.waktuPulang ? fmtWIB(p.waktuPulang, tz) : '—',
        keterlambatan: keterlambatan || 0,
        totalJam: totalJam || 0,
        status: p.autoCheckout ? 'Auto Checkout' : (p.waktuPulang ? 'Manual' : 'Belum Pulang'),
      });
    });

    const buf = await wb.xlsx.writeBuffer();
    const filename = `Presensi-Guru-${bulan}-${tahun}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from(buf));
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Export Presensi Siswa to Excel
// ─────────────────────────────────────────────────────────────────────────────

router.get('/presensi/siswa/export', async (req, res, next) => {
  try {
    const bulan = Number(req.query.bulan);
    const tahun = Number(req.query.tahun);

    if (!bulan || !tahun) {
      return res.status(400).json({ error: 'Parameter bulan dan tahun wajib diisi' });
    }

    const start = new Date(tahun, bulan - 1, 1);
    const end = new Date(tahun, bulan, 1);

    const data = await prisma.presensiSiswa.findMany({
      where: { tanggal: { gte: start, lt: end } },
      include: {
        siswa: {
          select: {
            nama: true,
            nis: true,
            kelas: { select: { nama: true } },
          },
        },
      },
      orderBy: [{ tanggal: 'asc' }, { waktuDatang: 'asc' }],
    });

    // Get jam masuk default dan timezone
    const cfg = await prisma.pengaturanPresensi.findFirst();
    const jamMasukDefault = cfg?.jamMasukDefault || '07:00';
    const tz = cfg?.timezone || 'Asia/Jakarta';

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Presensi Siswa');

    // Header
    ws.columns = [
      { header: 'No', key: 'no', width: 5 },
      { header: 'Tanggal', key: 'tanggal', width: 12 },
      { header: 'NIS', key: 'nis', width: 15 },
      { header: 'Nama Siswa', key: 'nama', width: 30 },
      { header: 'Kelas', key: 'kelas', width: 15 },
      { header: 'Jam Datang', key: 'jamDatang', width: 12 },
      { header: 'Status', key: 'status', width: 15 },
    ];

    // Style header
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3E5F5' } };

    // Data
    data.forEach((p, idx) => {
      const targetMasuk = buildTargetWIB(p.waktuDatang, jamMasukDefault, tz);
      const tepatWaktu = p.waktuDatang <= targetMasuk;

      ws.addRow({
        no: idx + 1,
        tanggal: fmtDateWIB(p.tanggal, tz),
        nis: p.siswa.nis,
        nama: p.siswa.nama,
        kelas: p.siswa.kelas?.nama || '—',
        jamDatang: fmtWIB(p.waktuDatang, tz),
        status: tepatWaktu ? 'Tepat Waktu' : 'Terlambat',
      });
    });

    const buf = await wb.xlsx.writeBuffer();
    const filename = `Presensi-Siswa-${bulan}-${tahun}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from(buf));
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// MANAGE GURU KELAS
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/admin/guru/:guruId/kelas - Tambah kelas ke guru
router.post('/guru/:guruId/kelas', async (req, res, next) => {
  try {
    const { guruId } = req.params;
    const { kelasId } = req.body;

    if (!kelasId) {
      return res.status(400).json({ error: 'kelasId wajib diisi' });
    }

    // Check if already exists
    const existing = await prisma.guruKelas.findUnique({
      where: { guruId_kelasId: { guruId, kelasId } }
    });

    if (existing) {
      return res.status(409).json({ error: 'Guru sudah mengajar di kelas ini' });
    }

    // Create relation
    await prisma.guruKelas.create({
      data: { guruId, kelasId }
    });

    invalidateByPrefix('admin:');
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/guru/:guruId/kelas/:kelasId - Hapus kelas dari guru
router.delete('/guru/:guruId/kelas/:kelasId', async (req, res, next) => {
  try {
    const { guruId, kelasId } = req.params;

    await prisma.guruKelas.delete({
      where: { guruId_kelasId: { guruId, kelasId } }
    });

    invalidateByPrefix('admin:');
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// REQ-007: Manajemen Absensi Siswa (Admin)
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/admin/absensi — list absensi dengan filter
router.get('/absensi', async (req, res, next) => {
  try {
    const { dari, sampai, kelasId, page: pageStr, limit: limitStr } = req.query as Record<string, string>;
    const page  = Math.max(1, Number(pageStr)  || 1);
    const limit = Math.min(100, Number(limitStr) || 50);

    const tanggalWhere: any = {};
    if (dari) {
      tanggalWhere.gte = wibMidnight(dari);
    }
    if (sampai) {
      const end = wibMidnight(sampai);
      end.setTime(end.getTime() + 24 * 60 * 60 * 1000);
      tanggalWhere.lt = end;
    }

    const where: any = {
      ...(Object.keys(tanggalWhere).length ? { tanggal: tanggalWhere } : {}),
      ...(kelasId ? { siswa: { kelasId } } : {}),
    };

    const [data, total] = await Promise.all([
      prisma.absensiSiswa.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ tanggal: 'desc' }, { siswa: { nama: 'asc' } }],
        include: {
          siswa: { select: { nama: true, nis: true, kelas: { select: { nama: true } } } },
          guru:  { select: { nama: true } },
        },
      }),
      prisma.absensiSiswa.count({ where }),
    ]);

    res.json({
      data: data.map(a => ({
        id: a.id,
        tanggal: a.tanggal.toISOString().slice(0, 10),
        status: a.status,
        keterangan: a.keterangan,
        siswa: { nama: a.siswa.nama, nis: a.siswa.nis, kelas: a.siswa.kelas.nama },
        guru: a.guru ? { nama: a.guru.nama } : null,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/absensi/:id — edit satu record
router.put('/absensi/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, keterangan } = req.body as { status?: string; keterangan?: string };

    const validStatuses = ['SAKIT', 'IZIN', 'ALFA'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Status harus SAKIT, IZIN, atau ALFA' });
    }

    const updated = await prisma.absensiSiswa.update({
      where: { id },
      data: {
        ...(status ? { status } : {}),
        ...(keterangan !== undefined ? { keterangan: keterangan || null } : {}),
      },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/absensi/:id — hapus satu record
router.delete('/absensi/:id', async (req, res, next) => {
  try {
    await prisma.absensiSiswa.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/absensi/export — Export Excel
router.get('/absensi/export', async (req, res, next) => {
  try {
    const { dari, sampai, kelasId } = req.query as Record<string, string>;

    const tanggalWhere: any = {};
    if (dari)   { tanggalWhere.gte = wibMidnight(dari); }
    if (sampai) { const e = wibMidnight(sampai); e.setTime(e.getTime() + 86_400_000); tanggalWhere.lt = e; }

    // Ambil data hadir dan absensi
    const siswaWhere: any = kelasId ? { kelasId } : {};
    const siswas = await prisma.siswa.findMany({
      where: siswaWhere,
      select: { id: true, nama: true, nis: true, kelas: { select: { nama: true } } },
      orderBy: { nama: 'asc' },
    });

    const siswaIds = siswas.map(s => s.id);
    const tFilter = Object.keys(tanggalWhere).length ? { tanggal: tanggalWhere } : {};

    const [presensiList, absensiList] = await Promise.all([
      prisma.presensiSiswa.findMany({ where: { siswaId: { in: siswaIds }, ...tFilter }, select: { siswaId: true } }),
      prisma.absensiSiswa.findMany({  where: { siswaId: { in: siswaIds }, ...tFilter }, select: { siswaId: true, status: true } }),
    ]);

    const hadirMap: Record<string, number> = {};
    for (const p of presensiList) hadirMap[p.siswaId] = (hadirMap[p.siswaId] || 0) + 1;

    const absenMap: Record<string, { sakit: number; izin: number; alfa: number }> = {};
    for (const a of absensiList) {
      if (!absenMap[a.siswaId]) absenMap[a.siswaId] = { sakit: 0, izin: 0, alfa: 0 };
      if (a.status === 'SAKIT') absenMap[a.siswaId].sakit++;
      else if (a.status === 'IZIN') absenMap[a.siswaId].izin++;
      else if (a.status === 'ALFA') absenMap[a.siswaId].alfa++;
    }

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Rekap Kehadiran');

    ws.columns = [
      { header: 'No',          key: 'no',     width: 5  },
      { header: 'Nama Siswa',  key: 'nama',   width: 30 },
      { header: 'NIS',         key: 'nis',    width: 15 },
      { header: 'Kelas',       key: 'kelas',  width: 15 },
      { header: 'Hadir',       key: 'hadir',  width: 8  },
      { header: 'Sakit',       key: 'sakit',  width: 8  },
      { header: 'Izin',        key: 'izin',   width: 8  },
      { header: 'Alfa',        key: 'alfa',   width: 8  },
      { header: 'Total Hari',  key: 'total',  width: 12 },
      { header: '% Kehadiran', key: 'persen', width: 14 },
    ];

    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE3F2FD' } };

    siswas.forEach((s, idx) => {
      const hadir = hadirMap[s.id] || 0;
      const { sakit = 0, izin = 0, alfa = 0 } = absenMap[s.id] || {};
      const total = hadir + sakit + izin + alfa;
      const persen = total > 0 ? `${Math.round((hadir / total) * 1000) / 10}%` : '—';
      ws.addRow({ no: idx + 1, nama: s.nama, nis: s.nis, kelas: s.kelas.nama, hadir, sakit, izin, alfa, total, persen });
    });

    const periode = dari && sampai ? `${dari}_sd_${sampai}` : 'semua';
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="rekap-kehadiran-${periode}.xlsx"`);
    await wb.xlsx.write(res);
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// REQ-008: Potensi — CRUD Jenis & Rekap Laporan
// ─────────────────────────────────────────────────────────────────────────────

// ── Jenis Kebaikan ───────────────────────────────────────────────────────────

router.get('/jenis-kebaikan', async (_req, res, next) => {
  try {
    const data = await prisma.jenisKebaikan.findMany({
      orderBy: { nama: 'asc' },
      include: { _count: { select: { laporan: true } } },
    });
    res.json(data);
  } catch (err) { next(err); }
});

router.post('/jenis-kebaikan', async (req, res, next) => {
  try {
    const { nama, poin } = req.body as { nama: string; poin: number };
    if (!nama?.trim() || !poin || poin < 1) return res.status(400).json({ error: 'nama dan poin (min 1) wajib diisi' });
    const data = await prisma.jenisKebaikan.create({ data: { nama: nama.trim(), poin: Number(poin) } });
    invalidateByPrefix('pub:jenis-kebaikan');
    res.json(data);
  } catch (err) { next(err); }
});

router.put('/jenis-kebaikan/:id', async (req, res, next) => {
  try {
    const { nama, poin, isActive } = req.body as { nama?: string; poin?: number; isActive?: boolean };
    const data = await prisma.jenisKebaikan.update({
      where: { id: req.params.id },
      data: {
        ...(nama !== undefined ? { nama: nama.trim() } : {}),
        ...(poin !== undefined ? { poin: Number(poin) } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
    });
    invalidateByPrefix('pub:jenis-kebaikan');
    res.json(data);
  } catch (err) { next(err); }
});

router.delete('/jenis-kebaikan/:id', async (req, res, next) => {
  try {
    await prisma.jenisKebaikan.update({ where: { id: req.params.id }, data: { isActive: false } });
    invalidateByPrefix('pub:jenis-kebaikan');
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── Jenis Pelanggaran ─────────────────────────────────────────────────────────

router.get('/jenis-pelanggaran', async (_req, res, next) => {
  try {
    const data = await prisma.jenisPelanggaran.findMany({
      orderBy: { nama: 'asc' },
      include: { _count: { select: { laporan: true } } },
    });
    res.json(data);
  } catch (err) { next(err); }
});

router.post('/jenis-pelanggaran', async (req, res, next) => {
  try {
    const { nama, poin } = req.body as { nama: string; poin: number };
    if (!nama?.trim() || !poin || poin < 1) return res.status(400).json({ error: 'nama dan poin (min 1) wajib diisi' });
    const data = await prisma.jenisPelanggaran.create({ data: { nama: nama.trim(), poin: Number(poin) } });
    invalidateByPrefix('pub:jenis-pelanggaran');
    res.json(data);
  } catch (err) { next(err); }
});

router.put('/jenis-pelanggaran/:id', async (req, res, next) => {
  try {
    const { nama, poin, isActive } = req.body as { nama?: string; poin?: number; isActive?: boolean };
    const data = await prisma.jenisPelanggaran.update({
      where: { id: req.params.id },
      data: {
        ...(nama !== undefined ? { nama: nama.trim() } : {}),
        ...(poin !== undefined ? { poin: Number(poin) } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
    });
    invalidateByPrefix('pub:jenis-pelanggaran');
    res.json(data);
  } catch (err) { next(err); }
});

router.delete('/jenis-pelanggaran/:id', async (req, res, next) => {
  try {
    await prisma.jenisPelanggaran.update({ where: { id: req.params.id }, data: { isActive: false } });
    invalidateByPrefix('pub:jenis-pelanggaran');
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── Rekap Laporan ─────────────────────────────────────────────────────────────

router.get('/potensi/rekap', async (req, res, next) => {
  try {
    const { dari, sampai, tipe, kelasId, siswaId, search, page: pg, limit: lm } = req.query as Record<string, string>;
    const page  = Math.max(1, Number(pg) || 1);
    const limit = Math.min(100, Number(lm) || 50);

    const tglFilter: any = {};
    if (dari)   { tglFilter.gte = wibMidnight(dari); }
    if (sampai) { const e = wibMidnight(sampai); e.setTime(e.getTime() + 86_400_000); tglFilter.lt = e; }

    const where: any = {
      ...(Object.keys(tglFilter).length ? { tanggal: tglFilter } : {}),
      ...(tipe && tipe !== 'semua' ? { tipe: tipe.toUpperCase() } : {}),
      ...(siswaId ? { siswaId } : {}),
      ...(kelasId ? { siswa: { kelasId } } : {}),
      ...(search ? { siswa: { OR: [
        { nama: { contains: search } },
        { nis:  { contains: search } },
      ] } } : {}),
    };

    const [data, total] = await Promise.all([
      prisma.laporanPotensi.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { tanggal: 'desc' },
        include: {
          siswa: { select: { nama: true, nis: true, kelas: { select: { nama: true } } } },
          jenisKebaikan:    { select: { nama: true } },
          jenisPelanggaran: { select: { nama: true } },
        },
      }),
      prisma.laporanPotensi.count({ where }),
    ]);

    res.json({
      data: data.map(l => ({
        id: l.id,
        tanggal: l.tanggal.toISOString().slice(0, 10),
        tipe: l.tipe,
        poin: l.poin,
        namaPelapor: l.namaPelapor,
        keterangan: l.keterangan,
        buktiUrl: l.buktiUrl,
        jenisKebaikanId: l.jenisKebaikanId,
        jenisPelanggaranId: l.jenisPelanggaranId,
        jenis: l.jenisKebaikan?.nama || l.jenisPelanggaran?.nama || '—',
        siswa: { id: l.siswaId, nama: l.siswa.nama, nis: l.siswa.nis, kelas: l.siswa.kelas?.nama ?? '—' },
      })),
      total, page, totalPages: Math.ceil(total / limit),
    });
  } catch (err) { next(err); }
});

// GET /api/admin/potensi/siswa-list — list flat siswa untuk dropdown tambah laporan
router.get('/potensi/siswa-list', async (_req, res, next) => {
  try {
    const list = await prisma.siswa.findMany({
      select: { id: true, nama: true, nis: true, kelas: { select: { nama: true } } },
      orderBy: { nama: 'asc' },
    });
    res.json(list.map(s => ({ id: s.id, nama: s.nama, nis: s.nis, kelas: s.kelas?.nama ?? '—' })));
  } catch (err) { next(err); }
});

// POST /api/admin/potensi/laporan — admin tambah laporan manual
router.post('/potensi/laporan', async (req, res, next) => {
  try {
    const { siswaId, tipe, jenisId, poin, keterangan, namaPelapor, tanggal } = req.body;
    if (!siswaId || !tipe || !poin) return res.status(400).json({ error: 'siswaId, tipe, dan poin wajib diisi' });

    const data: any = {
      siswaId,
      tipe: String(tipe).toUpperCase(),
      poin: Number(poin),
      namaPelapor: String(namaPelapor || 'Admin').trim(),
      tanggal: tanggal ? new Date(tanggal) : new Date(),
      ...(keterangan ? { keterangan: String(keterangan).trim() } : {}),
    };
    if (tipe === 'KEBAIKAN' && jenisId)    data.jenisKebaikanId    = jenisId;
    if (tipe === 'PELANGGARAN' && jenisId) data.jenisPelanggaranId = jenisId;

    const result = await prisma.laporanPotensi.create({ data });
    res.json(result);
  } catch (err) { next(err); }
});

// PUT /api/admin/potensi/laporan/:id — admin edit laporan
router.put('/potensi/laporan/:id', async (req, res, next) => {
  try {
    const { tipe, jenisId, poin, keterangan, namaPelapor, tanggal } = req.body;
    const data: any = {
      ...(tipe        ? { tipe: String(tipe).toUpperCase() } : {}),
      ...(poin        ? { poin: Number(poin) } : {}),
      ...(namaPelapor ? { namaPelapor: String(namaPelapor).trim() } : {}),
      ...(tanggal     ? { tanggal: new Date(tanggal) } : {}),
      ...(keterangan !== undefined ? { keterangan: keterangan ? String(keterangan).trim() : null } : {}),
    };
    // Reset jenis lama, set yang baru
    if (tipe === 'KEBAIKAN') {
      data.jenisKebaikanId    = jenisId || null;
      data.jenisPelanggaranId = null;
    } else if (tipe === 'PELANGGARAN') {
      data.jenisPelanggaranId = jenisId || null;
      data.jenisKebaikanId    = null;
    }
    const result = await prisma.laporanPotensi.update({ where: { id: req.params.id }, data });
    res.json(result);
  } catch (err) { next(err); }
});

router.delete('/potensi/laporan/:id', async (req, res, next) => {
  try {
    await prisma.laporanPotensi.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// Export rekap laporan → Excel
router.get('/potensi/export-excel', async (req, res, next) => {
  try {
    const { dari, sampai, tipe, kelasId } = req.query as Record<string, string>;
    const tglFilter: any = {};
    if (dari)   { tglFilter.gte = wibMidnight(dari); }
    if (sampai) { const e = wibMidnight(sampai); e.setTime(e.getTime() + 86_400_000); tglFilter.lt = e; }

    const where: any = {
      ...(Object.keys(tglFilter).length ? { tanggal: tglFilter } : {}),
      ...(tipe && tipe !== 'semua' ? { tipe: tipe.toUpperCase() } : {}),
      ...(kelasId ? { siswa: { kelasId } } : {}),
    };

    const data = await prisma.laporanPotensi.findMany({
      where, orderBy: { tanggal: 'desc' },
      include: {
        siswa: { select: { nama: true, nis: true, kelas: { select: { nama: true } } } },
        jenisKebaikan:    { select: { nama: true } },
        jenisPelanggaran: { select: { nama: true } },
      },
    });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Rekap Potensi');
    ws.columns = [
      { header: 'No',         key: 'no',        width: 5 },
      { header: 'Tanggal',    key: 'tgl',       width: 13 },
      { header: 'Nama Siswa', key: 'nama',      width: 28 },
      { header: 'NIS',        key: 'nis',       width: 14 },
      { header: 'Kelas',      key: 'kelas',     width: 12 },
      { header: 'Tipe',       key: 'tipe',      width: 14 },
      { header: 'Jenis',      key: 'jenis',     width: 30 },
      { header: 'Poin',       key: 'poin',      width: 7 },
      { header: 'Pelapor',    key: 'pelapor',   width: 22 },
      { header: 'Keterangan', key: 'ket',       width: 35 },
    ];
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE3F2FD' } };
    data.forEach((l, i) => ws.addRow({
      no: i+1, tgl: l.tanggal.toISOString().slice(0,10),
      nama: l.siswa.nama, nis: l.siswa.nis, kelas: l.siswa.kelas.nama,
      tipe: l.tipe, jenis: l.jenisKebaikan?.nama || l.jenisPelanggaran?.nama || '',
      poin: l.poin, pelapor: l.namaPelapor, ket: l.keterangan || '',
    }));

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="rekap-potensi.xlsx"');
    await wb.xlsx.write(res);
  } catch (err) { next(err); }
});

// Export DOCX per siswa
router.post('/potensi/export-docx', async (req, res, next) => {
  try {
    const { siswaId, dari, sampai } = req.body as { siswaId: string; dari?: string; sampai?: string };
    if (!siswaId) return res.status(400).json({ error: 'siswaId wajib diisi' });

    const siswa = await prisma.siswa.findUnique({
      where: { id: siswaId },
      select: { nama: true, nis: true, kelas: { select: { nama: true } } },
    });
    if (!siswa) return res.status(404).json({ error: 'Siswa tidak ditemukan' });

    const tglFilter: any = {};
    if (dari)   { tglFilter.gte = wibMidnight(dari); }
    if (sampai) { const e = wibMidnight(sampai); e.setTime(e.getTime() + 86_400_000); tglFilter.lt = e; }

    const laporan = await prisma.laporanPotensi.findMany({
      where: { siswaId, ...(Object.keys(tglFilter).length ? { tanggal: tglFilter } : {}) },
      orderBy: { tanggal: 'asc' },
      include: { jenisKebaikan: { select: { nama: true } }, jenisPelanggaran: { select: { nama: true } } },
    });

    const kebaikanList = laporan.filter(l => l.tipe === 'KEBAIKAN');
    const pelanggaranList = laporan.filter(l => l.tipe === 'PELANGGARAN');
    const totalKebaikan = kebaikanList.reduce((s, l) => s + l.poin, 0);
    const totalPelanggaran = pelanggaranList.reduce((s, l) => s + l.poin, 0);
    const neto = totalKebaikan - totalPelanggaran;
    const periode = dari && sampai ? `${dari} s/d ${sampai}` : 'Semua Periode';

    const { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, WidthType, AlignmentType, BorderStyle, HeadingLevel } = await import('docx');

    const makeHeaderRow = (cols: string[]) => new TableRow({
      children: cols.map(c => new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: c, bold: true })] })],
        shading: { fill: 'E3F2FD' },
      })),
    });

    const makeTableRows = (rows: string[][]) => rows.map(cells => new TableRow({
      children: cells.map(c => new TableCell({ children: [new Paragraph(c)] })),
    }));

    const tblKebaikan = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        makeHeaderRow(['No', 'Tanggal', 'Jenis Kebaikan', 'Poin', 'Pelapor', 'Keterangan']),
        ...makeTableRows(kebaikanList.map((l, i) => [
          String(i+1), l.tanggal.toISOString().slice(0,10),
          l.jenisKebaikan?.nama || '', String(l.poin), l.namaPelapor, l.keterangan || '',
        ])),
        ...(kebaikanList.length === 0 ? [new TableRow({ children: [new TableCell({ children: [new Paragraph('Tidak ada data')], columnSpan: 6 })] })] : []),
      ],
    });

    const tblPelanggaran = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        makeHeaderRow(['No', 'Tanggal', 'Jenis Pelanggaran', 'Poin', 'Pelapor', 'Keterangan']),
        ...makeTableRows(pelanggaranList.map((l, i) => [
          String(i+1), l.tanggal.toISOString().slice(0,10),
          l.jenisPelanggaran?.nama || '', String(l.poin), l.namaPelapor, l.keterangan || '',
        ])),
        ...(pelanggaranList.length === 0 ? [new TableRow({ children: [new TableCell({ children: [new Paragraph('Tidak ada data')], columnSpan: 6 })] })] : []),
      ],
    });

    const doc = new Document({
      sections: [{
        children: [
          new Paragraph({ text: 'REKAPITULASI POTENSI SISWA', heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER }),
          new Paragraph({ children: [new TextRun({ text: `Nama    : ${siswa.nama}`, break: 0 })] }),
          new Paragraph({ children: [new TextRun({ text: `NIS     : ${siswa.nis}` })] }),
          new Paragraph({ children: [new TextRun({ text: `Kelas   : ${siswa.kelas.nama}` })] }),
          new Paragraph({ children: [new TextRun({ text: `Periode : ${periode}` })] }),
          new Paragraph(''),
          new Paragraph({ text: 'TABEL KEBAIKAN', heading: HeadingLevel.HEADING_2 }),
          tblKebaikan,
          new Paragraph(''),
          new Paragraph({ text: 'TABEL PELANGGARAN', heading: HeadingLevel.HEADING_2 }),
          tblPelanggaran,
          new Paragraph(''),
          new Paragraph({ text: 'REKAP AKHIR', heading: HeadingLevel.HEADING_2 }),
          new Paragraph({ children: [new TextRun({ text: `Total Poin Kebaikan      : ${totalKebaikan}` })] }),
          new Paragraph({ children: [new TextRun({ text: `Total Poin Pelanggaran   : ${totalPelanggaran}` })] }),
          new Paragraph({ children: [new TextRun({ text: `Poin Neto (Baik-Langgar) : ${neto}`, bold: true })] }),
          new Paragraph({ children: [new TextRun({ text: `Status                   : ${neto >= 0 ? 'POSITIF' : 'NEGATIF'}`, bold: true, color: neto >= 0 ? '16A34A' : 'DC2626' })] }),
        ],
      }],
    });

    const buffer = await Packer.toBuffer(doc);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="potensi-${siswa.nis}.docx"`);
    res.send(buffer);
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// Pengaturan Presensi — Kode Akses
// ─────────────────────────────────────────────────────────────────────────────

router.get('/pengaturan-presensi/kode-akses', async (req, res, next) => {
  try {
    const cfg = await prisma.pengaturanPresensi.findFirst();
    res.json({
      kodeAksesGuru: cfg?.kodeAksesGuru || null,
      kodeAksesSiswa: cfg?.kodeAksesSiswa || null,
      kodeAksesLapor: cfg?.kodeAksesLapor || null,
    });
  } catch (err) {
    next(err);
  }
});

router.put('/pengaturan-presensi/kode-akses', async (req, res, next) => {
  try {
    const { kodeAksesGuru, kodeAksesSiswa, kodeAksesLapor } = req.body as {
      kodeAksesGuru?: string;
      kodeAksesSiswa?: string;
      kodeAksesLapor?: string;
    };

    const data: Record<string, string | null> = {};

    if (kodeAksesGuru !== undefined) {
      if (kodeAksesGuru !== null && kodeAksesGuru !== '' && kodeAksesGuru.length !== 6) {
        return res.status(400).json({ error: 'Kode akses guru harus tepat 6 karakter' });
      }
      data.kodeAksesGuru = kodeAksesGuru || null;
    }
    if (kodeAksesSiswa !== undefined) {
      if (kodeAksesSiswa !== null && kodeAksesSiswa !== '' && kodeAksesSiswa.length !== 6) {
        return res.status(400).json({ error: 'Kode akses siswa harus tepat 6 karakter' });
      }
      data.kodeAksesSiswa = kodeAksesSiswa || null;
    }
    if (kodeAksesLapor !== undefined) {
      if (kodeAksesLapor !== null && kodeAksesLapor !== '' && kodeAksesLapor.length !== 6) {
        return res.status(400).json({ error: 'Kode akses lapor harus tepat 6 karakter' });
      }
      data.kodeAksesLapor = kodeAksesLapor || null;
    }

    const existing = await prisma.pengaturanPresensi.findFirst();
    if (existing) {
      await prisma.pengaturanPresensi.update({ where: { id: existing.id }, data });
    } else {
      await prisma.pengaturanPresensi.create({ data: data as any });
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Logo Mitra — CRUD admin
// ─────────────────────────────────────────────────────────────────────────────

router.get('/logo-mitra', async (_req, res, next) => {
  try {
    const logos = await prisma.logoMitra.findMany({
      orderBy: [{ urutan: 'asc' }, { createdAt: 'asc' }],
    });
    res.json(logos);
  } catch (err) { next(err); }
});

router.post('/logo-mitra', validate(CreateLogoMitraSchema), async (req, res, next) => {
  try {
    const { nama, imageUrl, linkUrl, urutan } = req.body;
    if (!nama || !imageUrl) {
      return res.status(400).json({ error: 'Nama dan gambar wajib diisi' });
    }
    const logo = await prisma.logoMitra.create({
      data: {
        nama: String(nama).trim(),
        imageUrl: String(imageUrl),
        linkUrl: linkUrl ? String(linkUrl).trim() : null,
        urutan: Number(urutan) || 0,
      },
    });
    res.json(logo);
  } catch (err) { next(err); }
});

router.patch('/logo-mitra/:id', validate(UpdateLogoMitraSchema), async (req, res, next) => {
  try {
    const { nama, imageUrl, linkUrl, urutan, isActive } = req.body;
    const data: Record<string, any> = {};
    if (nama !== undefined) data.nama = String(nama).trim();
    if (imageUrl !== undefined) data.imageUrl = String(imageUrl);
    if (linkUrl !== undefined) data.linkUrl = linkUrl ? String(linkUrl).trim() : null;
    if (urutan !== undefined) data.urutan = Number(urutan) || 0;
    if (isActive !== undefined) data.isActive = Boolean(isActive);

    const logo = await prisma.logoMitra.update({ where: { id: req.params.id }, data });
    res.json(logo);
  } catch (err) { next(err); }
});

router.delete('/logo-mitra/:id', async (req, res, next) => {
  try {
    await prisma.logoMitra.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
