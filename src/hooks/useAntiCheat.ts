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

export type ViolationType = 'TAB_SWITCH' | 'FULLSCREEN_EXIT' | 'WINDOW_BLUR' | 'DEVTOOLS';

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
  // Dedup: satu kejadian nyata (misal: pindah app) bisa memicu beberapa event
  // sekaligus (visibilitychange + blur). Guard ini pastikan hanya 1 pelanggaran
  // yang terhitung per kejadian dalam window 2 detik.
  const lastViolationTimeRef = useRef(0);

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

    // Dedup: abaikan jika kejadian nyata baru saja tercatat (< 2 detik)
    const now = Date.now();
    if (now - lastViolationTimeRef.current < 2000) return;
    lastViolationTimeRef.current = now;

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

    // Kirim ke server
    try {
      if (sessionId) {
        console.log(`[ANTI-CHEAT] Mengirim ke server... sessionId=${sessionId}`);
        const response = await api.post(`/api/siswa/sesi/${sessionId}/violation`, { tipe: type, pesan: message });
        console.log('[ANTI-CHEAT] Berhasil tercatat di server:', response);
      } else {
        console.error('[ANTI-CHEAT] sessionId kosong, tidak bisa mencatat ke server!');
      }
    } catch (error) {
      console.error("[ANTI-CHEAT] GAGAL mencatat pelanggaran ke server:", error);
    }

    if (currentCount >= maxViolations) {
      isAutoSubmittingRef.current = true;
      console.log('[ANTI-CHEAT] Batas pelanggaran tercapai, auto-submit dalam 2 detik...');
      setTimeout(() => {
        if (onAutoSubmit) onAutoSubmit();
      }, 2000);
    }
  }, [sessionId, maxViolations, onViolation, onAutoSubmit, playAlarm]);

  useEffect(() => {
    // Debounce timer refs — batalkan jika fokus/tab kembali dalam grace period.
    // Mencegah false positive dari notifikasi OS, pop-up Meet, dialog izin
    // kamera/mikrofon yang mencuri fokus sesaat lalu kembali sendiri.
    const tabSwitchTimer = { id: 0 };
    const blurTimer = { id: 0 };

    const handleVisibilityChange = () => {
      console.log('[ANTI-CHEAT] Visibility changed:', document.hidden ? 'HIDDEN' : 'VISIBLE');
      if (document.hidden) {
        clearTimeout(tabSwitchTimer.id);
        // 150ms: cukup cepat untuk tangkap gestur pindah app di HP,
        // masih aman dari pop-up izin kamera/notif OS yang cepat kembali.
        tabSwitchTimer.id = window.setTimeout(() => {
          if (document.hidden) {
            console.log('[ANTI-CHEAT] Tab masih hidden setelah 150ms, trigger violation!');
            triggerViolation('TAB_SWITCH', 'Terdeteksi berpindah tab atau membuka aplikasi lain.');
          }
        }, 150);
      } else {
        console.log('[ANTI-CHEAT] Tab kembali visible, batalkan timer');
        clearTimeout(tabSwitchTimer.id);
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
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Blokir pintasan devtools dan view source
      const isF12 = e.key === 'F12';
      const isDevToolsShortcuts = e.ctrlKey && e.shiftKey && ['I', 'J', 'C', 'U'].includes(e.key.toUpperCase());
      const isViewSource = e.ctrlKey && e.key.toUpperCase() === 'U';

      if (isF12 || isDevToolsShortcuts || isViewSource) {
        e.preventDefault();
        triggerViolation('DEVTOOLS', 'Mencoba membuka alat pengembang (Developer Tools) atau Inspect Element.');
      }
    };

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
    console.log('[ANTI-CHEAT] ✓ keyboard & contextmenu listeners terpasang');

    // Initial state — di non-iOS baca dari DOM. Di iOS biarkan false
    // sampai siswa tap "Mulai Ujian" yg call requestFullscreen() (yg
    // langsung bypass set true).
    if (isFullscreenSupported) {
      setIsFullscreen(!!document.fullscreenElement || !!(document as any).webkitFullscreenElement);
    }

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
    };
  }, [triggerViolation]);

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
    maxViolations
  };
}
