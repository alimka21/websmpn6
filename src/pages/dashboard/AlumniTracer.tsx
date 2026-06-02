import { toast } from 'sonner';
import React, { useState, useEffect, useRef } from 'react';
import ExcelJS from 'exceljs';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input, Label } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Badge } from '../../components/ui/badge';
import { Plus, Download, Edit, Trash2, Building, GraduationCap, Briefcase, Users, HelpCircle, Search, X, Upload, CheckCircle2, XCircle, ShieldCheck, Clock } from 'lucide-react';
import api from '../../lib/api';
import { ErrorState } from '../../components/ui/ErrorState';
import { useModalA11y } from '../../hooks/useModalA11y';
import { Pagination } from '../../components/ui/pagination';

const ITEMS_PER_PAGE = 20;
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, Legend } from 'recharts';

const EMPTY_FORM = {
  nama: '', nis: '', tahunLulus: new Date().getFullYear(),
  status: 'KULIAH', instansi: '', jurusan: '', posisi: '', kontak: '', fotoUrl: ''
};

const STATUS_OPTIONS = [
  { value: 'BEKERJA', label: 'Bekerja' },
  { value: 'KULIAH', label: 'Melanjutkan Kuliah' },
  { value: 'WIRAUSAHA', label: 'Wirausaha' },
  { value: 'TIDAK_DIKETAHUI', label: 'Tidak Diketahui' },
];

const STATUS_COLOR: Record<string, string> = {
  BEKERJA: '#3b82f6',
  KULIAH: '#22c55e',
  WIRAUSAHA: '#f59e0b',
  TIDAK_DIKETAHUI: '#94a3b8',
};

