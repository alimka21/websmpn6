# CLAUDE.md — Instruksi untuk Claude Code

## ⚡ BACA INI DULU SEBELUM APAPUN

Sebelum memulai task apapun, baca **SRS_INDEX** di:
`.claude/SRS_INDEX.md`

Baca hanya requirement yang RELEVAN dengan task saat ini.
Jangan baca semua file requirement sekaligus.

---

## 🎯 Proyek

**Nama:** Web Ujian Sekolah Modern  
**Repo:** github.com/alimka21/webujian  
**Status:** Development aktif

---

## 🛠️ Stack

```
Frontend : Vite + React 19 + TypeScript + TailwindCSS v4
           React Router v7 + Zustand + Recharts + Framer Motion + Sonner
Backend  : Express.js + TypeScript (folder: server/)
Database : MySQL (XAMPP localhost dev) → MySQL production (Hostinger)
ORM      : Prisma (schema: server/prisma/schema.prisma)
Auth     : JWT + bcryptjs + localStorage
```

---

## 📁 Struktur Folder Penting

```
webujian/
├── src/
│   ├── pages/
│   │   ├── dashboard/
│   │   │   ├── guru/        ← BuatUjian, KelolaSoal, DaftarUjian, dll
│   │   │   ├── siswa/       ← SiswaDashboard, HasilUjian, RiwayatNilai
│   │   │   └── *.tsx        ← AdminDashboard, AlumniTracer, Attendance, dll
│   │   └── exam/TakeExam.tsx
│   ├── components/ui/       ← Button, Card, Input, Badge, dll
│   ├── hooks/               ← useAntiCheat, useExamTimer
│   ├── lib/                 ← api.ts, utils.ts, format.ts
│   └── store/authStore.ts
└── server/
    ├── routes/              ← auth.ts, guru.ts, siswa.ts, admin.ts, public.ts
    ├── lib/prisma.ts
    ├── middleware.ts
    └── prisma/
        ├── schema.prisma
        ├── seed.ts
        └── migrations/      ← 20260518000000_init
```

---

## 📐 Konvensi Wajib

### Code Style
- Bahasa Indonesia untuk SEMUA UI text, label, toast, pesan error
- Komentar penting dalam Bahasa Indonesia
- Gunakan `api.get/post/patch/delete` dari `src/lib/api.ts` — JANGAN raw fetch()
- Gunakan `toast.success/error/info` dari sonner — JANGAN alert() atau window.confirm()
- Gunakan komponen dari `src/components/ui/` — JANGAN buat komponen baru yang duplikat

### Setiap Halaman Wajib Punya
- Loading state (spinner + teks "Memuat...")
- Error state (pesan + tombol "Muat Ulang")
- Empty state (ikon + teks deskriptif + tombol CTA)

### Setiap Form Wajib Punya
- Validasi per-field (border merah + pesan di bawah field)
- Loading state di tombol submit (disabled + spinner)
- Toast success/error setelah submit

### Setiap Aksi Destructive (Hapus dll)
- Modal konfirmasi — JANGAN window.confirm()

---

## 🔐 Role & Akses

| Role | Login | Dashboard Route |
|------|-------|-----------------|
| SUPER_ADMIN | email | /dashboard/admin |
| GURU | email | /dashboard/guru |
| SISWA | NIS | /dashboard/siswa |

---

## 🗄️ Database

**Dev:** MySQL via XAMPP — `mysql://root:@localhost:3306/webujian` (di [server/.env](server/.env))  
**Production:** MySQL di Hostinger (auto `prisma db push` saat startup, lihat [server/server.ts](server/server.ts#L48))

**Akun Demo** (dari [server/prisma/seed.ts](server/prisma/seed.ts)):
- Admin: `admin@sekolah.sch.id` / `admin123`
- Guru: `budi@sekolah.sch.id` / `guru123` (atau `siti@sekolah.sch.id`)
- Siswa: NIS `2025001` (Ahmad Fauzi) / `siswa123` — NIS lain: 2025002–2025005, 2024001, dst

---

## ⚠️ Aturan Efisiensi Token

1. **Baca file hanya yang relevan** dengan task — jangan baca semua
2. **Tanya dulu kalau ambigu** — jangan asumsikan dan langsung edit banyak file
3. **Tampilkan rencana dulu** untuk task besar (5+ file), tunggu konfirmasi
4. **Jangan duplikasi kode** — cek komponen yang sudah ada sebelum buat baru
5. **Batch perubahan kecil** dalam satu edit, bukan file per file

---

## 🚀 Deploy Target

- **Frontend:** Hostinger Node.js App #1 → domain utama
- **Backend:** Hostinger Node.js App #2 → subdomain api.
- **DB Production:** MySQL Hostinger (via phpMyAdmin)
- **CI/CD:** GitHub push → Hostinger auto-deploy