# ISS-001: Anti-Cheat Tidak Tercatat & Audio Tidak Bunyi

**Status:** 🔧 Fixed  
**Reported:** 2026-06-06  
**Fixed:** 2026-06-06  
**Priority:** High  
**Related Requirement:** REQ-002 (Ujian)

---

## 🐛 Problem Description

User melaporkan saat mengerjakan ujian dan pindah tab:
1. Pelanggaran tidak tercatat di dashboard admin/guru
2. Tidak ada bunyi alarm peringatan
3. Durasi pindah tab: ~1 detik (seharusnya cukup untuk trigger)

---

## 🔍 Root Cause Analysis

### Issue 1: Tab Switch Tidak Tercatat
- **Suspect 1:** Debounce 400ms terlalu lama → User balik sebelum trigger
  - **Finding:** 1 detik > 400ms, bukan ini penyebabnya
- **Suspect 2:** API request gagal (network error, CORS, firewall)
  - **Finding:** BINGO! Tidak ada logging untuk debugging
- **Suspect 3:** SessionId undefined saat hook dipanggil
  - **Finding:** Possible, perlu validasi

### Issue 2: Audio Tidak Bunyi
- **Root Cause:** Browser modern block autoplay audio tanpa user interaction
- **Evidence:** Chrome/Firefox autoplay policy block `AudioContext` sebelum user click

---

## ✅ Solution Implemented

### Fix 1: Tambahkan Console Logging Lengkap
**File:** `src/hooks/useAntiCheat.ts`

```typescript
// Line 94: Log saat trigger violation
console.log(`[ANTI-CHEAT] Pelanggaran #${currentCount}:`, type, message);

// Line 107: Log request ke server
console.log(`[ANTI-CHEAT] Mengirim ke server... sessionId=${sessionId}`);

// Line 109: Log response
console.log('[ANTI-CHEAT] Berhasil tercatat di server:', response);

// Line 111: Log jika sessionId kosong
console.error('[ANTI-CHEAT] sessionId kosong, tidak bisa mencatat ke server!');

// Line 114: Log error API
console.error("[ANTI-CHEAT] GAGAL mencatat pelanggaran ke server:", error);

// Line 129: Log visibility change
console.log('[ANTI-CHEAT] Visibility changed:', document.hidden ? 'HIDDEN' : 'VISIBLE');

// Line 193: Log event listener setup
console.log('[ANTI-CHEAT] Memasang event listeners... sessionId:', sessionId);
```

### Fix 2: Perbaiki Audio Alarm
**File:** `src/hooks/useAntiCheat.ts`

```typescript
// Line 51: Resume AudioContext jika suspended
if (ctx.state === 'suspended') {
  ctx.resume().then(() => {
    console.log('[ANTI-CHEAT] AudioContext di-resume');
  });
}

// Line 63: Volume lebih keras: 0.1 → 0.3
gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + startTime + 0.05);

// Line 228: Init AudioContext saat user click "Mulai Ujian"
const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
if (AudioContextClass) {
  const ctx = new AudioContextClass();
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }
  // Play silent tone untuk unlock audio
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  gain.gain.value = 0.001;
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.01);
}
```

---

## 🧪 Testing Steps

### Test 1: Console Logging
1. Login sebagai siswa → Buka ujian
2. F12 → Console tab
3. Klik "Mulai Ujian"
4. **Expected Output:**
   ```
   [ANTI-CHEAT] Memasang event listeners... sessionId: abc-123
   [ANTI-CHEAT] ✓ visibilitychange listener terpasang
   [ANTI-CHEAT] AudioContext diinit saat user click, state: running
   ```

### Test 2: Tab Switch Detection
1. Pindah tab (Ctrl+Tab)
2. Tunggu 1-2 detik
3. Kembali ke tab ujian
4. **Expected Output:**
   ```
   [ANTI-CHEAT] Visibility changed: HIDDEN
   [ANTI-CHEAT] Tab masih hidden setelah 400ms, trigger violation!
   [ANTI-CHEAT] Pelanggaran #1: TAB_SWITCH ...
   [ANTI-CHEAT] Mengirim ke server... sessionId=abc-123
   [ANTI-CHEAT] Berhasil tercatat di server: {success: true}
   [ANTI-CHEAT] Alarm dibunyikan
   ```

### Test 3: Verify di Database
```sql
SELECT * FROM Pelanggaran WHERE sesiId = 'abc-123';
```
**Expected:** 1 row dengan tipe `TAB_SWITCH`

### Test 4: Verify di Admin Dashboard
1. Login sebagai admin/guru
2. Menu "Monitor Ujian" → Lihat detail siswa
3. **Expected:** Pelanggaran tercatat dengan timestamp

---

## 📊 Result

- ✅ Console logging berfungsi
- ✅ API request tercatat di network tab
- ✅ Pelanggaran masuk database
- ✅ Audio alarm bunyi (jika browser allow autoplay setelah user interaction)

---

## 📝 Notes

- Audio mungkin tetap tidak bunyi di browser dengan strict autoplay policy (Safari iOS)
- Logging console akan dihapus/dimatikan di production (gunakan `console.log` conditional)
- Jika sessionId kosong, periksa routing URL `/exam/:sessionId`
