# REQ-008: Dashboard Potensi Siswa (Kebaikan & Pelanggaran)

**Status:** 📝 Planned  
**Last Updated:** 2026-06-14

---

## ✅ Keputusan Desain (Confirmed)

| # | Keputusan | Jawaban |
|---|-----------|---------|
| 1 | Akses Dashboard Potensi | **Publik** — langsung diakses tanpa kode akses |
| 2 | Akses Form Lapor | **Publik** — siapapun bisa lapor, admin bisa hapus laporan tidak valid |

---

## 📌 Overview

Sistem pencatatan poin kebaikan dan pelanggaran siswa. Guru BK dan guru lain bisa melaporkan pelanggaran atau kebaikan siswa melalui form "Lapor" di landing page. Admin mengelola database jenis kebaikan/pelanggaran beserta poin-nya. Dashboard publik menampilkan rekap poin per siswa.

---

## 🎯 Functional Requirements

### FR-008.1: Navbar Landing Page — Menu Lapor

Tambah item **"Lapor"** di navbar landing page (sejajar dengan Dashboard, Login Portal, dsb).

**Route:** `/lapor`  
**Akses:** Publik (tanpa login) — siapapun (utamanya guru) bisa mengisi form.

**Form Laporan:**
| Field | Tipe | Wajib | Keterangan |
|-------|------|-------|-----------|
| Nama Pelapor | Text | ✅ | Nama guru yang melapor |
| Nama Siswa | Search/Select | ✅ | Search by nama atau NIS, tampil dropdown |
| Kelas | Auto-fill | ✅ | Terisi otomatis setelah pilih siswa |
| Tipe Laporan | Toggle | ✅ | KEBAIKAN / PELANGGARAN |
| Jenis | Select | ✅ | Dropdown dari DB sesuai tipe terpilih (nama + poin) |
| Bukti Foto | File Upload | ❌ | Opsional, max 5MB, jpg/png |
| Keterangan | Textarea | ❌ | Catatan tambahan |
| Submit | Button | — | Tampilkan toast sukses + reset form |

**Flow:**
1. Pilih tipe (Kebaikan/Pelanggaran) → Jenis dropdown berubah sesuai tipe
2. Pilih jenis → Tampilkan poin otomatis (contoh: "Terlambat — 5 poin")
3. Submit → Simpan ke `LaporanPotensi` → Toast "Laporan berhasil dikirim"
4. Form reset, siap laporan berikutnya

### FR-008.2: Admin — Fitur Potensi

**Route:** `/dashboard/admin/potensi`  
Halaman admin dengan tab:

#### Tab 1: DB Kebaikan
- Tabel: No, Nama Jenis Kebaikan, Poin, Aksi (Edit/Hapus)
- Tombol "Tambah Kebaikan" → Form: Nama, Poin (1–100)
- Edit inline atau modal
- Contoh data: Juara lomba (50 poin), Membantu teman (10 poin), Disiplin (5 poin)

#### Tab 2: DB Pelanggaran
- Tabel: No, Nama Jenis Pelanggaran, Poin, Aksi (Edit/Hapus)
- Tombol "Tambah Pelanggaran" → Form: Nama, Poin (1–100)
- Contoh data: Terlambat (5 poin), Bolos (20 poin), Berkelahi (50 poin)

#### Tab 3: Rekapitulasi Laporan
- Filter: tanggal, tipe (semua/kebaikan/pelanggaran), kelas, nama siswa
- Tabel: No, Tgl, Nama Siswa, Kelas, Tipe, Jenis, Poin, Pelapor, Keterangan, Foto, Aksi (Hapus)
- Tombol Export Excel semua laporan yang terfilter

#### Tab 4: Export Per Siswa (DOCX)
- Search siswa (nama atau NIS)
- Pilih rentang tanggal (opsional)
- Tombol Generate DOCX
- **Isi dokumen DOCX:**
  ```
  REKAPITULASI POTENSI SISWA
  ══════════════════════════
  Nama    : [Nama Siswa]
  NIS     : [NIS]
  Kelas   : [Nama Kelas]
  Periode : [Dari] s/d [Sampai]

  TABEL KEBAIKAN
  No | Tanggal | Jenis Kebaikan | Poin | Pelapor | Keterangan

  TABEL PELANGGARAN
  No | Tanggal | Jenis Pelanggaran | Poin | Pelapor | Keterangan

  REKAP AKHIR
  ───────────────────────────────
  Total Poin Kebaikan   : XX
  Total Poin Pelanggaran: XX
  Poin Neto (Baik-Langgar): XX
  Status                : POSITIF / NEGATIF
  ```
- Gunakan library `docx` (npm install docx)

### FR-008.3: Dashboard Potensi Publik

**Route:** `/dashboard-publik/potensi`  
**Akses:** Publik, dapat diakses dari dropdown "Dashboard" di navbar landing

**Filter:**
- Rentang tanggal
- Kelas
- Tampilkan: Semua / Hanya Positif (neto > 0) / Hanya Negatif (neto < 0)

