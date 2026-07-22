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
  jenisKebaikanId: string | null
  jenisPelanggaranId: string | null
  jenis: string
  siswa: { id: string; nama: string; nis: string; kelas: string }
}

interface SiswaOption { id: string; nama: string; nis: string; kelas: string }

interface RekapRow {
  siswaId: string; nama: string; nis: string; kelas: string
  totalKebaikan: number; totalPelanggaran: number; neto: number
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

// ── Tab: Jenis (DB Kebaikan & DB Pelanggaran) ─────────────────────────────────

function TabJenis({ tipe }: { tipe: 'kebaikan' | 'pelanggaran' }) {
  const endpoint  = tipe === 'kebaikan' ? '/api/admin/jenis-kebaikan' : '/api/admin/jenis-pelanggaran';
  const labelTipe = tipe === 'kebaikan' ? 'Kebaikan' : 'Pelanggaran';
  const Icon      = tipe === 'kebaikan' ? Star : AlertTriangle;

  const [list, setList]         = useState<JenisItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [confirm, setConfirm]   = useState<string | null>(null);

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

  const openAdd  = () => { setEditId(null); setFormNama(''); setFormPoin(''); setFormErr({}); setShowForm(true); };
  const openEdit = (item: JenisItem) => { setEditId(item.id); setFormNama(item.nama); setFormPoin(String(item.poin)); setFormErr({}); setShowForm(true); };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!formNama.trim()) e.nama = 'Nama wajib diisi';
    const p = parseInt(formPoin);
    if (!formPoin || isNaN(p) || p < 1) e.poin = 'Poin harus angka positif';
    setFormErr(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const body = { nama: formNama.trim(), poin: parseInt(formPoin) };
      // Backend hanya punya PUT (bukan PATCH)
      if (editId) await api.put(`${endpoint}/${editId}`, body);
      else        await api.post(endpoint, body);
      toast.success(editId ? 'Berhasil diperbarui' : 'Berhasil ditambahkan');
      setShowForm(false);
      load();
    } catch (err: any) {
      toast.error(err?.message || 'Gagal menyimpan');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`${endpoint}/${id}`);
      toast.success('Berhasil dinonaktifkan');
      setConfirm(null);
      load();
    } catch { toast.error('Gagal menghapus'); }
  };

  return (
    <div className="space-y-5">
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

      {showForm && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-5 space-y-4">
          <h4 className="font-semibold text-on-surface text-sm">{editId ? `Edit ${labelTipe}` : `Tambah ${labelTipe} Baru`}</h4>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-on-surface-variant">Nama {labelTipe} <span className="text-error">*</span></label>
              <input
                type="text" value={formNama} onChange={e => setFormNama(e.target.value)}
                placeholder={`Contoh: ${tipe === 'kebaikan' ? 'Juara Olimpiade' : 'Terlambat Masuk'}`}
                className={`w-full px-3 py-2 border rounded-xl text-sm focus:border-primary outline-none bg-surface ${formErr.nama ? 'border-error' : 'border-outline-variant'}`}
              />
              {formErr.nama && <p className="text-xs text-error">{formErr.nama}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-on-surface-variant">Poin <span className="text-error">*</span></label>
              <input
                type="number" min="1" value={formPoin} onChange={e => setFormPoin(e.target.value)}
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
                {['No', 'Nama', 'Poin', 'Laporan', 'Status', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold text-on-surface-variant uppercase tracking-wider">{h}</th>
                ))}
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
                  <td className="px-4 py-3 text-center text-on-surface-variant">{item._count?.laporan ?? 0}</td>
                  <td className="px-4 py-3 text-center">
                    {item.isActive
                      ? <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded-lg text-xs font-semibold"><Check className="w-3 h-3" /> Aktif</span>
                      : <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-surface-container text-on-surface-variant rounded-lg text-xs font-semibold"><X className="w-3 h-3" /> Nonaktif</span>
                    }
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg hover:bg-surface-container text-on-surface-variant hover:text-primary transition-colors" title="Edit">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setConfirm(item.id)} className="p-1.5 rounded-lg hover:bg-error/10 text-on-surface-variant hover:text-error transition-colors" title="Nonaktifkan">
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

// ── Form Modal Laporan (Tambah & Edit) ─────────────────────────────────────────

interface LaporanFormData {
  siswaId: string
  tanggal: string
  tipe: 'KEBAIKAN' | 'PELANGGARAN'
  jenisId: string
  poin: string
  keterangan: string
  namaPelapor: string
}

const emptyForm = (): LaporanFormData => ({
  siswaId: '', tanggal: new Date().toISOString().slice(0, 10),
  tipe: 'KEBAIKAN', jenisId: '', poin: '', keterangan: '', namaPelapor: 'Admin',
});

interface FormModalProps {
  mode: 'add' | 'edit'
  initial: LaporanFormData
  editRow?: LaporanRow
  jenisKebaikan: JenisItem[]
  jenisPelanggaran: JenisItem[]
  siswaList: SiswaOption[]
  onClose: () => void
  onSaved: () => void
}

function FormModalLaporan({ mode, initial, editRow, jenisKebaikan, jenisPelanggaran, siswaList, onClose, onSaved }: FormModalProps) {
  const [form, setForm]   = useState<LaporanFormData>(initial);
  const [saving, setSaving] = useState(false);
  const [errs, setErrs]   = useState<Record<string, string>>({});
  const [siswaQ, setSiswaQ] = useState('');

  const jenisList = form.tipe === 'KEBAIKAN' ? jenisKebaikan : jenisPelanggaran;

  const setField = (k: keyof LaporanFormData, v: string) => {
    setForm(p => {
      const next = { ...p, [k]: v };
      if (k === 'tipe') { next.jenisId = ''; next.poin = ''; }
      if (k === 'jenisId' && v) {
        const found = jenisList.find(j => j.id === v);
        if (found) next.poin = String(found.poin);
      }
      return next;
    });
    setErrs(e => ({ ...e, [k]: '' }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (mode === 'add' && !form.siswaId) e.siswaId = 'Pilih siswa';
    if (!form.poin || Number(form.poin) < 1) e.poin = 'Poin harus angka positif';
    if (!form.namaPelapor.trim()) e.namaPelapor = 'Nama pelapor wajib diisi';
    setErrs(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const body = {
        ...(mode === 'add' ? { siswaId: form.siswaId } : {}),
        tanggal: form.tanggal,
        tipe: form.tipe,
        jenisId: form.jenisId || undefined,
        poin: Number(form.poin),
        keterangan: form.keterangan || null,
        namaPelapor: form.namaPelapor.trim(),
      };
      if (mode === 'edit' && editRow) {
        await api.put(`/api/admin/potensi/laporan/${editRow.id}`, body);
        toast.success('Laporan berhasil diperbarui');
      } else {
        await api.post('/api/admin/potensi/laporan', body);
        toast.success('Laporan berhasil ditambahkan');
      }
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Gagal menyimpan');
    } finally { setSaving(false); }
  };

  const filteredSiswa = siswaList.filter(s =>
    !siswaQ || s.nama.toLowerCase().includes(siswaQ.toLowerCase()) || s.nis.includes(siswaQ)
  ).slice(0, 50);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4 py-8 overflow-y-auto">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="px-6 py-5 border-b border-outline-variant flex items-center justify-between">
          <h3 className="font-bold text-on-surface">{mode === 'add' ? 'Tambah Laporan Potensi' : 'Edit Laporan Potensi'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-container text-on-surface-variant transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">

          {/* Siswa — hanya saat tambah */}
          {mode === 'add' ? (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-on-surface-variant">Siswa <span className="text-error">*</span></label>
              <input
                type="text" placeholder="Ketik nama atau NIS siswa..." value={siswaQ}
                onChange={e => { setSiswaQ(e.target.value); setField('siswaId', ''); }}
                className="w-full px-3 py-2 border border-outline-variant rounded-xl text-sm focus:border-primary outline-none bg-surface"
              />
              {(siswaQ || form.siswaId) && (
                <div className="max-h-40 overflow-y-auto border border-outline-variant rounded-xl divide-y divide-outline-variant/30 bg-surface">
                  {filteredSiswa.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-on-surface-variant">Tidak ditemukan</p>
                  ) : filteredSiswa.map(s => (
                    <button key={s.id} type="button"
                      onClick={() => { setField('siswaId', s.id); setSiswaQ(`${s.nama} (${s.nis})`); }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-container transition-colors flex items-center gap-2 ${form.siswaId === s.id ? 'bg-primary/5 font-semibold' : ''}`}
                    >
                      <span className="flex-1">{s.nama}</span>
                      <span className="text-xs text-on-surface-variant">{s.nis} · {s.kelas}</span>
                    </button>
                  ))}
                </div>
              )}
              {errs.siswaId && <p className="text-xs text-error">{errs.siswaId}</p>}
            </div>
          ) : (
            <div className="px-3 py-2 bg-surface-container rounded-xl text-sm">
              <span className="font-semibold text-on-surface">{editRow?.siswa.nama}</span>
              <span className="text-on-surface-variant ml-2">{editRow?.siswa.nis} · {editRow?.siswa.kelas}</span>
            </div>
          )}

          {/* Tanggal + Tipe */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-on-surface-variant">Tanggal</label>
              <input type="date" value={form.tanggal} onChange={e => setField('tanggal', e.target.value)}
                className="w-full px-3 py-2 border border-outline-variant rounded-xl text-sm focus:border-primary outline-none bg-surface" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-on-surface-variant">Tipe</label>
              <div className="flex gap-2">
                {(['KEBAIKAN', 'PELANGGARAN'] as const).map(t => (
                  <button key={t} type="button"
                    onClick={() => setField('tipe', t)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors ${form.tipe === t
                      ? t === 'KEBAIKAN' ? 'bg-green-600 text-white border-green-600' : 'bg-red-600 text-white border-red-600'
                      : 'border-outline-variant text-on-surface-variant hover:bg-surface-container'}`}
                  >
                    {t === 'KEBAIKAN' ? '★ Kebaikan' : '⚠ Pelanggaran'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Jenis + Poin */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-on-surface-variant">Jenis (opsional)</label>
              <select value={form.jenisId} onChange={e => setField('jenisId', e.target.value)}
                className="w-full px-3 py-2 border border-outline-variant rounded-xl text-sm focus:border-primary outline-none bg-surface">
                <option value="">— Pilih Jenis —</option>
                {jenisList.filter(j => j.isActive).map(j => (
                  <option key={j.id} value={j.id}>{j.nama} ({j.poin} poin)</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-on-surface-variant">Poin <span className="text-error">*</span></label>
              <input type="number" min="1" value={form.poin} onChange={e => setField('poin', e.target.value)}
                placeholder="Contoh: 10"
                className={`w-full px-3 py-2 border rounded-xl text-sm focus:border-primary outline-none bg-surface ${errs.poin ? 'border-error' : 'border-outline-variant'}`} />
              {errs.poin && <p className="text-xs text-error">{errs.poin}</p>}
            </div>
          </div>

          {/* Keterangan */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-on-surface-variant">Keterangan</label>
            <textarea value={form.keterangan} onChange={e => setField('keterangan', e.target.value)}
              placeholder="Deskripsi singkat..." rows={2}
              className="w-full px-3 py-2 border border-outline-variant rounded-xl text-sm focus:border-primary outline-none bg-surface resize-none" />
          </div>

          {/* Nama Pelapor */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-on-surface-variant">Nama Pelapor <span className="text-error">*</span></label>
            <input type="text" value={form.namaPelapor} onChange={e => setField('namaPelapor', e.target.value)}
              placeholder="Contoh: Admin / Bu Siti"
              className={`w-full px-3 py-2 border rounded-xl text-sm focus:border-primary outline-none bg-surface ${errs.namaPelapor ? 'border-error' : 'border-outline-variant'}`} />
            {errs.namaPelapor && <p className="text-xs text-error">{errs.namaPelapor}</p>}
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-outline-variant rounded-xl text-sm font-semibold text-on-surface-variant hover:bg-surface-container transition-colors">Batal</button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Simpan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Tab: Rekapitulasi ──────────────────────────────────────────────────────────

function TabRekap() {
  const [laporanList, setLaporanList]   = useState<LaporanRow[]>([]);
  const [pagination, setPagination]     = useState<Pagination>({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [loading, setLoading]           = useState(true);
  const [confirm, setConfirm]           = useState<string | null>(null);

  const [search, setSearch]     = useState('');
  const [tipeFil, setTipeFil]   = useState('');
  const [dari, setDari]         = useState('');
  const [sampai, setSampai]     = useState('');
  const [page, setPage]         = useState(1);

  // Jenis list untuk modal form
  const [jenisKebaikan, setJenisKebaikan]       = useState<JenisItem[]>([]);
  const [jenisPelanggaran, setJenisPelanggaran] = useState<JenisItem[]>([]);
  const [siswaList, setSiswaList]               = useState<SiswaOption[]>([]);

  // Modal state
  const [modal, setModal]     = useState<'add' | 'edit' | null>(null);
  const [editRow, setEditRow] = useState<LaporanRow | null>(null);

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
      setPagination({ total: r.total ?? 0, page: r.page ?? 1, limit: 20, totalPages: r.totalPages ?? 1 });
    } catch { toast.error('Gagal memuat rekap'); }
    finally { setLoading(false); }
  }, [search, tipeFil, dari, sampai, page]);

  useEffect(() => { load(); }, [load]);

  // Load jenis + siswa saat pertama kali
  useEffect(() => {
    Promise.all([
      api.get('/api/admin/jenis-kebaikan'),
      api.get('/api/admin/jenis-pelanggaran'),
      api.get('/api/admin/potensi/siswa-list'),
    ]).then(([kb, pl, sl]: any[]) => {
      setJenisKebaikan(Array.isArray(kb) ? kb : []);
      setJenisPelanggaran(Array.isArray(pl) ? pl : []);
      setSiswaList(Array.isArray(sl) ? sl : []);
    }).catch(() => {});
  }, []);

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/api/admin/potensi/laporan/${id}`);
      toast.success('Laporan dihapus');
      setConfirm(null);
      load();
    } catch { toast.error('Gagal menghapus'); }
  };

  const openEdit = (row: LaporanRow) => {
    setEditRow(row);
    setModal('edit');
  };

  const initialForEdit = (row: LaporanRow): LaporanFormData => ({
    siswaId: row.siswa.id,
    tanggal: row.tanggal,
    tipe: row.tipe,
    jenisId: (row.tipe === 'KEBAIKAN' ? row.jenisKebaikanId : row.jenisPelanggaranId) || '',
    poin: String(row.poin),
    keterangan: row.keterangan || '',
    namaPelapor: row.namaPelapor,
  });

  return (
    <div className="space-y-4">
      {/* Header + tambah */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="font-bold text-on-surface">Daftar Laporan</h3>
        <button
          onClick={() => setModal('add')}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" /> Tambah Laporan
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
          <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Cari nama / NIS..."
            className="w-full pl-9 pr-3 py-2 border border-outline-variant rounded-xl text-sm focus:border-primary outline-none bg-surface" />
        </div>
        <select value={tipeFil} onChange={e => { setTipeFil(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-outline-variant rounded-xl text-sm focus:border-primary outline-none bg-surface min-w-[140px]">
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
                    <td className="px-4 py-3 text-on-surface-variant whitespace-nowrap">{row.siswa?.kelas || '—'}</td>
                    <td className="px-4 py-3">
                      {row.tipe === 'KEBAIKAN'
                        ? <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded-lg text-xs font-bold"><Star className="w-3 h-3" /> Kebaikan</span>
                        : <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-700 rounded-lg text-xs font-bold"><AlertTriangle className="w-3 h-3" /> Pelanggaran</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-on-surface">{row.jenis}</td>
                    <td className="px-4 py-3 font-bold">
                      <span className={row.tipe === 'KEBAIKAN' ? 'text-green-700' : 'text-red-700'}>{row.poin}</span>
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">{row.namaPelapor}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(row)} className="p-1.5 rounded-lg hover:bg-surface-container text-on-surface-variant hover:text-primary transition-colors" title="Edit">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setConfirm(row.id)} className="p-1.5 rounded-lg hover:bg-error/10 text-on-surface-variant hover:text-error transition-colors" title="Hapus">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

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

      {modal === 'add' && (
        <FormModalLaporan
          mode="add" initial={emptyForm()}
          jenisKebaikan={jenisKebaikan} jenisPelanggaran={jenisPelanggaran} siswaList={siswaList}
          onClose={() => setModal(null)} onSaved={load}
        />
      )}
      {modal === 'edit' && editRow && (
        <FormModalLaporan
          mode="edit" initial={initialForEdit(editRow)} editRow={editRow}
          jenisKebaikan={jenisKebaikan} jenisPelanggaran={jenisPelanggaran} siswaList={siswaList}
          onClose={() => { setModal(null); setEditRow(null); }} onSaved={load}
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
                      <button onClick={() => exportDocx(row.siswaId, row.nama)} disabled={!!exporting}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap">
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
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
          <ShieldCheck className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-on-surface">Manajemen Potensi Siswa</h2>
          <p className="text-sm text-on-surface-variant">Kelola kebaikan, pelanggaran, dan rekap potensi siswa</p>
        </div>
      </div>

      <div className="flex gap-1 bg-surface-container-low p-1 rounded-xl w-fit overflow-x-auto">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${
              tab === key ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      <div>
        {tab === 'kebaikan'    && <TabJenis tipe="kebaikan" />}
        {tab === 'pelanggaran' && <TabJenis tipe="pelanggaran" />}
        {tab === 'rekap'       && <TabRekap />}
        {tab === 'export'      && <TabExport />}
      </div>
    </div>
  );
}
