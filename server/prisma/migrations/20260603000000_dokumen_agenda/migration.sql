-- CreateTable: DokumenSekolah
CREATE TABLE `DokumenSekolah` (
    `id`        VARCHAR(191) NOT NULL,
    `judul`     VARCHAR(191) NOT NULL,
    `linkDrive` TEXT NOT NULL,
    `urutan`    INTEGER NOT NULL DEFAULT 0,
    `isActive`  BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    INDEX `DokumenSekolah_isActive_urutan_idx`(`isActive`, `urutan`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: AgendaSekolah
CREATE TABLE `AgendaSekolah` (
    `id`        VARCHAR(191) NOT NULL,
    `judul`     VARCHAR(191) NOT NULL,
    `waktu`     DATETIME(3) NOT NULL,
    `lokasi`    VARCHAR(191) NULL,
    `isActive`  BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    INDEX `AgendaSekolah_isActive_waktu_idx`(`isActive`, `waktu`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
