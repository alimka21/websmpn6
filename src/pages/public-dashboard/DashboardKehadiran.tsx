import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarCheck, Users, AlertTriangle, Clock, CheckCircle,
  Download, RefreshCw, ChevronDown, Home, ShieldCheck, ClipboardList,
  Search,
} from 'lucide-react';
import api from '../../lib/api';
import { useSiteConfig } from '../../hooks/useSiteConfig';
import SiteFooter from '../../components/SiteFooter';

// ── Types ──────────────────────────────────────────────────────────────────────

type FilterMode = 'hari' | 'rentang' | 'semua';

interface SummaryData {
  totalSiswa: number;
  hadir: number;
  sakit: number;
  izin: number;
  alfa: number;
}

interface KehadiranRow {
  siswaId: string;
  nama: string;
  kelas: string;
  hadir: number;
  sakit: number;
  izin: number;
  alfa: number;
  totalHari: number;
  persen: number | null;
}

interface KelasSummary {
  id: string;
  nama: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const today = () => new Date().toISOString().slice(0, 10);

const pctColor = (pct: number | null) => {
  if (pct === null) return 'text-on-surface-variant';
  if (pct >= 90) return 'text-green-600';
  if (pct >= 75) return 'text-yellow-600';
  return 'text-red-600';
};

// ── Komponen utama ─────────────────────────────────────────────────────────────

export default function DashboardKehadiran() {
  const cfg        = useSiteConfig();
  const schoolName = cfg.namaSekolah || 'Portal Sekolah';

  const [mode, setMode]         = useState<FilterMode>('hari');
  const [tanggal, setTanggal]   = useState(today());
  const [dari, setDari]         = useState('');
  const [sampai, setSampai]     = useState('');
  const [kelasId, setKelasId]   = useState('');
  const [search, setSearch]     = useState('');

  const [summary, setSummary]   = useState<SummaryData | null>(null);
  const [rows, setRows]         = useState<KehadiranRow[]>([]);
  const [kelasList, setKelasList] = useState<KelasSummary[]>([]);
  const [loading, setLoading]   = useState(false);
  const [lastFetch, setLastFetch] = useState('');

  // Ambil daftar kelas untuk filter
  useEffect(() => {
    api.get('/api/public/kelas')
      .then((r: any) => setKelasList(Array.isArray(r) ? r : []))
      .catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ mode });
      if (mode === 'hari')    params.set('tanggal', tanggal);
      if (mode === 'rentang') { params.set('dari', dari); params.set('sampai', sampai); }
      if (kelasId)            params.set('kelasId', kelasId);

      const r: any = await api.get(`/api/public/dashboard/kehadiran?${params}`);
      setSummary(r.summary);
      setRows(r.rows || []);
      setLastFetch(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
    } catch {
      setSummary(null);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [mode, tanggal, dari, sampai, kelasId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleExport = async () => {
    const params = new URLSearchParams();
    if (mode === 'hari')    { params.set('dari', tanggal); params.set('sampai', tanggal); }
    if (mode === 'rentang' && dari && sampai) { params.set('dari', dari); params.set('sampai', sampai); }
    if (kelasId) params.set('kelasId', kelasId);
    window.open(`/api/admin/absensi/export?${params}`, '_blank');
  };

  const filteredRows = rows.filter(r =>
    !search || r.nama.toLowerCase().includes(search.toLowerCase()) || r.kelas.toLowerCase().includes(search.toLowerCase())
  );

  const modeLabel: Record<FilterMode, string> = {
    hari: `Hari Ini (${new Date(tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })})`,
    rentang: dari && sampai ? `${dari} s/d ${sampai}` : 'Rentang Tanggal',
    semua: 'Semua Data',
  };

  return (
    <div className="min-h-screen bg-background text-on-background flex flex-col">

      {/* ── Navbar mini ── */}
      <header className="sticky top-0 z-40 bg-surface/90 backdrop-blur border-b border-outline-variant/30 shadow-sm">
        <div className="max-w-screen-xl mx-auto px-4 md:px-8 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {cfg.logoUrl && <img src={cfg.logoUrl} alt={schoolName} className="w-7 h-7 rounded-lg object-contain" />}
            <span className="font-bold text-primary text-sm hidden sm:block">{schoolName}</span>
            <span className="text-outline-variant hidden sm:block">|</span>
            <span className="font-semibold text-on-surface flex items-center gap-1.5 text-sm">
              <CalendarCheck className="w-4 h-4 text-primary" />
              Dashboard Kehadiran
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Link to="/" className="flex items-center gap-1.5 text-on-surface-variant hover:text-primary transition-colors font-medium">
              <Home className="w-4 h-4" /> Beranda
            </Link>
            <span className="text-outline-variant">|</span>
            <Link to="/dashboard-publik/potensi" className="flex items-center gap-1.5 text-on-surface-variant hover:text-primary transition-colors font-medium">
              <ShieldCheck className="w-4 h-4" /> Potensi
            </Link>
            <span className="text-outline-variant">|</span>
            <Link to="/dashboard-publik/tugas" className="flex items-center gap-1.5 text-on-surface-variant hover:text-primary transition-colors font-medium">
              <ClipboardList className="w-4 h-4" /> Tugas
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-screen-xl mx-auto w-full px-4 md:px-8 py-6 space-y-5">

        {/* ── Filter Bar ── */}
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant p-4 space-y-4">
          {/* Mode selector */}
          <div className="flex flex-wrap gap-2">
            {(['hari', 'rentang', 'semua'] as FilterMode[]).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                  mode === m
                    ? 'bg-primary text-white'
                    : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                {m === 'hari' ? 'Hari Ini' : m === 'rentang' ? 'Rentang Tanggal' : 'Semua Data'}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-3 items-end">
            {/* Input tanggal sesuai mode */}
            {mode === 'hari' && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-on-surface-variant">Tanggal</label>
                <input
                  type="date"
                  value={tanggal}
                  onChange={e => setTanggal(e.target.value)}
                  className="px-3 py-2 border border-outline-variant rounded-xl text-sm focus:border-primary outline-none bg-surface"
                />
              </div>
            )}
            {mode === 'rentang' && (
              <>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-on-surface-variant">Dari</label>
                  <input type="date" value={dari} onChange={e => setDari(e.target.value)}
                    className="px-3 py-2 border border-outline-variant rounded-xl text-sm focus:border-primary outline-none bg-surface" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-on-surface-variant">Sampai</label>
                  <input type="date" value={sampai} onChange={e => setSampai(e.target.value)}
                    className="px-3 py-2 border border-outline-variant rounded-xl text-sm focus:border-primary outline-none bg-surface" />
                </div>
              </>
            )}

            {/* Filter kelas */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-on-surface-variant">Kelas</label>
              <div className="relative">
                <select
                  value={kelasId}
                  onChange={e => setKelasId(e.target.value)}
                  className="pl-3 pr-8 py-2 border border-outline-variant rounded-xl text-sm focus:border-primary outline-none bg-surface appearance-none"
                >
                  <option value="">Semua Kelas</option>
                  {kelasList.map(k => (
                    <option key={k.id} value={k.id}>{k.nama}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none" />
              </div>
            </div>

            <button
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Memuat...' : 'Tampilkan'}
            </button>
          </div>
        </div>

        {/* ── Summary Cards ── */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              { label: 'Total Siswa', value: summary.totalSiswa, icon: Users,          color: 'bg-blue-50 text-blue-600' },
              { label: 'Hadir',       value: summary.hadir,      icon: CheckCircle,     color: 'bg-green-50 text-green-600' },
              { label: 'Sakit',       value: summary.sakit,      icon: AlertTriangle,   color: 'bg-yellow-50 text-yellow-600' },
              { label: 'Izin',        value: summary.izin,       icon: Clock,           color: 'bg-blue-50 text-blue-600' },
              { label: 'Alfa',        value: summary.alfa,       icon: AlertTriangle,   color: 'bg-red-50 text-red-600' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-surface-container-lowest rounded-2xl border border-outline-variant p-4 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-on-surface">{value}</p>
                  <p className="text-xs text-on-surface-variant">{label}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Tabel ── */}
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant overflow-hidden">
          {/* Header tabel */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-outline-variant/50">
            <div>
              <h2 className="font-bold text-on-surface text-base">Rekap Kehadiran Siswa</h2>
              <p className="text-xs text-on-surface-variant mt-0.5">{modeLabel[mode]}{lastFetch && ` · Diperbarui ${lastFetch}`}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Cari nama / kelas..."
                  className="pl-9 pr-3 py-2 border border-outline-variant rounded-xl text-sm focus:border-primary outline-none bg-surface w-48"
                />
              </div>
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-3 py-2 border border-outline-variant rounded-xl text-sm font-semibold text-on-surface-variant hover:bg-surface-container transition-colors"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
          </div>

          {loading ? (
            <div className="py-16 flex flex-col items-center gap-3 text-on-surface-variant">
              <RefreshCw className="w-7 h-7 animate-spin" />
              <p className="text-sm">Memuat data kehadiran...</p>
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="py-16 flex flex-col items-center gap-3 text-on-surface-variant">
              <CalendarCheck className="w-10 h-10 opacity-30" />
              <p className="text-sm font-medium">Belum ada data kehadiran</p>
              <p className="text-xs">Coba ubah filter atau pastikan data absensi sudah diinput</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-container/50 text-on-surface-variant text-xs font-semibold uppercase tracking-wide">
                    <th className="px-4 py-3 text-left w-10">No</th>
                    <th className="px-4 py-3 text-left">Nama Siswa</th>
                    <th className="px-4 py-3 text-left">Kelas</th>
                    <th className="px-4 py-3 text-center">Hadir</th>
                    <th className="px-4 py-3 text-center">Sakit</th>
                    <th className="px-4 py-3 text-center">Izin</th>
                    <th className="px-4 py-3 text-center">Alfa</th>
                    <th className="px-4 py-3 text-center">Total Hari</th>
                    <th className="px-4 py-3 text-center">% Kehadiran</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/30">
                  {filteredRows.map((row, idx) => (
                    <tr key={row.siswaId} className="hover:bg-surface-container/40 transition-colors">
                      <td className="px-4 py-3 text-on-surface-variant text-xs">{idx + 1}</td>
                      <td className="px-4 py-3 font-semibold text-on-surface">{row.nama}</td>
                      <td className="px-4 py-3 text-on-surface-variant">{row.kelas}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-semibold text-green-600">{row.hadir}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-semibold ${row.sakit > 0 ? 'text-yellow-600' : 'text-on-surface-variant'}`}>{row.sakit}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-semibold ${row.izin > 0 ? 'text-blue-600' : 'text-on-surface-variant'}`}>{row.izin}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-semibold ${row.alfa > 0 ? 'text-red-600' : 'text-on-surface-variant'}`}>{row.alfa}</span>
                      </td>
                      <td className="px-4 py-3 text-center text-on-surface font-medium">{row.totalHari}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-bold text-base ${pctColor(row.persen)}`}>
                          {row.persen !== null ? `${row.persen}%` : '—'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {filteredRows.length > 0 && (
            <div className="px-5 py-3 border-t border-outline-variant/30 text-xs text-on-surface-variant">
              Menampilkan {filteredRows.length} siswa
            </div>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
