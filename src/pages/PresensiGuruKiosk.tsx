import React, { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { CheckCircle, Home, GraduationCap, Clock, Users, IdCard, LogIn, LogOut, ArrowRight, RefreshCw } from 'lucide-react';
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

// USB HID RFID reader mengetik sangat cepat; threshold antar karakter < 50ms
const RFID_SPEED_MS = 50;
const RFID_MIN_LEN  = 4;

function hitungTotalJam(masuk?: string, pulang?: string): string {
  if (!masuk || !pulang) return '-';
  const [mH, mM] = masuk.split(':').map(Number);
  const [pH, pM] = pulang.split(':').map(Number);
  const totalMenit = (pH * 60 + pM) - (mH * 60 + mM);
  if (totalMenit <= 0) return '-';
  const jam = Math.floor(totalMenit / 60);
  const menit = totalMenit % 60;
  return jam > 0 ? `${jam}j ${menit}m` : `${menit}m`;
}

export default function PresensiGuruKiosk() {
  const cfg        = useSiteConfig();
  const schoolName = cfg.namaSekolah || 'Portal Sekolah';
  const navigate   = useNavigate();

  useEffect(() => {
    if (!sessionStorage.getItem('presensi_guru_ok')) navigate('/', { replace: true });
  }, [navigate]);

  const [currentTime, setCurrentTime] = useState(new Date());
  const [presensiTZ, setPresensiTZ]   = useState('Asia/Jakarta');
  const [nip, setNip]                 = useState('');
  const [guru, setGuru]               = useState<GuruInfo | null>(null);
  const [loading, setLoading]         = useState(false);
  const [submitting, setSubmitting]   = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successData, setSuccessData] = useState<{ nama: string; type: 'datang' | 'pulang'; time: string }>({
    nama: '', type: 'datang', time: '',
  });
  const [guruList, setGuruList]       = useState<GuruInfo[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  const inputRef       = useRef<HTMLInputElement>(null);
  const lastKeyTimeRef = useRef<number>(0);
  const rfidSpeedRef   = useRef<number>(0);
  const isRfidModeRef  = useRef<boolean>(false);

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    api.get('/api/presensi/pengaturan').then((d: any) => {
      if (d?.timezone) setPresensiTZ(d.timezone);
    }).catch(() => {});
    loadGuruList();
    inputRef.current?.focus();
  }, []);

  const loadGuruList = async () => {
    setLoadingList(true);
    try {
      const data = await api.get('/api/presensi/guru-list');
      setGuruList(data);
    } catch { /* silent */ }
    finally { setLoadingList(false); }
  };

  const hadirCount  = guruList.filter(g => g.statusHariIni.sudahDatang).length;
  const totalGuru   = guruList.length;

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
        rfidSpeedRef.current  = 0;
        isRfidModeRef.current = false;
        loadGuruList();
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
    if (guru) doSubmit(guru);
    else doSearch(nip);
  };

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
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-sm text-[#64748b]">
              <Users className="w-4 h-4 text-[#1e40af]" />
              <span>Total Guru: <span className="font-semibold text-[#0f172a]">{totalGuru}</span></span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                {hadirCount} Hadir
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                {Math.max(0, totalGuru - hadirCount)} Belum Hadir
              </span>
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

      <main className="max-w-[1400px] mx-auto px-6 py-8 space-y-8">

        {/* ── Scan Card (tengah) ── */}
        <div className="flex justify-center">
          <div className="w-full max-w-[560px] bg-white rounded-3xl p-8 shadow-[0px_4px_20px_rgba(0,0,0,0.06)] border border-[#e2e8f0]">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 border-2 border-dashed border-[#c4c5d5] rounded-xl flex items-center justify-center bg-[#f8fafc] flex-shrink-0">
                <IdCard className="w-7 h-7 text-[#64748b]" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-[#0f172a]">Scan RFID atau Masukkan NIP</h2>
                <p className="text-sm text-[#64748b]">Tempelkan kartu ke scanner, atau ketik NIP lalu Enter.</p>
              </div>
            </div>

            {/* Input */}
            <form onSubmit={e => { e.preventDefault(); guru ? doSubmit(guru) : doSearch(nip); }} className="mb-4">
              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={nip}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder="NIP atau Kode RFID..."
                  className="w-full px-5 py-3.5 text-lg text-center border-2 border-[#e2e8f0] bg-white rounded-xl focus:border-[#1e40af] focus:ring-4 focus:ring-[#1e40af]/10 outline-none transition-all placeholder:text-[#c4c5d5]"
                  disabled={loading || submitting}
                  autoFocus
                />
                {nip && !guru && (
                  <button
                    type="button"
                    onClick={() => doSearch(nip)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#1e40af] hover:text-[#1e3a8a]"
                  >
                    <ArrowRight className="w-5 h-5" />
                  </button>
                )}
              </div>
            </form>

            {/* Guru Card + Absen Button */}
            {guru ? (
              <div className="space-y-3">
                <div className={`border rounded-xl p-4 ${
                  mode === 'datang' ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'
                }`}>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-11 h-11 bg-[#1e40af] rounded-full flex items-center justify-center text-white flex-shrink-0">
                      <GraduationCap className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-[#0f172a] truncate">{guru.nama}</h3>
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
                  className={`w-full py-3.5 text-white rounded-xl disabled:opacity-50 font-semibold text-base transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 ${
                    mode === 'datang' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    <>
                      {mode === 'datang' ? <LogIn className="w-4 h-4" /> : <LogOut className="w-4 h-4" />}
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
                className="w-full py-3.5 bg-[#1e40af] text-white rounded-xl hover:bg-[#1e3a8a] disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-base transition-all shadow-md"
              >
                {loading ? 'Mencari...' : 'Cari & Absen'}
              </button>
            )}
          </div>
        </div>

        {/* ── Tabel Rekap Presensi Hari Ini ── */}
        <section className="bg-white rounded-2xl shadow-[0px_4px_20px_rgba(0,0,0,0.04)] border border-[#e2e8f0] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#f1f5f9] flex items-center justify-between">
            <h3 className="text-base font-bold text-[#0f172a]">Rekap Presensi Guru Hari Ini</h3>
            <button
              onClick={loadGuruList}
              disabled={loadingList}
              className="flex items-center gap-1.5 text-xs text-[#1e40af] hover:text-[#1e3a8a] disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingList ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748b] uppercase tracking-wide w-10">No</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748b] uppercase tracking-wide">Nama Guru</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-[#64748b] uppercase tracking-wide w-32">Jam Datang</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-[#64748b] uppercase tracking-wide w-32">Jam Pulang</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-[#64748b] uppercase tracking-wide w-28">Total Jam</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-[#64748b] uppercase tracking-wide w-28">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f5f9]">
                {loadingList ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-[#64748b]">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-[#1e40af]/30 border-t-[#1e40af] rounded-full animate-spin" />
                        <span className="text-sm">Memuat data...</span>
                      </div>
                    </td>
                  </tr>
                ) : guruList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-[#64748b]">
                      <GraduationCap className="w-10 h-10 mx-auto mb-2 opacity-20" />
                      <p className="text-sm">Tidak ada data guru</p>
                    </td>
                  </tr>
                ) : (
                  guruList.map((g, idx) => {
                    const status = g.statusHariIni ?? { sudahDatang: false, sudahPulang: false };
                    const { sudahDatang, sudahPulang, waktuDatang, waktuPulang } = status;
                    const totalJam = hitungTotalJam(waktuDatang, waktuPulang);
                    return (
                      <tr
                        key={g.id}
                        className={`hover:bg-[#f8fafc] transition-colors ${
                          sudahDatang ? '' : 'opacity-60'
                        }`}
                      >
                        <td className="px-4 py-3 text-[#64748b] text-center text-xs">{idx + 1}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-[#dde1ff] rounded-full flex items-center justify-center flex-shrink-0">
                              <GraduationCap className="w-4 h-4 text-[#1e40af]" />
                            </div>
                            <div>
                              <div className="font-medium text-[#0f172a]">{g.nama}</div>
                              <div className="text-xs text-[#64748b]">NIP: {g.nip}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {waktuDatang ? (
                            <span className="font-semibold text-green-700">{waktuDatang}</span>
                          ) : (
                            <span className="text-[#c4c5d5]">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {waktuPulang ? (
                            <span className="font-semibold text-blue-700">{waktuPulang}</span>
                          ) : (
                            <span className="text-[#c4c5d5]">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {totalJam !== '-' ? (
                            <span className="text-[#0f172a] font-medium">{totalJam}</span>
                          ) : (
                            <span className="text-[#c4c5d5]">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {sudahPulang ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                              Pulang
                            </span>
                          ) : sudahDatang ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                              Hadir
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                              Belum Hadir
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {guruList.length > 0 && (
            <div className="px-6 py-3 border-t border-[#f1f5f9] bg-[#f8fafc] flex items-center gap-4 text-xs text-[#64748b]">
              <span>Total: <strong className="text-[#0f172a]">{totalGuru}</strong> guru</span>
              <span className="text-green-600 font-semibold">{hadirCount} hadir</span>
              <span className="text-red-600 font-semibold">{Math.max(0, totalGuru - hadirCount)} belum hadir</span>
            </div>
          )}
        </section>
      </main>

      <footer className="py-4 text-center text-[#64748b] text-[11px]">
        © 2026 Sistem Presensi Digital
      </footer>
    </div>
  );
}
