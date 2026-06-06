# REQ-006: Deployment & Production

**Status:** ✅ Implemented  
**Last Updated:** 2026-06-06

---

## 📌 Overview

Deployment ke Hostinger dengan MySQL production database.

---

## 🎯 Infrastructure

### Stack:
- **Frontend:** Hostinger Node.js App #1 (domain utama)
- **Backend:** Hostinger Node.js App #2 (subdomain `api.`)
- **Database:** MySQL Hostinger (via phpMyAdmin)
- **Build:** Vite (frontend) + tsc (backend)

---

## 🚀 Deployment Process

### Frontend (Vite Build):
```bash
npm run build
# Output: dist/
# Deploy: Upload ke Hostinger App #1
```

### Backend (TypeScript Compile):
```bash
cd server
npm run build
# Output: server/dist/
# Deploy: Upload ke Hostinger App #2
```

### Database Migration:
```bash
npx prisma db push
# Auto-run saat server startup (server/server.ts line 48)
```

---

## 🗂️ Environment Variables

### Frontend (.env):
```env
VITE_API_URL=https://api.yourschool.com
GEMINI_API_KEY=xxx
```

### Backend (server/.env):
```env
# Development (XAMPP)
DATABASE_URL=mysql://root:@localhost:3306/webujian

# Production (Hostinger)
DATABASE_URL=mysql://username:password@host:3306/dbname

JWT_SECRET=your-secret-key
PORT=3001
NODE_ENV=production
```

---

## ⚙️ Build Configuration

### vite.config.ts:
- **Cache busting:** Hash-based filenames untuk force reload
- **Meta tags:** No-cache untuk HTML
- **Manual chunks:** Split vendor libraries (react, recharts, exceljs)
- **Output:** `dist/assets/[name].[hash].js`

### server/tsconfig.json:
- **Target:** ES2020
- **Module:** CommonJS
- **OutDir:** `dist/`

---

## 🐛 Known Issues

### ISS-003: Failed to Fetch Module After Deploy (FIXED 2026-06-06)
- **Problem:** Browser error `Failed to fetch dynamically imported module`
- **Root Cause:** Browser cache HTML lama yang merujuk file JS dengan hash lama
- **Fix:**
  - Tambah meta tag cache control di `index.html`
  - Update `vite.config.ts` dengan proper hash naming
  - User perlu hard refresh (Ctrl+Shift+R) setelah deploy
- **Files Changed:** `index.html`, `vite.config.ts`

### ISS-002: Hostinger Firewall Block API (FIXED 2026-06-06)
- **Problem:** POST `/api/guru/ujian` return HTML challenge page
- **Root Cause:** Hostinger CDN/firewall menganggap request sebagai bot
- **Fix:**
  - Deteksi HTML response di `src/lib/api.ts`
  - Retry mechanism 3x dengan delay
  - Header `X-Requested-With: XMLHttpRequest` untuk bypass
- **Files Changed:** `src/lib/api.ts`, `src/pages/dashboard/guru/BuatUjian.tsx`

---

## 📝 Hostinger Setup Checklist

### Node.js App #1 (Frontend):
- [x] Upload `dist/` folder
- [x] Set Node version: 18.x
- [x] Entry point: Serve static files (nginx/apache)
- [x] Environment: `VITE_API_URL`

### Node.js App #2 (Backend):
- [x] Upload `server/dist/` + `server/node_modules/` + `server/prisma/`
- [x] Entry point: `dist/server.js`
- [x] Environment: `DATABASE_URL`, `JWT_SECRET`, `PORT`
- [x] Auto-restart on crash

### MySQL Database:
- [x] Create database via phpMyAdmin
- [x] Import schema: `npx prisma db push`
- [x] Seed data: `npx prisma db seed` (optional)

### DNS & SSL:
- [x] Point domain to App #1
- [x] Point subdomain `api.` to App #2
- [x] Enable SSL (Let's Encrypt)

---

## 🔐 Security

1. **Firewall:** Whitelist API paths `/api/*` di Cloudflare/Hostinger
2. **CORS:** Set `Access-Control-Allow-Origin` di backend
3. **Rate Limiting:** TODO (belum diimplementasi)
4. **SQL Injection:** Protected by Prisma ORM
5. **XSS:** React auto-escape, avoid `dangerouslySetInnerHTML`

---

## 📊 Monitoring

- **Logs:** Hostinger dashboard → Node.js App → Logs
- **Database:** phpMyAdmin → Monitor slow queries
- **Uptime:** TODO (setup monitoring service)

---

## 📝 Notes

- Build production harus dilakukan sebelum upload (jangan upload source code)
- `node_modules` harus di-upload untuk backend (Hostinger tidak auto-install)
- Prisma generate harus dijalankan di server (auto via `npm run build`)
- Jika deploy gagal, cek error log di Hostinger dashboard
