import React, { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { CheckCircle, Home, Clock, GraduationCap, IdCard, RefreshCw, Timer, User, LogIn } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useSiteConfig } from '../hooks/useSiteConfig';

const RFID_SPEED_MS = 50;
const RFID_MIN_LEN  = 4;

interface Siswa {
  id: string;
  nama: string;
  nis: string;
  kelas: string;
}

interface SiswaRow {
  id: string;
  nama: string;
  nis: string;
  kelas: string;
  kelasId: string;
  hadir: boolean;
  waktu?: string;
  tepatWaktu?: boolean;
  keterlambatan?: number;
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
  const navigate = useNavigate();

  useEffect(() => {
    if (!sessionStorage.getItem('presensi_siswa_ok')) {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  // ── Waktu ─────────────────────────────────────────────────────────────────
  const [currentTime, setCurrentTime] = useState(new Date());
  const [serverOffset, setServerOffset] = useState(0);
  const [presensiTZ, setPresensiTZ]     = useState('Asia/Makassar');

  // ── Input/Search state ────────────────────────────────────────────────────
  const [nis, setNis]             = useState('');
  const [siswa, setSiswa]         = useState<Siswa | null>(null);
  const [loading, setLoading]     = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // ── Success modal ─────────────────────────────────────────────────────────
  const [showSuccess, setShowSuccess] = useState(false);
  const [successData, setSuccessData] = useState<{ nama: string; kelas: string; time: string }>({ nama: '', kelas: '', time: '' });

  // ── Data tabel ────────────────────────────────────────────────────────────
  const [hadirList, setHadirList]           = useState<SiswaRow[]>([]);
  const [belumHadirList, setBelumHadirList] = useState<SiswaRow[]>([]);
  const [kelasList, setKelasList]           = useState<KelasSummary[]>([]);
  const [totalSiswa, setTotalSiswa]         = useState(0);
  const [loadingList, setLoadingList]       = useState(false);

  // ── Filter ────────────────────────────────────────────────────────────────
  const [filterKelas, setFilterKelas]   = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<'semua' | 'hadir' | 'belum_hadir'>('semua');

  // ── RFID refs ─────────────────────────────────────────────────────────────
  const inputRef       = useRef<HTMLInputElement>(null);
  const lastKeyTimeRef = useRef<number>(0);
  const rfidSpeedRef   = useRef<number>(0);
  const isRfidModeRef  = useRef<boolean>(false);

  // ── Sinkronisasi waktu server ─────────────────────────────────────────────
  useEffect(() => {
    api.get('/api/presensi/server-time').then((d: any) => {
      if (d?.timestamp) setServerOffset(d.timestamp - Date.now());
      if (d?.timezone)  setPresensiTZ(d.timezone);
    }).catch(() => {});
    const timer = setInterval(() => setCurrentTime(new Date(Date.now() + serverOffset)), 1000);
    return () => clearInterval(timer);
  }, [serverOffset]);

  // ── Load semua data (hadir + belum + kelas) ───────────────────────────────
  const loadAllData = useCallback(async () => {
    setLoadingList(true);
    try {
      const [recentData, statsData, belumData] = await Promise.all([
        api.get('/api/presensi/siswa/recent?limit=500'),
        api.get('/api/presensi/siswa/stats'),
        api.get('/api/presensi/siswa/belum-hadir'),
      ]);

      setHadirList((recentData as any[]).map(a => ({
        id:             a.id,
        nama:           a.nama,
        nis:            a.nis,
        kelas:          a.kelas,
        kelasId:        a.kelasId,
        hadir:          true,
        waktu:          a.waktu,
        tepatWaktu:     a.tepatWaktu,
        keterlambatan:  a.keterlambatan,
      })));

      setBelumHadirList((belumData as any[]).map(s => ({
        id:      s.id,
        nama:    s.nama,
        nis:     s.nis,
        kelas:   s.kelas,
        kelasId: s.kelasId,
        hadir:   false,
      })));

      setKelasList(statsData.kelasSummary || []);
      setTotalSiswa(statsData.totalSiswa || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();
    inputRef.current?.focus();
  }, [loadAllData]);

  // ── Stats turunan ─────────────────────────────────────────────────────────
  const hadirCount = hadirList.length;
  const belumCount = belumHadirList.length;

  const selectedKelasData = filterKelas !== 'ALL' ? kelasList.find(k => k.id === filterKelas) : null;
  const displayTotal  = selectedKelasData ? selectedKelasData.totalSiswa  : totalSiswa;
  const displayHadir  = selectedKelasData ? selectedKelasData.hadirCount  : hadirCount;
  const displayBelum  = displayTotal - displayHadir;

  // ── Baris yang ditampilkan (setelah filter) ───────────────────────────────
  const allRows: SiswaRow[] = [...hadirList, ...belumHadirList];

  const filteredRows = allRows.filter(r => {
    const kelasMatch  = filterKelas === 'ALL' || r.kelasId === filterKelas;
    const statusMatch = filterStatus === 'semua'
      || (filterStatus === 'hadir'       && r.hadir)
      || (filterStatus === 'belum_hadir' && !r.hadir);
    return kelasMatch && statusMatch;
  });

  // ── Submit presensi ───────────────────────────────────────────────────────
  const handleSubmit = useCallback(async (siswaData: Siswa) => {
    setSubmitting(true);
    try {
      const result = await api.post('/api/presensi/siswa', { siswaId: siswaData.id });
      const serverTs = new Date(result.waktuDatang);
      setSuccessData({
        nama:  siswaData.nama,
        kelas: siswaData.kelas,
        time:  serverTs.toLocaleTimeString('id-ID', { timeZone: presensiTZ, hour: '2-digit', minute: '2-digit' }),
      });
      setShowSuccess(true);
      setSiswa(null);
      setNis('');
      rfidSpeedRef.current  = 0;
      isRfidModeRef.current = false;
      setTimeout(() => {
        setShowSuccess(false);
        loadAllData();
        inputRef.current?.focus();
      }, 3000);
    } catch (err: any) {
      toast.error(err?.message || 'Gagal mencatat presensi');
    } finally {
      setSubmitting(false);
    }
  }, [presensiTZ, loadAllData]);

  // ── Cari siswa ────────────────────────────────────────────────────────────
  const handleSearch = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = nis.trim();
    if (!q) { toast.error('Masukkan NIS atau kode RFID terlebih dahulu'); return; }

    setLoading(true);
    setSiswa(null);
    try {
      const data: Siswa = await api.get(`/api/presensi/siswa/cari?q=${encodeURIComponent(q)}`);
      if (isRfidModeRef.current) {
        isRfidModeRef.current = false;
        await handleSubmit(data);
      } else {
        setSiswa(data);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Siswa tidak ditemukan');
      setSiswa(null);
    } finally {
      setLoading(false);
    }
  }, [nis, handleSubmit]);

  const handleNisChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setNis(val);
    setSiswa(null);
    const now   = Date.now();
    const delta = now - lastKeyTimeRef.current;
    lastKeyTimeRef.current = now;
    if (delta < RFID_SPEED_MS) rfidSpeedRef.current += 1;
    else rfidSpeedRef.current = 1;
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter') return;
    if (!siswa) handleSearch();
    else handleSubmit(siswa);
  };

  // Auto-submit RFID setelah 150ms berhenti
  useEffect(() => {
    if (!nis || siswa || loading) return;
    const timer = setTimeout(() => {
      if (rfidSpeedRef.current >= RFID_MIN_LEN && nis.length >= RFID_MIN_LEN) {
        isRfidModeRef.current = true;
        handleSearch();
      }
      rfidSpeedRef.current = 0;
    }, 150);
    return () => clearTimeout(timer);
  }, [nis, siswa, loading, handleSearch]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f8fafc] font-[Inter]">

      {/* ── Header ── */}
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
              <p className="text-xs text-[#64748b] uppercase tracking-wider font-medium">Presensi Siswa</p>
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
            <Link to="/" className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-[#e2e8f0] text-[#1e40af] hover:bg-[#f8fafc] transition-all">
              <Home className="w-5 h-5" />
              <span className="font-medium text-sm">Beranda</span>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Stats Bar ── */}
      <div className="bg-white border-b border-[#e2e8f0] px-6 py-3">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-sm text-[#64748b]">
              <User className="w-4 h-4" />
              <span>Total Siswa: <span className="font-semibold text-[#0f172a]">{totalSiswa}</span></span>
            </div>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
              {hadirCount} Hadir
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
              {belumCount} Belum Hadir
            </span>
          </div>
          <div className="flex items-center gap-2 text-[#1e40af] font-semibold text-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#1e40af] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#1e40af]" />
            </span>
            <span>LIVE</span>
          </div>
        </div>
      </div>

      {/* ── Success Modal ── */}
      {showSuccess && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-8">
          <div className="bg-white rounded-2xl p-10 max-w-md w-full text-center shadow-2xl animate-in fade-in zoom-in duration-300">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-6 mx-auto">
              <CheckCircle className="w-12 h-12" />
            </div>
            <h2 className="text-3xl font-bold text-[#0f172a] mb-3">Selamat Datang!</h2>
            <p className="mb-2">
              <span className="font-semibold text-xl text-[#1e40af]">{successData.nama}</span>
            </p>
            <p className="text-sm text-[#64748b] mb-4">{successData.kelas}</p>
            <div className="inline-flex items-center gap-3 px-6 py-3 bg-[#dde1ff] rounded-lg">
              <Clock className="w-5 h-5 text-[#1e40af]" />
              <span className="font-bold text-xl text-[#1e40af]">{successData.time}</span>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-[1400px] mx-auto px-6 py-8 space-y-6">

        {/* ── Kotak Scan — tengah ── */}
        <div className="flex justify-center">
          <div className="w-full max-w-[560px] bg-white rounded-3xl p-8 shadow-[0px_4px_20px_rgba(0,0,0,0.06)] border border-[#e2e8f0] space-y-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 border-2 border-dashed border-[#c4c5d5] rounded-xl flex items-center justify-center bg-[#f8fafc] flex-shrink-0">
                <IdCard className="w-6 h-6 text-[#64748b]" />
              </div>
              <div>
                <h2 className="font-bold text-[#0f172a]">Scan RFID atau Masukkan NIS</h2>
                <p className="text-xs text-[#64748b]">Tempelkan kartu ke scanner, atau ketik NIS lalu Enter.</p>
              </div>
            </div>

            <form onSubmit={handleSearch}>
              <input
                ref={inputRef}
                type="text"
                value={nis}
                onChange={handleNisChange}
                onKeyPress={handleKeyPress}
                placeholder="NIS atau Kode RFID..."
                className="w-full px-5 py-3.5 text-lg text-center border-2 border-[#e2e8f0] bg-white rounded-xl focus:border-[#1e40af] focus:ring-4 focus:ring-[#1e40af]/10 outline-none transition-all placeholder:text-[#c4c5d5] disabled:bg-[#f8fafc]"
                disabled={loading || submitting}
              />
            </form>

            {siswa ? (
              <div className="space-y-3">
                <div className="bg-[#dde1ff] border border-[#1e40af]/20 rounded-xl p-4 flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#1e40af] rounded-full flex items-center justify-center text-white flex-shrink-0">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-semibold text-[#0f172a]">{siswa.nama}</div>
                    <div className="text-xs text-[#64748b]">{siswa.kelas} • NIS: {siswa.nis}</div>
                  </div>
                </div>
                <button
                  onClick={() => handleSubmit(siswa)}
                  disabled={submitting}
                  className="w-full py-3 bg-[#1e40af] text-white rounded-xl hover:bg-[#1e3a8a] disabled:opacity-50 font-semibold transition-all"
                >
                  {submitting ? 'Menyimpan...' : 'Absen Sekarang'}
                </button>
              </div>
            ) : (
              <p className="text-xs text-center text-[#94a3b8] flex items-center justify-center gap-1.5">
                <LogIn className="w-3.5 h-3.5" />
                Tap kartu RFID atau ketik NIS lalu tekan Enter
              </p>
            )}
          </div>
        </div>

        {/* ── Statistik di bawah kotak scan ── */}
        <div className="grid grid-cols-3 gap-4 max-w-[560px] mx-auto">
          <div className="bg-white rounded-2xl p-4 text-center shadow-sm border border-[#e2e8f0]">
            <div className="text-3xl font-bold text-green-600">{hadirCount}</div>
            <div className="text-xs text-[#64748b] font-semibold uppercase mt-1">Hadir</div>
          </div>
          <div className="bg-white rounded-2xl p-4 text-center shadow-sm border border-[#e2e8f0]">
            <div className="text-3xl font-bold text-red-500">{belumCount}</div>
            <div className="text-xs text-[#64748b] font-semibold uppercase mt-1">Belum Hadir</div>
          </div>
          <div className="bg-white rounded-2xl p-4 text-center shadow-sm border border-[#e2e8f0]">
            <div className="text-3xl font-bold text-[#1e40af]">{totalSiswa}</div>
            <div className="text-xs text-[#64748b] font-semibold uppercase mt-1">Total Siswa</div>
          </div>
        </div>

        {/* ── Tabel Rekap ── */}
        <section className="bg-white rounded-2xl shadow-[0px_4px_20px_rgba(0,0,0,0.04)] border border-[#e2e8f0] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#f1f5f9] flex items-center justify-between gap-4 flex-wrap">
            <h3 className="text-base font-bold text-[#0f172a]">Rekap Presensi Siswa Hari Ini</h3>
            <div className="flex items-center gap-3 flex-wrap">

              {/* Filter Kelas */}
              <select
                value={filterKelas}
                onChange={e => setFilterKelas(e.target.value)}
                className="px-3 py-1.5 text-xs font-semibold border border-[#e2e8f0] rounded-lg bg-white text-[#0f172a] focus:border-[#1e40af] outline-none"
              >
                <option value="ALL">Semua Kelas</option>
                {kelasList.map(k => (
                  <option key={k.id} value={k.id}>{k.nama} ({k.hadirCount}/{k.totalSiswa})</option>
                ))}
              </select>

              {/* Filter Status */}
              <div className="flex rounded-lg border border-[#e2e8f0] overflow-hidden text-xs font-semibold">
                {([
                  { key: 'semua',       label: `Semua (${displayTotal})` },
                  { key: 'hadir',       label: `Hadir (${displayHadir})` },
                  { key: 'belum_hadir', label: `Belum Hadir (${displayBelum})` },
                ] as const).map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => setFilterStatus(opt.key)}
                    className={`px-3 py-1.5 transition-colors ${
                      filterStatus === opt.key
                        ? opt.key === 'belum_hadir' ? 'bg-red-500 text-white'
                          : opt.key === 'hadir'     ? 'bg-green-500 text-white'
                          :                           'bg-[#1e40af] text-white'
                        : 'bg-white text-[#64748b] hover:bg-[#f8fafc]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <button
                onClick={loadAllData}
                disabled={loadingList}
                className="flex items-center gap-1.5 text-xs text-[#1e40af] hover:text-[#1e3a8a] disabled:opacity-50 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingList ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm table-fixed">
              <colgroup>
                <col className="w-10" />
                <col className="w-64" />
                <col className="w-32" />
                <col className="w-28" />
                <col className="w-36" />
                <col className="w-28" />
              </colgroup>
              <thead>
                <tr className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                  <th className="px-4 py-3 text-center text-xs font-semibold text-[#64748b] uppercase tracking-wide">No</th>
                  <th className="px-4 py-3 text-left   text-xs font-semibold text-[#64748b] uppercase tracking-wide">Nama Siswa</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-[#64748b] uppercase tracking-wide">Kelas</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-[#64748b] uppercase tracking-wide">Jam Masuk</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-[#64748b] uppercase tracking-wide">Keterlambatan</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-[#64748b] uppercase tracking-wide">Status</th>
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
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-[#64748b]">
                      <GraduationCap className="w-10 h-10 mx-auto mb-2 opacity-20" />
                      <p className="text-sm">
                        {filterStatus === 'hadir'       ? 'Belum ada siswa yang hadir' :
                         filterStatus === 'belum_hadir' ? 'Semua siswa sudah hadir' :
                         'Tidak ada data siswa'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row, idx) => (
                    <tr key={row.id} className={`hover:bg-[#f8fafc] transition-colors ${!row.hadir ? 'opacity-60' : ''}`}>
                      <td className="px-4 py-3 text-center text-xs text-[#64748b]">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${row.hadir ? 'bg-[#dde1ff]' : 'bg-red-50'}`}>
                            <GraduationCap className={`w-4 h-4 ${row.hadir ? 'text-[#1e40af]' : 'text-red-400'}`} />
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-[#0f172a] truncate">{row.nama}</div>
                            <div className="text-xs text-[#64748b]">NIS: {row.nis}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-[#64748b] font-medium">{row.kelas}</td>
                      <td className="px-4 py-3 text-center">
                        {row.waktu
                          ? <span className="font-semibold text-green-700">{row.waktu}</span>
                          : <span className="text-[#c4c5d5]">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {row.hadir ? (
                          row.keterlambatan && row.keterlambatan > 0
                            ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                                <Timer className="w-3 h-3" />{row.keterlambatan} menit
                              </span>
                            : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">Tepat Waktu</span>
                        ) : <span className="text-[#c4c5d5]">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {row.hadir
                          ? <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700"><LogIn className="w-3 h-3" />Hadir</span>
                          : <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">Belum Hadir</span>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {allRows.length > 0 && (
            <div className="px-6 py-3 border-t border-[#f1f5f9] bg-[#f8fafc] flex items-center gap-4 text-xs text-[#64748b]">
              <span>Total: <strong className="text-[#0f172a]">{totalSiswa}</strong> siswa</span>
              <span className="text-green-600 font-semibold">{hadirCount} hadir</span>
              <span className="text-red-600 font-semibold">{belumCount} belum hadir</span>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
