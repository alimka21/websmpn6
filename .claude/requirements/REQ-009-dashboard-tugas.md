# REQ-009: Dashboard Tugas & Nilai Siswa

**Status:** ✅ Implemented  
**Last Updated:** 2026-06-14  
**Depends On:** REQ-002 (Sistem Ujian)

---

## 📌 Overview

Dashboard rekapitulasi nilai siswa yang dapat diakses dari navbar landing page. Nilai bersumber dari dua sumber: (1) ujian online yang sudah dikerjakan siswa dan **ditandai guru untuk masuk ke dashboard**, dan (2) kolom nilai manual yang dibuat guru untuk penilaian di luar sistem ujian (ulangan lisan, praktek, tugas, dll). Kolom bersifat dinamis mengikuti daftar ujian/tugas yang ada.

---

## ✅ Keputusan Desain (Confirmed)

| # | Keputusan | Jawaban |
|---|-----------|---------|
| 1 | Akses dashboard | **Publik** — langsung diakses tanpa kode akses |
| 2 | Kolom tabel | **Dinamis** — mengikuti daftar ujian/tugas yang ada |
| 3 | Ujian online → dashboard | Guru **harus konfirmasi** per ujian apakah nilainya dimasukkan ke dashboard atau tidak |
| 4 | Kolom manual | Guru bisa tambah kolom non-ujian dengan field: **Judul, Jenis Tugas, Materi/Bab** |

---

## 🎯 Functional Requirements

### FR-009.1: Dashboard Tugas Publik

**Route:** `/dashboard-publik/tugas`  
**Akses:** Publik, dapat diakses dari dropdown "Dashboard" di navbar landing

**Filter:**
- Kelas (dropdown — wajib dipilih sebelum tabel tampil)
- Mata Pelajaran (dropdown — dinamis dari kolom yang ada, bisa "Semua")
- Tampilkan: Semua / Lengkap / Kurang Lengkap

**Tabel (kolom dinamis):**
| No | Nama Siswa | Kelas | [Kolom 1] | [Kolom 2] | ... | Keterangan |
|----|-----------|-------|----------|----------|-----|-----------|

- Header kolom = **judul** kolom (judul ujian atau judul tugas)
- Sub-header kolom = **jenis + materi** (contoh: "UH • Bab 3 Ekosistem")
- Nilai = angka 0–100, atau `—` jika belum ada
- **Keterangan:**
  - `Lengkap` — semua kolom sudah ada nilai
  - `Kurang Lengkap` — satu atau lebih kolom belum ada nilai
- Warna baris: normal jika lengkap, kuning jika kurang lengkap
- Kolom diurutkan berdasarkan tanggal pembuatan (ascending — terlama di kiri)
- Horizontal scroll jika kolom banyak
- Export Excel rekap sesuai filter aktif

**Sumber Data:**
1. **Ujian Online** — dari `SesiUjian.nilaiAkhir` WHERE `Ujian.masukkanKeDashboard = true`
2. **Tugas Manual** — dari `NilaiTugas` (model baru)

### FR-009.2: Konfirmasi Ujian Online → Dashboard (Guru)

**Lokasi:** Dashboard Guru → DaftarUjian → tombol per ujian  
**Behavior:**

Di halaman `DaftarUjian.tsx`, setiap ujian yang statusnya sudah ada peserta selesai memiliki toggle:

```
[☐] Masukkan nilai ujian ini ke Dashboard Tugas
    Jenis: [UH ▼]   Materi/Bab: [________________]
```

- Saat toggle diaktifkan → form jenis + materi/bab muncul, wajib diisi
- Simpan → update field `Ujian.masukkanKeDashboard = true` + `Ujian.jenisNilai` + `Ujian.materiNilai`
- Guru bisa matikan toggle kembali → ujian tidak tampil di dashboard
- Satu ujian bisa di-toggle dari beberapa kelas target

**Field baru di model `Ujian`:**
```prisma
masukkanKeDashboard Boolean @default(false)
jenisNilai          String? // UH | UTS | UAS | PR | PRAKTEK | LAINNYA
materiNilai         String? // Bab/topik, opsional
```

