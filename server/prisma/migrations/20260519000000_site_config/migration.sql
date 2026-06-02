-- CreateTable
CREATE TABLE `SiteConfig` (
    `id`             VARCHAR(191) NOT NULL,
    `namaSekolah`    VARCHAR(191) NOT NULL DEFAULT 'Sekolah Hebat',
    `tagline`        TEXT NULL,
    `deskripsi`      TEXT NULL,

    `logoUrl`        LONGTEXT NULL,
    `faviconUrl`     LONGTEXT NULL,
    `heroImageUrl`   LONGTEXT NULL,
    `heroBadge`      VARCHAR(191) NULL,
    `heroTitle`      TEXT NULL,
    `heroSubtitle`   TEXT NULL,
    `profilImageUrl` LONGTEXT NULL,
    `sejarah`        LONGTEXT NULL,

    `visi`           TEXT NULL,
    `misi`           TEXT NULL,
    `tujuan`         TEXT NULL,

    `alamat`         TEXT NULL,
    `telepon`        VARCHAR(191) NULL,
    `email`          VARCHAR(191) NULL,
    `whatsapp`       VARCHAR(191) NULL,

    `facebook`       VARCHAR(191) NULL,
    `instagram`      VARCHAR(191) NULL,
    `twitter`        VARCHAR(191) NULL,
    `youtube`        VARCHAR(191) NULL,
    `tiktok`         VARCHAR(191) NULL,

    `updatedAt`      DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
