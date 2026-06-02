# Web Ujian Online Sekolah 📚

Sistem Ujian Online Sekolah (CBT - Computer Based Test) modern dengan tampilan elegan dan performa tinggi. Dibangun dengan fullstack React (Vite) + Express.js + Prisma ORM.

## Fitur Utama
- **Role-based Access**: Admin, Guru, Siswa
- **Ujian Realtime**: Soal PG & Essay, countdown timer, auto-submit
- **Manajemen Data**: CRUD Siswa, Guru, Kelas, Mapel, Ujian
- **Report & Export**: Laporan nilai, export ke Excel/PDF
- **Modern UI**: Animasi halus dengan `motion`, responsive design dengan Tailwind CSS

---

## 🛠 Stack Teknologi

**Frontend:**
- React 18 (Vite)
- Tailwind CSS 4
- Zustand (State Management)
- React Router DOM 7
- Recharts (Visualisasi Data)
- Framer Motion / Motion (Animasi)
- Lucide React (Icons)

**Backend:**
- Node.js & Express.js
- Prisma ORM
- MySQL (Production) / SQLite (Development)
- JSON Web Token (JWT) & bcryptjs (Autentikasi)
- cookie-parser

---

## 📁 Struktur Folder Lengkap

```text
webujian/
├── src/                    # FRONTEND SOURCE CODE
│   ├── components/         # Komponen UI Reusable (ui/, Dashboard, Layout)
│   ├── lib/                # Utilities (api handler, date formatter, dll)
│   ├── pages/              # Halaman Aplikasi
│   │   ├── auth/           # Login pages
│   │   ├── dashboard/      # Admin & Guru dashboard
│   │   └── exam/           # Halaman pengambilan ujian siswa
│   ├── store/              # Zustand state (auth.ts)
│   ├── App.tsx             # Main React Component & Routes
│   ├── index.css           # Global Tailwind styles
│   └── main.tsx            # Frontend Entry Point
├── server/                 # BACKEND SOURCE CODE
│   ├── prisma/             # Prisma schema, migrations, seed
│   ├── routes/             # Express API Routes (auth, admin, guru, siswa)
│   ├── middleware.ts       # Auth Middleware & Error Handling
│   ├── package.json        # Backend dependencies
│   ├── server.ts           # Backend Entry Point
│   ├── .env.example        # Backend Environment variable example
│   └── .env.production.example # Hostinger deployment env example
├── public/                 # Static assets
├── .env.example            # Frontend Environment variable example
├── .gitignore              # Git ignore configuration
├── package.json            # Frontend dependencies & workspace config
├── tsconfig.json           # TypeScript configuration
└── vite.config.ts          # Vite configuration
```

---

## 🚀 Cara Install Lokal

### 1. Clone Repository & Install Dependencies
```bash
# Clone repository
git clone <url-repo-anda>
cd webujian

# Install frontend dependencies
npm install

# Install backend dependencies
cd server
npm install
cd ..
```

### 2. Konfigurasi Environment Variables
Copy file `.env.example` menjadi `.env` di backend dan frontend:

**Di ROOT (Frontend):**
```bash
cp .env.example .env
```
*(Tidak perlu diedit untuk development lokal karena default mengarah ke localhost).*

**Di SERVER/ (Backend):**
```bash
cd server
cp .env.example .env
```
*(Edit `server/.env` sesuai konfigurasi host MySQL lokal Anda. Atau gunakan SQLite jika tidak ada MySQL).*
*/server/.env*
```env
DATABASE_URL="mysql://root:password@localhost:3306/db_webujian"
JWT_SECRET="rahasia_sekolah_super_aman_123"
PORT=3001
NODE_ENV=development
```

### 3. Setup Database (Prisma)
Dari folder `server/`, jalankan migrasi dan seeding data awal:
```bash
cd server

# Migrasi skema ke database
npx prisma migrate dev

# Seed (generate) data demo (Akun admin, dsb)
npx prisma db seed

cd ..
```

### 4. Jalankan Aplikasi
Aplikasi ini sudah dikonfigurasi untuk menjalankan Frontend dan Backend secara bersamaan (menggunakan `concurrently`).

Dari folder `webujian` (root), jalankan:
```bash
npm run dev
```

Aplikasi bisa diakses di:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001

---

## 🔑 Akun Demo

Data berikut akan otomatis dibuat saat Anda menjalankan `npx prisma db seed`:

**1. Administrator**
- Email: `admin@sekolah.sch.id`
- Password: `password123`

**2. Guru**
- Username: `GURU001`
- Password: `password123`

**3. Siswa**
- NIS: `1001`
- Password: `password123`

---

## 🌐 Cara Deploy ke Hostinger (Ringkas)
Kami telah menyiapkan file bantu untuk deploy ke panel (cPanel/hPanel).

1. Upload file `server/` ke folder `/backend` atau `/api` di hosting dengan mode Node.js.
2. Gunakan `server/.env.production.example` sebagai referensi Environment Variable (hostinger DB, dll).
3. Build frontend dengan `npm run build`, upload folder `dist/` ke `/public_html`.
4. Pastikan `VITE_API_URL` frontend mengarah ke URL Node.js Backend Anda.

Baca selengkapnya di: [PANDUAN-DEPLOY-HOSTINGER.md](./PANDUAN-DEPLOY-HOSTINGER.md) *(Jika tersedia)*

---

## 📡 Endpoint API Utama

| Method | Endpoint | Keterangan | Role |
|---|---|---|---|
| POST | `/api/auth/login` | Login user, return token/cookies | Semua |
| POST | `/api/auth/logout` | Logout hapus cookies | Semua |
| GET | `/api/auth/me` | Ambil data profil user saat ini | Auth |
| GET | `/api/admin/dashboard` | Statistik dashboard admin | Admin |
| GET | `/api/admin/users` | Daftar semua user | Admin |
| GET | `/api/admin/siswa` | Daftar siswa & CRUD | Admin |
| GET | `/api/admin/guru` | Daftar guru & CRUD | Admin |
| GET | `/api/guru/dashboard` | Statistik dashboard guru | Guru |
| GET | `/api/guru/ujian` | Manajemen ujian buatan guru | Guru |
| GET | `/api/guru/ujian/:id/peserta` | Nilai dan progress ujian kelas | Guru |
| GET | `/api/siswa/dashboard` | Statistik ujian & tugas siswa | Siswa |
| GET | `/api/siswa/ujian` | Daftar ujian tersedia & riwayat | Siswa |
| POST | `/api/siswa/ujian/:id/start` | Memulai sesi ujian | Siswa |
| POST | `/api/siswa/ujian/:id/submit` | Submit jawaban ujian selesai | Siswa |

---

## 📄 Lisensi
[MIT License](https://opensource.org/licenses/MIT)

Dibuat untuk keperluan simulasi pendidikan & ujian sekolah modern. Let's make education better! 🚀
