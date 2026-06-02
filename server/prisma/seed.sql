-- ============================================================
-- Seed data manual — paste ke phpMyAdmin tab SQL
-- ============================================================
-- Idempotent: pakai INSERT IGNORE, aman dijalankan ulang.
-- Password bcrypt hash sudah pre-computed (admin123 / guru123 / siswa123).
-- ============================================================

-- ============ USERS (admin + 2 guru + 6 siswa) ============

INSERT IGNORE INTO `User` (`id`, `email`, `password`, `role`, `isActive`, `createdAt`, `updatedAt`) VALUES
('seed-user-admin',  'admin@sekolah.sch.id',       '$2b$10$iVZtShVx8k0sydzBOq.2GOS/vkeveJ6URZY9.73k.wcyk6NYf/7Ze', 'SUPER_ADMIN', 1, NOW(3), NOW(3)),
('seed-user-guru1',  'budi@sekolah.sch.id',        '$2b$10$eTtgva.r.//pGKVgKrnKHeEkEaFyY6.o8Hbr70DOih0Xsz2yOoqEy', 'GURU',        1, NOW(3), NOW(3)),
('seed-user-guru2',  'siti@sekolah.sch.id',        '$2b$10$eTtgva.r.//pGKVgKrnKHeEkEaFyY6.o8Hbr70DOih0Xsz2yOoqEy', 'GURU',        1, NOW(3), NOW(3)),
('seed-user-siswa1', '2025001@siswa.sch.id',   '$2b$10$aQo0ihdjZ040KGdQH6d/5.OBn9O.pxzLSewHg6w.C4QcY8KjQQuuu', 'SISWA',       1, NOW(3), NOW(3)),
('seed-user-siswa2', '2025002@siswa.sch.id',   '$2b$10$aQo0ihdjZ040KGdQH6d/5.OBn9O.pxzLSewHg6w.C4QcY8KjQQuuu', 'SISWA',       1, NOW(3), NOW(3)),
('seed-user-siswa3', '2025003@siswa.sch.id',   '$2b$10$aQo0ihdjZ040KGdQH6d/5.OBn9O.pxzLSewHg6w.C4QcY8KjQQuuu', 'SISWA',       1, NOW(3), NOW(3)),
('seed-user-siswa4', '2025004@siswa.sch.id',   '$2b$10$aQo0ihdjZ040KGdQH6d/5.OBn9O.pxzLSewHg6w.C4QcY8KjQQuuu', 'SISWA',       1, NOW(3), NOW(3)),
('seed-user-siswa5', '2025005@siswa.sch.id',   '$2b$10$aQo0ihdjZ040KGdQH6d/5.OBn9O.pxzLSewHg6w.C4QcY8KjQQuuu', 'SISWA',       1, NOW(3), NOW(3)),
('seed-user-siswa6', '2024001@siswa.sch.id',   '$2b$10$aQo0ihdjZ040KGdQH6d/5.OBn9O.pxzLSewHg6w.C4QcY8KjQQuuu', 'SISWA',       1, NOW(3), NOW(3));

-- ============ ADMIN profile ============

INSERT IGNORE INTO `Admin` (`id`, `userId`, `nama`) VALUES
('seed-admin-1', 'seed-user-admin', 'Administrator Sekolah');

-- ============ GURU profiles ============

INSERT IGNORE INTO `Guru` (`id`, `userId`, `nip`, `nama`, `mataPelajaran`, `fotoUrl`) VALUES
('seed-guru-1', 'seed-user-guru1', '198501012010011001', 'Budi Santoso, S.Pd', 'Matematika',       NULL),
('seed-guru-2', 'seed-user-guru2', '198703152011012002', 'Siti Aminah, M.Pd',  'Bahasa Indonesia', NULL);

-- ============ KELAS ============

INSERT IGNORE INTO `Kelas` (`id`, `nama`, `tingkat`, `tahunAjaran`, `guruId`) VALUES
('seed-kelas-10a', 'X IPA 1',  '10', '2025/2026', 'seed-guru-1'),
('seed-kelas-10b', 'X IPA 2',  '10', '2025/2026', 'seed-guru-1'),
('seed-kelas-11a', 'XI IPA 1', '11', '2025/2026', 'seed-guru-2');

-- ============ SISWA profiles ============

