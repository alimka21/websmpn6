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

  // Permission & Camera states
  const [cameraPermission, setCameraPermission] = useState<'pending' | 'granted' | 'denied'>('pending');
  const [locationPermission, setLocationPermission] = useState<'pending' | 'granted' | 'denied'>('pending');
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    loadGuruList();
    loadRecentActivity();
    requestPermissionsOnLoad();

    // Cleanup camera stream on unmount
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Start camera stream when permission granted
  useEffect(() => {
    if (cameraPermission === 'granted' && !cameraStream) {
      startCameraStream();
    }
  }, [cameraPermission]);

  // Update video element when stream changes
  useEffect(() => {
    if (videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [cameraStream]);

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
    setTimeout(() => searchInputRef.current?.focus(), 100);
  };

  // Request permissions on page load
  const requestPermissionsOnLoad = async () => {
    // Request Camera
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 },
      });
      setCameraStream(stream);
      setCameraPermission('granted');
    } catch (err: any) {
      console.error('Camera permission error:', err);
      setCameraPermission('denied');
    }

    // Request Location
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      });
      setCurrentLocation({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      });
      setLocationPermission('granted');
    } catch (err: any) {
      console.error('Location permission error:', err);
      setLocationPermission('denied');
    }
  };

  const startCameraStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 },
      });
      setCameraStream(stream);
    } catch (err) {
      console.error('Failed to start camera:', err);
    }
  };

  const retryCamera = async () => {
    setCameraPermission('pending');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 },
      });
      setCameraStream(stream);
      setCameraPermission('granted');
      toast.success('Izin kamera berhasil diberikan');
    } catch (err) {
      setCameraPermission('denied');
      toast.error('Izin kamera ditolak. Mohon aktifkan di pengaturan browser.');
    }
  };

  const retryLocation = async () => {
    setLocationPermission('pending');
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      });
      setCurrentLocation({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      });
      setLocationPermission('granted');
      toast.success('Izin lokasi berhasil diberikan');
    } catch (err) {
      setLocationPermission('denied');
      toast.error('Izin lokasi ditolak. Mohon aktifkan di pengaturan browser.');
    }
  };

  const captureFotoFromStream = (): string | null => {
    if (!videoRef.current || !cameraStream) return null;

    try {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');

      if (ctx && videoRef.current) {
        ctx.drawImage(videoRef.current, 0, 0, 640, 480);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        return dataUrl;
      }
      return null;
    } catch (err) {
      console.error('Capture error:', err);
      return null;
    }
  };

  const handleSubmit = async () => {
    if (!selectedGuru || !currentLocation || cameraPermission !== 'granted') return;

    setSubmitting(true);

    try {
      // Capture photo from stream
      const photo = captureFotoFromStream();
      if (!photo) {
        throw new Error('Gagal mengambil foto dari kamera');
      }

      // Submit to API
      const endpoint = mode === 'datang' ? '/api/presensi/guru/datang' : '/api/presensi/guru/pulang';
      const response: any = await api.post(endpoint, {
        guruId: selectedGuru.id,
        latitude: currentLocation.lat,
        longitude: currentLocation.lng,
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
      toast.error(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = selectedGuru && !submitting && cameraPermission === 'granted' && locationPermission === 'granted';
  const permissionsReady = cameraPermission === 'granted' && locationPermission === 'granted';

  return (
    <div className="bg-background text-on-background font-sans overflow-hidden min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-surface border-b border-outline-variant px-4 md:px-20 py-3 md:py-6 z-30">
        <div className="flex justify-between items-center gap-2">
          {/* Left: Logo + Name */}
          <div className="flex items-center gap-2 md:gap-4">
            <div className="h-10 w-10 md:h-14 md:w-14 bg-primary rounded-lg md:rounded-xl flex items-center justify-center text-on-primary">
              <GraduationCap className="w-6 h-6 md:w-9 md:h-9" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-base md:text-2xl font-bold text-primary">{schoolName}</h1>
              <p className="text-[10px] md:text-xs text-on-surface-variant uppercase tracking-widest">Kiosk Presensi Guru</p>
            </div>
          </div>

          {/* Center: Clock */}
          <div className="text-center">
            <div className="text-2xl md:text-5xl font-bold text-on-surface tracking-tighter leading-none tabular-nums">
              {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div className="text-xs md:text-2xl font-semibold text-on-surface-variant mt-0.5 md:mt-1 hidden sm:block">
              {currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
            <div className="text-[10px] text-on-surface-variant mt-0.5 sm:hidden">
              {currentTime.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
            </div>
          </div>

          {/* Right: Terminal + Settings */}
          <div className="flex items-center gap-2 md:gap-4">
            <div className="text-right hidden lg:block">
              <p className="text-xs uppercase tracking-wider text-outline">Terminal ID</p>
              <p className="text-xl md:text-2xl font-bold text-primary">#01</p>
            </div>
            <button className="h-8 w-8 md:h-12 md:w-12 rounded-full flex items-center justify-center bg-surface-container-high text-on-surface hover:bg-primary-container hover:text-on-primary transition-all">
              <Settings className="w-4 h-4 md:w-5 md:h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Status Bar */}
      <div className="bg-surface-container-low px-4 md:px-20 py-2 md:py-4 border-b border-outline-variant/30">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-4">
          <div className="flex flex-wrap gap-2 md:gap-6 items-center w-full sm:w-auto">
            <div className="flex items-center gap-1.5 md:gap-2 bg-surface px-2 md:px-4 py-1.5 md:py-2 rounded-full border border-outline-variant/50 shadow-sm text-xs md:text-sm">
              <Clock className="w-3 h-3 md:w-4 md:h-4 text-primary shrink-0" />
              <span className="text-on-surface-variant whitespace-nowrap">
                <span className="hidden sm:inline">Jam Masuk: </span>
                <span className="font-bold text-on-surface">07:00</span>
              </span>
              <span className="text-outline-variant mx-0.5 md:mx-1 hidden sm:inline">|</span>
              <span className="text-on-surface-variant whitespace-nowrap hidden sm:inline">
                Jam Pulang: <span className="font-bold text-on-surface">15:30</span>
              </span>
            </div>
            <div className="flex items-center gap-1.5 md:gap-2 bg-surface px-2 md:px-4 py-1.5 md:py-2 rounded-full border border-outline-variant/50 shadow-sm text-xs md:text-sm">
              <Users className="w-3 h-3 md:w-4 md:h-4 text-tertiary shrink-0" />
              <span className="text-on-surface-variant whitespace-nowrap">
                <span className="hidden sm:inline">Kehadiran: </span>
                <span className="font-bold text-tertiary">{attendedCount}/{guruList.length}</span>
                <span className="hidden sm:inline"> guru</span>
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 md:gap-2 text-primary font-bold text-xs md:text-sm">
            <span className="relative flex h-2 w-2 md:h-3 md:w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 md:h-3 md:w-3 bg-primary"></span>
            </span>
            <span className="font-semibold tracking-wider">LIVE</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 flex flex-col lg:grid lg:grid-cols-12 gap-4 md:gap-6 px-4 md:px-20 py-4 md:py-8 overflow-y-auto lg:overflow-hidden">
        {/* Left: Action Area */}
        <section className="lg:col-span-8 flex flex-col gap-4 md:gap-8 h-full">
          {/* Step 1: Teacher Selection */}
          <div className="bg-surface-container-lowest p-4 md:p-8 rounded-xl border border-outline-variant shadow-sm">
            <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-6">
              <span className="bg-primary text-on-primary h-6 w-6 md:h-8 md:w-8 rounded-full flex items-center justify-center font-bold text-xs md:text-sm">1</span>
              <h2 className="text-lg md:text-2xl font-semibold">Identifikasi Diri</h2>
            </div>

            {!selectedGuru ? (
              <div className="relative">
                <div className="absolute inset-y-0 left-3 md:left-6 flex items-center pointer-events-none">
                  <GraduationCap className="w-6 h-6 md:w-8 md:h-8 text-outline" />
                </div>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onFocus={() => setShowSearchResults(true)}
                  placeholder="Cari Nama Anda atau NIP..."
                  className="w-full pl-12 md:pl-16 pr-4 md:pr-6 py-4 md:py-6 bg-surface-bright border-2 border-outline-variant rounded-xl text-lg md:text-2xl focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none"
                  autoFocus
                />

                {showSearchResults && search && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-2xl z-20 max-h-[50vh] md:max-h-[300px] overflow-y-auto">
                    {filteredGuru.length === 0 ? (
                      <div className="p-4 text-center text-on-surface-variant text-sm">Tidak ditemukan</div>
                    ) : (
                      filteredGuru.map((guru) => {
                        const status = guru.statusHariIni;
                        const sudahLengkap = status?.sudahDatang && status?.sudahPulang;

                        return (
                          <div
                            key={guru.id}
                            onClick={() => !sudahLengkap && handleSelectGuru(guru)}
                            className={`p-3 md:p-4 border-b border-outline-variant last:border-0 transition-colors flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 ${
                              sudahLengkap ? 'opacity-50 cursor-not-allowed' : 'hover:bg-surface-container-high cursor-pointer active:bg-surface-container'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-base md:text-lg font-semibold text-on-surface truncate">{guru.nama}</p>
                              <p className="text-xs md:text-sm text-outline">NIP: {guru.nip}</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
                              {status?.sudahDatang && (
                                <span className="bg-primary-fixed text-on-primary-fixed-variant px-2 md:px-3 py-0.5 md:py-1 rounded-full text-[10px] md:text-xs font-bold whitespace-nowrap">
                                  Datang · {status.waktuDatang}
                                </span>
                              )}
                              {status?.sudahPulang && (
                                <span className="bg-tertiary-fixed text-on-tertiary-fixed-variant px-2 md:px-3 py-0.5 md:py-1 rounded-full text-[10px] md:text-xs font-bold whitespace-nowrap">
                                  Pulang · {status.waktuPulang}
                                </span>
                              )}
                              {!status?.sudahDatang && (
                                <span className="bg-secondary-container text-on-secondary-container px-2 md:px-3 py-0.5 md:py-1 rounded-full text-[10px] md:text-xs whitespace-nowrap">
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
              <div className="mt-4 md:mt-6 p-4 md:p-6 bg-primary/5 rounded-xl border border-primary/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 md:gap-4 min-w-0 flex-1">
                  <div className="h-12 w-12 md:h-16 md:w-16 rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary shrink-0">
                    <GraduationCap className="w-6 h-6 md:w-8 md:h-8 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-xl md:text-3xl font-bold text-primary truncate">{selectedGuru.nama}</h3>
                    <p className="text-sm md:text-base text-on-surface-variant tracking-wide md:tracking-widest">NIP: {selectedGuru.nip}</p>
                  </div>
                </div>
                <button onClick={handleReset} className="text-error font-bold flex items-center gap-1 hover:underline text-sm md:text-base shrink-0 self-end sm:self-auto">
                  <X className="w-4 h-4 md:w-5 md:h-5" /> Batalkan
                </button>
              </div>
            )}
          </div>

          {/* Permission Status & Camera Preview */}
          {!selectedGuru && (
            <div className="bg-surface-container-lowest p-4 md:p-8 rounded-xl border border-outline-variant shadow-sm">
              <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-6">
                <span className="bg-secondary text-on-secondary h-6 w-6 md:h-8 md:w-8 rounded-full flex items-center justify-center font-bold text-xs md:text-sm">
                  <Camera className="w-3 h-3 md:w-4 md:h-4" />
                </span>
                <h2 className="text-lg md:text-2xl font-semibold">Status Sistem</h2>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                {/* Camera Preview */}
                <div className="space-y-3">
                  <div className="relative bg-black rounded-xl overflow-hidden aspect-video">
                    {cameraPermission === 'granted' && cameraStream ? (
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />
                    ) : cameraPermission === 'pending' ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface-container text-on-surface-variant">
                        <div className="w-8 h-8 border-4 border-primary/40 border-t-primary rounded-full animate-spin mb-3" />
                        <p className="text-sm">Meminta izin kamera...</p>
                      </div>
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-error-container text-error">
                        <AlertTriangle className="w-12 h-12 mb-3" />
                        <p className="text-sm font-semibold mb-2">Kamera Tidak Aktif</p>
                        <button onClick={retryCamera} className="text-xs underline hover:no-underline">
                          Coba Lagi
                        </button>
                      </div>
                    )}
                    <div className="absolute top-2 right-2 flex items-center gap-1.5 px-2 py-1 bg-black/60 backdrop-blur-sm rounded-full text-xs text-white">
                      <div className={`w-2 h-2 rounded-full ${cameraPermission === 'granted' ? 'bg-green-500' : 'bg-red-500'}`} />
                      Live
                    </div>
                  </div>
                </div>

                {/* Permission Status */}
                <div className="space-y-3">
                  <div className={`flex items-start gap-3 p-4 rounded-lg border-2 ${
                    cameraPermission === 'granted'
                      ? 'bg-green-50 border-green-500'
                      : cameraPermission === 'pending'
                      ? 'bg-surface-container border-outline-variant'
                      : 'bg-error-container border-error'
                  }`}>
                    <Camera className={`w-5 h-5 shrink-0 mt-0.5 ${
                      cameraPermission === 'granted' ? 'text-green-600' : 'text-error'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold mb-1">
                        {cameraPermission === 'granted' ? 'Kamera Aktif' : cameraPermission === 'pending' ? 'Menunggu Izin Kamera' : 'Kamera Tidak Aktif'}
                      </p>
                      <p className="text-xs text-on-surface-variant leading-snug">
                        {cameraPermission === 'granted'
                          ? 'Kamera siap untuk mengambil foto presensi'
                          : 'Izinkan akses kamera untuk melanjutkan presensi'}
                      </p>
                      {cameraPermission === 'denied' && (
                        <button onClick={retryCamera} className="mt-2 text-xs font-semibold text-primary hover:underline">
                          Coba Aktifkan Lagi →
                        </button>
                      )}
                    </div>
                  </div>

                  <div className={`flex items-start gap-3 p-4 rounded-lg border-2 ${
                    locationPermission === 'granted'
                      ? 'bg-green-50 border-green-500'
                      : locationPermission === 'pending'
                      ? 'bg-surface-container border-outline-variant'
                      : 'bg-error-container border-error'
                  }`}>
                    <MapPin className={`w-5 h-5 shrink-0 mt-0.5 ${
                      locationPermission === 'granted' ? 'text-green-600' : 'text-error'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold mb-1">
                        {locationPermission === 'granted' ? 'Lokasi Aktif' : locationPermission === 'pending' ? 'Menunggu Izin Lokasi' : 'Lokasi Tidak Aktif'}
                      </p>
                      <p className="text-xs text-on-surface-variant leading-snug">
                        {locationPermission === 'granted'
                          ? `Lokasi terdeteksi: ${currentLocation?.lat.toFixed(6)}, ${currentLocation?.lng.toFixed(6)}`
                          : 'Izinkan akses lokasi untuk validasi kehadiran'}
                      </p>
                      {locationPermission === 'denied' && (
                        <button onClick={retryLocation} className="mt-2 text-xs font-semibold text-primary hover:underline">
                          Coba Aktifkan Lagi →
                        </button>
                      )}
                    </div>
                  </div>

                  {!permissionsReady && (
                    <div className="flex items-start gap-2 p-3 bg-orange-50 border-2 border-orange-400 rounded-lg">
                      <AlertTriangle className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                      <p className="text-xs text-orange-800 leading-snug">
                        Pastikan kamera dan lokasi aktif sebelum melakukan presensi.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Submit Button */}
          {selectedGuru && (
            <div className="flex-1 flex flex-col gap-4 md:gap-6">
              <div className="bg-surface-container-lowest p-4 md:p-8 rounded-xl border border-outline-variant shadow-sm">
                <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-6">
                  <span className="bg-primary text-on-primary h-6 w-6 md:h-8 md:w-8 rounded-full flex items-center justify-center font-bold text-xs md:text-sm">2</span>
                  <h2 className="text-lg md:text-2xl font-semibold">Verifikasi & Submit</h2>
                </div>

                <div className="space-y-3 md:space-y-4">
                  {/* Camera Preview - Always Shown */}
                  <div className="relative bg-black rounded-xl overflow-hidden aspect-video">
                    {cameraPermission === 'granted' && cameraStream ? (
                      <>
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          muted
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-2 right-2 flex items-center gap-1.5 px-2 py-1 bg-black/60 backdrop-blur-sm rounded-full text-xs text-white">
                          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                          Recording
                        </div>
                      </>
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-error-container text-error">
                        <AlertTriangle className="w-12 h-12 mb-3" />
                        <p className="text-sm font-semibold">Kamera Tidak Aktif</p>
                      </div>
                    )}
                  </div>

                  {/* Status Indicators */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className={`flex items-center gap-2 p-3 rounded-lg border ${
                      cameraPermission === 'granted' ? 'bg-green-50 border-green-500' : 'bg-error-container border-error'
                    }`}>
                      <Camera className={`w-4 h-4 ${cameraPermission === 'granted' ? 'text-green-600' : 'text-error'}`} />
                      <span className="text-xs font-semibold">{cameraPermission === 'granted' ? 'Kamera Siap' : 'Kamera Tidak Aktif'}</span>
                    </div>
                    <div className={`flex items-center gap-2 p-3 rounded-lg border ${
                      locationPermission === 'granted' ? 'bg-green-50 border-green-500' : 'bg-error-container border-error'
                    }`}>
                      <MapPin className={`w-4 h-4 ${locationPermission === 'granted' ? 'text-green-600' : 'text-error'}`} />
                      <span className="text-xs font-semibold">{locationPermission === 'granted' ? 'Lokasi Siap' : 'Lokasi Tidak Aktif'}</span>
                    </div>
                  </div>

                  {!permissionsReady && (
                    <div className="flex items-start gap-2 md:gap-3 p-3 md:p-4 bg-orange-50 rounded-lg border-2 border-orange-400">
                      <AlertTriangle className="w-4 h-4 md:w-5 md:h-5 text-orange-600 shrink-0 mt-0.5" />
                      <div className="text-xs md:text-sm text-orange-800 leading-snug">
                        Kamera dan lokasi harus aktif sebelum melakukan presensi. Mohon aktifkan izin di browser Anda.
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                    className={`w-full py-6 md:py-8 rounded-xl md:rounded-2xl text-xl md:text-3xl font-bold transition-all flex items-center justify-center gap-3 md:gap-4 active:scale-[0.98] ${
                      mode === 'datang'
                        ? 'bg-green-600 text-white hover:bg-green-700 active:bg-green-800 disabled:bg-surface-container-high disabled:text-outline-variant'
                        : 'bg-primary text-white hover:bg-primary/90 active:bg-primary/80 disabled:bg-surface-container-high disabled:text-outline-variant'
                    }`}
                  >
                    {submitting ? (
                      <>
                        <div className="w-6 h-6 md:w-8 md:h-8 border-4 border-white/40 border-t-white rounded-full animate-spin" />
                        <span className="text-base md:text-3xl">Memproses...</span>
                      </>
                    ) : (
                      <>
                        {mode === 'datang' ? <LogIn className="w-8 h-8 md:w-10 md:h-10" /> : <LogOut className="w-8 h-8 md:w-10 md:h-10" />}
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
        <aside className="lg:col-span-4 flex flex-col h-auto lg:h-full overflow-hidden bg-surface-container-low rounded-xl border border-outline-variant">
          <div className="p-4 md:p-6 border-b border-outline-variant bg-surface flex justify-between items-center">
            <h3 className="text-lg md:text-2xl font-semibold">Recap Hari Ini</h3>
            <span className="bg-primary-container text-on-primary-container px-2 md:px-3 py-1 rounded-full text-[10px] md:text-xs font-bold">Terbaru</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col gap-3 md:gap-4 max-h-[400px] lg:max-h-none">
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
        <div className="fixed inset-0 z-50 bg-on-background/60 backdrop-blur-sm flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-300">
          <div className="bg-surface rounded-2xl md:rounded-3xl p-6 md:p-12 max-w-2xl w-full text-center shadow-2xl scale-100 transition-transform duration-300">
            <div className="mb-6 md:mb-8 flex justify-center">
              <div className="h-16 w-16 md:h-24 md:w-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                <CheckCircle className="w-10 h-10 md:w-16 md:h-16" />
              </div>
            </div>
            <h2 className="text-2xl md:text-5xl font-bold text-primary mb-3 md:mb-4 leading-tight">
              {successData.type === 'datang' ? 'Selamat datang,' : 'Sampai jumpa,'} <br />
              <span className="text-on-surface">{successData.nama}!</span>
            </h2>
            <p className="text-base md:text-2xl font-semibold text-on-surface-variant mb-3 md:mb-4">
              Presensi {successData.type} tercatat pada pukul <span className="font-bold text-on-surface">{successData.time}</span>
            </p>
            {successData.jarak !== undefined && (
              <p className="text-xs md:text-sm text-green-600 font-medium">
                ✓ Lokasi terverifikasi ({successData.jarak} meter dari sekolah)
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
