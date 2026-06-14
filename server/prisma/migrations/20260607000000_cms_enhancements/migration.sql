-- Migration: CMS Enhancements - Rich Text, Kategori, Tags, Meta, Penulis
-- Date: 2026-06-07
-- Description: Tambah field untuk fitur Rich Text Editor, Kategori & Tags, SEO Meta, dan Author

-- Tambah field baru ke table Berita (IF NOT EXISTS dihapus — tidak didukung MySQL)
ALTER TABLE `Berita`
  ADD COLUMN `kategori`        VARCHAR(50)   NULL COMMENT 'Kategori berita: Akademik, Prestasi, Kegiatan, Pengumuman, Umum',
  ADD COLUMN `tags`            TEXT          NULL COMMENT 'JSON array tags: ["lomba","juara"]',
  ADD COLUMN `metaDescription` VARCHAR(160)  NULL COMMENT 'Meta description untuk SEO (max 160 char)',
  ADD COLUMN `penulis`         VARCHAR(100)  NULL COMMENT 'Nama penulis/author berita';

-- Index untuk performa filter by kategori
CREATE INDEX `Berita_kategori_idx` ON `Berita`(`kategori`);

-- Verifikasi struktur table (optional, untuk testing)
-- DESCRIBE `Berita`;