INSERT IGNORE INTO `Siswa` (`id`, `userId`, `nis`, `nama`, `kelasId`) VALUES
('seed-siswa-1', 'seed-user-siswa1', '2025001', 'Ahmad Fauzi',   'seed-kelas-10a'),
('seed-siswa-2', 'seed-user-siswa2', '2025002', 'Bunga Lestari', 'seed-kelas-10a'),
('seed-siswa-3', 'seed-user-siswa3', '2025003', 'Citra Dewi',    'seed-kelas-10a'),
('seed-siswa-4', 'seed-user-siswa4', '2025004', 'Dimas Pratama', 'seed-kelas-10b'),
('seed-siswa-5', 'seed-user-siswa5', '2025005', 'Eka Wahyuni',   'seed-kelas-10b'),
('seed-siswa-6', 'seed-user-siswa6', '2024001', 'Fahri Hidayat', 'seed-kelas-11a');

-- ============ UJIAN (Matematika) + relasi ============

INSERT IGNORE INTO `Ujian` (`id`, `judul`, `mataPelajaran`, `tipeUjian`, `durasi`, `tanggalMulai`, `tanggalSelesai`, `acak`, `createdAt`, `guruId`) VALUES
('seed-ujian-mtk-1', 'Ulangan Harian Matematika - Bab Aljabar', 'Matematika', 'ULANGAN_HARIAN', 60,
  DATE_SUB(NOW(3), INTERVAL 1 DAY), DATE_ADD(NOW(3), INTERVAL 7 DAY), 0, NOW(3), 'seed-guru-1');

INSERT IGNORE INTO `UjianKelas` (`id`, `ujianId`, `kelasId`) VALUES
('seed-uk-1', 'seed-ujian-mtk-1', 'seed-kelas-10a'),
('seed-uk-2', 'seed-ujian-mtk-1', 'seed-kelas-10b');

INSERT IGNORE INTO `Soal` (`id`, `ujianId`, `nomor`, `teks`, `imageUrl`, `tipe`, `poin`) VALUES
('seed-soal-1', 'seed-ujian-mtk-1', 1, 'Berapakah hasil dari 2x + 3 jika x = 5?',                                            NULL, 'PILIHAN_GANDA', 25),
('seed-soal-2', 'seed-ujian-mtk-1', 2, 'Selesaikan persamaan: 3x - 6 = 12. Berapa nilai x?',                                  NULL, 'PILIHAN_GANDA', 25),
('seed-soal-3', 'seed-ujian-mtk-1', 3, 'Manakah pernyataan yang BENAR tentang persamaan linear? (pilih semua yang sesuai)',   NULL, 'PG_KOMPLEKS',   25),
('seed-soal-4', 'seed-ujian-mtk-1', 4, 'Persamaan 2(x + 3) = 2x + 6 adalah persamaan identitas.',                             NULL, 'BENAR_SALAH',   25);

INSERT IGNORE INTO `Opsi` (`id`, `soalId`, `teks`, `imageUrl`, `urutan`, `benar`) VALUES
-- soal 1
('seed-opsi-1-1', 'seed-soal-1', '10', NULL, 1, 0),
('seed-opsi-1-2', 'seed-soal-1', '13', NULL, 2, 1),
('seed-opsi-1-3', 'seed-soal-1', '15', NULL, 3, 0),
('seed-opsi-1-4', 'seed-soal-1', '8',  NULL, 4, 0),
-- soal 2
('seed-opsi-2-1', 'seed-soal-2', '4', NULL, 1, 0),
('seed-opsi-2-2', 'seed-soal-2', '5', NULL, 2, 0),
('seed-opsi-2-3', 'seed-soal-2', '6', NULL, 3, 1),
('seed-opsi-2-4', 'seed-soal-2', '7', NULL, 4, 0),
-- soal 3
('seed-opsi-3-1', 'seed-soal-3', 'Pangkat variabel tertinggi adalah 1',     NULL, 1, 1),
('seed-opsi-3-2', 'seed-soal-3', 'Selalu memiliki satu solusi unik',         NULL, 2, 0),
('seed-opsi-3-3', 'seed-soal-3', 'Dapat digambarkan sebagai garis lurus',    NULL, 3, 1),
('seed-opsi-3-4', 'seed-soal-3', 'Bentuk umumnya ax + b = 0',                NULL, 4, 1),
-- soal 4
('seed-opsi-4-1', 'seed-soal-4', 'Benar', NULL, 1, 1),
('seed-opsi-4-2', 'seed-soal-4', 'Salah', NULL, 2, 0);

