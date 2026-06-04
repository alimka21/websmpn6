import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Users, ChevronLeft, ChevronRight, Search, RefreshCw, Calendar, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import SiteFooter from '../components/SiteFooter';
import { useSiteConfig } from '../hooks/useSiteConfig';

interface PresensiSiswaRow {
  no: number;
  id: string;
  nis: string;
  nama: string;
  kelas: string;
  tanggal: string;
  waktuDatang: string;
}

const fmtTime = (d: string | null) =>
  d ? new Date(d).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '—';

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const nowYear = new Date().getFullYear();
const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

export default function PresensiSiswaPublik() {
  const cfg = useSiteConfig();
  const schoolName = cfg.namaSekolah || 'Portal Sekolah';

  const [rows, setRows] = useState<PresensiSiswaRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [tanggal, setTanggal] = useState('');
  const [bulan, setBulan] = useState(String(new Date().getMonth() + 1));
  const [tahun, setTahun] = useState(String(nowYear));
  const [mode, setMode] = useState<'hari' | 'bulan'>('hari');
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadData(1);
  }, [mode, tanggal, bulan, tahun]);

  const loadData = async (p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p) });
      if (search) params.set('search', search);
      if (mode === 'hari' && tanggal) params.set('tanggal', tanggal);
      else if (mode === 'bulan') { params.set('bulan', bulan); params.set('tahun', tahun); }
      else params.set('tanggal', new Date().toISOString().slice(0, 10));

      const r: any = await api.get(`/api/public/presensi/siswa?${params}`);
      setRows(r.data || []);
      setTotal(r.total || 0);
      setPage(r.page || 1);
      setPages(r.totalPages || 1);
    } catch (err: any) {
      toast.error(err?.message || 'Gagal memuat data presensi siswa');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col">
      {/* Header */}
      <header className="fixed top-0 w-full z-50 border-b border-outline-variant/30 glass-header shadow-md shadow-black/5">
        <div className="flex justify-between items-center w-full px-4 md:px-20 py-4 max-w-screen-2xl mx-auto">
          <div className="flex items-center gap-2.5">
            {cfg.logoUrl && (
              <img src={cfg.logoUrl} alt={schoolName} className="w-8 h-8 rounded-lg object-contain" />
            )}
            <span className="text-xl font-extrabold text-primary tracking-tight">{schoolName}</span>
          </div>
          <Link to="/" className="flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
            <ArrowLeft className="w-4 h-4" /> Kembali ke Beranda
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow pt-28 pb-16 px-4 md:px-20 max-w-screen-2xl mx-auto w-full">
        <div className="space-y-6">
          {/* Title */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-on-surface">Presensi Siswa</h1>
              <p className="text-on-surface-variant mt-1">Data kehadiran siswa secara real-time</p>
            </div>
          </div>

          {/* Filter */}
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant p-4 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              {/* Mode Toggle */}
              <div className="flex p-1 bg-surface-container rounded-xl">
                {(['hari', 'bulan'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all capitalize ${
                      mode === m ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant'
                    }`}
                  >
                    Per {m === 'hari' ? 'Tanggal' : 'Bulan'}
                  </button>
                ))}
              </div>

              {/* Date/Month Filter */}
              {mode === 'hari' ? (
                <input
                  type="date"
                  value={tanggal}
                  onChange={e => setTanggal(e.target.value)}
                  className="px-3 py-2 border border-outline-variant rounded-xl text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none bg-surface-container-lowest"
                />
              ) : (
                <>
                  <select
                    value={bulan}
                    onChange={e => setBulan(e.target.value)}
                    className="px-3 py-2 border border-outline-variant rounded-xl text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none bg-surface-container-lowest"
                  >
                    {MONTHS.map((m, i) => (
                      <option key={i} value={String(i + 1)}>{m}</option>
                    ))}
                  </select>
                  <select
                    value={tahun}
                    onChange={e => setTahun(e.target.value)}
                    className="px-3 py-2 border border-outline-variant rounded-xl text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none bg-surface-container-lowest"
                  >
                    {[nowYear, nowYear - 1, nowYear - 2].map(y => (
                      <option key={y} value={String(y)}>{y}</option>
                    ))}
                  </select>
                </>
              )}

              {/* Search */}
              <div className="relative flex-grow max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && loadData(1)}
                  placeholder="Cari nama atau NIS..."
                  className="pl-9 pr-4 py-2 w-full border border-outline-variant rounded-xl text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none bg-surface-container-lowest"
                />
              </div>

              <button
                onClick={() => loadData(1)}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-container transition-colors"
              >
                <RefreshCw className="w-4 h-4" /> Tampilkan
              </button>
            </div>

            <div className="text-sm text-on-surface-variant">
              {total} data ditemukan
            </div>
          </div>

          {/* Table */}
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant overflow-hidden shadow-[0px_4px_20px_rgba(0,0,0,0.03)]">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-outline-variant">
                    {['No','NIS','Nama Siswa','Kelas','Jam Datang','Tanggal'].map(h => (
                      <th key={h} className="px-5 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/40">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-10 text-center text-on-surface-variant">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          Memuat data...
                        </div>
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-10 text-center text-on-surface-variant">
                        <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p className="font-medium">Tidak ada data presensi untuk filter ini</p>
                      </td>
                    </tr>
                  ) : (
                    rows.map(row => (
                      <tr key={row.id} className="hover:bg-surface-container-low/50 transition-colors">
                        <td className="px-5 py-4 text-sm text-on-surface-variant">{row.no}</td>
                        <td className="px-5 py-4 text-sm font-medium text-on-surface">{row.nis}</td>
                        <td className="px-5 py-4 font-semibold text-primary">{row.nama}</td>
                        <td className="px-5 py-4 text-sm text-on-surface-variant">{row.kelas}</td>
                        <td className="px-5 py-4 text-sm text-on-surface">{fmtTime(row.waktuDatang)}</td>
                        <td className="px-5 py-4 text-sm text-on-surface">{fmtDate(row.tanggal)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pages > 1 && (
              <div className="px-5 py-4 bg-surface-container/30 border-t border-outline-variant flex justify-between items-center">
                <p className="text-sm text-on-surface-variant">
                  Hal {page} dari {pages} · {total} total
                </p>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => { const p = page - 1; setPage(p); loadData(p); }}
                    disabled={page <= 1}
                    className="p-2 border border-outline-variant rounded-lg hover:bg-surface-container-lowest disabled:opacity-30 transition-all"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  {Array.from({ length: Math.min(5, pages) }, (_, i) => {
                    const p = page <= 3 ? i + 1 : page - 2 + i;
                    if (p < 1 || p > pages) return null;
                    return (
                      <button
                        key={p}
                        onClick={() => { setPage(p); loadData(p); }}
                        className={`w-9 h-9 flex items-center justify-center rounded-lg font-semibold text-sm transition-colors ${
                          p === page ? 'bg-primary text-white shadow-sm' : 'hover:bg-surface-container-high'
                        }`}
                      >
                        {p}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => { const p = page + 1; setPage(p); loadData(p); }}
                    disabled={page >= pages}
                    className="p-2 border border-outline-variant rounded-lg hover:bg-surface-container-lowest disabled:opacity-30 transition-all"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
