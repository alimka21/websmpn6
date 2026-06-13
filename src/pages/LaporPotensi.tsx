import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck, Star, AlertTriangle, Search, Upload, X,
  CheckCircle, Home, CalendarCheck, ClipboardList, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';
import { useSiteConfig } from '../hooks/useSiteConfig';
import SiteFooter from '../components/SiteFooter';

// ── Types ──────────────────────────────────────────────────────────────────────

type Tipe = 'KEBAIKAN' | 'PELANGGARAN';

interface JenisItem { id: string; nama: string; poin: number }
interface SiswaResult { id: string; nama: string; nis: string; kelas: { id: string; nama: string } }

// ── Komponen ───────────────────────────────────────────────────────────────────

export default function LaporPotensi() {
  const cfg        = useSiteConfig();
  const schoolName = cfg.namaSekolah || 'Portal Sekolah';

  // Form state
  const [namaPelapor, setNamaPelapor]   = useState('');
  const [tipe, setTipe]                 = useState<Tipe>('PELANGGARAN');
  const [jenisId, setJenisId]           = useState('');
  const [keterangan, setKeterangan]     = useState('');
  const [buktiFile, setBuktiFile]       = useState<File | null>(null);
  const [buktiPreview, setBuktiPreview] = useState<string>('');
  const [submitting, setSubmitting]     = useState(false);
  const [submitted, setSubmitted]       = useState(false);

  // Siswa search
  const [siswaQuery, setSiswaQuery]       = useState('');
  const [siswaResults, setSiswaResults]   = useState<SiswaResult[]>([]);
  const [selectedSiswa, setSelectedSiswa] = useState<SiswaResult | null>(null);
  const [searching, setSearching]         = useState(false);
  const searchTimeout                      = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Jenis options
  const [jenisKebaikan, setJenisKebaikan]         = useState<JenisItem[]>([]);
  const [jenisPelanggaran, setJenisPelanggaran]   = useState<JenisItem[]>([]);

  // Errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    api.get('/api/public/jenis-kebaikan').then((r: any) => setJenisKebaikan(Array.isArray(r) ? r : [])).catch(() => {});
    api.get('/api/public/jenis-pelanggaran').then((r: any) => setJenisPelanggaran(Array.isArray(r) ? r : [])).catch(() => {});
  }, []);

  // Auto-reset jenis saat tipe berubah
  useEffect(() => { setJenisId(''); }, [tipe]);

  const jenisList = tipe === 'KEBAIKAN' ? jenisKebaikan : jenisPelanggaran;
  const selectedJenis = jenisList.find(j => j.id === jenisId);

  // Debounce search siswa
  const handleSiswaSearch = (q: string) => {
    setSiswaQuery(q);
    setSelectedSiswa(null);
    clearTimeout(searchTimeout.current);
    if (q.length < 2) { setSiswaResults([]); return; }
    setSearching(true);
    searchTimeout.current = setTimeout(async () => {
      try {
        const r: any = await api.get(`/api/public/siswa-search?q=${encodeURIComponent(q)}`);
        setSiswaResults(Array.isArray(r) ? r : []);
      } catch { setSiswaResults([]); }
      finally { setSearching(false); }
    }, 350);
  };

  const handleBuktiChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Ukuran foto maksimal 5MB'); return; }
    setBuktiFile(file);
    const reader = new FileReader();
    reader.onload = ev => setBuktiPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!namaPelapor.trim()) errs.namaPelapor = 'Nama pelapor wajib diisi';
    if (!selectedSiswa)      errs.siswa       = 'Pilih siswa terlebih dahulu';
    if (!jenisId)            errs.jenis       = 'Pilih jenis laporan';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      await api.post('/api/public/laporan-potensi', {
        siswaId: selectedSiswa!.id,
        namaPelapor: namaPelapor.trim(),
        tipe,
        jenisId,
        keterangan: keterangan.trim() || undefined,
        buktiUrl: buktiPreview || undefined,
      });
      setSubmitted(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Gagal mengirim laporan');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setNamaPelapor(''); setTipe('PELANGGARAN'); setJenisId('');
    setKeterangan(''); setBuktiFile(null); setBuktiPreview('');
    setSiswaQuery(''); setSelectedSiswa(null); setSiswaResults([]);
    setErrors({}); setSubmitted(false);
  };

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
              <ShieldCheck className="w-4 h-4 text-primary" /> Form Laporan Potensi
            </span>
          </div>
          <Link to="/" className="flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-primary transition-colors font-medium">
            <Home className="w-4 h-4" /> Beranda
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 md:px-8 py-8">

        {submitted ? (
          /* ── Sukses ── */
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant p-10 flex flex-col items-center gap-5 text-center">
            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center">
              <CheckCircle className="w-9 h-9 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-on-surface">Laporan Berhasil Dikirim</h2>
              <p className="text-on-surface-variant text-sm mt-1">
                Laporan untuk <strong>{selectedSiswa?.nama}</strong> telah tersimpan dan dapat dilihat di Dashboard Potensi.
              </p>
            </div>
            <div className="flex gap-3 flex-wrap justify-center">
              <button onClick={resetForm} className="px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors">
                Lapor Lagi
              </button>
              <Link to="/dashboard-publik/potensi" className="px-6 py-2.5 border border-outline-variant rounded-xl text-sm font-semibold text-on-surface hover:bg-surface-container transition-colors">
                Lihat Dashboard
              </Link>
            </div>
          </div>
        ) : (
          /* ── Form ── */
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant p-6 space-y-5">
              <h2 className="font-bold text-on-surface text-lg flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-primary" />
                Formulir Laporan Potensi Siswa
              </h2>

              {/* Nama pelapor */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-on-surface">
                  Nama Pelapor <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  value={namaPelapor}
                  onChange={e => setNamaPelapor(e.target.value)}
                  placeholder="Nama guru / pelapor"
                  className={`w-full px-3 py-2.5 border rounded-xl text-sm focus:border-primary outline-none bg-surface transition-colors ${errors.namaPelapor ? 'border-error' : 'border-outline-variant'}`}
                />
                {errors.namaPelapor && <p className="text-xs text-error">{errors.namaPelapor}</p>}
              </div>

              {/* Cari siswa */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-on-surface">
                  Nama / NIS Siswa <span className="text-error">*</span>
                </label>
                {selectedSiswa ? (
                  <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
                    <div>
                      <p className="font-semibold text-on-surface text-sm">{selectedSiswa.nama}</p>
                      <p className="text-xs text-on-surface-variant">{selectedSiswa.nis} · {selectedSiswa.kelas.nama}</p>
                    </div>
                    <button type="button" onClick={() => { setSelectedSiswa(null); setSiswaQuery(''); }} className="p-1 rounded-lg hover:bg-surface-container text-on-surface-variant">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
                    <input
                      type="text"
                      value={siswaQuery}
                      onChange={e => handleSiswaSearch(e.target.value)}
                      placeholder="Ketik nama atau NIS siswa..."
                      className={`w-full pl-9 pr-3 py-2.5 border rounded-xl text-sm focus:border-primary outline-none bg-surface transition-colors ${errors.siswa ? 'border-error' : 'border-outline-variant'}`}
                    />
                    {(searching || siswaResults.length > 0) && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-xl z-10 overflow-hidden">
                        {searching && <p className="px-4 py-3 text-sm text-on-surface-variant">Mencari...</p>}
                        {!searching && siswaResults.map(s => (
                          <button
                            key={s.id} type="button"
                            onClick={() => { setSelectedSiswa(s); setSiswaQuery(''); setSiswaResults([]); setErrors(p => ({ ...p, siswa: '' })); }}
                            className="w-full text-left px-4 py-3 hover:bg-surface-container transition-colors border-b border-outline-variant/30 last:border-0"
                          >
                            <p className="font-semibold text-on-surface text-sm">{s.nama}</p>
                            <p className="text-xs text-on-surface-variant">{s.nis} · {s.kelas.nama}</p>
                          </button>
                        ))}
                        {!searching && siswaResults.length === 0 && siswaQuery.length >= 2 && (
                          <p className="px-4 py-3 text-sm text-on-surface-variant">Siswa tidak ditemukan</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {errors.siswa && <p className="text-xs text-error">{errors.siswa}</p>}
              </div>

              {/* Tipe laporan */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-on-surface">
                  Tipe Laporan <span className="text-error">*</span>
                </label>
                <div className="flex gap-3">
                  {(['PELANGGARAN', 'KEBAIKAN'] as Tipe[]).map(t => (
                    <button
                      key={t} type="button"
                      onClick={() => setTipe(t)}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold border-2 transition-all ${
                        tipe === t
                          ? t === 'KEBAIKAN'
                            ? 'bg-green-50 border-green-400 text-green-700'
                            : 'bg-red-50 border-red-400 text-red-700'
                          : 'border-outline-variant text-on-surface-variant hover:bg-surface-container'
                      }`}
                    >
                      {t === 'KEBAIKAN' ? <Star className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                      {t === 'KEBAIKAN' ? 'Kebaikan' : 'Pelanggaran'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Jenis */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-on-surface">
                  Jenis {tipe === 'KEBAIKAN' ? 'Kebaikan' : 'Pelanggaran'} <span className="text-error">*</span>
                </label>
                <select
                  value={jenisId}
                  onChange={e => { setJenisId(e.target.value); setErrors(p => ({ ...p, jenis: '' })); }}
                  className={`w-full px-3 py-2.5 border rounded-xl text-sm focus:border-primary outline-none bg-surface appearance-none transition-colors ${errors.jenis ? 'border-error' : 'border-outline-variant'}`}
                >
                  <option value="">Pilih jenis...</option>
                  {jenisList.map(j => (
                    <option key={j.id} value={j.id}>{j.nama} ({j.poin} poin)</option>
                  ))}
                </select>
                {errors.jenis && <p className="text-xs text-error">{errors.jenis}</p>}
                {selectedJenis && (
                  <div className={`mt-2 px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 ${tipe === 'KEBAIKAN' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {tipe === 'KEBAIKAN' ? <Star className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                    Poin: <strong>{selectedJenis.poin}</strong>
                  </div>
                )}
              </div>

              {/* Bukti foto */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-on-surface">Bukti Foto (opsional)</label>
                {buktiPreview ? (
                  <div className="relative w-48">
                    <img src={buktiPreview} alt="Bukti" className="w-48 h-36 object-cover rounded-xl border border-outline-variant" />
                    <button
                      type="button"
                      onClick={() => { setBuktiFile(null); setBuktiPreview(''); }}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-error text-white rounded-full flex items-center justify-center shadow"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center gap-3 px-4 py-3 border-2 border-dashed border-outline-variant rounded-xl cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors">
                    <Upload className="w-5 h-5 text-on-surface-variant" />
                    <div>
                      <p className="text-sm font-medium text-on-surface">Unggah foto bukti</p>
                      <p className="text-xs text-on-surface-variant">JPG / PNG, maks. 5MB</p>
                    </div>
                    <input type="file" accept="image/*" className="hidden" onChange={handleBuktiChange} />
                  </label>
                )}
              </div>

              {/* Keterangan */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-on-surface">Keterangan (opsional)</label>
                <textarea
                  value={keterangan}
                  onChange={e => setKeterangan(e.target.value)}
                  rows={3}
                  placeholder="Ceritakan kronologi singkat..."
                  className="w-full px-3 py-2.5 border border-outline-variant rounded-xl text-sm focus:border-primary outline-none bg-surface resize-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Mengirim...</> : 'Kirim Laporan'}
            </button>
          </form>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