**Tabel:**
| No | Nama Siswa | Kelas | Poin Kebaikan | Poin Pelanggaran | Total Neto |
|----|-----------|-------|--------------|-----------------|-----------|

- **Total Neto** = Poin Kebaikan − Poin Pelanggaran
- Warna Total Neto: hijau jika positif, merah jika negatif, abu jika 0
- Sort default: Total Neto descending (siswa terbaik di atas)

---

## 🗄️ Schema Baru

```prisma
// Jenis kebaikan yang dikelola admin, berisi poin masing-masing
model JenisKebaikan {
  id        String   @id @default(uuid())
  nama      String
  poin      Int
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  laporan LaporanPotensi[]
}

// Jenis pelanggaran yang dikelola admin, berisi poin masing-masing
model JenisPelanggaran {
  id        String   @id @default(uuid())
  nama      String
  poin      Int
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  laporan LaporanPotensi[]
}

// Setiap laporan kebaikan/pelanggaran yang diajukan guru
model LaporanPotensi {
  id                 String   @id @default(uuid())
  siswaId            String
  siswa              Siswa    @relation(fields: [siswaId], references: [id], onDelete: Cascade)
  namaPelapor        String   // Nama guru (tidak harus login)
  tipe               String   // KEBAIKAN | PELANGGARAN
  jenisKebaikanId    String?
  jenisKebaikan      JenisKebaikan?    @relation(fields: [jenisKebaikanId], references: [id])
  jenisPelanggaranId String?
  jenisPelanggaran   JenisPelanggaran? @relation(fields: [jenisPelanggaranId], references: [id])
  poin               Int      // Snapshot poin saat laporan dibuat (agar tidak berubah jika DB diedit)
  buktiUrl           String?  @db.LongText  // Base64 atau URL foto
  keterangan         String?  @db.Text
  tanggal            DateTime @default(now())
  createdAt          DateTime @default(now())

  @@index([siswaId])
  @@index([tipe])
  @@index([tanggal])
}
```

**Relasi baru di model `Siswa`:**
```prisma
laporanPotensi LaporanPotensi[]
```

---

## 🗂️ File Struktur (Planned)

```
Frontend:
├── src/pages/
│   ├── LaporPotensi.tsx                    ← Form lapor publik (/lapor)
│   └── public-dashboard/
│       └── DashboardPotensi.tsx            ← Dashboard publik
└── src/pages/dashboard/admin/
    └── AdminPotensi.tsx                    ← Kelola DB + rekap + export

Backend:
├── server/routes/public.ts                 ← POST /api/public/laporan-potensi
│                                              GET  /api/public/dashboard/potensi
├── server/routes/admin.ts                  ← CRUD jenis kebaikan/pelanggaran
│                                              GET  /api/admin/potensi/rekap
│                                              GET  /api/admin/potensi/export-excel
│                                              POST /api/admin/potensi/export-docx/:siswaId
└── prisma/schema.prisma
    ├── JenisKebaikan
    ├── JenisPelanggaran
    └── LaporanPotensi
```

---

## 🧪 API Endpoints (Planned)

```
# Publik
GET  /api/public/jenis-kebaikan             ← Untuk dropdown form lapor
GET  /api/public/jenis-pelanggaran          ← Untuk dropdown form lapor
POST /api/public/laporan-potensi            ← Submit laporan dari form publik
GET  /api/public/dashboard/potensi          ← Data tabel dashboard publik
     Query: ?dari=&sampai=&kelasId=&filter=semua|positif|negatif

# Admin
GET  /api/admin/jenis-kebaikan              ← List (include inactive)
POST /api/admin/jenis-kebaikan              ← Tambah
PUT  /api/admin/jenis-kebaikan/:id          ← Edit
DELETE /api/admin/jenis-kebaikan/:id        ← Hapus (soft delete)

GET  /api/admin/jenis-pelanggaran
POST /api/admin/jenis-pelanggaran
PUT  /api/admin/jenis-pelanggaran/:id
DELETE /api/admin/jenis-pelanggaran/:id

GET  /api/admin/potensi/rekap               ← Semua laporan (admin view)
     Query: ?dari=&sampai=&tipe=&kelasId=&siswaId=
DELETE /api/admin/potensi/laporan/:id       ← Hapus laporan
GET  /api/admin/potensi/export-excel        ← Export rekap ke Excel
POST /api/admin/potensi/export-docx         ← Generate DOCX per siswa
     Body: { siswaId, dari?, sampai? }
```

---

## 📦 Dependency Baru

```
npm install docx    ← Generate DOCX (server-side)
```

---

## 📝 Notes

- Poin di `LaporanPotensi.poin` adalah snapshot — tidak ikut berubah jika admin edit poin jenis di kemudian hari
- Foto bukti disimpan sebagai base64 di DB (konsisten dengan presensi) atau URL jika ada CDN
- Form lapor tidak perlu login → siapapun bisa lapor → admin bisa hapus laporan yang tidak valid
- Guru BK adalah pengguna utama fitur Export DOCX per siswa
