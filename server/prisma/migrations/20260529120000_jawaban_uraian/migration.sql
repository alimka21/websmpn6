-- Tambah kolom untuk jawaban teks (URAIAN_SINGKAT / ESAI) dan penilaian guru
ALTER TABLE `Jawaban` ADD COLUMN `jawabanTeks` TEXT NULL;
ALTER TABLE `Jawaban` ADD COLUMN `nilaiUraian` DOUBLE NULL;
ALTER TABLE `Jawaban` ADD COLUMN `catatanGuru` TEXT NULL;