### FR-009.3: Tambah Kolom Manual (Guru)

**Lokasi:** Dashboard Guru → Menu **"Nilai & Tugas"**  
**Route:** `/dashboard/guru/nilai-tugas`  
**File:** `src/pages/dashboard/guru/NilaiTugas.tsx`

#### Tab A: Daftar Kolom Nilai

Guru melihat daftar semua kolom nilai yang sudah dibuat:
| No | Judul | Jenis | Materi/Bab | Kelas | Tgl Dibuat | Aksi |
|----|-------|-------|-----------|-------|-----------|------|

Tombol **"Tambah Kolom Nilai"** → form:

| Field | Tipe | Wajib | Contoh |
|-------|------|-------|--------|
| Judul | Text | ✅ | "Ulangan Lisan Bab 4" |
| Jenis Tugas | Dropdown | ✅ | UH / UTS / UAS / PR / Ulangan Lisan / Praktek / Lainnya |
| Materi / Bab | Text | ✅ | "Bab 4 — Sistem Pencernaan" |
| Mata Pelajaran | Text | ✅ | "Biologi" |
| Kelas Target | Multi-select | ✅ | Kelas X IPA 1, X IPA 2 |
| Tanggal | Date | ✅ | default hari ini |

Setelah submit → kolom terbuat, muncul di tab "Input Nilai"

#### Tab B: Input Nilai

1. Pilih Kolom Nilai (dropdown)
2. Tampil grid siswa dari kelas target:
   | Nama Siswa | NIS | Kelas | Nilai (0–100) | Keterangan |
   |-----------|-----|-------|--------------|-----------|
3. Input nilai per siswa — **auto-save on blur** (1 detik debounce)
4. Indikator "Tersimpan ✓" per baris setelah save

**Aturan:**
- Nilai `null` artinya belum diinput (berbeda dengan nilai 0)
- Guru hanya bisa input nilai untuk kolom yang dia buat sendiri
- Admin bisa lihat semua kolom dari semua guru

---

## 🗄️ Schema Baru & Perubahan

### Model baru

```prisma
// Container kolom nilai manual yang dibuat guru (non-ujian)
model KolomNilai {
  id            String   @id @default(uuid())
  judul         String
  jenis         String   // UH | UTS | UAS | PR | ULANGAN_LISAN | PRAKTEK | LAINNYA
  materi        String   // Bab/topik — wajib diisi
  mataPelajaran String
  tanggal       DateTime @default(now())
  guruId        String
  guru          Guru     @relation(fields: [guruId], references: [id])
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  kelasTarget KolomNilaiKelas[]
  nilai       NilaiSiswa[]

  @@index([guruId])
}

// Many-to-many KolomNilai ↔ Kelas
model KolomNilaiKelas {
  id           String     @id @default(uuid())
  kolomNilaiId String
  kolomNilai   KolomNilai @relation(fields: [kolomNilaiId], references: [id], onDelete: Cascade)
  kelasId      String
  kelas        Kelas      @relation(fields: [kelasId], references: [id], onDelete: Cascade)

  @@unique([kolomNilaiId, kelasId])
}

// Nilai siswa per kolom nilai manual
model NilaiSiswa {
  id           String     @id @default(uuid())
  kolomNilaiId String
  kolomNilai   KolomNilai @relation(fields: [kolomNilaiId], references: [id], onDelete: Cascade)
  siswaId      String
  siswa        Siswa      @relation(fields: [siswaId], references: [id], onDelete: Cascade)
  nilai        Float?     // null = belum diinput, 0 = nol
  keterangan   String?    @db.Text
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt

  @@unique([kolomNilaiId, siswaId])
  @@index([siswaId])
  @@index([kolomNilaiId])
}
```

### Perubahan model `Ujian` (sudah ada)

```prisma
// Tambah field berikut ke model Ujian yang sudah ada:
masukkanKeDashboard Boolean @default(false) // Toggle guru untuk masuk ke Dashboard Tugas
jenisNilai          String? // UH | UTS | UAS | PR | PRAKTEK | LAINNYA (diisi saat toggle ON)
materiNilai         String? // Bab/topik opsional
```

