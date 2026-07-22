-- AlterTable: tambah kolom rfidKode pada tabel Guru
ALTER TABLE `Guru` ADD COLUMN `rfidKode` VARCHAR(50) NULL;

-- CreateIndex: pastikan rfidKode unik
CREATE UNIQUE INDEX `Guru_rfidKode_key` ON `Guru`(`rfidKode`);
