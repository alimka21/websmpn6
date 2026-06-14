import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ClipboardList, Download, Home, CalendarCheck, ShieldCheck,
  Loader2, RefreshCw, Search, AlertCircle, ChevronDown,
} from 'lucide-react';
import api from '../../lib/api';
import { useSiteConfig } from '../../hooks/useSiteConfig';
import SiteFooter from '../../components/SiteFooter';

// ── Types ──────────────────────────────────────────────────────────────────────

interface KelasMeta { id: string; nama: string }

interface ColMeta {
  colKey: string; judul: string; jenis: string;
  materi: string; mataPelajaran: string; guruNama: string; sumber: 'ujian' | 'manual';
}

interface RowData {
  siswaId: string; nama: string; nis: string; kelas: string;
  nilai: Record<string, number | null>;
  keterangan: 'Lengkap' | 'Kurang Lengkap';
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function nilaiColor(n: number | null): string {
  if (n === null) return 'text-on-surface-variant';
  if (n >= 75)   return 'text-green-700 font-bold';
  if (n >= 60)   return 'text-amber-700 font-bold';
  return 'text-red-700 font-bold';
}

// ── Komponen ───────────────────────────────────────────────────────────────────

export default function DashboardTugas() {
  const cfg        = useSiteConfig();
  const schoolName = cfg.namaSekolah || 'Portal Sekolah';

  const [kelasList, setKelasList]         = useState<KelasMeta[]>([]);
  const [mapelList, setMapelList]         = useState<string[]>([]);
  const [columns, setColumns]             = useState<ColMeta[]>([]);
  const [rows, setRows]                   = useState<RowData[]>([]);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState('');
  const [exporting, setExporting]         = useState(false);

  const [kelasId, setKelasId]             = useState('');
  const [mataPelajaran, setMataPelajaran] = useState('');
  const [filter, setFilter]               = useState<'semua' | 'lengkap' | 'kurang'>('semua');
  const [search, setSearch]               = useState('');

  useEffect(() => {
    api.get('/api/kelas').then((r: any) => setKelasList(Array.isArray(r) ? r : [])).catch(() => {});
  }, []);

  // Load mata pelajaran saat kelas berubah
  useEffect(() => {
    setMapelList([]); setMataPelajaran('');
    if (!kelasId) return;
    api.get(`/api/dashboard/tugas/mata-pelajaran?kelasId=${kelasId}`)
      .then((r: any) => setMapelList(Array.isArray(r) ? r : []))
      .catch(() => {});
  }, [kelasId]);

  const fetchData = useCallback(async () => {
    if (!kelasId) { setColumns([]); setRows([]); return; }
    setLoading(true); setError('');
    try {
      const p = new URLSearchParams({ kelasId });
      if (mataPelajaran) p.set('mataPelajaran', mataPelajaran);
      if (filter !== 'semua') p.set('filter', filter);
      const r: any = await api.get(`/api/dashboard/tugas?${p.toString()}`);
      setColumns(r.columns || []);
      setRows(r.rows || []);
    } catch { setError('Gagal memuat data. Coba lagi.'); }
    finally { setLoading(false); }
  }, [kelasId, mataPelajaran, filter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const displayed = rows.filter(r =>
    !search || r.nama.toLowerCase().includes(search.toLowerCase()) || r.nis.includes(search)
  );

  const handleExportExcel = async () => {
    if (!kelasId) return;
    setExporting(true);
    try {
      const p = new URLSearchParams({ kelasId });
      if (mataPelajaran) p.set('mataPelajaran', mataPelajaran);
      if (filter !== 'semua') p.set('filter', filter);
      const blob = await api.getBlob(`/api/dashboard/tugas/export-excel?${p.toString()}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url;
      a.download = `rekap-nilai-${kelasList.find(k => k.id === kelasId)?.nama || 'kelas'}.xlsx`;
      a.click(); URL.revokeObjectURL(url);
    } catch { /* toast dari caller */ }
    finally { setExporting(false); }
  };

  const totalLengkap = rows.filter(r => r.keterangan === 'Lengkap').length;

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
              <ClipboardList className="w-4 h-4 text-primary" /> Dashboard Tugas & Nilai
            </span>
          </div>
          <Link to="/" className="flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-primary transition-colors font-medium">
            <Home className="w-4 h-4" /> Beranda
          </Link>
        </div>

        {/* Mini nav */}
        <div className="border-t border-outline-variant/20 bg-surface/50">
          <div className="max-w-screen-xl mx-auto px-4 md:px-8 flex gap-1 overflow-x-auto py-1.5">
            {[
              { to: '/dashboard-publik/kehadiran', icon: CalendarCheck, label: 'Kehadiran' },
              { to: '/dashboard-publik/potensi',   icon: ShieldCheck,   label: 'Potensi' },
              { to: '/dashboard-publik/tugas',     icon: ClipboardList, label: 'Tugas & Nilai', active: true },
            ].map(({ to, icon: Icon, label, active }) => (
              <Link key={to} to={to}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${active ? 'bg-primary/10 text-primary' : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'}`}
              >
                <Icon className="w-3.5 h-3.5" /> {label}
              </Link>
            ))}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-screen-xl mx-auto w-full px-4 md:px-8 py-6 space-y-5">

        {/* ── Filter ── */}
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-on-surface-variant">Kelas <span className="text-error">*</span></label>
              <div className="relative">
                <select value={kelasId} onChange={e => setKelasId(e.target.value)}
                  className="w-full px-3 py-2 border border-outline-variant rounded-xl text-sm focus:border-primary outline-none bg-surface appearance-none">
                  <option value="">-- Pilih Kelas --</option>
                  {kelasList.map(k => <option key={k.id} value={k.id}>{k.nama}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-on-surface-variant">Mata Pelajaran</label>
              <div className="relative">
                <select value={mataPelajaran} onChange={e => setMataPelajaran(e.target.value)}
                  disabled={!kelasId}
                  className="w-full px-3 py-2 border border-outline-variant rounded-xl text-sm focus:border-primary outline-none bg-surface appearance-none disabled:opacity-50">
                  <option value="">Semua Mapel</option>
                  {mapelList.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-on-surface-variant">Tampilkan</label>
              <div className="relative">
                <select value={filter} onChange={e => setFilter(e.target.value as any)}
                  className="w-full px-3 py-2 border border-outline-variant rounded-xl text-sm focus:border-primary outline-none bg-surface appearance-none">
                  <option value="semua">Semua Siswa</option>
                  <option value="lengkap">Lengkap</option>
                  <option value="kurang">Kurang Lengkap</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-on-surface-variant">Cari Siswa</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
                <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Nama / NIS..."
                  className="w-full pl-9 pr-3 py-2 border border-outline-variant rounded-xl text-sm focus:border-primary outline-none bg-surface" />
              </div>
            </div>
          </div>

          {kelasId && rows.length > 0 && (
            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-on-surface-variant">
                {totalLengkap} dari {rows.length} siswa lengkap
                <span className="ml-2 inline-block w-20 h-1.5 bg-surface-container rounded-full overflow-hidden">
                  <span className="block h-full bg-primary rounded-full" style={{ width: `${Math.round(totalLengkap / rows.length * 100)}%` }} />
                </span>
              </p>
              <button onClick={handleExportExcel} disabled={exporting}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl text-xs font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors">
                {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                Export Excel
              </button>
            </div>
          )}
        </div>

        {/* ── Belum pilih kelas ── */}
        {!kelasId && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-on-surface-variant">
            <ClipboardList className="w-12 h-12 opacity-30" />
            <p className="font-medium">Pilih kelas untuk melihat data nilai</p>
            <p className="text-sm opacity-70">Data nilai ujian dan tugas akan muncul setelah kelas dipilih</p>
          </div>
        )}

        {/* ── Loading ── */}
        {kelasId && loading && (
          <div className="flex items-center justify-center py-20 gap-3 text-on-surface-variant">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Memuat data...</span>
          </div>
        )}

        {/* ── Error ── */}
        {kelasId && !loading && error && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <AlertCircle className="w-10 h-10 text-error opacity-50" />
            <p className="text-sm text-error">{error}</p>
            <button onClick={fetchData} className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors">
              Muat Ulang
            </button>
          </div>
        )}

        {/* ── Empty ── */}
        {kelasId && !loading && !error && columns.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-on-surface-variant">
            <ClipboardList className="w-10 h-10 opacity-30" />
            <p className="text-sm font-medium">Belum ada data nilai untuk kelas ini</p>
            <p className="text-xs opacity-70">Guru perlu mengaktifkan "Masukkan ke Dashboard" pada ujian, atau menambah kolom nilai manual</p>
          </div>
        )}

        {/* ── Tabel ── */}
        {kelasId && !loading && !error && columns.length > 0 && (
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-outline-variant/30">
              <h3 className="font-bold text-on-surface text-sm flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-primary" />
                Rekap Nilai
                {displayed.length !== rows.length && (
                  <span className="ml-1 text-on-surface-variant font-normal text-xs">({displayed.length}/{rows.length})</span>
                )}
              </h3>
              <button onClick={fetchData} disabled={loading}
                className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors disabled:opacity-50" title="Muat ulang">
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="text-sm">
                <thead>
                  {/* Row 1 — judul kolom */}
                  <tr className="bg-surface-container">
                    <th className="px-4 py-2.5 text-left text-xs font-bold text-on-surface-variant uppercase tracking-wider sticky left-0 bg-surface-container z-10 min-w-[40px]">No</th>
                    <th className="px-4 py-2.5 text-left text-xs font-bold text-on-surface-variant uppercase tracking-wider sticky left-10 bg-surface-container z-10 min-w-[160px]">Nama Siswa</th>
                    <th className="px-4 py-2.5 text-left text-xs font-bold text-on-surface-variant uppercase tracking-wider min-w-[80px]">Kelas</th>
                    {columns.map(col => (
                      <th key={col.colKey} className="px-3 py-2.5 text-center min-w-[110px] border-l border-outline-variant/20">
                        <div className="font-bold text-on-surface text-xs leading-tight">{col.judul}</div>
                        <div className={`text-[10px] mt-0.5 font-semibold ${col.sumber === 'ujian' ? 'text-primary' : 'text-purple-600'}`}>
                          {col.sumber === 'ujian' ? '◉ Ujian' : '◎ Manual'}
                        </div>
                        <div className="text-[10px] text-on-surface-variant/60 mt-0.5 font-normal">{col.guruNama}</div>
                      </th>
                    ))}
                    <th className="px-4 py-2.5 text-center text-xs font-bold text-on-surface-variant uppercase tracking-wider min-w-[110px]">Keterangan</th>
                  </tr>
                  {/* Row 2 — sub-header (jenis • materi) */}
                  <tr className="bg-surface-container/60 border-b border-outline-variant/30">
                    <td colSpan={3} />
                    {columns.map(col => (
                      <td key={col.colKey} className="px-3 py-1.5 text-center border-l border-outline-variant/20">
                        <span className="text-[10px] text-on-surface-variant font-medium">
                          {col.jenis}{col.materi ? ` • ${col.materi}` : ''}
                        </span>
                      </td>
                    ))}
                    <td />
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/30">
                  {displayed.map((row, i) => (
                    <tr key={row.siswaId}
                      className={`hover:bg-surface-container/40 transition-colors ${row.keterangan === 'Kurang Lengkap' ? 'bg-amber-50/40' : ''}`}>
                      <td className="px-4 py-3 text-on-surface-variant text-sm sticky left-0 bg-inherit z-10">{i + 1}</td>
                      <td className="px-4 py-3 sticky left-10 bg-inherit z-10">
                        <p className="font-semibold text-on-surface text-sm">{row.nama}</p>
                        <p className="text-xs text-on-surface-variant">{row.nis}</p>
                      </td>
                      <td className="px-4 py-3 text-on-surface-variant text-sm">{row.kelas}</td>
                      {columns.map(col => {
                        const v = row.nilai[col.colKey];
                        return (
                          <td key={col.colKey} className="px-3 py-3 text-center border-l border-outline-variant/20">
                            <span className={`text-sm ${nilaiColor(v)}`}>
                              {v === null ? <span className="text-on-surface-variant opacity-40">—</span> : v}
                            </span>
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 text-center">
                        {row.keterangan === 'Lengkap'
                          ? <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded-lg text-xs font-semibold">✓ Lengkap</span>
                          : <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 rounded-lg text-xs font-semibold">⚠ Kurang</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
