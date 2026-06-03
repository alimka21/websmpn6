import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  FileText, Calendar, Plus, Edit2, Trash2, X,
  ExternalLink, Eye, EyeOff, ArrowUp, ArrowDown,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import api from '../../lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Dokumen {
  id: string; judul: string; linkDrive: string; urutan: number; isActive: boolean;
}

interface Agenda {
  id: string; judul: string; waktu: string; lokasi: string | null; isActive: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtWaktu = (iso: string) =>
  new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) +
  ' · ' +
  new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

const toDatetimeLocal = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
};

// ── Main ──────────────────────────────────────────────────────────────────────

type Tab = 'dokumen' | 'agenda';

export default function DokumenAgendaAdmin() {
  const [tab, setTab] = useState<Tab>('dokumen');

  // ── Dokumen state ────────────────────────────────────────────────────────
  const [dokumen, setDokumen]       = useState<Dokumen[]>([]);
  const [loadingDok, setLoadingDok] = useState(false);
  const [showDokForm, setShowDokForm] = useState(false);
  const [editDok, setEditDok]       = useState<Dokumen | null>(null);
  const [delDokId, setDelDokId]     = useState<string | null>(null);
  const [deletingDok, setDeletingDok] = useState(false);
  const [dokForm, setDokForm]       = useState({ judul: '', linkDrive: '', urutan: '0' });
  const [savingDok, setSavingDok]   = useState(false);

  // ── Agenda state ─────────────────────────────────────────────────────────
  const [agenda, setAgenda]         = useState<Agenda[]>([]);
  const [loadingAgd, setLoadingAgd] = useState(false);
  const [showAgdForm, setShowAgdForm] = useState(false);
  const [editAgd, setEditAgd]       = useState<Agenda | null>(null);
  const [delAgdId, setDelAgdId]     = useState<string | null>(null);
  const [deletingAgd, setDeletingAgd] = useState(false);
  const [agdForm, setAgdForm]       = useState({ judul: '', waktu: '', lokasi: '' });
  const [savingAgd, setSavingAgd]   = useState(false);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const loadDokumen = useCallback(async () => {
    setLoadingDok(true);
    try { setDokumen(await api.get('/api/dokumen/all') as Dokumen[]); }
    catch { toast.error('Gagal memuat dokumen'); }
    finally { setLoadingDok(false); }
  }, []);

  const loadAgenda = useCallback(async () => {
    setLoadingAgd(true);
    try { setAgenda(await api.get('/api/agenda/all') as Agenda[]); }
    catch { toast.error('Gagal memuat agenda'); }
    finally { setLoadingAgd(false); }
  }, []);

  useEffect(() => { if (tab === 'dokumen') loadDokumen(); }, [tab, loadDokumen]);
  useEffect(() => { if (tab === 'agenda') loadAgenda(); }, [tab, loadAgenda]);

  // ── Dokumen CRUD ─────────────────────────────────────────────────────────
  const openAddDok = () => {
    setEditDok(null);
    setDokForm({ judul: '', linkDrive: '', urutan: String(dokumen.length) });
    setShowDokForm(true);
  };

  const openEditDok = (d: Dokumen) => {
    setEditDok(d);
    setDokForm({ judul: d.judul, linkDrive: d.linkDrive, urutan: String(d.urutan) });
    setShowDokForm(true);
  };

  const submitDok = async () => {
    if (!dokForm.judul.trim()) return toast.error('Judul wajib diisi');
    if (!dokForm.linkDrive.trim()) return toast.error('Link Google Drive wajib diisi');
    setSavingDok(true);
    try {
      if (editDok) {
        await api.patch(`/api/dokumen/${editDok.id}`, dokForm);
        toast.success('Dokumen diperbarui');
      } else {
        await api.post('/api/dokumen', dokForm);
        toast.success('Dokumen ditambahkan');
      }
      setShowDokForm(false);
      loadDokumen();
    } catch { toast.error('Gagal menyimpan dokumen'); }
    finally { setSavingDok(false); }
  };

  const toggleDok = async (d: Dokumen) => {
    try {
      await api.patch(`/api/dokumen/${d.id}`, { isActive: !d.isActive });
      toast.success(d.isActive ? 'Dokumen disembunyikan' : 'Dokumen diaktifkan');
      loadDokumen();
    } catch { toast.error('Gagal mengubah status'); }
  };

  const confirmDelDok = async () => {
    if (!delDokId) return;
    setDeletingDok(true);
    try {
      await api.delete(`/api/dokumen/${delDokId}`);
      toast.success('Dokumen dihapus');
      setDelDokId(null);
      loadDokumen();
    } catch { toast.error('Gagal menghapus dokumen'); }
    finally { setDeletingDok(false); }
  };

  const moveUrutan = async (id: string, dir: 'up' | 'down') => {
    const idx = dokumen.findIndex(d => d.id === id);
    const other = dir === 'up' ? dokumen[idx - 1] : dokumen[idx + 1];
    if (!other) return;
    try {
      await Promise.all([
        api.patch(`/api/dokumen/${id}`, { urutan: other.urutan }),
        api.patch(`/api/dokumen/${other.id}`, { urutan: dokumen[idx].urutan }),
      ]);
      loadDokumen();
    } catch { toast.error('Gagal mengubah urutan'); }
  };

  // ── Agenda CRUD ───────────────────────────────────────────────────────────
  const openAddAgd = () => {
    setEditAgd(null);
    setAgdForm({ judul: '', waktu: '', lokasi: '' });
    setShowAgdForm(true);
  };

  const openEditAgd = (a: Agenda) => {
    setEditAgd(a);
    setAgdForm({ judul: a.judul, waktu: toDatetimeLocal(a.waktu), lokasi: a.lokasi || '' });
    setShowAgdForm(true);
  };

  const submitAgd = async () => {
    if (!agdForm.judul.trim()) return toast.error('Judul agenda wajib diisi');
    if (!agdForm.waktu) return toast.error('Waktu agenda wajib diisi');
    setSavingAgd(true);
    try {
      if (editAgd) {
        await api.patch(`/api/agenda/${editAgd.id}`, agdForm);
        toast.success('Agenda diperbarui');
      } else {
        await api.post('/api/agenda', agdForm);
        toast.success('Agenda ditambahkan');
      }
      setShowAgdForm(false);
      loadAgenda();
    } catch { toast.error('Gagal menyimpan agenda'); }
    finally { setSavingAgd(false); }
  };

  const toggleAgd = async (a: Agenda) => {
    try {
      await api.patch(`/api/agenda/${a.id}`, { isActive: !a.isActive });
      toast.success(a.isActive ? 'Agenda disembunyikan' : 'Agenda diaktifkan');
      loadAgenda();
    } catch { toast.error('Gagal mengubah status'); }
  };

  const confirmDelAgd = async () => {
    if (!delAgdId) return;
    setDeletingAgd(true);
    try {
      await api.delete(`/api/agenda/${delAgdId}`);
      toast.success('Agenda dihapus');
      setDelAgdId(null);
      loadAgenda();
    } catch { toast.error('Gagal menghapus agenda'); }
    finally { setDeletingAgd(false); }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Tabs */}
      <div className="flex p-1.5 bg-surface-container rounded-2xl w-fit">
        {([
          { key: 'dokumen', label: 'Dokumen Sekolah', Icon: FileText },
          { key: 'agenda',  label: 'Agenda Sekolah',  Icon: Calendar },
        ] as { key: Tab; label: string; Icon: React.ElementType }[]).map(({ key, label, Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${tab === key ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant hover:text-primary'}`}>
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {/* ── TAB: DOKUMEN ── */}
      {tab === 'dokumen' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-on-surface-variant">
              {dokumen.filter(d => d.isActive).length} aktif dari {dokumen.length} dokumen
              <span className="ml-2 text-xs text-on-surface-variant/60">· Maks. 5 tampil di halaman utama</span>
            </p>
            <Button onClick={openAddDok} className="gap-2">
              <Plus className="w-4 h-4" /> Tambah Dokumen
            </Button>
          </div>

          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant overflow-hidden shadow-[0px_4px_20px_rgba(0,0,0,0.03)]">
            {loadingDok ? (
              <div className="py-16 text-center text-on-surface-variant">Memuat...</div>
            ) : dokumen.length === 0 ? (
              <div className="py-16 text-center space-y-2">
                <FileText className="w-10 h-10 text-outline mx-auto" />
                <p className="text-on-surface-variant">Belum ada dokumen. Klik tombol Tambah untuk mulai.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-outline-variant">
                    <th className="px-5 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider w-20">Urutan</th>
                    <th className="px-5 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Judul Dokumen</th>
                    <th className="px-5 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Link</th>
                    <th className="px-5 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Status</th>
                    <th className="px-5 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/40">
                  {dokumen.map((d, idx) => (
                    <tr key={d.id} className="hover:bg-surface-container-low/50 transition-colors group">
                      <td className="px-5 py-4">
                        <div className="flex gap-1">
                          <button onClick={() => moveUrutan(d.id, 'up')} disabled={idx === 0}
                            className="p-1 rounded hover:bg-surface-container disabled:opacity-20 transition-colors">
                            <ArrowUp className="w-3.5 h-3.5 text-on-surface-variant" />
                          </button>
                          <button onClick={() => moveUrutan(d.id, 'down')} disabled={idx === dokumen.length - 1}
                            className="p-1 rounded hover:bg-surface-container disabled:opacity-20 transition-colors">
                            <ArrowDown className="w-3.5 h-3.5 text-on-surface-variant" />
                          </button>
                        </div>
                      </td>
                      <td className="px-5 py-4 font-semibold text-on-surface max-w-[200px] truncate">
                        {d.judul}
                      </td>
                      <td className="px-5 py-4">
                        <a href={d.linkDrive} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline max-w-[200px] truncate">
                          <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">Buka Dokumen</span>
                        </a>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${d.isActive ? 'bg-primary-fixed text-primary' : 'bg-surface-container text-on-surface-variant'}`}>
                          {d.isActive ? 'Aktif' : 'Disembunyikan'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-1 flex">
                          <button onClick={() => toggleDok(d)}
                            className={`p-2 rounded-lg transition-colors ${d.isActive ? 'text-on-surface-variant hover:bg-surface-container' : 'text-primary hover:bg-primary/10'}`}
                            title={d.isActive ? 'Sembunyikan' : 'Aktifkan'}>
                            {d.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                          <button onClick={() => openEditDok(d)} className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors" title="Edit">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => setDelDokId(d.id)} className="p-2 text-error hover:bg-error/10 rounded-lg transition-colors" title="Hapus">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: AGENDA ── */}
      {tab === 'agenda' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-on-surface-variant">
              {agenda.filter(a => a.isActive).length} aktif dari {agenda.length} agenda
              <span className="ml-2 text-xs text-on-surface-variant/60">· Maks. 5 tampil di halaman utama</span>
            </p>
            <Button onClick={openAddAgd} className="gap-2">
              <Plus className="w-4 h-4" /> Tambah Agenda
            </Button>
          </div>

          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant overflow-hidden shadow-[0px_4px_20px_rgba(0,0,0,0.03)]">
            {loadingAgd ? (
              <div className="py-16 text-center text-on-surface-variant">Memuat...</div>
            ) : agenda.length === 0 ? (
              <div className="py-16 text-center space-y-2">
                <Calendar className="w-10 h-10 text-outline mx-auto" />
                <p className="text-on-surface-variant">Belum ada agenda. Klik tombol Tambah untuk mulai.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-outline-variant">
                    <th className="px-5 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Agenda</th>
                    <th className="px-5 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Waktu</th>
                    <th className="px-5 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Lokasi</th>
                    <th className="px-5 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Status</th>
                    <th className="px-5 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/40">
                  {agenda.map(a => (
                    <tr key={a.id} className="hover:bg-surface-container-low/50 transition-colors group">
                      <td className="px-5 py-4 font-semibold text-on-surface">{a.judul}</td>
                      <td className="px-5 py-4 text-sm text-on-surface-variant whitespace-nowrap">{fmtWaktu(a.waktu)}</td>
                      <td className="px-5 py-4 text-sm text-on-surface-variant">{a.lokasi || '—'}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${a.isActive ? 'bg-primary-fixed text-primary' : 'bg-surface-container text-on-surface-variant'}`}>
                          {a.isActive ? 'Aktif' : 'Disembunyikan'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-1 flex">
                          <button onClick={() => toggleAgd(a)}
                            className={`p-2 rounded-lg transition-colors ${a.isActive ? 'text-on-surface-variant hover:bg-surface-container' : 'text-primary hover:bg-primary/10'}`}
                            title={a.isActive ? 'Sembunyikan' : 'Aktifkan'}>
                            {a.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                          <button onClick={() => openEditAgd(a)} className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors" title="Edit">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => setDelAgdId(a.id)} className="p-2 text-error hover:bg-error/10 rounded-lg transition-colors" title="Hapus">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── Modal: Dokumen Form ── */}
      {showDokForm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-on-surface/40 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-xl">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-outline-variant">
              <h3 className="font-semibold text-on-surface">{editDok ? 'Edit Dokumen' : 'Tambah Dokumen'}</h3>
              <button onClick={() => setShowDokForm(false)} className="p-1.5 rounded-lg hover:bg-surface-container text-on-surface-variant">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-on-surface-variant">Judul Dokumen</label>
                <input value={dokForm.judul} onChange={e => setDokForm(p => ({ ...p, judul: e.target.value }))}
                  placeholder="Contoh: Kurikulum 2024"
                  className="w-full px-3 py-2.5 border border-outline-variant rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-on-surface-variant">Link Google Drive</label>
                <input value={dokForm.linkDrive} onChange={e => setDokForm(p => ({ ...p, linkDrive: e.target.value }))}
                  placeholder="https://drive.google.com/file/d/..."
                  className="w-full px-3 py-2.5 border border-outline-variant rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none" />
                <p className="text-xs text-on-surface-variant">Pastikan link sudah dibagikan publik (Anyone with the link)</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-on-surface-variant">Urutan Tampil</label>
                <input type="number" min="0" value={dokForm.urutan} onChange={e => setDokForm(p => ({ ...p, urutan: e.target.value }))}
                  className="w-28 px-3 py-2.5 border border-outline-variant rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none" />
                <p className="text-xs text-on-surface-variant">Angka lebih kecil = tampil lebih awal</p>
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <Button variant="outline" onClick={() => setShowDokForm(false)} disabled={savingDok} className="flex-1">Batal</Button>
              <Button onClick={submitDok} disabled={savingDok} className="flex-1">
                {savingDok ? 'Menyimpan...' : (editDok ? 'Simpan Perubahan' : 'Tambahkan')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Agenda Form ── */}
      {showAgdForm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-on-surface/40 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-xl">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-outline-variant">
              <h3 className="font-semibold text-on-surface">{editAgd ? 'Edit Agenda' : 'Tambah Agenda'}</h3>
              <button onClick={() => setShowAgdForm(false)} className="p-1.5 rounded-lg hover:bg-surface-container text-on-surface-variant">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-on-surface-variant">Judul Agenda</label>
                <input value={agdForm.judul} onChange={e => setAgdForm(p => ({ ...p, judul: e.target.value }))}
                  placeholder="Contoh: Rapat Orang Tua Murid"
                  className="w-full px-3 py-2.5 border border-outline-variant rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-on-surface-variant">Waktu Pelaksanaan</label>
                <input type="datetime-local" value={agdForm.waktu} onChange={e => setAgdForm(p => ({ ...p, waktu: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-outline-variant rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-on-surface-variant">Lokasi <span className="text-on-surface-variant/60">(opsional)</span></label>
                <input value={agdForm.lokasi} onChange={e => setAgdForm(p => ({ ...p, lokasi: e.target.value }))}
                  placeholder="Contoh: Aula Utama"
                  className="w-full px-3 py-2.5 border border-outline-variant rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none" />
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <Button variant="outline" onClick={() => setShowAgdForm(false)} disabled={savingAgd} className="flex-1">Batal</Button>
              <Button onClick={submitAgd} disabled={savingAgd} className="flex-1">
                {savingAgd ? 'Menyimpan...' : (editAgd ? 'Simpan Perubahan' : 'Tambahkan')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm Delete Dokumen ── */}
      {delDokId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-on-surface/40 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-xl p-6 text-center space-y-4">
            <div className="w-12 h-12 bg-error-container rounded-full flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6 text-error" />
            </div>
            <h3 className="font-semibold text-on-surface">Hapus dokumen ini?</h3>
            <p className="text-sm text-on-surface-variant">Data yang dihapus tidak bisa dikembalikan.</p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setDelDokId(null)} disabled={deletingDok} className="flex-1">Batal</Button>
              <Button variant="destructive" onClick={confirmDelDok} disabled={deletingDok} className="flex-1">
                {deletingDok ? 'Menghapus...' : 'Hapus'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm Delete Agenda ── */}
      {delAgdId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-on-surface/40 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-xl p-6 text-center space-y-4">
            <div className="w-12 h-12 bg-error-container rounded-full flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6 text-error" />
            </div>
            <h3 className="font-semibold text-on-surface">Hapus agenda ini?</h3>
            <p className="text-sm text-on-surface-variant">Data yang dihapus tidak bisa dikembalikan.</p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setDelAgdId(null)} disabled={deletingAgd} className="flex-1">Batal</Button>
              <Button variant="destructive" onClick={confirmDelAgd} disabled={deletingAgd} className="flex-1">
                {deletingAgd ? 'Menghapus...' : 'Hapus'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
