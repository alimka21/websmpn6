import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Users, CheckCircle, Home, User, ArrowRight, GraduationCap } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { useSiteConfig } from '../hooks/useSiteConfig';

interface Siswa {
  id: string;
  nama: string;
  nis: string;
  kelas: string;
}

interface RecentActivity {
  id: string;
  nama: string;
  nis: string;
  kelas: string;
  kelasId: string;
  waktu: string;
  tepatWaktu: boolean;
  keterlambatan: number;
}

interface KelasSummary {
  id: string;
  nama: string;
  totalSiswa: number;
  hadirCount: number;
}

export default function PresensiSiswaKiosk() {
  const cfg = useSiteConfig();
  const schoolName = cfg.namaSekolah || 'Portal Sekolah';

  const [currentTime, setCurrentTime] = useState(new Date());
  const [nis, setNis] = useState('');
  const [siswa, setSiswa] = useState<Siswa | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successData, setSuccessData] = useState<{ nama: string; kelas: string; time: string }>({ nama: '', kelas: '', time: '' });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [attendedCount, setAttendedCount] = useState(0);
  const [totalSiswa, setTotalSiswa] = useState(0);
  const [kelasList, setKelasList] = useState<KelasSummary[]>([]);
  const [selectedKelasFilter, setSelectedKelasFilter] = useState<string>('ALL');

  const inputRef = useRef<HTMLInputElement>(null);

  // Update clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    loadRecentActivity();
    loadKelasData();
    // Auto-focus input
    inputRef.current?.focus();
  }, []);

  const loadRecentActivity = async () => {
    try {
      const data = await api.get('/api/presensi/siswa/recent?limit=100'); // Load more for filtering
      setRecentActivity(data);
      setAttendedCount(data.length);
    } catch (err) {
      console.error(err);
    }
  };

  const loadKelasData = async () => {
    try {
      const stats = await api.get('/api/presensi/siswa/stats');
      setTotalSiswa(stats.totalSiswa || 0);
      setKelasList(stats.kelasSummary || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!nis.trim()) {
      toast.error('Masukkan NIS terlebih dahulu');
      return;
    }

    setLoading(true);
    setSiswa(null);

    try {
      const data = await api.get(`/api/presensi/siswa/cari?nis=${nis.trim()}`);
      setSiswa(data);
    } catch (err: any) {
      toast.error(err?.message || 'Siswa tidak ditemukan');
      setSiswa(null);
      setNis('');
      inputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!siswa) return;

    setSubmitting(true);
    try {
      await api.post('/api/presensi/siswa', {
        siswaId: siswa.id,
      });

      const now = new Date();
      setSuccessData({
        nama: siswa.nama,
        kelas: siswa.kelas,
        time: now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      });
      setShowSuccess(true);
      setAttendedCount(prev => prev + 1);

      // Auto-reset after 3 seconds
      setTimeout(() => {
        setShowSuccess(false);
        setNis('');
        setSiswa(null);
        inputRef.current?.focus();
        loadRecentActivity();
      }, 3000);
    } catch (err: any) {
      toast.error(err?.message || 'Gagal mencatat presensi');
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !siswa) {
      handleSearch();
    }
  };

  // Filter activity by selected kelas
  const filteredActivity = selectedKelasFilter === 'ALL'
    ? recentActivity
    : recentActivity.filter(a => a.kelasId === selectedKelasFilter);

  return (
    <div className="bg-surface text-on-surface font-sans min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-surface-container-lowest h-16 md:h-24 px-4 md:px-20 flex items-center justify-between shadow-sm z-50">
        <div className="flex items-center gap-2 md:gap-4">
          {cfg.logoUrl ? (
            <img
              src={cfg.logoUrl}
              alt={schoolName}
              className="h-10 w-10 md:h-14 md:w-14 object-contain rounded-lg"
            />
          ) : (
            <div className="w-10 h-10 md:w-14 md:h-14 bg-primary-container rounded-lg flex items-center justify-center text-on-primary">
              <GraduationCap className="w-6 h-6 md:w-8 md:h-8" />
            </div>
          )}
          <div className="hidden sm:block">
            <h1 className="text-base md:text-2xl font-bold text-primary">{schoolName}</h1>
            <p className="text-[10px] md:text-xs text-secondary uppercase tracking-widest">Sistem Presensi Digital</p>
          </div>
        </div>
        <div className="text-center flex-1">
          <div className="text-2xl md:text-3xl font-bold text-primary tabular-nums">
            {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
          <div className="text-xs md:text-lg font-semibold text-secondary-fixed-variant hidden sm:block">
            {currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
          <div className="text-[10px] text-secondary-fixed-variant sm:hidden">
            {currentTime.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
          </div>
        </div>
        <div className="flex items-center">
          <Link
            to="/"
            className="h-8 w-8 md:h-12 md:w-12 rounded-full flex items-center justify-center bg-surface-container-high text-on-surface hover:bg-primary-container hover:text-on-primary transition-all"
            title="Kembali ke Beranda"
          >
            <Home className="w-4 h-4 md:w-5 md:h-5" />
          </Link>
        </div>
      </header>

      <main className="flex-1 flex">
        {/* Center: Input Area */}
        <section className="flex-1 flex flex-col items-center justify-center bg-background px-4 md:px-8 py-8 lg:mr-[380px]">
          <div className="w-full max-w-2xl bg-surface-container-lowest rounded-2xl md:rounded-[2rem] p-6 md:p-12 shadow-xl border border-outline-variant/20 text-center relative overflow-hidden">
            {/* Success Overlay */}
            {showSuccess && (
              <div className="absolute inset-0 bg-green-50/95 backdrop-blur-sm flex flex-col items-center justify-center z-20 animate-in fade-in zoom-in duration-300 p-4">
                <div className="w-12 h-12 md:w-16 md:h-16 bg-green-500 rounded-full flex items-center justify-center text-white mb-3 md:mb-4">
                  <CheckCircle className="w-8 h-8 md:w-10 md:h-10" />
                </div>
                <h2 className="text-xl md:text-2xl font-bold text-green-800 mb-2">Absensi Berhasil!</h2>
                <div className="text-center">
                  <p className="text-lg md:text-xl font-bold text-green-900">{successData.nama}</p>
                  <p className="text-green-700 text-sm md:text-base">{successData.kelas}</p>
                  <p className="mt-2 md:mt-3 text-xs md:text-sm text-green-800 bg-white/50 px-3 md:px-4 py-1.5 md:py-2 rounded-full inline-block">
                    Hadir pukul {successData.time}
                  </p>
                </div>
              </div>
            )}

            {/* Main Content */}
            <div className="relative z-10">
              {!siswa ? (
                <>
                  {/* Scanner Animation */}
                  <div className="mb-8 flex justify-center">
                    <div className="relative w-48 h-32 bg-secondary-fixed rounded-xl border-4 border-dashed border-outline-variant flex items-center justify-center overflow-hidden animate-pulse">
                      <User className="w-16 h-16 text-outline" />
                      <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent animate-scan"></div>
                    </div>
                  </div>

                  <h2 className="text-2xl md:text-3xl font-bold mb-2 text-on-surface">Scan atau Masukkan NIS</h2>
                  <p className="text-sm md:text-base text-on-surface-variant mb-6 md:mb-10 px-2">Silakan gunakan kartu pelajar Anda atau masukkan nomor induk siswa.</p>

                  <div className="space-y-4 md:space-y-6">
                    <div className="relative group">
                      <input
                        ref={inputRef}
                        type="text"
                        value={nis}
                        onChange={(e) => setNis(e.target.value)}
                        onKeyPress={handleKeyPress}
                        disabled={loading}
                        className="w-full h-20 md:h-24 px-4 md:px-8 text-center text-2xl md:text-[32px] font-bold border-2 border-outline-variant rounded-xl md:rounded-2xl focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all placeholder:text-outline/40 placeholder:font-normal outline-none disabled:opacity-50"
                        placeholder="Scan kartu atau ketik NIS..."
                        autoFocus
                      />
                      <div className="absolute right-4 md:right-6 top-1/2 -translate-y-1/2 text-primary opacity-0 group-focus-within:opacity-100 transition-opacity">
                        <ArrowRight className="w-6 h-6 md:w-8 md:h-8" />
                      </div>
                    </div>

                    <button
                      onClick={() => handleSearch()}
                      disabled={loading || !nis.trim()}
                      className="w-full h-16 md:h-20 bg-primary-container text-white font-semibold text-xl md:text-2xl rounded-xl md:rounded-2xl hover:scale-[1.01] active:scale-[0.98] transition-all shadow-lg flex items-center justify-center gap-3 md:gap-4 disabled:opacity-50"
                    >
                      {loading ? (
                        <>
                          <div className="w-5 h-5 md:w-6 md:h-6 border-4 border-white/40 border-t-white rounded-full animate-spin" />
                          <span className="text-lg md:text-2xl">Mencari...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-5 h-5 md:w-6 md:h-6" />
                          Absen Sekarang
                        </>
                      )}
                    </button>

                    <p className="text-xs md:text-sm text-on-surface-variant flex items-center justify-center gap-2 px-4">
                      <span className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                        <span className="text-xs">ℹ</span>
                      </span>
                      <span className="leading-snug">Dekatkan kartu ke scanner, atau ketik NIS lalu tekan Enter</span>
                    </p>
                  </div>
                </>
              ) : (
                // Confirmation View
                <div className="space-y-4 md:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <div className="bg-primary/5 border-2 border-primary/20 rounded-xl md:rounded-2xl p-6 md:p-8 space-y-4">
                    <div className="text-center">
                      <div className="w-16 h-16 md:w-20 md:h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3 md:mb-4">
                        <User className="w-8 h-8 md:w-10 md:h-10 text-primary" />
                      </div>
                      <h3 className="text-2xl md:text-3xl font-bold text-on-surface">{siswa.nama}</h3>
                      <p className="text-on-surface-variant mt-1 text-base md:text-lg">NIS: {siswa.nis}</p>
                      <p className="text-lg md:text-xl font-semibold text-primary mt-2 md:mt-3">{siswa.kelas}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => {
                        setNis('');
                        setSiswa(null);
                        inputRef.current?.focus();
                      }}
                      disabled={submitting}
                      className="py-3 md:py-4 px-3 md:px-4 border-2 border-outline-variant rounded-xl text-sm md:text-base font-semibold text-on-surface-variant hover:border-primary hover:text-primary active:bg-surface-container transition-all disabled:opacity-50"
                    >
                      Batal
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={submitting}
                      className="py-3 md:py-4 text-base md:text-lg font-bold bg-secondary-container text-white rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {submitting ? (
                        <>
                          <div className="w-4 h-4 md:w-5 md:h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                          <span className="text-sm md:text-lg">Menyimpan...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4 md:w-5 md:h-5" />
                          Konfirmasi
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Right: Activity Panel */}
        <aside className="hidden lg:flex fixed right-0 top-24 h-[calc(100vh-96px)] w-[400px] bg-surface-container-low flex-col border-l border-outline-variant/30">
          <div className="p-6 border-b border-outline-variant/30 space-y-3">
            <h3 className="text-xl font-bold">Rekap Hari Ini</h3>

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-surface p-3 rounded-xl border border-outline-variant">
                <div className="text-xs text-on-surface-variant mb-1">Total</div>
                <div className="text-2xl font-bold text-on-surface">{totalSiswa}</div>
              </div>
              <div className="bg-green-50 p-3 rounded-xl border border-green-200">
                <div className="text-xs text-green-700 mb-1">Hadir</div>
                <div className="text-2xl font-bold text-green-600">{attendedCount}</div>
              </div>
              <div className="bg-error-container p-3 rounded-xl border border-error/20">
                <div className="text-xs text-error mb-1">Belum</div>
                <div className="text-2xl font-bold text-error">{totalSiswa - attendedCount}</div>
              </div>
            </div>

            {/* Filter Kelas */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">Filter Kelas</label>
              <select
                value={selectedKelasFilter}
                onChange={(e) => setSelectedKelasFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none"
              >
                <option value="ALL">Semua Kelas ({attendedCount}/{totalSiswa})</option>
                {kelasList.map(k => (
                  <option key={k.id} value={k.id}>
                    {k.nama} ({k.hadirCount}/{k.totalSiswa})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {filteredActivity.length === 0 ? (
              <div className="text-center py-12 text-on-surface-variant">
                <User className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">
                  {selectedKelasFilter === 'ALL'
                    ? 'Belum ada siswa yang hadir hari ini'
                    : 'Belum ada siswa dari kelas ini yang hadir'}
                </p>
              </div>
            ) : (
              filteredActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="p-3 bg-surface-container-lowest rounded-lg border border-outline-variant/20 hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-secondary-fixed flex items-center justify-center text-on-secondary-fixed">
                        <User className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-sm text-on-surface truncate">{activity.nama}</div>
                        <div className="text-xs text-on-surface-variant">{activity.kelas}</div>
                      </div>
                    </div>
                    <div className={`text-xs px-2 py-0.5 rounded-full font-bold ${activity.tepatWaktu ? 'bg-green-100 text-green-700' : 'bg-error-container text-error'}`}>
                      {activity.tepatWaktu ? 'TEPAT' : `TELAT ${activity.keterlambatan}m`}
                    </div>
                  </div>
                  <div className="text-xs text-primary font-medium">
                    Hadir: {activity.waktu}
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>
      </main>

      {/* Footer */}
      <footer className="h-12 bg-surface-container-lowest px-4 md:px-20 flex items-center justify-center border-t border-outline-variant/30 text-secondary z-50">
        <span className="text-xs uppercase tracking-tighter">© 2026 {schoolName}</span>
      </footer>

      <style>{`
        @keyframes scan {
          0% { top: 0%; opacity: 0; }
          50% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        .animate-scan {
          animation: scan 2.5s infinite linear;
        }
      `}</style>
    </div>
  );
}
