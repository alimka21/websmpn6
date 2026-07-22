/**
 * Zod validation middleware untuk Express.
 * Gunakan: router.post('/path', validate(SomeSchema), handler)
 *
 * - Pada sukses: req.body diganti dengan data yang sudah di-parse + coerce + default
 * - Pada gagal: langsung return 400 dengan pesan error pertama + semua errors
 */
import { ZodSchema, z } from 'zod';
import { Request, Response, NextFunction } from 'express';

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const issues = result.error.issues;
      const errors = issues.map((e: any) => ({
        field: (e.path as (string | number)[]).join('.') || 'body',
        message: e.message as string,
      }));
      return res.status(400).json({ error: errors[0].message, errors });
    }
    req.body = result.data;
    next();
  };
}

/* ─────────────────────────────────────────────────────────────────
   AUTH
───────────────────────────────────────────────────────────────── */
export const LoginSchema = z.object({
  identifier: z.string().min(1, 'Identifier wajib diisi'),
  password:   z.string().min(1, 'Password wajib diisi'),
  role:       z.enum(['SUPER_ADMIN', 'GURU', 'SISWA'], { message: 'Role tidak valid' }),
});

/* ─────────────────────────────────────────────────────────────────
   ADMIN — User Management
───────────────────────────────────────────────────────────────── */
export const CreateUserSchema = z.object({
  email:              z.string().email('Format email tidak valid').optional().nullable(),
  password:           z.string().min(6, 'Password minimal 6 karakter'),
  role:               z.enum(['SUPER_ADMIN', 'GURU', 'SISWA'], { message: 'Role harus SUPER_ADMIN, GURU, atau SISWA' }),
  nama:               z.string().min(1, 'Nama wajib diisi').max(100, 'Nama terlalu panjang'),
  nip:                z.string().max(30).optional().nullable(),
  mataPelajaran:      z.string().max(100).optional().nullable(),
  mataPelajaranList:  z.array(z.string().min(1)).optional(),
  nis:                z.string().max(20).optional().nullable(),
  rfidKode:           z.string().max(50).optional().nullable(),
  kelasId:            z.string().optional().nullable(),
});

export const UpdateUserSchema = z.object({
  email:              z.string().email('Format email tidak valid').optional(),
  isActive:           z.boolean().optional(),
  nama:               z.string().min(1, 'Nama tidak boleh kosong').max(100).optional(),
  nis:                z.string().max(20).optional().nullable(),
  rfidKode:           z.string().max(50).optional().nullable(),
  nip:                z.string().max(30).optional().nullable(),
  mataPelajaran:      z.string().max(100).optional().nullable(),
  mataPelajaranList:  z.array(z.string().min(1)).optional(),
  kelasId:            z.string().optional().nullable(),
});

export const BulkDeleteSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, 'Minimal 1 ID harus dipilih'),
});

export const ResetPasswordSchema = z.object({
  password: z.string().min(6, 'Password baru minimal 6 karakter'),
});

/* ─────────────────────────────────────────────────────────────────
   ADMIN — Kelas
───────────────────────────────────────────────────────────────── */
export const CreateKelasSchema = z.object({
  nama:        z.string().min(1, 'Nama kelas wajib diisi').max(50),
  tingkat:     z.string().min(1, 'Tingkat wajib diisi').max(20),
  tahunAjaran: z.string().min(1, 'Tahun ajaran wajib diisi').max(20),
  guruId:      z.string().min(1, 'Wali kelas wajib dipilih'),
});

export const UpdateKelasSchema = z.object({
  nama:        z.string().min(1).max(50).optional(),
  tingkat:     z.string().max(20).optional(),
  tahunAjaran: z.string().max(20).optional(),
  guruId:      z.string().optional().nullable(),
});

/* ─────────────────────────────────────────────────────────────────
   ADMIN — Logo Mitra
───────────────────────────────────────────────────────────────── */
export const CreateLogoMitraSchema = z.object({
  nama:     z.string().min(1, 'Nama mitra wajib diisi').max(100),
  imageUrl: z.string().min(1, 'URL gambar wajib diisi'),
  linkUrl:  z.string().url('Format URL tidak valid').optional().nullable(),
  urutan:   z.coerce.number().int().min(0).optional().default(0),
});

export const UpdateLogoMitraSchema = CreateLogoMitraSchema.partial();

