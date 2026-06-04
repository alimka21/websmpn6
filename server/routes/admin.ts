// server/routes/admin.ts
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import ExcelJS from 'exceljs';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware';
import { getPaginationParams, buildPaginatedResult } from '../lib/pagination';
import { withCache, invalidateByPrefix } from '../lib/cache';
import { toTitleCase } from '../lib/format';

const router = Router();
router.use(requireAuth, requireRole(['SUPER_ADMIN']));

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
          siswa: { select: { id: true, nama: true, nis: true, kelasId: true, kelas: { select: { id: true, nama: true, tingkat: true, guru: { select: { id: true, nama: true } } } } } },
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

router.post('/users', async (req, res, next) => {
  try {
    const { email, password, role, nama, nip, mataPelajaran, mataPelajaranList, nis, kelasId } = req.body;

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
        ...(role === 'SISWA' ? { siswa: { create: { nama: toTitleCase(nama), nis, kelasId } } } : {})
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

router.patch('/users/:id', async (req, res, next) => {
  try {
    const { email, isActive, nama, nis, nip, mataPelajaran, mataPelajaranList, kelasId } = req.body;

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
            ...(kelasId && { kelasId })
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

        // Hapus kelas kosong (tanpa siswa) — cascade DB: guruKelas, ujianKelas
        await tx.kelas.deleteMany({ where: { guruId } });

        // Hapus semua ujian guru — cascade DB (onDelete: Cascade): sesiUjian → jawaban/pelanggaran,
        // soal → opsi/jawaban, ujianKelas
        await tx.ujian.deleteMany({ where: { guruId } });

        // Hapus user (cascade DB: guru → guruKelas, guruMataPelajaran)
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

router.post('/users/bulk-delete', async (req, res, next) => {
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
      ];
      ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      ws.getRow(1).eachCell(c => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
        c.alignment = { horizontal: 'center' };
      });
      // Contoh baris
      ws.addRow({ nis: '2025010', nama: 'Contoh Nama Siswa', kelas: kelas[0]?.nama ?? 'X IPA 1' });

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

      type SiswaRow = { rowNumber: number; nis: string; nama: string; kelasId: string; email: string };
      const valid: SiswaRow[] = [];

      for (let i = 0; i < items.length; i++) {
        const row = items[i];
        const rowNumber = i + 2;
        const nis = String(row.nis ?? '').trim();
        const nama = String(row.nama ?? '').trim();
        const kelasNama = String(row.kelas ?? '').trim();

        if (!nis || !nama || !kelasNama) {
          failed.push({ row: rowNumber, message: 'NIS, Nama, dan Nama Kelas wajib diisi' });
          continue;
        }
        const kelasId = kelasByNama.get(kelasNama.toLowerCase());
        if (!kelasId) {
          failed.push({ row: rowNumber, message: `Kelas "${kelasNama}" tidak ditemukan` });
          continue;
        }
        valid.push({ rowNumber, nis, nama, kelasId, email: `${nis}@siswa.sch.id` });
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

router.post('/users/:id/reset-password', async (req, res, next) => {
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

router.post('/kelas', async (req, res, next) => {
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

router.patch('/kelas/:id', async (req, res, next) => {
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
    const jumlahSiswa = await prisma.siswa.count({ where: { kelasId: req.params.id } });
    if (jumlahSiswa > 0) {
      return res.status(400).json({ error: `Tidak bisa menghapus kelas yang masih memiliki ${jumlahSiswa} siswa` });
    }
    await prisma.kelas.delete({ where: { id: req.params.id } });
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
        meta: p.waktuDatang ? new Date(p.waktuDatang).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '—',
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

    // Get jam masuk default
    const cfg = await prisma.pengaturanPresensi.findFirst();
    const jamMasukDefault = cfg?.jamMasukDefault || '07:00';

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
        const [jamMasuk, menitMasuk] = jamMasukDefault.split(':').map(Number);
        const targetMasuk = new Date(p.waktuDatang);
        targetMasuk.setHours(jamMasuk, menitMasuk, 0, 0);

        if (p.waktuDatang > targetMasuk) {
          keterlambatan = Math.floor((p.waktuDatang.getTime() - targetMasuk.getTime()) / 60_000);
        }

        if (p.waktuPulang) {
          totalJam = Math.floor((p.waktuPulang.getTime() - p.waktuDatang.getTime()) / 60_000);
        }
      }

      ws.addRow({
        no: idx + 1,
        tanggal: p.tanggal.toLocaleDateString('id-ID'),
        nama: p.guru.nama,
        nip: p.guru.nip,
        jamDatang: p.waktuDatang ? p.waktuDatang.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '—',
        jamPulang: p.waktuPulang ? p.waktuPulang.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '—',
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

    // Get jam masuk default
    const cfg = await prisma.pengaturanPresensi.findFirst();
    const jamMasukDefault = cfg?.jamMasukDefault || '07:00';

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
      let tepatWaktu = true;
      const [jamMasuk, menitMasuk] = jamMasukDefault.split(':').map(Number);
      const targetMasuk = new Date(p.waktuDatang);
      targetMasuk.setHours(jamMasuk, menitMasuk, 0, 0);

      if (p.waktuDatang > targetMasuk) {
        tepatWaktu = false;
      }

      ws.addRow({
        no: idx + 1,
        tanggal: p.tanggal.toLocaleDateString('id-ID'),
        nis: p.siswa.nis,
        nama: p.siswa.nama,
        kelas: p.siswa.kelas?.nama || '—',
        jamDatang: p.waktuDatang.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
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

export default router;
