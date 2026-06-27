import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../lib/api';

// ── Deteksi iOS Safari ────────────────────────────────────────────
// iOS Safari TIDAK mendukung Fullscreen API (kebijakan Apple) — kita
// harus bypass fullscreen-gate supaya siswa pengguna iPhone/iPad tetap
// bisa mengerjakan ujian. Anti-cheat TAB_SWITCH (visibilitychange)
// tetap aktif. Listener blur skip di iOS karena false positive saat
// user tap address bar / pull-down notification center.
const isIOS = typeof navigator !== 'undefined'
  && /iPad|iPhone|iPod/.test(navigator.userAgent)
  && !(window as any).MSStream;
const isFullscreenSupported = !isIOS && typeof document !== 'undefined'
  && !!document.documentElement.requestFullscreen;

export type ViolationType =
  | 'TAB_SWITCH' | 'FULLSCREEN_EXIT' | 'WINDOW_BLUR'
  | 'DEVTOOLS' | 'SCREENSHOT_ATTEMPT' | 'PASTE_DETECTED'
  | 'AI_EXTENSION';

// Cooldown per-tipe di luar komponen agar stabil dan tidak re-create tiap render
const VIOLATION_COOLDOWN: Record<ViolationType, number> = {
  TAB_SWITCH: 2000, FULLSCREEN_EXIT: 2000, WINDOW_BLUR: 2000,
  DEVTOOLS: 5000, SCREENSHOT_ATTEMPT: 2000, PASTE_DETECTED: 4000,
  AI_EXTENSION: 8000, // cooldown panjang — ekstensi biasanya persisten
};

// Selektor DOM yang diinjek ekstensi AI populer di Chrome/Firefox.
// MutationObserver cek element ini saat ditambahkan ke body.
const AI_EXT_SELECTORS = [
  '#monica-ai-root', '#monica-ai', '.monica-ai-root',
  '#sider-bubble', '#sider-panel', '#sider-extension-root',
  '.merlin-extension-root', '#merlin-root', '#merlin-overlay',
  '#chatgpt-chrome-plugin', '#chatgpt-extension-root',
  '[id*="immersive-translate"]',
  '#copilot-root', '#copilot-extension', '#bing-chat-root',
  '.kimi-plugin-root', '[id*="kimi-extension"]',
  '#perplexity-companion', '#haptik-xdk',
  '[data-extension-id]',
];
const AI_EXT_ID_RE = /monica|sider.{0,10}ext|merlin.{0,10}ext|chatgpt.{0,10}ext|copilot.{0,10}ext|kimi.{0,10}ext|gemini.{0,10}ext|gpt.{0,5}ext|ai.{0,5}assistant/i;

export interface Violation {
  type: ViolationType;
  message: string;
  timestamp: Date;
}

interface UseAntiCheatProps {
  maxViolations?: number;
  sessionId: string;
  onViolation?: (v: Violation, count: number) => void;
  onAutoSubmit?: () => void;
}