function Inisial({ nama, fotoUrl }: { nama: string; fotoUrl?: string }) {
  const initials = nama.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  if (fotoUrl) {
    return <img src={fotoUrl} alt={nama} className="w-9 h-9 rounded-full object-cover border border-outline-variant" onError={e => { e.currentTarget.style.display = 'none'; }} />;
  }
  const colors = ['bg-primary-container/30 text-primary', 'bg-secondary-container/60 text-on-secondary-container', 'bg-tertiary-fixed/70 text-on-tertiary-fixed', 'bg-primary-container/40 text-on-primary-container'];
  const idx = nama.charCodeAt(0) % colors.length;
  return (
    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${colors[idx]}`}>
      {initials}
    </div>
  );
}

export default function AlumniTracer() {
  const [alumniList, setAlumniList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [filterTahun, setFilterTahun] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterJurusan, setFilterJurusan] = useState('ALL');
  const [filterVerify, setFilterVerify] = useState<'ALL' | 'VERIFIED' | 'PENDING'>('ALL');
  const [search, setSearch] = useState('');
  // Set of alumni IDs yang di-select untuk batch verify
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isVerifying, setIsVerifying] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ ...EMPTY_FORM });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const modalRef = useModalA11y<HTMLDivElement>(showModal, () => setShowModal(false));

  // ── Import state ──
  type ImportResult = { created: number; skipped: number; failed: { row: number; message: string }[] } | null;
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const importResultModalRef = useModalA11y<HTMLDivElement>(importResult !== null, () => setImportResult(null));

  // Reset ke halaman 1 saat search/filter berubah
  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds(new Set());
  }, [search, filterTahun, filterStatus, filterJurusan, filterVerify]);

  const fetchAlumni = async () => {
    try {
      setIsLoading(true);
      // Endpoint paginated — ambil 100 (cukup utk tracer sekolah typical;
      // halaman ini punya banyak filter client-side: tahun/status/jurusan/verify).
      const res = await api.get('/api/admin/alumni?limit=100');
      setAlumniList(res?.data ?? []);
      setErrorMsg(null);
      if (res?.pagination?.total > 100) {
        toast.info(`Total ${res.pagination.total} alumni — hanya 100 terbaru ditampilkan.`);
      }
    } catch (error: any) {
      setErrorMsg(error?.message || 'Gagal memuat data alumni');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchAlumni(); }, []);

  const handleOpenModal = (alumni?: any) => {
    if (alumni) {
      setEditingId(alumni.id);
      setFormData({
        nama: alumni.nama, nis: alumni.nis || '',
        tahunLulus: alumni.tahunLulus, status: alumni.status,
        instansi: alumni.instansi || '', jurusan: alumni.jurusan || '',
        posisi: alumni.posisi || '', kontak: alumni.kontak || '',
        fotoUrl: alumni.fotoUrl || ''
      });
    } else {
      setEditingId(null);
      setFormData({ ...EMPTY_FORM });
    }
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nama || !formData.tahunLulus || !formData.status) {
      toast.error('Nama, Tahun Lulus, dan Status wajib diisi!');
      return;
    }
    try {
      setIsSubmitting(true);
      const payload = { ...formData, tahunLulus: Number(formData.tahunLulus) };
      if (editingId) {
        await api.patch(`/api/admin/alumni/${editingId}`, payload);
      } else {
        await api.post('/api/admin/alumni', payload);
      }
      toast.success(editingId ? 'Data alumni diperbarui.' : 'Alumni berhasil ditambahkan.');
      setShowModal(false);
      fetchAlumni();
    } catch (error: any) {
      toast.error(error.message || 'Gagal menyimpan data alumni');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/api/admin/alumni/${id}`);
      setDeleteConfirmId(null);
      toast.success('Data alumni dihapus.');
      fetchAlumni();
    } catch (error: any) {
      toast.error(error.message || 'Gagal menghapus alumni');
    }
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);
      let token = localStorage.getItem('token');
      if (!token) {
        try { const raw = localStorage.getItem('auth-storage'); if (raw) token = JSON.parse(raw)?.state?.token; } catch { /* ignore */ }
      }
      const resp = await fetch('/api/admin/alumni/export', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!resp.ok) throw new Error('Gagal mengunduh file');
      const blob = await resp.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = 'data-alumni.xlsx';
      a.click();
      URL.revokeObjectURL(href);
      toast.success('File Excel berhasil diunduh');
    } catch (err: any) {
      toast.error(err.message || 'Gagal mengunduh');
    } finally {
      setIsExporting(false);
    }
  };

  // ── Import: download template ──
  const handleDownloadTemplate = async () => {
    try {
      let token = localStorage.getItem('token');
      if (!token) {
        try { const raw = localStorage.getItem('auth-storage'); if (raw) token = JSON.parse(raw)?.state?.token; } catch { /* ignore */ }
      }
      const resp = await fetch('/api/admin/alumni/import-template', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!resp.ok) throw new Error('Gagal mengunduh template');
      const blob = await resp.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = 'template-import-alumni.xlsx';
      a.click();
      URL.revokeObjectURL(href);
      toast.success('Template berhasil diunduh');
    } catch (e: any) {
      toast.error(e.message || 'Gagal mengunduh template');
    }
  };

  // ── Import: parse Excel + kirim ke backend ──
  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setImporting(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buf);
      const ws = wb.worksheets[0];
      if (!ws) throw new Error('Sheet pertama tidak ditemukan di file');

      const headerRow = ws.getRow(1);
      const headers: string[] = [];
      headerRow.eachCell((cell, col) => {
        headers[col] = String(cell.value ?? '').toLowerCase().trim();
      });

      const items: any[] = [];
      ws.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const obj: Record<string, any> = {};
        row.eachCell((cell, col) => {
          const key = headers[col];
          if (!key) return;
          let normalized = key;
          if (key === 'nama') normalized = 'nama';
          else if (key === 'nis') normalized = 'nis';
          else if (key === 'tahun lulus' || key === 'tahunlulus') normalized = 'tahunLulus';
          else if (key === 'jurusan') normalized = 'jurusan';
          else if (key === 'status') normalized = 'status';
          else if (key === 'instansi') normalized = 'instansi';
          else if (key === 'posisi') normalized = 'posisi';
          else if (key === 'kontak') normalized = 'kontak';
          obj[normalized] = cell.value;
        });
        if (Object.values(obj).every(v => v == null || String(v).trim() === '')) return;
        items.push(obj);
      });

      if (items.length === 0) {
        toast.error('Tidak ada data baris yang ter-baca dari file');
        return;
      }

      // 60s timeout — bulk import bisa lama walau sudah dioptimisasi.
      const result = await api.post('/api/admin/alumni/import', { items }, 60_000);
      setImportResult(result);
      if (result.created > 0) toast.success(`${result.created} alumni berhasil di-import`);
      fetchAlumni();
    } catch (err: any) {
      toast.error(err?.message || 'Gagal memproses file');
    } finally {
      setImporting(false);
    }
  };

  // Stats
  const stats = alumniList.reduce((acc: Record<string, number>, al) => {
    acc[al.status] = (acc[al.status] || 0) + 1;
    return acc;
  }, {});
  const total = alumniList.length;

  // Chart data
  const pieData = STATUS_OPTIONS
    .map(s => ({ name: s.label, value: stats[s.value] || 0, color: STATUS_COLOR[s.value] }))
    .filter(d => d.value > 0);

  const yearsMap = alumniList.reduce((acc: Record<string, number>, al) => {
    acc[al.tahunLulus] = (acc[al.tahunLulus] || 0) + 1;
    return acc;
  }, {});
  const barData = Object.keys(yearsMap)
    .map(y => ({ tahun: y, jumlah: yearsMap[y] }))
    .sort((a, b) => Number(a.tahun) - Number(b.tahun));

  // Filter options
  const existingYears = [...new Set(alumniList.map(a => a.tahunLulus))].sort((a: any, b: any) => b - a);
  const existingJurusan = [...new Set(alumniList.map(a => a.jurusan).filter(Boolean))].sort();

  // Filtered list
  const displayAlumni = alumniList.filter(al => {
    if (filterTahun !== 'ALL' && String(al.tahunLulus) !== filterTahun) return false;
    if (filterStatus !== 'ALL' && al.status !== filterStatus) return false;
    if (filterJurusan !== 'ALL' && al.jurusan !== filterJurusan) return false;
    if (filterVerify === 'VERIFIED' && !al.isVerified) return false;
    if (filterVerify === 'PENDING' && al.isVerified) return false;
    if (search && !al.nama.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Hitung pending untuk badge tab
  const pendingCount = alumniList.filter(a => !a.isVerified).length;

  // Selection helpers
  const allOnPageSelected = displayAlumni.length > 0 && displayAlumni.every(a => selectedIds.has(a.id));
  const toggleSelectAll = () => {
    if (allOnPageSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(displayAlumni.map(a => a.id)));
    }
  };
  const toggleSelectOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const handleBatchVerify = async (isVerified: boolean) => {
    if (selectedIds.size === 0) return;
    try {
      setIsVerifying(true);
      const res = await api.post('/api/admin/alumni/verify', {
        ids: Array.from(selectedIds),
        isVerified,
      });
      toast.success(
        `${res.updated} alumni ${isVerified ? 'diverifikasi' : 'di-unverify'} berhasil`
      );
      setSelectedIds(new Set());
      fetchAlumni();
    } catch (err: any) {
      toast.error(err?.message || 'Gagal update status verifikasi');
    } finally {
      setIsVerifying(false);
    }
  };

  // Paginated slice
  const paginatedAlumni = displayAlumni.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const statCards = [
    { label: 'Total Terdata', value: total, icon: Users, bg: 'bg-surface-container-low border-outline-variant', iconBg: 'bg-surface-container-high text-on-surface', text: 'text-on-surface' },
    { label: 'Bekerja', value: stats.BEKERJA || 0, icon: Briefcase, bg: 'bg-primary-container/15 border-primary/20', iconBg: 'bg-primary-container/50 text-primary', text: 'text-primary' },
    { label: 'Kuliah', value: stats.KULIAH || 0, icon: GraduationCap, bg: 'bg-secondary-container/30 border-secondary/20', iconBg: 'bg-secondary-container text-on-secondary-container', text: 'text-on-secondary-container' },
    { label: 'Wirausaha', value: stats.WIRAUSAHA || 0, icon: Building, bg: 'bg-tertiary-fixed/50 border-tertiary-fixed/50', iconBg: 'bg-tertiary-fixed text-on-tertiary-fixed', text: 'text-on-tertiary-fixed' },
    { label: 'Tidak Diketahui', value: stats.TIDAK_DIKETAHUI || 0, icon: HelpCircle, bg: 'bg-surface-container-low border-outline-variant', iconBg: 'bg-surface-container-high text-on-surface-variant', text: 'text-on-surface' },
  ];

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      BEKERJA: 'bg-primary-container/30 text-primary',
      KULIAH: 'bg-secondary-container/60 text-on-secondary-container',
      WIRAUSAHA: 'bg-tertiary-fixed/70 text-on-tertiary-fixed',
      TIDAK_DIKETAHUI: 'bg-surface-container text-on-surface-variant',
    };
    const label = STATUS_OPTIONS.find(s => s.value === status)?.label ?? status;
    return <Badge className={`${map[status] || 'bg-surface-container text-on-surface-variant'} border-0 hover:opacity-100`}>{label}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-on-surface">Tracer Study Alumni</h1>
          <p className="text-on-surface-variant mt-1">Pantau jejak karir dan pendidikan lanjutan lulusan.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" className="gap-2" onClick={handleDownloadTemplate} disabled={importing}>
            <Download className="w-4 h-4" /> Template
          </Button>
          <Button
            variant="outline"
            className="gap-2 border-secondary text-on-secondary-container hover:bg-secondary-container/30"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
          >
            {importing ? <div className="w-4 h-4 border-2 border-secondary/60/40 border-t-green-700 rounded-full animate-spin" /> : <Upload className="w-4 h-4" />}
            {importing ? 'Memproses...' : 'Import'}
          </Button>
          <Button variant="outline" className="gap-2" onClick={handleExport} disabled={isExporting}>
            {isExporting ? <div className="w-4 h-4 border-2 border-outline/40 border-t-slate-600 rounded-full animate-spin" /> : <Download className="w-4 h-4" />}
            Export Excel
          </Button>
          <Button onClick={() => handleOpenModal()} className="gap-2 bg-primary hover:bg-primary/90">
            <Plus className="w-4 h-4" /> Tambah Alumni
          </Button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {statCards.map(card => (
          <div key={card.label} className={`border p-4 rounded-xl flex items-center gap-3 ${card.bg}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${card.iconBg}`}>
              <card.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-on-surface-variant font-medium leading-tight">{card.label}</p>
              <p className={`text-xl font-bold ${card.text}`}>{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      {total > 0 && (
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Persentase Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center h-56">
                <ResponsiveContainer width="60%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={46} outerRadius={74} paddingAngle={2} dataKey="value">
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-2">
                  {pieData.map(d => (
                    <div key={d.name} className="flex items-center gap-2 text-sm">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                      <span className="text-on-surface-variant">{d.name}</span>
                      <span className="font-bold text-on-surface ml-auto pl-3">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Lulusan per Tahun</CardTitle>
            </CardHeader>
            <CardContent className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="tahun" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '8px', border: 'none' }} />
                  <Bar dataKey="jumlah" name="Jumlah" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabel */}
      <Card>
        <CardHeader className="pb-4 border-b border-outline-variant">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
            <CardTitle>Data Lulusan</CardTitle>
            <div className="flex flex-wrap gap-2 w-full md:w-auto">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline-variant pointer-events-none" />
                <Input placeholder="Cari nama..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 w-44" />
              </div>
              <Select value={filterTahun} onChange={e => setFilterTahun(e.target.value)} className="h-9 w-36">
                <option value="ALL">Semua Tahun</option>
                {existingYears.map(y => <option key={y} value={y}>Lulusan {y}</option>)}
              </Select>
              <Select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="h-9 w-40">
                <option value="ALL">Semua Status</option>
                {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </Select>
              {existingJurusan.length > 0 && (
                <Select value={filterJurusan} onChange={e => setFilterJurusan(e.target.value)} className="h-9 w-40">
                  <option value="ALL">Semua Jurusan</option>
                  {existingJurusan.map(j => <option key={j} value={j}>{j}</option>)}
                </Select>
              )}
              <Select
                value={filterVerify}
                onChange={e => setFilterVerify(e.target.value as any)}
                className="h-9 w-44"
              >
                <option value="ALL">Semua Verifikasi</option>
                <option value="PENDING">Belum Diverifikasi{pendingCount > 0 ? ` (${pendingCount})` : ''}</option>
                <option value="VERIFIED">Sudah Diverifikasi</option>
              </Select>
            </div>
          </div>

          {/* Batch action bar — muncul kalau ada selection */}
          {selectedIds.size > 0 && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 bg-tertiary-fixed/50 border border-tertiary-fixed rounded-lg px-4 py-2">
              <p className="text-sm font-medium text-on-tertiary-fixed">
                <strong>{selectedIds.size}</strong> alumni terpilih
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="bg-secondary hover:bg-secondary/90 gap-1.5"
                  onClick={() => handleBatchVerify(true)}
                  disabled={isVerifying}
                >
                  <ShieldCheck className="w-4 h-4" />
                  {isVerifying ? 'Memproses...' : 'Verifikasi'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBatchVerify(false)}
                  disabled={isVerifying}
                  className="text-on-tertiary-fixed border-tertiary"
                >
                  Un-verify
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
                  Batal
                </Button>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 text-center text-on-surface-variant">Memuat data alumni...</div>
          ) : errorMsg ? (
            <ErrorState message={errorMsg} onRetry={fetchAlumni} />
          ) : displayAlumni.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-on-surface-variant border border-dashed border-outline-variant rounded-xl m-6">
              <p className="text-lg font-medium text-on-surface">Belum ada data</p>
              <p className="text-sm">{search ? 'Coba kata kunci lain.' : 'Data alumni kosong untuk filter ini.'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-surface-container-low text-on-surface-variant border-b border-outline-variant uppercase text-xs">
                  <tr>
                    <th className="px-3 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={allOnPageSelected}
                        onChange={toggleSelectAll}
                        aria-label="Pilih semua alumni di halaman"
                        className="w-4 h-4 cursor-pointer accent-blue-600"
                      />
                    </th>
                    <th className="px-4 py-3 font-semibold w-10"></th>
                    <th className="px-4 py-3 font-semibold">Nama Alumni</th>
                    <th className="px-4 py-3 font-semibold text-center">Lulus</th>
                    <th className="px-4 py-3 font-semibold">Jurusan</th>
                    <th className="px-4 py-3 font-semibold">Status & Tempat</th>
                    <th className="px-4 py-3 font-semibold text-center">Verifikasi</th>
                    <th className="px-4 py-3 font-semibold text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedAlumni.map(al => (
                    <React.Fragment key={al.id}>
                      <tr className={`hover:bg-surface-container-low/60 transition-colors ${selectedIds.has(al.id) ? 'bg-primary-container/15/40' : ''}`}>
                        <td className="px-3 py-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(al.id)}
                            onChange={() => toggleSelectOne(al.id)}
                            aria-label={`Pilih ${al.nama}`}
                            className="w-4 h-4 cursor-pointer accent-blue-600"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <Inisial nama={al.nama} fotoUrl={al.fotoUrl} />
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-on-surface">{al.nama}</p>
                          <p className="text-xs text-on-surface-variant">NIS: {al.nis || '—'}</p>
                          {al.kontak && <p className="text-xs text-primary mt-0.5 truncate max-w-[180px]">{al.kontak}</p>}
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-on-surface">{al.tahunLulus}</td>
                        <td className="px-4 py-3 text-on-surface-variant text-xs">{al.jurusan || '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            {statusBadge(al.status)}
                            {al.instansi && <span className="text-xs font-medium text-on-surface">{al.instansi}</span>}
                            {al.posisi && <span className="text-xs text-on-surface-variant">{al.posisi}</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {al.isVerified ? (
                            <Badge variant="secondary" className="bg-secondary-container/30 text-on-secondary-container border-secondary/20 gap-1">
                              <ShieldCheck className="w-3 h-3" /> Terverifikasi
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-tertiary-fixed/50 text-on-tertiary-fixed border-tertiary-fixed gap-1">
                              <Clock className="w-3 h-3" /> Pending
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-center gap-1.5">
                            <Button variant="ghost" size="sm" onClick={() => handleOpenModal(al)} className="text-primary hover:bg-primary-container/15 h-8 px-2" title="Edit">
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setDeleteConfirmId(al.id)} className="text-error hover:bg-error-container h-8 px-2" title="Hapus">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                      {deleteConfirmId === al.id && (
                        <tr className="bg-error-container">
                          <td colSpan={8} className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <span className="text-sm text-error font-medium flex-1">
                                Hapus data alumni "<span className="font-semibold">{al.nama}</span>"?
                              </span>
                              <Button size="sm" className="bg-error hover:bg-error/90 text-white h-7 px-3 text-xs" onClick={() => handleDelete(al.id)}>
                                Ya, Hapus
                              </Button>
                              <Button size="sm" variant="outline" className="h-7 px-3 text-xs" onClick={() => setDeleteConfirmId(null)}>
                                Batal
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
              <Pagination
                currentPage={currentPage}
                totalItems={displayAlumni.length}
                itemsPerPage={ITEMS_PER_PAGE}
                onPageChange={setCurrentPage}
                itemLabel="alumni"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-inverse-surface/50 backdrop-blur-sm overflow-y-auto">
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="alumni-modal-title"
            className="bg-white w-full max-w-lg rounded-2xl shadow-xl my-auto flex flex-col max-h-[90vh]"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant shrink-0">
              <h2 id="alumni-modal-title" className="text-lg font-bold text-on-surface">{editingId ? 'Edit Data Alumni' : 'Tambah Alumni'}</h2>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-lg hover:bg-surface-container text-outline-variant" aria-label="Tutup modal">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="flex flex-col flex-1 overflow-hidden">
              <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
                <div className="space-y-2">
                  <Label>URL Foto (Opsional)</Label>
                  <Input value={formData.fotoUrl} onChange={e => setFormData({ ...formData, fotoUrl: e.target.value })} placeholder="https://..." />
                  {formData.fotoUrl && (
                    <img src={formData.fotoUrl} alt="preview" className="w-14 h-14 rounded-full object-cover border border-outline-variant mt-1" onError={e => (e.currentTarget.style.display = 'none')} />
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Nama Lengkap <span className="text-error">*</span></Label>
                  <Input required value={formData.nama} onChange={e => setFormData({ ...formData, nama: e.target.value })} placeholder="Nama Alumni" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>NIS (Opsional)</Label>
                    <Input value={formData.nis} onChange={e => setFormData({ ...formData, nis: e.target.value })} placeholder="NIS" />
                  </div>
                  <div className="space-y-2">
                    <Label>Tahun Lulus <span className="text-error">*</span></Label>
                    <Input type="number" required value={formData.tahunLulus} onChange={e => setFormData({ ...formData, tahunLulus: parseInt(e.target.value) || new Date().getFullYear() })} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Jurusan (Saat SMA)</Label>
                  <Input value={formData.jurusan} onChange={e => setFormData({ ...formData, jurusan: e.target.value })} placeholder="Contoh: IPA, IPS, Teknik Komputer..." />
                </div>

                <div className="space-y-2">
                  <Label>Status Saat Ini <span className="text-error">*</span></Label>
                  <Select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}>
                    {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Nama Instansi / Kampus / Usaha</Label>
                  <Input value={formData.instansi} onChange={e => setFormData({ ...formData, instansi: e.target.value })} placeholder="PT Maju Jaya / Universitas Indonesia..." />
                </div>

                <div className="space-y-2">
                  <Label>Posisi / Program Studi</Label>
                  <Input value={formData.posisi} onChange={e => setFormData({ ...formData, posisi: e.target.value })} placeholder="Software Engineer / Teknik Informatika..." />
                </div>

                <div className="space-y-2">
                  <Label>Kontak</Label>
                  <Input value={formData.kontak} onChange={e => setFormData({ ...formData, kontak: e.target.value })} placeholder="Email / LinkedIn / No. HP" />
                </div>
              </div>

              <div className="px-6 py-4 border-t border-outline-variant flex justify-end gap-2 shrink-0 bg-surface-container-low rounded-b-2xl">
                <Button type="button" variant="outline" onClick={() => setShowModal(false)} disabled={isSubmitting}>Batal</Button>
                <Button type="submit" disabled={isSubmitting} className="bg-primary hover:bg-primary/90 gap-2">
                  {isSubmitting && <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Data'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Hidden file input untuk import Excel */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={handleFileSelected}
        aria-hidden="true"
      />

      {/* Modal Hasil Import */}
      {importResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-inverse-surface/50 backdrop-blur-sm">
          <div
            ref={importResultModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="alumni-import-result-title"
            className="w-full max-w-lg bg-white rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="px-6 pt-6 pb-4 border-b border-outline-variant">
              <h2 id="alumni-import-result-title" className="text-lg font-bold text-on-surface">Hasil Import Alumni</h2>
            </div>
            <div className="px-6 py-5 space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-secondary-container/30 border border-secondary/20 p-3 text-center">
                  <CheckCircle2 className="w-5 h-5 text-secondary mx-auto mb-1" />
                  <p className="text-2xl font-bold text-on-secondary-container">{importResult.created}</p>
                  <p className="text-xs text-secondary mt-0.5">Berhasil</p>
                </div>
                <div className="rounded-lg bg-surface-container-low border border-outline-variant p-3 text-center">
                  <p className="text-2xl font-bold text-on-surface">{importResult.skipped}</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">Sudah ada (skip)</p>
                </div>
                <div className="rounded-lg bg-error-container border border-error/20 p-3 text-center">
                  <XCircle className="w-5 h-5 text-error mx-auto mb-1" />
                  <p className="text-2xl font-bold text-error">{importResult.failed.length}</p>
                  <p className="text-xs text-error mt-0.5">Gagal</p>
                </div>
              </div>
              {importResult.failed.length > 0 && (
                <div className="rounded-lg border border-error/20 bg-error-container/50 p-3 max-h-60 overflow-y-auto">
                  <p className="text-sm font-semibold text-error mb-2">Detail kegagalan:</p>
                  <ul className="space-y-1 text-xs text-error">
                    {importResult.failed.map((f, i) => (
                      <li key={i}>
                        <span className="font-mono font-semibold">Baris {f.row}:</span> {f.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="px-6 pb-6 flex justify-end">
              <Button onClick={() => setImportResult(null)} className="bg-primary hover:bg-primary/90">Tutup</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
