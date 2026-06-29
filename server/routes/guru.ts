// server/routes/guru.ts
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
  CreateUjianSchema, UpdateUjianSchema,
  AddSoalSchema, UpdateSoalSchema,
  KoreksiUraianSchema,
} from '../lib/validate';

// Upload gambar soal
const uploadsBase = path.dirname(
  process.env.UPLOAD_PATH || path.join(__dirname, '../../uploads/berita')
);
const soalImagePath = path.join(uploadsBase, 'soal');
const uploadBaseUrl = process.env.UPLOAD_BASE_URL || '';
if (!fs.existsSync(soalImagePath)) fs.mkdirSync(soalImagePath, { recursive: true });

const uploadSoal = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, soalImagePath),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, `soal-${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype)) cb(null, true);
    else cb(new Error('Format gambar harus JPEG, PNG, WEBP, atau GIF'));
  },
});

const router = Router();
// SUPER_ADMIN dibolehkan agar bisa mengelola ujian/soal/hasil milik
// semua guru (REQ-002 + REQ-007). Tiap handler yang spesifik untuk
// "guru saya" memakai helper resolveScope() di bawah untuk membedakan
// admin (lihat semua) vs guru (hanya milik sendiri).
router.use(requireAuth, requireRole(['GURU', 'SUPER_ADMIN']));

interface Scope {
  isAdmin: boolean;
  guruId: string | null;
  /** Kelas di mana guru ini adalah wali kelas */
  waliKelasIds: string[];
  /** Semua kelas yang boleh diakses guru: union(waliKelas + GuruKelas) */
  teachingKelasIds: string[];
}

/**
 * Resolve scope berdasarkan role:
 * - admin → isAdmin true, semua kelas
 * - guru  → isAdmin false, hanya kelas yang dia ajar atau dia wali kelasnya
 *
 * Wali kelas otomatis dianggap mengajar di kelasnya (tidak perlu duplikasi
 * di tabel GuruKelas — digabung di sini via union).
 */
async function resolveScope(req: any): Promise<Scope> {
  const role = req.user?.role;
  if (role === 'SUPER_ADMIN') return { isAdmin: true, guruId: null, waliKelasIds: [], teachingKelasIds: [] };
  const guru = await prisma.guru.findUnique({
    where: { userId: req.user.userId },
    include: {
      kelas: { select: { id: true } },       // kelas di mana guru = wali kelas
      guruKelas: { select: { kelasId: true } } // kelas eksplisit pengajar
    }
  });
  const guruId = guru?.id ?? null;
  const waliKelasIds = guru?.kelas.map(k => k.id) ?? [];
  const guruKelasIds = guru?.guruKelas.map(gk => gk.kelasId) ?? [];
  const teachingKelasIds = [...new Set([...waliKelasIds, ...guruKelasIds])];
  return { isAdmin: false, guruId, waliKelasIds, teachingKelasIds };
}

/**
 * Cek akses ujian.
 * mode='write' (default): hanya pemilik ujian & admin.
 * mode='read': pemilik + wali kelas dari kelas yang ujian tersebut ditugaskan.
 */
async function canAccessUjian(req: any, ujianId: string, mode: 'read' | 'write' = 'write'): Promise<boolean> {
  const scope = await resolveScope(req);
  if (scope.isAdmin) return true;
  const ujian = await prisma.ujian.findUnique({
    where: { id: ujianId },
    select: { guruId: true, kelas: { select: { kelasId: true } } }
  });
  if (!ujian) return false;
  if (ujian.guruId === scope.guruId) return true;
  // Guru berkaitan (wali kelas + guru pengajar): baca-saja ujian di kelas yang dia terlibat
  if (mode === 'read' && scope.teachingKelasIds.length > 0) {
    return ujian.kelas.some(k => scope.teachingKelasIds.includes(k.kelasId));
  }
  return false;
}

/**
 * Sama seperti canAccessUjian tapi resolve via soal → ujian → guruId.
 */
async function canAccessSoal(req: any, soalId: string): Promise<boolean> {
  const scope = await resolveScope(req);
  if (scope.isAdmin) return true;
  const soal = await prisma.soal.findUnique({
    where: { id: soalId },
    select: { ujian: { select: { guruId: true } } },
  });
  return !!soal && soal.ujian.guruId === scope.guruId;
}

// POST /api/guru/upload/soal — Upload gambar untuk soal ujian
router.post('/upload/soal', uploadSoal.single('image'), async (req, res, next) => {
  try {
    if (!process.env.UPLOAD_PATH || !process.env.UPLOAD_BASE_URL) {
      return res.status(500).json({ error: 'UPLOAD_PATH atau UPLOAD_BASE_URL belum dikonfigurasi' });
    }
    if (!req.file) return res.status(400).json({ error: 'File gambar tidak ditemukan' });
    const url = `${uploadBaseUrl}/uploads/soal/${req.file.filename}`;
    res.json({ url });
  } catch (err) { next(err); }
});

router.get('/stats', async (req, res, next) => {
  try {
    const guru = await prisma.guru.findUnique({ where: { userId: (req.user as any).userId } });
    if (!guru) return res.status(404).json({ error: 'Guru tidak ditemukan' });

    const stats = await withCache(`guru:stats:${guru.id}`, 120, async () => {
      const totalUjian = await prisma.ujian.count({ where: { guruId: guru.id } });

      // Total Siswa dari kelas yang diajar
      const kelasArr = await prisma.kelas.findMany({ where: { guruId: guru.id } });
      const kelasIds = kelasArr.map(k => k.id);
      const totalSiswa = await prisma.siswa.count({ where: { kelasId: { in: kelasIds } } });

      // Rata-rata nilai: ambil semua sesiUjian dari ujian yang dibuat guru ini
      const sesiSelesai = await prisma.sesiUjian.findMany({
        where: {
          status: { in: ['SELESAI', 'AUTO_SUBMIT'] },
          ujian: { guruId: guru.id }
        },
        select: { nilaiAkhir: true }
      });

      const avg = sesiSelesai.length > 0
        ? sesiSelesai.reduce((a, b) => a + (b.nilaiAkhir || 0), 0) / sesiSelesai.length
        : 0;

      const now = new Date();
      const ujianAktif = await prisma.ujian.count({
        where: {
          guruId: guru.id,
          tanggalMulai: { lte: now },
          tanggalSelesai: { gte: now }
        }
      });

      return { totalUjian, totalSiswa, rataRataNilai: Math.round(avg * 10) / 10, ujianAktif };
    });
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

// Daftar mata pelajaran milik guru yang login (atau semua jika admin)
router.get('/mapel', async (req, res, next) => {
  try {
    const role = (req.user as any)?.role;
    if (role === 'SUPER_ADMIN') {
      // Admin: kembalikan daftar unik dari seluruh guru
      const all = await prisma.guruMataPelajaran.findMany({
        select: { nama: true },
        distinct: ['nama'],
        orderBy: { nama: 'asc' },
      });
      return res.json(all.map(m => m.nama));
    }
    const guru = await prisma.guru.findUnique({
      where: { userId: (req.user as any).userId },
      include: { guruMataPelajaran: { select: { nama: true }, orderBy: { nama: 'asc' } } },
    });
    res.json((guru?.guruMataPelajaran ?? []).map(m => m.nama));
  } catch (error) { next(error); }
});

router.get('/kelas', async (req, res, next) => {
  try {
    const scope = await resolveScope(req);
    const cacheKey = scope.isAdmin ? null : `guru:kelas:${scope.guruId ?? '__none__'}`;
    const fetcher = async () => {
      // Admin: semua kelas. Guru: hanya kelas yang dia ajar (wali + GuruKelas).
      const where = scope.isAdmin ? {} : { id: { in: scope.teachingKelasIds } };
      return prisma.kelas.findMany({
        where,
        include: {
          _count: { select: { siswa: true } },
          guru: { select: { id: true, nama: true } },
        },
        orderBy: [{ tingkat: 'asc' }, { nama: 'asc' }],
      });
    };
    const kelas = cacheKey ? await withCache(cacheKey, 120, fetcher) : await fetcher();
    res.json(kelas);
  } catch (error) {
    next(error);
  }
});

router.post('/kelas', async (req, res, next) => {
  try {
    const guru = await prisma.guru.findUnique({ where: { userId: (req.user as any).userId } });
    if (!guru) return res.status(404).json({ error: 'Guru tidak ditemukan' });

    const result = await prisma.kelas.create({
      data: { ...req.body, guruId: guru.id }
    });
    invalidateByPrefix(`guru:kelas:${guru.id}`);
    invalidateByPrefix(`guru:stats:${guru.id}`);
    invalidateByPrefix('admin:stats');
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

router.patch('/kelas/:id', async (req, res, next) => {
  try {
    const result = await prisma.kelas.update({
      where: { id: req.params.id },
      data: req.body
    });
    invalidateByPrefix('guru:kelas:');
    invalidateByPrefix('guru:stats:');
    res.json(result);
  } catch(error) { next(error); }
});

router.delete('/kelas/:id', async (req, res, next) => {
  try {
    await prisma.kelas.delete({ where: { id: req.params.id } });
    invalidateByPrefix('guru:kelas:');
    invalidateByPrefix('guru:stats:');
    invalidateByPrefix('admin:stats');
    res.json({ success: true });
  } catch(error) { next(error); }
});

// Siswa 
router.get('/siswa', async (req, res, next) => {
  try {
    const { kelasId } = req.query;
    if (!kelasId) return res.status(400).json({ error: 'kelasId diperlukan' });
    // Select user eksplisit — JANGAN return password hash (security).
    const siswa = await prisma.siswa.findMany({
      where: { kelasId: String(kelasId) },
      include: {
        user: { select: { id: true, email: true, isActive: true } }
      }
    });
    res.json(siswa);
  } catch(error) { next(error); }
});

router.post('/siswa', async (req, res, next) => {
  try {
    const { nis, nama, kelasId } = req.body;
    const password = await bcrypt.hash(nis, 10);
    const email = `${nis}@siswa.sch.id`;

    const result = await prisma.user.create({
      data: {
        email, password, role: 'SISWA',
        siswa: { create: { nis, nama, kelasId } }
      },
      include: { siswa: true }
    });
    // _count.siswa di kelas berubah → invalidate semua guru:kelas:*
    invalidateByPrefix('guru:kelas:');
    invalidateByPrefix('guru:stats:');
    invalidateByPrefix('admin:stats');
    res.status(201).json(result.siswa);
  } catch(error) { next(error); }
});

router.patch('/siswa/:id', async (req, res, next) => {
  try {
    const result = await prisma.siswa.update({ where: { id: req.params.id }, data: req.body });
    // Pindah kelas affect _count.siswa per-kelas
    invalidateByPrefix('guru:kelas:');
    res.json(result);
  } catch(error) { next(error); }
});

router.delete('/siswa/:id', async (req, res, next) => {
  try {
    await prisma.$transaction(async (tx) => {
      const siswa = await tx.siswa.findUnique({ where: { id: req.params.id } });
      if (!siswa) return;
      const sesiIds = (await tx.sesiUjian.findMany({ where: { siswaId: siswa.id }, select: { id: true } })).map(s => s.id);
      if (sesiIds.length > 0) {
        await tx.jawaban.deleteMany({ where: { sesiId: { in: sesiIds } } });
        await tx.pelanggaran.deleteMany({ where: { sesiId: { in: sesiIds } } });
        await tx.sesiUjian.deleteMany({ where: { id: { in: sesiIds } } });
      }
      await tx.presensiSiswa.deleteMany({ where: { siswaId: siswa.id } });
      await tx.siswa.delete({ where: { id: siswa.id } });
      if (siswa.userId) await tx.user.delete({ where: { id: siswa.userId } });
    });
    invalidateByPrefix('guru:kelas:');
    invalidateByPrefix('guru:stats:');
    invalidateByPrefix('admin:stats');
    res.json({ success: true });
  } catch(error) { next(error); }
});

// Ujian
router.get('/ujian', async (req, res, next) => {
  try {
    const scope = await resolveScope(req);
    const { page, limit, skip } = getPaginationParams(req.query);

    let where: any;
    if (scope.isAdmin) {
      where = {};
    } else if (scope.waliKelasIds.length > 0) {
      // Wali kelas: ujian milik sendiri ATAU ujian di kelas yang dia wali
      where = {
        OR: [
          { guruId: scope.guruId ?? '__none__' },
          { kelas: { some: { kelasId: { in: scope.waliKelasIds } } } },
        ]
      };
    } else {
      where = { guruId: scope.guruId ?? '__none__' };
    }

    const [ujianList, total] = await prisma.$transaction([
      prisma.ujian.findMany({
        where,
        skip, take: limit,
        include: {
          guru: { select: { id: true, nama: true, nip: true, mataPelajaran: true } },
          kelas: { include: { kelas: true } },
          _count: { select: { soal: true, sesiUjian: true } }
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.ujian.count({ where }),
    ]);

    // Cek ujian mana yang punya soal uraian/esai — untuk tampilkan tombol Koreksi
    const ujianIds = ujianList.map(u => u.id);
    const uraianSoal = ujianIds.length > 0
      ? await prisma.soal.findMany({
          where: { ujianId: { in: ujianIds }, tipe: { in: ['URAIAN_SINGKAT', 'ESAI'] } },
          select: { ujianId: true },
        })
      : [];
    const ujianWithUraian = new Set(uraianSoal.map(s => s.ujianId));

    // Tandai isOwner — wali kelas yg melihat ujian guru lain tidak bisa edit/hapus
    const enriched = ujianList.map(u => ({
      ...u,
      isOwner: scope.isAdmin || u.guruId === scope.guruId,
      adaUraian: ujianWithUraian.has(u.id),
    }));

    res.json(buildPaginatedResult(enriched, total, page, limit));
  } catch(error) { next(error); }
});

router.post('/ujian', validate(CreateUjianSchema), async (req, res, next) => {
  try {
    const scope = await resolveScope(req);
    const { judul, mataPelajaran, tipeUjian, durasi, tanggalMulai, tanggalSelesai,
            acak, acakOpsi, tampilkanPembahasan, tampilkanNilai,
            kelasIds, guruId: bodyGuruId } = req.body;

    if (!judul || !mataPelajaran || !durasi || !tanggalMulai || !tanggalSelesai) {
      return res.status(400).json({ error: "Semua field wajib diisi" });
    }

    // Validasi waktu: tanggalSelesai harus di masa depan & lebih besar dari mulai
    const tMulai = new Date(tanggalMulai);
    const tSelesai = new Date(tanggalSelesai);
    if (tSelesai <= new Date()) {
      return res.status(400).json({ error: "Waktu ditutup harus lebih besar dari waktu saat ini" });
    }
    if (tSelesai <= tMulai) {
      return res.status(400).json({ error: "Waktu ditutup harus lebih besar dari waktu dibuka" });
    }

    // Admin wajib pilih guru pemilik ujian; guru pakai ID dari session-nya.
    const finalGuruId = scope.isAdmin ? String(bodyGuruId ?? '').trim() : scope.guruId;
    if (!finalGuruId) {
      return res.status(400).json({
        error: scope.isAdmin
          ? 'Admin wajib memilih guru pemilik ujian (kirim guruId di body)'
          : 'Akun guru tidak ditemukan',
      });
    }

    // Guru biasa: validasi hanya boleh menugaskan ke kelas yang dia ajar
    if (!scope.isAdmin && kelasIds && Array.isArray(kelasIds)) {
      const invalid = (kelasIds as string[]).filter(id => !scope.teachingKelasIds.includes(id));
      if (invalid.length > 0) {
        return res.status(403).json({ error: 'Anda tidak terdaftar sebagai pengajar di salah satu kelas yang dipilih' });
      }
    }

    const ujian = await prisma.ujian.create({
      data: {
        judul: toTitleCase(judul),
        mataPelajaran: toTitleCase(mataPelajaran),
        tipeUjian,
        durasi: Number(durasi),
        tanggalMulai: tMulai,
        tanggalSelesai: tSelesai,
        acak: !!acak,
        acakOpsi: !!acakOpsi,
        tampilkanPembahasan: tampilkanPembahasan === undefined ? true : !!tampilkanPembahasan,
        tampilkanNilai: tampilkanNilai === undefined ? true : !!tampilkanNilai,
        guruId: finalGuruId,
        kelas: {
          create: (kelasIds || []).map((kId: string) => ({ kelasId: kId }))
        }
      }
    });
    invalidateByPrefix(`guru:stats:${finalGuruId}`);
    invalidateByPrefix('admin:stats');
    res.json(ujian);
  } catch(error) { next(error); }
});

router.get('/ujian/:id', async (req, res, next) => {
  try {
    if (!(await canAccessUjian(req, req.params.id, 'read'))) {
      return res.status(404).json({ error: "Not found" });
    }
    const ujian = await prisma.ujian.findUnique({
      where: { id: req.params.id },
      include: { soal: { include: { opsi: true }, orderBy: { nomor: 'asc' } } }
    });
    if(!ujian) return res.status(404).json({error:"Not found"});
    res.json(ujian);
  } catch(error) { next(error); }
});

router.patch('/ujian/:id', validate(UpdateUjianSchema), async (req, res, next) => {
  try {
    if (!(await canAccessUjian(req, req.params.id))) {
      return res.status(404).json({ error: "Ujian tidak ditemukan" });
    }
    const { judul, mataPelajaran, tipeUjian, durasi, tanggalMulai, tanggalSelesai,
            acak, acakOpsi, tampilkanPembahasan, tampilkanNilai, kelasIds } = req.body;

    // Validasi waktu kalau di-update
    if (tanggalSelesai) {
      const tSelesai = new Date(tanggalSelesai);
      if (tSelesai <= new Date()) {
        return res.status(400).json({ error: "Waktu ditutup harus lebih besar dari waktu saat ini" });
      }
      if (tanggalMulai && tSelesai <= new Date(tanggalMulai)) {
        return res.status(400).json({ error: "Waktu ditutup harus lebih besar dari waktu dibuka" });
      }
    }

    // Hapus relasi UjianKelas lama
    if (kelasIds) {
      await prisma.ujianKelas.deleteMany({ where: { ujianId: req.params.id } });
    }

    const updated = await prisma.ujian.update({
      where: { id: req.params.id },
      data: {
        ...(judul && {judul: toTitleCase(judul)}),
        ...(mataPelajaran && {mataPelajaran: toTitleCase(mataPelajaran)}),
        ...(tipeUjian && {tipeUjian}),
        ...(durasi && {durasi: Number(durasi)}),
        ...(tanggalMulai && {tanggalMulai: new Date(tanggalMulai)}),
        ...(tanggalSelesai && {tanggalSelesai: new Date(tanggalSelesai)}),
        ...(acak !== undefined && {acak: !!acak}),
        ...(acakOpsi !== undefined && {acakOpsi: !!acakOpsi}),
        ...(tampilkanPembahasan !== undefined && {tampilkanPembahasan: !!tampilkanPembahasan}),
        ...(tampilkanNilai !== undefined && {tampilkanNilai: !!tampilkanNilai}),
        ...(kelasIds && {
          kelas: { create: kelasIds.map((c: string) => ({ kelasId: c })) }
        })
      }
    });
    res.json(updated);
  } catch(error) { next(error); }
});

router.delete('/ujian/:id', async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!(await canAccessUjian(req, id))) {
      return res.status(404).json({ error: "Ujian tidak ditemukan" });
    }
    const sesiCount = await prisma.sesiUjian.count({
      where: { ujianId: id, status: { in: ["BERJALAN", "SEDANG_BERLANGSUNG", "SELESAI", "AUTO_SUBMIT"] } }
    });
    
    if (sesiCount > 0) {
      return res.status(400).json({ error: "Tidak bisa menghapus ujian yang sudah dikerjakan siswa" });
    }

    await prisma.ujian.delete({ where: { id: id } });
    invalidateByPrefix('guru:stats:');
    invalidateByPrefix('admin:stats');
    res.json({ success: true });
  } catch(error) { next(error); }
});

router.post('/ujian/:id/duplikat', async (req, res, next) => {
  try {
    const scope = await resolveScope(req);
    if (!(await canAccessUjian(req, req.params.id))) {
      return res.status(404).json({ error: 'Ujian tidak ditemukan' });
    }
    const source = await prisma.ujian.findUnique({
      where: { id: req.params.id },
      include: {
        soal: { include: { opsi: true }, orderBy: { nomor: 'asc' } },
        kelas: true
      }
    });
    if (!source) return res.status(404).json({ error: 'Ujian tidak ditemukan' });

    // Admin pakai guruId milik ujian asli; guru pakai id-nya sendiri
    const targetGuruId = scope.isAdmin ? source.guruId : scope.guruId;
    if (!targetGuruId) return res.status(404).json({ error: 'Guru tidak ditemukan' });

    const copy = await prisma.$transaction(async (tx) => {
      return tx.ujian.create({
        data: {
          judul: `${source.judul} (Salinan)`,
          mataPelajaran: source.mataPelajaran,
          tipeUjian: source.tipeUjian,
          durasi: source.durasi,
          tanggalMulai: source.tanggalMulai,
          tanggalSelesai: source.tanggalSelesai,
          acak: source.acak,
          acakOpsi: source.acakOpsi,
          tampilkanPembahasan: source.tampilkanPembahasan,
          tampilkanNilai: source.tampilkanNilai,
          guruId: targetGuruId,
          kelas: { create: source.kelas.map(k => ({ kelasId: k.kelasId })) },
          soal: {
            create: source.soal.map(s => ({
              nomor: s.nomor,
              teks: s.teks,
              imageUrl: s.imageUrl,
              tipe: s.tipe,
              poin: s.poin,
              opsi: {
                create: s.opsi.map(o => ({
                  teks: o.teks,
                  imageUrl: o.imageUrl,
                  urutan: o.urutan,
                  benar: o.benar
                }))
              }
            }))
          }
        }
      });
    });

    invalidateByPrefix(`guru:stats:${targetGuruId}`);
    invalidateByPrefix('admin:stats');
    res.json(copy);
  } catch(error) { next(error); }
});

// Soal routes
router.get('/ujian/:id/soal', async (req, res, next) => {
  try {
    if (!(await canAccessUjian(req, req.params.id, 'read'))) {
      return res.status(404).json({ error: "Ujian tidak ditemukan" });
    }
    const soal = await prisma.soal.findMany({ where: { ujianId: req.params.id }, include: { opsi: true }, orderBy: {nomor: 'asc'} });
    res.json(soal);
  } catch(e) { next(e); }
});

router.post('/ujian/:id/soal', validate(AddSoalSchema), async (req, res, next) => {
  try {
    if (!(await canAccessUjian(req, req.params.id))) {
      return res.status(404).json({ error: "Ujian tidak ditemukan" });
    }
    const { teks, imageUrl, tipe, opsi, poin } = req.body;

    if (!teks?.trim()) return res.status(400).json({ error: "Teks soal tidak boleh kosong" });
    const isUraian = tipe === 'URAIAN_SINGKAT' || tipe === 'ESAI';
    if (!isUraian) {
      if (!opsi || opsi.length < 2) return res.status(400).json({ error: "Minimal 2 opsi jawaban" });
      if (!opsi.some((o: any) => o.benar)) return res.status(400).json({ error: "Pilih minimal satu jawaban benar" });
    }

    const count = await prisma.soal.count({ where: { ujianId: req.params.id } });
    const soal = await prisma.soal.create({
      data: {
        ujianId: req.params.id,
        nomor: count + 1,
        teks, imageUrl, tipe, poin: Number(poin || 1),
        opsi: {
          create: opsi.map((o: any, i: number) => ({
            teks: o.teks, imageUrl: o.imageUrl, urutan: i + 1, benar: o.benar
          }))
        }
      },
      include: { opsi: true }
    });
    res.status(201).json(soal);
  } catch(error) { next(error); }
});

// ── Bulk Import Soal: template Excel ───────────────────────────
// Format: tipe | teks | poin | opsiA | opsiB | opsiC | opsiD | opsiE | kunci
// Tipe: PILIHAN_GANDA | PG_KOMPLEKS | BENAR_SALAH | URAIAN_SINGKAT | ESAI
// Kunci PG          : huruf A/B/C/D/E (1 huruf)
// Kunci PG_KOMPLEKS : multi huruf "AC", "BCD"
// Kunci BENAR_SALAH : "BENAR" atau "SALAH"
// Kunci URAIAN/ESAI : kosong (dinilai manual oleh guru)
router.get('/ujian/:id/soal/import-template', async (_req, res, next) => {
  try {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Template Soal');
    ws.columns = [
      { header: 'tipe',  key: 'tipe',  width: 18 },
      { header: 'teks',  key: 'teks',  width: 60 },
      { header: 'poin',  key: 'poin',  width: 8 },
      { header: 'opsiA', key: 'opsiA', width: 25 },
      { header: 'opsiB', key: 'opsiB', width: 25 },
      { header: 'opsiC', key: 'opsiC', width: 25 },
      { header: 'opsiD', key: 'opsiD', width: 25 },
      { header: 'opsiE', key: 'opsiE', width: 25 },
      { header: 'kunci', key: 'kunci', width: 12 },
    ];

    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } };

    // Warna latar baris uraian/esai agar terlihat beda
    const yellowFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF8E1' } };

    // Contoh: soal pilihan ganda
    ws.addRow({ tipe: 'PILIHAN_GANDA', teks: 'Berapa hasil 2 + 2?', poin: 10,
      opsiA: '3', opsiB: '4', opsiC: '5', opsiD: '6', opsiE: '', kunci: 'B' });
    // Contoh: PG kompleks
    ws.addRow({ tipe: 'PG_KOMPLEKS', teks: 'Pilih bilangan prima di bawah ini', poin: 10,
      opsiA: '2', opsiB: '4', opsiC: '7', opsiD: '9', opsiE: '11', kunci: 'ACE' });
    // Contoh: benar/salah
    ws.addRow({ tipe: 'BENAR_SALAH', teks: 'Matahari terbit di sebelah timur', poin: 5,
      opsiA: '', opsiB: '', opsiC: '', opsiD: '', opsiE: '', kunci: 'BENAR' });
    // Contoh: uraian singkat — opsi & kunci dikosongkan
    const rowUraian = ws.addRow({ tipe: 'URAIAN_SINGKAT', teks: 'Sebutkan 3 contoh benda padat!', poin: 10,
      opsiA: '', opsiB: '', opsiC: '', opsiD: '', opsiE: '', kunci: '' });
    rowUraian.fill = yellowFill;
    // Contoh: esai — opsi & kunci dikosongkan
    const rowEsai = ws.addRow({ tipe: 'ESAI', teks: 'Jelaskan proses terjadinya hujan secara lengkap!', poin: 10,
      opsiA: '', opsiB: '', opsiC: '', opsiD: '', opsiE: '', kunci: '' });
    rowEsai.fill = yellowFill;

    // Sheet panduan
    const info = wb.addWorksheet('Panduan');
    info.columns = [{ width: 20 }, { width: 85 }];
    info.addRow(['Cara Mengisi Template Import Soal']);
    info.addRow([]);
    info.addRow(['Kolom', 'Keterangan']);
    info.addRow(['tipe', 'Salah satu: PILIHAN_GANDA, PG_KOMPLEKS, BENAR_SALAH, URAIAN_SINGKAT, ESAI']);
    info.addRow(['teks', 'Teks pertanyaan soal']);
    info.addRow(['poin', 'Bobot nilai per soal (angka > 0). Disarankan 10 untuk uraian/esai.']);
    info.addRow(['opsiA-opsiE', 'Pilihan jawaban. Kosongkan untuk BENAR_SALAH, URAIAN_SINGKAT, dan ESAI.']);
    info.addRow(['kunci', 'PILIHAN_GANDA: 1 huruf A-E. PG_KOMPLEKS: multi huruf mis. "ACE". BENAR_SALAH: "BENAR" atau "SALAH". URAIAN_SINGKAT & ESAI: biarkan kosong (dinilai manual oleh guru).']);
    info.addRow([]);
    info.addRow(['Catatan URAIAN_SINGKAT & ESAI']);
    info.addRow(['Kolom opsiA-opsiE dan kunci harus dikosongkan.']);
    info.addRow(['Guru menilai secara manual dengan memberi nilai 1-10 di halaman Koreksi.']);
    info.addRow(['Nilai akhir = (nilai guru ÷ 10) × poin soal.']);
    info.getRow(1).font = { bold: true, size: 14 };
    info.getRow(3).font = { bold: true };
    info.getRow(10).font = { bold: true };

    const buf = await wb.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="template-import-soal.xlsx"');
    res.send(Buffer.from(buf));
  } catch (error) { next(error); }
});

// ── Bulk Import Soal: terima parsed items dari frontend ────────
router.post('/ujian/:id/soal/import', async (req, res, next) => {
  try {
    const ujianId = req.params.id;
    const { items } = req.body as { items?: any[] };

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Tidak ada data baris yang ter-baca' });
    }
    if (items.length > 200) {
      return res.status(400).json({ error: 'Maksimal 200 soal per import' });
    }

    // Pastikan ujian milik guru (atau admin)
    if (!(await canAccessUjian(req, ujianId))) {
      return res.status(404).json({ error: 'Ujian tidak ditemukan' });
    }
    const ujian = await prisma.ujian.findUnique({ where: { id: ujianId } });
    if (!ujian) return res.status(404).json({ error: 'Ujian tidak ditemukan' });

    const VALID_TIPE = new Set(['PILIHAN_GANDA', 'PG_KOMPLEKS', 'BENAR_SALAH', 'URAIAN_SINGKAT', 'ESAI']);
    const LETTERS = ['A', 'B', 'C', 'D', 'E'];

    let created = 0;
    const failed: { row: number; message: string }[] = [];
    let startNomor = (await prisma.soal.count({ where: { ujianId } })) + 1;

    for (let i = 0; i < items.length; i++) {
      const row = items[i];
      const rowNumber = i + 2; // header = row 1
      const tipe = String(row.tipe ?? '').trim().toUpperCase();
      const teks = String(row.teks ?? '').trim();
      const poin = Number(row.poin ?? 1);
      const kunci = String(row.kunci ?? '').trim().toUpperCase();

      if (!VALID_TIPE.has(tipe)) {
        failed.push({ row: rowNumber, message: `Tipe "${tipe}" tidak valid` });
        continue;
      }
      if (!teks) {
        failed.push({ row: rowNumber, message: 'Teks soal kosong' });
        continue;
      }
      if (!Number.isFinite(poin) || poin <= 0) {
        failed.push({ row: rowNumber, message: 'Poin tidak valid (harus angka > 0)' });
        continue;
      }

      // Build opsi[] berdasarkan tipe
      let opsi: { teks: string; benar: boolean }[] = [];

      // Uraian/esai tidak punya opsi — langsung simpan tanpa validasi opsi/kunci
      if (tipe === 'URAIAN_SINGKAT' || tipe === 'ESAI') {
        try {
          await prisma.soal.create({
            data: { ujianId, nomor: startNomor++, teks, tipe, poin, opsi: { create: [] } },
          });
          created++;
        } catch (err: any) {
          startNomor--;
          failed.push({ row: rowNumber, message: err.message ?? 'Gagal insert' });
        }
        continue;
      }

      if (tipe === 'BENAR_SALAH') {
        if (kunci !== 'BENAR' && kunci !== 'SALAH') {
          failed.push({ row: rowNumber, message: 'Kunci BENAR_SALAH harus "BENAR" atau "SALAH"' });
          continue;
        }
        opsi = [
          { teks: 'Benar', benar: kunci === 'BENAR' },
          { teks: 'Salah', benar: kunci === 'SALAH' },
        ];
      } else {
        // PILIHAN_GANDA / PG_KOMPLEKS — kumpulkan opsiA-E
        const opsiTexts: string[] = [];
        for (const letter of LETTERS) {
          const v = String(row[`opsi${letter}`] ?? '').trim();
          if (v) opsiTexts.push(v);
        }
        if (opsiTexts.length < 2) {
          failed.push({ row: rowNumber, message: `Minimal 2 opsi diisi (opsiA-E)` });
          continue;
        }
        // Parse kunci
        if (!kunci || !/^[A-E]+$/.test(kunci)) {
          failed.push({ row: rowNumber, message: `Kunci "${kunci}" tidak valid (huruf A-E)` });
          continue;
        }
        const benarSet = new Set(kunci.split(''));
        if (tipe === 'PILIHAN_GANDA' && benarSet.size !== 1) {
          failed.push({ row: rowNumber, message: 'PILIHAN_GANDA hanya boleh 1 kunci jawaban' });
          continue;
        }
        // Validate kunci letter ada di opsi range
        const maxLetter = LETTERS[opsiTexts.length - 1];
        const invalidLetter = [...benarSet].find(l => l > maxLetter);
        if (invalidLetter) {
          failed.push({ row: rowNumber, message: `Kunci ${invalidLetter} di luar opsi (max ${maxLetter})` });
          continue;
        }
        opsi = opsiTexts.map((teks, idx) => ({
          teks,
          benar: benarSet.has(LETTERS[idx]),
        }));
      }

      try {
        await prisma.soal.create({
          data: {
            ujianId,
            nomor: startNomor++,
            teks,
            tipe,
            poin,
            opsi: {
              create: opsi.map((o, idx) => ({
                teks: o.teks,
                urutan: idx + 1,
                benar: o.benar,
              })),
            },
          },
        });
        created++;
      } catch (err: any) {
        startNomor--; // rollback counter
        failed.push({ row: rowNumber, message: err.message ?? 'Gagal insert' });
      }
    }

    res.json({ created, failed });
  } catch (error) { next(error); }
});

router.patch('/soal/:id', validate(UpdateSoalSchema), async (req, res, next) => {
  try {
    if (!(await canAccessSoal(req, req.params.id))) {
      return res.status(404).json({ error: "Soal tidak ditemukan" });
    }
    const { teks, imageUrl, tipe, opsi, poin } = req.body;
    const updated = await prisma.$transaction(async (tx) => {
      // Hapus opsi lama
      await tx.opsi.deleteMany({ where: { soalId: req.params.id } });
      // Update soal & buat opsi baru
      return tx.soal.update({
        where: { id: req.params.id },
        data: {
          teks, imageUrl: imageUrl ?? null, tipe, poin: poin ? Number(poin) : 1,
          opsi: {
            create: opsi.map((o: any, i: number) => ({
              teks: o.teks, imageUrl: o.imageUrl ?? null, urutan: i + 1, benar: o.benar
            }))
          }
        },
        include: { opsi: true }
      });
    });
    res.json(updated);
  } catch(error) { next(error); }
});

router.delete('/soal/:id', async (req, res, next) => {
  try {
    const soalId = req.params.id;
    if (!(await canAccessSoal(req, soalId))) {
      return res.status(404).json({ error: "Soal tidak ditemukan" });
    }
    const soal = await prisma.soal.findUnique({ where: { id: soalId } });
    if (!soal) return res.status(404).json({ error: "Soal tidak ditemukan" });

    await prisma.soal.delete({ where: { id: soalId } });
    
    // Renumber sisa soal
    const remaining = await prisma.soal.findMany({
      where: { ujianId: soal.ujianId },
      orderBy: { nomor: "asc" }
    });
    
    await Promise.all(
      remaining.map((s, i) =>
        prisma.soal.update({ where: { id: s.id }, data: { nomor: i + 1 } })
      )
    );

    res.json({ success: true });
  } catch(error) { next(error); }
});

router.get('/ujian/:id/hasil', async (req, res, next) => {
  try {
    if (!(await canAccessUjian(req, req.params.id, 'read'))) {
      return res.status(404).json({ error: 'Not found' });
    }
    const ujian = await prisma.ujian.findUnique({
      where: { id: req.params.id },
      include: { kelas: true }
    });
    if (!ujian) return res.status(404).json({ error: 'Not found' });

    const kelasIds = ujian.kelas.map(k => k.kelasId);
    
    const siswaList = await prisma.siswa.findMany({
      where: { kelasId: { in: kelasIds } },
      include: {
        kelas: true,
        sesiUjian: {
          where: { ujianId: ujian.id },
          include: { pelanggaran: true }
        }
      }
    });

    const result = siswaList.map(s => {
      const sesi = s.sesiUjian[0];
      return {
        siswa: { id: s.id, nama: s.nama, nis: s.nis, kelas: s.kelas },
        sesiId: sesi?.id || null,
        nilaiAkhir: sesi?.nilaiAkhir ?? null,
        nilaiRaw: sesi?.nilaiRaw ?? null,
        status: sesi?.status ?? 'BELUM_MULAI',
        submitReason: sesi?.submitReason ?? null,
        mulaiAt: sesi?.mulaiAt ?? null,
        selesaiAt: sesi?.selesaiAt ?? null,
        pelanggaran: sesi?.pelanggaran || []
      }
    });
    
    res.json(result);
  } catch(error) { next(error); }
});

// Detail jawaban per sesi (untuk modal)
// Reset sesi siswa supaya bisa mengerjakan ujian dari awal.
// Hapus SesiUjian — Jawaban & Pelanggaran ikut terhapus via onDelete: Cascade.
// Saat siswa klik Mulai Ujian lagi, sesi baru terbuat (mulaiAt fresh).
router.delete('/ujian/:id/sesi/:sesiId', async (req, res, next) => {
  try {
    if (!(await canAccessUjian(req, req.params.id))) {
      return res.status(404).json({ error: 'Sesi tidak ditemukan' });
    }
    const sesi = await prisma.sesiUjian.findUnique({
      where: { id: req.params.sesiId },
      include: { siswa: { select: { nama: true, nis: true } } },
    });
    if (!sesi || sesi.ujianId !== req.params.id) {
      return res.status(404).json({ error: 'Sesi tidak ditemukan' });
    }

    await prisma.sesiUjian.delete({ where: { id: req.params.sesiId } });

    // rataRataNilai di guru:stats berubah karena sesi dihapus.
    invalidateByPrefix('guru:stats:');
    res.json({
      success: true,
      message: `Sesi ujian "${sesi.siswa.nama}" (NIS ${sesi.siswa.nis}) berhasil di-reset. Siswa bisa mengerjakan ulang.`,
    });
  } catch (error) { next(error); }
});

router.get('/ujian/:id/sesi/:sesiId', async (req, res, next) => {
  try {
    if (!(await canAccessUjian(req, req.params.id, 'read'))) {
      return res.status(404).json({ error: 'Sesi tidak ditemukan' });
    }
    const sesi = await prisma.sesiUjian.findUnique({
      where: { id: req.params.sesiId },
      include: {
        siswa: { select: { id: true, nama: true, nis: true } },
        jawaban: {
          include: {
            soal: { include: { opsi: { orderBy: { urutan: 'asc' } } } },
            opsi: true
          }
        }
      }
    });
    if (!sesi || sesi.ujianId !== req.params.id) return res.status(404).json({ error: 'Sesi tidak ditemukan' });

    const soalList = await prisma.soal.findMany({
      where: { ujianId: req.params.id },
      include: { opsi: { orderBy: { urutan: 'asc' } } },
      orderBy: { nomor: 'asc' }
    });

    const jawabanMap = new Map(sesi.jawaban.map(j => [j.soalId, j]));

    const detail = soalList.map(soal => {
      const jwb = jawabanMap.get(soal.id);
      const opsiBenar = soal.opsi.find(o => o.benar);
      return {
        nomor: soal.nomor,
        teks: soal.teks,
        tipe: soal.tipe,
        poin: soal.poin,
        opsiDipilih: jwb?.opsi ? { id: jwb.opsi.id, teks: jwb.opsi.teks } : null,
        opsiBenar: opsiBenar ? { id: opsiBenar.id, teks: opsiBenar.teks } : null,
        isBenar: jwb?.isBenar ?? false,
        tidakDijawab: !jwb
      };
    });

    res.json({
      siswa: sesi.siswa,
      sesi: {
        id: sesi.id,
        nilaiAkhir: sesi.nilaiAkhir,
        nilaiRaw: sesi.nilaiRaw,
        status: sesi.status,
        submitReason: sesi.submitReason,
        mulaiAt: sesi.mulaiAt,
        selesaiAt: sesi.selesaiAt
      },
      detail
    });
  } catch(error) { next(error); }
});

// ── Koreksi Uraian / Esai ──────────────────────────────────────────────────

// Hitung ulang nilaiAkhir sesi setelah guru input nilaiUraian.
async function recomputeNilaiSesi(sesiId: string) {
  const sesi = await prisma.sesiUjian.findUnique({
    where: { id: sesiId },
    include: {
      ujian: { include: { soal: true } },
      jawaban: true,
    },
  });
  if (!sesi) return;

  let totalPoin = 0;
  let poinDidapat = 0;

  for (const soal of sesi.ujian.soal) {
    totalPoin += soal.poin;
    const isUraian = soal.tipe === 'URAIAN_SINGKAT' || soal.tipe === 'ESAI';
    if (isUraian) {
      const jwb = sesi.jawaban.find(j => j.soalId === soal.id);
      if (jwb?.nilaiUraian != null) {
        poinDidapat += (jwb.nilaiUraian / 10) * soal.poin;
      }
    } else {
      const jwb = sesi.jawaban.find(j => j.soalId === soal.id && j.isBenar);
      if (jwb) poinDidapat += soal.poin;
    }
  }

  const nilaiAkhir = totalPoin > 0 ? (poinDidapat / totalPoin) * 100 : 0;
  await prisma.sesiUjian.update({
    where: { id: sesiId },
    data: { nilaiRaw: poinDidapat, nilaiAkhir: Math.round(nilaiAkhir * 100) / 100 },
  });
}

// Daftar sesi + jawaban uraian/esai yang perlu/sudah dikoreksi guru
router.get('/ujian/:id/koreksi', async (req, res, next) => {
  try {
    if (!(await canAccessUjian(req, req.params.id, 'read'))) {
      return res.status(404).json({ error: 'Ujian tidak ditemukan' });
    }

    const soalUraian = await prisma.soal.findMany({
      where: { ujianId: req.params.id, tipe: { in: ['URAIAN_SINGKAT', 'ESAI'] } },
      orderBy: { nomor: 'asc' },
    });
    if (soalUraian.length === 0) return res.json({ soal: [], sesi: [] });

    const sesiList = await prisma.sesiUjian.findMany({
      where: {
        ujianId: req.params.id,
        status: { in: ['SELESAI', 'AUTO_SUBMIT'] },
      },
      include: {
        siswa: { select: { id: true, nama: true, nis: true, kelas: { select: { nama: true } } } },
        jawaban: {
          where: { soalId: { in: soalUraian.map(s => s.id) } },
          select: { id: true, soalId: true, jawabanTeks: true, nilaiUraian: true, catatanGuru: true },
        },
      },
      orderBy: { selesaiAt: 'asc' },
    });

    const result = sesiList.map(sesi => {
      const jawabanMap = new Map(sesi.jawaban.map(j => [j.soalId, j]));
      const sudahDinilai = soalUraian.every(s => jawabanMap.get(s.id)?.nilaiUraian != null);
      return {
        sesiId: sesi.id,
        siswa: sesi.siswa,
        nilaiAkhir: sesi.nilaiAkhir,
        selesaiAt: sesi.selesaiAt,
        sudahDinilai,
        jawaban: soalUraian.map(soal => {
          const jwb = jawabanMap.get(soal.id);
          return {
            jawabanId: jwb?.id ?? null,
            soalId: soal.id,
            nomor: soal.nomor,
            tipe: soal.tipe,
            poin: soal.poin,
            jawabanTeks: jwb?.jawabanTeks ?? null,
            nilaiUraian: jwb?.nilaiUraian ?? null,
            catatanGuru: jwb?.catatanGuru ?? null,
          };
        }),
      };
    });

    res.json({ soal: soalUraian.map(s => ({ id: s.id, nomor: s.nomor, tipe: s.tipe, teks: s.teks, poin: s.poin })), sesi: result });
  } catch(error) { next(error); }
});

// Simpan penilaian uraian untuk 1 sesi, lalu hitung ulang nilaiAkhir
router.post('/ujian/:id/koreksi/sesi/:sesiId', validate(KoreksiUraianSchema), async (req, res, next) => {
  try {
    if (!(await canAccessUjian(req, req.params.id))) {
      return res.status(403).json({ error: 'Akses ditolak' });
    }
    const { penilaian } = req.body as {
      penilaian: { jawabanId: string; nilaiUraian: number; catatanGuru?: string }[];
    };
    if (!Array.isArray(penilaian) || penilaian.length === 0) {
      return res.status(400).json({ error: 'Data penilaian kosong' });
    }

    for (const p of penilaian) {
      if (p.nilaiUraian < 1 || p.nilaiUraian > 10) {
        return res.status(400).json({ error: 'Nilai harus antara 1 dan 10' });
      }
    }

    // Pastikan semua jawabanId milik sesi ini
    const jawabanIds = penilaian.map(p => p.jawabanId);
    const owned = await prisma.jawaban.findMany({
      where: { id: { in: jawabanIds }, sesiId: req.params.sesiId },
      select: { id: true },
    });
    if (owned.length !== jawabanIds.length) {
      return res.status(400).json({ error: 'Jawaban tidak valid' });
    }

    await prisma.$transaction(
      penilaian.map(p =>
        prisma.jawaban.update({
          where: { id: p.jawabanId },
          data: { nilaiUraian: p.nilaiUraian, catatanGuru: p.catatanGuru ?? null },
        })
      )
    );

    await recomputeNilaiSesi(req.params.sesiId);
    invalidateByPrefix('guru:stats:');

    const updated = await prisma.sesiUjian.findUnique({
      where: { id: req.params.sesiId },
      select: { nilaiAkhir: true, nilaiRaw: true },
    });
    res.json({ success: true, nilaiAkhir: updated?.nilaiAkhir });
  } catch(error) { next(error); }
});

// Export Excel / PDF
router.get('/ujian/:id/export', async (req, res, next) => {
  try {
    if (!(await canAccessUjian(req, req.params.id, 'read'))) {
      return res.status(404).json({ error: 'Ujian tidak ditemukan' });
    }
    const ujian = await prisma.ujian.findUnique({
      where: { id: req.params.id },
      include: { kelas: { include: { kelas: true } } }
    });
    if (!ujian) return res.status(404).json({ error: 'Ujian tidak ditemukan' });

    const format = req.query.format || 'xlsx';
    const kelasIds = ujian.kelas.map(k => k.kelasId);
    const kelasNama = ujian.kelas.map(k => (k as any).kelas?.nama).filter(Boolean).join(', ');

    const siswaList = await prisma.siswa.findMany({
      where: { kelasId: { in: kelasIds } },
      include: {
        sesiUjian: { where: { ujianId: req.params.id }, include: { pelanggaran: true } },
        kelas: true
      },
      orderBy: [{ kelas: { nama: 'asc' } }, { nama: 'asc' }]
    });

    const selesaiList = siswaList.filter(s => {
      const st = s.sesiUjian[0]?.status;
      return (st === 'SELESAI' || st === 'AUTO_SUBMIT') && s.sesiUjian[0]?.nilaiAkhir !== null;
    });
    const nilaiArr = selesaiList.map(s => s.sesiUjian[0].nilaiAkhir as number);
    const rataRata = nilaiArr.length ? Math.round(nilaiArr.reduce((a, b) => a + b, 0) / nilaiArr.length) : 0;
    const tertinggi = nilaiArr.length ? Math.max(...nilaiArr) : 0;
    const terendah = nilaiArr.length ? Math.min(...nilaiArr) : 0;

    const statusLabel = (s: any) => {
      if (!s) return 'Belum Mulai';
      if (s.status === 'SELESAI') return s.submitReason === 'timeout' ? 'Waktu Habis' : 'Selesai';
      if (s.status === 'AUTO_SUBMIT') return 'Auto-Submit';
      if (s.status === 'SEDANG_BERLANGSUNG') return 'Berlangsung';
      return 'Belum Mulai';
    };

    if (format === 'xlsx') {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Hasil Ujian');

      ws.columns = [
        { width: 5 }, { width: 14 }, { width: 30 }, { width: 14 },
        { width: 10 }, { width: 16 }, { width: 13 }, { width: 11 }, { width: 11 },
      ];

      ws.mergeCells('A1:I1');
      const titleCell = ws.getCell('A1');
      titleCell.value = `REKAP NILAI UJIAN`;
      titleCell.font = { bold: true, size: 14 };
      titleCell.alignment = { horizontal: 'center' };

      ws.addRow([]);
      ws.addRow(['Judul Ujian', ujian.judul]);
      ws.addRow(['Mata Pelajaran', ujian.mataPelajaran]);
      ws.addRow(['Kelas', kelasNama]);
      ws.addRow(['Tanggal', new Date(ujian.tanggalMulai!).toLocaleDateString('id-ID')]);
      ws.addRow(['Durasi Ujian', `${ujian.durasi} menit`]);
      ws.addRow([]);

      const fmtTime = (dt: Date | null | undefined) => {
        if (!dt) return '-';
        return new Date(dt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      };
      const durasiMnt = (mulai: Date | null | undefined, selesai: Date | null | undefined) => {
        if (!mulai || !selesai) return '-';
        return `${Math.round((new Date(selesai).getTime() - new Date(mulai).getTime()) / 60000)} mnt`;
      };

      const hRow = ws.addRow(['No', 'NIS', 'Nama Siswa', 'Kelas', 'Nilai', 'Status', 'Pelanggaran', 'Mulai', 'Selesai', 'Durasi']);
      hRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      hRow.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
        cell.alignment = { horizontal: 'center' };
      });

      siswaList.forEach((s, idx) => {
        const sesi = s.sesiUjian[0];
        const row = ws.addRow([
          idx + 1, s.nis, s.nama, s.kelas?.nama ?? '-',
          sesi?.nilaiAkhir ?? '-', statusLabel(sesi), sesi?.pelanggaran?.length ?? 0,
          fmtTime(sesi?.mulaiAt), fmtTime(sesi?.selesaiAt), durasiMnt(sesi?.mulaiAt, sesi?.selesaiAt),
        ]);
        const nilai = sesi?.nilaiAkhir;
        if (nilai !== null && nilai !== undefined) {
          const scoreCell = row.getCell(5);
          scoreCell.font = { bold: true, color: { argb: nilai >= 75 ? 'FF16A34A' : nilai >= 60 ? 'FFCA8A04' : 'FFDC2626' } };
        }
        // Kolom waktu rata tengah
        [8, 9, 10].forEach(c => { row.getCell(c).alignment = { horizontal: 'center' }; });
      });

      ws.addRow([]);
      ws.addRow(['STATISTIK']);
      ws.addRow(['Peserta Selesai', selesaiList.length]);
      ws.addRow(['Rata-rata', rataRata]);
      ws.addRow(['Tertinggi', tertinggi]);
      ws.addRow(['Terendah', terendah]);

      const buf = await wb.xlsx.writeBuffer();
      const filename = `nilai-${ujian.judul.replace(/\s+/g, '-').toLowerCase()}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(Buffer.from(buf));
      return;
    }

    if (format === 'pdf') {
      const PDFDocument = (await import('pdfkit')).default;
      const chunks: Buffer[] = [];
      // Landscape agar 10 kolom muat tanpa terpotong
      const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 40 });

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => {
        const buf = Buffer.concat(chunks);
        const filename = `nilai-${ujian.judul.replace(/\s+/g, '-').toLowerCase()}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(buf);
      });

      // Landscape A4: 841.89 × 595.28 pt; usable width = 841.89 − 2×40 = 761.89
      const LM = 40;
      const PW = 762;

      // Header banner
      doc.rect(LM, 30, PW, 58).fill('#1D4ED8');
      doc.fillColor('#FFFFFF').fontSize(15).font('Helvetica-Bold')
        .text('REKAP NILAI UJIAN', LM, 40, { width: PW, align: 'center' });
      doc.fontSize(9).font('Helvetica')
        .text(ujian.judul, LM, 60, { width: PW, align: 'center' });
      doc.fillColor('#000000');

      // Info block (2 kolom)
      const infoLeft  = [['Mata Pelajaran', ujian.mataPelajaran], ['Kelas', kelasNama || '-']];
      const infoRight = [
        ['Tanggal', new Date(ujian.tanggalMulai!).toLocaleDateString('id-ID')],
        ['Durasi Ujian', `${ujian.durasi} menit`],
      ];
      const iy = 101;
      doc.fontSize(8.5);
      infoLeft.forEach(([k, v], i) => {
        doc.font('Helvetica-Bold').text(k, LM, iy + i * 14, { continued: true });
        doc.font('Helvetica').text(`: ${v}`);
      });
      infoRight.forEach(([k, v], i) => {
        doc.font('Helvetica-Bold').text(k, LM + 400, iy + i * 14, { continued: true });
        doc.font('Helvetica').text(`: ${v}`);
      });

      // Helper waktu
      const fmtT = (dt: Date | null | undefined) => {
        if (!dt) return '-';
        return new Date(dt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      };
      const durasiT = (mulai: Date | null | undefined, selesai: Date | null | undefined) => {
        if (!mulai || !selesai) return '-';
        return `${Math.round((new Date(selesai).getTime() - new Date(mulai).getTime()) / 60000)} mnt`;
      };

      // Kolom: No | NIS | Nama | Kelas | Nilai | Status | Mulai | Selesai | Durasi | Pelanggar
      const colX = [LM, LM+25, LM+75, LM+235, LM+305, LM+345, LM+415, LM+470, LM+528, LM+578];
      const colW = [24,  48,    158,    68,      38,      68,      53,     56,      48,     50  ];
      const hdrs = ['No', 'NIS', 'Nama Siswa', 'Kelas', 'Nilai', 'Status', 'Mulai', 'Selesai', 'Durasi', 'Pelanggar.'];
      const centerCols = new Set([0, 4, 5, 6, 7, 8, 9]);

      const drawHeader = (y: number) => {
        doc.rect(LM, y, PW, 15).fill('#E2E8F0');
        doc.fillColor('#1E293B').font('Helvetica-Bold').fontSize(7.5);
        hdrs.forEach((h, i) => doc.text(h, colX[i], y + 4, { width: colW[i], align: centerCols.has(i) ? 'center' : 'left' }));
        doc.fillColor('#000000').font('Helvetica').fontSize(7.5);
      };

      let y2 = iy + infoLeft.length * 14 + 10;
      drawHeader(y2);
      y2 += 17;

      siswaList.forEach((s, idx) => {
        if (y2 > 520) {
          doc.addPage();
          y2 = 40;
          drawHeader(y2);
          y2 += 17;
        }
        if (idx % 2 === 0) doc.rect(LM, y2, PW, 13).fill('#F8FAFC');
        const sesi = s.sesiUjian[0];
        const n = sesi?.nilaiAkhir;
        doc.fillColor('#000000');
        doc.text(String(idx + 1),            colX[0], y2 + 3, { width: colW[0], align: 'center' });
        doc.text(s.nis || '-',               colX[1], y2 + 3, { width: colW[1] });
        doc.text(s.nama.slice(0, 28),        colX[2], y2 + 3, { width: colW[2] });
        doc.text(s.kelas?.nama ?? '-',       colX[3], y2 + 3, { width: colW[3] });
        doc.fillColor(n != null ? (n >= 75 ? '#16A34A' : n >= 60 ? '#CA8A04' : '#DC2626') : '#64748B');
        doc.font('Helvetica-Bold').text(n != null ? String(n) : '-', colX[4], y2 + 3, { width: colW[4], align: 'center' });
        doc.fillColor('#000000').font('Helvetica');
        doc.text(statusLabel(sesi),                            colX[5], y2 + 3, { width: colW[5], align: 'center' });
        doc.text(fmtT(sesi?.mulaiAt),                          colX[6], y2 + 3, { width: colW[6], align: 'center' });
        doc.text(fmtT(sesi?.selesaiAt),                        colX[7], y2 + 3, { width: colW[7], align: 'center' });
        doc.text(durasiT(sesi?.mulaiAt, sesi?.selesaiAt),      colX[8], y2 + 3, { width: colW[8], align: 'center' });
        doc.text(String(sesi?.pelanggaran?.length ?? 0),       colX[9], y2 + 3, { width: colW[9], align: 'center' });
        y2 += 13;
      });

      // Statistik
      y2 += 14;
      if (y2 > 500) { doc.addPage(); y2 = 40; }
      doc.rect(LM, y2, 200, 15).fill('#1D4ED8');
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8.5).text('STATISTIK', LM + 5, y2 + 4);
      y2 += 17;
      const stats2 = [
        ['Peserta Selesai', `${selesaiList.length} siswa`],
        ['Rata-rata Kelas', String(rataRata)],
        ['Nilai Tertinggi', String(tertinggi)],
        ['Nilai Terendah', String(terendah)],
      ];
      doc.fillColor('#000000').font('Helvetica').fontSize(8.5);
      stats2.forEach(([k, v]) => {
        doc.font('Helvetica-Bold').text(k, LM + 5, y2, { continued: true });
        doc.font('Helvetica').text(` : ${v}`);
        y2 += 13;
      });

      // Tanda tangan
      const sigY = Math.max(y2 + 20, 510);
      doc.fontSize(8.5).font('Helvetica').text('Mengetahui,', LM + 560, sigY);
      doc.text('Guru Mata Pelajaran', LM + 560, sigY + 12);
      doc.moveTo(LM + 560, sigY + 55).lineTo(LM + 720, sigY + 55).stroke('#94A3B8');
      doc.text('(___________________)', LM + 560, sigY + 58);

      doc.end();
      return;
    }

    res.status(400).json({ error: 'Format tidak didukung' });
  } catch(error) { next(error); }
});

// Endpoint presensi lama dihapus — digantikan oleh sistem presensi baru
// (lihat server/routes/presensi.ts)

// ─────────────────────────────────────────────────────────────────────────────
// REQ-007: Input Absensi Siswa (Sakit/Izin/Alfa) oleh Guru
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/guru/absensi?tanggal=YYYY-MM-DD&kelasId=xxx
// Kembalikan daftar siswa di kelas + status kiosk + status absensi manual
router.get('/absensi', async (req, res, next) => {
  try {
    const scope = await resolveScope(req);
    const { tanggal, kelasId } = req.query as Record<string, string>;

    if (!kelasId) return res.status(400).json({ error: 'kelasId wajib diisi' });

    // Guru hanya bisa akses kelas yang diajarnya; admin bisa semua
    if (!scope.isAdmin && !scope.teachingKelasIds.includes(kelasId)) {
      return res.status(403).json({ error: 'Anda tidak memiliki akses ke kelas ini' });
    }

    const tgl = tanggal ? new Date(tanggal) : new Date();
    const start = new Date(tgl); start.setHours(0, 0, 0, 0);
    const end   = new Date(tgl); end.setDate(end.getDate() + 1); end.setHours(0, 0, 0, 0);

    const siswas = await prisma.siswa.findMany({
      where: { kelasId },
      select: { id: true, nama: true, nis: true, kelas: { select: { nama: true } } },
      orderBy: { nama: 'asc' },
    });

    const siswaIds = siswas.map(s => s.id);

    const [presensiList, absensiList] = await Promise.all([
      prisma.presensiSiswa.findMany({
        where: { siswaId: { in: siswaIds }, tanggal: { gte: start, lt: end } },
        select: { siswaId: true, waktuDatang: true },
      }),
      prisma.absensiSiswa.findMany({
        where: { siswaId: { in: siswaIds }, tanggal: { gte: start, lt: end } },
        select: { id: true, siswaId: true, status: true, keterangan: true },
      }),
    ]);

    const hadirMap = new Map(presensiList.map(p => [p.siswaId, p]));
    const absenMap = new Map(absensiList.map(a => [a.siswaId, a]));

    const result = siswas.map(s => {
      const kiosk   = hadirMap.get(s.id);
      const absensi = absenMap.get(s.id);
      return {
        siswaId: s.id,
        nama: s.nama,
        nis: s.nis,
        kelas: s.kelas.nama,
        statusKiosk: kiosk ? { hadir: true, waktu: kiosk.waktuDatang } : null,
        absensiId: absensi?.id || null,
        statusManual: absensi?.status || null,
        keterangan: absensi?.keterangan || null,
      };
    });

    res.json({ tanggal: tgl.toISOString().slice(0, 10), kelasId, siswaList: result });
  } catch (err) {
    next(err);
  }
});

// POST /api/guru/absensi
// Batch upsert absensi; entri dengan status null/HADIR akan dihapus (siswa hadir = tidak perlu record)
router.post('/absensi', async (req, res, next) => {
  try {
    const scope = await resolveScope(req);
    const { tanggal, kelasId, entries } = req.body as {
      tanggal: string;
      kelasId: string;
      entries: { siswaId: string; status: string | null; keterangan?: string }[];
    };

    if (!tanggal || !kelasId || !Array.isArray(entries)) {
      return res.status(400).json({ error: 'tanggal, kelasId, dan entries wajib diisi' });
    }

    if (!scope.isAdmin && !scope.teachingKelasIds.includes(kelasId)) {
      return res.status(403).json({ error: 'Anda tidak memiliki akses ke kelas ini' });
    }

    const tgl = new Date(tanggal); tgl.setHours(0, 0, 0, 0);
    const guruId = scope.guruId;

    const validStatuses = ['SAKIT', 'IZIN', 'ALFA'];
    let saved = 0;
    let deleted = 0;

    await prisma.$transaction(async (tx) => {
      for (const entry of entries) {
        // Jika status null atau 'HADIR', hapus record absensi jika ada
        if (!entry.status || entry.status === 'HADIR') {
          const del = await tx.absensiSiswa.deleteMany({
            where: { siswaId: entry.siswaId, tanggal: tgl },
          });
          deleted += del.count;
          continue;
        }

        if (!validStatuses.includes(entry.status)) continue;

        await tx.absensiSiswa.upsert({
          where: { siswaId_tanggal: { siswaId: entry.siswaId, tanggal: tgl } },
          create: {
            siswaId: entry.siswaId,
            guruId,
            tanggal: tgl,
            status: entry.status,
            keterangan: entry.keterangan || null,
          },
          update: {
            status: entry.status,
            keterangan: entry.keterangan || null,
            guruId,
          },
        });
        saved++;
      }
    });

    res.json({ saved, deleted });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// REQ-009: Toggle Ujian ke Dashboard Tugas
// ─────────────────────────────────────────────────────────────────────────────

router.patch('/ujian/:id/dashboard-toggle', async (req, res, next) => {
  try {
    const { masukkanKeDashboard, jenisNilai, materiNilai } = req.body as {
      masukkanKeDashboard: boolean; jenisNilai?: string; materiNilai?: string;
    };
    const ujian = await prisma.ujian.findUnique({ where: { id: req.params.id } });
    if (!ujian) return res.status(404).json({ error: 'Ujian tidak ditemukan' });
    const scope = await resolveScope(req);
    if (scope.guruId && ujian.guruId !== scope.guruId) {
      return res.status(403).json({ error: 'Bukan ujian Anda' });
    }
    if (masukkanKeDashboard && !jenisNilai) {
      return res.status(400).json({ error: 'Jenis nilai wajib diisi saat mengaktifkan dashboard' });
    }
    const updated = await prisma.ujian.update({
      where: { id: req.params.id },
      data: {
        masukkanKeDashboard: !!masukkanKeDashboard,
        jenisNilai: masukkanKeDashboard ? (jenisNilai || null) : null,
        materiNilai: masukkanKeDashboard ? (materiNilai || null) : null,
      },
    });
    invalidateByPrefix('pub:dashboard:tugas');
    res.json(updated);
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// REQ-009: Kolom Nilai Manual (Guru)
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/guru/kolom-nilai — list kolom nilai milik guru
router.get('/kolom-nilai', async (req, res, next) => {
  try {
    const scope = await resolveScope(req);
    const list = await prisma.kolomNilai.findMany({
      where: scope.guruId ? { guruId: scope.guruId } : {},
      include: {
        kelasTarget: { include: { kelas: { select: { id: true, nama: true } } } },
        _count: { select: { nilai: true } },
        ...(scope.isAdmin ? { guru: { select: { nama: true, nip: true } } } : {}),
      },
      orderBy: { tanggal: 'desc' },
    });
    res.json(list);
  } catch (err) { next(err); }
});

// POST /api/guru/kolom-nilai — tambah kolom nilai baru
router.post('/kolom-nilai', async (req, res, next) => {
  try {
    const { judul, jenis, materi, mataPelajaran, tanggal, kelasIds } = req.body as {
      judul: string; jenis: string; materi: string; mataPelajaran: string; tanggal: string; kelasIds: string[];
    };
    if (!judul?.trim()) return res.status(400).json({ error: 'Judul wajib diisi' });
    if (!jenis)         return res.status(400).json({ error: 'Jenis tugas wajib dipilih' });
    if (!materi?.trim()) return res.status(400).json({ error: 'Materi/bab wajib diisi' });
    if (!mataPelajaran?.trim()) return res.status(400).json({ error: 'Mata pelajaran wajib diisi' });
    if (!Array.isArray(kelasIds) || kelasIds.length === 0) return res.status(400).json({ error: 'Pilih minimal 1 kelas' });

    const scope  = await resolveScope(req);
    const guruId = scope.guruId || (req as any).user.profileId;

    const created = await prisma.kolomNilai.create({
      data: {
        judul: judul.trim(),
        jenis,
        materi: materi.trim(),
        mataPelajaran: mataPelajaran.trim(),
        tanggal: tanggal ? new Date(tanggal) : new Date(),
        guruId,
        kelasTarget: {
          create: kelasIds.map((kelasId: string) => ({ kelasId })),
        },
      },
      include: { kelasTarget: { include: { kelas: { select: { id: true, nama: true } } } } },
    });
    invalidateByPrefix('pub:dashboard:tugas');
    res.status(201).json(created);
  } catch (err) { next(err); }
});

// PATCH /api/guru/kolom-nilai/:id — edit kolom nilai
router.patch('/kolom-nilai/:id', async (req, res, next) => {
  try {
    const kolom = await prisma.kolomNilai.findUnique({ where: { id: req.params.id } });
    if (!kolom) return res.status(404).json({ error: 'Kolom nilai tidak ditemukan' });
    const scope = await resolveScope(req);
    if (scope.guruId && kolom.guruId !== scope.guruId) return res.status(403).json({ error: 'Bukan kolom Anda' });

    const { judul, jenis, materi, mataPelajaran, tanggal, kelasIds } = req.body as {
      judul?: string; jenis?: string; materi?: string; mataPelajaran?: string; tanggal?: string; kelasIds?: string[];
    };

    const updated = await prisma.kolomNilai.update({
      where: { id: req.params.id },
      data: {
        ...(judul          ? { judul: judul.trim() }               : {}),
        ...(jenis          ? { jenis }                             : {}),
        ...(materi         ? { materi: materi.trim() }             : {}),
        ...(mataPelajaran  ? { mataPelajaran: mataPelajaran.trim() } : {}),
        ...(tanggal        ? { tanggal: new Date(tanggal) }        : {}),
        ...(Array.isArray(kelasIds) ? {
          kelasTarget: {
            deleteMany: {},
            create: kelasIds.map((kelasId: string) => ({ kelasId })),
          },
        } : {}),
      },
      include: { kelasTarget: { include: { kelas: { select: { id: true, nama: true } } } } },
    });
    invalidateByPrefix('pub:dashboard:tugas');
    res.json(updated);
  } catch (err) { next(err); }
});

// DELETE /api/guru/kolom-nilai/:id — hapus kolom nilai
router.delete('/kolom-nilai/:id', async (req, res, next) => {
  try {
    const kolom = await prisma.kolomNilai.findUnique({ where: { id: req.params.id } });
    if (!kolom) return res.status(404).json({ error: 'Kolom nilai tidak ditemukan' });
    const scope = await resolveScope(req);
    if (scope.guruId && kolom.guruId !== scope.guruId) return res.status(403).json({ error: 'Bukan kolom Anda' });
    await prisma.kolomNilai.delete({ where: { id: req.params.id } });
    invalidateByPrefix('pub:dashboard:tugas');
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// GET /api/guru/kolom-nilai/:id/nilai — list siswa + nilai untuk kolom ini
router.get('/kolom-nilai/:id/nilai', async (req, res, next) => {
  try {
    const kolom = await prisma.kolomNilai.findUnique({
      where: { id: req.params.id },
      include: { kelasTarget: true },
    });
    if (!kolom) return res.status(404).json({ error: 'Kolom nilai tidak ditemukan' });
    const scope = await resolveScope(req);
    if (scope.guruId && kolom.guruId !== scope.guruId) return res.status(403).json({ error: 'Bukan kolom Anda' });

    const kelasIds = kolom.kelasTarget.map((k: any) => k.kelasId);
    const siswaList = await prisma.siswa.findMany({
      where: { kelasId: { in: kelasIds } },
      include: { kelas: { select: { id: true, nama: true } } },
      orderBy: [{ kelas: { nama: 'asc' } }, { nama: 'asc' }],
    });

    const nilaiList = await prisma.nilaiSiswa.findMany({
      where: { kolomNilaiId: req.params.id },
    });
    const nilaiMap = new Map(nilaiList.map((n: any) => [n.siswaId, n]));

    const rows = siswaList.map((siswa: any) => ({
      siswaId: siswa.id,
      nama: siswa.nama,
      nis: siswa.nis,
      kelas: siswa.kelas.nama,
      nilai: (nilaiMap.get(siswa.id) as any)?.nilai ?? null,
      keterangan: (nilaiMap.get(siswa.id) as any)?.keterangan ?? null,
      nilaiId: (nilaiMap.get(siswa.id) as any)?.id ?? null,
    }));

    res.json({ kolom, rows });
  } catch (err) { next(err); }
});

// POST /api/guru/kolom-nilai/:id/nilai — batch upsert nilai
router.post('/kolom-nilai/:id/nilai', async (req, res, next) => {
  try {
    const kolom = await prisma.kolomNilai.findUnique({ where: { id: req.params.id } });
    if (!kolom) return res.status(404).json({ error: 'Kolom nilai tidak ditemukan' });
    const scope = await resolveScope(req);
    if (scope.guruId && kolom.guruId !== scope.guruId) return res.status(403).json({ error: 'Bukan kolom Anda' });

    const { entries } = req.body as {
      entries: { siswaId: string; nilai: number | null; keterangan?: string }[];
    };
    if (!Array.isArray(entries)) return res.status(400).json({ error: 'entries harus berupa array' });

    const ops = entries.map(e => {
      if (e.nilai !== null && (isNaN(e.nilai) || e.nilai < 0 || e.nilai > 100)) {
        throw new Error(`Nilai tidak valid untuk siswa ${e.siswaId}`);
      }
      return prisma.nilaiSiswa.upsert({
        where: { kolomNilaiId_siswaId: { kolomNilaiId: req.params.id, siswaId: e.siswaId } },
        create: { kolomNilaiId: req.params.id, siswaId: e.siswaId, nilai: e.nilai, keterangan: e.keterangan || null },
        update: { nilai: e.nilai, keterangan: e.keterangan ?? undefined },
      });
    });

    const result = await prisma.$transaction(ops);
    invalidateByPrefix('pub:dashboard:tugas');
    res.json({ saved: result.length });
  } catch (err) { next(err); }
});

export default router;
