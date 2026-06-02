-- SiteConfig: tambah sambutan kepala sekolah + fitur unggulan
-- Pakai stored procedure idempotent supaya aman walau dijalankan ulang.

DROP PROCEDURE IF EXISTS add_siteconfig_kepsek_fitur;
DELIMITER //
CREATE PROCEDURE add_siteconfig_kepsek_fitur()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'SiteConfig' AND COLUMN_NAME = 'kepsekNama'
  ) THEN
    ALTER TABLE `SiteConfig` ADD COLUMN `kepsekNama` VARCHAR(191) NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'SiteConfig' AND COLUMN_NAME = 'kepsekJabatan'
  ) THEN
    ALTER TABLE `SiteConfig` ADD COLUMN `kepsekJabatan` VARCHAR(191) NULL DEFAULT 'Kepala Sekolah';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'SiteConfig' AND COLUMN_NAME = 'kepsekFotoUrl'
  ) THEN
    ALTER TABLE `SiteConfig` ADD COLUMN `kepsekFotoUrl` LONGTEXT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'SiteConfig' AND COLUMN_NAME = 'kepsekSambutan'
  ) THEN
    ALTER TABLE `SiteConfig` ADD COLUMN `kepsekSambutan` TEXT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'SiteConfig' AND COLUMN_NAME = 'fiturUnggulan'
  ) THEN
    ALTER TABLE `SiteConfig` ADD COLUMN `fiturUnggulan` LONGTEXT NULL;
  END IF;
END //
DELIMITER ;
CALL add_siteconfig_kepsek_fitur();
DROP PROCEDURE add_siteconfig_kepsek_fitur;
