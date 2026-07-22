import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { GraduationCap, LogIn, LogOut, Home, Camera, MapPin, CheckCircle, X, Clock, Users, AlertTriangle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();

  useEffect(() => {
    if (!sessionStorage.getItem('presensi_guru_ok')) {
      navigate('/', { replace: true });
    }
  }, [navigate]);

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
  const [presensiTZ, setPresensiTZ] = useState('Asia/Jakarta');

  // Permission & Camera states
  const [cameraPermission, setCameraPermission] = useState<'pending' | 'granted' | 'denied'>('pending');
  const [locationPermission, setLocationPermission] = useState<'pending' | 'granted' | 'denied'>('pending');
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoRef2 = useRef<HTMLVideoElement>(null); // For second video element when guru selected

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    api.get('/api/presensi/pengaturan').then((d: any) => {
      if (d?.timezone) setPresensiTZ(d.timezone);
    }).catch(() => {});
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

  // Update video elements when stream changes OR when component re-renders
  useEffect(() => {
    // Update first video (status section)
    if (videoRef.current && cameraStream) {
      if (videoRef.current.srcObject !== cameraStream) {
        videoRef.current.srcObject = cameraStream;
        videoRef.current.play().catch(err => console.error('Video play error:', err));
      }
    }

    // Update second video (verification section)
    if (videoRef2.current && cameraStream) {
      if (videoRef2.current.srcObject !== cameraStream) {
        videoRef2.current.srcObject = cameraStream;
        videoRef2.current.play().catch(err => console.error('Video2 play error:', err));
      }
    }
  }, [cameraStream, selectedGuru]); // Re-run when selectedGuru changes to ensure video is attached

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
    // Use videoRef2 if guru is selected (verification section), otherwise videoRef
    const activeVideo = selectedGuru && videoRef2.current ? videoRef2.current : videoRef.current;

    if (!activeVideo || !cameraStream) return null;

    try {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');

      if (ctx && activeVideo) {
        ctx.drawImage(activeVideo, 0, 0, 640, 480);
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
      const photoDataUrl = captureFotoFromStream();
      if (!photoDataUrl) {
        throw new Error('Gagal mengambil foto dari kamera');
      }

      // Upload foto ke server, dapatkan URL
      const uploadRes = await fetch(photoDataUrl);
      const blob = await uploadRes.blob();
      const formData = new FormData();
      formData.append('foto', blob, `presensi-${Date.now()}.jpg`);
      const uploadResult: any = await api.postForm('/api/presensi/upload/foto', formData);

      // Submit presensi dengan URL foto
      const endpoint = mode === 'datang' ? '/api/presensi/guru/datang' : '/api/presensi/guru/pulang';
      const response: any = await api.post(endpoint, {
        guruId: selectedGuru.id,
        latitude: currentLocation.lat,
        longitude: currentLocation.lng,
        fotoUrl: uploadResult.url,
      });

      const now = new Date();
      setSuccessData({
        nama: selectedGuru.nama,
        type: mode,
        time: now.toLocaleTimeString('id-ID', { timeZone: presensiTZ, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
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
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-sm text-[#64748b]">
              <Clock className="w-4 h-4 text-[#1e40af]" />
              <span>Jam Masuk: <span className="font-semibold text-[#0f172a]">07:00</span></span>
              <span className="text-[#e2e8f0]">|</span>
              <span>Jam Pulang: <span className="font-semibold text-[#0f172a]">15:30</span></span>
            </div>
            <div className="flex items-center gap-2 text-sm text-[#64748b]">
              <Users className="w-4 h-4 text-[#1e40af]" />
              <span>Kehadiran: <span className="font-semibold text-[#0f172a]">{attendedCount}/{guruList.length}</span> guru</span>
            </div>
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

      {/* Main Content */}
      <main className="max-w-[1200px] mx-auto p-6">
        {/* Step 1: Identifikasi Diri - Full Width */}
        <div className="mb-6">
          <div className="bg-white p-6 rounded-xl border border-[#e2e8f0] shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <span className="bg-primary text-white h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm">1</span>
              <h2 className="text-lg font-semibold text-[#0f172a]">Identifikasi Diri</h2>
            </div>

            {!selectedGuru ? (
              <div className="relative">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                  <GraduationCap className="w-6 h-6 text-[#64748b]" />
                </div>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onFocus={() => setShowSearchResults(true)}
                  placeholder="Cari Nama Anda atau NIP..."
                  className="w-full pl-14 pr-6 py-4 bg-white border-2 border-[#e2e8f0] rounded-xl text-base focus:border-[#1e40af] focus:ring-4 focus:ring-[#1e40af]/10 transition-all outline-none"
                  autoFocus
                />

                {showSearchResults && search && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-[#e2e8f0] rounded-xl shadow-2xl z-20 max-h-[400px] overflow-y-auto">
                    {filteredGuru.length === 0 ? (
                      <div className="p-4 text-center text-[#64748b] text-sm">Tidak ditemukan</div>
                    ) : (
                      filteredGuru.map((guru) => {
                        const status = guru.statusHariIni;
                        const sudahLengkap = status?.sudahDatang && status?.sudahPulang;

                        return (
                          <div
                            key={guru.id}
                            onClick={() => !sudahLengkap && handleSelectGuru(guru)}
                            className={`p-4 border-b border-[#e2e8f0] last:border-0 transition-colors flex justify-between items-center gap-3 ${
                              sudahLengkap ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'hover:bg-[#f8fafc] cursor-pointer active:bg-[#f1f5f9]'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-[#0f172a] truncate">{guru.nama}</p>
                              <p className="text-xs text-[#64748b]">NIP: {guru.nip}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {status?.sudahDatang && (
                                <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap">
                                  Datang · {status.waktuDatang}
                                </span>
                              )}
                              {status?.sudahPulang && (
                                <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap">
                                  Pulang · {status.waktuPulang}
                                </span>
                              )}
                              {!status?.sudahDatang && (
                                <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs whitespace-nowrap">
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
              <div className="p-4 bg-[#dde1ff] rounded-xl border border-[#1e40af]/20 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="h-12 w-12 rounded-full bg-[#1e40af] flex items-center justify-center shrink-0">
                    <GraduationCap className="w-6 h-6 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-semibold text-[#0f172a] truncate">{selectedGuru.nama}</h3>
                    <p className="text-xs text-[#64748b]">NIP: {selectedGuru.nip}</p>
                  </div>
                </div>
                <button onClick={handleReset} className="text-red-600 font-semibold flex items-center gap-1 hover:underline text-sm shrink-0">
                  <X className="w-4 h-4" /> Batalkan
                </button>
              </div>
            )}
          </div>

          {/* Status Indicators - Below Identification */}
          <div className="grid grid-cols-2 gap-4 mt-4">
            {/* Camera Status */}
            <div className={`p-4 rounded-xl border-2 flex items-center gap-3 ${
              cameraPermission === 'granted'
                ? 'bg-green-50 border-green-500'
                : 'bg-red-50 border-red-500'
            }`}>
              <Camera className={`w-6 h-6 ${
                cameraPermission === 'granted' ? 'text-green-600' : 'text-red-600'
              }`} />
              <div>
                <div className="text-sm font-semibold text-[#0f172a]">Kamera</div>
                <div className={`text-xs font-medium ${
                  cameraPermission === 'granted' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {cameraPermission === 'granted'
                    ? selectedGuru ? 'Siap Mengambil Foto' : 'Aktif Terkini'
                    : cameraPermission === 'denied'
                    ? 'Ditolak - Aktifkan di browser'
                    : 'Menunggu izin...'}
                </div>
              </div>
            </div>

            {/* Location Status */}
            <div className={`p-4 rounded-xl border-2 flex items-center gap-3 ${
              locationPermission === 'granted'
                ? 'bg-green-50 border-green-500'
                : 'bg-red-50 border-red-500'
            }`}>
              <MapPin className={`w-6 h-6 ${
                locationPermission === 'granted' ? 'text-green-600' : 'text-red-600'
              }`} />
              <div>
                <div className="text-sm font-semibold text-[#0f172a]">Lokasi</div>
                <div className={`text-xs font-medium ${
                  locationPermission === 'granted' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {locationPermission === 'granted'
                    ? selectedGuru ? 'Terdeteksi untuk Validasi' : 'Aktif Terkini'
                    : locationPermission === 'denied'
                    ? 'Ditolak - Aktifkan di browser'
                    : 'Menunggu izin...'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Step 2: Verifikasi & Submit (when guru selected) */}
        {selectedGuru && (
          <div className="mb-8">
            <div className="bg-white p-6 rounded-xl border border-[#e2e8f0] shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <span className="bg-primary text-white h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm">2</span>
                <h2 className="text-lg font-semibold text-[#0f172a]">Verifikasi & Submit</h2>
              </div>

              {/* Camera Live Preview */}
              <div className="mb-6">
                <div className="relative bg-black rounded-xl overflow-hidden" style={{ height: '400px' }}>
                  {cameraPermission === 'granted' && cameraStream ? (
                    <>
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 bg-black/70 backdrop-blur-sm rounded-full text-xs text-white font-medium">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        LIVE
                      </div>
                    </>
                  ) : cameraPermission === 'pending' ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 text-gray-300">
                      <div className="w-12 h-12 border-4 border-gray-600 border-t-white rounded-full animate-spin mb-4" />
                      <p className="text-sm">Meminta izin kamera...</p>
                    </div>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-50 text-red-600">
                      <AlertTriangle className="w-16 h-16 mb-4" />
                      <p className="text-base font-semibold mb-2">Kamera Tidak Aktif</p>
                      <button onClick={retryCamera} className="text-sm underline hover:no-underline">
                        Coba Lagi
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Permission Status & Submit Button */}
              <div className="space-y-4">
                {/* Status Indicators Grid */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Camera Status */}
                  <div className={`p-4 rounded-xl border-2 flex items-center gap-3 ${
                    cameraPermission === 'granted'
                      ? 'bg-green-50 border-green-500'
                      : 'bg-red-50 border-red-500'
                  }`}>
                    <Camera className={`w-6 h-6 ${
                      cameraPermission === 'granted' ? 'text-green-600' : 'text-red-600'
                    }`} />
                    <div>
                      <div className="text-sm font-semibold text-[#0f172a]">Kamera</div>
                      <div className={`text-xs font-medium ${
                        cameraPermission === 'granted' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {cameraPermission === 'granted' ? 'Aktif Terkini' : 'Tidak Aktif'}
                      </div>
                    </div>
                  </div>

                  {/* Location Status */}
                  <div className={`p-4 rounded-xl border-2 flex items-center gap-3 ${
                    locationPermission === 'granted'
                      ? 'bg-green-50 border-green-500'
                      : 'bg-red-50 border-red-500'
                  }`}>
                    <MapPin className={`w-6 h-6 ${
                      locationPermission === 'granted' ? 'text-green-600' : 'text-red-600'
                    }`} />
                    <div>
                      <div className="text-sm font-semibold text-[#0f172a]">Lokasi</div>
                      <div className={`text-xs font-medium ${
                        locationPermission === 'granted' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {locationPermission === 'granted' ? 'Aktif Terkini' : 'Tidak Aktif'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Warning if not ready */}
                {!permissionsReady && (
                  <div className="flex items-start gap-3 p-4 bg-orange-50 border-2 border-orange-400 rounded-xl">
                    <AlertTriangle className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
                    <p className="text-sm text-orange-800 leading-snug">
                      Kamera dan lokasi harus aktif sebelum melakukan presensi. Mohon aktifkan izin di browser Anda.
                    </p>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  className={`w-full py-5 rounded-xl text-lg font-bold transition-all flex items-center justify-center gap-3 active:scale-[0.98] ${
                    mode === 'datang'
                      ? 'bg-green-600 text-white hover:bg-green-700 active:bg-green-800 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed'
                  }`}
                >
                  {submitting ? (
                    <>
                      <div className="w-6 h-6 border-4 border-white/40 border-t-white rounded-full animate-spin" />
                      <span>Memproses...</span>
                    </>
                  ) : (
                    <>
                      {mode === 'datang' ? <LogIn className="w-6 h-6" /> : <LogOut className="w-6 h-6" />}
                      TAP {mode.toUpperCase()}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bottom: Activity Table */}
        <section className="mt-12 mb-20 bg-white rounded-xl shadow-[0px_4px_20px_rgba(0,0,0,0.04)] border border-[#e2e8f0] overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-[#f1f5f9] flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-[#0f172a]">Aktivitas Hari Ini</h3>
              <p className="text-xs text-[#64748b] mt-0.5">Rekap kehadiran guru hari ini</p>
            </div>
            <span className="bg-[#dde1ff] text-[#1e40af] px-3 py-1 rounded-full text-xs font-semibold">LIVE</span>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            {recentActivity.length === 0 ? (
              <div className="text-center py-16 text-[#64748b]">
                <GraduationCap className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm font-medium">Belum ada guru yang hadir</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-[#f8fafc] border-b border-[#f1f5f9]">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-[#64748b] uppercase tracking-wider">Nama Guru</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-[#64748b] uppercase tracking-wider">NIP</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-[#64748b] uppercase tracking-wider">Jam Datang</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-[#64748b] uppercase tracking-wider">Jam Pulang</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-[#64748b] uppercase tracking-wider">Total Jam</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-[#64748b] uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9]">
                  {recentActivity.map((activity) => (
                    <tr key={activity.id} className="hover:bg-[#f8fafc] transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-[#dde1ff] rounded-full flex items-center justify-center flex-shrink-0">
                            <GraduationCap className="w-4 h-4 text-[#1e40af]" />
                          </div>
                          <span className="text-sm font-medium text-[#0f172a]">{activity.nama}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-[#64748b]">{activity.nip}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-semibold ${activity.waktuDatang ? 'text-green-600' : 'text-[#c4c5d5]'}`}>
                            {activity.waktuDatang || '--:--'}
                          </span>
                          {activity.keterlambatan > 0 && (
                            <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-[10px] font-semibold">
                              Telat {activity.keterlambatan} Menit
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-semibold ${activity.waktuPulang ? 'text-[#1e40af]' : 'text-[#c4c5d5]'}`}>
                            {activity.waktuPulang || '--:--'}
                          </span>
                          {activity.autoCheckout && (
                            <span className="bg-[#f8fafc] text-[#64748b] px-2 py-0.5 rounded-full text-[10px] font-semibold">
                              Auto
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-[#0f172a]">
                        {activity.totalJam > 0 ? formatMinutesToHours(activity.totalJam) : '--'}
                      </td>
                      <td className="px-6 py-4">
                        {activity.waktuDatang && activity.waktuPulang ? (
                          <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-semibold">
                            Selesai
                          </span>
                        ) : activity.waktuDatang ? (
                          <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-semibold">
                            Hadir
                          </span>
                        ) : (
                          <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs font-semibold">
                            Belum
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#e2e8f0] px-6 py-3">
        <p className="text-center text-[#64748b] text-[11px]">
          © 2026 Sistem Presensi Digital
        </p>
      </footer>

      {/* Success Overlay */}
      {showSuccess && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-8">
          <div className="bg-white rounded-2xl p-10 max-w-md w-full text-center shadow-2xl animate-in fade-in zoom-in duration-300">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-6 mx-auto">
              <CheckCircle className="w-12 h-12" />
            </div>
            <h2 className="text-3xl font-bold text-[#0f172a] mb-3">
              {successData.type === 'datang' ? 'Selamat Datang!' : 'Sampai Jumpa!'}
            </h2>
            <p className="text-[#64748b] mb-2">
              <span className="font-semibold text-xl text-[#1e40af]">{successData.nama}</span>
            </p>
            <p className="text-sm text-[#64748b] mb-6">Presensi {successData.type} berhasil dicatat</p>
            <div className="inline-flex items-center gap-3 px-6 py-3 bg-[#dde1ff] rounded-lg">
              <Clock className="w-5 h-5 text-[#1e40af]" />
              <span className="font-bold text-xl text-[#1e40af]">{successData.time}</span>
            </div>
            {successData.jarak !== undefined && (
              <p className="text-xs text-green-600 font-medium mt-4">
                ✓ Lokasi terverifikasi ({successData.jarak} meter dari sekolah)
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
