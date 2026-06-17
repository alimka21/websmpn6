import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { CheckCircle, Home, User, Clock, GraduationCap, IdCard, ArrowRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
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

interface SiswaBelumHadir {
  id: string;
  nama: string;
  nis: string;
  kelas: string;
  kelasId: string;
}

export default function PresensiSiswaKiosk() {
  const cfg = useSiteConfig();
  const schoolName = cfg.namaSekolah || 'Portal Sekolah';
  const navigate = useNavigate();

  useEffect(() => {
    if (!sessionStorage.getItem('presensi_siswa_ok')) {
      navigate('/', { replace: true });
    }
  }, [navigate]);

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
  const [activeTab, setActiveTab] = useState<'hadir' | 'belum'>('hadir');
  const [siswaBelumHadir, setSiswaBelumHadir] = useState<SiswaBelumHadir[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    loadRecentActivity();
    loadKelasData();
    loadSiswaBelumHadir();
    inputRef.current?.focus();
  }, []);

  // Reload data saat filter atau tab berubah
  useEffect(() => {
    if (activeTab === 'belum') {
      loadSiswaBelumHadir();
    }
  }, [selectedKelasFilter, activeTab]);

  const loadRecentActivity = async () => {
    try {
      const data = await api.get('/api/presensi/siswa/recent?limit=100');
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

  const loadSiswaBelumHadir = async () => {
    try {
      const kelasParam = selectedKelasFilter !== 'ALL' ? `?kelasId=${selectedKelasFilter}` : '';
      const data = await api.get(`/api/presensi/siswa/belum-hadir${kelasParam}`);
      setSiswaBelumHadir(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!nis.trim()) {
      toast.error('Masukkan NIS atau kode RFID terlebih dahulu');
      return;
    }

    setLoading(true);
    setSiswa(null);

    try {
      const data = await api.get(`/api/presensi/siswa/cari?q=${encodeURIComponent(nis.trim())}`);
      setSiswa(data);
    } catch (err: any) {
      toast.error(err?.message || 'Siswa tidak ditemukan');
      setSiswa(null);
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

      setTimeout(() => {
        setShowSuccess(false);
        setSiswa(null);
        setNis('');
        loadRecentActivity();
        loadKelasData();
        loadSiswaBelumHadir();
        inputRef.current?.focus();
      }, 3000);

      toast.success('Presensi berhasil dicatat!');
    } catch (err: any) {
      toast.error(err?.message || 'Gagal mencatat presensi');
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (!siswa) {
        handleSearch();
      } else {
        handleSubmit();
      }
    }
  };

  const filteredActivity = selectedKelasFilter === 'ALL'
    ? recentActivity
    : recentActivity.filter(a => a.kelasId === selectedKelasFilter);

  // Hitung belum hadir berdasarkan filter kelas
  const belumHadir = selectedKelasFilter === 'ALL'
    ? totalSiswa - attendedCount
    : (() => {
        const selectedKelas = kelasList.find(k => k.id === selectedKelasFilter);
        if (!selectedKelas) return 0;
        return selectedKelas.totalSiswa - selectedKelas.hadirCount;
      })();

  // Count untuk tab display (sesuai filter)
  const filteredHadirCount = selectedKelasFilter === 'ALL'
    ? attendedCount
    : filteredActivity.length;

  const filteredBelumCount = selectedKelasFilter === 'ALL'
    ? belumHadir
    : siswaBelumHadir.length;

  return (
    <div className="min-h-screen bg-[#f8fafc] font-[Inter]">
      {/* Header */}
      <header className="bg-white border-b border-[#e2e8f0] px-6 py-4 shadow-sm">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between">
          {/* Left: Logo + School */}
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
              <p className="text-xs text-[#64748b] uppercase tracking-wider font-medium">Sistem Presensi Digital</p>
            </div>
          </div>

          {/* Right: Clock + Home */}
          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="text-2xl font-bold text-[#1e40af] tabular-nums leading-tight">
                {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
              <div className="text-xs text-[#64748b]">
                {currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
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

      {/* Success Modal */}
      {showSuccess && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-8">
          <div className="bg-white rounded-2xl p-10 max-w-md w-full text-center shadow-2xl animate-in fade-in zoom-in duration-300">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-6 mx-auto">
              <CheckCircle className="w-12 h-12" />
            </div>
            <h2 className="text-3xl font-bold text-[#0f172a] mb-3">Presensi Berhasil!</h2>
            <p className="text-[#64748b] mb-2">
              <span className="font-semibold text-xl text-[#1e40af]">{successData.nama}</span>
            </p>
            <p className="text-sm text-[#64748b] mb-6">{successData.kelas}</p>
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
            {/* Icon Scanner */}
            <div className="mb-8 flex justify-center">
              <div className="w-36 h-36 border-2 border-dashed border-[#c4c5d5] rounded-2xl flex items-center justify-center bg-[#f8fafc]">
                <IdCard className="w-16 h-16 text-[#64748b]" />
              </div>
            </div>

            {/* Title */}
            <h2 className="text-3xl font-bold text-[#0f172a] text-center mb-2">Scan atau Masukkan NIS / RFID</h2>
            <p className="text-sm text-[#64748b] text-center mb-8">
              Tempelkan kartu RFID ke scanner, atau ketik NIS Anda secara manual.
            </p>

            {/* Input */}
            <form onSubmit={handleSearch} className="mb-6">
              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={nis}
                  onChange={(e) => setNis(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="NIS atau Kode RFID..."
                  className="w-full px-6 py-4 text-xl text-center border-2 border-[#e2e8f0] bg-white rounded-xl focus:border-[#1e40af] focus:ring-4 focus:ring-[#1e40af]/10 outline-none transition-all placeholder:text-[#c4c5d5]"
                  disabled={loading || submitting}
                />
                {nis && (
                  <button
                    type="button"
                    onClick={handleSearch}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#1e40af] hover:text-[#1e3a8a]"
                  >
                    <ArrowRight className="w-6 h-6" />
                  </button>
                )}
              </div>
            </form>

            {/* Absen Button */}
            {siswa ? (
              <div className="space-y-4">
                <div className="bg-[#dde1ff] border border-[#1e40af]/20 rounded-xl p-5">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-14 h-14 bg-[#1e40af] rounded-full flex items-center justify-center text-white flex-shrink-0">
                      <User className="w-7 h-7" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-[#0f172a] truncate">{siswa.nama}</h3>
                      <p className="text-sm text-[#64748b]">{siswa.kelas} • NIS: {siswa.nis}</p>
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="w-full py-4 bg-[#1e40af] text-white rounded-xl hover:bg-[#1e3a8a] disabled:opacity-50 font-semibold text-lg transition-all shadow-md hover:shadow-lg"
                >
                  {submitting ? 'Menyimpan...' : 'Absen Sekarang'}
                </button>
              </div>
            ) : (
              <button
                onClick={handleSearch}
                disabled={loading || !nis.trim()}
                className="w-full py-4 bg-[#1e40af] text-white rounded-xl hover:bg-[#1e3a8a] disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-lg transition-all shadow-md"
              >
                {loading ? 'Mencari...' : 'Absen Sekarang'}
              </button>
            )}

            {/* Footer Note */}
            <p className="text-xs text-center text-[#64748b] mt-6 flex items-center justify-center gap-2">
              <Clock className="w-4 h-4" />
              Tempelkan kartu RFID ke scanner, atau ketik NIS lalu tekan Enter
            </p>
          </div>
        </section>

        {/* Right Sidebar: Activity */}
        <aside className="w-[360px] bg-white rounded-2xl shadow-[0px_4px_20px_rgba(0,0,0,0.04)] border border-[#e2e8f0] overflow-hidden flex flex-col max-h-[calc(100vh-120px)]">
          {/* Header */}
          <div className="px-6 py-5 border-b border-[#f1f5f9]">
            <h3 className="text-lg font-bold text-[#0f172a] mb-4">Aktivitas Hari Ini</h3>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="bg-green-50 rounded-lg p-3 text-center border border-green-200">
                <div className="text-2xl font-bold text-green-700">{attendedCount}</div>
                <div className="text-[10px] text-green-600 font-medium uppercase">Hadir</div>
              </div>
              <div className="bg-red-50 rounded-lg p-3 text-center border border-red-200">
                <div className="text-2xl font-bold text-red-700">{belumHadir}</div>
                <div className="text-[10px] text-red-600 font-medium uppercase">Tidak Hadir</div>
              </div>
              <div className="bg-[#f8fafc] rounded-lg p-3 text-center border border-[#e2e8f0]">
                <div className="text-2xl font-bold text-[#0f172a]">{totalSiswa}</div>
                <div className="text-[10px] text-[#64748b] font-medium uppercase">Total</div>
              </div>
            </div>

            {/* Filter */}
            <select
              value={selectedKelasFilter}
              onChange={(e) => setSelectedKelasFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-[#e2e8f0] bg-white rounded-lg focus:border-[#1e40af] focus:ring-2 focus:ring-[#1e40af]/10 outline-none font-medium transition-all mb-4"
            >
              <option value="ALL">Filter Kelas (Semua)</option>
              {kelasList.map(k => (
                <option key={k.id} value={k.id}>
                  {k.nama} ({k.hadirCount}/{k.totalSiswa})
                </option>
              ))}
            </select>

            {/* Toggle Tabs */}
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('hadir')}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all ${
                  activeTab === 'hadir'
                    ? 'bg-[#1e40af] text-white shadow-sm'
                    : 'bg-[#f8fafc] text-[#64748b] hover:bg-[#e2e7ff]'
                }`}
              >
                Hadir ({filteredHadirCount})
              </button>
              <button
                onClick={() => setActiveTab('belum')}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all ${
                  activeTab === 'belum'
                    ? 'bg-[#1e40af] text-white shadow-sm'
                    : 'bg-[#f8fafc] text-[#64748b] hover:bg-[#e2e7ff]'
                }`}
              >
                Belum Hadir ({filteredBelumCount})
              </button>
            </div>
          </div>

          {/* Activity List */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'hadir' ? (
              // Tab Hadir
              filteredActivity.length === 0 ? (
                <div className="text-center py-16 text-[#64748b]">
                  <User className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p className="text-sm font-medium">
                    {selectedKelasFilter === 'ALL'
                      ? 'Belum ada siswa yang hadir'
                      : 'Belum ada dari kelas ini yang hadir'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[#f1f5f9]">
                  {filteredActivity.map((activity) => (
                    <div key={activity.id} className="px-6 py-4 hover:bg-[#f8fafc] transition-colors">
                      <div className="flex items-start gap-3">
                        {/* Icon */}
                        <div className="w-10 h-10 bg-[#dde1ff] rounded-full flex items-center justify-center flex-shrink-0">
                          <User className="w-5 h-5 text-[#1e40af]" />
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-[#0f172a] truncate">{activity.nama}</div>
                          <div className="text-xs text-[#64748b]">{activity.kelas}</div>
                        </div>

                        {/* Time & Status */}
                        <div className="text-right flex-shrink-0 min-w-[80px]">
                          <div className="text-sm font-bold text-[#1e40af] mb-0.5">{activity.waktu}</div>
                          {activity.tepatWaktu ? (
                            <div className="text-xs font-semibold text-green-600">Tepat Waktu</div>
                          ) : (
                            <div className="text-xs font-semibold text-red-600">Telat {activity.keterlambatan} Menit</div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              // Tab Belum Hadir
              siswaBelumHadir.length === 0 ? (
                <div className="text-center py-16 text-[#64748b]">
                  <User className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p className="text-sm font-medium">
                    {selectedKelasFilter === 'ALL'
                      ? 'Semua siswa sudah hadir!'
                      : 'Semua siswa dari kelas ini sudah hadir!'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[#f1f5f9]">
                  {siswaBelumHadir.map((siswa) => (
                    <div key={siswa.id} className="px-6 py-4 hover:bg-[#f8fafc] transition-colors">
                      <div className="flex items-start gap-3">
                        {/* Icon */}
                        <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center flex-shrink-0">
                          <User className="w-5 h-5 text-red-600" />
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-[#0f172a] truncate">{siswa.nama}</div>
                          <div className="text-xs text-[#64748b]">{siswa.kelas} • NIS: {siswa.nis}</div>
                        </div>

                        {/* Status Badge */}
                        <div className="flex-shrink-0">
                          <div className="px-3 py-1 bg-red-100 rounded-full">
                            <span className="text-xs font-semibold text-red-700">Belum Hadir</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </aside>
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#e2e8f0] px-6 py-3">
        <p className="text-center text-[#64748b] text-[11px]">
          © 2026 Sistem Presensi Digital
        </p>
      </footer>
    </div>
  );
}
