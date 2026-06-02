import { toast } from 'sonner';
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import {
  AlertCircle, Clock, ChevronLeft, ChevronRight, Flag, X, CheckSquare,
  Maximize, List, ShieldAlert, Check, CloudOff, Loader2, WifiOff,
} from 'lucide-react';
import api from '../../lib/api';
import { useAntiCheat } from '../../hooks/useAntiCheat';
import { useExamTimer } from '../../hooks/useExamTimer';
import { useModalA11y } from '../../hooks/useModalA11y';

// Utility for debouncing
function useDebounce<T extends (...args: any[]) => void>(func: T, wait: number) {
  const timeout = React.useRef<NodeJS.Timeout | undefined>(undefined);
  return React.useCallback(
    (...args: Parameters<T>) => {
      if (timeout.current) clearTimeout(timeout.current);
      timeout.current = setTimeout(() => func(...args), wait);
    },
    [func, wait]
  );
}

// Indikator status auto-save + koneksi.
// Offline override semua status save (sinyal paling kritis).
// Di mobile teks disembunyikan (sm:inline) — cuma icon supaya hemat ruang header.
function SaveIndicator({
  status,
  isOnline,
}: {
  status: 'idle' | 'saving' | 'saved' | 'error';
  isOnline: boolean;
}) {
  if (!isOnline) {
    return (
      <div
        className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-error-container text-error text-xs font-medium"
        role="status"
        aria-live="polite"
      >
        <WifiOff className="w-3.5 h-3.5" />
        <span>Offline</span>
      </div>
    );
  }
  if (status === 'saving') {
    return (
      <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-tertiary-fixed text-on-tertiary-fixed text-xs font-medium" role="status" aria-live="polite">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        <span>Menyimpan…</span>
      </div>
    );
  }
  if (status === 'saved') {
    return (
      <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary-container/40 text-on-secondary-container text-xs font-medium" role="status" aria-live="polite">
        <Check className="w-3.5 h-3.5" />
        <span>Tersimpan</span>
      </div>
    );
  }
  if (status === 'error') {
    return (
      <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-error-container text-error text-xs font-medium" role="status" aria-live="polite">
        <CloudOff className="w-3.5 h-3.5" />
        <span>Belum tersimpan</span>
      </div>
    );
  }
  return null; // idle
}

// Versi compact (cuma icon) untuk mobile — tampil sebelum timer di header sempit.
function SaveIndicatorMobile({
  status,
  isOnline,
}: {
  status: 'idle' | 'saving' | 'saved' | 'error';
  isOnline: boolean;
}) {
  if (!isOnline) return <WifiOff className="sm:hidden w-4 h-4 text-error shrink-0" aria-label="Offline" />;
  if (status === 'saving') return <Loader2 className="sm:hidden w-4 h-4 text-tertiary animate-spin shrink-0" aria-label="Menyimpan" />;
  if (status === 'saved') return <Check className="sm:hidden w-4 h-4 text-secondary shrink-0" aria-label="Tersimpan" />;
  if (status === 'error') return <CloudOff className="sm:hidden w-4 h-4 text-error shrink-0" aria-label="Belum tersimpan" />;
  return null;
}

