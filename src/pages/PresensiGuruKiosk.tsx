import React, { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { CheckCircle, Home, GraduationCap, Clock, Users, IdCard, LogIn, LogOut, ArrowRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useSiteConfig } from '../hooks/useSiteConfig';

interface GuruInfo {
  id: string;
  nama: string;
  nip: string;
  rfidKode?: string | null;
  statusHariIni: {
    sudahDatang: boolean;
    sudahPulang: boolean;
    waktuDatang?: string;
    waktuPulang?: string;
  };
}

interface RecentActivity {
  id: string;
  nama: string;
  nip: string;
  waktuDatang: string | null;
  waktuPulang: string | null;
  keterlambatan: number;
  totalJam: number;
  autoCheckout: boolean;
}

// USB HID RFID reader mengetik sangat cepat; threshold antar karakter < 50ms
const RFID_SPEED_MS = 50;
const RFID_MIN_LEN  = 4;

export default function PresensiGuruKiosk() {
  const cfg        = useSiteConfig();
  const schoolName = cfg.namaSekolah || 'Portal Sekolah';
  const navigate   = useNavigate();

  useEffect(() => {
    if (!sessionStorage.getItem('presensi_guru_ok')) navigate('/', { replace: true });
  }, [navigate]);

  const [currentTime, setCurrentTime]     = useState(new Date());
  const [presensiTZ, setPresensiTZ]       = useState('Asia/Jakarta');
  const [nip, setNip]                     = useState('');
  const [guru, setGuru]                   = useState<GuruInfo | null>(null);
  const [loading, setLoading]             = useState(false);
  const [submitting, setSubmitting]       = useState(false);
  const [showSuccess, setShowSuccess]     = useState(false);
  const [successData, setSuccessData]     = useState<{ nama: string; type: 'datang' | 'pulang'; time: string }>({
    nama: '', type: 'datang', time: '',
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [attendedCount, setAttendedCount]   = useState(0);
  const [totalGuru, setTotalGuru]           = useState(0);

  const inputRef        = useRef<HTMLInputElement>(null);
  const lastKeyTimeRef  = useRef<number>(0);
  const rfidSpeedRef    = useRef<number>(0);  // jumlah karakter yg terdeteksi kecepatan RFID
  const isRfidModeRef   = useRef<boolean>(false);

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    api.get('/api/presensi/pengaturan').then((d: any) => {
      if (d?.timezone) setPresensiTZ(d.timezone);
    }).catch(() => {});
    loadRecentActivity();
    loadGuruStats();
    inputRef.current?.focus();
  }, []);

  const loadRecentActivity = async () => {
    try {
      const data = await api.get('/api/presensi/guru/recent?limit=20');
      setRecentActivity(data);
    } catch { /* silent */ }
  };

  const loadGuruStats = async () => {
    try {
      const data = await api.get('/api/presensi/guru-list');
      setTotalGuru(data.length);
      setAttendedCount(data.filter((g: any) => g.statusHariIni?.sudahDatang).length);
    } catch { /* silent */ }
  };

  const doSubmit = useCallback(async (guruData: GuruInfo) => {
    const mode: 'datang' | 'pulang' = guruData.statusHariIni.sudahDatang ? 'pulang' : 'datang';
    setSubmitting(true);
    try {
      await api.post(`/api/presensi/guru/${mode}`, { guruId: guruData.id });
      const now = new Date();
      setSuccessData({
        nama: guruData.nama,
        type: mode,
        time: now.toLocaleTimeString('id-ID', { timeZone: presensiTZ, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      });
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setGuru(null);
        setNip('');
        rfidSpeedRef.current = 0;
        isRfidModeRef.current = false;
        loadRecentActivity();
        loadGuruStats();
        inputRef.current?.focus();
      }, 3000);
    } catch (err: any) {
      toast.error(err?.message || err?.error || 'Gagal mencatat presensi');
    } finally {
      setSubmitting(false);
    }
  }, [presensiTZ]);

  const doSearch = useCallback(async (query: string) => {
    const q = query.trim();
    if (!q) { toast.error('Masukkan NIP atau kode RFID'); return; }

    setLoading(true);
    setGuru(null);
    try {
      const data: GuruInfo = await api.get(`/api/presensi/guru/cari?q=${encodeURIComponent(q)}`);

      if (data.statusHariIni.sudahDatang && data.statusHariIni.sudahPulang) {
        toast.info(`${data.nama} sudah melakukan presensi datang dan pulang hari ini`);
        setNip('');
        isRfidModeRef.current = false;
        inputRef.current?.focus();
        return;
      }

      // Jika mode RFID → auto-submit langsung
      if (isRfidModeRef.current) {
        isRfidModeRef.current = false;
        await doSubmit(data);
      } else {
        setGuru(data);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Guru tidak ditemukan');
    } finally {
      setLoading(false);
    }
  }, [doSubmit]);

  // Deteksi kecepatan ketik untuk RFID
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setNip(val);
    setGuru(null);

    const now   = Date.now();
    const delta = now - lastKeyTimeRef.current;
    lastKeyTimeRef.current = now;

    if (delta < RFID_SPEED_MS) {
      rfidSpeedRef.current += 1;
    } else {
      rfidSpeedRef.current = 1;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    if (guru) {
      doSubmit(guru);
    } else {
      doSearch(nip);
    }
  };

  // Auto-submit setelah 150ms berhenti ketik — khusus RFID (kecepatan tinggi)
  useEffect(() => {
    if (!nip || guru || loading) return;

    const timer = setTimeout(() => {
      if (rfidSpeedRef.current >= RFID_MIN_LEN && nip.length >= RFID_MIN_LEN) {
        isRfidModeRef.current = true;
        doSearch(nip);
      }
      rfidSpeedRef.current = 0;
    }, 150);

    return () => clearTimeout(timer);
  }, [nip, guru, loading, doSearch]);

  const handleReset = () => {
    setGuru(null);
    setNip('');
    rfidSpeedRef.current  = 0;
    isRfidModeRef.current = false;
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const mode: 'datang' | 'pulang' = guru?.statusHariIni.sudahDatang ? 'pulang' : 'datang';

  return (
    <div className="min-h-screen bg-[#f8fafc] font-[Inter]">
      {/* Header */}
      <header className="bg-white border-b border-[#e2e8f0] px-6 py-4 shadow-sm">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {cfg.logoUrl ? (
              <img src={cfg.logoUrl} alt={schoolName} className="h-12 w-12 object-contain rounded-lg" />
            ) : (
              <div className="h-12 w-12 bg-[#1e40af] rounded-lg flex items-center justify-center text-white">
                <GraduationCap className="w-7 h-7" />
              </div>
            )}
            <div>
              <h1 className="text-lg font-semibold text-[#0f172a]">{schoolName}</h1>
              <p className="text-xs text-[#64748b] uppercase tracking-wider font-medium">Presensi Guru — Kiosk</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="text-2xl font-bold text-[#1e40af] tabular-nums leading-tight">
                {currentTime.toLocaleTimeString('id-ID', { timeZone: presensiTZ, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
              <div className="text-xs text-[#64748b]">
                {currentTime.toLocaleDateString('id-ID', { timeZone: presensiTZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            </div>
            <Link
              to="/"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-[#e2e8f0] text-[#1e40af] hover:bg-[#f8fafc] transition-all"
            >
              <Home className="w-5 h-5" />
              <span className="font-medium text-sm">Beranda</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Status Bar */}
      <div className="bg-white border-b border-[#e2e8f0] px-6 py-3">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-[#64748b]">
            <Users className="w-4 h-4 text-[#1e40af]" />
            <span>Kehadiran hari ini: <span className="font-semibold text-[#0f172a]">{attendedCount}/{totalGuru}</span> guru</span>
          </div>
          <div className="flex items-center gap-2 text-[#1e40af] font-semibold text-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#1e40af] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#1e40af]"></span>
            </span>
            <span>LIVE</span>
          </div>
        </div>
      </div>

      {/* Success Modal */}
      {showSuccess && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-8">
          <div className="bg-white rounded-2xl p-10 max-w-md w-full text-center shadow-2xl animate-in fade-in zoom-in duration-300">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 mx-auto ${
              successData.type === 'datang' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'
            }`}>
              <CheckCircle className="w-12 h-12" />
            </div>
            <h2 className="text-3xl font-bold text-[#0f172a] mb-3">
              {successData.type === 'datang' ? 'Selamat Datang!' : 'Sampai Jumpa!'}
            </h2>
            <p className="text-[#64748b] mb-2">
              <span className="font-semibold text-xl text-[#1e40af]">{successData.nama}</span>
            </p>
            <p className="text-sm text-[#64748b] mb-6">
              Presensi {successData.type === 'datang' ? 'masuk' : 'pulang'} berhasil dicatat
            </p>
            <div className="inline-flex items-center gap-3 px-6 py-3 bg-[#dde1ff] rounded-lg">
              <Clock className="w-5 h-5 text-[#1e40af]" />
              <span className="font-bold text-xl text-[#1e40af]">{successData.time}</span>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-[1400px] mx-auto p-6 flex gap-6">
        {/* Center: Scan Card */}
        <section className="flex-1 flex items-start justify-center pt-12">
          <div className="w-full max-w-[520px] bg-white rounded-3xl p-10 shadow-[0px_4px_20px_rgba(0,0,0,0.04)] border border-[#e2e8f0]">
            {/* Icon */}
            <div className="mb-8 flex justify-center">
              <div className="w-36 h-36 border-2 border-dashed border-[#c4c5d5] rounded-2xl flex items-center justify-center bg-[#f8fafc]">
                <IdCard className="w-16 h-16 text-[#64748b]" />
              </div>
            </div>

            <h2 className="text-3xl font-bold text-[#0f172a] text-center mb-2">
              Scan RFID atau Masukkan NIP
            </h2>
            <p className="text-sm text-[#64748b] text-center mb-8">
              Tempelkan kartu RFID ke scanner, atau ketik NIP secara manual.
            </p>

            {/* Input */}
            <form onSubmit={e => { e.preventDefault(); guru ? doSubmit(guru) : doSearch(nip); }} className="mb-6">
              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={nip}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder="NIP atau Kode RFID..."
                  className="w-full px-6 py-4 text-xl text-center border-2 border-[#e2e8f0] bg-white rounded-xl focus:border-[#1e40af] focus:ring-4 focus:ring-[#1e40af]/10 outline-none transition-all placeholder:text-[#c4c5d5]"
                  disabled={loading || submitting}
                  autoFocus
                />
                {nip && !guru && (
                  <button
                    type="button"
                    onClick={() => doSearch(nip)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#1e40af] hover:text-[#1e3a8a]"
                  >
                    <ArrowRight className="w-6 h-6" />
                  </button>
                )}
              </div>
            </form>

            {/* Guru Card + Absen Button */}
            {guru ? (
              <div className="space-y-4">
                <div className={`border rounded-xl p-5 ${
                  mode === 'datang' ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'
                }`}>
                  <div className="flex items-center gap-4 mb-3">
                    <div className="w-14 h-14 bg-[#1e40af] rounded-full flex items-center justify-center text-white flex-shrink-0">
                      <GraduationCap className="w-7 h-7" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-[#0f172a] truncate">{guru.nama}</h3>
                      <p className="text-sm text-[#64748b]">NIP: {guru.nip}</p>
                    </div>
                  </div>
                  {guru.statusHariIni.sudahDatang && guru.statusHariIni.waktuDatang && (
                    <p className="text-xs text-[#64748b]">
                      Masuk: <span className="font-semibold text-green-700">{guru.statusHariIni.waktuDatang}</span>
                    </p>
                  )}
                </div>
                <button
                  onClick={() => doSubmit(guru)}
                  disabled={submitting}
                  className={`w-full py-4 text-white rounded-xl disabled:opacity-50 font-semibold text-lg transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-3 ${
                    mode === 'datang' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {submitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    <>
                      {mode === 'datang' ? <LogIn className="w-5 h-5" /> : <LogOut className="w-5 h-5" />}
                      Presensi {mode === 'datang' ? 'Masuk' : 'Pulang'} Sekarang
                    </>
                  )}
                </button>
                <button
                  onClick={handleReset}
                  className="w-full py-2 text-sm text-[#64748b] hover:text-red-600 transition-colors"
                >
                  Batal
                </button>
              </div>
            ) : (
              <button
                onClick={() => doSearch(nip)}
                disabled={loading || !nip.trim()}
                className="w-full py-4 bg-[#1e40af] text-white rounded-xl hover:bg-[#1e3a8a] disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-lg transition-all shadow-md"
              >
                {loading ? 'Mencari...' : 'Cari & Absen'}
              </button>
            )}

            <p className="text-xs text-center text-[#64748b] mt-6 flex items-center justify-center gap-2">
              <Clock className="w-4 h-4" />
              Tempelkan kartu RFID ke scanner, atau ketik NIP lalu tekan Enter
            </p>
          </div>
        </section>

        {/* Right Sidebar: Activity */}
        <aside className="w-[400px] bg-white rounded-2xl shadow-[0px_4px_20px_rgba(0,0,0,0.04)] border border-[#e2e8f0] overflow-hidden flex flex-col max-h-[calc(100vh-120px)]">
          <div className="px-6 py-5 border-b border-[#f1f5f9]">
            <h3 className="text-lg font-bold text-[#0f172a] mb-4">Aktivitas Hari Ini</h3>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-green-50 rounded-lg p-3 text-center border border-green-200">
                <div className="text-2xl font-bold text-green-700">{attendedCount}</div>
                <div className="text-[10px] text-green-600 font-medium uppercase">Hadir</div>
              </div>
              <div className="bg-red-50 rounded-lg p-3 text-center border border-red-200">
                <div className="text-2xl font-bold text-red-700">{Math.max(0, totalGuru - attendedCount)}</div>
                <div className="text-[10px] text-red-600 font-medium uppercase">Belum</div>
              </div>
              <div className="bg-[#f8fafc] rounded-lg p-3 text-center border border-[#e2e8f0]">
                <div className="text-2xl font-bold text-[#0f172a]">{totalGuru}</div>
                <div className="text-[10px] text-[#64748b] font-medium uppercase">Total</div>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-[#f1f5f9]">
            {recentActivity.length === 0 ? (
              <div className="text-center py-16 text-[#64748b]">
                <GraduationCap className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm font-medium">Belum ada guru yang hadir</p>
              </div>
            ) : (
              recentActivity.map((activity) => (
                <div key={activity.id} className="px-6 py-4 hover:bg-[#f8fafc] transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-[#dde1ff] rounded-full flex items-center justify-center flex-shrink-0">
                      <GraduationCap className="w-5 h-5 text-[#1e40af]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-[#0f172a] truncate">{activity.nama}</div>
                      <div className="text-xs text-[#64748b]">NIP: {activity.nip}</div>
                    </div>
                    <div className="text-right flex-shrink-0 min-w-[90px]">
                      {activity.waktuDatang && (
                        <div className="text-xs font-semibold text-green-600">
                          Masuk {activity.waktuDatang}
                          {activity.keterlambatan > 0 && (
                            <span className="ml-1 text-red-600">(T+{activity.keterlambatan}m)</span>
                          )}
                        </div>
                      )}
                      {activity.waktuPulang && (
                        <div className="text-xs font-semibold text-blue-600">
                          Pulang {activity.waktuPulang}
                        </div>
                      )}
                      {!activity.waktuDatang && (
                        <div className="text-xs text-[#c4c5d5]">Belum hadir</div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#e2e8f0] px-6 py-3">
        <p className="text-center text-[#64748b] text-[11px]">
          © 2026 Sistem Presensi Digital
        </p>
      </footer>
    </div>
  );
}
