-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserSession` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `token` VARCHAR(512) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `UserSession_token_key`(`token`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Admin` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `nama` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `Admin_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Guru` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `nip` VARCHAR(191) NOT NULL,
    `nama` VARCHAR(191) NOT NULL,
    `mataPelajaran` VARCHAR(191) NOT NULL,
    `fotoUrl` VARCHAR(191) NULL,

    UNIQUE INDEX `Guru_userId_key`(`userId`),
    UNIQUE INDEX `Guru_nip_key`(`nip`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Kelas` (
    `id` VARCHAR(191) NOT NULL,
    `nama` VARCHAR(191) NOT NULL,
    `tingkat` VARCHAR(191) NOT NULL,
    `tahunAjaran` VARCHAR(191) NOT NULL,
    `guruId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Siswa` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `nis` VARCHAR(191) NOT NULL,
    `nama` VARCHAR(191) NOT NULL,
    `kelasId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `Siswa_userId_key`(`userId`),
    UNIQUE INDEX `Siswa_nis_key`(`nis`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Ujian` (
    `id` VARCHAR(191) NOT NULL,
    `judul` VARCHAR(191) NOT NULL,
    `mataPelajaran` VARCHAR(191) NOT NULL,
    `tipeUjian` VARCHAR(191) NULL DEFAULT 'ULANGAN_HARIAN',
    `durasi` INTEGER NOT NULL,
    `tanggalMulai` DATETIME(3) NULL,
    `tanggalSelesai` DATETIME(3) NULL,
    `acak` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `guruId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UjianKelas` (
    `id` VARCHAR(191) NOT NULL,
    `ujianId` VARCHAR(191) NOT NULL,
    `kelasId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `UjianKelas_ujianId_kelasId_key`(`ujianId`, `kelasId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Soal` (
    `id` VARCHAR(191) NOT NULL,
    `ujianId` VARCHAR(191) NOT NULL,
    `nomor` INTEGER NOT NULL,
    `teks` TEXT NOT NULL,
    `imageUrl` VARCHAR(191) NULL,
    `tipe` VARCHAR(191) NOT NULL,
    `poin` DOUBLE NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Opsi` (
    `id` VARCHAR(191) NOT NULL,
    `soalId` VARCHAR(191) NOT NULL,
    `teks` TEXT NOT NULL,
    `imageUrl` VARCHAR(191) NULL,
    `urutan` INTEGER NOT NULL,
    `benar` BOOLEAN NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SesiUjian` (
    `id` VARCHAR(191) NOT NULL,
    `ujianId` VARCHAR(191) NOT NULL,
    `siswaId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `mulaiAt` DATETIME(3) NULL,
    `selesaiAt` DATETIME(3) NULL,
    `nilaiRaw` DOUBLE NULL,
    `nilaiAkhir` DOUBLE NULL,
    `submitReason` VARCHAR(191) NULL,

    UNIQUE INDEX `SesiUjian_ujianId_siswaId_key`(`ujianId`, `siswaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Jawaban` (
    `id` VARCHAR(191) NOT NULL,
    `sesiId` VARCHAR(191) NOT NULL,
    `soalId` VARCHAR(191) NOT NULL,
    `opsiId` VARCHAR(191) NULL,
    `isBenar` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `Jawaban_sesiId_soalId_key`(`sesiId`, `soalId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Pelanggaran` (
    `id` VARCHAR(191) NOT NULL,
    `sesiId` VARCHAR(191) NOT NULL,
    `tipe` VARCHAR(191) NOT NULL,
    `pesan` TEXT NOT NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Presensi` (
    `id` VARCHAR(191) NOT NULL,
    `siswaId` VARCHAR(191) NOT NULL,
    `kelasId` VARCHAR(191) NOT NULL,
    `guruId` VARCHAR(191) NOT NULL,
    `tanggal` DATETIME(3) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `keterangan` TEXT NULL,

    UNIQUE INDEX `Presensi_siswaId_tanggal_key`(`siswaId`, `tanggal`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Alumni` (
    `id` VARCHAR(191) NOT NULL,
    `nama` VARCHAR(191) NOT NULL,
    `nis` VARCHAR(191) NULL,
    `tahunLulus` INTEGER NOT NULL,
    `jurusan` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL,
    `instansi` VARCHAR(191) NULL,
    `posisi` VARCHAR(191) NULL,
    `kontak` VARCHAR(191) NULL,
    `fotoUrl` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Berita` (
    `id` VARCHAR(191) NOT NULL,
    `judul` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `konten` LONGTEXT NOT NULL,
    `ringkasan` TEXT NULL,
    `imageUrl` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL,
    `publishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Berita_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `UserSession` ADD CONSTRAINT `UserSession_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Admin` ADD CONSTRAINT `Admin_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Guru` ADD CONSTRAINT `Guru_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Kelas` ADD CONSTRAINT `Kelas_guruId_fkey` FOREIGN KEY (`guruId`) REFERENCES `Guru`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Siswa` ADD CONSTRAINT `Siswa_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Siswa` ADD CONSTRAINT `Siswa_kelasId_fkey` FOREIGN KEY (`kelasId`) REFERENCES `Kelas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Ujian` ADD CONSTRAINT `Ujian_guruId_fkey` FOREIGN KEY (`guruId`) REFERENCES `Guru`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UjianKelas` ADD CONSTRAINT `UjianKelas_ujianId_fkey` FOREIGN KEY (`ujianId`) REFERENCES `Ujian`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UjianKelas` ADD CONSTRAINT `UjianKelas_kelasId_fkey` FOREIGN KEY (`kelasId`) REFERENCES `Kelas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Soal` ADD CONSTRAINT `Soal_ujianId_fkey` FOREIGN KEY (`ujianId`) REFERENCES `Ujian`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Opsi` ADD CONSTRAINT `Opsi_soalId_fkey` FOREIGN KEY (`soalId`) REFERENCES `Soal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SesiUjian` ADD CONSTRAINT `SesiUjian_ujianId_fkey` FOREIGN KEY (`ujianId`) REFERENCES `Ujian`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SesiUjian` ADD CONSTRAINT `SesiUjian_siswaId_fkey` FOREIGN KEY (`siswaId`) REFERENCES `Siswa`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Jawaban` ADD CONSTRAINT `Jawaban_sesiId_fkey` FOREIGN KEY (`sesiId`) REFERENCES `SesiUjian`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Jawaban` ADD CONSTRAINT `Jawaban_soalId_fkey` FOREIGN KEY (`soalId`) REFERENCES `Soal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Jawaban` ADD CONSTRAINT `Jawaban_opsiId_fkey` FOREIGN KEY (`opsiId`) REFERENCES `Opsi`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Pelanggaran` ADD CONSTRAINT `Pelanggaran_sesiId_fkey` FOREIGN KEY (`sesiId`) REFERENCES `SesiUjian`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Presensi` ADD CONSTRAINT `Presensi_siswaId_fkey` FOREIGN KEY (`siswaId`) REFERENCES `Siswa`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Presensi` ADD CONSTRAINT `Presensi_kelasId_fkey` FOREIGN KEY (`kelasId`) REFERENCES `Kelas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Presensi` ADD CONSTRAINT `Presensi_guruId_fkey` FOREIGN KEY (`guruId`) REFERENCES `Guru`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

