import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck, Star, AlertTriangle, Plus, Edit2, Trash2, Download,
  FileText, Search, RefreshCw, Loader2, ChevronLeft, ChevronRight,
  TrendingUp, TrendingDown, X, Check, Eye,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '../../../lib/api';

// ── Types ──────────────────────────────────────────────────────────────────────

type Tab = 'kebaikan' | 'pelanggaran' | 'rekap' | 'export';

interface JenisItem { id: string; nama: string; poin: number; isActive: boolean; _count: { laporan: number } }

interface LaporanRow {
  id: string
  tanggal: string
  tipe: 'KEBAIKAN' | 'PELANGGARAN'
  namaPelapor: string
  poin: number
  keterangan: string | null
  siswa: { nama: string; nis: string; kelas: { nama: string } }
  jenisKebaikan?: { nama: string }
  jenisPelanggaran?: { nama: string }
}

interface RekapRow {
  siswaId: string
  nama: string
  nis: string
  kelas: string
  totalKebaikan: number
  totalPelanggaran: number
  neto: number
}

interface Pagination { total: number; page: number; limit: number; totalPages: number }

// ── Helpers ────────────────────────────────────────────────────────────────────

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

function ConfirmModal({ onConfirm, onCancel, message }: { onConfirm: () => void; onCancel: () => void; message: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-error/10 rounded-xl flex items-center justify-center shrink-0">
            <Trash2 className="w-5 h-5 text-error" />
          </div>
          <div>
            <h3 className="font-bold text-on-surface">Konfirmasi Hapus</h3>
            <p className="text-sm text-on-surface-variant mt-1">{message}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 px-4 py-2.5 border border-outline-variant rounded-xl text-sm font-semibold text-on-surface-variant hover:bg-surface-container transition-colors">Batal</button>
          <button onClick={onConfirm} className="flex-1 px-4 py-2.5 bg-error text-white rounded-xl text-sm font-semibold hover:bg-error/90 transition-colors">Hapus</button>
        </div>
      </div>
    </div>
  );
}

// ── Tab: Jenis (reusable untuk kebaikan & pelanggaran) ─────────────────────────