/* ─────────────────────────────────────────────────────────────────
   GURU — Ujian
───────────────────────────────────────────────────────────────── */
export const CreateUjianSchema = z.object({
  judul:                z.string().min(1, 'Judul ujian wajib diisi').max(200),
  mataPelajaran:        z.string().min(1, 'Mata pelajaran wajib diisi').max(100),
  tipeUjian:            z.string().optional(),
  durasi:               z.coerce.number().int().min(1, 'Durasi minimal 1 menit').max(480, 'Durasi maksimal 8 jam'),
  tanggalMulai:         z.string().min(1, 'Waktu mulai wajib diisi'),
  tanggalSelesai:       z.string().min(1, 'Waktu selesai wajib diisi'),
  acak:                 z.boolean().optional().default(false),
  acakOpsi:             z.boolean().optional().default(false),
  tampilkanPembahasan:  z.boolean().optional().default(true),
  tampilkanNilai:       z.boolean().optional().default(true),
  kelasIds:             z.array(z.string()).optional().default([]),
  guruId:               z.string().optional(),
});

export const UpdateUjianSchema = z.object({
  judul:                z.string().min(1).max(200).optional(),
  mataPelajaran:        z.string().min(1).max(100).optional(),
  tipeUjian:            z.string().optional(),
  durasi:               z.coerce.number().int().min(1).max(480).optional(),
  tanggalMulai:         z.string().optional(),
  tanggalSelesai:       z.string().optional(),
  acak:                 z.boolean().optional(),
  acakOpsi:             z.boolean().optional(),
  tampilkanPembahasan:  z.boolean().optional(),
  tampilkanNilai:       z.boolean().optional(),
  kelasIds:             z.array(z.string()).optional(),
});

/* ─────────────────────────────────────────────────────────────────
   GURU — Soal
───────────────────────────────────────────────────────────────── */
const OpsiInputSchema = z.object({
  teks:       z.string().min(1, 'Teks opsi tidak boleh kosong'),
  benar:      z.boolean(),
  imageUrl:   z.string().optional().nullable(),
  pembahasan: z.string().optional().nullable(),
});

export const AddSoalSchema = z.object({
  teks:       z.string().min(1, 'Teks soal wajib diisi'),
  imageUrl:   z.string().optional().nullable(),
  tipe:       z.enum(
    ['PILIHAN_GANDA', 'PG_KOMPLEKS', 'BENAR_SALAH', 'ISIAN_SINGKAT', 'URAIAN_SINGKAT', 'ESAI'],
    { message: 'Tipe soal tidak valid' }
  ),
  opsi:       z.array(OpsiInputSchema).optional().default([]),
  poin:       z.coerce.number().int().min(0).max(100).optional().default(1),
  pembahasan: z.string().optional().nullable(),
  nomor:      z.coerce.number().int().min(1).optional(),
});

export const UpdateSoalSchema = AddSoalSchema.partial();

/* ─────────────────────────────────────────────────────────────────
   GURU — Koreksi Uraian
───────────────────────────────────────────────────────────────── */
export const KoreksiUraianSchema = z.object({
  penilaian: z.array(z.object({
    jawabanId:   z.string().min(1),
    nilaiUraian: z.number().min(1, 'Nilai minimal 1').max(10, 'Nilai maksimal 10'),
    catatanGuru: z.string().max(500).optional(),
  })).min(1, 'Data penilaian tidak boleh kosong'),
});

/* ─────────────────────────────────────────────────────────────────
   SISWA — Jawaban
───────────────────────────────────────────────────────────────── */
export const JawabSoalSchema = z.object({
  soalId:  z.string().min(1, 'ID soal wajib diisi'),
  opsiIds: z.array(z.string()).default([]),
});

export const SaveAnswersSchema = z.object({
  answers:     z.record(z.string(), z.array(z.string())).default({}),
  textAnswers: z.record(z.string(), z.string()).default({}),
});

/* ─────────────────────────────────────────────────────────────────
   PRESENSI — Guru & Siswa
───────────────────────────────────────────────────────────────── */
export const PresensiGuruSchema = z.object({
  guruId:    z.string().optional(),
  nip:       z.string().optional(),
  rfidKode:  z.string().optional(),
  latitude:  z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  fotoUrl:   z.string().optional().nullable(),
}).refine(
  d => !!(d.guruId || d.nip || d.rfidKode),
  { message: 'Salah satu dari guruId, nip, atau rfidKode wajib diisi' }
);

export const PresensiSiswaRfidSchema = z.object({
  siswaId:  z.string().optional(),
  nis:      z.string().optional(),
  rfidKode: z.string().optional(),
}).refine(
  d => !!(d.siswaId || d.nis || d.rfidKode),
  { message: 'Salah satu dari siswaId, nis, atau rfidKode wajib diisi' }
);
