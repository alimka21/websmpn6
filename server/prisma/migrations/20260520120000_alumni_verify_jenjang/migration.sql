-- Alumni.isVerified + Alumni.createdAt + SiteConfig.jenjang
-- Idempotent via stored procedure (skip kalau kolom sudah ada).

DROP PROCEDURE IF EXISTS apply_alumni_verify_jenjang;
DELIMITER //
CREATE PROCEDURE apply_alumni_verify_jenjang()
BEGIN
  -- Alumni.isVerified
  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Alumni' AND COLUMN_NAME = 'isVerified'
  ) THEN
    ALTER TABLE `Alumni` ADD COLUMN `isVerified` BOOLEAN NOT NULL DEFAULT false;
    -- Mark semua alumni yg sudah ada sebagai verified (anggap valid karena
    -- di-input admin sebelum fitur self-register publik ada).
    UPDATE `Alumni` SET `isVerified` = true WHERE `isVerified` = false;
  END IF;

  -- Alumni.createdAt
  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Alumni' AND COLUMN_NAME = 'createdAt'
  ) THEN
    ALTER TABLE `Alumni` ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);
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
CALL apply_alumni_verify_jenjang();
DROP PROCEDURE apply_alumni_verify_jenjang;