function TabJenis({ tipe }: { tipe: 'kebaikan' | 'pelanggaran' }) {
  const endpoint  = tipe === 'kebaikan' ? '/api/admin/jenis-kebaikan' : '/api/admin/jenis-pelanggaran';
  const labelTipe = tipe === 'kebaikan' ? 'Kebaikan' : 'Pelanggaran';
  const Icon      = tipe === 'kebaikan' ? Star : AlertTriangle;

  const [list, setList]         = useState<JenisItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [confirm, setConfirm]   = useState<string | null>(null);

  // Form
  const [editId, setEditId]     = useState<string | null>(null);
  const [formNama, setFormNama] = useState('');
  const [formPoin, setFormPoin] = useState('');
  const [formErr, setFormErr]   = useState<Record<string, string>>({});
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { const r: any = await api.get(endpoint); setList(Array.isArray(r) ? r : []); }
    catch { toast.error('Gagal memuat data'); }
    finally { setLoading(false); }
  }, [endpoint]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setEditId(null); setFormNama(''); setFormPoin(''); setFormErr({}); setShowForm(true); };
  const openEdit = (item: JenisItem) => { setEditId(item.id); setFormNama(item.nama); setFormPoin(String(item.poin)); setFormErr({}); setShowForm(true); };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!formNama.trim()) e.nama = 'Nama wajib diisi';
    const p = parseInt(formPoin);
    if (!formPoin || isNaN(p) || p < 1) e.poin = 'Poin harus berupa angka positif';
    setFormErr(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const body = { nama: formNama.trim(), poin: parseInt(formPoin) };
      if (editId) await api.patch(`${endpoint}/${editId}`, body);
      else        await api.post(endpoint, body);
      toast.success(editId ? 'Berhasil diperbarui' : 'Berhasil ditambahkan');
      setShowForm(false);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Gagal menyimpan');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`${endpoint}/${id}`);
      toast.success('Berhasil dihapus (dinonaktifkan)');
      setConfirm(null);
      load();
    } catch { toast.error('Gagal menghapus'); }
  };

  return (
    <div className="space-y-5">
      {/* Header + tambah */}
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-on-surface flex items-center gap-2">
          <Icon className={`w-4 h-4 ${tipe === 'kebaikan' ? 'text-green-600' : 'text-red-600'}`} />
          DB {labelTipe}
        </h3>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" /> Tambah {labelTipe}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-5 space-y-4">
          <h4 className="font-semibold text-on-surface text-sm">{editId ? `Edit ${labelTipe}` : `Tambah ${labelTipe} Baru`}</h4>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-on-surface-variant">Nama {labelTipe} <span className="text-error">*</span></label>
              <input
                type="text"
                value={formNama}
                onChange={e => setFormNama(e.target.value)}
                placeholder={`Contoh: ${tipe === 'kebaikan' ? 'Juara Olimpiade' : 'Terlambat Masuk'}`}
                className={`w-full px-3 py-2 border rounded-xl text-sm focus:border-primary outline-none bg-surface ${formErr.nama ? 'border-error' : 'border-outline-variant'}`}
              />
              {formErr.nama && <p className="text-xs text-error">{formErr.nama}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-on-surface-variant">Poin <span className="text-error">*</span></label>
              <input
                type="number"
                min="1"
                value={formPoin}
                onChange={e => setFormPoin(e.target.value)}
                placeholder="Contoh: 10"
                className={`w-full px-3 py-2 border rounded-xl text-sm focus:border-primary outline-none bg-surface ${formErr.poin ? 'border-error' : 'border-outline-variant'}`}
              />
              {formErr.poin && <p className="text-xs text-error">{formErr.poin}</p>}
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-outline-variant rounded-xl text-sm font-semibold text-on-surface-variant hover:bg-surface-container transition-colors">Batal</button>
            <button onClick={handleSave} disabled={saving} className="px-5 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-2">
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Simpan
            </button>
          </div>
        </div>
      )}

      {/* Tabel */}
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3 text-on-surface-variant text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Memuat...
          </div>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-on-surface-variant">
            <Icon className="w-8 h-8 opacity-30" />
            <p className="text-sm">Belum ada data {labelTipe.toLowerCase()}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-container">
                <th className="px-4 py-3 text-left text-xs font-bold text-on-surface-variant uppercase tracking-wider">No</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-on-surface-variant uppercase tracking-wider">Nama</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-on-surface-variant uppercase tracking-wider">Poin</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-on-surface-variant uppercase tracking-wider">Laporan</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-on-surface-variant uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-on-surface-variant uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/30">
              {list.map((item, i) => (
                <tr key={item.id} className={`hover:bg-surface-container/40 transition-colors ${!item.isActive ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3 text-on-surface-variant">{i + 1}</td>
                  <td className="px-4 py-3 font-semibold text-on-surface">{item.nama}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`font-bold ${tipe === 'kebaikan' ? 'text-green-700' : 'text-red-700'}`}>{item.poin}</span>
                  </td>
                  <td className="px-4 py-3 text-center text-on-surface-variant">{item._count.laporan}</td>
                  <td className="px-4 py-3 text-center">
                    {item.isActive
                      ? <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded-lg text-xs font-semibold"><Check className="w-3 h-3" /> Aktif</span>
                      : <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-surface-container text-on-surface-variant rounded-lg text-xs font-semibold"><X className="w-3 h-3" /> Nonaktif</span>
                    }
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg hover:bg-surface-container text-on-surface-variant hover:text-primary transition-colors">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setConfirm(item.id)} className="p-1.5 rounded-lg hover:bg-error/10 text-on-surface-variant hover:text-error transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {confirm && (
        <ConfirmModal
          message={`Nonaktifkan jenis ${labelTipe.toLowerCase()} ini? Data laporan tetap tersimpan.`}
          onConfirm={() => handleDelete(confirm)}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

// ── Tab: Rekapitulasi ──────────────────────────────────────────────────────────

function TabRekap() {
  const [laporanList, setLaporanList]   = useState<LaporanRow[]>([]);
  const [pagination, setPagination]     = useState<Pagination>({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [loading, setLoading]           = useState(true);
  const [confirm, setConfirm]           = useState<string | null>(null);

  const [search, setSearch]             = useState('');
  const [tipeFil, setTipeFil]           = useState('');
  const [dari, setDari]                 = useState('');
  const [sampai, setSampai]             = useState('');
  const [page, setPage]                 = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page: String(page), limit: '20' });
      if (search)  p.set('search', search);
      if (tipeFil) p.set('tipe', tipeFil);
      if (dari)    p.set('dari', dari);
      if (sampai)  p.set('sampai', sampai);
      const r: any = await api.get(`/api/admin/potensi/rekap?${p.toString()}`);
      setLaporanList(r.data || []);
      setPagination(r.pagination || { total: 0, page: 1, limit: 20, totalPages: 1 });
    } catch { toast.error('Gagal memuat rekap'); }
    finally { setLoading(false); }
  }, [search, tipeFil, dari, sampai, page]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/api/admin/potensi/laporan/${id}`);
      toast.success('Laporan dihapus');
      setConfirm(null);
      load();
    } catch { toast.error('Gagal menghapus'); }
  };

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
          <input
            type="text" value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Cari nama / NIS..."
            className="w-full pl-9 pr-3 py-2 border border-outline-variant rounded-xl text-sm focus:border-primary outline-none bg-surface"
          />
        </div>
        <select value={tipeFil} onChange={e => { setTipeFil(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-outline-variant rounded-xl text-sm focus:border-primary outline-none bg-surface appearance-none min-w-[140px]">
          <option value="">Semua Tipe</option>
          <option value="KEBAIKAN">Kebaikan</option>
          <option value="PELANGGARAN">Pelanggaran</option>
        </select>
        <input type="date" value={dari} onChange={e => { setDari(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-outline-variant rounded-xl text-sm focus:border-primary outline-none bg-surface" />
        <input type="date" value={sampai} onChange={e => { setSampai(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-outline-variant rounded-xl text-sm focus:border-primary outline-none bg-surface" />
        <button onClick={() => { setSearch(''); setTipeFil(''); setDari(''); setSampai(''); setPage(1); }}
          className="px-3 py-2 border border-outline-variant rounded-xl text-sm font-semibold text-on-surface-variant hover:bg-surface-container transition-colors">
          Reset
        </button>
        <button onClick={load} className="p-2 border border-outline-variant rounded-xl hover:bg-surface-container transition-colors text-on-surface-variant">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Tabel */}
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant overflow-hidden">
        <div className="px-5 py-3 border-b border-outline-variant/30 flex items-center justify-between">
          <span className="text-xs text-on-surface-variant">Total: <strong className="text-on-surface">{pagination.total}</strong> laporan</span>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3 text-on-surface-variant text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Memuat...
          </div>
        ) : laporanList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-on-surface-variant">
            <FileText className="w-8 h-8 opacity-30" />
            <p className="text-sm">Tidak ada laporan ditemukan</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-container">
                  {['No', 'Tanggal', 'Siswa', 'Kelas', 'Tipe', 'Jenis', 'Poin', 'Pelapor', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold text-on-surface-variant uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/30">
                {laporanList.map((row, i) => (
                  <tr key={row.id} className="hover:bg-surface-container/40 transition-colors">
                    <td className="px-4 py-3 text-on-surface-variant">{(page - 1) * 20 + i + 1}</td>
                    <td className="px-4 py-3 text-on-surface-variant whitespace-nowrap">{formatDate(row.tanggal)}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-on-surface">{row.siswa.nama}</p>
                      <p className="text-xs text-on-surface-variant">{row.siswa.nis}</p>
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant whitespace-nowrap">{row.siswa?.kelas?.nama || '—'}</td>
                    <td className="px-4 py-3">
                      {row.tipe === 'KEBAIKAN'
                        ? <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded-lg text-xs font-bold"><Star className="w-3 h-3" /> Kebaikan</span>
                        : <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-700 rounded-lg text-xs font-bold"><AlertTriangle className="w-3 h-3" /> Pelanggaran</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-on-surface">{row.jenisKebaikan?.nama || row.jenisPelanggaran?.nama || '—'}</td>
                    <td className="px-4 py-3 font-bold">
                      <span className={row.tipe === 'KEBAIKAN' ? 'text-green-700' : 'text-red-700'}>{row.poin}</span>
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">{row.namaPelapor}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => setConfirm(row.id)} className="p-1.5 rounded-lg hover:bg-error/10 text-on-surface-variant hover:text-error transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-outline-variant/30">
            <p className="text-xs text-on-surface-variant">Hal. {pagination.page} dari {pagination.totalPages}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="p-1.5 rounded-lg border border-outline-variant text-on-surface-variant hover:bg-surface-container disabled:opacity-40 transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))} disabled={page >= pagination.totalPages}
                className="p-1.5 rounded-lg border border-outline-variant text-on-surface-variant hover:bg-surface-container disabled:opacity-40 transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {confirm && (
        <ConfirmModal
          message="Hapus laporan ini secara permanen?"
          onConfirm={() => handleDelete(confirm)}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

// ── Tab: Export ────────────────────────────────────────────────────────────────

function TabExport() {
  const [rekap, setRekap]         = useState<RekapRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);
  const [search, setSearch]       = useState('');
  const [dari, setDari]           = useState('');
  const [sampai, setSampai]       = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (dari)   p.set('dari', dari);
      if (sampai) p.set('sampai', sampai);
      const r: any = await api.get(`/api/dashboard/potensi?${p.toString()}`);
      setRekap(Array.isArray(r) ? r : []);
    } catch { toast.error('Gagal memuat data rekap'); }
    finally { setLoading(false); }
  }, [dari, sampai]);

  useEffect(() => { load(); }, [load]);

  const exportExcel = async () => {
    setExporting('excel');
    try {
      const p = new URLSearchParams();
      if (dari)   p.set('dari', dari);
      if (sampai) p.set('sampai', sampai);
      const blob = await api.getBlob(`/api/admin/potensi/export-excel?${p.toString()}`);
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a'); a.href = url; a.download = 'rekap-potensi.xlsx'; a.click();
      URL.revokeObjectURL(url);
      toast.success('Excel berhasil diunduh');
    } catch { toast.error('Gagal export Excel'); }
    finally { setExporting(null); }
  };

  const exportDocx = async (siswaId: string, nama: string) => {
    setExporting(siswaId);
    try {
      const body: Record<string, string> = { siswaId };
      if (dari)   body.dari   = dari;
      if (sampai) body.sampai = sampai;
      const blob = await api.postBlob('/api/admin/potensi/export-docx', body);
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a'); a.href = url; a.download = `potensi-${nama}.docx`; a.click();
      URL.revokeObjectURL(url);
      toast.success(`DOCX untuk ${nama} berhasil diunduh`);
    } catch { toast.error('Gagal export DOCX'); }
    finally { setExporting(null); }
  };

  const displayed = rekap.filter(r => !search || r.nama.toLowerCase().includes(search.toLowerCase()) || r.nis.includes(search));

  return (
    <div className="space-y-5">
      {/* Filter */}
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant p-4 space-y-4">
        <div className="flex flex-wrap gap-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-on-surface-variant">Dari Tanggal</label>
            <input type="date" value={dari} onChange={e => setDari(e.target.value)}
              className="px-3 py-2 border border-outline-variant rounded-xl text-sm focus:border-primary outline-none bg-surface" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-on-surface-variant">Sampai Tanggal</label>
            <input type="date" value={sampai} onChange={e => setSampai(e.target.value)}
              className="px-3 py-2 border border-outline-variant rounded-xl text-sm focus:border-primary outline-none bg-surface" />
          </div>
          <div className="flex items-end">
            <button onClick={() => { setDari(''); setSampai(''); }}
              className="px-3 py-2 border border-outline-variant rounded-xl text-sm font-semibold text-on-surface-variant hover:bg-surface-container transition-colors">Reset Filter</button>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Cari nama / NIS..."
              className="w-full pl-9 pr-3 py-2 border border-outline-variant rounded-xl text-sm focus:border-primary outline-none bg-surface" />
          </div>
          <button onClick={exportExcel} disabled={!!exporting || loading}
            className="flex items-center gap-2 px-5 py-2 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors">
            {exporting === 'excel' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Export Excel (Semua)
          </button>
        </div>
      </div>

      {/* Tabel per siswa + export DOCX */}
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant overflow-hidden">
        <div className="px-5 py-3 border-b border-outline-variant/30">
          <p className="text-xs text-on-surface-variant">Klik <strong>Export DOCX</strong> untuk unduh laporan per siswa</p>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3 text-on-surface-variant text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Memuat...
          </div>
        ) : displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-on-surface-variant">
            <FileText className="w-8 h-8 opacity-30" />
            <p className="text-sm">Tidak ada data</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-container">
                  {['No', 'Nama Siswa', 'Kelas', 'Kebaikan', 'Pelanggaran', 'Neto', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold text-on-surface-variant uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/30">
                {displayed.map((row, i) => (
                  <tr key={row.siswaId} className="hover:bg-surface-container/40 transition-colors">
                    <td className="px-4 py-3 text-on-surface-variant">{i + 1}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-on-surface">{row.nama}</p>
                      <p className="text-xs text-on-surface-variant">{row.nis}</p>
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">{row.kelas}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded-lg text-xs font-bold">
                        <Star className="w-3 h-3" /> {row.totalKebaikan}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-700 rounded-lg text-xs font-bold">
                        <AlertTriangle className="w-3 h-3" /> {row.totalPelanggaran}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {row.neto > 0
                        ? <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded-lg text-xs font-bold"><TrendingUp className="w-3 h-3" /> +{row.neto}</span>
                        : row.neto < 0
                        ? <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-700 rounded-lg text-xs font-bold"><TrendingDown className="w-3 h-3" /> {row.neto}</span>
                        : <span className="px-2 py-0.5 bg-surface-container text-on-surface-variant rounded-lg text-xs font-bold">0</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => exportDocx(row.siswaId, row.nama)}
                        disabled={!!exporting}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                      >
                        {exporting === row.siswaId ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
                        DOCX
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: 'kebaikan',    label: 'DB Kebaikan',    icon: Star },
  { key: 'pelanggaran', label: 'DB Pelanggaran', icon: AlertTriangle },
  { key: 'rekap',       label: 'Rekapitulasi',   icon: Eye },
  { key: 'export',      label: 'Export',         icon: Download },
];

export default function AdminPotensi() {
  const [tab, setTab] = useState<Tab>('rekap');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
          <ShieldCheck className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-on-surface">Manajemen Potensi Siswa</h2>
          <p className="text-sm text-on-surface-variant">Kelola kebaikan, pelanggaran, dan rekap potensi siswa</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-container-low p-1 rounded-xl w-fit overflow-x-auto">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${
              tab === key ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div>
        {tab === 'kebaikan'    && <TabJenis tipe="kebaikan" />}
        {tab === 'pelanggaran' && <TabJenis tipe="pelanggaran" />}
        {tab === 'rekap'       && <TabRekap />}
        {tab === 'export'      && <TabExport />}
      </div>
    </div>
  );
}
