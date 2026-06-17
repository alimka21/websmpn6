-- AlterTable
ALTER TABLE `Siswa` ADD COLUMN `rfidKode` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Siswa_rfidKode_key` ON `Siswa`(`rfidKode`);
