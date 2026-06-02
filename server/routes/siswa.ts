// server/routes/siswa.ts
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { getPaginationParams, buildPaginatedResult } from '../lib/pagination';
import { requireAuth, requireRole } from '../middleware';

const router = Router();
router.use(requireAuth, requireRole(['SISWA']));

/**
 * Verifikasi sesi milik siswa yang login — 1 query via relasi siswa.userId.
 * Return sesi { id, status } kalau valid, null kalau bukan milik siswa /
 * tidak ada. Cegah siswa memanipulasi sesi siswa lain dgn tebak UUID.
 */
async function resolveOwnedSesi(req: any, sessionId: string) {
  return prisma.sesiUjian.findFirst({
    where: { id: sessionId, siswa: { userId: req.user.userId } },
    select: { id: true, status: true },
  });
}

router.get('/dashboard', async (req, res, next) => {
  try {
    const siswa = await prisma.siswa.findUnique({ where: { userId: (req.user as any).userId } });
    if (!siswa) return res.status(404).json({ error: 'Siswa tidak ditemukan' });

    const now = new Date();

    const ujianAktifRecords = await prisma.ujianKelas.findMany({
      where: {
        kelasId: siswa.kelasId,
        ujian: {
          tanggalMulai: { lte: now },
          tanggalSelesai: { gte: now }
        }
      },
      include: {
        ujian: {
          include: { 
            sesiUjian: { where: { siswaId: siswa.id } }
          }
        }
      }
    });

    const ujianAktif = ujianAktifRecords
      .filter((uk) => {
        const sesi = uk.ujian.sesiUjian[0];
        return !sesi || (sesi.status !== 'SELESAI' && sesi.status !== 'AUTO_SUBMIT');
      })
      .map(uk => uk.ujian);

    const sesiSelesai = await prisma.sesiUjian.findMany({
      where: {
        siswaId: siswa.id,
        status: { in: ['SELESAI', 'AUTO_SUBMIT'] }
      },
      include: { ujian: true }
    });

    const avg = sesiSelesai.length > 0 
      ? sesiSelesai.reduce((a, b) => a + (b.nilaiAkhir || 0), 0) / sesiSelesai.length 
      : 0;

    res.json({
      ujianAktif,
      ujianSelesai: sesiSelesai,
      rataRataNilai: Math.round(avg * 10) / 10
    });
  } catch (error) { next(error); }
});

router.get('/ujian-aktif', async (req, res, next) => {
  try {
    const siswa = await prisma.siswa.findUnique({ where: { userId: (req.user as any).userId } });
    const now = new Date();

    // Auto-submit sesi yg past-deadline (siswa tutup browser saat hampir
    // habis, atau admin reset → siswa start lagi). selesaiAt = exact
    // deadline supaya waktu tercatat pas.
    if (siswa) await autoSubmitExpiredSessions(siswa.id);

    const records = await prisma.ujianKelas.findMany({
      where: {
        kelasId: siswa?.kelasId,
        ujian: {
          tanggalMulai: { lte: now },
          tanggalSelesai: { gte: now }
        }
      },
      include: {
        ujian: {
          include: {
            sesiUjian: { where: { siswaId: siswa?.id } },
            _count: { select: { soal: true } },
          },
        },
      },
    });

    const result = records
      .filter((uk) => {
        const sesi = uk.ujian.sesiUjian[0];
        return !sesi || (sesi.status !== 'SELESAI' && sesi.status !== 'AUTO_SUBMIT');
      })
      .map(uk => uk.ujian);

    res.json(result);
  } catch(error) { next(error); }
});

