-- CreateTable GuruKelas: many-to-many Guru <-> Kelas (pengajar per kelas)
CREATE TABLE IF NOT EXISTS `GuruKelas` (
    `id` VARCHAR(191) NOT NULL,
    `guruId` VARCHAR(191) NOT NULL,
    `kelasId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `GuruKelas_guruId_kelasId_key`(`guruId`, `kelasId`),
    INDEX `GuruKelas_kelasId_idx`(`kelasId`),
    INDEX `GuruKelas_guruId_idx`(`guruId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `GuruKelas` ADD CONSTRAINT `GuruKelas_guruId_fkey` FOREIGN KEY (`guruId`) REFERENCES `Guru`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GuruKelas` ADD CONSTRAINT `GuruKelas_kelasId_fkey` FOREIGN KEY (`kelasId`) REFERENCES `Kelas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
