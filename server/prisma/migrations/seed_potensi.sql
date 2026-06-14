-- ============================================================
-- SEED: JenisKebaikan & JenisPelanggaran
-- Jalankan di phpMyAdmin → database webujian → tab SQL
-- Aman dijalankan berulang (INSERT IGNORE)
-- ============================================================

-- Jenis Kebaikan
INSERT IGNORE INTO `JenisKebaikan` (`id`, `nama`, `poin`, `isActive`, `createdAt`, `updatedAt`) VALUES
  (UUID(), 'Membantu teman yang kesulitan',       10, 1, NOW(), NOW()),
  (UUID(), 'Aktif bertanya di kelas',             5,  1, NOW(), NOW()),
  (UUID(), 'Menjaga kebersihan lingkungan',       10, 1, NOW(), NOW()),
  (UUID(), 'Prestasi akademik (juara kelas)',     25, 1, NOW(), NOW()),
  (UUID(), 'Prestasi non-akademik (lomba)',       25, 1, NOW(), NOW()),
  (UUID(), 'Mengikuti kegiatan ekstrakurikuler',  10, 1, NOW(), NOW()),
  (UUID(), 'Melaporkan kehilangan barang',        15, 1, NOW(), NOW()),
  (UUID(), 'Membantu guru di sekolah',            10, 1, NOW(), NOW()),
  (UUID(), 'Hadir tepat waktu selama sebulan',    20, 1, NOW(), NOW()),
  (UUID(), 'Menjadi pengurus OSIS',               20, 1, NOW(), NOW());

-- Jenis Pelanggaran
INSERT IGNORE INTO `JenisPelanggaran` (`id`, `nama`, `poin`, `isActive`, `createdAt`, `updatedAt`) VALUES
  (UUID(), 'Terlambat masuk kelas',               5,  1, NOW(), NOW()),
  (UUID(), 'Tidak mengerjakan tugas',             5,  1, NOW(), NOW()),
  (UUID(), 'Tidak membawa buku pelajaran',        3,  1, NOW(), NOW()),
  (UUID(), 'Makan di dalam kelas',                3,  1, NOW(), NOW()),
  (UUID(), 'Bermain HP saat KBM',                 10, 1, NOW(), NOW()),
  (UUID(), 'Tidak memakai seragam lengkap',       5,  1, NOW(), NOW()),
  (UUID(), 'Tidak hadir tanpa keterangan (alpha)',15, 1, NOW(), NOW()),
  (UUID(), 'Berkelahi atau berlaku kasar',        25, 1, NOW(), NOW()),
  (UUID(), 'Membuang sampah sembarangan',         5,  1, NOW(), NOW()),
  (UUID(), 'Merusak fasilitas sekolah',           30, 1, NOW(), NOW());