router.post('/ujian/:ujianId/mulai', async (req, res, next) => {
  try {
    const siswa = await prisma.siswa.findUnique({ where: { userId: (req.user as any).userId } });
    if(!siswa) return res.status(404).json({error: 'Siswa not found'});

    // Auto-submit sesi siswa yg past-deadline sebelum start ujian baru
    await autoSubmitExpiredSessions(siswa.id);

    const ujian = await prisma.ujian.findUnique({ where: { id: req.params.ujianId } });
    if (!ujian) return res.status(404).json({ error: 'Ujian tidak ditemukan' });

    // Validate class
    const validKelas = await prisma.ujianKelas.findUnique({
      where: { ujianId_kelasId: { ujianId: ujian.id, kelasId: siswa.kelasId } }
    });
    if (!validKelas) return res.status(403).json({ error: 'Tidak dapat mengakses ujian ini.' });

    const now = new Date();
    if (ujian.tanggalMulai && now < ujian.tanggalMulai) {
      return res.status(400).json({ error: 'Ujian belum dimulai' });
    }
    if (ujian.tanggalSelesai && now > ujian.tanggalSelesai) {
      return res.status(400).json({ error: 'Waktu ujian sudah habis' });
    }

    let sesi = await prisma.sesiUjian.findUnique({
      where: { ujianId_siswaId: { ujianId: ujian.id, siswaId: siswa.id } }
    });

    if (!sesi) {
      sesi = await prisma.sesiUjian.create({
        data: {
          ujianId: ujian.id,
          siswaId: siswa.id,
          status: 'SEDANG_BERLANGSUNG',
          mulaiAt: now
        }
      });
    } else {
      if (sesi.status === 'BELUM_MULAI') {
        sesi = await prisma.sesiUjian.update({
          where: { id: sesi.id },
          data: { status: 'SEDANG_BERLANGSUNG', mulaiAt: now }
        });
      }
    }

    res.json({ sessionId: sesi.id });
  } catch(error) { next(error); }
});

router.get('/sesi/:sessionId', async (req, res, next) => {
  try {
    // Paralelkan kedua lookup — penghematan latency ~5-20ms di hot-path
    // ujian aktif. Validasi siswa.id === sesi.siswaId tetap di app code.
    const [siswa, sesi] = await Promise.all([
      prisma.siswa.findUnique({ where: { userId: (req.user as any).userId } }),
      prisma.sesiUjian.findUnique({
        where: { id: req.params.sessionId },
        include: {
          ujian: {
            include: {
              soal: {
                orderBy: { nomor: 'asc' },
                include: {
                  opsi: { orderBy: { urutan: 'asc' }, select: { id: true, teks: true, imageUrl: true, urutan: true } }
                }
              }
            }
          },
          jawaban: true
        }
      }),
    ]);

    if (!siswa) return res.status(404).json({ error: 'Not found' });

    if (!sesi || sesi.siswaId !== siswa.id) {
      return res.status(404).json({ error: 'Sesi tidak ditemukan atau akses ditolak' });
    }

    res.json({
      sesi: {
        id: sesi.id,
        status: sesi.status,
        // mulaiAt → frontend timer pakai absolute time (mulaiAt + durasi)
        // bukan countdown lokal. Cegah cache localStorage durasi lama.
        mulaiAt: sesi.mulaiAt,
        terjawab: sesi.jawaban
      },
      ujian: {
        judul: sesi.ujian.judul,
        mataPelajaran: sesi.ujian.mataPelajaran,
        durasi: sesi.ujian.durasi,
        acak: sesi.ujian.acak,
        acakOpsi: sesi.ujian.acakOpsi,
        soal: sesi.ujian.soal
      },
      siswa: {
        id: siswa.id,
        nama: siswa.nama,
        nis: siswa.nis,
      },
    });
  } catch(error) { next(error); }
});

/**
 * Batch save — terima semua jawaban sekaligus dalam 1 transaction.
 * Dipakai client saat submit (flush localStorage) supaya tidak spam
 * N koneksi DB paralel yang bikin pool timeout.
 */
