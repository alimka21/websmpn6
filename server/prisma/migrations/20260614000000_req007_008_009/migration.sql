-- ============================================================
-- Migrasi: REQ-007, REQ-008, REQ-009
-- Jalankan di phpMyAdmin sebelum deploy ke Hostinger.
-- Aman dijalankan berulang (IF NOT EXISTS / IF NOT EXISTS).
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- REQ-007: Absensi Manual Siswa
-- ─────────────────────────────────────────────────────────────

-- Tambah kolom kode akses ke PengaturanPresensi
ALTER TABLE `PengaturanPresensi`
  ADD COLUMN IF NOT EXISTS `kodeAksesGuru`  VARCHAR(191) NULL,
  ADD COLUMN IF NOT EXISTS `kodeAksesSiswa` VARCHAR(191) NULL;

-- Tabel absensi tidak hadir siswa (Sakit / Izin / Alfa) yang diinput guru
CREATE TABLE IF NOT EXISTS `AbsensiSiswa` (
  `id`         VARCHAR(191)  NOT NULL,
  `siswaId`    VARCHAR(191)  NOT NULL,
  `guruId`     VARCHAR(191)  NULL,
  `tanggal`    DATETIME(3)   NOT NULL,
  `status`     VARCHAR(191)  NOT NULL,
  `keterangan` TEXT          NULL,
  `createdAt`  DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`  DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  UNIQUE KEY  `AbsensiSiswa_siswaId_tanggal_key` (`siswaId`, `tanggal`),
  INDEX       `AbsensiSiswa_tanggal_idx`          (`tanggal`),
  INDEX       `AbsensiSiswa_siswaId_idx`           (`siswaId`),
  INDEX       `AbsensiSiswa_guruId_idx`            (`guruId`),

  CONSTRAINT `AbsensiSiswa_siswaId_fkey`
    FOREIGN KEY (`siswaId`) REFERENCES `Siswa` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `AbsensiSiswa_guruId_fkey`
    FOREIGN KEY (`guruId`) REFERENCES `Guru` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE

) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────
-- REQ-008: Sistem Potensi Siswa
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `JenisKebaikan` (
  `id`        VARCHAR(191) NOT NULL,
  `nama`      VARCHAR(191) NOT NULL,
  `poin`      INT          NOT NULL,
  `isActive`  TINYINT(1)   NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `JenisPelanggaran` (
  `id`        VARCHAR(191) NOT NULL,
  `nama`      VARCHAR(191) NOT NULL,
  `poin`      INT          NOT NULL,
  `isActive`  TINYINT(1)   NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `LaporanPotensi` (
  `id`                 VARCHAR(191) NOT NULL,
  `siswaId`            VARCHAR(191) NOT NULL,
  `namaPelapor`        VARCHAR(191) NOT NULL,
  `tipe`               VARCHAR(191) NOT NULL,
  `jenisKebaikanId`    VARCHAR(191) NULL,
  `jenisPelanggaranId` VARCHAR(191) NULL,
  `poin`               INT          NOT NULL,
  `buktiUrl`           LONGTEXT     NULL,
  `keterangan`         TEXT         NULL,
  `tanggal`            DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `createdAt`          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  INDEX `LaporanPotensi_siswaId_idx`  (`siswaId`),
  INDEX `LaporanPotensi_tipe_idx`     (`tipe`),
  INDEX `LaporanPotensi_tanggal_idx`  (`tanggal`),

  CONSTRAINT `LaporanPotensi_siswaId_fkey`
    FOREIGN KEY (`siswaId`) REFERENCES `Siswa` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `LaporanPotensi_jenisKebaikanId_fkey`
    FOREIGN KEY (`jenisKebaikanId`) REFERENCES `JenisKebaikan` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `LaporanPotensi_jenisPelanggaranId_fkey`
    FOREIGN KEY (`jenisPelanggaranId`) REFERENCES `JenisPelanggaran` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE

) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────
-- REQ-009: Dashboard Tugas & Nilai
-- ─────────────────────────────────────────────────────────────

-- Tambah kolom dashboard ke tabel Ujian
ALTER TABLE `Ujian`
  ADD COLUMN IF NOT EXISTS `masukkanKeDashboard` TINYINT(1)   NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `jenisNilai`          VARCHAR(191) NULL,
  ADD COLUMN IF NOT EXISTS `materiNilai`         VARCHAR(191) NULL;

-- Kolom nilai manual yang dibuat guru
CREATE TABLE IF NOT EXISTS `KolomNilai` (
  `id`            VARCHAR(191) NOT NULL,
  `judul`         VARCHAR(191) NOT NULL,
  `jenis`         VARCHAR(191) NOT NULL,
  `materi`        VARCHAR(191) NOT NULL,
  `mataPelajaran` VARCHAR(191) NOT NULL,
  `tanggal`       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `guruId`        VARCHAR(191) NOT NULL,
  `createdAt`     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  INDEX `KolomNilai_guruId_idx` (`guruId`),

  CONSTRAINT `KolomNilai_guruId_fkey`
    FOREIGN KEY (`guruId`) REFERENCES `Guru` (`id`)
    ON UPDATE CASCADE

) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Relasi banyak-ke-banyak KolomNilai ↔ Kelas
CREATE TABLE IF NOT EXISTS `KolomNilaiKelas` (
  `id`           VARCHAR(191) NOT NULL,
  `kolomNilaiId` VARCHAR(191) NOT NULL,
  `kelasId`      VARCHAR(191) NOT NULL,

  PRIMARY KEY (`id`),
  UNIQUE KEY `KolomNilaiKelas_kolomNilaiId_kelasId_key` (`kolomNilaiId`, `kelasId`),

  CONSTRAINT `KolomNilaiKelas_kolomNilaiId_fkey`
    FOREIGN KEY (`kolomNilaiId`) REFERENCES `KolomNilai` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `KolomNilaiKelas_kelasId_fkey`
    FOREIGN KEY (`kelasId`) REFERENCES `Kelas` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE

) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Nilai siswa per kolom nilai manual
CREATE TABLE IF NOT EXISTS `NilaiSiswa` (
  `id`           VARCHAR(191) NOT NULL,
  `kolomNilaiId` VARCHAR(191) NOT NULL,
  `siswaId`      VARCHAR(191) NOT NULL,
  `nilai`        DOUBLE       NULL,
  `keterangan`   TEXT         NULL,
  `createdAt`    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  UNIQUE KEY `NilaiSiswa_kolomNilaiId_siswaId_key` (`kolomNilaiId`, `siswaId`),
  INDEX `NilaiSiswa_siswaId_idx`      (`siswaId`),
  INDEX `NilaiSiswa_kolomNilaiId_idx` (`kolomNilaiId`),

  CONSTRAINT `NilaiSiswa_kolomNilaiId_fkey`
    FOREIGN KEY (`kolomNilaiId`) REFERENCES `KolomNilai` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `NilaiSiswa_siswaId_fkey`
    FOREIGN KEY (`siswaId`) REFERENCES `Siswa` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE

) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
