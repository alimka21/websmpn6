# REQ-007: Dashboard Kehadiran Siswa

**Status:** ✅ Implemented  
**Last Updated:** 2026-06-14  
**Depends On:** REQ-003 (Presensi Siswa)

---

## 📌 Overview

Dashboard publik yang dapat diakses dari navbar landing page untuk memantau rekapitulasi kehadiran siswa per hari, rentang tanggal, atau keseluruhan. Memudahkan guru dan wali kelas memantau ketidakhadiran siswa, serta membantu proses kenaikan kelas dengan rekap lengkap.

---

## ✅ Keputusan Desain (Confirmed)

| # | Keputusan | Jawaban |
|---|-----------|---------|
| 1 | Akses dashboard | **Publik** — langsung diakses tanpa kode akses |
| 2 | Lokasi input absensi | **Dua tempat** — dashboard guru (Input Absensi) DAN PresensiAdmin (tab baru) |
| 3 | Perhitungan % kehadiran | Berdasarkan total hari yang tercatat, bukan kalender akademik |

---

## 🎯 Functional Requirements

### FR-007.1: Navbar Landing Page — Dropdown Dashboard

Tambah item **"Dashboard"** di navbar landing page (desktop & mobile) dengan dropdown:
- **Dashboard Kehadiran** → `/dashboard-publik/kehadiran`
- **Dashboard Potensi** → `/dashboard-publik/potensi`
- **Dashboard Tugas** → `/dashboard-publik/tugas`

**Akses:** Publik — langsung dapat diakses tanpa login dan tanpa kode akses.

### FR-007.2: Halaman Dashboard Kehadiran

**Route:** `/dashboard-publik/kehadiran`

**Filter:**
- **Mode tanggal:** Hari Ini (default) | Rentang Tanggal (date picker Dari–Sampai) | Semua Data
- **Filter Kelas:** Semua Kelas / pilih kelas tertentu (dropdown)

**Summary Card di Atas Tabel:**
- Total Siswa (sesuai filter kelas)
- Hadir
- Sakit
- Izin
- Alfa

**Tabel Rekap:**
| No | Nama Siswa | Kelas | Hadir | Sakit | Izin | Alfa | Total Hari | % Kehadiran |
|----|-----------|-------|-------|-------|------|------|-----------|------------|

- **Hadir** — dihitung dari `PresensiSiswa` (kiosk, sudah ada)
- **Sakit / Izin / Alfa** — dihitung dari `AbsensiSiswa` (model baru, input guru/admin)
- **Total Hari** — Hadir + Sakit + Izin + Alfa
- **% Kehadiran** — (Hadir ÷ Total Hari) × 100, dibulatkan 1 desimal
- Sort default: nama siswa A–Z
- Siswa yang tidak ada data sama sekali di rentang filter = tidak muncul di tabel

**Export:** Tombol "Export Excel" — ekspor rekap sesuai filter aktif

### FR-007.3: Input Ketidakhadiran — Dashboard Guru

`PresensiSiswa` hanya mencatat **hadir** (via kiosk). Ketidakhadiran (Sakit/Izin/Alfa) harus diinput manual.

**Lokasi:** Dashboard Guru → Menu **"Absensi"**  
**Route:** `/dashboard/guru/absensi`  
**File:** `src/pages/dashboard/guru/InputAbsensi.tsx`

**Flow Input:**
1. Pilih tanggal (default: hari ini)
2. Pilih kelas → muncul daftar semua siswa di kelas tersebut
3. Untuk setiap siswa tampilkan:
   - Status kiosk: `✅ Hadir` (jika sudah ada `PresensiSiswa`) — non-editable
   - Status manual: dropdown `Hadir / Sakit / Izin / Alfa` — hanya aktif jika belum ada data kiosk
   - Field keterangan (opsional)
4. Tombol "Simpan Absensi" → batch upsert ke `AbsensiSiswa`
5. Toast sukses + data tersimpan

**Aturan:**
- Jika siswa sudah hadir via kiosk → status di form locked sebagai "Hadir", tidak perlu input
- Satu record per `(siswaId, tanggal)` — upsert jika sudah ada

