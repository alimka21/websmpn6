import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { GraduationCap, LogIn, LogOut, Settings, Camera, MapPin, CheckCircle, X, Clock, Users } from 'lucide-react';
import api from '../lib/api';
import { Button } from '../components/ui/button';
import { useSiteConfig } from '../hooks/useSiteConfig';

interface Guru {
  id: string;
  nama: string;
  nip: string;
  statusHariIni?: {
    sudahDatang: boolean;
    sudahPulang: boolean;
    waktuDatang?: string;
    waktuPulang?: string;
  };
}

interface RecentActivity {
  id: string;
  nama: string;
  waktuDatang?: string;
  waktuPulang?: string;
  status: 'datang' | 'pulang' | 'lengkap';
}

export default function PresensiGuruKiosk() {
  const cfg = useSiteConfig();
  const schoolName = cfg.namaSekolah || 'Portal Sekolah';

  const [currentTime, setCurrentTime] = useState(new Date());
  const [guruList, setGuruList] = useState<Guru[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [selectedGuru, setSelectedGuru] = useState<Guru | null>(null);
  const [search, setSearch] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successData, setSuccessData] = useState<{ nama: string; type: 'datang' | 'pulang'; time: string }>({ nama: '', type: 'datang', time: '' });

  const [attendedCount, setAttendedCount] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    loadGuruList();
    loadRecentActivity();
  }, []);

  const loadGuruList = async () => {
    setLoading(true);
    try {
      const data = await api.get('/api/presensi/guru-list');
      setGuruList(data);
      // Count attended
      const count = data.filter((g: Guru) => g.statusHariIni?.sudahDatang).length;
      setAttendedCount(count);
    } catch (err: any) {
      toast.error(err?.message || 'Gagal memuat daftar guru');
    } finally {
      setLoading(false);
    }
  };

  const loadRecentActivity = async () => {
    try {
      // Mock data - replace with real API
      setRecentActivity([
        { id: '1', nama: 'Hj. Ratna Sari, M.Pd', waktuDatang: '06:42', status: 'datang' },
        { id: '2', nama: 'Drs. Bambang Wijaya', waktuDatang: '06:55', status: 'datang' },
        { id: '3', nama: 'Siti Aminah, S.Si.', waktuDatang: '06:45', waktuPulang: '15:32', status: 'lengkap' },
      ]);
    } catch (err) {
      console.error(err);
    }
  };

  const filteredGuru = guruList.filter(g =>
    g.nama.toLowerCase().includes(search.toLowerCase()) ||
    g.nip.includes(search)
  );

  const handleSelectGuru = (guru: Guru) => {
    setSelectedGuru(guru);
    setSearch('');
    setShowSearchResults(false);
  };

  const handleReset = () => {
    setSelectedGuru(null);
    setSearch('');
    setTimeout(() => searchInputRef.current?.focus(), 100);
  };

  const canTapDatang = selectedGuru && !selectedGuru.statusHariIni?.sudahDatang;
  const canTapPulang = selectedGuru && selectedGuru.statusHariIni?.sudahDatang && !selectedGuru.statusHariIni?.sudahPulang;

  const handleTapDatang = async () => {
    if (!selectedGuru) return;
    setSubmitting(true);
    try {
      // Get location
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true });
      });

      await api.post('/api/presensi/guru/datang', {
        guruId: selectedGuru.id,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        fotoBase64: null, // Optional
      });

      const now = new Date();
      setSuccessData({
        nama: selectedGuru.nama,
        type: 'datang',
        time: now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      });
      setShowSuccess(true);

      setTimeout(() => {
        setShowSuccess(false);
        handleReset();
        loadGuruList();
        loadRecentActivity();
      }, 3000);
    } catch (err: any) {
      toast.error(err?.message || 'Gagal mencatat presensi datang');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTapPulang = async () => {
    if (!selectedGuru) return;
    setSubmitting(true);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true });
      });

      await api.post('/api/presensi/guru/pulang', {
        guruId: selectedGuru.id,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        fotoBase64: null,
      });

      const now = new Date();
      setSuccessData({
        nama: selectedGuru.nama,
        type: 'pulang',
        time: now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      });
      setShowSuccess(true);

      setTimeout(() => {
        setShowSuccess(false);
        handleReset();
        loadGuruList();
        loadRecentActivity();
      }, 3000);
    } catch (err: any) {
      toast.error(err?.message || 'Gagal mencatat presensi pulang');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-background text-on-background font-sans overflow-hidden h-screen flex flex-col">
      {/* Header */}
      <header className="bg-surface border-b border-outline-variant px-20 py-6 flex justify-between items-center z-30">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 bg-primary rounded-xl flex items-center justify-center text-on-primary">
            <GraduationCap className="w-9 h-9" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-primary">{schoolName}</h1>
            <p className="text-xs text-on-surface-variant uppercase tracking-widest">Kiosk Presensi Guru</p>
          </div>
        </div>
        <div className="text-center">
          <div className="text-5xl font-bold text-on-surface tracking-tighter leading-none tabular-nums">
            {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
          <div className="text-2xl font-semibold text-on-surface-variant mt-1">
            {currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs uppercase tracking-wider text-outline">Terminal ID</p>
            <p className="text-2xl font-bold text-primary">#01-A Main Lobby</p>
          </div>
          <button className="h-12 w-12 rounded-full flex items-center justify-center bg-surface-container-high text-on-surface hover:bg-primary-container hover:text-on-primary transition-all">
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Status Bar */}
      <div className="bg-surface-container-low px-20 py-4 flex justify-between items-center border-b border-outline-variant/30">
        <div className="flex gap-6 items-center">
          <div className="flex items-center gap-2 bg-surface px-4 py-2 rounded-full border border-outline-variant/50 shadow-sm">
            <Clock className="w-4 h-4 text-primary" />
            <span className="text-sm text-on-surface-variant">Jam Masuk: <span className="font-bold text-on-surface">07:00</span></span>
            <span className="text-outline-variant mx-1">|</span>
            <span className="text-sm text-on-surface-variant">Jam Pulang: <span className="font-bold text-on-surface">15:30</span></span>
          </div>
          <div className="flex items-center gap-2 bg-surface px-4 py-2 rounded-full border border-outline-variant/50 shadow-sm">
            <Users className="w-4 h-4 text-tertiary" />
            <span className="text-sm text-on-surface-variant">Kehadiran: <span className="font-bold text-tertiary">{attendedCount} dari {guruList.length} guru hadir</span></span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-primary font-bold">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
          </span>
          <span className="text-xs font-semibold tracking-wider">SYSTEM LIVE</span>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 grid grid-cols-12 gap-6 px-20 py-8 overflow-hidden">
        {/* Left: Action Area */}
        <section className="col-span-8 flex flex-col gap-8 h-full">
          {/* Step 1: Teacher Selection */}
          <div className="bg-surface-container-lowest p-8 rounded-xl border border-outline-variant shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <span className="bg-primary text-on-primary h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm">1</span>
              <h2 className="text-2xl font-semibold">Identifikasi Diri</h2>
            </div>

            {!selectedGuru ? (
              <div className="relative">
                <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
                  <GraduationCap className="w-8 h-8 text-outline" />
                </div>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onFocus={() => setShowSearchResults(true)}
                  placeholder="Cari Nama Anda atau NIP..."
                  className="w-full pl-16 pr-6 py-6 bg-surface-bright border-2 border-outline-variant rounded-xl text-2xl focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none"
                  autoFocus
                />

                {/* Search Results Dropdown */}
                {showSearchResults && search && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-2xl z-20 max-h-[300px] overflow-y-auto">
                    {filteredGuru.length === 0 ? (
                      <div className="p-4 text-center text-on-surface-variant">Tidak ditemukan</div>
                    ) : (
                      filteredGuru.map((guru) => {
                        const status = guru.statusHariIni;
                        const sudahLengkap = status?.sudahDatang && status?.sudahPulang;

                        return (
                          <div
                            key={guru.id}
                            onClick={() => !sudahLengkap && handleSelectGuru(guru)}
                            className={`p-4 border-b border-outline-variant last:border-0 transition-colors flex justify-between items-center ${
                              sudahLengkap ? 'opacity-50 cursor-not-allowed' : 'hover:bg-surface-container-high cursor-pointer'
                            }`}
                          >
                            <div>
                              <p className="text-lg font-semibold text-on-surface">{guru.nama}</p>
                              <p className="text-sm text-outline">NIP: {guru.nip}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {status?.sudahDatang && (
                                <span className="bg-primary-fixed text-on-primary-fixed-variant px-3 py-1 rounded-full text-xs font-bold">
                                  Sudah Datang · {status.waktuDatang}
                                </span>
                              )}
                              {status?.sudahPulang && (
                                <span className="bg-tertiary-fixed text-on-tertiary-fixed-variant px-3 py-1 rounded-full text-xs font-bold">
                                  Lengkap · {status.waktuPulang}
                                </span>
                              )}
                              {!status?.sudahDatang && (
                                <span className="bg-secondary-container text-on-secondary-container px-3 py-1 rounded-full text-xs">
                                  Belum Hadir
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-6 p-6 bg-primary/5 rounded-xl border border-primary/20 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary">
                    <GraduationCap className="w-8 h-8 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-3xl font-bold text-primary">{selectedGuru.nama}</h3>
                    <p className="text-base text-on-surface-variant tracking-widest">NIP: {selectedGuru.nip}</p>
                  </div>
                </div>
                <button onClick={handleReset} className="text-error font-bold flex items-center gap-1 hover:underline">
                  <X className="w-5 h-5" /> Batalkan
                </button>
              </div>
            )}
          </div>

          {/* Step 2: Action Buttons */}
          <div className="flex-1 grid grid-cols-2 gap-6 items-stretch">
            {/* Tap Datang */}
            <button
              onClick={handleTapDatang}
              disabled={!canTapDatang || submitting}
              className={`group relative flex flex-col items-center justify-center gap-4 rounded-2xl border-4 border-transparent transition-all overflow-hidden disabled:opacity-50 ${
                canTapDatang ? 'bg-surface-container-high hover:bg-green-50 hover:border-green-500' : 'bg-surface-container-high'
              }`}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-green-600/20 opacity-0 group-enabled:group-hover:opacity-100 transition-opacity"></div>
              <LogIn className={`w-16 h-16 mb-2 transition-transform group-active:scale-90 ${canTapDatang ? 'text-green-600' : 'text-outline-variant'}`} />
              <span className={`text-3xl font-bold ${canTapDatang ? 'text-on-background' : 'text-outline-variant'}`}>TAP DATANG</span>
              <p className={`text-sm font-medium ${canTapDatang ? 'text-green-700' : 'text-outline-variant'}`}>Presensi kehadiran masuk</p>
            </button>

            {/* Tap Pulang */}
            <button
              onClick={handleTapPulang}
              disabled={!canTapPulang || submitting}
              className={`group relative flex flex-col items-center justify-center gap-4 rounded-2xl border-4 border-transparent transition-all overflow-hidden disabled:opacity-50 ${
                canTapPulang ? 'bg-surface-container-high hover:bg-blue-50 hover:border-primary' : 'bg-surface-container-high'
              }`}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-blue-600/20 opacity-0 group-enabled:group-hover:opacity-100 transition-opacity"></div>
              <LogOut className={`w-16 h-16 mb-2 transition-transform group-active:scale-90 ${canTapPulang ? 'text-primary' : 'text-outline-variant'}`} />
              <span className={`text-3xl font-bold ${canTapPulang ? 'text-on-background' : 'text-outline-variant'}`}>TAP PULANG</span>
              <p className={`text-sm font-medium ${canTapPulang ? 'text-primary' : 'text-outline-variant'}`}>Presensi kehadiran keluar</p>
            </button>
          </div>

          {/* Geofence Status */}
          <div className="flex gap-4">
            <div className="flex-1 flex items-center gap-3 p-4 bg-surface-container rounded-lg border border-outline-variant/30">
              <MapPin className="w-5 h-5 text-green-600" />
              <span className="text-sm text-on-surface-variant">Radius: <span className="text-green-600 font-bold">12m</span> (Aman - Dalam Jangkauan)</span>
            </div>
            <div className="flex-1 flex items-center gap-3 p-4 bg-surface-container rounded-lg border border-outline-variant/30">
              <Camera className="w-5 h-5 text-primary" />
              <span className="text-sm text-on-surface-variant">Kamera: <span className="font-bold text-on-surface">Aktif (Verifikasi Wajah)</span></span>
            </div>
          </div>
        </section>

        {/* Right: Recent Activity Sidebar */}
        <aside className="col-span-4 flex flex-col h-full overflow-hidden bg-surface-container-low rounded-xl border border-outline-variant">
          <div className="p-6 border-b border-outline-variant bg-surface flex justify-between items-center">
            <h3 className="text-2xl font-semibold">Recap Hari Ini</h3>
            <span className="bg-primary-container text-on-primary-container px-3 py-1 rounded-full text-xs font-bold">Terbaru</span>
          </div>
          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
            {recentActivity.map((activity, idx) => (
              <div key={activity.id} className={`flex items-center gap-4 bg-surface p-4 rounded-xl border border-outline-variant/50 shadow-sm`} style={{ opacity: 1 - idx * 0.1 }}>
                <div className="h-12 w-12 rounded-full bg-surface-container-highest flex items-center justify-center overflow-hidden">
                  <GraduationCap className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-base text-on-surface truncate">{activity.nama}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {activity.waktuDatang && (
                      <span className="text-xs text-green-600 font-bold">Datang {activity.waktuDatang}</span>
                    )}
                    {activity.waktuPulang && (
                      <>
                        <span className="text-outline-variant text-[10px]">•</span>
                        <span className="text-xs text-primary font-bold">Pulang {activity.waktuPulang}</span>
                      </>
                    )}
                    {!activity.waktuPulang && (
                      <>
                        <span className="text-outline-variant text-[10px]">•</span>
                        <span className="text-xs text-outline">Pulang --:--</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </main>

      {/* Success Overlay */}
      {showSuccess && (
        <div className="fixed inset-0 z-50 bg-on-background/60 backdrop-blur-sm flex items-center justify-center p-8 animate-in fade-in duration-300">
          <div className="bg-surface rounded-3xl p-12 max-w-2xl w-full text-center shadow-2xl scale-100 transition-transform duration-300">
            <div className="mb-8 flex justify-center">
              <div className="h-24 w-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                <CheckCircle className="w-16 h-16" />
              </div>
            </div>
            <h2 className="text-5xl font-bold text-primary mb-4">
              {successData.type === 'datang' ? 'Selamat datang,' : 'Sampai jumpa,'} <br />
              <span className="text-on-surface">{successData.nama}!</span>
            </h2>
            <p className="text-2xl font-semibold text-on-surface-variant mb-12">
              Kehadiran {successData.type} Anda telah tercatat pada pukul <span className="font-bold text-on-surface">{successData.time}</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
