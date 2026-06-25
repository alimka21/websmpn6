import { toast } from 'sonner';
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import {
  AlertCircle, Clock, ChevronLeft, ChevronRight, Flag, X, CheckSquare,
  Maximize, List, ShieldAlert, Check, CloudOff, Loader2, WifiOff, HelpCircle,
} from 'lucide-react';
import api from '../../lib/api';
import { useAntiCheat } from '../../hooks/useAntiCheat';
import { useExamTimer } from '../../hooks/useExamTimer';
import { useModalA11y } from '../../hooks/useModalA11y';

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

function SaveIndicator({
  status,
  isOnline,
}: {
  status: 'idle' | 'saving' | 'saved' | 'error';
  isOnline: boolean;
}) {
  if (!isOnline) return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-error-container text-error text-xs font-medium" role="status" aria-live="polite">
      <WifiOff className="w-3.5 h-3.5" /><span>Offline</span>
    </div>
  );
  if (status === 'saving') return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container text-on-surface-variant text-xs font-medium" role="status" aria-live="polite">
      <Loader2 className="w-3.5 h-3.5 animate-spin" /><span>Menyimpan…</span>
    </div>
  );
  if (status === 'saved') return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container text-on-surface-variant text-xs font-medium" role="status" aria-live="polite">
      <Check className="w-3.5 h-3.5" /><span>Tersimpan</span>
    </div>
  );
  if (status === 'error') return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-error-container text-error text-xs font-medium" role="status" aria-live="polite">
      <CloudOff className="w-3.5 h-3.5" /><span>Belum tersimpan</span>
    </div>
  );
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

  const submitModalRef = useModalA11y<HTMLDivElement>(showSubmitConfirm, () => setShowSubmitConfirm(false));
  const mobileNavRef = useModalA11y<HTMLDivElement>(showMobileNav, () => setShowMobileNav(false));

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await api.get(`/api/siswa/sesi/${sessionId}`);
        if (res.sesi?.status === 'SELESAI' || res.sesi?.status === 'AUTO_SUBMIT') {
          navigate(`/dashboard/siswa/hasil/${sessionId}`, { replace: true });
          return;
        }
        setSessionData(res);

        // Seeded Fisher-Yates — deterministik dari sessionId
        const seedStr = String(sessionId || '');
        let seed = 0;
        for (let i = 0; i < seedStr.length; i++) seed = (seed * 31 + seedStr.charCodeAt(i)) >>> 0;
        const rng = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0x100000000; };
        const seededShuffle = <T,>(arr: T[]): T[] => {
          const a = arr.slice();
          for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
          return a;
        };

        let soal: any[] = res.ujian.soal || [];

        // ── Acak soal ──────────────────────────────────────────────────────────
        // Urutan SELALU dibaca dari localStorage terlebih dahulu.
        // Ini menjamin urutan stabil walau halaman di-refresh / koneksi putus.
        if (res.ujian.acak) {
          const orderKey = `exam_soal_order_${sessionId}`;
          const storedOrder = localStorage.getItem(orderKey);
          if (storedOrder) {
            try {
              const ids: string[] = JSON.parse(storedOrder);
              const map = new Map(soal.map((s: any) => [s.id, s]));
              const reordered = ids.map(id => map.get(id)).filter(Boolean) as any[];
              // Soal baru (tidak ada di stored order) ditambahkan di akhir
              const known = new Set(ids);
              const extra = soal.filter((s: any) => !known.has(s.id));
              soal = [...reordered, ...extra];
            } catch {
              soal = seededShuffle(soal);
              try { localStorage.setItem(orderKey, JSON.stringify(soal.map((s: any) => s.id))); } catch { /* ignore */ }
            }
          } else {
            soal = seededShuffle(soal);
            try { localStorage.setItem(orderKey, JSON.stringify(soal.map((s: any) => s.id))); } catch { /* ignore */ }
          }
        }

        // ── Acak opsi ──────────────────────────────────────────────────────────
        if (res.ujian.acakOpsi) {
          const opsiKey = `exam_opsi_order_${sessionId}`;
          let storedOpsi: Record<string, string[]> = {};
          try {
            const raw = localStorage.getItem(opsiKey);
            if (raw) storedOpsi = JSON.parse(raw);
          } catch { storedOpsi = {}; }

          let changed = false;
          soal = soal.map((s: any) => {
            if (!s.opsi?.length) return s;
            const stored = storedOpsi[s.id];
            if (stored?.length) {
              const map = new Map(s.opsi.map((o: any) => [o.id, o]));
              const reordered = stored.map((id: string) => map.get(id)).filter(Boolean);
              return { ...s, opsi: reordered };
            } else {
              const shuffled = seededShuffle(s.opsi);
              storedOpsi[s.id] = shuffled.map((o: any) => o.id);
              changed = true;
              return { ...s, opsi: shuffled };
            }
          });
          if (changed) {
            try { localStorage.setItem(opsiKey, JSON.stringify(storedOpsi)); } catch { /* ignore */ }
          }
        }

        setSoalList(soal);

        const storedAns = localStorage.getItem(`exam_ans_${sessionId}`);
        setAnswers(storedAns ? JSON.parse(storedAns) : {});
        const storedText = localStorage.getItem(`exam_text_${sessionId}`);
        setTextAnswers(storedText ? JSON.parse(storedText) : {});
        const storedFlags = localStorage.getItem(`exam_flags_${sessionId}`);
        setFlagged(storedFlags ? JSON.parse(storedFlags) : {});
      } catch (err: any) {
        if (err?.status === 404 || /tidak ditemukan|akses ditolak/i.test(err?.message || '')) {
          try {
            ['ans', 'text', 'flags', 'timer', 'soal_order', 'opsi_order'].forEach(k => localStorage.removeItem(`exam_${k}_${sessionId}`));
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

  const { violationCount, isFullscreen, isFullscreenSupported, isWarningVisible, latestViolation, requestFullscreen, dismissWarning, maxViolations } = useAntiCheat({
    sessionId: sessionId || '',
    maxViolations: 3,
    onAutoSubmit: () => submitExam('auto_cheat'),
  });

  const { formattedTime, isWarning, isCritical } = useExamTimer({
    durationSeconds: sessionData ? sessionData.ujian.durasi * 60 : 3600,
    startedAt: sessionData?.sesi?.mulaiAt ?? null,
    examSessionId: sessionId || '',
    onExpire: () => { if (!isSubmitting) submitExam('timeout'); },
  });

  const saveAnswerToServer = useDebounce(async (soalId: string, opsiIds: string[]) => {
    if (!sessionId) return;
    setSaveStatus('saving');
    try {
      await api.post(`/api/siswa/sesi/${sessionId}/jawab`, { soalId, opsiIds });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(prev => prev === 'saved' ? 'idle' : prev), 2000);
    } catch { setSaveStatus('error'); }
  }, 500);

  const saveTextAnswerToServer = useDebounce(async (soalId: string, teks: string) => {
    if (!sessionId) return;
    setSaveStatus('saving');
    try {
      await api.post(`/api/siswa/sesi/${sessionId}/jawab-batch`, { answers: {}, textAnswers: { [soalId]: teks } });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(prev => prev === 'saved' ? 'idle' : prev), 2000);
    } catch { setSaveStatus('error'); }
  }, 800);

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  const handleAnswerSelect = (opsiId: string) => {
    const currentSoal = soalList[currentIndex];
    if (!currentSoal) return;
    setAnswers(prev => {
      const isMulti = currentSoal.tipe === 'PG_KOMPLEKS';
      const currentAns = prev[currentSoal.id] || [];
      const newAns = isMulti
        ? currentAns.includes(opsiId) ? currentAns.filter(id => id !== opsiId) : [...currentAns, opsiId]
        : [opsiId];
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
      } catch (flushErr) { console.error('[submit] Flush gagal:', flushErr); }

      await api.post(`/api/siswa/sesi/${sessionId}/submit?reason=${reason}`);
      ['timer', 'ans', 'text', 'flags', 'soal_order', 'opsi_order'].forEach(k => localStorage.removeItem(`exam_${k}_${sessionId}`));
      if (document.fullscreenElement) await document.exitFullscreen().catch(console.error);
      navigate(`/dashboard/siswa/hasil/${sessionId}`, { replace: true });
    } catch (err: any) {
      if (reason === 'timeout' || reason === 'auto_cheat') {
        if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
        toast.info('Waktu ujian habis. Jawaban Anda akan dinilai otomatis.');
        navigate('/dashboard/siswa/ujian', { replace: true });
        return;
      }
      toast.error(err.message || 'Gagal mengumpulkan ujian. Silakan coba lagi.');
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    const blockAction = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') e.preventDefault();
    };
    ['copy', 'paste', 'cut', 'dragstart', 'drop'].forEach(ev => document.addEventListener(ev, blockAction));
    return () => ['copy', 'paste', 'cut', 'dragstart', 'drop'].forEach(ev => document.removeEventListener(ev, blockAction));
  }, []);

  // ── Loading ─────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-container-low flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        <p className="text-on-surface-variant font-medium">Menyiapkan Ujian...</p>
      </div>
    );
  }

  if (!sessionData) return null;

  // ── Empty soal ──────────────────────────────────────────
  if (soalList.length === 0) {
    return (
      <div className="min-h-screen bg-surface-container-low flex items-center justify-center p-4">
        <div className="bg-white max-w-md w-full rounded-2xl border border-outline-variant shadow-sm p-8 text-center space-y-4">
          <div className="w-16 h-16 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-on-surface">Ujian Belum Siap</h2>
          <p className="text-on-surface-variant">
            Ujian <strong className="text-on-surface">{sessionData.ujian.judul}</strong> belum memiliki soal. Hubungi guru pengampu.
          </p>
          <Button onClick={() => navigate('/dashboard/siswa')} className="w-full rounded-xl">
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
  const flaggedCount = Object.values(flagged).filter(Boolean).length;
  const unansweredCount = soalList.length - answeredCount;
  const progressPercent = soalList.length > 0 ? (answeredCount / soalList.length) * 100 : 0;
  const isLastSoal = currentIndex === soalList.length - 1;

  // ── Fullscreen gate ─────────────────────────────────────
  if (!isFullscreen) {
    return (
      <div className="fixed inset-0 z-[100] bg-primary text-on-primary flex items-center justify-center p-4">
        <div role="dialog" aria-modal="true" aria-labelledby="fullscreen-gate-title" className="max-w-lg w-full text-center space-y-6">
          <div className="w-20 h-20 bg-on-primary/10 rounded-2xl flex items-center justify-center mx-auto">
            <Maximize className="w-10 h-10" />
          </div>
          {isFullscreenSupported ? (
            <>
              <div>
                <h2 id="fullscreen-gate-title" className="text-2xl font-bold">Masuk Mode Layar Penuh</h2>
                <p className="text-on-primary/80 mt-3 leading-relaxed">Ujian ini mewajibkan mode layar penuh. Anda tidak diizinkan berpindah tab atau mengecilkan layar selama ujian berlangsung.</p>
              </div>
              <div className="bg-on-primary/10 p-4 rounded-xl text-sm text-left">
                <p className="font-semibold mb-2 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> Penting!</p>
                <ul className="list-disc pl-5 space-y-1 text-on-primary/90">
                  <li>Meninggalkan layar penuh dicatat sebagai <strong>pelanggaran</strong>.</li>
                  <li>Jika pelanggaran mencapai {maxViolations} kali, ujian <strong>dihentikan paksa</strong>.</li>
                </ul>
              </div>
            </>
          ) : (
            <>
              <div>
                <h2 id="fullscreen-gate-title" className="text-2xl font-bold">Siap Memulai Ujian</h2>
                <p className="text-on-primary/80 mt-3 leading-relaxed">Perangkat Anda tidak mendukung mode layar penuh. Ujian tetap bisa dikerjakan. Pastikan tidak berpindah aplikasi selama ujian berlangsung.</p>
              </div>
              <div className="bg-on-primary/10 p-4 rounded-xl text-sm text-left">
                <p className="font-semibold mb-2 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> Penting!</p>
                <ul className="list-disc pl-5 space-y-1 text-on-primary/90">
                  <li>Berpindah aplikasi atau membuka tab lain dicatat sebagai <strong>pelanggaran</strong>.</li>
                  <li>Jika pelanggaran mencapai {maxViolations} kali, ujian <strong>dihentikan paksa</strong>.</li>
                </ul>
              </div>
            </>
          )}
          <button
            onClick={requestFullscreen}
            className="w-full h-12 bg-on-primary text-primary rounded-full font-bold uppercase tracking-wider text-sm hover:bg-on-primary/90 active:translate-y-px transition-all shadow-md"
          >
            {isFullscreenSupported ? 'Masuk Layar Penuh & Lanjutkan Ujian' : 'Mulai Ujian'}
          </button>
        </div>
      </div>
    );
  }

  // ── Nav button renderer ──────────────────────────────────
  const renderNavButton = (soal: any, idx: number, onClick?: () => void) => {
    const isActive = idx === currentIndex;
    const isUraian = soal.tipe === 'URAIAN_SINGKAT' || soal.tipe === 'ESAI';
    const hasAnswer = isUraian ? !!textAnswers[soal.id]?.trim() : (answers[soal.id] && answers[soal.id].length > 0);
    const isFlagged = flagged[soal.id];

    let cls = 'bg-white border border-gray-200 text-gray-400 hover:border-primary/40 hover:text-primary';
    if (isActive) cls = 'bg-primary text-white shadow-md shadow-primary/25';
    else if (hasAnswer && isFlagged) cls = 'bg-amber-500 text-white';
    else if (hasAnswer) cls = 'bg-green-800 text-white';
    else if (isFlagged) cls = 'bg-amber-500 text-white';

    return (
      <button
        key={soal.id}
        onClick={() => { setCurrentIndex(idx); onClick?.(); }}
        className={`relative h-11 w-full rounded-xl font-bold text-sm transition-all focus:outline-none ${cls}`}
        aria-label={`Soal ${idx + 1}${hasAnswer ? ' (sudah dijawab)' : ''}${isFlagged ? ' (ditandai)' : ''}`}
        aria-current={isActive ? 'true' : undefined}
      >
        {idx + 1}
        {isFlagged && !isActive && <Flag className="w-2.5 h-2.5 absolute top-1 right-1 fill-current" />}
      </button>
    );
  };

  // ── Main Exam UI ────────────────────────────────────────
  return (
    <div className="h-[100dvh] bg-surface-container-low flex flex-col select-none overflow-hidden">

      {/* HEADER */}
      <header className="h-16 bg-white border-b border-outline-variant/40 flex items-center justify-between px-4 sm:px-6 shrink-0 z-30 shadow-[0px_2px_8px_rgba(0,0,0,0.06)]">
        {/* Left: Logo + Title */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 bg-on-surface rounded-xl flex items-center justify-center shrink-0">
            <span className="text-white text-base font-bold">
              {(sessionData.ujian.judul || 'U').charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-primary text-base leading-tight truncate max-w-[160px] sm:max-w-xs md:max-w-sm lg:max-w-md">
              {sessionData.ujian.judul}
            </h1>
            <p className="text-xs text-on-surface-variant truncate">
              {sessionData.ujian.mataPelajaran}
            </p>
          </div>
        </div>

        {/* Right: Save indicator + Help + Submit */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="hidden sm:block">
            <SaveIndicator status={saveStatus} isOnline={isOnline} />
          </div>
          <button
            className="w-9 h-9 rounded-full border border-outline-variant flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors"
            title="Panduan ujian"
            aria-label="Panduan"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowSubmitConfirm(true)}
            className="h-9 px-4 sm:px-5 bg-primary text-on-primary rounded-full font-bold text-sm hover:bg-primary-container transition-colors shadow-sm"
          >
            <span className="hidden sm:inline">Submit Exam</span>
            <span className="sm:hidden">Submit</span>
          </button>
        </div>
      </header>

      {/* Anti-cheat warning bar */}
      {isWarningVisible && latestViolation && (
        <div className="bg-error-container/80 border-b border-error/20 px-4 sm:px-6 py-3 shrink-0 z-20">
          <div className="max-w-5xl mx-auto flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-error mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-error text-sm">Pelanggaran {violationCount} / {maxViolations}</p>
              <p className="text-sm text-on-surface mt-0.5">{latestViolation.message}</p>
              <p className="text-xs text-on-surface-variant mt-1">Pelanggaran {maxViolations} kali akan menghentikan ujian dan menggugurkan nilai.</p>
            </div>
            <button onClick={dismissWarning} className="p-1 rounded hover:bg-error/10 text-error shrink-0" aria-label="Tutup peringatan">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* CONTENT AREA */}
      <div className="flex-1 flex min-h-0 overflow-hidden">

        {/* MAIN — Question Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 relative">
          {/* Watermark diagonal — identitas siswa tercetak di layar sehingga
              screenshot apapun yang dikirim ke AI tetap membawa nama+NIS siswa */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 overflow-hidden select-none z-10"
            style={{
              backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(
                `<svg xmlns='http://www.w3.org/2000/svg' width='340' height='200'>` +
                `<text x='50%' y='45%' text-anchor='middle' dominant-baseline='middle' ` +
                `font-family='sans-serif' font-size='13' fill='rgba(0,0,0,0.055)' ` +
                `transform='rotate(-30,170,100)'>${sessionData.siswa?.nama || ''}</text>` +
                `<text x='50%' y='62%' text-anchor='middle' dominant-baseline='middle' ` +
                `font-family='sans-serif' font-size='11' fill='rgba(0,0,0,0.045)' ` +
                `transform='rotate(-30,170,100)'>NIS: ${sessionData.siswa?.nis || ''}</text>` +
                `</svg>`
              )}")`,
              backgroundRepeat: 'repeat',
            }}
          />
          <div className="max-w-3xl mx-auto space-y-6 relative z-0">

            {/* Pills row: Question counter + mobile nav trigger + Timer */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center bg-primary-fixed text-primary text-sm font-semibold px-4 py-2 rounded-full">
                  Soal {currentIndex + 1} dari {soalList.length}
                </span>
                <button
                  onClick={() => setShowMobileNav(true)}
                  className="lg:hidden inline-flex items-center gap-1.5 bg-surface-container text-on-surface-variant text-sm font-medium px-3 py-2 rounded-full hover:bg-surface-container-high transition-colors"
                  aria-label="Buka navigator soal"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-mono font-bold text-sm transition-colors ${
                isCritical ? 'bg-error-container text-error animate-pulse' :
                isWarning  ? 'bg-amber-100 text-amber-700' :
                             'bg-primary-fixed text-primary'
              }`}>
                <Clock className="w-4 h-4" />
                <span>{formattedTime}</span>
              </div>
            </div>

            {/* Question text */}
            <p className="text-xl sm:text-2xl font-bold text-on-surface leading-relaxed whitespace-pre-wrap">
              {currentSoal?.teks}
            </p>

            {/* Question image */}
            {currentSoal?.imageUrl && (
              <img
                src={currentSoal.imageUrl}
                alt="Lampiran soal"
                className="rounded-xl max-w-full max-h-[400px] border border-outline-variant object-contain"
              />
            )}

            {/* PG Kompleks hint */}
            {currentSoal?.tipe === 'PG_KOMPLEKS' && (
              <div className="flex items-center gap-2 text-sm font-medium text-primary bg-primary-fixed/70 border border-primary/20 rounded-xl p-3">
                <CheckSquare className="w-4 h-4 shrink-0" />
                Pilih semua jawaban yang benar (bisa lebih dari satu)
              </div>
            )}

            {/* Uraian / Esai */}
            {(currentSoal?.tipe === 'URAIAN_SINGKAT' || currentSoal?.tipe === 'ESAI') ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <span>{currentSoal.tipe === 'URAIAN_SINGKAT' ? '✏️ Uraian Singkat' : '📝 Esai'}</span>
                  <span className="text-amber-600 font-normal">— Ketik jawaban Anda di bawah ini</span>
                </div>
                <textarea
                  className={`w-full p-4 rounded-xl border border-outline-variant bg-white text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 resize-y shadow-sm ${
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
              /* Pilihan Ganda */
              <div className="space-y-3">
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
                      className={`relative w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 shadow-[0px_1px_4px_rgba(0,0,0,0.06)] ${
                        isSelected
                          ? 'border-primary bg-primary/5'
                          : 'border-outline-variant bg-white hover:border-primary/40 hover:bg-surface-container-low'
                      }`}
                    >
                      <div className={`w-10 h-10 flex items-center justify-center font-bold shrink-0 transition-colors rounded-xl border text-sm ${
                        isSelected
                          ? 'bg-primary text-white border-primary'
                          : 'bg-surface-container text-on-surface-variant border-outline-variant'
                      }`}>
                        {isMulti && isSelected ? <Check className="w-5 h-5" /> : letter}
                      </div>
                      <span className={`flex-1 text-base leading-snug ${isSelected ? 'font-semibold text-on-surface' : 'text-on-surface'}`}>
                        {opsi.teks}
                      </span>
                      {opsi.imageUrl && (
                        <img src={opsi.imageUrl} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0 border border-outline-variant" />
                      )}
                      {isSelected && (
                        <div className="absolute inset-0 border-2 border-primary rounded-xl pointer-events-none" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Prev / Next navigation */}
            <div className="flex items-center justify-between pt-2">
              <Button
                variant="outline"
                onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                disabled={currentIndex === 0}
                className="gap-2 rounded-xl px-5 h-11"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Previous Question</span>
                <span className="sm:hidden">Sebelumnya</span>
              </Button>

              {isLastSoal ? (
                <Button
                  onClick={() => setShowSubmitConfirm(true)}
                  className="gap-2 rounded-xl px-5 h-11 bg-primary hover:bg-primary-container"
                >
                  <CheckSquare className="w-4 h-4" />
                  <span className="hidden sm:inline">Submit Exam</span>
                  <span className="sm:hidden">Submit</span>
                </Button>
              ) : (
                <Button
                  onClick={() => setCurrentIndex(prev => Math.min(soalList.length - 1, prev + 1))}
                  className="gap-2 rounded-xl px-5 h-11 bg-primary hover:bg-primary-container"
                >
                  <span className="hidden sm:inline">Next Question</span>
                  <span className="sm:hidden">Selanjutnya</span>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </main>

        {/* SIDEBAR — Navigator (desktop only) */}
        <aside className="hidden lg:flex lg:flex-col w-72 bg-white border-l border-outline-variant/40 shrink-0 overflow-hidden shadow-[-2px_0px_8px_rgba(0,0,0,0.04)]">
          {/* Sidebar header */}
          <div className="p-5 border-b border-outline-variant/40 shrink-0">
            <h2 className="font-bold text-lg text-primary">Question Navigator</h2>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-on-surface-variant">{soalList.length} Questions Total</span>
              <span className="text-xs font-bold text-primary">Progress: {Math.round(progressPercent)}%</span>
            </div>
            <div className="h-1.5 bg-surface-container-high rounded-full mt-2.5 overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Grid of nav buttons */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-5 gap-2">
              {soalList.map((soal, idx) => renderNavButton(soal, idx))}
            </div>
          </div>

          {/* Sidebar footer: legend + flag button */}
          <div className="p-4 border-t border-outline-variant/40 shrink-0 space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <div className="w-3.5 h-3.5 rounded-full bg-green-800 shrink-0" />
                <span className="text-sm text-on-surface">Sudah Dijawab</span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-3.5 h-3.5 rounded-full bg-amber-500 shrink-0" />
                <span className="text-sm text-on-surface">Ragu-ragu</span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-3.5 h-3.5 rounded-full bg-white border border-gray-300 shrink-0" />
                <span className="text-sm text-on-surface">Belum Dijawab</span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-3.5 h-3.5 rounded-full bg-primary shrink-0" />
                <span className="text-sm text-on-surface">Saat Ini</span>
              </div>
            </div>

            <button
              onClick={toggleFlag}
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 font-semibold text-sm transition-all ${
                flagged[currentSoal?.id]
                  ? 'bg-amber-500 text-white border-amber-500'
                  : 'border-amber-400 text-amber-600 hover:bg-amber-50'
              }`}
            >
              <Flag className={`w-4 h-4 ${flagged[currentSoal?.id] ? 'fill-white' : ''}`} />
              {flagged[currentSoal?.id] ? 'Ditandai' : 'Flag for Review'}
            </button>
          </div>
        </aside>
      </div>

      {/* MOBILE NAV DRAWER */}
      {showMobileNav && (
        <div className="fixed inset-0 z-[150] lg:hidden" onClick={() => setShowMobileNav(false)}>
          <div className="absolute inset-0 bg-on-surface/40 backdrop-blur-sm" />
          <div
            ref={mobileNavRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-nav-title"
            className="absolute inset-x-0 bottom-0 max-h-[80vh] bg-white rounded-t-2xl border-t border-outline-variant flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant shrink-0">
              <div>
                <h3 id="mobile-nav-title" className="font-bold text-base text-primary">Navigator Soal</h3>
                <p className="text-sm text-on-surface-variant mt-0.5">
                  {answeredCount} dari {soalList.length} dijawab &bull; {flaggedCount > 0 ? `${flaggedCount} ditandai` : ''}
                </p>
              </div>
              <button onClick={() => setShowMobileNav(false)} className="p-2 rounded-xl hover:bg-surface-container text-on-surface-variant" aria-label="Tutup navigator">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-800 shrink-0" />
                  <span className="text-xs text-on-surface-variant">Sudah Dijawab</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-primary shrink-0" />
                  <span className="text-xs text-on-surface-variant">Saat Ini</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-amber-500 shrink-0" />
                  <span className="text-xs text-on-surface-variant">Ragu-ragu</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-white border border-gray-300 shrink-0" />
                  <span className="text-xs text-on-surface-variant">Belum Dijawab</span>
                </div>
              </div>

              <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
                {soalList.map((soal, idx) => renderNavButton(soal, idx, () => setShowMobileNav(false)))}
              </div>
            </div>

            <div className="p-4 border-t border-outline-variant shrink-0 space-y-2">
              <button
                onClick={() => { toggleFlag(); }}
                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 font-semibold text-sm transition-all ${
                  flagged[currentSoal?.id]
                    ? 'bg-amber-500 text-white border-amber-500'
                    : 'border-amber-400 text-amber-600 hover:bg-amber-50'
                }`}
              >
                <Flag className={`w-4 h-4 ${flagged[currentSoal?.id] ? 'fill-white' : ''}`} />
                {flagged[currentSoal?.id] ? 'Ditandai' : 'Flag for Review'}
              </button>
              <Button
                variant="destructive"
                className="w-full rounded-xl"
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
            className="bg-white max-w-md w-full rounded-2xl border border-outline-variant shadow-xl overflow-hidden"
          >
            <div className="p-6 text-center space-y-4">
              <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto">
                <CheckSquare className="w-8 h-8" />
              </div>
              <h3 id="submit-confirm-title" className="text-xl font-bold text-on-surface">Selesai Ujian?</h3>
              <p className="text-on-surface-variant">Anda yakin ingin menyelesaikan dan mengumpulkan jawaban sekarang?</p>
              {unansweredCount > 0 && (
                <div className="bg-error-container text-error text-sm font-semibold p-3 rounded-xl">
                  Masih ada <strong>{unansweredCount} soal</strong> yang belum dijawab!
                </div>
              )}
            </div>
            <div className="bg-surface-container-low px-6 py-4 border-t border-outline-variant flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowSubmitConfirm(false)} className="rounded-xl">
                Kembali
              </Button>
              <Button
                onClick={() => submitExam('manual')}
                disabled={isSubmitting}
                className="rounded-xl bg-primary hover:bg-primary-container"
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
