-- Ujian: tiga flag baru untuk pengaturan ujian.
-- Idempotent via stored procedure (skip kalau kolom sudah ada).
-- SiteConfig.jenjang juga di-add kalau migration alumni_verify_jenjang belum jalan.

DROP PROCEDURE IF EXISTS apply_ujian_flags_and_jenjang;
DELIMITER //
CREATE PROCEDURE apply_ujian_flags_and_jenjang()
BEGIN
  -- Ujian.acakOpsi
  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Ujian' AND COLUMN_NAME = 'acakOpsi'
  ) THEN
    ALTER TABLE `Ujian` ADD COLUMN `acakOpsi` BOOLEAN NOT NULL DEFAULT false;
  END IF;

  -- Ujian.tampilkanPembahasan
  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Ujian' AND COLUMN_NAME = 'tampilkanPembahasan'
  ) THEN
    ALTER TABLE `Ujian` ADD COLUMN `tampilkanPembahasan` BOOLEAN NOT NULL DEFAULT true;
  END IF;

  -- Ujian.tampilkanNilai
  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Ujian' AND COLUMN_NAME = 'tampilkanNilai'
  ) THEN
    ALTER TABLE `Ujian` ADD COLUMN `tampilkanNilai` BOOLEAN NOT NULL DEFAULT true;
  END IF;

  -- SiteConfig.jenjang
  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'SiteConfig' AND COLUMN_NAME = 'jenjang'
  ) THEN
    ALTER TABLE `SiteConfig` ADD COLUMN `jenjang` VARCHAR(191) NULL;
  END IF;
END //
DELIMITER ;
CALL apply_ujian_flags_and_jenjang();
DROP PROCEDURE apply_ujian_flags_and_jenjang;