export function useAntiCheat({
  maxViolations = 3,
  sessionId,
  onViolation,
  onAutoSubmit
}: UseAntiCheatProps) {
  const [violations, setViolations] = useState<Violation[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isWarningVisible, setIsWarningVisible] = useState(false);
  const [latestViolation, setLatestViolation] = useState<Violation | null>(null);

  // Use refs to avoid stale state in event listeners
  const countRef = useRef(0);
  const isAutoSubmittingRef = useRef(false);
  // Dedup per-tipe: setiap jenis pelanggaran punya cooldown sendiri.
  const lastViolationTimeRef = useRef<Record<string, number>>({});

  // Bunyikan alarm menggunakan Web Audio API
  const playAlarm = useCallback(() => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) {
        console.warn('[ANTI-CHEAT] AudioContext tidak didukung di browser ini');
        return;
      }

      const ctx = new AudioContextClass();

      // Resume AudioContext jika di-suspend oleh browser (autoplay policy)
      if (ctx.state === 'suspended') {
        ctx.resume().then(() => {
          console.log('[ANTI-CHEAT] AudioContext di-resume');
        }).catch(err => {
          console.error('[ANTI-CHEAT] Gagal resume AudioContext:', err);
        });
      }

      const playTone = (freq: number, startTime: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + startTime);

        gain.gain.setValueAtTime(0, ctx.currentTime + startTime);
        gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + startTime + 0.05); // Volume lebih keras: 0.1 → 0.3
        gain.gain.setValueAtTime(0.3, ctx.currentTime + startTime + duration - 0.05);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + startTime + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + startTime);
        osc.stop(ctx.currentTime + startTime + duration);
      };

      // Pola alarm: 880Hz -> 660Hz -> 880Hz dengan total waktu 0.45 detik
      playTone(880, 0, 0.15);
      playTone(660, 0.15, 0.15);
      playTone(880, 0.3, 0.15);

      console.log('[ANTI-CHEAT] Alarm dibunyikan');

    } catch (e) {
      console.error('[ANTI-CHEAT] Web Audio API gagal:', e);
    }
  }, []);

  const triggerViolation = useCallback(async (type: ViolationType, message: string) => {
    if (isAutoSubmittingRef.current) return;

    // Dedup per-tipe: abaikan jika tipe yang sama baru saja tercatat
    const now = Date.now();
    if (now - (lastViolationTimeRef.current[type] ?? 0) < VIOLATION_COOLDOWN[type]) return;
    lastViolationTimeRef.current[type] = now;

    const v: Violation = {
      type,
      message,
      timestamp: new Date()
    };

    countRef.current += 1;
    const currentCount = countRef.current;

    console.log(`[ANTI-CHEAT] Pelanggaran #${currentCount}:`, type, message);

    setViolations(prev => [...prev, v]);
    setLatestViolation(v);
    setIsWarningVisible(true);

    playAlarm();

    if (onViolation) {
      onViolation(v, currentCount);
    }

    // Kirim ke server — simpan ke antrian localStorage SEBELUM POST.
    // iOS Safari membekukan network request saat page ada di background
    // (app switcher / lock screen), sehingga POST bisa gagal diam-diam.
    // Antrian akan di-flush saat page kembali fokus via handleWindowFocus.
    if (sessionId) {
      const queueKey = `vq_${sessionId}`;
      const queue: Array<{ tipe: string; pesan: string }> = JSON.parse(localStorage.getItem(queueKey) || '[]');
      queue.push({ tipe: type, pesan: message });
      localStorage.setItem(queueKey, JSON.stringify(queue));

      try {
        console.log(`[ANTI-CHEAT] Mengirim ke server... sessionId=${sessionId}`);
        const response = await api.post(`/api/siswa/sesi/${sessionId}/violation`, { tipe: type, pesan: message });
        console.log('[ANTI-CHEAT] Berhasil tercatat di server:', response);
        // POST berhasil → hapus dari antrian
        const updated: typeof queue = JSON.parse(localStorage.getItem(queueKey) || '[]');
        const idx = updated.findIndex(x => x.tipe === type && x.pesan === message);
        if (idx !== -1) updated.splice(idx, 1);
        if (updated.length === 0) localStorage.removeItem(queueKey);
        else localStorage.setItem(queueKey, JSON.stringify(updated));
      } catch (error) {
        console.error('[ANTI-CHEAT] POST gagal, pelanggaran masuk antrian untuk dikirim ulang saat fokus kembali:', error);
      }
    } else {
      console.error('[ANTI-CHEAT] sessionId kosong, tidak bisa mencatat ke server!');
    }

    if (currentCount >= maxViolations) {
      isAutoSubmittingRef.current = true;
      console.log('[ANTI-CHEAT] Batas pelanggaran tercapai, auto-submit dalam 2 detik...');
      setTimeout(() => {
        if (onAutoSubmit) onAutoSubmit();
      }, 2000);
    }
  }, [sessionId, maxViolations, onViolation, onAutoSubmit, playAlarm]);

  // Kirim ulang pelanggaran yang gagal tersimpan saat page background.
  // Dipanggil saat page kembali fokus dan saat hook pertama kali mount.
  const flushViolationQueue = useCallback(async () => {
    if (!sessionId) return;
    const queueKey = `vq_${sessionId}`;
    const raw = localStorage.getItem(queueKey);
    if (!raw) return;
    const queue: Array<{ tipe: string; pesan: string }> = JSON.parse(raw);
    if (!queue.length) return;

    console.log(`[ANTI-CHEAT] Flush ${queue.length} pelanggaran dari antrian lokal...`);
    const remaining: typeof queue = [];
    for (const item of queue) {
      try {
        await api.post(`/api/siswa/sesi/${sessionId}/violation`, item);
      } catch {
        remaining.push(item);
      }
    }
    if (remaining.length === 0) {
      localStorage.removeItem(queueKey);
      console.log('[ANTI-CHEAT] Semua pelanggaran berhasil dikirim ulang.');
    } else {
      localStorage.setItem(queueKey, JSON.stringify(remaining));
      console.log(`[ANTI-CHEAT] ${remaining.length} pelanggaran masih gagal.`);
    }
  }, [sessionId]);

  useEffect(() => {
    // Debounce timer refs — batalkan jika fokus/tab kembali dalam grace period.
    // Mencegah false positive dari notifikasi OS, pop-up Meet, dialog izin
    // kamera/mikrofon yang mencuri fokus sesaat lalu kembali sendiri.
    const tabSwitchTimer = { id: 0 };
    const blurTimer = { id: 0 };
    // Catat kapan page mulai hidden — untuk tangkap kasus kembali cepat
    // sebelum timer 150ms habis (khas iOS: buka app switcher lalu langsung balik)
    let hiddenAt = 0;

    const handleVisibilityChange = () => {
      console.log('[ANTI-CHEAT] Visibility changed:', document.hidden ? 'HIDDEN' : 'VISIBLE');
      if (document.hidden) {
        hiddenAt = Date.now();
        clearTimeout(tabSwitchTimer.id);
        tabSwitchTimer.id = window.setTimeout(() => {
          if (document.hidden) {
            console.log('[ANTI-CHEAT] Tab masih hidden setelah 150ms, trigger violation!');
            triggerViolation('TAB_SWITCH', 'Terdeteksi berpindah tab atau membuka aplikasi lain.');
          }
        }, 150);
      } else {
        clearTimeout(tabSwitchTimer.id);
        const dur = hiddenAt > 0 ? Date.now() - hiddenAt : 0;
        console.log(`[ANTI-CHEAT] Tab kembali visible, durasi hidden: ${dur}ms`);
        // Tangkap kembali cepat (100–149ms): buka app switcher iOS sebentar
        // lalu kembali. Threshold 100ms aman dari noise sistem (< 50ms).
        if (dur >= 100) {
          triggerViolation('TAB_SWITCH', 'Terdeteksi berpindah tab atau membuka aplikasi lain.');
        }
        hiddenAt = 0;
      }
    };

    const handleFullscreenChange = () => {
      const isFull = !!document.fullscreenElement || !!(document as any).webkitFullscreenElement;
      setIsFullscreen(isFull);
      if (!isFull) {
        triggerViolation('FULLSCREEN_EXIT', 'Terdeteksi keluar dari mode layar penuh.');
      }
    };

    const handleWindowBlur = () => {
      clearTimeout(blurTimer.id);
      // Cek document.hidden setelah 150ms — ini yang membedakan:
      //   - Tap address bar / notif center peek → blur tapi hidden tetap false → aman
      //   - Buka app lain / lock screen → blur DAN hidden jadi true → pelanggaran
      // Berlaku di semua device: Android (fullscreen maupun tidak) dan iOS.
      blurTimer.id = window.setTimeout(() => {
        if (document.hidden) {
          triggerViolation('WINDOW_BLUR', 'Aplikasi kehilangan fokus. Dilarang membuka aplikasi lain.');
        }
      }, 150);
    };

    const handleWindowFocus = () => {
      clearTimeout(blurTimer.id);
      // Kirim ulang pelanggaran yang gagal saat page background (iOS network freeze)
      flushViolationQueue();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toUpperCase();
      const ctrl = e.ctrlKey;
      const meta = e.metaKey;
      const shift = e.shiftKey;
      const ctrlOrMeta = ctrl || meta;

      // ── DevTools ──────────────────────────────────────────
      const isF12 = e.key === 'F12';
      const isDevTools = ctrl && shift && ['I', 'J', 'C'].includes(key);
      const isViewSource = ctrl && key === 'U';
      if (isF12 || isDevTools || isViewSource) {
        e.preventDefault();
        triggerViolation('DEVTOOLS', 'Mencoba membuka alat pengembang (Developer Tools).');
        return;
      }

      // ── Screenshot & screen-capture shortcuts ────────────
      // PrintScreen (Windows/Linux)
      const isPrintScreen = e.key === 'PrintScreen';
      // Ctrl+P / Cmd+P (cetak ke PDF)
      const isPrint = ctrlOrMeta && key === 'P';
      // Ctrl+S / Cmd+S (simpan halaman)
      const isSave = ctrlOrMeta && key === 'S';
      // Ctrl+Shift+S / Cmd+Shift+S (simpan sebagai / beberapa snipping tool)
      const isShiftSave = ctrlOrMeta && shift && key === 'S';
      // Mac: Cmd+Shift+3 / 4 / 5 (screenshot)
      const isMacScreenshot = meta && shift && ['3', '4', '5'].includes(e.key);
      // Ctrl+Shift+P (beberapa launcher AI)
      const isCtrlShiftP = ctrl && shift && key === 'P';

      if (isPrintScreen || isPrint || isSave || isShiftSave || isMacScreenshot || isCtrlShiftP) {
        e.preventDefault();
        triggerViolation('SCREENSHOT_ATTEMPT', 'Terdeteksi percobaan tangkap layar atau menyimpan halaman ujian.');
        return;
      }

      // ── Blokir diam-diam (tanpa violation — terlalu banyak false positive) ──
      // Ctrl+A (select all), Ctrl+C (copy), Ctrl+X (cut), Ctrl+V (paste ke field text)
      // Ekstensi AI umumnya menyalin teks terseleksi sebelum mengirim ke server.
      if (ctrlOrMeta && ['A', 'C', 'X'].includes(key)) {
        e.preventDefault();
      }
    };

    const handleCopy = (e: ClipboardEvent) => { e.preventDefault(); };
    const handleCut  = (e: ClipboardEvent) => { e.preventDefault(); };
    const handleSelectStart = (e: Event) => { e.preventDefault(); };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    console.log('[ANTI-CHEAT] Memasang event listeners... sessionId:', sessionId);

    // TAB_SWITCH detection (visibilitychange) — AKTIF di semua platform
    // termasuk iOS. Fire saat siswa switch app / lock screen.
    document.addEventListener('visibilitychange', handleVisibilityChange);
    console.log('[ANTI-CHEAT] ✓ visibilitychange listener terpasang');

    // Fullscreen detection — hanya di device yang support Fullscreen API
    if (isFullscreenSupported) {
      document.addEventListener('fullscreenchange', handleFullscreenChange);
      document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
      console.log('[ANTI-CHEAT] ✓ fullscreen listeners terpasang');
    } else {
      console.log('[ANTI-CHEAT] ⊗ Fullscreen API tidak didukung (iOS)');
    }

    // Blur/focus detection — AKTIF di semua device termasuk iOS.
    // handleWindowBlur kini pakai cek document.hidden bukan !isFull,
    // sehingga aman dari false positive address bar / notif center di HP.
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);
    console.log('[ANTI-CHEAT] ✓ blur/focus listeners terpasang (semua device)');

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('cut', handleCut);
    document.addEventListener('selectstart', handleSelectStart);
    console.log('[ANTI-CHEAT] ✓ keyboard, contextmenu, copy/cut/select listeners terpasang');

    // Initial state — di non-iOS baca dari DOM. Di iOS biarkan false
    // sampai siswa tap "Mulai Ujian" yg call requestFullscreen() (yg
    // langsung bypass set true).
    if (isFullscreenSupported) {
      setIsFullscreen(!!document.fullscreenElement || !!(document as any).webkitFullscreenElement);
    }

    // Flush antrian saat pertama mount — tangani sisa dari reload/navigasi sebelumnya
    flushViolationQueue();

    return () => {
      clearTimeout(tabSwitchTimer.id);
      clearTimeout(blurTimer.id);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (isFullscreenSupported) {
        document.removeEventListener('fullscreenchange', handleFullscreenChange);
        document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      }
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('cut', handleCut);
      document.removeEventListener('selectstart', handleSelectStart);
    };
  }, [triggerViolation, flushViolationQueue]);

  const requestFullscreen = async () => {
    console.log('[ANTI-CHEAT] requestFullscreen dipanggil');

    // Init AudioContext saat user interaction untuk bypass autoplay policy
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        const ctx = new AudioContextClass();
        if (ctx.state === 'suspended') {
          await ctx.resume();
        }
        console.log('[ANTI-CHEAT] AudioContext diinit saat user click, state:', ctx.state);
        // Play silent tone untuk "unlock" audio
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        gain.gain.value = 0.001; // Hampir silent
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.01);
      }
    } catch (e) {
      console.warn('[ANTI-CHEAT] Gagal init AudioContext:', e);
    }

    // iOS / browser tanpa Fullscreen API: bypass dgn set state langsung.
    // Siswa lanjut masuk ujian. Anti-cheat tetap aktif via TAB_SWITCH.
    if (!isFullscreenSupported) {
      console.log('[ANTI-CHEAT] Fullscreen tidak didukung, set state langsung');
      setIsFullscreen(true);
      return;
    }

    try {
      const el = document.documentElement as any;
      if (el.requestFullscreen) {
        await el.requestFullscreen();
      } else if (el.webkitRequestFullscreen) {
        await el.webkitRequestFullscreen();
      } else if (el.msRequestFullscreen) {
        await el.msRequestFullscreen();
      }
      console.log('[ANTI-CHEAT] Berhasil masuk fullscreen');
    } catch (e) {
      console.error('[ANTI-CHEAT] Gagal masuk layar penuh:', e);
    }
  };

  // Deteksi DevTools yang sudah terbuka (via perbedaan ukuran window vs viewport).
  // Mendeteksi: Chrome DevTools docked, browser inspector, ekstensi AI yang pakai panel.
  // Threshold 200px aman dari perbedaan normal (scrollbar, taskbar, notch).
  useEffect(() => {
    const checkDevToolsSize = () => {
      if (isAutoSubmittingRef.current) return;
      const widthDiff  = window.outerWidth  - window.innerWidth;
      const heightDiff = window.outerHeight - window.innerHeight;
      if (widthDiff > 200 || heightDiff > 200) {
        triggerViolation('DEVTOOLS', 'Terdeteksi Developer Tools atau panel AI terbuka di browser.');
      }
    };
    const id = setInterval(checkDevToolsSize, 2000);
    return () => clearInterval(id);
  }, [triggerViolation]);

  // ── Deteksi ekstensi AI via MutationObserver + periodic scan ────────────────
  // Ekstensi populer (Monica, Sider, Merlin, Copilot, dll) meng-inject element
  // ke document.body. MutationObserver menangkap penambahan itu secara real-time;
  // periodic scan menangkap ekstensi yang sudah ada saat halaman pertama kali load.
  // Hanya watch childList di body (bukan subtree) agar tidak berat — ekstensi
  // hampir selalu inject langsung ke body, bukan ke dalam React component tree.
  useEffect(() => {
    if (isAutoSubmittingRef.current) return;

    const checkElement = (el: Element) => {
      if (isAutoSubmittingRef.current) return;
      const id  = el.id ?? '';
      const cls = typeof el.className === 'string' ? el.className : '';
      const isKnownExt = AI_EXT_SELECTORS.some(sel => { try { return el.matches(sel); } catch { return false; } });
      const isExtId    = AI_EXT_ID_RE.test(id) || AI_EXT_ID_RE.test(cls);
      const isExtAttr  = el.hasAttribute('data-extension-id') || el.hasAttribute('crx-extension-id');
      // Cross-origin iframe yang bukan milik halaman ini sering dipakai ekstensi AI
      const isExtFrame = el.tagName === 'IFRAME' &&
        !!(el as HTMLIFrameElement).src &&
        !(el as HTMLIFrameElement).src.startsWith(window.location.origin) &&
        !(el as HTMLIFrameElement).src.startsWith('about:');
      if (isKnownExt || isExtId || isExtAttr || isExtFrame) {
        triggerViolation('AI_EXTENSION',
          `Terdeteksi ekstensi AI aktif di browser (${id || cls.slice(0, 40) || el.tagName}). Nonaktifkan semua ekstensi sebelum ujian.`
        );
      }
    };

    const scanAll = () => {
      if (isAutoSubmittingRef.current) return;
      document.body.children && Array.from(document.body.children).forEach(checkElement);
      // Cek selektor yang mungkin tersembunyi lebih dalam
      AI_EXT_SELECTORS.forEach(sel => {
        const found = document.querySelector(sel);
        if (found) {
          triggerViolation('AI_EXTENSION',
            'Terdeteksi ekstensi AI aktif di browser. Nonaktifkan semua ekstensi sebelum mengerjakan ujian.'
          );
        }
      });
    };

    const observer = new MutationObserver(mutations => {
      if (isAutoSubmittingRef.current) return;
      mutations.forEach(m => m.addedNodes.forEach(n => { if (n instanceof Element) checkElement(n); }));
    });

    // Hanya watch direct children body — lebih ringan dari subtree
    observer.observe(document.body, { childList: true });
    scanAll(); // cek kondisi awal saat hook mount

    const scanId = setInterval(scanAll, 5000);
    return () => { observer.disconnect(); clearInterval(scanId); };
  }, [triggerViolation]);

  // Dipanggil TakeExam saat event.isTrusted === false — input dari ekstensi/script luar
  const reportUntrustedInput = useCallback((context: string) => {
    triggerViolation(
      'AI_EXTENSION',
      `Terdeteksi input otomatis dari ekstensi atau skrip AI (${context}). Dilarang menggunakan alat bantu AI selama ujian.`
    );
  }, [triggerViolation]);

  // Dipanggil langsung oleh TakeExam saat paste terdeteksi di textarea jawaban.
  const reportPaste = useCallback(() => {
    triggerViolation(
      'PASTE_DETECTED',
      'Terdeteksi tempel (paste) teks ke kolom jawaban. Dilarang menyalin jawaban dari AI atau sumber lain.'
    );
  }, [triggerViolation]);

  const dismissWarning = () => {
    setIsWarningVisible(false);
  };

  return {
    violations,
    violationCount: countRef.current,
    isFullscreen,
    isFullscreenSupported, // false di iOS — TakeExam render pesan berbeda
    isWarningVisible,
    latestViolation,
    requestFullscreen,
    dismissWarning,
    reportPaste,
    reportUntrustedInput,
    maxViolations
  };
}
