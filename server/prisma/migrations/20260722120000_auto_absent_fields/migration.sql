-- AlterTable: tambah kolom autoAbsent pada PresensiGuru
ALTER TABLE `PresensiGuru` ADD COLUMN `autoAbsent` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: tambah kolom autoAbsent pada AbsensiSiswa
ALTER TABLE `AbsensiSiswa` ADD COLUMN `autoAbsent` BOOLEAN NOT NULL DEFAULT false;