router.post('/sesi/:sessionId/jawab-batch', async (req, res, next) => {
  try {
    const sessionId = req.params.sessionId;

    // Verifikasi kepemilikan + sesi masih aktif (tolak setelah submit)
    const sesi = await resolveOwnedSesi(req, sessionId);
    if (!sesi) return res.status(404).json({ error: 'Sesi tidak ditemukan atau akses ditolak' });
    if (sesi.status === 'SELESAI' || sesi.status === 'AUTO_SUBMIT') {
      return res.status(409).json({ error: 'Ujian sudah selesai, jawaban tidak dapat diubah' });
    }

    const answers = (req.body?.answers ?? {}) as Record<string, string[]>;
    const textAnswers = (req.body?.textAnswers ?? {}) as Record<string, string>;

    const opsiEntries = Object.entries(answers).filter(
      ([, ids]) => Array.isArray(ids) && ids.length > 0
    );
    const teksEntries = Object.entries(textAnswers).filter(
      ([, teks]) => typeof teks === 'string' && teks.trim().length > 0
    );

    if (opsiEntries.length === 0 && teksEntries.length === 0) {
      return res.json({ success: true, saved: 0 });
    }

    const allSoalIds = [
      ...opsiEntries.map(([sid]) => sid),
      ...teksEntries.map(([sid]) => sid),
    ];

    const opsiData = opsiEntries.flatMap(([soalId, opsiIds]) =>
      (opsiIds as string[]).map((opsiId) => ({
        sesiId: sessionId, soalId, opsiId, isBenar: false,
      }))
    );
    const teksData = teksEntries.map(([soalId, teks]) => ({
      sesiId: sessionId, soalId, opsiId: null, isBenar: false,
      jawabanTeks: teks.trim(),
    }));

    await prisma.$transaction([
      prisma.jawaban.deleteMany({
        where: { sesiId: sessionId, soalId: { in: allSoalIds } },
      }),
      prisma.jawaban.createMany({ data: [...opsiData, ...teksData] }),
    ]);

    res.json({ success: true, saved: opsiData.length + teksData.length });
  } catch (error) { next(error); }
});

router.post('/sesi/:sessionId/jawab', async (req, res, next) => {
  try {
    // Verifikasi kepemilikan + sesi masih aktif
    const sesi = await resolveOwnedSesi(req, req.params.sessionId);
    if (!sesi) return res.status(404).json({ error: 'Sesi tidak ditemukan atau akses ditolak' });
    if (sesi.status === 'SELESAI' || sesi.status === 'AUTO_SUBMIT') {
      return res.status(409).json({ error: 'Ujian sudah selesai, jawaban tidak dapat diubah' });
    }

    const { soalId, opsiIds } = req.body;
    if (!opsiIds || opsiIds.length === 0) return res.json({ success: true }); // No answer selected

    await prisma.jawaban.deleteMany({
      where: { sesiId: req.params.sessionId, soalId }
    });

    // Strategy 1: insert multiple record if PG_KOMPLEKS, but our model Jawaban has relation per `opsiId`
    // If opsis are multiple, we create multiple Jawaban records
    await prisma.jawaban.createMany({
      data: opsiIds.map((id: string) => ({
        sesiId: req.params.sessionId,
        soalId,
        opsiId: id,
        isBenar: false // It will be recalculated later upon submit
      }))
    });

    res.json({ success: true });
  } catch(error) { next(error); }
});

/**
 * Compute nilai + update SesiUjian → SELESAI/AUTO_SUBMIT.
 * Dipakai oleh route POST /submit dan auto-submit expired (timeout).
 *
 * @param sesiId   ID sesi yg disubmit
 * @param reason   'manual' | 'timeout' | 'auto_cheat'
 * @param overrideSelesaiAt  kalau ada, pakai timestamp ini (untuk auto-
 *                            submit expired pakai exact deadline mulaiAt+durasi)
 */
