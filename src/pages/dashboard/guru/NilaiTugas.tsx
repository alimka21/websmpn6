import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus, Edit2, Trash2, BookOpen, Loader2, X, Check, ChevronDown, Save,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '../../../lib/api';

// ── Types ──────────────────────────────────────────────────────────────────────

type Tab = 'daftar' | 'input';

interface KelasMeta { id: string; nama: string }

interface KolomNilai {
  id: string; judul: string; jenis: string; materi: string; mataPelajaran: string;
  tanggal: string; guruId: string;
  kelasTarget: { kelas: { id: string; nama: string } }[];
  _count: { nilai: number };
}

interface SiswaRow {
  siswaId: string; nama: string; nis: string; kelas: string;
  nilai: number | null; keterangan: string | null; nilaiId: string | null;
}

const JENIS_OPTIONS = [
  'UH', 'UTS', 'UAS', 'PR', 'ULANGAN_LISAN', 'PRAKTEK', 'LAINNYA',
];

const JENIS_LABEL: Record<string, string> = {
  UH: 'Ulangan Harian', UTS: 'UTS', UAS: 'UAS', PR: 'PR/Tugas Rumah',
  ULANGAN_LISAN: 'Ulangan Lisan', PRAKTEK: 'Praktek', LAINNYA: 'Lainnya',
};

function ConfirmModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-error/10 rounded-xl flex items-center justify-center shrink-0">
            <Trash2 className="w-5 h-5 text-error" />
          </div>
          <div>
            <h3 className="font-bold text-on-surface">Konfirmasi Hapus</h3>
            <p className="text-sm text-on-surface-variant mt-1">Hapus kolom nilai ini? Semua nilai siswa di kolom ini akan ikut terhapus.</p>
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

// ── Tab Daftar Kolom ───────────────────────────────────────────────────────────

