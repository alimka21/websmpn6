# REQ-001: Autentikasi & Authorization

**Status:** ✅ Implemented  
**Last Updated:** 2026-06-06

---

## 📌 Overview

Sistem autentikasi berbasis JWT dengan 3 role: SUPER_ADMIN, GURU, SISWA.

---

## 🎯 Functional Requirements

### FR-001.1: Login Multi-Role
- **SUPER_ADMIN & GURU:** Login dengan email + password
- **SISWA:** Login dengan NIS + password
- Response: JWT token + user data
- Token disimpan di localStorage (`auth-storage` via Zustand persist)

### FR-001.2: Role-Based Access Control (RBAC)
| Role | Dashboard Route | Akses |
|------|----------------|-------|
| SUPER_ADMIN | `/dashboard/admin` | Full access: manage users, ujian, presensi, CMS |
| GURU | `/dashboard/guru` | Manage ujian, soal, nilai, presensi (kelas sendiri) |
| SISWA | `/dashboard/siswa` | Lihat ujian, kerjakan ujian, hasil, presensi |

### FR-001.3: Protected Routes
- Middleware di backend: `server/middleware.ts` → `requireAuth()`
- Guard di frontend: `useAuthStore` → redirect jika tidak login

### FR-001.4: Logout
- Clear token dari localStorage
- Redirect ke `/login`

---

## 🗂️ File Struktur

```
Frontend:
├── src/store/authStore.ts           ← Zustand store (token, user, role)
├── src/pages/Login.tsx              ← Halaman login multi-role
└── src/lib/api.ts                   ← Axios wrapper + auto-attach JWT header

Backend:
├── server/routes/auth.ts            ← POST /api/auth/login, /logout
├── server/middleware.ts             ← requireAuth() middleware
└── server/lib/jwt.ts                ← generateToken(), verifyToken()
```

---

## 🔐 Security

1. **Password:** Hashed dengan bcryptjs (10 rounds)
2. **JWT Secret:** Di `.env` → `JWT_SECRET`
3. **Token Expiry:** 7 hari (configurable di `jwt.ts`)
4. **CORS:** Credentials include untuk cookie support

---

## 🧪 Testing

**Manual Test:**
1. Login dengan 3 role berbeda
2. Cek token di localStorage (`auth-storage`)
3. Refresh page → harus tetap login
4. Logout → redirect ke `/login`

**Endpoints:**
- `POST /api/auth/login` → Body: `{ email, password }` atau `{ nis, password }`
- `POST /api/auth/logout` → Clear session (optional, frontend handle logout)

---

## 🐛 Known Issues

- ❌ None

---

## 📝 Notes

- NIS siswa bisa numerik (2025001) atau string
- Email guru harus unique
- Default password seed: `admin123`, `guru123`, `siswa123` (lihat `server/prisma/seed.ts`)