### FR-007.4: Input Ketidakhadiran — Admin

**Lokasi:** Halaman `PresensiAdmin.tsx` → Tab baru **"Input Absensi"**

**Fitur tambahan vs guru:**
- Bisa input untuk semua kelas (bukan hanya kelas wali)
- Bisa edit / hapus record `AbsensiSiswa` yang sudah tersimpan
- Tabel riwayat input absensi dengan filter tanggal & kelas
- Export Excel riwayat absensi

---

## 🗄️ Schema Baru

```prisma
// Ketidakhadiran siswa yang diinput manual oleh guru/admin
model AbsensiSiswa {
  id          String   @id @default(uuid())
  siswaId     String
  siswa       Siswa    @relation(fields: [siswaId], references: [id], onDelete: Cascade)
  guruId      String?  // guru yang menginput (null jika diinput admin)
  tanggal     DateTime // DATE saja (tanpa jam)
  status      String   // SAKIT | IZIN | ALFA
  keterangan  String?  @db.Text
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([siswaId, tanggal])
  @@index([tanggal])
  @@index([siswaId])
  @@index([guruId])
}
```

**Relasi baru di model yang sudah ada:**
```prisma
// Di model Siswa:
absensi AbsensiSiswa[]

// Di model Guru (opsional — untuk audit trail):
absensiInput AbsensiSiswa[]
```

---

## 🗂️ File Struktur (Planned)

```
Frontend:
├── src/pages/public-dashboard/
│   └── DashboardKehadiran.tsx          ← Halaman publik
└── src/pages/dashboard/
    ├── guru/InputAbsensi.tsx           ← Form input absensi (guru)
    └── PresensiAdmin.tsx               ← Tambah tab "Input Absensi" (admin)

Backend:
├── server/routes/public.ts            ← GET  /api/public/dashboard/kehadiran
├── server/routes/guru.ts              ← POST /api/guru/absensi
│                                         GET  /api/guru/absensi
└── server/routes/admin.ts             ← GET/PUT/DELETE /api/admin/absensi
                                          GET  /api/admin/absensi/export
└── prisma/schema.prisma
    └── AbsensiSiswa                   ← Model baru
```

---

## 🧪 API Endpoints (Planned)

```
# Publik
GET  /api/public/dashboard/kehadiran
     Query: ?mode=hari|rentang|semua
            &tanggal=YYYY-MM-DD            ← jika mode=hari
            &dari=YYYY-MM-DD&sampai=YYYY-MM-DD  ← jika mode=rentang
            &kelasId=xxx                   ← opsional
     Response: {
       summary: { totalSiswa, hadir, sakit, izin, alfa },
       rows: [{ siswaId, nama, kelas, hadir, sakit, izin, alfa, totalHari, persen }]
     }

# Guru
POST /api/guru/absensi
     Body: { tanggal, kelasId, entries: [{ siswaId, status, keterangan }] }
     Response: { saved: number }

GET  /api/guru/absensi
     Query: ?tanggal=&kelasId=
     Response: { siswaList: [{ siswaId, nama, statusKiosk, statusManual, keterangan }] }

# Admin
GET    /api/admin/absensi
       Query: ?dari=&sampai=&kelasId=&page=
PUT    /api/admin/absensi/:id         ← Edit satu record
DELETE /api/admin/absensi/:id         ← Hapus satu record
GET    /api/admin/absensi/export      ← Export Excel
```

---

## 📝 Notes

- `PresensiSiswa` (hadir kiosk) dan `AbsensiSiswa` (tidak hadir manual) adalah dua tabel berbeda yang digabung di query dashboard
- Siswa yang tidak ada di kedua tabel untuk tanggal tertentu = **tidak ditampilkan** (data belum diinput, bukan otomatis Alfa)
- Guru input absensi terbatas pada kelas yang diajarnya (wali kelas); admin bisa semua kelas
- Export Excel pakai ExcelJS (sudah ada di project)
- Timezone handling sama dengan `PresensiSiswa`: gunakan date range `gte start, lt end` bukan exact match