-- ============ BERITA ============

INSERT IGNORE INTO `Berita` (`id`, `judul`, `slug`, `konten`, `ringkasan`, `imageUrl`, `status`, `publishedAt`, `createdAt`, `updatedAt`) VALUES
('seed-berita-1',
  'Pengumuman Penerimaan Peserta Didik Baru Tahun Ajaran 2026/2027',
  'penerimaan-peserta-didik-baru-2026',
  'Sekolah membuka pendaftaran Peserta Didik Baru (PPDB) untuk Tahun Ajaran 2026/2027 mulai tanggal 1 Juni 2026 hingga 30 Juni 2026. Persyaratan: fotokopi ijazah, kartu keluarga, akta lahir, dan pas foto 3x4 sebanyak 2 lembar. Informasi lebih lanjut hubungi panitia PPDB di kantor TU.',
  'Pendaftaran PPDB dibuka mulai 1 Juni 2026. Silakan persiapkan dokumen yang dibutuhkan.',
  NULL, 'PUBLISHED', NOW(3), NOW(3), NOW(3)),
('seed-berita-2',
  'Jadwal Ujian Tengah Semester Genap 2025/2026',
  'jadwal-ujian-tengah-semester-genap',
  'Sehubungan dengan akhir paruh semester genap, Ujian Tengah Semester (UTS) akan dilaksanakan pada tanggal 18 hingga 22 Mei 2026. Seluruh siswa wajib hadir minimal 15 menit sebelum ujian dimulai. Jadwal lengkap dapat diunduh di portal akademik.',
  'UTS Semester Genap akan dilaksanakan tanggal 18-22 Mei 2026 secara serentak untuk seluruh tingkat.',
  NULL, 'PUBLISHED', DATE_SUB(NOW(3), INTERVAL 3 DAY), NOW(3), NOW(3)),
('seed-berita-3',
  'Siswa Kami Raih Juara 1 Olimpiade Matematika Tingkat Provinsi',
  'juara-olimpiade-matematika-tingkat-provinsi',
  'Selamat dan sukses kepada Ananda Fahri Hidayat dari kelas XI IPA 1 yang berhasil meraih medali emas dalam Olimpiade Sains Provinsi (OSP) bidang Matematika tahun 2026. Prestasi ini menambah deretan capaian akademik sekolah kita di tingkat regional.',
  'Ananda Fahri Hidayat (kelas XI IPA 1) berhasil meraih medali emas pada OSP Matematika 2026.',
  NULL, 'PUBLISHED', DATE_SUB(NOW(3), INTERVAL 7 DAY), NOW(3), NOW(3));

-- ============ ALUMNI ============

INSERT IGNORE INTO `Alumni` (`id`, `nama`, `nis`, `tahunLulus`, `jurusan`, `status`, `instansi`, `posisi`, `kontak`, `fotoUrl`) VALUES
('seed-alumni-1', 'Rizky Pratama',   '2021001', 2024, 'IPA', 'KULIAH',    'Universitas Indonesia',   'Mahasiswa Teknik Informatika', NULL, NULL),
('seed-alumni-2', 'Sari Wulandari',  '2021002', 2024, 'IPS', 'KULIAH',    'Universitas Gadjah Mada', 'Mahasiswa Akuntansi',          NULL, NULL),
('seed-alumni-3', 'Hendra Kusuma',   '2020010', 2023, 'IPA', 'BEKERJA',   'PT Telkom Indonesia',     'Junior Engineer',              NULL, NULL),
('seed-alumni-4', 'Maya Anggraini',  '2020015', 2023, 'IPS', 'WIRAUSAHA', 'Maya Bakery',             'Founder & Owner',              NULL, NULL);

-- ============ DONE ============
-- Login credentials:
--   Admin : admin@sekolah.sch.id / admin123
--   Guru  : budi@sekolah.sch.id  / guru123  (or siti@sekolah.sch.id)
--   Siswa : NIS 2025001      / siswa123 (login via NIS, not email)
