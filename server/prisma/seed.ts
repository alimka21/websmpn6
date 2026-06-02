// server/prisma/seed.ts
// Seed data awal: 1 admin, 2 guru, 3 kelas, 6 siswa, 1 ujian + soal, 3 berita, 4 alumni
// Jalankan: npx prisma db seed

import { PrismaClient } from '../generated/prisma/client';
import bcrypt from 'bcryptjs';

// Bisa di-import dan dipanggil dari server.ts (pass prisma client),
// atau dijalankan standalone via `npx prisma db seed` (buat client baru).
export async function runSeed(prismaArg?: PrismaClient) {
  const prisma = prismaArg ?? new PrismaClient();
  const ownPrisma = !prismaArg;
  try {
    await main(prisma);
  } finally {
    if (ownPrisma) await prisma.$disconnect();
  }
}

async function main(prisma: PrismaClient) {
  console.log('🌱 Memulai seed database...');

  // ============ ADMIN ============
  const adminPass = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@sekolah.sch.id' },
    update: {},
    create: {
      email: 'admin@sekolah.sch.id',
      password: adminPass,
      role: 'SUPER_ADMIN',
      admin: { create: { nama: 'Administrator Sekolah' } },
    },
  });
  console.log(`✓ Admin: ${admin.email} (password: admin123)`);

  // ============ GURU ============
  const guruPass = await bcrypt.hash('guru123', 10);

  const guru1User = await prisma.user.upsert({
    where: { email: 'budi@sekolah.sch.id' },
    update: {},
    create: {
      email: 'budi@sekolah.sch.id',
      password: guruPass,
      role: 'GURU',
      guru: { create: { nip: '198501012010011001', nama: 'Budi Santoso, S.Pd', mataPelajaran: 'Matematika' } },
    },
    include: { guru: true },
  });

  const guru2User = await prisma.user.upsert({
    where: { email: 'siti@sekolah.sch.id' },
    update: {},
    create: {
      email: 'siti@sekolah.sch.id',
      password: guruPass,
      role: 'GURU',
      guru: { create: { nip: '198703152011012002', nama: 'Siti Aminah, M.Pd', mataPelajaran: 'Bahasa Indonesia' } },
    },
    include: { guru: true },
  });

  console.log(`✓ Guru: ${guru1User.email}, ${guru2User.email} (password: guru123)`);

  // ============ KELAS ============
  const kelas10A = await prisma.kelas.upsert({
    where: { id: 'seed-kelas-10a' },
    update: {},
    create: { id: 'seed-kelas-10a', nama: 'X IPA 1', tingkat: '10', tahunAjaran: '2025/2026', guruId: guru1User.guru!.id },
  });
  const kelas10B = await prisma.kelas.upsert({
    where: { id: 'seed-kelas-10b' },
    update: {},
    create: { id: 'seed-kelas-10b', nama: 'X IPA 2', tingkat: '10', tahunAjaran: '2025/2026', guruId: guru1User.guru!.id },
  });
  const kelas11A = await prisma.kelas.upsert({
    where: { id: 'seed-kelas-11a' },
    update: {},
    create: { id: 'seed-kelas-11a', nama: 'XI IPA 1', tingkat: '11', tahunAjaran: '2025/2026', guruId: guru2User.guru!.id },
  });

  console.log(`✓ Kelas: ${kelas10A.nama}, ${kelas10B.nama}, ${kelas11A.nama}`);

  // ============ SISWA ============
  const siswaPass = await bcrypt.hash('siswa123', 10);
  const siswaData = [
    { nis: '2025001', nama: 'Ahmad Fauzi', kelasId: kelas10A.id },
    { nis: '2025002', nama: 'Bunga Lestari', kelasId: kelas10A.id },
    { nis: '2025003', nama: 'Citra Dewi', kelasId: kelas10A.id },
    { nis: '2025004', nama: 'Dimas Pratama', kelasId: kelas10B.id },
    { nis: '2025005', nama: 'Eka Wahyuni', kelasId: kelas10B.id },
    { nis: '2024001', nama: 'Fahri Hidayat', kelasId: kelas11A.id },
  ];

  for (const s of siswaData) {
    await prisma.user.upsert({
      where: { email: `${s.nis}@siswa.sch.id` },
      update: {},
      create: {
        email: `${s.nis}@siswa.sch.id`,
        password: siswaPass,
        role: 'SISWA',
        siswa: { create: { nis: s.nis, nama: s.nama, kelasId: s.kelasId } },
      },
    });
  }
  console.log(`✓ Siswa: ${siswaData.length} akun (password: siswa123, login pakai NIS)`);

  // ============ UJIAN + SOAL ============
  const existingUjian = await prisma.ujian.findFirst({ where: { id: 'seed-ujian-mtk-1' } });
  if (!existingUjian) {
    await prisma.ujian.create({
      data: {
        id: 'seed-ujian-mtk-1',
        judul: 'Ulangan Harian Matematika - Bab Aljabar',
        mataPelajaran: 'Matematika',
        tipeUjian: 'ULANGAN_HARIAN',
        durasi: 60,
        tanggalMulai: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        tanggalSelesai: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        acak: false,
        guruId: guru1User.guru!.id,
        kelas: {
          create: [
            { kelasId: kelas10A.id },
            { kelasId: kelas10B.id },
          ],
        },
        soal: {
          create: [
            {
              nomor: 1,
              teks: 'Berapakah hasil dari 2x + 3 jika x = 5?',
              tipe: 'PILIHAN_GANDA',
              poin: 25,
              opsi: {
                create: [
                  { teks: '10', urutan: 1, benar: false },
                  { teks: '13', urutan: 2, benar: true },
                  { teks: '15', urutan: 3, benar: false },
                  { teks: '8', urutan: 4, benar: false },
                ],
              },
            },
            {
              nomor: 2,
              teks: 'Selesaikan persamaan: 3x - 6 = 12. Berapa nilai x?',
              tipe: 'PILIHAN_GANDA',
              poin: 25,
              opsi: {
                create: [
                  { teks: '4', urutan: 1, benar: false },
                  { teks: '5', urutan: 2, benar: false },
                  { teks: '6', urutan: 3, benar: true },
                  { teks: '7', urutan: 4, benar: false },
                ],
              },
            },
            {
              nomor: 3,
              teks: 'Manakah pernyataan yang BENAR tentang persamaan linear? (pilih semua yang sesuai)',
              tipe: 'PG_KOMPLEKS',
              poin: 25,
              opsi: {
                create: [
                  { teks: 'Pangkat variabel tertinggi adalah 1', urutan: 1, benar: true },
                  { teks: 'Selalu memiliki satu solusi unik', urutan: 2, benar: false },
                  { teks: 'Dapat digambarkan sebagai garis lurus', urutan: 3, benar: true },
                  { teks: 'Bentuk umumnya ax + b = 0', urutan: 4, benar: true },
                ],
              },
            },
            {
              nomor: 4,
              teks: 'Persamaan 2(x + 3) = 2x + 6 adalah persamaan identitas.',
              tipe: 'BENAR_SALAH',
              poin: 25,
              opsi: {
                create: [
                  { teks: 'Benar', urutan: 1, benar: true },
                  { teks: 'Salah', urutan: 2, benar: false },
                ],
              },
            },
          ],
        },
      },
    });
    console.log(`✓ Ujian: Ulangan Harian Matematika - Bab Aljabar (4 soal, 2 kelas)`);
  } else {
    console.log(`✓ Ujian sample sudah ada, skip.`);
  }

  // ============ BERITA ============
  const beritaData = [
    {
      slug: 'penerimaan-peserta-didik-baru-2026',
      judul: 'Pengumuman Penerimaan Peserta Didik Baru Tahun Ajaran 2026/2027',
      ringkasan: 'Pendaftaran PPDB dibuka mulai 1 Juni 2026. Silakan persiapkan dokumen yang dibutuhkan.',
      konten: 'Sekolah membuka pendaftaran Peserta Didik Baru (PPDB) untuk Tahun Ajaran 2026/2027 mulai tanggal 1 Juni 2026 hingga 30 Juni 2026. Persyaratan: fotokopi ijazah, kartu keluarga, akta lahir, dan pas foto 3x4 sebanyak 2 lembar. Informasi lebih lanjut hubungi panitia PPDB di kantor TU.',
      status: 'PUBLISHED',
      publishedAt: new Date(),
    },
    {
      slug: 'jadwal-ujian-tengah-semester-genap',
      judul: 'Jadwal Ujian Tengah Semester Genap 2025/2026',
      ringkasan: 'UTS Semester Genap akan dilaksanakan tanggal 18-22 Mei 2026 secara serentak untuk seluruh tingkat.',
      konten: 'Sehubungan dengan akhir paruh semester genap, Ujian Tengah Semester (UTS) akan dilaksanakan pada tanggal 18 hingga 22 Mei 2026. Seluruh siswa wajib hadir minimal 15 menit sebelum ujian dimulai. Jadwal lengkap dapat diunduh di portal akademik.',
      status: 'PUBLISHED',
      publishedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    },
    {
      slug: 'juara-olimpiade-matematika-tingkat-provinsi',
      judul: 'Siswa Kami Raih Juara 1 Olimpiade Matematika Tingkat Provinsi',
      ringkasan: 'Ananda Fahri Hidayat (kelas XI IPA 1) berhasil meraih medali emas pada OSP Matematika 2026.',
      konten: 'Selamat dan sukses kepada Ananda Fahri Hidayat dari kelas XI IPA 1 yang berhasil meraih medali emas dalam Olimpiade Sains Provinsi (OSP) bidang Matematika tahun 2026. Prestasi ini menambah deretan capaian akademik sekolah kita di tingkat regional.',
      status: 'PUBLISHED',
      publishedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    },
  ];

  for (const b of beritaData) {
    await prisma.berita.upsert({
      where: { slug: b.slug },
      update: {},
      create: b,
    });
  }
  console.log(`✓ Berita: ${beritaData.length} artikel`);

  // ============ ALUMNI ============
  const alumniData = [
    { nama: 'Rizky Pratama', nis: '2021001', tahunLulus: 2024, jurusan: 'IPA', status: 'KULIAH', instansi: 'Universitas Indonesia', posisi: 'Mahasiswa Teknik Informatika' },
    { nama: 'Sari Wulandari', nis: '2021002', tahunLulus: 2024, jurusan: 'IPS', status: 'KULIAH', instansi: 'Universitas Gadjah Mada', posisi: 'Mahasiswa Akuntansi' },
    { nama: 'Hendra Kusuma', nis: '2020010', tahunLulus: 2023, jurusan: 'IPA', status: 'BEKERJA', instansi: 'PT Telkom Indonesia', posisi: 'Junior Engineer' },
    { nama: 'Maya Anggraini', nis: '2020015', tahunLulus: 2023, jurusan: 'IPS', status: 'WIRAUSAHA', instansi: 'Maya Bakery', posisi: 'Founder & Owner' },
  ];

  for (const a of alumniData) {
    const existing = await prisma.alumni.findFirst({ where: { nis: a.nis } });
    if (!existing) {
      await prisma.alumni.create({ data: a });
    }
  }
  console.log(`✓ Alumni: ${alumniData.length} data`);

  console.log('\n✅ Seed selesai!\n');
  console.log('=== KREDENSIAL LOGIN ===');
  console.log('Admin   : admin@sekolah.sch.id / admin123');
  console.log('Guru    : budi@sekolah.sch.id / guru123  (atau siti@sekolah.sch.id)');
  console.log('Siswa   : NIS 2025001 / siswa123     (login pakai NIS, bukan email)');
  console.log('========================\n');
}

// Standalone execution: `npx prisma db seed` atau `tsx prisma/seed.ts`
// (kalau di-import dari server.ts, pakai runSeed() langsung — bukan jalur ini)
if (require.main === module) {
  runSeed()
    .catch((e) => {
      console.error('❌ Seed gagal:', e);
      process.exit(1);
    });
}
