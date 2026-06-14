import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck, Star, AlertTriangle, TrendingUp, TrendingDown,
  Search, Home, CalendarCheck, ClipboardList, ChevronDown,
  Loader2, RefreshCw,
} from 'lucide-react';
import api from '../../lib/api';
import { useSiteConfig } from '../../hooks/useSiteConfig';
import SiteFooter from '../../components/SiteFooter';

// ── Types ──────────────────────────────────────────────────────────────────────

interface KelasMeta { id: string; nama: string }

interface SiswaRekap {
  siswaId: string
  nama: string
  nis: string
  kelas: string
  totalKebaikan: number
  totalPelanggaran: number
  neto: number
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function NetoChip({ neto }: { neto: number }) {
  if (neto > 0) return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-50 text-green-700 rounded-lg text-xs font-bold">
      <TrendingUp className="w-3 h-3" /> +{neto}
    </span>
  );
  if (neto < 0) return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-700 rounded-lg text-xs font-bold">
      <TrendingDown className="w-3 h-3" /> {neto}
    </span>
  );
  return <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-surface-container text-on-surface-variant rounded-lg text-xs font-bold">0</span>;
}

// ── Komponen ───────────────────────────────────────────────────────────────────

export default function DashboardPotensi() {
  const cfg        = useSiteConfig();
  const schoolName = cfg.namaSekolah || 'Portal Sekolah';

  const [kelasList, setKelasList]   = useState<KelasMeta[]>([]);
  const [data, setData]             = useState<SiswaRekap[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');

  // Filter state
  const [dari, setDari]             = useState('');
  const [sampai, setSampai]         = useState('');
  const [kelasId, setKelasId]       = useState('');
  const [filter, setFilter]         = useState<'semua' | 'positif' | 'negatif'>('semua');
  const [search, setSearch]         = useState('');

  useEffect(() => {
    api.get('/api/kelas').then((r: any) => setKelasList(Array.isArray(r) ? r : [])).catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (dari)    params.set('dari', dari);
      if (sampai)  params.set('sampai', sampai);
      if (kelasId) params.set('kelasId', kelasId);
      if (filter !== 'semua') params.set('filter', filter);
      const r: any = await api.get(`/api/dashboard/potensi?${params.toString()}`);
      setData(Array.isArray(r) ? r : []);
    } catch {
      setError('Gagal memuat data. Coba lagi.');
    } finally {
      setLoading(false);
    }
  }, [dari, sampai, kelasId, filter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const displayed = data.filter(row =>
    !search || row.nama.toLowerCase().includes(search.toLowerCase()) || row.nis.includes(search)
  );

  const totalPositif    = data.filter(r => r.neto > 0).length;
  const totalNegatif    = data.filter(r => r.neto < 0).length;
  const rerataNeto      = data.length > 0 ? Math.round(data.reduce((s, r) => s + r.neto, 0) / data.length) : 0;
  const topSiswa        = data.length > 0 ? data[0] : null;

  return (
    <div className="min-h-screen bg-background text-on-background flex flex-col">

      {/* ── Navbar ── */}
      <header className="sticky top-0 z-40 bg-surface/90 backdrop-blur border-b border-outline-variant/30 shadow-sm">
        <div className="max-w-screen-xl mx-auto px-4 md:px-8 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {cfg.logoUrl && <img src={cfg.logoUrl} alt={schoolName} className="w-7 h-7 rounded-lg object-contain" />}
            <span className="font-bold text-primary text-sm hidden sm:block">{schoolName}</span>
            <span className="text-outline-variant hidden sm:block">|</span>
            <span className="font-semibold text-on-surface flex items-center gap-1.5 text-sm">
              <ShieldCheck className="w-4 h-4 text-primary" /> Dashboard Potensi
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Link to="/lapor" className="hidden sm:flex items-center gap-1.5 text-sm text-primary font-semibold border border-primary/30 bg-primary/5 px-3 py-1.5 rounded-lg hover:bg-primary/10 transition-colors">
              <ShieldCheck className="w-3.5 h-3.5" /> Lapor
            </Link>
            <span className="text-outline-variant hidden sm:block">|</span>
            <Link to="/" className="flex items-center gap-1.5 text-on-surface-variant hover:text-primary transition-colors font-medium">
              <Home className="w-4 h-4" /> Beranda
            </Link>
            <span className="text-outline-variant">|</span>
            <Link to="/dashboard-publik/kehadiran" className="flex items-center gap-1.5 text-on-surface-variant hover:text-primary transition-colors font-medium">
              <CalendarCheck className="w-4 h-4" /> Kehadiran
            </Link>
            <span className="text-outline-variant">|</span>
            <Link to="/dashboard-publik/tugas" className="flex items-center gap-1.5 text-on-surface-variant hover:text-primary transition-colors font-medium">
              <ClipboardList className="w-4 h-4" /> Tugas
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-screen-xl mx-auto w-full px-4 md:px-8 py-6 space-y-6">

        {/* ── Filter ── */}
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-on-surface-variant">Dari Tanggal</label>
              <input
                type="date"
                value={dari}
                onChange={e => setDari(e.target.value)}
                className="w-full px-3 py-2 border border-outline-variant rounded-xl text-sm focus:border-primary outline-none bg-surface"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-on-surface-variant">Sampai Tanggal</label>
              <input
                type="date"
                value={sampai}
                onChange={e => setSampai(e.target.value)}
                className="w-full px-3 py-2 border border-outline-variant rounded-xl text-sm focus:border-primary outline-none bg-surface"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-on-surface-variant">Kelas</label>
              <select
                value={kelasId}
                onChange={e => setKelasId(e.target.value)}
                className="w-full px-3 py-2 border border-outline-variant rounded-xl text-sm focus:border-primary outline-none bg-surface appearance-none"
              >
                <option value="">Semua Kelas</option>
                {kelasList.map(k => <option key={k.id} value={k.id}>{k.nama}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-on-surface-variant">Filter Neto</label>
              <select
                value={filter}
                onChange={e => setFilter(e.target.value as any)}
                className="w-full px-3 py-2 border border-outline-variant rounded-xl text-sm focus:border-primary outline-none bg-surface appearance-none"
              >
                <option value="semua">Semua</option>
                <option value="positif">Positif (neto &gt; 0)</option>
                <option value="negatif">Negatif (neto &lt; 0)</option>
              </select>
            </div>
          </div>

          {/* Search + Reset */}
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Cari nama atau NIS siswa..."
                className="w-full pl-9 pr-3 py-2 border border-outline-variant rounded-xl text-sm focus:border-primary outline-none bg-surface"
              />
            </div>
            <button
              onClick={() => { setDari(''); setSampai(''); setKelasId(''); setFilter('semua'); setSearch(''); }}
              className="px-4 py-2 border border-outline-variant rounded-xl text-sm font-semibold text-on-surface-variant hover:bg-surface-container transition-colors"
            >
              Reset
            </button>
          </div>
        </div>

        {/* ── Summary Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Siswa',    value: data.length,   color: 'bg-blue-50  text-blue-700',  icon: ShieldCheck },
            { label: 'Poin Positif',   value: totalPositif,  color: 'bg-green-50 text-green-700', icon: TrendingUp },
            { label: 'Poin Negatif',   value: totalNegatif,  color: 'bg-red-50   text-red-700',   icon: TrendingDown },
            { label: 'Rata-rata Neto', value: rerataNeto,    color: 'bg-purple-50 text-purple-700', icon: Star },
          ].map(({ label, value, color, icon: Icon }) => (
            <div key={label} className="bg-surface-container-lowest rounded-2xl border border-outline-variant p-4 space-y-2">
              <div className={`w-9 h-9 rounded-xl ${color} flex items-center justify-center`}>
                <Icon className="w-4.5 h-4.5" />
              </div>
              <p className="text-2xl font-bold text-on-surface">{value}</p>
              <p className="text-xs text-on-surface-variant font-medium">{label}</p>
            </div>
          ))}
        </div>

        {/* ── Top Siswa ── */}
        {topSiswa && (
          <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-2xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center shrink-0">
              <Star className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs font-bold text-primary uppercase tracking-wider">Poin Neto Tertinggi</p>
              <p className="font-bold text-on-surface">{topSiswa.nama} <span className="text-on-surface-variant font-medium">({topSiswa.kelas})</span></p>
              <p className="text-xs text-on-surface-variant">Neto: <strong className="text-green-700">{topSiswa.neto > 0 ? '+' : ''}{topSiswa.neto}</strong> · Kebaikan: {topSiswa.totalKebaikan} · Pelanggaran: {topSiswa.totalPelanggaran}</p>
            </div>
          </div>
        )}

        {/* ── Tabel ── */}
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/30">
            <h3 className="font-bold text-on-surface text-sm">
              Rekapitulasi Potensi Siswa
              {displayed.length !== data.length && <span className="ml-2 text-on-surface-variant font-normal">({displayed.length} dari {data.length})</span>}
            </h3>
            <button
              onClick={fetchData}
              disabled={loading}
              className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors disabled:opacity-50"
              title="Muat ulang"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20 gap-3 text-on-surface-variant">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Memuat data...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <p className="text-sm text-error">{error}</p>
              <button onClick={fetchData} className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors">
                Muat Ulang
              </button>
            </div>
          ) : displayed.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-on-surface-variant">
              <ShieldCheck className="w-10 h-10 opacity-30" />
              <p className="text-sm font-medium">Belum ada data potensi</p>
              <Link to="/lapor" className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors">
                Buat Laporan
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-container">
                    <th className="px-4 py-3 text-left text-xs font-bold text-on-surface-variant uppercase tracking-wider">No</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-on-surface-variant uppercase tracking-wider">Nama Siswa</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-on-surface-variant uppercase tracking-wider">Kelas</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-green-700 uppercase tracking-wider">
                      <span className="flex items-center justify-center gap-1"><Star className="w-3.5 h-3.5" /> Kebaikan</span>
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-red-700 uppercase tracking-wider">
                      <span className="flex items-center justify-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Pelanggaran</span>
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-on-surface-variant uppercase tracking-wider">Neto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/30">
                  {displayed.map((row, i) => (
                    <tr key={row.siswaId} className="hover:bg-surface-container/40 transition-colors">
                      <td className="px-4 py-3.5 text-on-surface-variant font-medium">{i + 1}</td>
                      <td className="px-4 py-3.5">
                        <p className="font-semibold text-on-surface">{row.nama}</p>
                        <p className="text-xs text-on-surface-variant">{row.nis}</p>
                      </td>
                      <td className="px-4 py-3.5 text-on-surface-variant">{row.kelas}</td>
                      <td className="px-4 py-3.5 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-50 text-green-700 rounded-lg text-xs font-bold">
                          <Star className="w-3 h-3" /> {row.totalKebaikan}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-700 rounded-lg text-xs font-bold">
                          <AlertTriangle className="w-3 h-3" /> {row.totalPelanggaran}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <NetoChip neto={row.neto} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
