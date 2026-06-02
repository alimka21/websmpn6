import { useState, useEffect, useRef, useMemo } from 'react';

interface UseExamTimerProps {
  durationSeconds: number;
  /**
   * ISO string timestamp saat siswa mulai ujian (dari backend sesi.mulaiAt).
   * Timer hitung absolut: endAt = mulaiAt + durasi → remaining = endAt - now.
   * Tidak tergantung localStorage, jadi:
   *   - Ganti durasi di admin langsung berlaku (refresh ambil durasi baru)
   *   - Tutup/buka browser tetap akurat (waktu server-based)
   */
  startedAt?: string | Date | null;
  examSessionId: string;
  onExpire: () => void;
}

export function useExamTimer({ durationSeconds, startedAt, examSessionId, onExpire }: UseExamTimerProps) {
  // endAtMs = absolute deadline dalam millisecond.
  // Kalau startedAt null (sesi belum tracked), pakai now+durasi sebagai
  // fallback supaya UI tidak crash. Backend SHOULD selalu kirim mulaiAt.
  const endAtMs = useMemo(() => {
    if (startedAt) {
      const start = new Date(startedAt).getTime();
      if (!isNaN(start)) return start + durationSeconds * 1000;
    }
    return Date.now() + durationSeconds * 1000;
  }, [startedAt, durationSeconds]);

  const computeRemaining = () => Math.max(0, Math.floor((endAtMs - Date.now()) / 1000));

  const [timeLeft, setTimeLeft] = useState<number>(computeRemaining);
  const [isExpired, setIsExpired] = useState(false);
  const expireRef = useRef(false);

  useEffect(() => {
    // Recompute saat endAtMs berubah (mis. durasi baru dari backend)
    const initial = computeRemaining();
    setTimeLeft(initial);

    if (initial <= 0) {
      setIsExpired(true);
      if (!expireRef.current) {
        expireRef.current = true;
        onExpire();
      }
      return;
    }

    const intervalId = setInterval(() => {
      const next = Math.max(0, Math.floor((endAtMs - Date.now()) / 1000));
      setTimeLeft(next);
      if (next === 0 && !expireRef.current) {
        clearInterval(intervalId);
        setIsExpired(true);
        expireRef.current = true;
        // Cleanup old localStorage key kalau ada (legacy)
        try { localStorage.removeItem(`exam_timer_${examSessionId}`); } catch {}
        onExpire();
      }
    }, 1000);

    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endAtMs, examSessionId, onExpire]);

  // Status peringatan
  const isWarning = timeLeft <= 600 && timeLeft > 0; // ≤ 10 menit
  const isCritical = timeLeft <= 120 && timeLeft > 0; // ≤ 2 menit

  // Format MM:SS atau HH:MM:SS
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  };

  return {
    timeLeft,
    formattedTime: formatTime(timeLeft),
    isWarning,
    isCritical,
    isExpired,
  };
}
