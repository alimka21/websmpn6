-- AlterTable: tambah kolom jam auto-checkout pada PengaturanPresensi
ALTER TABLE `PengaturanPresensi`
  ADD COLUMN `jamAutoCheckoutTrigger` VARCHAR(5) NOT NULL DEFAULT '18:00',
  ADD COLUMN `jamAutoCheckoutWaktu`   VARCHAR(5) NOT NULL DEFAULT '14:50';