function TabDaftar({ kelasList, onInputNilai }: {
  kelasList: KelasMeta[];
  onInputNilai: (kolom: KolomNilai) => void;
}) {
  const [list, setList]         = useState<KolomNilai[]>([]);
  const [loading, setLoading]   = useState(true);
  const [confirm, setConfirm]   = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<KolomNilai | null>(null);
  const [saving, setSaving]     = useState(false);

  // Form state
  const [fJudul, setFJudul]           = useState('');
  const [fJenis, setFJenis]           = useState('UH');
  const [fMateri, setFMateri]         = useState('');
  const [fMapel, setFMapel]           = useState('');
  const [fTanggal, setFTanggal]       = useState(() => new Date().toISOString().slice(0, 10));
  const [fKelasIds, setFKelasIds]     = useState<string[]>([]);
  const [fErrors, setFErrors]         = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try { const r: any = await api.get('/api/guru/kolom-nilai'); setList(Array.isArray(r) ? r : []); }
    catch { toast.error('Gagal memuat data kolom nilai'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setEditItem(null); setFJudul(''); setFJenis('UH'); setFMateri('');
    setFMapel(''); setFTanggal(new Date().toISOString().slice(0, 10));
    setFKelasIds([]); setFErrors({}); setShowForm(true);
  };

  const openEdit = (item: KolomNilai) => {
    setEditItem(item); setFJudul(item.judul); setFJenis(item.jenis); setFMateri(item.materi);
    setFMapel(item.mataPelajaran); setFTanggal(item.tanggal.slice(0, 10));
    setFKelasIds(item.kelasTarget.map(k => k.kelas.id)); setFErrors({}); setShowForm(true);
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!fJudul.trim())  e.judul = 'Judul wajib diisi';
    if (!fMateri.trim()) e.materi = 'Materi/bab wajib diisi';
    if (!fMapel.trim())  e.mapel = 'Mata pelajaran wajib diisi';
    if (fKelasIds.length === 0) e.kelas = 'Pilih minimal 1 kelas';
    setFErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    const body = { judul: fJudul.trim(), jenis: fJenis, materi: fMateri.trim(), mataPelajaran: fMapel.trim(), tanggal: fTanggal, kelasIds: fKelasIds };
    try {
      if (editItem) await api.patch(`/api/guru/kolom-nilai/${editItem.id}`, body);
      else          await api.post('/api/guru/kolom-nilai', body);
      toast.success(editItem ? 'Berhasil diperbarui' : 'Kolom nilai ditambahkan');
      setShowForm(false); load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Gagal menyimpan');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    try { await api.delete(`/api/guru/kolom-nilai/${id}`); toast.success('Kolom nilai dihapus'); setConfirm(null); load(); }
    catch { toast.error('Gagal menghapus'); }
  };

  const toggleKelas = (id: string) => setFKelasIds(prev =>
    prev.includes(id) ? prev.filter(k => k !== id) : [...prev, id]
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-on-surface">Daftar Kolom Nilai</h3>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" /> Tambah Kolom Nilai
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-5 space-y-4">
          <h4 className="font-semibold text-on-surface text-sm">{editItem ? 'Edit Kolom Nilai' : 'Tambah Kolom Nilai Baru'}</h4>
          <div className="grid sm:grid-cols-2 gap-4">
            {/* Judul */}
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-on-surface-variant">Judul <span className="text-error">*</span></label>
              <input type="text" value={fJudul} onChange={e => setFJudul(e.target.value)}
                placeholder="Contoh: Ulangan Lisan Bab 4"
                className={`w-full px-3 py-2 border rounded-xl text-sm focus:border-primary outline-none bg-surface ${fErrors.judul ? 'border-error' : 'border-outline-variant'}`} />
              {fErrors.judul && <p className="text-xs text-error">{fErrors.judul}</p>}
            </div>
            {/* Jenis */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-on-surface-variant">Jenis Tugas <span className="text-error">*</span></label>
              <div className="relative">
                <select value={fJenis} onChange={e => setFJenis(e.target.value)}
                  className="w-full px-3 py-2 border border-outline-variant rounded-xl text-sm focus:border-primary outline-none bg-surface appearance-none">
                  {JENIS_OPTIONS.map(j => <option key={j} value={j}>{JENIS_LABEL[j]}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none" />
              </div>
            </div>
            {/* Tanggal */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-on-surface-variant">Tanggal <span className="text-error">*</span></label>
              <input type="date" value={fTanggal} onChange={e => setFTanggal(e.target.value)}
                className="w-full px-3 py-2 border border-outline-variant rounded-xl text-sm focus:border-primary outline-none bg-surface" />
            </div>
            {/* Materi */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-on-surface-variant">Materi / Bab <span className="text-error">*</span></label>
              <input type="text" value={fMateri} onChange={e => setFMateri(e.target.value)}
                placeholder="Contoh: Bab 4 — Sistem Pencernaan"
                className={`w-full px-3 py-2 border rounded-xl text-sm focus:border-primary outline-none bg-surface ${fErrors.materi ? 'border-error' : 'border-outline-variant'}`} />
              {fErrors.materi && <p className="text-xs text-error">{fErrors.materi}</p>}
            </div>
            {/* Mata Pelajaran */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-on-surface-variant">Mata Pelajaran <span className="text-error">*</span></label>
              <input type="text" value={fMapel} onChange={e => setFMapel(e.target.value)}
                placeholder="Contoh: Biologi"
                className={`w-full px-3 py-2 border rounded-xl text-sm focus:border-primary outline-none bg-surface ${fErrors.mapel ? 'border-error' : 'border-outline-variant'}`} />
              {fErrors.mapel && <p className="text-xs text-error">{fErrors.mapel}</p>}
            </div>
          </div>

          {/* Kelas Target */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-on-surface-variant">Kelas Target <span className="text-error">*</span></label>
            <div className="flex flex-wrap gap-2">
              {kelasList.map(k => (
                <button key={k.id} type="button" onClick={() => toggleKelas(k.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border-2 transition-all ${fKelasIds.includes(k.id) ? 'bg-primary/10 border-primary text-primary' : 'border-outline-variant text-on-surface-variant hover:bg-surface-container'}`}>
                  {fKelasIds.includes(k.id) && <Check className="w-3 h-3 inline mr-1" />}
                  {k.nama}
                </button>
              ))}
            </div>
            {fErrors.kelas && <p className="text-xs text-error">{fErrors.kelas}</p>}
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
            <BookOpen className="w-8 h-8 opacity-30" />
            <p className="text-sm">Belum ada kolom nilai. Klik "Tambah Kolom Nilai" untuk mulai.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-container">
                  {['No', 'Judul', 'Jenis', 'Materi/Bab', 'Mata Pelajaran', 'Kelas', 'Tgl', 'Nilai', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold text-on-surface-variant uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/30">
                {list.map((item, i) => (
                  <tr key={item.id} className="hover:bg-surface-container/40 transition-colors">
                    <td className="px-4 py-3 text-on-surface-variant">{i + 1}</td>
                    <td className="px-4 py-3 font-semibold text-on-surface">{item.judul}</td>
                    <td className="px-4 py-3 text-on-surface-variant whitespace-nowrap">{JENIS_LABEL[item.jenis] || item.jenis}</td>
                    <td className="px-4 py-3 text-on-surface-variant">{item.materi}</td>
                    <td className="px-4 py-3 text-on-surface-variant">{item.mataPelajaran}</td>
                    <td className="px-4 py-3 text-on-surface-variant text-xs">
                      {item.kelasTarget.map(k => k.kelas.nama).join(', ')}
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant whitespace-nowrap text-xs">
                      {new Date(item.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded-lg text-xs font-semibold">
                        {item._count?.nilai ?? 0} siswa
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => onInputNilai(item)}
                          className="px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-xs font-semibold hover:bg-primary/20 transition-colors whitespace-nowrap">
                          Input Nilai
                        </button>
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
          </div>
        )}
      </div>

      {confirm && <ConfirmModal onConfirm={() => handleDelete(confirm)} onCancel={() => setConfirm(null)} />}
    </div>
  );
}

// ── Tab Input Nilai ────────────────────────────────────────────────────────────

function TabInputNilai({ initialKolom, kolomList, onKolomChange }: {
  initialKolom: KolomNilai | null;
  kolomList: KolomNilai[];
  onKolomChange: (k: KolomNilai | null) => void;
}) {
  const [selectedKolomId, setSelectedKolomId] = useState(initialKolom?.id || '');
  const [rows, setRows]                        = useState<SiswaRow[]>([]);
  const [loading, setLoading]                  = useState(false);
  const [savedSet, setSavedSet]                = useState<Set<string>>(new Set());
  const [savingSet, setSavingSet]              = useState<Set<string>>(new Set());
  const debounceRefs                           = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const selectedKolom = kolomList.find(k => k.id === selectedKolomId) || null;

  useEffect(() => {
    if (initialKolom) { setSelectedKolomId(initialKolom.id); }
  }, [initialKolom]);

  const loadNilai = useCallback(async (kolomId: string) => {
    if (!kolomId) { setRows([]); return; }
    setLoading(true);
    try {
      const r: any = await api.get(`/api/guru/kolom-nilai/${kolomId}/nilai`);
      setRows(r.rows || []);
      setSavedSet(new Set());
    } catch { toast.error('Gagal memuat data nilai'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadNilai(selectedKolomId); }, [selectedKolomId, loadNilai]);

  const handleNilaiChange = (siswaId: string, rawVal: string) => {
    const val = rawVal === '' ? null : Number(rawVal);
    setRows(prev => prev.map(r => r.siswaId === siswaId ? { ...r, nilai: val } : r));
    setSavedSet(prev => { const s = new Set(prev); s.delete(siswaId); return s; });

    clearTimeout(debounceRefs.current[siswaId]);
    debounceRefs.current[siswaId] = setTimeout(() => autoSave(siswaId, val), 800);
  };

  const autoSave = async (siswaId: string, nilai: number | null) => {
    setSavingSet(prev => new Set(prev).add(siswaId));
    try {
      await api.post(`/api/guru/kolom-nilai/${selectedKolomId}/nilai`, {
        entries: [{ siswaId, nilai }],
      });
      setSavedSet(prev => new Set(prev).add(siswaId));
    } catch { toast.error('Gagal menyimpan nilai'); }
    finally { setSavingSet(prev => { const s = new Set(prev); s.delete(siswaId); return s; }); }
  };

  const handleSaveAll = async () => {
    const entries = rows.map(r => ({ siswaId: r.siswaId, nilai: r.nilai }));
    try {
      await api.post(`/api/guru/kolom-nilai/${selectedKolomId}/nilai`, { entries });
      setSavedSet(new Set(rows.map(r => r.siswaId)));
      toast.success('Semua nilai disimpan');
    } catch { toast.error('Gagal menyimpan nilai'); }
  };

  return (
    <div className="space-y-5">
      {/* Pilih kolom */}
      <div className="flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[240px] space-y-1.5">
          <label className="text-xs font-semibold text-on-surface-variant">Pilih Kolom Nilai</label>
          <div className="relative">
            <select value={selectedKolomId} onChange={e => {
              setSelectedKolomId(e.target.value);
              onKolomChange(kolomList.find(k => k.id === e.target.value) || null);
            }}
              className="w-full px-3 py-2 border border-outline-variant rounded-xl text-sm focus:border-primary outline-none bg-surface appearance-none">
              <option value="">-- Pilih kolom nilai --</option>
              {kolomList.map(k => (
                <option key={k.id} value={k.id}>{k.judul} ({k.kelasTarget.map(t => t.kelas.nama).join(', ')})</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none" />
          </div>
        </div>
        {selectedKolom && rows.length > 0 && (
          <button onClick={handleSaveAll}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors">
            <Save className="w-4 h-4" /> Simpan Semua
          </button>
        )}
      </div>

      {selectedKolom && (
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'Jenis', value: JENIS_LABEL[selectedKolom.jenis] || selectedKolom.jenis },
            { label: 'Materi', value: selectedKolom.materi },
            { label: 'Mapel', value: selectedKolom.mataPelajaran },
            { label: 'Kelas', value: selectedKolom.kelasTarget.map(k => k.kelas.nama).join(', ') },
          ].map(({ label, value }) => (
            <span key={label} className="px-3 py-1.5 bg-surface-container rounded-xl text-xs">
              <span className="text-on-surface-variant">{label}:</span> <strong className="text-on-surface">{value}</strong>
            </span>
          ))}
        </div>
      )}

      {/* Grid nilai */}
      {!selectedKolomId && (
        <div className="flex flex-col items-center justify-center py-16 gap-2 text-on-surface-variant">
          <BookOpen className="w-8 h-8 opacity-30" />
          <p className="text-sm">Pilih kolom nilai untuk mulai input</p>
        </div>
      )}

      {selectedKolomId && loading && (
        <div className="flex items-center justify-center py-16 gap-3 text-on-surface-variant text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Memuat data siswa...
        </div>
      )}

      {selectedKolomId && !loading && rows.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-2 text-on-surface-variant">
          <BookOpen className="w-8 h-8 opacity-30" />
          <p className="text-sm">Tidak ada siswa di kelas yang dipilih</p>
        </div>
      )}

      {selectedKolomId && !loading && rows.length > 0 && (
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant overflow-hidden">
          <div className="px-5 py-3 border-b border-outline-variant/30 flex items-center justify-between">
            <p className="text-xs text-on-surface-variant">
              {rows.filter(r => r.nilai !== null).length}/{rows.length} siswa sudah dinilai
            </p>
            <p className="text-xs text-on-surface-variant italic">Nilai disimpan otomatis saat selesai mengisi</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-container">
                  {['No', 'Nama Siswa', 'NIS', 'Kelas', 'Nilai (0–100)', 'Status'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold text-on-surface-variant uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/30">
                {rows.map((row, i) => (
                  <tr key={row.siswaId} className="hover:bg-surface-container/40 transition-colors">
                    <td className="px-4 py-3 text-on-surface-variant">{i + 1}</td>
                    <td className="px-4 py-3 font-semibold text-on-surface">{row.nama}</td>
                    <td className="px-4 py-3 text-on-surface-variant">{row.nis}</td>
                    <td className="px-4 py-3 text-on-surface-variant">{row.kelas}</td>
                    <td className="px-4 py-3">
                      <input
                        type="number" min="0" max="100" step="0.5"
                        value={row.nilai ?? ''}
                        onChange={e => handleNilaiChange(row.siswaId, e.target.value)}
                        onBlur={e => {
                          clearTimeout(debounceRefs.current[row.siswaId]);
                          autoSave(row.siswaId, e.target.value === '' ? null : Number(e.target.value));
                        }}
                        placeholder="—"
                        className="w-24 px-3 py-1.5 border border-outline-variant rounded-xl text-sm focus:border-primary outline-none bg-surface text-center font-semibold"
                      />
                    </td>
                    <td className="px-4 py-3">
                      {savingSet.has(row.siswaId) ? (
                        <span className="text-xs text-on-surface-variant flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" /> Menyimpan...
                        </span>
                      ) : savedSet.has(row.siswaId) ? (
                        <span className="text-xs text-green-600 flex items-center gap-1">
                          <Check className="w-3 h-3" /> Tersimpan
                        </span>
                      ) : row.nilai !== null ? (
                        <span className="text-xs text-on-surface-variant opacity-60">Ada nilai</span>
                      ) : (
                        <span className="text-xs text-on-surface-variant opacity-40">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function NilaiTugas() {
  const [tab, setTab]               = useState<Tab>('daftar');
  const [kelasList, setKelasList]   = useState<KelasMeta[]>([]);
  const [kolomList, setKolomList]   = useState<KolomNilai[]>([]);
  const [inputKolom, setInputKolom] = useState<KolomNilai | null>(null);

  useEffect(() => {
    api.get('/api/guru/kelas').then((r: any) => setKelasList(Array.isArray(r) ? r : [])).catch(() => {});
    api.get('/api/guru/kolom-nilai').then((r: any) => setKolomList(Array.isArray(r) ? r : [])).catch(() => {});
  }, []);

  const handleInputNilai = (kolom: KolomNilai) => {
    setInputKolom(kolom);
    setTab('input');
    // Refresh list juga
    api.get('/api/guru/kolom-nilai').then((r: any) => setKolomList(Array.isArray(r) ? r : [])).catch(() => {});
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
          <BookOpen className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-on-surface">Nilai & Tugas</h2>
          <p className="text-sm text-on-surface-variant">Kelola kolom nilai dan input nilai siswa untuk tugas/ulangan non-ujian</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-container-low p-1 rounded-xl w-fit">
        {[
          { key: 'daftar', label: 'Daftar Kolom' },
          { key: 'input',  label: 'Input Nilai' },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key as Tab)}
            className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${tab === key ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'daftar' && (
        <TabDaftar kelasList={kelasList} onInputNilai={handleInputNilai} />
      )}
      {tab === 'input' && (
        <TabInputNilai
          initialKolom={inputKolom}
          kolomList={kolomList}
          onKolomChange={setInputKolom}
        />
      )}
    </div>
  );
}
