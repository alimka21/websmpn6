# REQ-005: Content Management System (CMS)

**Status:** ✅ Implemented  
**Last Updated:** 2026-06-06

---

## 📌 Overview

CMS untuk kelola konten website sekolah: Berita, Agenda, Dokumen, dan Site Config.

---

## 🎯 Functional Requirements

### FR-005.1: Berita
- **Admin:** CRUD berita (judul, slug, konten, ringkasan, gambar, publishedAt)
- **Public:** Lihat list berita di landing page, baca detail berita
- **Slug:** Auto-generate dari judul (kebab-case)
- **Image Upload:** Base64 atau URL external

**Files:** 
- Admin: `src/pages/dashboard/ManageBerita.tsx`
- Public: `src/pages/BeritaDetail.tsx`

### FR-005.2: Agenda
- **Admin:** CRUD agenda (judul, waktu, lokasi, deskripsi)
- **Public:** Lihat agenda di landing page (upcoming events)
- **Sort:** By waktu ascending

**File:** `src/pages/dashboard/ManageAgenda.tsx`

### FR-005.3: Dokumen
- **Admin:** Upload dokumen (judul, link Google Drive/Dropbox)
- **Public:** Download dokumen (link eksternal)
- **Categories:** Kurikulum, Peraturan, Formulir, dll

**File:** `src/pages/dashboard/ManageDokumen.tsx`

### FR-005.4: Site Configuration
- **Admin:** Edit config global website:
  - Nama sekolah
  - Logo URL
  - Hero image URL
  - Profil image URL
  - Visi
  - Misi (array)
  - Fitur unggulan (array: icon, title, desc)
  - Kontak: alamat, telepon, email, maps URL
  - Social media links
- **Public:** Render config di landing page

**File:** 
- Admin: `src/pages/dashboard/SiteConfig.tsx`
- Hook: `src/hooks/useSiteConfig.ts`

---

## 🗂️ File Struktur

```
Frontend:
├── src/pages/
│   ├── LandingPage.tsx            ← Render berita, agenda, config
│   ├── BeritaDetail.tsx           ← Detail berita
│   └── dashboard/
│       ├── ManageBerita.tsx       ← CRUD berita
│       ├── ManageAgenda.tsx       ← CRUD agenda
│       ├── ManageDokumen.tsx      ← CRUD dokumen
│       └── SiteConfig.tsx         ← Edit site config
└── src/hooks/
    └── useSiteConfig.ts           ← Fetch & cache site config

Backend:
├── server/routes/public.ts        ← GET berita, agenda, dokumen, config
├── server/routes/admin.ts         ← CRUD berita, agenda, dokumen, config
└── prisma/schema.prisma
    ├── Berita
    ├── Agenda
    ├── Dokumen
    └── SiteConfig                 ← Singleton (id: 'default')
```

---

## 🧪 API Endpoints

### Public:
- `GET /api/public/berita` → List berita published
- `GET /api/public/berita/:slug` → Detail berita by slug
- `GET /api/public/agenda` → List agenda upcoming
- `GET /api/public/dokumen` → List dokumen
- `GET /api/public/site-config` → Site config

### Admin:
- `POST /api/admin/berita` → Create berita
- `PATCH /api/admin/berita/:id` → Update berita
- `DELETE /api/admin/berita/:id` → Delete berita
- `PATCH /api/admin/site-config` → Update site config (upsert)

---

## 🐛 Known Issues

### Landing Page Layout Update (2026-06-04)
- **Change:** Foto sekolah di kiri, Visi & Misi di kanan (grid 2 kolom)
- **Previous:** Foto di atas, visi misi di bawah
- **File Changed:** `src/pages/LandingPage.tsx`

### Remove "Pelajari Lebih Lanjut" Button (2026-06-06)
- **Change:** Hapus button di bawah fitur unggulan
- **Reason:** User request - tidak perlu link ke login
- **File Changed:** `src/pages/LandingPage.tsx` line 467-472

---

## 📝 Notes

- Site config menggunakan pattern **singleton** (hanya 1 row di database dengan `id: 'default'`)
- Berita menggunakan `publishedAt` untuk jadwal publish (NULL = draft)
- Image menggunakan URL eksternal (Google Drive, Imgur, dll) atau base64 inline
- Slug berita harus unique (auto-check saat create)
