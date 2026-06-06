# REQ-004: Alumni Tracer System

**Status:** ✅ Implemented  
**Last Updated:** 2026-06-06

---

## 📌 Overview

Sistem pelacakan alumni untuk mengetahui status pekerjaan/kuliah setelah lulus.

---

## 🎯 Functional Requirements

### FR-004.1: Form Alumni Tracer
- **Public access** (tidak perlu login)
- Form isi: Nama, NIS, Tahun Lulus, Email, No HP, Status (Kuliah/Kerja/Wirausaha/Mencari Kerja)
- Jika kuliah: Universitas, Jurusan
- Jika kerja: Nama Perusahaan, Posisi
- Submit → Data masuk ke database

**File:** `src/pages/AlumniTracer.tsx`

### FR-004.2: Dashboard Alumni (Admin)
- Lihat daftar alumni yang sudah isi tracer
- Filter by tahun lulus, status
- Export ke Excel
- Statistik: Pie chart distribusi status alumni

**File:** `src/pages/dashboard/AlumniTracer.tsx`

---

## 🗂️ File Struktur

```
Frontend:
├── src/pages/
│   ├── AlumniTracer.tsx           ← Form public
│   └── dashboard/
│       └── AlumniTracer.tsx       ← Admin dashboard (same name, beda path)

Backend:
├── server/routes/public.ts        ← POST /api/public/alumni-tracer
├── server/routes/admin.ts         ← GET /api/admin/alumni-tracer
└── prisma/schema.prisma
    └── AlumniTracer               ← Model alumni data
```

---

## 🧪 API Endpoints

- `POST /api/public/alumni-tracer` → Submit form alumni (no auth)
- `GET /api/admin/alumni-tracer` → List + filter (require auth SUPER_ADMIN)

---

## 📝 Notes

- Form tidak memerlukan verifikasi NIS (alumni mungkin lupa/salah)
- Email & HP optional (tidak semua alumni mau share)
- Data alumni bisa di-export untuk laporan ke Dinas Pendidikan