export default function TakeExam() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [sessionData, setSessionData] = useState<any>(null);
  const [soalList, setSoalList] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [textAnswers, setTextAnswers] = useState<Record<string, string>>({});
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  // Modal a11y refs
  const submitModalRef = useModalA11y<HTMLDivElement>(showSubmitConfirm, () => setShowSubmitConfirm(false));
  const mobileNavRef = useModalA11y<HTMLDivElement>(showMobileNav, () => setShowMobileNav(false));

  // Fetch session data
  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await api.get(`/api/siswa/sesi/${sessionId}`);
        if (res.sesi?.status === 'SELESAI' || res.sesi?.status === 'AUTO_SUBMIT') {
          navigate(`/dashboard/siswa/hasil/${sessionId}`, { replace: true });
          return;
        }

        setSessionData(res);

        // Shuffle soal & opsi pakai seed dari sessionId — stabil antar refresh,
        // beda untuk tiap siswa.
        const seedStr = String(sessionId || '');
        let seed = 0;
        for (let i = 0; i < seedStr.length; i++) seed = (seed * 31 + seedStr.charCodeAt(i)) >>> 0;
        const rng = () => {
          seed = (seed * 1664525 + 1013904223) >>> 0;
          return seed / 0x100000000;
        };
        const shuffle = <T,>(arr: T[]): T[] => {
          const a = arr.slice();
          for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
          }
          return a;
        };

        let soal = res.ujian.soal || [];
        if (res.ujian.acak) soal = shuffle(soal);
        if (res.ujian.acakOpsi) {
          soal = soal.map((s: any) => ({ ...s, opsi: shuffle(s.opsi || []) }));
        }
        setSoalList(soal);

        const storedAns = localStorage.getItem(`exam_ans_${sessionId}`);
        if (storedAns) setAnswers(JSON.parse(storedAns));
        else setAnswers({});

        const storedText = localStorage.getItem(`exam_text_${sessionId}`);
        if (storedText) setTextAnswers(JSON.parse(storedText));
        else setTextAnswers({});

        const storedFlags = localStorage.getItem(`exam_flags_${sessionId}`);
        if (storedFlags) setFlagged(JSON.parse(storedFlags));
      } catch (err: any) {
        // 404 = sesi dihapus (admin reset). Bersihkan localStorage stale
        // supaya saat siswa mulai ujian lagi tidak ada konflik state.
        if (err?.status === 404 || /tidak ditemukan|akses ditolak/i.test(err?.message || '')) {
          try {
            localStorage.removeItem(`exam_ans_${sessionId}`);
            localStorage.removeItem(`exam_text_${sessionId}`);
            localStorage.removeItem(`exam_flags_${sessionId}`);
            localStorage.removeItem(`exam_timer_${sessionId}`);
          } catch { /* ignore */ }
          toast.info('Sesi ujian Anda di-reset oleh admin/guru. Silakan mulai lagi dari daftar ujian.');
          navigate('/dashboard/siswa/ujian', { replace: true });
          return;
        }
        toast.error(err.message || 'Gagal memuat sesi ujian');
        navigate('/dashboard/siswa');
      } finally {
        setIsLoading(false);
      }
    };
    if (sessionId) fetchSession();
  }, [sessionId, navigate]);

  // Anti-Cheat Hook
  const {
    violationCount,
    isFullscreen,
    isFullscreenSupported,
    isWarningVisible,
    latestViolation,
    requestFullscreen,
    dismissWarning,
    maxViolations
  } = useAntiCheat({
    sessionId: sessionId || '',
    maxViolations: 3,
    onAutoSubmit: () => submitExam('auto_cheat')
  });

  // Exam Timer Hook
  const {
    formattedTime,
    isWarning,
    isCritical,
  } = useExamTimer({
    durationSeconds: sessionData ? sessionData.ujian.durasi * 60 : 3600,
    // Absolute time dari backend — fixes bug "durasi diubah di admin
    // tapi timer siswa tetap pakai cache lama".
    startedAt: sessionData?.sesi?.mulaiAt ?? null,
    examSessionId: sessionId || '',
    onExpire: () => {
      if (!isSubmitting) submitExam('timeout');
    }
  });

  // Save opsi answer to server (debounced)
  const saveAnswerToServer = useDebounce(async (soalId: string, opsiIds: string[]) => {
    if (!sessionId) return;
    setSaveStatus('saving');
    try {
      await api.post(`/api/siswa/sesi/${sessionId}/jawab`, { soalId, opsiIds });
      setSaveStatus('saved');
      setTimeout(() => {
        setSaveStatus(prev => (prev === 'saved' ? 'idle' : prev));
      }, 2000);
    } catch (err) {
      console.error('Failed to save answer', err);
      setSaveStatus('error');
    }
  }, 500);

  // Save text answer (uraian/esai) to server (debounced 800ms)
  const saveTextAnswerToServer = useDebounce(async (soalId: string, teks: string) => {
    if (!sessionId) return;
    setSaveStatus('saving');
    try {
      await api.post(`/api/siswa/sesi/${sessionId}/jawab-batch`, {
        answers: {},
        textAnswers: { [soalId]: teks },
      });
      setSaveStatus('saved');
      setTimeout(() => {
        setSaveStatus(prev => (prev === 'saved' ? 'idle' : prev));
      }, 2000);
    } catch (err) {
      console.error('Failed to save text answer', err);
      setSaveStatus('error');
    }
  }, 800);

  // Online/offline listener — sinyal cepat saat browser deteksi koneksi putus.
  // Tidak block input (siswa tetap bisa jawab via localStorage, sync saat submit).
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleAnswerSelect = (opsiId: string) => {
    const currentSoal = soalList[currentIndex];
    if (!currentSoal) return;

    setAnswers(prev => {
      const isMulti = currentSoal.tipe === 'PG_KOMPLEKS';
      const currentAns = prev[currentSoal.id] || [];

      let newAns: string[];
      if (isMulti) {
        if (currentAns.includes(opsiId)) {
          newAns = currentAns.filter(id => id !== opsiId);
        } else {
          newAns = [...currentAns, opsiId];
        }
      } else {
        newAns = [opsiId];
      }

      const nextAnswers = { ...prev, [currentSoal.id]: newAns };
      localStorage.setItem(`exam_ans_${sessionId}`, JSON.stringify(nextAnswers));
      saveAnswerToServer(currentSoal.id, newAns);
      return nextAnswers;
    });
  };

  const handleTextChange = (soalId: string, teks: string) => {
    setTextAnswers(prev => {
      const next = { ...prev, [soalId]: teks };
      localStorage.setItem(`exam_text_${sessionId}`, JSON.stringify(next));
      saveTextAnswerToServer(soalId, teks);
      return next;
    });
  };

  const toggleFlag = () => {
    const currentSoal = soalList[currentIndex];
    if (!currentSoal) return;

    setFlagged(prev => {
      const nextFlags = { ...prev, [currentSoal.id]: !prev[currentSoal.id] };
      localStorage.setItem(`exam_flags_${sessionId}`, JSON.stringify(nextFlags));
      return nextFlags;
    });
  };

  const submitExam = async (reason: string = 'manual') => {
    if (!sessionId || isSubmitting) return;
    try {
      setIsSubmitting(true);

      // ── Flush localStorage → server sebelum submit ──
      // Pakai endpoint batch (1 request, 1 transaction) supaya tidak spam
      // N koneksi DB paralel yang bikin pool timeout. Cap 5 detik.
      try {
        const stored = localStorage.getItem(`exam_ans_${sessionId}`);
        const storedText = localStorage.getItem(`exam_text_${sessionId}`);
        const ansMap: Record<string, string[]> = stored ? JSON.parse(stored) : {};
        const textMap: Record<string, string> = storedText ? JSON.parse(storedText) : {};
        const hasOpsi = Object.values(ansMap).some(ids => Array.isArray(ids) && ids.length > 0);
        const hasTeks = Object.values(textMap).some(t => t.trim().length > 0);
        if (hasOpsi || hasTeks) {
          await Promise.race([
            api.post(`/api/siswa/sesi/${sessionId}/jawab-batch`, { answers: ansMap, textAnswers: textMap }),
            new Promise(resolve => setTimeout(resolve, 5000)),
          ]);
        }
      } catch (flushErr) {
        // Best-effort — backend tetap submit dgn state DB apa adanya.
        console.error('[submit] Flush localStorage gagal:', flushErr);
      }

      await api.post(`/api/siswa/sesi/${sessionId}/submit?reason=${reason}`);

      localStorage.removeItem(`exam_timer_${sessionId}`);
      localStorage.removeItem(`exam_ans_${sessionId}`);
      localStorage.removeItem(`exam_text_${sessionId}`);
      localStorage.removeItem(`exam_flags_${sessionId}`);

      if (document.fullscreenElement) {
        await document.exitFullscreen().catch(console.error);
      }

      navigate(`/dashboard/siswa/hasil/${sessionId}`, { replace: true });
    } catch (err: any) {
      // Saat waktu habis / pelanggaran, ujian HARUS keluar dari halaman exam.
      // Backend punya autoSubmitExpiredSessions yang akan finalize sesi
      // expired pada fetch berikutnya — jadi balik ke dashboard aman.
      if (reason === 'timeout' || reason === 'auto_cheat') {
        if (document.fullscreenElement) {
          await document.exitFullscreen().catch(() => {});
        }
        toast.info('Waktu ujian habis. Jawaban Anda akan dinilai otomatis.');
        navigate('/dashboard/siswa/ujian', { replace: true });
        return;
      }
      toast.error(err.message || 'Gagal mengumpulkan ujian. Silakan coba lagi.');
      setIsSubmitting(false);
    }
  };

  // Block copy/paste/cut/drag/drop di luar input
  useEffect(() => {
    const blockAction = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
        e.preventDefault();
      }
    };
    document.addEventListener('copy', blockAction);
    document.addEventListener('paste', blockAction);
    document.addEventListener('cut', blockAction);
    document.addEventListener('dragstart', blockAction);
    document.addEventListener('drop', blockAction);
    return () => {
      document.removeEventListener('copy', blockAction);
      document.removeEventListener('paste', blockAction);
      document.removeEventListener('cut', blockAction);
      document.removeEventListener('dragstart', blockAction);
      document.removeEventListener('drop', blockAction);
    };
  }, []);

  // ── Loading ─────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4" />
        <p className="text-on-surface-variant font-medium">Menyiapkan Ujian...</p>
      </div>
    );
  }

  if (!sessionData) return null;

  // ── Empty soal state ────────────────────────────────────
  if (soalList.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="bg-surface-container-lowest max-w-md w-full rounded-xl border border-outline-variant shadow-sm p-8 text-center space-y-4">
          <div className="w-16 h-16 bg-tertiary-fixed text-on-tertiary-fixed rounded-xl flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-headline-sm text-on-surface">Ujian Belum Siap</h2>
          <p className="text-on-surface-variant">
            Ujian <strong className="text-on-surface">{sessionData.ujian.judul}</strong> belum memiliki soal. Silakan hubungi guru pengampu untuk mengisi soal ujian terlebih dahulu.
          </p>
          <Button onClick={() => navigate('/dashboard/siswa')} className="w-full">
            Kembali ke Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const currentSoal = soalList[currentIndex];
  const answeredCount = soalList.filter(s => {
    if (s.tipe === 'URAIAN_SINGKAT' || s.tipe === 'ESAI') return !!textAnswers[s.id]?.trim();
    return answers[s.id] && answers[s.id].length > 0;
  }).length;
  const flaggedCount = Object.values(flagged).filter(v => v).length;
  const unansweredCount = soalList.length - answeredCount;
  const progressPercent = soalList.length > 0 ? (answeredCount / soalList.length) * 100 : 0;
  const isLastSoal = currentIndex === soalList.length - 1;

  // ── Fullscreen gate ─────────────────────────────────────
  if (!isFullscreen) {
    return (
      <div className="fixed inset-0 z-[100] bg-primary text-on-primary flex items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="fullscreen-gate-title"
          className="max-w-lg w-full text-center space-y-6"
        >
          <div className="w-20 h-20 bg-on-primary/10 text-on-primary rounded-xl flex items-center justify-center mx-auto">
            <Maximize className="w-10 h-10" />
          </div>
          {isFullscreenSupported ? (
            <>
              <div>
                <h2 id="fullscreen-gate-title" className="text-headline-lg text-on-primary">
                  Masuk Mode Layar Penuh
                </h2>
                <p className="text-on-primary/80 mt-3 leading-relaxed">
                  Ujian ini mewajibkan mode layar penuh. Anda tidak diizinkan berpindah tab
                  atau mengecilkan layar selama ujian berlangsung.
                </p>
              </div>
              <div className="bg-on-primary/10 text-on-primary p-4 rounded-xl text-sm text-left">
                <p className="font-semibold mb-2 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" /> Penting!
                </p>
                <ul className="list-disc pl-5 space-y-1 text-on-primary/90">
                  <li>Meninggalkan layar penuh dicatat sebagai <strong>pelanggaran</strong>.</li>
                  <li>Jika pelanggaran mencapai {maxViolations} kali, ujian <strong>dihentikan paksa</strong>.</li>
                </ul>
              </div>
            </>
          ) : (
            <>
              <div>
                <h2 id="fullscreen-gate-title" className="text-headline-lg text-on-primary">
                  Siap Memulai Ujian
                </h2>
                <p className="text-on-primary/80 mt-3 leading-relaxed">
                  Perangkat Anda tidak mendukung mode layar penuh. Ujian tetap bisa
                  dikerjakan. Pastikan tidak berpindah aplikasi selama ujian berlangsung.
                </p>
              </div>
              <div className="bg-on-primary/10 text-on-primary p-4 rounded-xl text-sm text-left">
                <p className="font-semibold mb-2 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" /> Penting!
                </p>
                <ul className="list-disc pl-5 space-y-1 text-on-primary/90">
                  <li>Berpindah aplikasi atau membuka tab lain dicatat sebagai <strong>pelanggaran</strong>.</li>
                  <li>Jika pelanggaran mencapai {maxViolations} kali, ujian <strong>dihentikan paksa</strong>.</li>
                </ul>
              </div>
            </>
          )}
          <button
            onClick={requestFullscreen}
            className="w-full h-12 bg-on-primary text-primary rounded-full font-bold uppercase tracking-wider text-label-md hover:bg-on-primary/90 active:translate-y-px transition-all shadow-md"
          >
            {isFullscreenSupported ? 'Masuk Layar Penuh & Lanjutkan Ujian' : 'Mulai Ujian'}
          </button>
        </div>
      </div>
    );
  }

  // ── Question navigator buttons (dipakai sidebar & mobile drawer) ──
  const renderNavButton = (soal: any, idx: number, onClick?: () => void) => {
    const isActive = idx === currentIndex;
    const isUraian = soal.tipe === 'URAIAN_SINGKAT' || soal.tipe === 'ESAI';
    const hasAnswer = isUraian
      ? !!textAnswers[soal.id]?.trim()
      : answers[soal.id] && answers[soal.id].length > 0;
    const isFlagged = flagged[soal.id];

    let cls = 'border border-outline-variant text-on-surface-variant hover:bg-surface-container-high bg-surface-container-lowest';
    if (isActive) cls = 'bg-primary-container text-on-primary-container ring-2 ring-primary ring-offset-2 ring-offset-surface-container-low';
    else if (hasAnswer) cls = 'bg-secondary text-on-secondary border border-secondary';
    else if (isFlagged) cls = 'bg-tertiary-fixed text-on-tertiary-fixed border border-tertiary';

    return (
      <button
        key={soal.id}
        onClick={() => { setCurrentIndex(idx); onClick?.(); }}
        className={`relative h-10 w-full rounded-lg font-bold text-sm transition-all focus:outline-none ${cls}`}
        aria-label={`Soal ${idx + 1}${hasAnswer ? ' (sudah dijawab)' : ''}${isFlagged ? ' (ditandai)' : ''}`}
        aria-current={isActive ? 'true' : undefined}
      >
        {/* Selalu pakai idx+1 — kalau soal di-acak, nomor display tetap berurut */}
        {idx + 1}
        {isFlagged && !isActive && (
          <Flag className="w-2.5 h-2.5 absolute top-1 right-1 fill-current" />
        )}
      </button>
    );
  };

  const navigatorLegend = (
    <div className="grid grid-cols-2 gap-2 text-xs text-on-surface-variant">
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded bg-secondary" /> Sudah dijawab
      </div>
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded bg-primary-container ring-2 ring-primary ring-offset-1" /> Saat ini
      </div>
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded bg-tertiary-fixed border border-tertiary" /> Ragu-ragu
      </div>
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded border border-outline-variant bg-surface-container-lowest" /> Belum
      </div>
    </div>
  );

  // ── Main Exam UI ────────────────────────────────────────
  return (
    <div className="h-[100dvh] bg-background flex flex-col select-none overflow-hidden">
      {/* HEADER FIXED */}
      <header className="h-16 bg-surface border-b border-outline-variant flex items-center justify-between px-4 sm:px-6 shrink-0 z-30">
        <div className="flex items-center gap-3 min-w-0 mr-4">
          <h1 className="font-bold text-primary truncate text-base sm:text-lg leading-tight" title={sessionData.ujian.judul}>
            {sessionData.ujian.judul}
          </h1>
          <span className="hidden md:inline text-label-sm text-on-surface-variant uppercase tracking-wider">
            {sessionData.ujian.mataPelajaran}
          </span>
        </div>

        {/* Save status indicator + Timer */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Mobile: icon-only sebelum timer biar hemat ruang */}
          <SaveIndicatorMobile status={saveStatus} isOnline={isOnline} />
          {/* Desktop: badge dengan teks */}
          <SaveIndicator status={saveStatus} isOnline={isOnline} />
          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono font-bold text-base sm:text-lg transition-colors ${
            isCritical ? 'bg-error-container text-error animate-pulse' :
            isWarning ? 'bg-tertiary-fixed text-on-tertiary-fixed' :
            'bg-primary-container/20 text-primary'
          }`}>
            <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>{formattedTime}</span>
          </div>
        </div>

        {/* Avatar + nama */}
        <div className="flex items-center gap-3 ml-4 min-w-0">
          <div className="text-right hidden sm:block min-w-0">
            <p className="font-semibold text-on-surface truncate text-sm">
              {sessionData.siswa?.nama || '?'}
            </p>
            <p className="text-label-sm text-on-surface-variant uppercase tracking-wider truncate">
              NIS {sessionData.siswa?.nis || '—'}
            </p>
          </div>
          <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold border border-outline-variant shrink-0">
            {(sessionData.siswa?.nama || '?').charAt(0).toUpperCase()}
          </div>
        </div>
      </header>

      {/* PROGRESS BAR */}
      <div className="h-2 w-full bg-surface-container shrink-0">
        <div
          className="h-full bg-secondary transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
          aria-label={`Progress: ${answeredCount} dari ${soalList.length} soal dijawab`}
        />
      </div>

      {/* Anti-cheat warning bar (di bawah progress bar) */}
      {isWarningVisible && latestViolation && (
        <div className="bg-error-container/80 border-b border-error/20 px-4 sm:px-6 py-3 shrink-0 z-20">
          <div className="max-w-5xl mx-auto flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-error mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-error text-sm">
                Pelanggaran {violationCount} / {maxViolations}
              </p>
              <p className="text-sm text-on-surface mt-0.5">{latestViolation.message}</p>
              <p className="text-xs text-on-surface-variant mt-1">
                Pelanggaran {maxViolations} kali akan menghentikan ujian dan menggugurkan nilai.
              </p>
            </div>
            <button
              onClick={dismissWarning}
              className="p-1 rounded hover:bg-error/10 text-error shrink-0"
              aria-label="Tutup peringatan"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* CONTENT AREA: soal + navigator */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* SOAL AREA */}
        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 sm:py-8">
          <div className="max-w-3xl mx-auto">
            {/* Question card */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm overflow-hidden">
              {/* Card header */}
              <div className="px-6 sm:px-8 py-5 border-b border-outline-variant flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <span className="bg-primary text-on-primary px-3 py-1 rounded-lg text-label-md font-bold uppercase tracking-wider">
                    Soal {currentIndex + 1}
                  </span>
                  <span className="text-label-sm text-on-surface-variant uppercase tracking-wider">
                    {currentSoal?.tipe?.replace('_', ' ')}
                  </span>
                </div>
                <button
                  onClick={toggleFlag}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-label-md font-bold uppercase tracking-wider transition-colors min-h-[40px] ${
                    flagged[currentSoal?.id]
                      ? 'bg-tertiary-fixed text-on-tertiary-fixed border border-tertiary'
                      : 'text-on-surface-variant hover:text-primary hover:bg-primary-container/10 border border-transparent'
                  }`}
                  aria-pressed={!!flagged[currentSoal?.id]}
                >
                  <Flag className={`w-4 h-4 ${flagged[currentSoal?.id] ? 'fill-current' : ''}`} />
                  {flagged[currentSoal?.id] ? 'Ditandai' : 'Ragu-ragu'}
                </button>
              </div>

              {/* Card body — pertanyaan & opsi */}
              <div className="px-6 sm:px-8 py-6 sm:py-8">
                <p className="text-body-question text-on-surface whitespace-pre-wrap leading-relaxed">
                  {currentSoal?.teks}
                </p>
                {currentSoal?.imageUrl && (
                  <img
                    src={currentSoal.imageUrl}
                    alt="Lampiran soal"
                    className="my-6 rounded-lg max-w-full max-h-[400px] border border-outline-variant"
                  />
                )}

                {currentSoal?.tipe === 'PG_KOMPLEKS' && (
                  <div className="mt-6 flex items-center gap-2 text-sm font-medium text-secondary bg-secondary-container/40 border border-secondary/20 rounded-lg p-3">
                    <CheckSquare className="w-4 h-4" />
                    Pilih semua jawaban yang benar (bisa lebih dari satu)
                  </div>
                )}

                {(currentSoal?.tipe === 'URAIAN_SINGKAT' || currentSoal?.tipe === 'ESAI') ? (
                  <div className="mt-6 space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <span>{currentSoal.tipe === 'URAIAN_SINGKAT' ? '✏️ Uraian Singkat' : '📝 Esai'}</span>
                      <span className="text-amber-600">— Ketik jawaban Anda di bawah ini</span>
                    </div>
                    <textarea
                      className={`w-full p-4 rounded-xl border border-outline-variant bg-surface-container-lowest text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 resize-y ${
                        currentSoal.tipe === 'ESAI' ? 'min-h-[240px]' : 'min-h-[100px]'
                      }`}
                      placeholder={currentSoal.tipe === 'ESAI'
                        ? 'Tulis jawaban esai Anda di sini secara lengkap dan jelas...'
                        : 'Tulis jawaban singkat Anda di sini...'}
                      value={textAnswers[currentSoal.id] || ''}
                      onChange={e => handleTextChange(currentSoal.id, e.target.value)}
                    />
                    <p className="text-xs text-on-surface-variant text-right">
                      {(textAnswers[currentSoal.id] || '').length} karakter
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 mt-8">
                    {currentSoal?.opsi.map((opsi: any, i: number) => {
                      const cAns = answers[currentSoal.id] || [];
                      const isSelected = cAns.includes(opsi.id);
                      const isMulti = currentSoal.tipe === 'PG_KOMPLEKS';
                      const letter = String.fromCharCode(65 + i);

                      return (
                        <button
                          type="button"
                          key={opsi.id}
                          onClick={() => handleAnswerSelect(opsi.id)}
                          aria-pressed={isSelected}
                          className={`relative w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                            isSelected
                              ? 'border-secondary bg-secondary-container/30'
                              : 'border-outline-variant bg-surface-container-lowest hover:bg-surface-container-low'
                          }`}
                        >
                          <div className={`w-10 h-10 flex items-center justify-center border-2 font-bold shrink-0 transition-colors ${
                            isMulti ? 'rounded-lg' : 'rounded-full'
                          } ${
                            isSelected
                              ? 'border-secondary bg-secondary-container text-on-secondary-container'
                              : 'border-outline-variant text-on-surface-variant bg-surface-container-lowest'
                          }`}>
                            {isMulti && isSelected ? <CheckSquare className="w-5 h-5" /> : letter}
                          </div>
                          <span className={`flex-1 text-base ${isSelected ? 'font-semibold text-on-surface' : 'text-on-surface'}`}>
                            {opsi.teks}
                          </span>
                          {isSelected && (
                            <div className="absolute inset-0 border-2 border-secondary rounded-xl pointer-events-none" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>

        {/* NAVIGATOR — KANAN, desktop only */}
        <aside className="hidden lg:flex lg:flex-col w-80 bg-surface-container-low border-l border-outline-variant shrink-0 overflow-hidden">
          <div className="p-5 border-b border-outline-variant shrink-0">
            <h2 className="text-headline-sm text-on-surface">Question Navigator</h2>
            <p className="text-sm text-on-surface-variant mt-1">
              <strong className="text-on-surface">{answeredCount}</strong> dari {soalList.length} Selesai
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            <div className="grid grid-cols-5 gap-2">
              {soalList.map((soal, idx) => renderNavButton(soal, idx))}
            </div>
          </div>

          <div className="p-5 border-t border-outline-variant shrink-0 space-y-4">
            {navigatorLegend}
            <Button
              variant="destructive"
              className="w-full"
              onClick={() => setShowSubmitConfirm(true)}
            >
              Selesai Ujian
            </Button>
          </div>
        </aside>
      </div>

      {/* FOOTER FIXED */}
      <footer className="h-20 bg-surface border-t border-outline-variant flex items-center justify-between px-4 sm:px-6 shrink-0 z-30 gap-2">
        <Button
          variant="ghost"
          onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
          disabled={currentIndex === 0}
          className="gap-2"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Sebelumnya</span>
        </Button>

        {/* Stats di tengah (desktop) atau Navigator button (mobile) */}
        <div className="flex items-center gap-3 flex-1 justify-center">
          <div className="hidden md:flex text-label-md text-on-surface-variant items-center gap-2">
            <span className="text-secondary font-semibold">{answeredCount} Dijawab</span>
            <span className="text-outline">•</span>
            <span>{unansweredCount} Belum</span>
            {flaggedCount > 0 && <>
              <span className="text-outline">•</span>
              <span className="text-on-tertiary-fixed font-semibold">{flaggedCount} Ditandai</span>
            </>}
          </div>
          <Button
            variant="outline"
            onClick={() => setShowMobileNav(true)}
            className="lg:hidden gap-2"
            aria-label="Navigator soal"
          >
            <List className="w-4 h-4" />
            <span className="hidden sm:inline">Navigator</span>
          </Button>
        </div>

        {/* Selanjutnya / Selesai */}
        {isLastSoal ? (
          <Button
            variant="destructive"
            onClick={() => setShowSubmitConfirm(true)}
            className="gap-2"
          >
            <CheckSquare className="w-4 h-4" />
            Selesai & Submit
          </Button>
        ) : (
          <Button
            onClick={() => setCurrentIndex(prev => Math.min(soalList.length - 1, prev + 1))}
            className="gap-2"
          >
            <span className="hidden sm:inline">Selanjutnya</span>
            <ChevronRight className="w-4 h-4" />
          </Button>
        )}
      </footer>

      {/* MOBILE NAV DRAWER */}
      {showMobileNav && (
        <div className="fixed inset-0 z-[150] lg:hidden" onClick={() => setShowMobileNav(false)}>
          <div className="absolute inset-0 bg-on-surface/40 backdrop-blur-sm" />
          <div
            ref={mobileNavRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-nav-title"
            className="absolute inset-x-0 bottom-0 max-h-[80vh] bg-surface-container-lowest rounded-t-xl border-t border-outline-variant flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant shrink-0">
              <div>
                <h3 id="mobile-nav-title" className="text-headline-sm text-on-surface">Navigator Soal</h3>
                <p className="text-sm text-on-surface-variant mt-0.5">
                  {answeredCount} dari {soalList.length} dijawab
                </p>
              </div>
              <button
                onClick={() => setShowMobileNav(false)}
                className="p-2 rounded-lg hover:bg-surface-container text-on-surface-variant"
                aria-label="Tutup navigator"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {navigatorLegend}
              <div className="grid grid-cols-5 sm:grid-cols-6 gap-2 mt-4">
                {soalList.map((soal, idx) => renderNavButton(soal, idx, () => setShowMobileNav(false)))}
              </div>
            </div>

            <div className="p-4 border-t border-outline-variant shrink-0">
              <Button
                variant="destructive"
                className="w-full"
                onClick={() => { setShowMobileNav(false); setShowSubmitConfirm(true); }}
              >
                Selesai & Submit Ujian
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* SUBMIT CONFIRM MODAL */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-on-surface/50 backdrop-blur-sm">
          <div
            ref={submitModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="submit-confirm-title"
            className="bg-surface-container-lowest max-w-md w-full rounded-xl border border-outline-variant shadow-xl overflow-hidden"
          >
            <div className="p-6 text-center space-y-4">
              <div className="w-16 h-16 bg-primary-container/30 text-primary rounded-xl flex items-center justify-center mx-auto">
                <CheckSquare className="w-8 h-8" />
              </div>
              <h3 id="submit-confirm-title" className="text-headline-md text-on-surface">
                Selesai Ujian?
              </h3>
              <p className="text-on-surface-variant">
                Anda yakin ingin menyelesaikan ujian sekarang?
              </p>
              {unansweredCount > 0 && (
                <div className="bg-error-container text-error text-sm font-semibold p-3 rounded-lg">
                  Masih ada {unansweredCount} soal yang belum dijawab!
                </div>
              )}
            </div>
            <div className="bg-surface-container-low p-4 border-t border-outline-variant flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowSubmitConfirm(false)}>
                Kembali
              </Button>
              <Button
                variant="destructive"
                onClick={() => submitExam('manual')}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Mengumpulkan...' : 'Ya, Kumpulkan'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
