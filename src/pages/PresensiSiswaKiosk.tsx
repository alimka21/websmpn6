import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Users, CheckCircle, Home, User, Clock, Calendar, TrendingUp, Filter, GraduationCap } from 'lucide-react';
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
    <div className="bg-surface-container-low text-on-surface font-sans min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-surface border-b border-outline-variant px-4 md:px-8 py-4 z-50">
        <div className="flex items-center justify-between max-w-[1800px] mx-auto">
          {/* Left: Clock */}
          <div className="flex items-center gap-3">
            {cfg.logoUrl ? (
              <img src={cfg.logoUrl} alt={schoolName} className="h-12 w-12 object-contain rounded-lg" />
            ) : (
              <div className="h-12 w-12 bg-primary rounded-lg flex items-center justify-center text-white">
                <GraduationCap className="w-7 h-7" />
              </div>
            )}
            <div>
              <div className="text-2xl font-bold text-primary tabular-nums leading-none">
                {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
              <div className="text-xs text-on-surface-variant mt-0.5">
                {currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}
              </div>
            </div>
          </div>

          {/* Center: Title */}
          <div className="hidden md:block text-center">
            <h1 className="text-xl font-bold text-on-surface">{schoolName}</h1>
            <p className="text-xs text-on-surface-variant uppercase tracking-wider">Kiosk Presensi Siswa</p>
          </div>

          {/* Right: Home Button */}
          <Link
            to="/"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-container-high text-on-surface hover:bg-primary hover:text-white transition-all"
          >
            <Home className="w-5 h-5" />
            <span className="font-medium text-sm">Beranda</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row max-w-[1800px] mx-auto w-full p-4 md:p-6 gap-6">
        {/* Left: Input Section */}
        <section className="flex-1 flex flex-col">
          <div className="bg-surface rounded-2xl p-6 md:p-8 shadow-sm border border-outline-variant/30">
            {/* Success Overlay */}
            {showSuccess && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="bg-surface rounded-2xl p-8 max-w-md w-full text-center shadow-2xl border-2 border-green-500 animate-in zoom-in duration-300">
                  <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center text-white mb-4 mx-auto">
                    <CheckCircle className="w-12 h-12" />
                  </div>
                  <h2 className="text-2xl font-bold text-on-surface mb-2">Presensi Berhasil!</h2>
                  <p className="text-on-surface-variant mb-4">
                    <span className="font-semibold text-lg text-primary">{successData.nama}</span>
                    <br />
                    <span className="text-sm">{successData.kelas}</span>
                  </p>
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary-fixed rounded-lg">
                    <Clock className="w-5 h-5 text-primary" />
                    <span className="font-bold text-lg text-primary">{successData.time}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Input Form */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-on-surface-variant mb-2 uppercase tracking-wide">
                Masukkan NIS
              </label>
              <form onSubmit={handleSearch} className="flex gap-3">
                <input
                  ref={inputRef}
                  type="text"
                  value={nis}
                  onChange={(e) => setNis(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ketik NIS..."
                  className="flex-1 px-4 py-3 border-2 border-outline-variant bg-surface rounded-xl focus:border-primary focus:ring-4 focus:ring-primary/20 outline-none text-lg transition-all"
                  disabled={loading || submitting}
                />
                <button
                  type="submit"
                  onClick={handleSearch}
                  disabled={loading || submitting || !nis.trim()}
                  className="px-6 py-3 bg-primary text-white rounded-xl hover:bg-primary-container disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-all shadow-sm"
                >
                  {loading ? 'Mencari...' : 'Cari'}
                </button>
              </form>
            </div>

            {/* Result Card */}
            {siswa && (
              <div className="bg-primary-fixed border-2 border-primary rounded-xl p-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-primary rounded-full flex items-center justify-center text-white">
                      <User className="w-7 h-7" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-on-surface">{siswa.nama}</h3>
                      <p className="text-sm text-on-surface-variant">NIS: {siswa.nis}</p>
                    </div>
                  </div>
                  <div className="px-3 py-1 bg-primary rounded-full">
                    <span className="text-sm font-bold text-white">{siswa.kelas}</span>
                  </div>
                </div>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="w-full py-3 bg-primary text-white rounded-xl hover:bg-primary-container disabled:opacity-50 font-bold text-lg transition-all shadow-md hover:shadow-lg"
                >
                  {submitting ? 'Menyimpan...' : 'Konfirmasi Presensi'}
                </button>
              </div>
            )}

            {!siswa && !loading && nis && (
              <div className="text-center py-8 text-on-surface-variant">
                <User className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Siswa tidak ditemukan</p>
              </div>
            )}
          </div>
        </section>

        {/* Right: Activity Panel */}
        <aside className="lg:w-[480px] flex flex-col gap-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-surface rounded-xl p-4 shadow-sm border border-outline-variant/30 text-center">
              <div className="flex items-center justify-center w-10 h-10 bg-primary-fixed rounded-full mx-auto mb-2">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div className="text-2xl font-bold text-on-surface">{totalSiswa}</div>
              <div className="text-xs text-on-surface-variant font-medium">Total Siswa</div>
            </div>
            <div className="bg-green-50 rounded-xl p-4 shadow-sm border border-green-200 text-center">
              <div className="flex items-center justify-center w-10 h-10 bg-green-500 rounded-full mx-auto mb-2">
                <CheckCircle className="w-5 h-5 text-white" />
              </div>
              <div className="text-2xl font-bold text-green-700">{attendedCount}</div>
              <div className="text-xs text-green-600 font-medium">Hadir</div>
            </div>
            <div className="bg-red-50 rounded-xl p-4 shadow-sm border border-red-200 text-center">
              <div className="flex items-center justify-center w-10 h-10 bg-red-500 rounded-full mx-auto mb-2">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <div className="text-2xl font-bold text-red-700">{totalSiswa - attendedCount}</div>
              <div className="text-xs text-red-600 font-medium">Belum Hadir</div>
            </div>
          </div>

          {/* Filter Kelas */}
          <div className="bg-surface rounded-xl p-4 shadow-sm border border-outline-variant/30">
            <label className="flex items-center gap-2 text-sm font-semibold text-on-surface-variant mb-2 uppercase tracking-wide">
              <Filter className="w-4 h-4" />
              Filter Kelas
            </label>
            <select
              value={selectedKelasFilter}
              onChange={(e) => setSelectedKelasFilter(e.target.value)}
              className="w-full px-3 py-2 border-2 border-outline-variant bg-surface rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none font-medium transition-all"
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
          <div className="bg-surface rounded-xl shadow-sm border border-outline-variant/30 flex-1 flex flex-col">
            <div className="p-4 border-b border-outline-variant">
              <h2 className="text-sm font-bold text-on-surface uppercase tracking-wide flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Aktivitas Hari Ini
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[600px]">
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
                    className="bg-surface-container-low rounded-xl p-4 border border-outline-variant/20 hover:border-primary/40 transition-all hover:shadow-md"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 bg-primary-fixed rounded-full flex items-center justify-center flex-shrink-0">
                          <User className="w-5 h-5 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-on-surface truncate">{activity.nama}</div>
                          <div className="text-xs text-on-surface-variant">{activity.kelas}</div>
                        </div>
                      </div>
                      {activity.tepatWaktu ? (
                        <div className="px-3 py-1 bg-green-100 rounded-full flex-shrink-0">
                          <span className="text-xs font-bold text-green-700">TEPAT</span>
                        </div>
                      ) : (
                        <div className="px-3 py-1 bg-red-100 rounded-full flex-shrink-0">
                          <span className="text-xs font-bold text-red-700">TELAT {activity.keterlambatan}m</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-primary font-medium bg-primary-fixed/50 rounded-lg px-3 py-1.5 w-fit">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Hadir: {activity.waktu}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
