import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Users, CheckCircle, Settings, User, ArrowRight } from 'lucide-react';
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
  kelas: string;
  waktu: string;
  tepat: boolean;
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
  const [attendedCount, setAttendedCount] = useState(47);

  const inputRef = useRef<HTMLInputElement>(null);

  // Update clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    loadRecentActivity();
    // Auto-focus input
    inputRef.current?.focus();
  }, []);

  const loadRecentActivity = () => {
    // Mock data - replace with real API
    setRecentActivity([
      { id: '1', nama: 'Ahmad Fauzi', kelas: 'X TKJ', waktu: '06:58', tepat: true },
      { id: '2', nama: 'Siti Aminah', kelas: 'XI AKL', waktu: '06:55', tepat: true },
      { id: '3', nama: 'Budi Hartono', kelas: 'XII TBSM', waktu: '06:52', tepat: true },
      { id: '4', nama: 'Eka Saputra', kelas: 'X TKJ', waktu: '06:48', tepat: true },
      { id: '5', nama: 'Laila Sari', kelas: 'XI RPL', waktu: '06:45', tepat: true },
      { id: '6', nama: 'Hendra Wijaya', kelas: 'X MM', waktu: '06:40', tepat: true },
    ]);
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

  return (
    <div className="bg-surface text-on-surface font-sans h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-surface-container-lowest h-24 px-20 flex items-center justify-between shadow-sm z-50">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-primary-container rounded-lg flex items-center justify-center text-on-primary">
            <Users className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-primary">{schoolName}</h1>
            <p className="text-xs text-secondary uppercase tracking-widest">Sistem Presensi Digital</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-primary tabular-nums">
            {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
          <div className="text-lg font-semibold text-secondary-fixed-variant">
            {currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* Left Sidebar (Hidden on mobile, shown on large screens) */}
        <aside className="hidden lg:flex fixed left-0 top-24 h-[calc(100vh-96px)] w-64 bg-surface-container-low flex-col py-8 border-r border-outline-variant/30">
          <div className="px-6 mb-8">
            <h3 className="text-xs text-secondary uppercase font-bold mb-4 tracking-wider">Navigasi Kiosk</h3>
            <nav className="space-y-2">
              <button className="w-full flex items-center gap-4 px-4 py-3 rounded-lg text-primary font-bold bg-primary-container/10 border-r-4 border-primary">
                <CheckCircle className="w-5 h-5" />
                <span className="text-sm">Check-in</span>
              </button>
            </nav>
          </div>
          <div className="mt-auto px-6 pb-8">
            <div className="p-4 bg-primary-container rounded-xl text-on-primary shadow-lg">
              <Settings className="w-5 h-5 mb-2" />
              <h4 className="text-sm font-bold">Kiosk Mode Active</h4>
              <p className="text-[10px] opacity-80 mt-1">Terminal ID: AMU-001</p>
            </div>
          </div>
        </aside>

        {/* Center: Input Area */}
        <section className="flex-1 flex flex-col items-center justify-center bg-background px-8 lg:ml-64 lg:mr-[380px]">
          <div className="w-full max-w-2xl bg-surface-container-lowest rounded-[2rem] p-12 shadow-xl border border-outline-variant/20 text-center relative overflow-hidden">
            {/* Success Overlay */}
            {showSuccess && (
              <div className="absolute inset-0 bg-green-50/95 backdrop-blur-sm flex flex-col items-center justify-center z-20 animate-in fade-in zoom-in duration-300">
                <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center text-white mb-6">
                  <CheckCircle className="w-16 h-16" />
                </div>
                <h2 className="text-3xl font-bold text-green-800 mb-2">Absensi Berhasil!</h2>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-900">{successData.nama}</p>
                  <p className="text-green-700 text-lg">{successData.kelas}</p>
                  <p className="mt-4 text-sm text-green-800 bg-white/50 px-4 py-2 rounded-full inline-block">
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

                  <h2 className="text-3xl font-bold mb-2 text-on-surface">Scan atau Masukkan NIS</h2>
                  <p className="text-on-surface-variant mb-10">Silakan gunakan kartu pelajar Anda atau masukkan nomor induk siswa.</p>

                  <div className="space-y-6">
                    <div className="relative group">
                      <input
                        ref={inputRef}
                        type="text"
                        value={nis}
                        onChange={(e) => setNis(e.target.value)}
                        onKeyPress={handleKeyPress}
                        disabled={loading}
                        className="w-full h-24 px-8 text-center text-[32px] font-bold border-2 border-outline-variant rounded-2xl focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all placeholder:text-outline/40 placeholder:font-normal outline-none disabled:opacity-50"
                        placeholder="Scan kartu atau ketik NIS..."
                        autoFocus
                      />
                      <div className="absolute right-6 top-1/2 -translate-y-1/2 text-primary opacity-0 group-focus-within:opacity-100 transition-opacity">
                        <ArrowRight className="w-8 h-8" />
                      </div>
                    </div>

                    <button
                      onClick={() => handleSearch()}
                      disabled={loading || !nis.trim()}
                      className="w-full h-20 bg-primary-container text-white font-semibold text-2xl rounded-2xl hover:scale-[1.01] active:scale-[0.98] transition-all shadow-lg flex items-center justify-center gap-4 disabled:opacity-50"
                    >
                      {loading ? (
                        <>
                          <div className="w-6 h-6 border-4 border-white/40 border-t-white rounded-full animate-spin" />
                          Mencari...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-6 h-6" />
                          Absen Sekarang
                        </>
                      )}
                    </button>

                    <p className="text-on-surface-variant text-sm flex items-center justify-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center">
                        <span className="text-xs">ℹ</span>
                      </span>
                      Dekatkan kartu ke scanner, atau ketik NIS lalu tekan Enter
                    </p>
                  </div>
                </>
              ) : (
                // Confirmation View
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <div className="bg-primary/5 border-2 border-primary/20 rounded-2xl p-8 space-y-4">
                    <div className="text-center">
                      <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <User className="w-10 h-10 text-primary" />
                      </div>
                      <h3 className="text-3xl font-bold text-on-surface">{siswa.nama}</h3>
                      <p className="text-on-surface-variant mt-1 text-lg">NIS: {siswa.nis}</p>
                      <p className="text-xl font-semibold text-primary mt-3">{siswa.kelas}</p>
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
                      className="py-4 px-4 border-2 border-outline-variant rounded-xl text-base font-semibold text-on-surface-variant hover:border-primary hover:text-primary transition-all disabled:opacity-50"
                    >
                      Batal
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={submitting}
                      className="py-4 text-lg font-bold bg-secondary-container text-white rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {submitting ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                          Menyimpan...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-5 h-5" />
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
        <aside className="hidden lg:flex fixed right-0 top-24 h-[calc(100vh-96px)] w-[380px] bg-surface-container-low flex-col border-l border-outline-variant/30">
          <div className="p-8 border-b border-outline-variant/30">
            <h3 className="text-2xl font-bold mb-4">Aktivitas Hari Ini</h3>
            <div className="bg-primary text-on-primary p-4 rounded-2xl flex items-center gap-4 shadow-md">
              <div className="p-3 bg-white/20 rounded-xl">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <div className="text-[28px] font-bold leading-none">{attendedCount}</div>
                <div className="text-xs opacity-90">siswa sudah hadir hari ini</div>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-3">
            {recentActivity.map((activity, idx) => (
              <div
                key={activity.id}
                className="flex items-center justify-between p-4 bg-surface-container-lowest rounded-xl border border-outline-variant/20 hover:border-primary/30 transition-colors shadow-sm"
                style={{ opacity: 1 - idx * 0.1 }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-secondary-fixed flex items-center justify-center text-on-secondary-fixed">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-sm">{activity.nama}</div>
                    <div className="text-xs text-secondary">{activity.kelas}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-primary">{activity.waktu}</div>
                  <div className="text-[10px] text-green-600 font-bold">TEPAT WAKTU</div>
                </div>
              </div>
            ))}
          </div>

          <div className="p-6 bg-surface-container-high/50 text-center">
            <button className="text-primary font-bold text-sm flex items-center justify-center gap-2 mx-auto hover:underline">
              Lihat Laporan Lengkap
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </aside>
      </main>

      {/* Footer */}
      <footer className="h-12 bg-surface-container-lowest px-20 flex items-center justify-between border-t border-outline-variant/30 text-secondary z-50">
        <span className="text-xs uppercase tracking-tighter">© 2026 {schoolName}</span>
        <div className="flex gap-6 text-xs">
          <a className="hover:text-primary transition-colors" href="#">Bantuan</a>
          <span className="text-outline-variant">|</span>
          <span className="text-primary font-bold">Versi 1.0.0</span>
        </div>
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
