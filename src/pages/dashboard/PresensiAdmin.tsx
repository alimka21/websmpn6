import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Settings, Users, GraduationCap, Save, Trash2, Edit2, X,
  ChevronLeft, ChevronRight, Search, RefreshCw, MapPin, Clock,
  Image as ImageIcon, Download,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import api from '../../lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Pengaturan {
  id?: string;
  latitudeSekolah: number;
  longitudeSekolah: number;
  radiusMeter: number;
  jamMasukDefault: string;
  jamPulangDefault: string;
}

interface PengaturanForm {
  koordinatSekolah: string; // Combined "lat, lng" format
  radiusMeter: number;
  jamMasukDefault: string;
  jamPulangDefault: string;
}

interface PresensiGuruRow {
  no: number; id: string; nama: string; nip: string;
  tanggal: string; waktuDatang: string | null; waktuPulang: string | null;
  durasi: number | null; autoCheckout: boolean;
  fotoDatang: string | null; fotoPulang: string | null;
  keterlambatan: number; totalJam: number;
}

interface PresensiSiswaRow {
  no: number; id: string; nis: string; nama: string; kelas: string;
  tanggal: string; waktuDatang: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtTime = (d: string | null) =>
  d ? new Date(d).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '—';

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const fmtDurasi = (m: number | null) => {
  if (m === null) return '—';
  const h = Math.floor(m / 60), min = m % 60;
  return h > 0 ? `${h}j ${min}m` : `${min}m`;
};

const toDatetimeLocal = (d: string | null) => {
  if (!d) return '';
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}T${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`;
};

const nowYear = new Date().getFullYear();
const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

// ── Sub-component: FotoThumb ──────────────────────────────────────────────────

function FotoThumb({ src, label }: { src: string | null; label: string }) {
  const [open, setOpen] = useState(false);
  if (!src) return <span className="text-on-surface-variant/40 text-sm">—</span>;
  return (
    <>
      <button onClick={() => setOpen(true)} className="group relative" title={`Lihat ${label}`}>
        <img src={src} alt={label} className="w-10 h-10 rounded-lg object-cover border border-outline-variant group-hover:scale-110 transition-transform" />
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <ImageIcon className="w-2.5 h-2.5 text-white" />
        </span>
      </button>
      {open && (
        <div className="fixed inset-0 z-[70] bg-on-surface/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <img src={src} alt={label} className="max-w-sm max-h-[80vh] rounded-2xl shadow-2xl object-contain" />
        </div>
      )}
    </>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

type Tab = 'pengaturan' | 'guru' | 'siswa';

export default function PresensiAdmin() {
  const [tab, setTab] = useState<Tab>('guru');

  // ── Pengaturan state ─────────────────────────────────────────────────────
  const [cfg, setCfg] = useState<Pengaturan>({
    latitudeSekolah: 0, longitudeSekolah: 0, radiusMeter: 100,
    jamMasukDefault: '07:00', jamPulangDefault: '15:30',
  });
  const [cfgForm, setCfgForm] = useState<PengaturanForm>({
    koordinatSekolah: '',
    radiusMeter: 100,
    jamMasukDefault: '07:00',
    jamPulangDefault: '15:30',
  });
  const [savingCfg, setSavingCfg] = useState(false);

  // ── Guru presensi state ──────────────────────────────────────────────────
  const [guruRows, setGuruRows]     = useState<PresensiGuruRow[]>([]);
  const [guruTotal, setGuruTotal]   = useState(0);
  const [guruPage, setGuruPage]     = useState(1);
  const [guruPages, setGuruPages]   = useState(1);
  const [loadingGuru, setLoadingGuru] = useState(false);
  const [guruTanggal, setGuruTanggal] = useState('');
  const [guruBulan, setGuruBulan]   = useState(String(new Date().getMonth() + 1));
  const [guruTahun, setGuruTahun]   = useState(String(nowYear));
  const [guruMode, setGuruMode]     = useState<'hari' | 'bulan'>('hari');
  const [editTarget, setEditTarget] = useState<PresensiGuruRow | null>(null);
  const [editDatang, setEditDatang] = useState('');
  const [editPulang, setEditPulang] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [delGuruId, setDelGuruId]   = useState<string | null>(null);
  const [deletingGuru, setDeletingGuru] = useState(false);

  // ── Siswa presensi state ─────────────────────────────────────────────────
  const [siswaRows, setSiswaRows]   = useState<PresensiSiswaRow[]>([]);
  const [siswaTotal, setSiswaTotal] = useState(0);
  const [siswaPage, setSiswaPage]   = useState(1);
  const [siswaPages, setSiswaPages] = useState(1);
  const [loadingSiswa, setLoadingSiswa] = useState(false);
  const [siswaTanggal, setSiswaTanggal] = useState('');
  const [siswaBulan, setSiswaBulan] = useState(String(new Date().getMonth() + 1));
  const [siswaTahun, setSiswaTahun] = useState(String(nowYear));
  const [siswaMode, setSiswaMode]   = useState<'hari' | 'bulan'>('hari');
  const [siswaSearch, setSiswaSearch] = useState('');
  const [delSiswaId, setDelSiswaId] = useState<string | null>(null);
  const [deletingSiswa, setDeletingSiswa] = useState(false);
  const [exportingGuru, setExportingGuru] = useState(false);
  const [exportingSiswa, setExportingSiswa] = useState(false);

  // ── Load pengaturan ──────────────────────────────────────────────────────
  useEffect(() => {
    api.get('/api/presensi/pengaturan')
      .then((d: any) => {
        setCfg(d);
        // Convert to form format
        const koordinat = d.latitudeSekolah && d.longitudeSekolah
          ? `${d.latitudeSekolah}, ${d.longitudeSekolah}`
          : '';
        setCfgForm({
          koordinatSekolah: koordinat,
          radiusMeter: d.radiusMeter || 100,
          jamMasukDefault: d.jamMasukDefault || '07:00',
          jamPulangDefault: d.jamPulangDefault || '15:30',
        });
      })
      .catch(() => {});
  }, []);

  // ── Load guru presensi ───────────────────────────────────────────────────
  const loadGuru = useCallback(async (page = 1) => {
    setLoadingGuru(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (guruMode === 'hari' && guruTanggal) params.set('tanggal', guruTanggal);
      else if (guruMode === 'bulan') { params.set('bulan', guruBulan); params.set('tahun', guruTahun); }
      else params.set('tanggal', new Date().toISOString().slice(0, 10));

      const r: any = await api.get(`/api/presensi/guru/dashboard?${params}`);
      setGuruRows(r.data || []);
      setGuruTotal(r.total || 0);
      setGuruPage(r.page || 1);
      setGuruPages(r.totalPages || 1);
    } catch { toast.error('Gagal memuat data presensi guru'); }
    finally { setLoadingGuru(false); }
  }, [guruMode, guruTanggal, guruBulan, guruTahun]);

  // ── Load siswa presensi ──────────────────────────────────────────────────
  const loadSiswa = useCallback(async (page = 1) => {
    setLoadingSiswa(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (siswaSearch) params.set('search', siswaSearch);
      if (siswaMode === 'hari' && siswaTanggal) params.set('tanggal', siswaTanggal);
      else if (siswaMode === 'bulan') { params.set('bulan', siswaBulan); params.set('tahun', siswaTahun); }
      else params.set('tanggal', new Date().toISOString().slice(0, 10));

      const r: any = await api.get(`/api/presensi/siswa/dashboard?${params}`);
      setSiswaRows(r.data || []);
      setSiswaTotal(r.total || 0);
      setSiswaPage(r.page || 1);
      setSiswaPages(r.totalPages || 1);
    } catch { toast.error('Gagal memuat data presensi siswa'); }
    finally { setLoadingSiswa(false); }
  }, [siswaMode, siswaTanggal, siswaBulan, siswaTahun, siswaSearch]);

  useEffect(() => { if (tab === 'guru') loadGuru(1); }, [tab, loadGuru]);
  useEffect(() => { if (tab === 'siswa') loadSiswa(1); }, [tab, loadSiswa]);

  // ── Save pengaturan ──────────────────────────────────────────────────────
  const savePengaturan = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validasi koordinat
    if (!cfgForm.koordinatSekolah.trim()) {
      toast.error('Koordinat sekolah wajib diisi');
      return;
    }

    const parts = cfgForm.koordinatSekolah.split(',').map(s => s.trim());
    if (parts.length !== 2 || isNaN(Number(parts[0])) || isNaN(Number(parts[1]))) {
      toast.error('Format koordinat tidak valid. Contoh: -5.148011, 119.549435');
      return;
    }

    setSavingCfg(true);
    try {
      await api.put('/api/presensi/pengaturan', cfgForm);
      toast.success('Pengaturan berhasil disimpan');
      // Reload untuk update
      const d: any = await api.get('/api/presensi/pengaturan');
      setCfg(d);
    } catch (err: any) {
      toast.error(err?.message || 'Gagal menyimpan pengaturan');
    } finally {
      setSavingCfg(false);
    }
  };

  // ── Edit guru presensi ───────────────────────────────────────────────────
  const openEdit = (row: PresensiGuruRow) => {
    setEditTarget(row);
    setEditDatang(toDatetimeLocal(row.waktuDatang));
    setEditPulang(toDatetimeLocal(row.waktuPulang));
  };

  const submitEdit = async () => {
    if (!editTarget) return;
    setSavingEdit(true);
    try {
      await api.patch(`/api/presensi/guru/${editTarget.id}`, {
        waktuDatang: editDatang || null,
        waktuPulang: editPulang || null,
      });
      toast.success('Data presensi diperbarui');
      setEditTarget(null);
      loadGuru(guruPage);
    } catch { toast.error('Gagal memperbarui presensi'); }
    finally { setSavingEdit(false); }
  };

  // ── Delete guru presensi ─────────────────────────────────────────────────
  const confirmDeleteGuru = async () => {
    if (!delGuruId) return;
    setDeletingGuru(true);
    try {
      await api.delete(`/api/presensi/guru/${delGuruId}`);
      toast.success('Data presensi guru dihapus');
      setDelGuruId(null);
      loadGuru(guruPage);
    } catch { toast.error('Gagal menghapus data'); }
    finally { setDeletingGuru(false); }
  };

  // ── Delete siswa presensi ────────────────────────────────────────────────
  const confirmDeleteSiswa = async () => {
    if (!delSiswaId) return;
    setDeletingSiswa(true);
    try {
      await api.delete(`/api/presensi/siswa/${delSiswaId}`);
      toast.success('Data presensi siswa dihapus');
      setDelSiswaId(null);
      loadSiswa(siswaPage);
    } catch { toast.error('Gagal menghapus data'); }
    finally { setDeletingSiswa(false); }
  };

  // ── Export Guru ───────────────────────────────────────────────────────────
  const exportGuruExcel = async () => {
    if (guruMode !== 'bulan') {
      toast.error('Export hanya tersedia untuk mode Per Bulan');
      return;
    }
    setExportingGuru(true);
    try {
      let token = localStorage.getItem('token');
      if (!token) {
        try {
          const raw = localStorage.getItem('auth-storage');
          if (raw) token = JSON.parse(raw)?.state?.token;
        } catch { /* ignore */ }
      }

      const url = `/api/admin/presensi/guru/export?bulan=${guruBulan}&tahun=${guruTahun}`;
      const resp = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      if (!resp.ok) throw new Error('Gagal mengunduh file');

      const blob = await resp.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = `Presensi-Guru-${guruBulan}-${guruTahun}.xlsx`;
      a.click();
      URL.revokeObjectURL(href);

      toast.success('File Excel berhasil diunduh');
    } catch (err: any) {
      toast.error(err.message || 'Gagal mengunduh file');
    } finally {
      setExportingGuru(false);
    }
  };

  // ── Export Siswa ──────────────────────────────────────────────────────────
  const exportSiswaExcel = async () => {
    if (siswaMode !== 'bulan') {
      toast.error('Export hanya tersedia untuk mode Per Bulan');
      return;
    }
    setExportingSiswa(true);
    try {
      let token = localStorage.getItem('token');
      if (!token) {
        try {
          const raw = localStorage.getItem('auth-storage');
          if (raw) token = JSON.parse(raw)?.state?.token;
        } catch { /* ignore */ }
      }

      const url = `/api/admin/presensi/siswa/export?bulan=${siswaBulan}&tahun=${siswaTahun}`;
      const resp = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      if (!resp.ok) throw new Error('Gagal mengunduh file');

      const blob = await resp.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = `Presensi-Siswa-${siswaBulan}-${siswaTahun}.xlsx`;
      a.click();
      URL.revokeObjectURL(href);

      toast.success('File Excel berhasil diunduh');
    } catch (err: any) {
      toast.error(err.message || 'Gagal mengunduh file');
    } finally {
      setExportingSiswa(false);
    }
  };

  // ── Shared Pagination ────────────────────────────────────────────────────
  const Pagination = ({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) => (
    <div className="flex items-center gap-1.5">
      <button onClick={() => onPage(page - 1)} disabled={page <= 1} className="p-2 border border-outline-variant rounded-lg hover:bg-surface-container-lowest disabled:opacity-30 transition-all">
        <ChevronLeft className="w-4 h-4" />
      </button>
      {Array.from({ length: Math.min(5, pages) }, (_, i) => {
        const p = page <= 3 ? i + 1 : page - 2 + i;
        if (p < 1 || p > pages) return null;
        return (
          <button key={p} onClick={() => onPage(p)} className={`w-9 h-9 flex items-center justify-center rounded-lg font-semibold text-sm transition-colors ${p === page ? 'bg-primary text-white shadow-sm' : 'hover:bg-surface-container-high'}`}>
            {p}
          </button>
        );
      })}
      <button onClick={() => onPage(page + 1)} disabled={page >= pages} className="p-2 border border-outline-variant rounded-lg hover:bg-surface-container-lowest disabled:opacity-30 transition-all">
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );

  // ── Shared Filter Bar ────────────────────────────────────────────────────
  const FilterBar = ({
    mode, onMode, tanggal, onTanggal, bulan, onBulan, tahun, onTahun, onApply,
  }: any) => (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex p-1 bg-surface-container rounded-xl">
        {(['hari', 'bulan'] as const).map(m => (
          <button key={m} onClick={() => onMode(m)} className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all capitalize ${mode === m ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant'}`}>
            Per {m === 'hari' ? 'Tanggal' : 'Bulan'}
          </button>
        ))}
      </div>

      {mode === 'hari' ? (
        <input type="date" value={tanggal} onChange={e => onTanggal(e.target.value)}
          className="px-3 py-2 border border-outline-variant rounded-xl text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none bg-surface-container-lowest"
        />
      ) : (
        <>
          <select value={bulan} onChange={e => onBulan(e.target.value)}
            className="px-3 py-2 border border-outline-variant rounded-xl text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none bg-surface-container-lowest">
            {MONTHS.map((m, i) => <option key={i} value={String(i + 1)}>{m}</option>)}
          </select>
          <select value={tahun} onChange={e => onTahun(e.target.value)}
            className="px-3 py-2 border border-outline-variant rounded-xl text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none bg-surface-container-lowest">
            {[nowYear, nowYear - 1, nowYear - 2].map(y => <option key={y} value={String(y)}>{y}</option>)}
          </select>
        </>
      )}

      <button onClick={onApply} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-container transition-colors">
        <RefreshCw className="w-4 h-4" /> Tampilkan
      </button>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex p-1.5 bg-surface-container rounded-2xl w-fit">
        {([
          { key: 'guru',        label: 'Presensi Guru',  Icon: GraduationCap },
          { key: 'siswa',       label: 'Presensi Siswa', Icon: Users },
          { key: 'pengaturan',  label: 'Pengaturan',     Icon: Settings },
        ] as { key: Tab; label: string; Icon: React.ElementType }[]).map(({ key, label, Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${tab === key ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant hover:text-primary'}`}>
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {/* ── TAB: Pengaturan ── */}
      {tab === 'pengaturan' && (
        <form onSubmit={savePengaturan} className="space-y-6 max-w-3xl">
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant p-6 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                <MapPin className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-on-surface">Geofencing Sekolah</h3>
                <p className="text-sm text-on-surface-variant">Koordinat dan radius untuk validasi lokasi guru</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-on-surface-variant">
                Koordinat Sekolah <span className="text-error">*</span>
              </label>
              <input
                type="text"
                value={cfgForm.koordinatSekolah}
                onChange={e => setCfgForm(p => ({ ...p, koordinatSekolah: e.target.value }))}
                className="w-full px-3 py-2.5 border border-outline-variant rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none font-mono"
                placeholder="-5.148011655370297, 119.54943519565128"
                required
              />
              <div className="flex items-start gap-2 mt-2 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                <MapPin className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <div className="text-xs text-on-surface-variant space-y-1">
                  <p className="font-semibold text-primary">Cara mendapatkan koordinat:</p>
                  <ol className="list-decimal list-inside space-y-1 ml-2">
                    <li>Buka <a href="https://maps.google.com" target="_blank" rel="noopener" className="text-primary underline">Google Maps</a></li>
                    <li>Klik kanan pada lokasi sekolah</li>
                    <li>Klik koordinat yang muncul di bagian atas (contoh: -5.148011, 119.549435)</li>
                    <li>Koordinat akan otomatis tersalin, paste di sini</li>
                  </ol>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-on-surface-variant">
                Radius Maksimal (meter) <span className="text-error">*</span>
              </label>
              <input
                type="number"
                min="10"
                max="5000"
                value={cfgForm.radiusMeter}
                onChange={e => setCfgForm(p => ({ ...p, radiusMeter: Number(e.target.value) }))}
                className="w-full px-3 py-2.5 border border-outline-variant rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none"
                placeholder="100"
                required
              />
              <p className="text-xs text-error font-medium">
                ⚠️ Guru hanya bisa presensi jika berada dalam radius {cfgForm.radiusMeter} meter dari sekolah
              </p>
            </div>

            {/* Preview Map Link */}
            {cfgForm.koordinatSekolah && cfgForm.koordinatSekolah.includes(',') && (
              <div className="p-4 bg-surface-container rounded-lg border border-outline-variant/50">
                <p className="text-xs font-semibold text-on-surface-variant mb-2">Preview Lokasi:</p>
                <a
                  href={`https://www.google.com/maps?q=${cfgForm.koordinatSekolah.trim()}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline flex items-center gap-2"
                >
                  <MapPin className="w-4 h-4" />
                  Lihat di Google Maps
                </a>
              </div>
            )}
          </div>

          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant p-6 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                <Clock className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-on-surface">Jam Default</h3>
                <p className="text-sm text-on-surface-variant">Batas waktu untuk presensi dan auto-checkout</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-on-surface-variant">Jam Masuk Default</label>
                <input
                  type="time"
                  value={cfgForm.jamMasukDefault}
                  onChange={e => setCfgForm(p => ({ ...p, jamMasukDefault: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-outline-variant rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none"
                  required
                />
                <p className="text-xs text-on-surface-variant">Untuk hitung keterlambatan</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-on-surface-variant">Jam Pulang Default (Auto-checkout)</label>
                <input
                  type="time"
                  value={cfgForm.jamPulangDefault}
                  onChange={e => setCfgForm(p => ({ ...p, jamPulangDefault: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-outline-variant rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none"
                  required
                />
                <p className="text-xs text-on-surface-variant">Auto-checkout guru yang belum pulang</p>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={savingCfg} className="gap-2 px-8">
              {savingCfg ? 'Menyimpan...' : <><Save className="w-4 h-4" /> Simpan Pengaturan</>}
            </Button>
          </div>
        </form>
      )}

      {/* ── TAB: Presensi Guru ── */}
      {tab === 'guru' && (
        <div className="space-y-4">
          <div className="flex flex-wrap justify-between gap-3">
            <FilterBar
              mode={guruMode} onMode={setGuruMode}
              tanggal={guruTanggal} onTanggal={setGuruTanggal}
              bulan={guruBulan} onBulan={setGuruBulan}
              tahun={guruTahun} onTahun={setGuruTahun}
              onApply={() => loadGuru(1)}
            />
            <div className="flex items-center gap-3">
              <p className="text-sm text-on-surface-variant">
                {guruTotal} data ditemukan
              </p>
              {guruMode === 'bulan' && (
                <button
                  onClick={exportGuruExcel}
                  disabled={exportingGuru}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {exportingGuru ? (
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  Export Excel
                </button>
              )}
            </div>
          </div>

          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant overflow-hidden shadow-[0px_4px_20px_rgba(0,0,0,0.03)]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-outline-variant">
                  {['No','Nama Guru','Tanggal','Jam Datang','Jam Pulang','Keterlambatan','Total Jam','Foto','Aksi'].map(h => (
                    <th key={h} className="px-5 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/40">
                {loadingGuru ? (
                  <tr><td colSpan={9} className="px-5 py-10 text-center text-on-surface-variant">Memuat data...</td></tr>
                ) : guruRows.length === 0 ? (
                  <tr><td colSpan={9} className="px-5 py-10 text-center text-on-surface-variant">Tidak ada data presensi untuk filter ini</td></tr>
                ) : guruRows.map(row => (
                  <tr key={row.id} className="hover:bg-surface-container-low/50 transition-colors group">
                    <td className="px-4 py-3 text-on-surface-variant">{row.no}</td>
                    <td className="px-4 py-3 font-medium text-on-surface">{row.nama}</td>
                    <td className="px-4 py-3 text-on-surface-variant">{fmtDate(row.tanggal)}</td>
                    <td className="px-4 py-3 text-on-surface-variant">{fmtTime(row.waktuDatang)}</td>
                    <td className="px-4 py-3 text-on-surface-variant">{fmtTime(row.waktuPulang)}</td>
                    <td className="px-4 py-3 text-on-surface-variant">
                      {row.keterlambatan > 0 ? (
                        <span className="text-error font-medium">{row.keterlambatan} menit</span>
                      ) : (
                        <span className="text-green-600 font-medium">Tepat Waktu</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">{fmtDurasi(row.totalJam)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        <FotoThumb src={row.fotoDatang} label="Foto Datang" />
                        <FotoThumb src={row.fotoPulang} label="Foto Pulang" />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(row)} className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors" title="Edit">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => setDelGuruId(row.id)} className="p-2 text-error hover:bg-error/10 rounded-lg transition-colors" title="Hapus">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {guruPages > 1 && (
              <div className="px-5 py-4 bg-surface-container/30 border-t border-outline-variant flex justify-between items-center">
                <p className="text-sm text-on-surface-variant">Hal {guruPage} dari {guruPages} · {guruTotal} total</p>
                <Pagination page={guruPage} pages={guruPages} onPage={p => { setGuruPage(p); loadGuru(p); }} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: Presensi Siswa ── */}
      {tab === 'siswa' && (
        <div className="space-y-4">
          <div className="flex flex-wrap justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <FilterBar
                mode={siswaMode} onMode={setSiswaMode}
                tanggal={siswaTanggal} onTanggal={setSiswaTanggal}
                bulan={siswaBulan} onBulan={setSiswaBulan}
                tahun={siswaTahun} onTahun={setSiswaTahun}
                onApply={() => loadSiswa(1)}
              />
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
                <input
                  type="text" value={siswaSearch} onChange={e => setSiswaSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && loadSiswa(1)}
                  placeholder="Cari nama atau NIS..."
                  className="pl-9 pr-4 py-2 border border-outline-variant rounded-xl text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none bg-surface-container-lowest w-52"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <p className="text-sm text-on-surface-variant">{siswaTotal} data ditemukan</p>
              {siswaMode === 'bulan' && (
                <button
                  onClick={exportSiswaExcel}
                  disabled={exportingSiswa}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {exportingSiswa ? (
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  Export Excel
                </button>
              )}
            </div>
          </div>

          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant overflow-hidden shadow-[0px_4px_20px_rgba(0,0,0,0.03)]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-outline-variant">
                  {['No','NIS','Nama Siswa','Kelas','Jam Datang','Tanggal','Aksi'].map(h => (
                    <th key={h} className="px-5 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/40">
                {loadingSiswa ? (
                  <tr><td colSpan={7} className="px-5 py-10 text-center text-on-surface-variant">Memuat data...</td></tr>
                ) : siswaRows.length === 0 ? (
                  <tr><td colSpan={7} className="px-5 py-10 text-center text-on-surface-variant">Tidak ada data presensi untuk filter ini</td></tr>
                ) : siswaRows.map(row => (
                  <tr key={row.id} className="hover:bg-surface-container-low/50 transition-colors group">
                    <td className="px-4 py-3 text-on-surface-variant">{row.no}</td>
                    <td className="px-4 py-3 font-mono font-medium text-on-surface">{row.nis}</td>
                    <td className="px-4 py-3 font-medium text-on-surface">{row.nama}</td>
                    <td className="px-4 py-3 text-on-surface-variant">{row.kelas}</td>
                    <td className="px-4 py-3 text-on-surface-variant">{fmtTime(row.waktuDatang)}</td>
                    <td className="px-4 py-3 text-on-surface-variant">{fmtDate(row.tanggal)}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => setDelSiswaId(row.id)} className="p-2 text-error hover:bg-error/10 rounded-lg transition-colors" title="Hapus">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {siswaPages > 1 && (
              <div className="px-5 py-4 bg-surface-container/30 border-t border-outline-variant flex justify-between items-center">
                <p className="text-sm text-on-surface-variant">Hal {siswaPage} dari {siswaPages} · {siswaTotal} total</p>
                <Pagination page={siswaPage} pages={siswaPages} onPage={p => { setSiswaPage(p); loadSiswa(p); }} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Edit Guru Modal ── */}
      {editTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-on-surface/40 backdrop-blur-sm">
          <div className="w-full max-w-md bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-xl">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-outline-variant">
              <h3 className="font-semibold text-on-surface">Edit Presensi Guru</h3>
              <button onClick={() => setEditTarget(null)} className="p-1.5 rounded-lg hover:bg-surface-container text-on-surface-variant"><X className="w-4 h-4" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm font-medium text-primary">{editTarget.nama}</p>
              <p className="text-xs text-on-surface-variant">{fmtDate(editTarget.tanggal)}</p>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-on-surface-variant">Jam Datang</label>
                <input type="datetime-local" value={editDatang} onChange={e => setEditDatang(e.target.value)}
                  className="w-full px-3 py-2.5 border border-outline-variant rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-on-surface-variant">Jam Pulang <span className="text-on-surface-variant/60">(kosongkan jika belum)</span></label>
                <input type="datetime-local" value={editPulang} onChange={e => setEditPulang(e.target.value)}
                  className="w-full px-3 py-2.5 border border-outline-variant rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none" />
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <Button variant="outline" onClick={() => setEditTarget(null)} disabled={savingEdit} className="flex-1">Batal</Button>
              <Button onClick={submitEdit} disabled={savingEdit} className="flex-1">
                {savingEdit ? 'Menyimpan...' : 'Simpan'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm Delete Guru ── */}
      {delGuruId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-on-surface/40 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-xl p-6 text-center space-y-4">
            <div className="w-12 h-12 bg-error-container rounded-full flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6 text-error" />
            </div>
            <h3 className="font-semibold text-on-surface">Hapus data presensi ini?</h3>
            <p className="text-sm text-on-surface-variant">Data yang dihapus tidak bisa dikembalikan.</p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setDelGuruId(null)} disabled={deletingGuru} className="flex-1">Batal</Button>
              <Button variant="destructive" onClick={confirmDeleteGuru} disabled={deletingGuru} className="flex-1">
                {deletingGuru ? 'Menghapus...' : 'Hapus'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm Delete Siswa ── */}
      {delSiswaId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-on-surface/40 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-xl p-6 text-center space-y-4">
            <div className="w-12 h-12 bg-error-container rounded-full flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6 text-error" />
            </div>
            <h3 className="font-semibold text-on-surface">Hapus data presensi ini?</h3>
            <p className="text-sm text-on-surface-variant">Data yang dihapus tidak bisa dikembalikan.</p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setDelSiswaId(null)} disabled={deletingSiswa} className="flex-1">Batal</Button>
              <Button variant="destructive" onClick={confirmDeleteSiswa} disabled={deletingSiswa} className="flex-1">
                {deletingSiswa ? 'Menghapus...' : 'Hapus'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
