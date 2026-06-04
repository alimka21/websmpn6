import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { GraduationCap, LogIn, LogOut, Settings, Camera, MapPin, CheckCircle, X, Clock, Users, AlertTriangle } from 'lucide-react';
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
  nip: string;
  waktuDatang: string | null;
  waktuPulang: string | null;
  keterlambatan: number;
  totalJam: number;
  autoCheckout: boolean;
}

export default function PresensiGuruKiosk() {
  const cfg = useSiteConfig();
  const schoolName = cfg.namaSekolah || 'Portal Sekolah';

  const [currentTime, setCurrentTime] = useState(new Date());
  const [guruList, setGuruList] = useState<Guru[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [selectedGuru, setSelectedGuru] = useState<Guru | null>(null);
  const [mode, setMode] = useState<'datang' | 'pulang'>('datang');
  const [search, setSearch] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successData, setSuccessData] = useState<{ nama: string; type: 'datang' | 'pulang'; time: string; jarak?: number }>({
    nama: '',
    type: 'datang',
    time: '',
  });

  const [attendedCount, setAttendedCount] = useState(0);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

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
      const data = await api.get('/api/presensi/guru/recent?limit=10');
      setRecentActivity(data);
    } catch (err) {
      console.error(err);
    }
  };

  const formatMinutesToHours = (minutes: number): string => {
    if (minutes === 0) return '0 menit';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins} menit`;
    if (mins === 0) return `${hours} jam`;
    return `${hours} jam ${mins} menit`;
  };

  const filteredGuru = guruList.filter(g =>
    g.nama.toLowerCase().includes(search.toLowerCase()) ||
    g.nip.includes(search)
  );

  const handleSelectGuru = (guru: Guru) => {
    setSelectedGuru(guru);
    setSearch('');
    setShowSearchResults(false);
    setCapturedPhoto(null);
    setLocation(null);
    setPermissionError(null);

    // Determine mode
    if (!guru.statusHariIni?.sudahDatang) {
      setMode('datang');
    } else if (!guru.statusHariIni?.sudahPulang) {
      setMode('pulang');
    } else {
      toast.info('Anda sudah melakukan presensi datang dan pulang hari ini');
      setSelectedGuru(null);
    }
  };

  const handleReset = () => {
    setSelectedGuru(null);
    setSearch('');
    setCapturedPhoto(null);
    setLocation(null);
    setPermissionError(null);
    setTimeout(() => searchInputRef.current?.focus(), 100);
  };

  const requestCameraPermission = async (): Promise<string | null> => {
    try {
      // Trigger camera permission by creating video element
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 },
      });

      // Capture photo immediately
      const video = document.createElement('video');
      video.srcObject = stream;
      video.play();

      await new Promise(resolve => setTimeout(resolve, 500)); // Wait for video ready

      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, 640, 480);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());

        return dataUrl;
      }

      stream.getTracks().forEach(track => track.stop());
      return null;
    } catch (err: any) {
      console.error('Camera error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        throw new Error('Izin kamera ditolak. Silakan aktifkan izin kamera di pengaturan browser.');
      } else if (err.name === 'NotFoundError') {
        throw new Error('Kamera tidak ditemukan pada perangkat ini.');
      } else {
        throw new Error('Gagal mengakses kamera: ' + err.message);
      }
    }
  };

  const requestLocationPermission = async (): Promise<{ lat: number; lng: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation tidak didukung oleh browser ini.'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.error('Location error:', error);
          if (error.code === error.PERMISSION_DENIED) {
            reject(new Error('Izin lokasi ditolak. Silakan aktifkan izin lokasi di pengaturan browser.'));
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            reject(new Error('Lokasi tidak tersedia. Pastikan GPS aktif.'));
          } else if (error.code === error.TIMEOUT) {
            reject(new Error('Waktu habis saat mendapatkan lokasi. Coba lagi.'));
          } else {
            reject(new Error('Gagal mendapatkan lokasi: ' + error.message));
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    });
  };

  const handleSubmit = async () => {
    if (!selectedGuru) return;

    setSubmitting(true);
    setPermissionError(null);

    try {
      // 1. Request Camera Permission & Capture Photo
      toast.info('Mengakses kamera...');
      const photo = await requestCameraPermission();
      if (!photo) {
        throw new Error('Gagal mengambil foto');
      }
      setCapturedPhoto(photo);

      // 2. Request Location Permission
      toast.info('Mengakses lokasi...');
      const loc = await requestLocationPermission();
      setLocation(loc);

      // 3. Submit to API
      const endpoint = mode === 'datang' ? '/api/presensi/guru/datang' : '/api/presensi/guru/pulang';
      const response: any = await api.post(endpoint, {
        guruId: selectedGuru.id,
        latitude: loc.lat,
        longitude: loc.lng,
        fotoBase64: photo,
      });

      const now = new Date();
      setSuccessData({
        nama: selectedGuru.nama,
        type: mode,
        time: now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        jarak: response.jarak,
      });
      setShowSuccess(true);

      setTimeout(() => {
        setShowSuccess(false);
        handleReset();
        loadGuruList();
        loadRecentActivity();
      }, 3000);
    } catch (err: any) {
      console.error('Submit error:', err);
      const errorMsg = err?.message || err?.error || 'Gagal mencatat presensi';
      setPermissionError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = selectedGuru && !submitting;

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
                                  Datang · {status.waktuDatang}
                                </span>
                              )}
                              {status?.sudahPulang && (
                                <span className="bg-tertiary-fixed text-on-tertiary-fixed-variant px-3 py-1 rounded-full text-xs font-bold">
                                  Pulang · {status.waktuPulang}
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

          {/* Step 2: Submit Button */}
          {selectedGuru && (
            <div className="flex-1 flex flex-col gap-6">
              <div className="bg-surface-container-lowest p-8 rounded-xl border border-outline-variant shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <span className="bg-primary text-on-primary h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm">2</span>
                  <h2 className="text-2xl font-semibold">Ambil Foto & Lokasi</h2>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 bg-surface-container rounded-lg">
                    <Camera className="w-5 h-5 text-primary" />
                    <span className="text-sm">Kamera akan diaktifkan otomatis saat presensi</span>
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-surface-container rounded-lg">
                    <MapPin className="w-5 h-5 text-primary" />
                    <span className="text-sm">Lokasi akan divalidasi untuk memastikan Anda di sekolah</span>
                  </div>

                  {permissionError && (
                    <div className="flex items-start gap-3 p-4 bg-error-container rounded-lg border-2 border-error">
                      <AlertTriangle className="w-5 h-5 text-error shrink-0 mt-0.5" />
                      <div className="text-sm text-error whitespace-pre-line">{permissionError}</div>
                    </div>
                  )}

                  <button
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                    className={`w-full py-8 rounded-2xl text-3xl font-bold transition-all flex items-center justify-center gap-4 ${
                      mode === 'datang'
                        ? 'bg-green-600 text-white hover:bg-green-700 disabled:bg-surface-container-high disabled:text-outline-variant'
                        : 'bg-primary text-white hover:bg-primary/90 disabled:bg-surface-container-high disabled:text-outline-variant'
                    }`}
                  >
                    {submitting ? (
                      <>
                        <div className="w-8 h-8 border-4 border-white/40 border-t-white rounded-full animate-spin" />
                        Memproses...
                      </>
                    ) : (
                      <>
                        {mode === 'datang' ? <LogIn className="w-10 h-10" /> : <LogOut className="w-10 h-10" />}
                        TAP {mode.toUpperCase()}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Right: Recent Activity */}
        <aside className="col-span-4 flex flex-col h-full overflow-hidden bg-surface-container-low rounded-xl border border-outline-variant">
          <div className="p-6 border-b border-outline-variant bg-surface flex justify-between items-center">
            <h3 className="text-2xl font-semibold">Recap Hari Ini</h3>
            <span className="bg-primary-container text-on-primary-container px-3 py-1 rounded-full text-xs font-bold">Terbaru</span>
          </div>
          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
            {recentActivity.length === 0 ? (
              <div className="text-center py-12 text-on-surface-variant">
                <GraduationCap className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Belum ada guru yang hadir hari ini</p>
              </div>
            ) : (
              recentActivity.map((activity, idx) => (
                <div key={activity.id} className={`bg-surface p-4 rounded-xl border border-outline-variant/50 shadow-sm`} style={{ opacity: 1 - idx * 0.08 }}>
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-surface-container-highest flex items-center justify-center shrink-0">
                      <GraduationCap className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-on-surface truncate">{activity.nama}</p>
                      <p className="text-xs text-outline mb-2">{activity.nip}</p>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs">
                          <span className={`font-bold ${activity.waktuDatang ? 'text-green-600' : 'text-outline'}`}>
                            Datang {activity.waktuDatang || '--:--'}
                          </span>
                          {activity.keterlambatan > 0 && (
                            <span className="bg-error-container text-error px-2 py-0.5 rounded-full text-[10px] font-bold">
                              Telat {activity.keterlambatan}m
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-xs">
                          <span className={`font-bold ${activity.waktuPulang ? 'text-primary' : 'text-outline'}`}>
                            Pulang {activity.waktuPulang || '--:--'}
                          </span>
                          {activity.autoCheckout && (
                            <span className="bg-tertiary-fixed text-on-tertiary-fixed px-2 py-0.5 rounded-full text-[10px] font-bold">
                              Auto
                            </span>
                          )}
                        </div>

                        {activity.totalJam > 0 && (
                          <div className="text-xs text-on-surface-variant pt-1 border-t border-outline-variant/30 mt-2">
                            <span className="font-semibold">Total: {formatMinutesToHours(activity.totalJam)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
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
            <p className="text-2xl font-semibold text-on-surface-variant mb-4">
              Presensi {successData.type} tercatat pada pukul <span className="font-bold text-on-surface">{successData.time}</span>
            </p>
            {successData.jarak !== undefined && (
              <p className="text-sm text-green-600 font-medium">
                ✓ Lokasi terverifikasi ({successData.jarak} meter dari sekolah)
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
