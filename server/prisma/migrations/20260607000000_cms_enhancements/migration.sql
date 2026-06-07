-- Migration: CMS Enhancements - Rich Text, Kategori, Tags, Meta, Penulis
-- Date: 2026-06-07
-- Description: Tambah field untuk fitur Rich Text Editor, Kategori & Tags, SEO Meta, dan Author

-- Tambah field baru ke table Berita
ALTER TABLE `Berita`
  ADD COLUMN IF NOT EXISTS `kategori`        VARCHAR(50)   NULL COMMENT 'Kategori berita: Akademik, Prestasi, Kegiatan, Pengumuman, Umum',
  ADD COLUMN IF NOT EXISTS `tags`            TEXT          NULL COMMENT 'JSON array tags: ["lomba","juara"]',
  ADD COLUMN IF NOT EXISTS `metaDescription` VARCHAR(160)  NULL COMMENT 'Meta description untuk SEO (max 160 char)',
  ADD COLUMN IF NOT EXISTS `penulis`         VARCHAR(100)  NULL COMMENT 'Nama penulis/author berita';

-- Index untuk performa filter by kategori
CREATE INDEX IF NOT EXISTS `Berita_kategori_idx` ON `Berita`(`kategori`);

-- Verifikasi struktur table (optional, untuk testing)
-- DESCRIBE `Berita`;
