-- AlterTable: tambah kolom timezone ke PengaturanPresensi
ALTER TABLE `PengaturanPresensi` ADD COLUMN `timezone` VARCHAR(50) NOT NULL DEFAULT 'Asia/Jakarta';