async function computeAndSaveSubmit(
  sesiId: string,
  reason: string,
  overrideSelesaiAt?: Date,
) {
  const sesi = await prisma.sesiUjian.findUnique({
    where: { id: sesiId },
    include: {
      ujian: { include: { soal: { include: { opsi: true } } } },
      jawaban: true,
    },
  });
  if (!sesi) return { ok: false, error: 'Sesi tidak ditemukan' as const };
  if (sesi.status === 'SELESAI' || sesi.status === 'AUTO_SUBMIT') {
    return { ok: false, error: 'Sesi sudah disubmit' as const };
  }

  let totalPoin = 0;
  let poinBenar = 0;
  const soalBenarIds: string[] = [];

  for (const soal of sesi.ujian.soal) {
    totalPoin += soal.poin;
    const isUraian = soal.tipe === 'URAIAN_SINGKAT' || soal.tipe === 'ESAI';

    if (isUraian) {
      // Uraian/esai tidak di-auto-score saat submit — tunggu koreksi guru.
      // nilaiUraian akan diisi guru via endpoint koreksi, lalu nilaiAkhir
      // di-recompute. Sementara itu, poin uraian dianggap 0.
      const jwb = sesi.jawaban.find(j => j.soalId === soal.id);
      if (jwb?.nilaiUraian != null) {
        poinBenar += (jwb.nilaiUraian / 10) * soal.poin;
      }
      continue;
    }

    const jawabanUser = sesi.jawaban.filter(j => j.soalId === soal.id).map(j => j.opsiId);
    const opsiBenar = soal.opsi.filter(o => o.benar).map(o => o.id);

    let isBenar = false;
    if (soal.tipe === 'PILIHAN_GANDA' || soal.tipe === 'BENAR_SALAH') {
      isBenar = jawabanUser.length === 1 && jawabanUser[0] === opsiBenar[0];
    } else if (soal.tipe === 'PG_KOMPLEKS') {
      const setBenar = new Set(opsiBenar);
      const setJawab = new Set(jawabanUser.filter(Boolean) as string[]);
      isBenar = setBenar.size === setJawab.size && [...setBenar].every(id => setJawab.has(id));
    }
    if (isBenar) {
      poinBenar += soal.poin;
      soalBenarIds.push(soal.id);
    }
  }

  const nilaiAkhir = totalPoin > 0 ? (poinBenar / totalPoin) * 100 : 0;
  // AUTO_SUBMIT untuk timeout (waktu habis) atau pelanggaran (auto_cheat)
  const finalStatus =
    reason === 'auto_cheat' || reason === 'timeout' ? 'AUTO_SUBMIT' : 'SELESAI';

  if (soalBenarIds.length > 0) {
    await prisma.jawaban.updateMany({
      where: { sesiId: sesi.id, soalId: { in: soalBenarIds } },
      data: { isBenar: true },
    });
  }

  await prisma.sesiUjian.update({
    where: { id: sesi.id },
    data: {
      status: finalStatus,
      selesaiAt: overrideSelesaiAt ?? new Date(),
      nilaiRaw: poinBenar,
      nilaiAkhir: Math.round(nilaiAkhir * 100) / 100,
      submitReason: reason || 'manual',
    },
  });

  return { ok: true, nilaiAkhir, poinBenar, totalPoin };
}

/**
 * Auto-submit sesi siswa yg sudah past-deadline (mulaiAt + durasi*60s < now).
 * Dipanggil sebelum list/mulai ujian supaya:
 *   1. Sesi yg siswa tutup browser sebelum deadline tetap tersubmit
 *   2. selesaiAt = exact deadline (bukan now), supaya "waktu tercatat pas"
 *   3. nilai berdasarkan jawaban yg sempat tersimpan
 */
async function autoSubmitExpiredSessions(siswaId: string) {
  const now = new Date();
  const expired = await prisma.sesiUjian.findMany({
    where: {
      siswaId,
      status: { in: ['BELUM_MULAI', 'SEDANG_BERLANGSUNG'] },
      mulaiAt: { not: null },
    },
    include: { ujian: { select: { durasi: true } } },
  });

  for (const s of expired) {
    if (!s.mulaiAt) continue;
    const deadlineMs = s.mulaiAt.getTime() + s.ujian.durasi * 60 * 1000;
    if (deadlineMs <= now.getTime()) {
      // submit otomatis dgn selesaiAt = exact deadline
      await computeAndSaveSubmit(s.id, 'timeout', new Date(deadlineMs));
    }
  }
}

router.post('/sesi/:sessionId/submit', async (req, res, next) => {
  try {
    // Verifikasi kepemilikan sebelum submit — cegah siswa men-submit paksa
    // sesi siswa lain. (computeAndSaveSubmit dipakai juga oleh auto-submit
    // internal yg sudah ter-scope siswaId, jadi guard cukup di route ini.)
    const owned = await resolveOwnedSesi(req, req.params.sessionId);
    if (!owned) return res.status(404).json({ error: 'Sesi tidak ditemukan atau akses ditolak' });

    const reason = (req.query.reason as string) || req.body.reason || 'manual';
    const result = await computeAndSaveSubmit(req.params.sessionId, reason);
    if (!result.ok) {
      const status = result.error === 'Sesi tidak ditemukan' ? 404 : 400;
      return res.status(status).json({ error: result.error });
    }
    res.json({
      success: true,
      nilaiAkhir: result.nilaiAkhir,
      benar: result.poinBenar,
      total: result.totalPoin,
    });
  } catch(error) { next(error); }
});

