# REQ-002: Sistem Ujian

**Status:** ✅ Implemented  
**Last Updated:** 2026-06-06

---

## 📌 Overview

Sistem ujian online dengan anti-cheat, timer, auto-submit, dan laporan nilai.

---

## 🎯 Functional Requirements

### FR-002.1: Buat Ujian (Guru)
- Form: judul, mata pelajaran, tipe ujian, durasi (menit), tanggal mulai/selesai
- Pilih kelas target (multiple select)
- Setting: acak soal, acak opsi, tampilkan pembahasan, tampilkan nilai
- Auto-create sesi ujian untuk semua siswa di kelas terpilih

**File:** `src/pages/dashboard/guru/BuatUjian.tsx`

### FR-002.2: Kelola Soal
- Tambah soal: Pilihan Ganda (PG) atau Essay
- PG: 2-5 opsi, tandai jawaban benar
- Essay: Teks bebas, penilaian manual
- Import soal dari Excel (bulk upload)
- Edit/Delete soal

**File:** `src/pages/dashboard/guru/KelolaSoal.tsx`

### FR-002.3: Kerjakan Ujian (Siswa)
- **Pre-exam screen:**
  - Instruksi ujian
  - Tombol "Mulai dalam Layar Penuh" (fullscreen required)
  - Timer countdown
- **During exam:**
  - Navigasi soal (prev/next, jump to number)
  - Auto-save jawaban (debounce 500ms)
  - Timer warning (5 menit terakhir → kuning, 1 menit → merah)
  - Anti-cheat monitoring
- **Auto-submit:** Saat waktu habis atau pelanggaran >= 3x

**File:** `src/pages/exam/TakeExam.tsx`

### FR-002.4: Anti-Cheat System
- **Deteksi:**
  - Tab switch / minimize browser
  - Keluar dari fullscreen
  - Window blur (fokus ke aplikasi lain)
  - Buka DevTools (F12, Ctrl+Shift+I)
  - Right-click (context menu disabled)
- **Action:**
  - Play alarm sound (Web Audio API)
  - Tampilkan warning modal
  - Catat pelanggaran ke database
  - Auto-submit jika >= 3x pelanggaran
- **iOS Support:** Skip fullscreen (tidak didukung), tetap deteksi tab switch

**File:** `src/hooks/useAntiCheat.ts`

### FR-002.5: Hasil & Nilai
- **Siswa:** Lihat nilai, jawaban benar/salah, pembahasan (jika diaktifkan guru)
- **Guru:** Lihat daftar siswa, nilai, waktu pengerjaan, pelanggaran
- Export nilai ke Excel

**Files:** 
- `src/pages/dashboard/siswa/HasilUjian.tsx`
- `src/pages/dashboard/guru/DaftarUjian.tsx`

---

## 🗂️ File Struktur

```
Frontend:
├── src/pages/dashboard/guru/
│   ├── BuatUjian.tsx              ← Form buat ujian
│   ├── KelolaSoal.tsx             ← CRUD soal
│   └── DaftarUjian.tsx            ← List ujian + hasil
├── src/pages/exam/
│   └── TakeExam.tsx               ← Halaman kerjakan ujian
├── src/pages/dashboard/siswa/
│   ├── SiswaDashboard.tsx         ← List ujian tersedia
│   └── HasilUjian.tsx             ← Lihat hasil & nilai
└── src/hooks/
    ├── useAntiCheat.ts            ← Anti-cheat hook
    └── useExamTimer.ts            ← Timer countdown

Backend:
├── server/routes/guru.ts          ← CRUD ujian & soal
├── server/routes/siswa.ts         ← Start exam, submit, violation
└── prisma/schema.prisma
    ├── Ujian                      ← Data ujian
    ├── Soal                       ← Data soal
    ├── OpsiJawaban                ← Opsi untuk soal PG
    ├── SesiUjian                  ← Instance ujian per siswa
    ├── JawabanSiswa               ← Jawaban siswa (PG)
    ├── JawabanEssay               ← Jawaban essay
    └── Pelanggaran                ← Log anti-cheat violations
```

---

## 🔄 Flow Diagram

```
GURU:
1. Buat Ujian → Set config → Pilih kelas
2. Kelola Soal → Tambah/Import soal
3. Siswa kerjakan → Auto-generate SesiUjian
4. Lihat hasil → Export nilai

SISWA:
1. Login → Dashboard → Lihat ujian tersedia
2. Klik ujian → Pre-exam screen
3. Klik "Mulai Layar Penuh" → Fullscreen + Anti-cheat ON
4. Kerjakan soal → Auto-save → Submit (manual/auto)
5. Lihat hasil → Nilai + pembahasan
```

---

## 🧪 API Endpoints

### Guru:
- `POST /api/guru/ujian` → Buat ujian baru
- `GET /api/guru/ujian` → List ujian
- `GET /api/guru/ujian/:id` → Detail ujian
- `PATCH /api/guru/ujian/:id` → Update ujian
- `DELETE /api/guru/ujian/:id` → Hapus ujian
- `POST /api/guru/ujian/:id/soal` → Tambah soal
- `POST /api/guru/ujian/:id/import-soal` → Import Excel

### Siswa:
- `GET /api/siswa/ujian` → List ujian tersedia
- `GET /api/siswa/sesi/:sessionId` → Data sesi ujian
- `POST /api/siswa/sesi/:sessionId/jawab` → Save jawaban
- `POST /api/siswa/sesi/:sessionId/submit` → Submit ujian
- `POST /api/siswa/sesi/:sessionId/violation` → Log pelanggaran
- `GET /api/siswa/hasil/:sessionId` → Hasil ujian

---

## 🐛 Known Issues

### ISS-001: Anti-cheat tidak tercatat (FIXED 2026-06-06)
- **Problem:** Tab switch tidak tercatat di database, audio tidak bunyi
- **Root Cause:** 
  - Debounce 400ms terlalu lama (user balik sebelum trigger)
  - AudioContext blocked oleh browser autoplay policy
  - Missing console.log untuk debugging
- **Fix:** 
  - Tambahkan logging lengkap
  - Init AudioContext saat user click "Mulai Ujian"
  - Resume AudioContext jika suspended
  - Volume alarm dinaikkan 0.1 → 0.3
- **File Changed:** `src/hooks/useAntiCheat.ts`

### ISS-002: Hostinger firewall block create ujian (FIXED 2026-06-06)
- **Problem:** POST `/api/guru/ujian` return HTML challenge page
- **Root Cause:** Hostinger CDN/firewall menganggap request sebagai bot
- **Fix:**
  - Deteksi HTML response di `src/lib/api.ts`
  - Retry mechanism 3x dengan delay incremental (2s, 4s, 6s)
  - Toast notification untuk setiap retry
  - Timeout diperpanjang ke 30s
- **File Changed:** `src/lib/api.ts`, `src/pages/dashboard/guru/BuatUjian.tsx`

---

## 📝 Notes

- Timer disimpan di `useExamTimer` hook dengan auto-sync ke server setiap 10 detik
- Jawaban auto-save dengan debounce 500ms (prevent spam API)
- Nilai PG otomatis dihitung, Essay perlu penilaian manual guru
- Acak soal menggunakan seed dari sessionId (konsisten per siswa)
