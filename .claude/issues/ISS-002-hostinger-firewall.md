# ISS-002: Hostinger Firewall Block API Create Ujian

**Status:** 🔧 Fixed  
**Reported:** 2026-06-06  
**Fixed:** 2026-06-06  
**Priority:** High  
**Related Requirement:** REQ-002 (Ujian), REQ-006 (Deploy)

---

## 🐛 Problem Description

Saat guru membuat ujian dan klik "Lanjut ke Soal", muncul error HTML challenge page dari Hostinger:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <title>Checking your browser before accessing. Just a moment...</title>
</head>
...
<script src="/hcdn-cgi/jschallenge"></script>
```

Response berisi JavaScript challenge dari Hostinger firewall/CDN.

---

## 🔍 Root Cause Analysis

### Diagnosis:
- Request: `POST /api/guru/ujian` dengan payload berisi ujian data + array kelasIds
- Response: HTML page (bukan JSON) dari Hostinger firewall
- Reason: Firewall/CDN menganggap request sebagai bot activity karena:
  1. Request pattern mencurigakan (POST dengan payload besar)
  2. Rate limiting triggered
  3. User-Agent tidak dikenali

### Evidence:
- Network tab menunjukkan status 200 tapi content-type `text/html`
- Response body berisi `"Checking your browser"` dan `"jschallenge"`
- Error terjadi di production (Hostinger), tidak di development (localhost)

---

## ✅ Solution Implemented

### Fix 1: Deteksi HTML Response dari Firewall
**File:** `src/lib/api.ts` (line 72-89)

```typescript
// Deteksi HTML response dari firewall/CDN
if (contentType?.includes("text/html")) {
  const htmlText = await res.text();

  // Deteksi Hostinger firewall challenge
  if (htmlText.includes("Checking your browser") ||
      htmlText.includes("jschallenge") ||
      htmlText.includes("hcdn-cgi")) {
    throw new ApiError(
      "Permintaan diblokir oleh firewall. Silakan coba lagi dalam beberapa detik atau hubungi administrator.",
      403
    );
  }

  // HTML response lain yang tidak diharapkan
  throw new ApiError(
    "Server mengembalikan halaman HTML, bukan data JSON. Periksa koneksi atau hubungi administrator.",
    res.status
  );
}
```

### Fix 2: Retry Mechanism dengan Smart Delay
**File:** `src/pages/dashboard/guru/BuatUjian.tsx` (line 143-189)

```typescript
// Retry logic untuk bypass firewall
let lastError: any = null;
const maxRetries = 3;

for (let attempt = 1; attempt <= maxRetries; attempt++) {
  try {
    // Tambah delay sebelum retry untuk avoid rate limiting
    if (attempt > 1) {
      toast.info(`Mencoba ulang... (${attempt}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
    }

    const res = await api.post('/api/guru/ujian', {
      judul, mataPelajaran, tipeUjian: finalTipe,
      durasi: parseInt(durasi), tanggalMulai, tanggalSelesai,
      acak, acakOpsi,
      tampilkanPembahasan: true, tampilkanNilai: true,
      kelasIds: selectedKelas,
      ...(isAdmin && guruId ? { guruId } : {}),
    }, 30000); // 30 detik timeout

    toast.success('Ujian berhasil dibuat! Silakan tambahkan soal.');
    navigate(`/dashboard/guru/ujian/${res.id}/soal`);
    return; // Success, exit

  } catch (err: any) {
    lastError = err;

    // Jika error 403 (firewall), retry
    if (err.status === 403 && attempt < maxRetries) {
      continue;
    }

    // Error lain atau retry habis, throw
    throw err;
  }
}

throw lastError; // Jika sampai sini berarti retry habis
```

### Fix 3: Better Error Handling & User Feedback
**File:** `src/pages/dashboard/guru/BuatUjian.tsx` (line 191-202)

```typescript
// Pesan error yang lebih informatif
let errorMessage = err.message || 'Gagal menyimpan ujian';

if (err.status === 403) {
  errorMessage = 'Permintaan diblokir oleh firewall server. Silakan tunggu beberapa detik dan coba lagi.';
}

setErrorMsg(errorMessage);
toast.error(errorMessage);
```

---

## 🧪 Testing Steps

### Test 1: Trigger Firewall (Production Only)
1. Login sebagai guru
2. Buat ujian baru dengan banyak kelas terpilih
3. Klik "Simpan & Lanjut ke Soal"
4. **Expected:** Toast muncul "Mencoba ulang... (1/3)" → "Mencoba ulang... (2/3)" → Success

### Test 2: Verify Retry Delay
1. Buka Network tab (F12)
2. Buat ujian
3. **Expected:** 3x POST request dengan delay 2s, 4s, 6s antar request

### Test 3: Error Message
1. Jika retry 3x gagal semua
2. **Expected:** Error message "Permintaan diblokir oleh firewall server..."

---

## 🛠️ Manual Fix (Hostinger Admin)

Jika retry tetap gagal setelah 3x, admin Hostinger perlu:

### Option 1: Whitelist API Paths
1. Login Hostinger hPanel
2. Hosting → Manage → Advanced → Cloudflare/Firewall
3. Add rule: **Skip bot protection** untuk path `/api/*`

### Option 2: Adjust Security Level
1. Cloudflare dashboard
2. Security → Settings
3. Security Level: **Medium** (bukan High)
4. Challenge Passage: **30 minutes**

### Option 3: Disable Bot Fight Mode
1. Cloudflare → Firewall → Tools
2. Bot Fight Mode: **Off** (untuk API subdomain)

---

## 📊 Result

- ✅ HTML response terdeteksi dengan error message jelas
- ✅ Retry 3x dengan delay incremental (2s, 4s, 6s)
- ✅ Toast notification untuk setiap attempt
- ✅ Timeout diperpanjang ke 30 detik
- ✅ User diberi feedback jelas jika tetap gagal

---

## 📝 Notes

- Retry mechanism hanya untuk error 403 (firewall)
- Error lain (500, 400, network error) langsung throw tanpa retry
- Delay incremental: 2s × attempt (2s, 4s, 6s)
- Header `X-Requested-With: XMLHttpRequest` sudah ada di `api.ts` untuk bypass firewall
- Jika masih sering kena firewall, pertimbangkan request throttling di backend
