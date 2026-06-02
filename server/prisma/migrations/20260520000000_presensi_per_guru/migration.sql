-- Ganti unique constraint Presensi dari [siswaId, tanggal] ke [siswaId, tanggal, guruId]
-- supaya beberapa guru bisa mencatat presensi siswa yang sama pada hari yang sama
-- (sesi pelajaran berbeda).

-- DropIndex
ALTER TABLE `Presensi` DROP INDEX `Presensi_siswaId_tanggal_key`;

-- CreateIndex
CREATE UNIQUE INDEX `Presensi_siswaId_tanggal_guruId_key` ON `Presensi`(`siswaId`, `tanggal`, `guruId`);