router.post('/sesi/:sessionId/violation', async (req, res, next) => {
  try {
    // Verifikasi kepemilikan — cegah siswa menyuntik pelanggaran palsu ke
    // sesi siswa lain (mis. menggugurkan nilai temannya).
    const owned = await resolveOwnedSesi(req, req.params.sessionId);
    if (!owned) return res.status(404).json({ error: 'Sesi tidak ditemukan atau akses ditolak' });

    // Tolak pelanggaran jika sesi sudah selesai — mencegah violation yang
    // dikirim in-flight saat page navigasi keluar (setelah submit) dari
    // tersimpan ke DB dan menyebabkan data tidak konsisten.
    if (owned.status !== 'BERLANGSUNG') {
      return res.json({ success: true, ignored: true });
    }

    const { tipe, pesan } = req.body;
    await prisma.pelanggaran.create({
      data: {
        sesiId: req.params.sessionId,
        tipe, pesan, timestamp: new Date()
      }
    });
    res.json({ success: true });
  } catch(error) { next(error); }
});

router.get('/sesi/:sessionId/hasil', async (req, res, next) => {
  try {
    const siswa = await prisma.siswa.findUnique({ where: { userId: (req.user as any).userId } });
    if (!siswa) return res.status(404).json({ error: 'Tidak ditemukan' });

    // Single query — soal+opsi ditarik via nested include di sesi.ujian,
    // jawaban hanya butuh opsi (mapping ke soal pakai soalId, bukan relasi).
    const sesi = await prisma.sesiUjian.findUnique({
      where: { id: req.params.sessionId },
      include: {
        siswa: { select: { nama: true } },
        ujian: {
          select: {
            judul: true,
            mataPelajaran: true,
            durasi: true,
            tampilkanPembahasan: true,
            tampilkanNilai: true,
            soal: {
              orderBy: { nomor: 'asc' },
              include: { opsi: { orderBy: { urutan: 'asc' } } },
            },
          },
        },
        pelanggaran: { orderBy: { timestamp: 'asc' } },
        jawaban: { include: { opsi: true }, orderBy: { soalId: 'asc' } },
      }
    });

    if (!sesi || sesi.siswaId !== siswa.id) {
      return res.status(404).json({ error: 'Sesi tidak ditemukan atau akses ditolak' });
    }

    // CRITICAL: hasil (termasuk kunci jawaban) HANYA boleh dibuka setelah
    // ujian selesai. Tanpa guard ini siswa bisa fetch endpoint ini saat
    // ujian masih berlangsung (sessionId ada di URL mereka) → lihat kunci
    // jawaban → balik ke ujian & jawab benar semua.
    if (sesi.status !== 'SELESAI' && sesi.status !== 'AUTO_SUBMIT') {
      return res.status(403).json({ error: 'Hasil hanya bisa dilihat setelah ujian selesai' });
    }

    const soalList = sesi.ujian.soal;

    // Group jawaban by soalId — PG_KOMPLEKS bisa punya >1 row per soal.
    const jawabanBySoal = new Map<string, typeof sesi.jawaban>();
    for (const j of sesi.jawaban) {
      const arr = jawabanBySoal.get(j.soalId);
      if (arr) arr.push(j);
      else jawabanBySoal.set(j.soalId, [j]);
    }

    const jawabanDetail = soalList.map(soal => {
      const jwbList = jawabanBySoal.get(soal.id) || [];
      const isUraian = soal.tipe === 'URAIAN_SINGKAT' || soal.tipe === 'ESAI';

      if (isUraian) {
        const jwb = jwbList[0];
        return {
          nomor: soal.nomor,
          teks: soal.teks,
          tipe: soal.tipe,
          poin: soal.poin,
          jawabanTeks: jwb?.jawabanTeks ?? null,
          nilaiUraian: jwb?.nilaiUraian ?? null,
          catatanGuru: jwb?.catatanGuru ?? null,
          tidakDijawab: !jwb?.jawabanTeks,
          // Tidak ada isBenar untuk uraian
          opsiDipilih: null, opsiBenar: null, opsiDipilihList: [], opsiBenarList: [],
          isBenar: false,
        };
      }

      const opsiBenarList = soal.opsi.filter(o => o.benar);
      const opsiDipilihList = jwbList
        .map(j => j.opsi ? { teks: j.opsi.teks } : null)
        .filter((x): x is { teks: string } => x !== null);
      const isBenar = jwbList.length > 0 ? jwbList[0].isBenar : false;
      return {
        nomor: soal.nomor,
        teks: soal.teks,
        tipe: soal.tipe,
        poin: soal.poin,
        opsiDipilih: opsiDipilihList[0] || null,
        opsiBenar: opsiBenarList[0] ? { teks: opsiBenarList[0].teks } : null,
        opsiDipilihList,
        opsiBenarList: opsiBenarList.map(o => ({ teks: o.teks })),
        isBenar,
        tidakDijawab: jwbList.length === 0,
        jawabanTeks: null, nilaiUraian: null, catatanGuru: null,
      };
    });

    const adaUraian = soalList.some(s => s.tipe === 'URAIAN_SINGKAT' || s.tipe === 'ESAI');
    const semuaUraianDinilai = adaUraian && soalList
      .filter(s => s.tipe === 'URAIAN_SINGKAT' || s.tipe === 'ESAI')
      .every(s => {
        const jwb = (jawabanBySoal.get(s.id) || [])[0];
        return jwb?.nilaiUraian != null;
      });

    res.json({
      id: sesi.id,
      status: sesi.status,
      nilaiAkhir: sesi.nilaiAkhir,
      submitReason: sesi.submitReason,
      mulaiAt: sesi.mulaiAt,
      selesaiAt: sesi.selesaiAt,
      jumlahBenar: jawabanDetail.filter(j => j.isBenar).length,
      totalSoal: soalList.length,
      adaUraian,
      semuaUraianDinilai: adaUraian ? semuaUraianDinilai : null,
      siswa: sesi.siswa,
      ujian: sesi.ujian,
      pelanggaran: sesi.pelanggaran,
      jawaban: jawabanDetail
    });
  } catch(error) { next(error); }
});

