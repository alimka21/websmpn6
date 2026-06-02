-- Performance indexes — 13 index baru.
-- Idempotent via stored procedure dengan INFORMATION_SCHEMA check
-- (MySQL "CREATE INDEX IF NOT EXISTS" tidak portable across versi lama).

DROP PROCEDURE IF EXISTS add_perf_indexes;
DELIMITER //
CREATE PROCEDURE add_perf_indexes()
BEGIN
  -- Siswa: filter siswa per kelas (paling sering di-query)
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='Siswa' AND INDEX_NAME='Siswa_kelasId_idx') THEN
    CREATE INDEX `Siswa_kelasId_idx` ON `Siswa`(`kelasId`);
  END IF;

  -- Ujian
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='Ujian' AND INDEX_NAME='Ujian_guruId_idx') THEN
    CREATE INDEX `Ujian_guruId_idx` ON `Ujian`(`guruId`);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='Ujian' AND INDEX_NAME='Ujian_tanggalMulai_tanggalSelesai_idx') THEN
    CREATE INDEX `Ujian_tanggalMulai_tanggalSelesai_idx` ON `Ujian`(`tanggalMulai`, `tanggalSelesai`);
  END IF;

  -- Soal
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='Soal' AND INDEX_NAME='Soal_ujianId_idx') THEN
    CREATE INDEX `Soal_ujianId_idx` ON `Soal`(`ujianId`);
  END IF;

  -- Opsi
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='Opsi' AND INDEX_NAME='Opsi_soalId_idx') THEN
    CREATE INDEX `Opsi_soalId_idx` ON `Opsi`(`soalId`);
  END IF;

  -- SesiUjian (ujianId-only sudah cover via @@unique([ujianId, siswaId]) prefix)
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='SesiUjian' AND INDEX_NAME='SesiUjian_siswaId_idx') THEN
    CREATE INDEX `SesiUjian_siswaId_idx` ON `SesiUjian`(`siswaId`);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='SesiUjian' AND INDEX_NAME='SesiUjian_status_idx') THEN
    CREATE INDEX `SesiUjian_status_idx` ON `SesiUjian`(`status`);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='SesiUjian' AND INDEX_NAME='SesiUjian_ujianId_status_idx') THEN
    CREATE INDEX `SesiUjian_ujianId_status_idx` ON `SesiUjian`(`ujianId`, `status`);
  END IF;

  -- Pelanggaran
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='Pelanggaran' AND INDEX_NAME='Pelanggaran_sesiId_idx') THEN
    CREATE INDEX `Pelanggaran_sesiId_idx` ON `Pelanggaran`(`sesiId`);
  END IF;

  -- Presensi (siswaId-only & siswaId+tanggal sudah cover via @@unique([siswaId, tanggal, guruId]) prefix)
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='Presensi' AND INDEX_NAME='Presensi_kelasId_tanggal_idx') THEN
    CREATE INDEX `Presensi_kelasId_tanggal_idx` ON `Presensi`(`kelasId`, `tanggal`);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='Presensi' AND INDEX_NAME='Presensi_guruId_idx') THEN
    CREATE INDEX `Presensi_guruId_idx` ON `Presensi`(`guruId`);
  END IF;

  -- Alumni
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='Alumni' AND INDEX_NAME='Alumni_tahunLulus_idx') THEN
    CREATE INDEX `Alumni_tahunLulus_idx` ON `Alumni`(`tahunLulus`);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='Alumni' AND INDEX_NAME='Alumni_status_idx') THEN
    CREATE INDEX `Alumni_status_idx` ON `Alumni`(`status`);
  END IF;

  -- Berita
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='Berita' AND INDEX_NAME='Berita_status_publishedAt_idx') THEN
    CREATE INDEX `Berita_status_publishedAt_idx` ON `Berita`(`status`, `publishedAt`);
  END IF;
END //
DELIMITER ;
CALL add_perf_indexes();
DROP PROCEDURE add_perf_indexes;
