# REQ-003: Presensi Guru & Siswa

**Status:** ✅ Implemented  
**Last Updated:** 2026-06-06

---

## 📌 Overview

Sistem presensi berbasis kiosk dengan camera face detection dan GPS location tracking.

---

## 🎯 Functional Requirements

### FR-003.1: Presensi Guru (Kiosk Mode)
- **UI Layout:**
  - Full width identifikasi diri (search by nama/NIP)
  - Status kamera & lokasi aktif (berdampingan di bawah search)
  - Setelah pilih guru → Live preview kamera + status terkini + tombol TAP DATANG/PULANG
- **Flow:**
  1. Kamera & GPS auto-request permission saat page load
  2. Guru search nama → pilih dari dropdown
  3. Status kamera/lokasi update: "Aktif Terkini" → "Siap Mengambil Foto"
  4. Live preview kamera 400px height
  5. Tombol TAP DATANG (hijau) atau TAP PULANG (biru)
  6. Capture foto + koordinat GPS → Submit ke server
  7. Success overlay → Auto-reset form 3 detik
- **Anti-Duplicate:** Guru yang sudah datang & pulang hari ini disabled (opacity 50%)

**File:** `src/pages/PresensiGuruKiosk.tsx`

### FR-003.2: Presensi Siswa (Kiosk Mode)
- **UI Layout:**
  - Header dengan logo sekolah, jam digital real-time
  - Status cards: Total siswa, Hadir hari ini, Belum hadir (per kelas)
  - Tab toggle: "Hadir" dan "Belum Hadir" (filter per kelas)
  - Tabel aktivitas real-time
- **Flow:**
  1. Similar dengan guru: Search NIS → Pilih siswa
  2. Camera + GPS capture
  3. Submit → Update count real-time
  4. Auto-refresh tabel setiap 30 detik (polling)
- **Filter Kelas:** Dropdown "Semua Kelas" atau pilih kelas tertentu
- **Count Bug Fixed:** Filtered count sync dengan kelas terpilih

**File:** `src/pages/PresensiSiswaKiosk.tsx`

### FR-003.3: Dashboard Presensi (Admin/Guru)
- Lihat rekap harian/bulanan
- Filter by kelas, tanggal range
- Export ke Excel
- Grafik kehadiran (Recharts)

**File:** `src/pages/dashboard/Attendance.tsx`

---

## 🗂️ File Struktur

```
Frontend:
├── src/pages/
│   ├── PresensiGuruKiosk.tsx      ← Kiosk presensi guru
│   ├── PresensiSiswaKiosk.tsx     ← Kiosk presensi siswa
│   └── dashboard/
│       └── Attendance.tsx         ← Dashboard rekap presensi

Backend:
├── server/routes/presensi.ts      ← API presensi
│   ├── POST /api/presensi/guru    ← Submit presensi guru
│   ├── POST /api/presensi/siswa   ← Submit presensi siswa
│   ├── GET /api/presensi/guru     ← List hari ini
│   ├── GET /api/presensi/siswa    ← List hari ini
│   └── GET /api/presensi/siswa/belum-hadir ← Siswa belum hadir (filter kelas)
└── prisma/schema.prisma
    ├── PresensiGuru               ← Log presensi guru
    └── PresensiSiswa              ← Log presensi siswa
```

---

## 🔄 Flow Diagram

```
KIOSK MODE:
1. Page load → Request camera + GPS permission
2. User search nama/NIS → Dropdown muncul
3. Pilih user → Status update, live preview camera ON
4. Klik TAP DATANG/PULANG → Capture foto + GPS
5. POST ke server → Success overlay → Reset form

ADMIN/GURU DASHBOARD:
1. Pilih tanggal range + kelas
2. Tampilkan tabel + grafik
3. Export Excel
```

---

## 🧪 API Endpoints

### Presensi Guru:
- `POST /api/presensi/guru` → Body: `{ guruId, tipe: 'DATANG'|'PULANG', fotoDataUrl, lokasi: {lat, lng} }`
- `GET /api/presensi/guru` → Query: `?tanggal=2026-06-06` (default: hari ini)

### Presensi Siswa:
- `POST /api/presensi/siswa` → Body: `{ siswaId, fotoDataUrl, lokasi }`
- `GET /api/presensi/siswa` → List hadir hari ini
- `GET /api/presensi/siswa/belum-hadir` → Query: `?kelasId=xxx` (siswa yang belum hadir)

---

## 🐛 Known Issues

### Timezone Midnight Reset Bug (FIXED 2026-06-04)
- **Problem:** Data presensi hilang/reset saat jam 00:00 (midnight)
- **Root Cause:** Query pakai exact date match `where: { tanggal: today }` → timezone mismatch
- **Fix:** Gunakan date range `where: { tanggal: { gte: today, lt: tomorrow } }`
- **File Changed:** `server/routes/presensi.ts`

### Filtered Count Bug (FIXED 2026-06-04)
- **Problem:** Tab "Belum Hadir" menampilkan count global, bukan filtered by kelas
- **Root Cause:** Computed value menggunakan `totalSiswa - attendedCount` tanpa filter
- **Fix:** 
  ```typescript
  const filteredBelumCount = selectedKelasFilter === 'ALL'
    ? belumHadir
    : siswaBelumHadir.length;
  ```
- **File Changed:** `src/pages/PresensiSiswaKiosk.tsx`

### Kiosk Layout (Updated 2026-06-06)
- **Change:** Hapus camera preview 30% di kiri, full width identifikasi diri
- **Reason:** User request untuk simplify layout
- **File Changed:** `src/pages/PresensiGuruKiosk.tsx`

---

## 📝 Notes

- Foto disimpan sebagai base64 DataURL di database (MEDIUMTEXT)
- GPS menggunakan browser Geolocation API
- Kiosk mode best viewed di tablet/desktop (min 1024px)
- Footer text size: 11px (`text-[11px]`)
- Auto-refresh polling: 30 detik