router.get('/riwayat-nilai', async (req, res, next) => {
  try {
    const siswa = await prisma.siswa.findUnique({ where: { userId: (req.user as any).userId } });
    if (!siswa) return res.json([]);

    const sesiList = await prisma.sesiUjian.findMany({
      where: { siswaId: siswa.id, status: { in: ['SELESAI', 'AUTO_SUBMIT'] } },
      include: {
        ujian: {
          select: {
            judul: true, mataPelajaran: true, tipeUjian: true,
            soal: { select: { tipe: true } },
          },
        },
      },
      orderBy: { selesaiAt: 'desc' },
    });

    // Kelompokkan per mata pelajaran
    const byMapel: Record<string, any[]> = {};
    for (const sesi of sesiList) {
      const mapel = sesi.ujian.mataPelajaran;
      if (!byMapel[mapel]) byMapel[mapel] = [];
      const adaUraian = sesi.ujian.soal.some((s: any) => s.tipe === 'URAIAN_SINGKAT' || s.tipe === 'ESAI');
      byMapel[mapel].push({
        sesiId: sesi.id,
        ujianJudul: sesi.ujian.judul,
        tipeUjian: sesi.ujian.tipeUjian,
        nilaiAkhir: sesi.nilaiAkhir,
        selesaiAt: sesi.selesaiAt,
        adaUraian,
      });
    }

    const result = Object.entries(byMapel).map(([mataPelajaran, ujian]) => {
      const nilaiValid = ujian.filter(u => u.nilaiAkhir !== null && u.nilaiAkhir !== undefined);
      const rataRata = nilaiValid.length > 0
        ? Math.round((nilaiValid.reduce((a: number, u: any) => a + u.nilaiAkhir, 0) / nilaiValid.length) * 100) / 100
        : null;
      return { mataPelajaran, rataRata, jumlahUjian: ujian.length, ujian };
    });

    res.json(result);
  } catch (error) { next(error); }
});

router.get('/hasil', async (req, res, next) => {
  try {
    const siswa = await prisma.siswa.findUnique({ where: { userId: (req.user as any).userId } });
    const { page, limit, skip } = getPaginationParams(req.query);
    const where = { siswaId: siswa?.id, status: { in: ['SELESAI', 'AUTO_SUBMIT'] } };
    const [sesi, total] = await prisma.$transaction([
      prisma.sesiUjian.findMany({
        where,
        skip, take: limit,
        include: { ujian: { select: { judul: true, mataPelajaran: true, durasi: true } } },
        orderBy: { selesaiAt: 'desc' },
      }),
      prisma.sesiUjian.count({ where }),
    ]);
    res.json(buildPaginatedResult(sesi, total, page, limit));
  } catch(error) { next(error); }
});

export default router;
