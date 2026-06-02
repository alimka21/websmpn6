-- Fix bug PG_KOMPLEKS: unique constraint @@unique([sesiId, soalId]) di Jawaban
-- mem-block multiple row per (sesi, soal). PG_KOMPLEKS butuh satu row per opsi
-- yang dipilih siswa.
--
-- ORDER PENTING: MySQL tidak izinkan drop index yang sedang dipakai sebagai
-- backing index untuk FK constraint. Unique `Jawaban_sesiId_soalId_key`
-- dipakai oleh FK ke SesiUjian.sesiId. Jadi:
--   1. Buat index baru DULU (sesiId, soalId) — FK bisa pindah ke index ini
--   2. Baru drop unique key lama
-- Idempotent via stored procedure.

DROP PROCEDURE IF EXISTS fix_jawaban_pg_kompleks;
DELIMITER //
CREATE PROCEDURE fix_jawaban_pg_kompleks()
BEGIN
  -- Step 1: tambah index biasa untuk (sesiId, soalId) — sesiId prefix
  -- memenuhi syarat backing index FK ke SesiUjian.
  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'Jawaban'
      AND INDEX_NAME = 'Jawaban_sesiId_soalId_idx'
  ) THEN
    CREATE INDEX `Jawaban_sesiId_soalId_idx` ON `Jawaban`(`sesiId`, `soalId`);
  END IF;

  -- Step 2: drop unique constraint lama. Sekarang aman karena FK punya
  -- index alternatif (Jawaban_sesiId_soalId_idx).
  IF EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'Jawaban'
      AND INDEX_NAME = 'Jawaban_sesiId_soalId_key'
  ) THEN
    ALTER TABLE `Jawaban` DROP INDEX `Jawaban_sesiId_soalId_key`;
  END IF;
END //
DELIMITER ;
CALL fix_jawaban_pg_kompleks();
DROP PROCEDURE fix_jawaban_pg_kompleks;
