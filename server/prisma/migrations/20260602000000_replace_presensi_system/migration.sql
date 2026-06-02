-- ============================================================
-- Migrasi: Replace sistem Presensi lama dengan sistem baru
-- Jalankan di phpMyAdmin (Hostinger) sebelum deploy.
-- ============================================================

-- DropTable: Presensi (sistem presensi kelas lama)
-- Nonaktifkan FK check sementara agar DROP bisa langsung berjalan
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS `Presensi`;
SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- CreateTable: PresensiGuru
-- Clock-in / clock-out harian guru + foto Base64 + geofencing
-- ============================================================
CREATE TABLE `PresensiGuru` (
    `id` VARCHAR(191) NOT NULL,
    `guruId` VARCHAR(191) NOT NULL,
    `tanggal` DATETIME(3) NOT NULL,
    `waktuDatang` DATETIME(3) NULL,
    `waktuPulang` DATETIME(3) NULL,
    `fotoDatang` LONGTEXT NULL,
    `fotoPulang` LONGTEXT NULL,
    `autoCheckout` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PresensiGuru_guruId_tanggal_key`(`guruId`, `tanggal`),
    INDEX `PresensiGuru_tanggal_idx`(`tanggal`),
    INDEX `PresensiGuru_guruId_tanggal_idx`(`guruId`, `tanggal`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================
-- CreateTable: PresensiSiswa
-- Presensi gerbang via RFID — hanya catat waktu datang
-- ============================================================
CREATE TABLE `PresensiSiswa` (
    `id` VARCHAR(191) NOT NULL,
    `siswaId` VARCHAR(191) NOT NULL,
    `tanggal` DATETIME(3) NOT NULL,
    `waktuDatang` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PresensiSiswa_siswaId_tanggal_key`(`siswaId`, `tanggal`),
    INDEX `PresensiSiswa_tanggal_idx`(`tanggal`),
    INDEX `PresensiSiswa_siswaId_idx`(`siswaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================
-- CreateTable: PengaturanPresensi
-- Singleton — konfigurasi global presensi dari admin
-- ============================================================
CREATE TABLE `PengaturanPresensi` (
    `id` VARCHAR(191) NOT NULL,
    `latitudeSekolah` DOUBLE NOT NULL DEFAULT 0,
    `longitudeSekolah` DOUBLE NOT NULL DEFAULT 0,
    `radiusMeter` INTEGER NOT NULL DEFAULT 100,
    `jamMasukDefault` VARCHAR(191) NOT NULL DEFAULT '07:00',
    `jamPulangDefault` VARCHAR(191) NOT NULL DEFAULT '15:30',
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================
-- AddForeignKey: relasi ke Guru dan Siswa
-- ============================================================
ALTER TABLE `PresensiGuru`
    ADD CONSTRAINT `PresensiGuru_guruId_fkey`
    FOREIGN KEY (`guruId`) REFERENCES `Guru`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `PresensiSiswa`
    ADD CONSTRAINT `PresensiSiswa_siswaId_fkey`
    FOREIGN KEY (`siswaId`) REFERENCES `Siswa`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;
