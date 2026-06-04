import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Users, CheckCircle, Home, User, Clock, GraduationCap } from 'lucide-react';
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
    inputRef.current?.focus();
  }, []);

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
    if (e.key === 'Enter' && !siswa) {
      handleSearch();
    }
  };

  // Filter activity by selected kelas
  const filteredActivity = selectedKelasFilter === 'ALL'
    ? recentActivity
    : recentActivity.filter(a => a.kelasId === selectedKelasFilter);

  return (
    <div className="min-h-screen bg-[#faf8ff] font-[Inter]">
      {/* Header */}
      <header className="bg-white border-b border-[#e2e8f0] px-8 py-4 shadow-sm">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between">
          {/* Left: Clock */}
          <div className="flex items-center gap-4">
            {cfg.logoUrl ? (
              <img src={cfg.logoUrl} alt={schoolName} className="h-14 w-14 object-contain rounded-lg" />
            ) : (
              <div className="h-14 w-14 bg-[#1e40af] rounded-lg flex items-center justify-center text-white">
                <GraduationCap className="w-8 h-8" />
              </div>
            )}
            <div>
              <div className="text-3xl font-bold text-[#1e40af] tabular-nums leading-tight">
                {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
              <div className="text-sm text-[#64748b] mt-1">
                {currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            </div>
          </div>

          {/* Center: Title */}
          <div className="text-center">
            <h1 className="text-2xl font-semibold text-[#0f172a]">{schoolName}</h1>
            <p className="text-sm text-[#64748b] uppercase tracking-wider font-medium">Kiosk Presensi Siswa</p>
          </div>

          {/* Right: Home Button */}
          <Link
            to="/"
            className="flex items-center gap-2 px-6 py-3 rounded-lg bg-white border border-[#e2e8f0] text-[#1e40af] hover:bg-[#f8fafc] transition-all shadow-sm"
          >
            <Home className="w-5 h-5" />
            <span className="font-medium">Beranda</span>
          </Link>
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

      <main className="max-w-[1400px] mx-auto p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Input Section - 2 columns */}
        <section className="lg:col-span-2 space-y-6">
          {/* Input Card */}
          <div className="bg-white rounded-2xl p-8 shadow-[0px_4px_20px_rgba(0,0,0,0.04)] border border-[#f1f5f9]">
            <label className="block text-sm font-medium text-[#64748b] uppercase tracking-wider mb-3">
              Masukkan NIS
            </label>
            <form onSubmit={handleSearch} className="flex gap-4 mb-6">
              <input
                ref={inputRef}
                type="text"
                value={nis}
                onChange={(e) => setNis(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ketik NIS..."
                className="flex-1 px-5 py-4 text-lg border border-[#e2e8f0] bg-white rounded-lg focus:border-[#1e40af] focus:ring-4 focus:ring-[#1e40af]/10 outline-none transition-all"
                disabled={loading || submitting}
              />
              <button
                type="submit"
                onClick={handleSearch}
                disabled={loading || submitting || !nis.trim()}
                className="px-8 py-4 bg-[#1e40af] text-white rounded-lg hover:bg-[#1e3a8a] disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-all shadow-sm"
              >
                {loading ? 'Mencari...' : 'Cari'}
              </button>
            </form>

            {/* Result Card */}
            {siswa && (
              <div className="bg-[#dde1ff] border border-[#1e40af]/20 rounded-xl p-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="flex items-start justify-between mb-5">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-[#1e40af] rounded-full flex items-center justify-center text-white">
                      <User className="w-8 h-8" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-[#0f172a]">{siswa.nama}</h3>
                      <p className="text-sm text-[#64748b]">NIS: {siswa.nis}</p>
                    </div>
                  </div>
                  <div className="px-4 py-2 bg-[#1e40af] rounded-full">
                    <span className="text-sm font-semibold text-white">{siswa.kelas}</span>
                  </div>
                </div>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="w-full py-4 bg-[#1e40af] text-white rounded-lg hover:bg-[#1e3a8a] disabled:opacity-50 font-semibold text-lg transition-all shadow-md hover:shadow-lg"
                >
                  {submitting ? 'Menyimpan...' : 'Konfirmasi Presensi'}
                </button>
              </div>
            )}

            {!siswa && !loading && nis && (
              <div className="text-center py-12 text-[#64748b]">
                <User className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <p className="text-lg">Siswa tidak ditemukan</p>
              </div>
            )}
          </div>

          {/* Statistics Cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-xl p-6 shadow-[0px_4px_20px_rgba(0,0,0,0.04)] border border-[#f1f5f9] text-center">
              <div className="flex items-center justify-center w-12 h-12 bg-[#dde1ff] rounded-full mx-auto mb-3">
                <Users className="w-6 h-6 text-[#1e40af]" />
              </div>
              <div className="text-3xl font-bold text-[#0f172a] mb-1">{totalSiswa}</div>
              <div className="text-sm text-[#64748b] font-medium">Total Siswa</div>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-[0px_4px_20px_rgba(0,0,0,0.04)] border border-green-200 text-center">
              <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mx-auto mb-3">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div className="text-3xl font-bold text-green-700 mb-1">{attendedCount}</div>
              <div className="text-sm text-green-600 font-medium">Hadir</div>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-[0px_4px_20px_rgba(0,0,0,0.04)] border border-red-200 text-center">
              <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mx-auto mb-3">
                <Users className="w-6 h-6 text-red-600" />
              </div>
              <div className="text-3xl font-bold text-red-700 mb-1">{totalSiswa - attendedCount}</div>
              <div className="text-sm text-red-600 font-medium">Belum Hadir</div>
            </div>
          </div>
        </section>

        {/* Right: Activity Panel - 1 column */}
        <aside className="space-y-4">
          {/* Filter Card */}
          <div className="bg-white rounded-xl p-5 shadow-[0px_4px_20px_rgba(0,0,0,0.04)] border border-[#f1f5f9]">
            <label className="block text-sm font-medium text-[#64748b] uppercase tracking-wider mb-3">
              Filter Kelas
            </label>
            <select
              value={selectedKelasFilter}
              onChange={(e) => setSelectedKelasFilter(e.target.value)}
              className="w-full px-4 py-3 border border-[#e2e8f0] bg-white rounded-lg focus:border-[#1e40af] focus:ring-4 focus:ring-[#1e40af]/10 outline-none font-medium transition-all"
            >
              <option value="ALL">Semua Kelas ({attendedCount}/{totalSiswa})</option>
              {kelasList.map(k => (
                <option key={k.id} value={k.id}>
                  {k.nama} ({k.hadirCount}/{k.totalSiswa})
                </option>
              ))}
            </select>
          </div>

          {/* Activity List */}
          <div className="bg-white rounded-xl shadow-[0px_4px_20px_rgba(0,0,0,0.04)] border border-[#f1f5f9] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#f1f5f9] bg-[#f8fafc]">
              <h2 className="text-sm font-semibold text-[#0f172a] uppercase tracking-wide">Aktivitas Hari Ini</h2>
            </div>
            <div className="max-h-[600px] overflow-y-auto">
              {filteredActivity.length === 0 ? (
                <div className="text-center py-16 text-[#64748b]">
                  <User className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p className="text-sm font-medium">
                    {selectedKelasFilter === 'ALL'
                      ? 'Belum ada siswa yang hadir hari ini'
                      : 'Belum ada siswa dari kelas ini yang hadir'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[#f1f5f9]">
                  {filteredActivity.map((activity) => (
                    <div key={activity.id} className="p-4 hover:bg-[#f8fafc] transition-colors">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-10 h-10 bg-[#dde1ff] rounded-full flex items-center justify-center flex-shrink-0">
                            <User className="w-5 h-5 text-[#1e40af]" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-[#0f172a] truncate">{activity.nama}</div>
                            <div className="text-xs text-[#64748b]">{activity.kelas}</div>
                          </div>
                        </div>
                        {activity.tepatWaktu ? (
                          <div className="px-3 py-1 bg-green-100 rounded-full flex-shrink-0">
                            <span className="text-xs font-semibold text-green-700">TEPAT</span>
                          </div>
                        ) : (
                          <div className="px-3 py-1 bg-red-100 rounded-full flex-shrink-0">
                            <span className="text-xs font-semibold text-red-700">+{activity.keterlambatan}m</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-[#64748b] bg-[#f8fafc] rounded-lg px-3 py-2 w-fit">
                        <Clock className="w-3.5 h-3.5" />
                        <span className="font-medium">{activity.waktu}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
