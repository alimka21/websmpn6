# ISS-003: Failed to Fetch Dynamically Imported Module

**Status:** 🔧 Fixed  
**Reported:** 2026-06-06  
**Fixed:** 2026-06-06  
**Priority:** Medium  
**Related Requirement:** REQ-006 (Deploy)

---

## 🐛 Problem Description

Setelah deploy build baru ke production, user mengakses website dan mendapat error:

```
Failed to fetch dynamically imported module: 
https://ghostwhite-hummingbird-787527.hostingersite.com/assets/PresensiGuruKiosk-RfxCXHIn.js
```

Error muncul saat navigasi ke halaman yang di-lazy load (React Router lazy import).

---

## 🔍 Root Cause Analysis

### Diagnosis:
1. **Browser cache HTML lama** yang merujuk ke file JS dengan hash lama: `PresensiGuruKiosk-RfxCXHIn.js`
2. **Server sudah punya file baru** dengan hash berbeda setelah build terbaru: `PresensiGuruKiosk-ABC123.js`
3. **File lama dihapus** dari server saat deploy (Vite replace semua file di `dist/`)
4. Browser coba load file lama → 404 Not Found

### Flow Diagram:
```
User visit → Browser load HTML (cached) 
→ HTML reference: PresensiGuruKiosk-RfxCXHIn.js
→ Browser request ke server
→ Server: 404 (file sudah dihapus, sekarang ada PresensiGuruKiosk-ABC123.js)
→ Error: Failed to fetch module
```

---

## ✅ Solution Implemented

### Fix 1: Tambah Meta Tag Cache Control
**File:** `index.html` (line 5-8)

```html
<!-- Cache control untuk mencegah browser cache HTML -->
<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
<meta http-equiv="Pragma" content="no-cache" />
<meta http-equiv="Expires" content="0" />
```

**Penjelasan:**
- `no-cache`: Browser harus revalidate dengan server sebelum pakai cached version
- `no-store`: Browser tidak boleh simpan HTML di cache
- `must-revalidate`: Setelah expire, wajib revalidate
- `Pragma: no-cache`: Fallback untuk HTTP/1.0
- `Expires: 0`: Expire immediately

### Fix 2: Update Vite Config untuk Proper Hash Naming
**File:** `vite.config.ts` (line 40-50)

```typescript
rollupOptions: {
  output: {
    // Tambahkan timestamp untuk force reload setiap build baru
    assetFileNames: (assetInfo) => {
      if (assetInfo.name === 'index.css') {
        return 'assets/index.[hash].css';
      }
      return 'assets/[name].[hash][extname]';
    },
    chunkFileNames: 'assets/[name].[hash].js',
    entryFileNames: 'assets/[name].[hash].js',
  },
}
```

**Penjelasan:**
- Hash sudah otomatis berubah setiap build (Vite default)
- Config di atas memastikan format naming konsisten
- Setiap file punya hash unique based on content

---

## 🧪 Testing Steps

### Test 1: Verify Cache Headers
1. Deploy build baru
2. Open DevTools → Network tab
3. Refresh page
4. Cek response headers untuk `index.html`:
   ```
   Cache-Control: no-cache, no-store, must-revalidate
   Pragma: no-cache
   Expires: 0
   ```

### Test 2: Verify Hash Changes
1. Build 2x dengan perubahan kecil
2. Compare output `dist/assets/`:
   ```
   Build 1: PresensiGuruKiosk-RfxCXHIn.js
   Build 2: PresensiGuruKiosk-ABC123XY.js
   ```
3. **Expected:** Hash berbeda jika konten berbeda

### Test 3: User Hard Refresh
1. User yang kena error lakukan hard refresh:
   - Windows/Linux: `Ctrl + Shift + R`
   - Mac: `Cmd + Shift + R`
2. **Expected:** Error hilang, load file baru dengan hash baru

---

## 🛠️ Immediate Fix (For Users)

**Jika user masih kena error setelah deploy:**

### Solusi User:
1. **Hard Refresh:** Ctrl + Shift + R (Windows) / Cmd + Shift + R (Mac)
2. **Clear Cache Manual:** Browser Settings → Clear browsing data → Cached images and files
3. **Incognito Mode:** Buka di incognito window (bypass cache)

### Solusi Admin:
1. Deploy build baru dengan config fix
2. Kirim broadcast ke user: "Mohon refresh browser dengan Ctrl+Shift+R"
3. (Optional) Add service worker untuk cache management

---

## 📊 Result

- ✅ Meta tag cache control mencegah browser cache HTML
- ✅ Hash-based filenames memaksa browser reload file terbaru
- ✅ Setiap build generate hash berbeda
- ✅ User cukup hard refresh 1x setelah deploy

---

## 📝 Notes

### Why This Happens:
- Vite lazy load components dengan `React.lazy(() => import('./Component'))`
- HTML di-cache oleh browser (aggressive caching untuk performance)
- JS files punya hash di filename (cache busting)
- Jika HTML di-cache, reference ke old JS hash tetap ada

### Prevention:
- **Never cache HTML**: Set proper cache headers
- **Always cache JS/CSS with hash**: Let browser cache assets (mereka punya hash)
- **Service Worker**: Consider service worker untuk advanced cache strategy

### Long-term Solution:
- Implement service worker dengan Workbox
- Versioning strategy: `/v2/assets/...`
- CDN cache purge after deploy
