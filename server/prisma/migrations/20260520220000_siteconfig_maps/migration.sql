-- SiteConfig.mapsEmbedUrl — embed URL Google Maps untuk footer landing
DROP PROCEDURE IF EXISTS add_siteconfig_maps;
DELIMITER //
CREATE PROCEDURE add_siteconfig_maps()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'SiteConfig' AND COLUMN_NAME = 'mapsEmbedUrl'
  ) THEN
    ALTER TABLE `SiteConfig` ADD COLUMN `mapsEmbedUrl` TEXT NULL;
  END IF;
END //
DELIMITER ;
CALL add_siteconfig_maps();
DROP PROCEDURE add_siteconfig_maps;
