-- Tabel mata pelajaran per guru (many per guru)
CREATE TABLE IF NOT EXISTS `GuruMataPelajaran` (
    `id`     VARCHAR(191) NOT NULL,
    `guruId` VARCHAR(191) NOT NULL,
    `nama`   VARCHAR(191) NOT NULL,

    INDEX `GuruMataPelajaran_guruId_idx`(`guruId`),
    UNIQUE INDEX `GuruMataPelajaran_guruId_nama_key`(`guruId`, `nama`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `GuruMataPelajaran`
  ADD CONSTRAINT `GuruMataPelajaran_guruId_fkey`
  FOREIGN KEY (`guruId`) REFERENCES `Guru`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