### Relasi baru di model yang sudah ada

```prisma
// Di model Guru:
kolomNilai KolomNilai[]

// Di model Siswa:
nilaiSiswa NilaiSiswa[]

// Di model Kelas:
kolomNilaiKelas KolomNilaiKelas[]
```

---

## 🗂️ File Struktur (Planned)

```
Frontend:
├── src/pages/public-dashboard/
│   └── DashboardTugas.tsx                  ← Halaman dashboard publik
└── src/pages/dashboard/guru/
    ├── NilaiTugas.tsx                      ← Kelola kolom nilai + input nilai manual
    └── DaftarUjian.tsx                     ← Tambah toggle "Masukkan ke Dashboard"

Backend:
├── server/routes/public.ts                 ← GET /api/public/dashboard/tugas
├── server/routes/guru.ts                   ← CRUD KolomNilai + input NilaiSiswa
│                                              PATCH /api/guru/ujian/:id/dashboard-toggle
└── prisma/schema.prisma
    ├── KolomNilai
    ├── KolomNilaiKelas
    ├── NilaiSiswa
    └── Ujian (tambah 3 field)
```

---

## 🧪 API Endpoints (Planned)

```
# Publik
GET  /api/public/dashboard/tugas
     Query: ?kelasId=&mataPelajaran=&filter=semua|lengkap|kurang
     Response: {
       columns: [
         { id, judul, jenis, materi, mataPelajaran, sumber: 'ujian'|'manual', tanggal }
       ],
       rows: [
         { siswaId, nama, kelas, nilai: { [colId]: number | null }, keterangan: 'Lengkap'|'Kurang Lengkap' }
       ]
     }

# Guru — Kolom Nilai Manual
GET    /api/guru/kolom-nilai                ← List kolom nilai milik guru
POST   /api/guru/kolom-nilai                ← Tambah kolom nilai baru
PATCH  /api/guru/kolom-nilai/:id            ← Edit kolom nilai
DELETE /api/guru/kolom-nilai/:id            ← Hapus kolom nilai

GET    /api/guru/kolom-nilai/:id/nilai      ← List siswa + nilai untuk kolom ini
POST   /api/guru/kolom-nilai/:id/nilai      ← Batch upsert nilai
       Body: { entries: [{ siswaId, nilai, keterangan }] }

# Guru — Toggle Ujian ke Dashboard
PATCH  /api/guru/ujian/:id/dashboard-toggle
       Body: { masukkanKeDashboard: boolean, jenisNilai?: string, materiNilai?: string }
```

---

## 📊 Logic Dashboard Terpadu

```
Ambil kolom ujian:
  Ujian WHERE masukkanKeDashboard = true AND kelas IN (filter kelas)
  → { id: 'ujian_<id>', judul, jenis: jenisNilai, materi: materiNilai, sumber: 'ujian' }

Ambil kolom manual:
  KolomNilai WHERE kelasId IN (filter kelas)
  → { id: 'manual_<id>', judul, jenis, materi, sumber: 'manual' }

Untuk setiap siswa di kelas:
  Ujian: nilai = SesiUjian.nilaiAkhir WHERE ujianId = colId AND siswaId = siswaId
  Manual: nilai = NilaiSiswa.nilai WHERE kolomNilaiId = colId AND siswaId = siswaId

Pivot → satu row per siswa, nilai per kolom
Keterangan = 'Kurang Lengkap' jika ada nilai null, else 'Lengkap'
```

---

## 📝 Notes

- Nama model `KolomNilai` dan `NilaiSiswa` dipilih agar tidak bentrok dengan model `SesiUjian`/`Jawaban` yang sudah ada
- Kolom diurutkan ascending berdasarkan `tanggal` — ujian/tugas terlama muncul di kiri
- Horizontal scroll untuk tabel jika kolom > 6
- Guru hanya bisa toggle ujian yang dia buat sendiri
- Toggle OFF tidak menghapus data nilai ujian — hanya tidak tampil di dashboard
- `NilaiSiswa.nilai = null` artinya belum diinput, berbeda dengan nilai 0
