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

  // Bunyikan alarm menggunakan Web Audio API
  const playAlarm = useCallback(() => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      
      const ctx = new AudioContextClass();
      
      const playTone = (freq: number, startTime: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + startTime);
        
        gain.gain.setValueAtTime(0, ctx.currentTime + startTime);
        gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + startTime + 0.05);
        gain.gain.setValueAtTime(0.1, ctx.currentTime + startTime + duration - 0.05);
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
      
    } catch (e) {
      console.error("Web Audio API gagal", e);
    }
  }, []);

  const triggerViolation = useCallback(async (type: ViolationType, message: string) => {
    if (isAutoSubmittingRef.current) return;

    const v: Violation = {
      type,
      message,
      timestamp: new Date()
    };

    countRef.current += 1;
    const currentCount = countRef.current;

    setViolations(prev => [...prev, v]);
    setLatestViolation(v);
    setIsWarningVisible(true);
    
    playAlarm();

    if (onViolation) {
      onViolation(v, currentCount);
    }

    try {
      if (sessionId) {
        await api.post(`/api/siswa/sesi/${sessionId}/violation`, { tipe: type, pesan: message });
      }
    } catch (error) {
      console.error("Gagal mencatat pelanggaran", error);
    }

    if (currentCount >= maxViolations) {
      isAutoSubmittingRef.current = true;
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
      if (document.hidden) {
        clearTimeout(tabSwitchTimer.id);
        tabSwitchTimer.id = window.setTimeout(() => {
          if (document.hidden) {
            triggerViolation('TAB_SWITCH', 'Terdeteksi berpindah tab atau meminimalkan browser.');
          }
        }, 400);
      } else {
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
      const isFull = !!document.fullscreenElement || !!(document as any).webkitFullscreenElement;
      if (!isFull) {
        clearTimeout(blurTimer.id);
        blurTimer.id = window.setTimeout(() => {
          const stillFull = !!document.fullscreenElement || !!(document as any).webkitFullscreenElement;
          if (!stillFull) {
            triggerViolation('WINDOW_BLUR', 'Aplikasi kehilangan fokus. Dilarang membuka aplikasi lain.');
          }
        }, 300);
      }
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

    // TAB_SWITCH detection (visibilitychange) — AKTIF di semua platform
    // termasuk iOS. Fire saat siswa switch app / lock screen.
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Fullscreen + blur detection — SKIP di iOS karena:
    //  - fullscreenchange tidak akan fire (Fullscreen API tidak ada)
    //  - window blur false positive saat tap address bar / notif center
    if (isFullscreenSupported) {
      document.addEventListener('fullscreenchange', handleFullscreenChange);
      document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
      window.addEventListener('blur', handleWindowBlur);
      window.addEventListener('focus', handleWindowFocus);
    }

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('contextmenu', handleContextMenu);

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
        window.removeEventListener('blur', handleWindowBlur);
        window.removeEventListener('focus', handleWindowFocus);
      }
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [triggerViolation]);

  const requestFullscreen = async () => {
    // iOS / browser tanpa Fullscreen API: bypass dgn set state langsung.
    // Siswa lanjut masuk ujian. Anti-cheat tetap aktif via TAB_SWITCH.
    if (!isFullscreenSupported) {
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
    } catch (e) {
      console.error("Gagal masuk layar penuh", e);
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
