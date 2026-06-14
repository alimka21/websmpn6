import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck, Star, AlertTriangle, Upload, X,
  CheckCircle, Home, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';
import { useSiteConfig } from '../hooks/useSiteConfig';
import SiteFooter from '../components/SiteFooter';

// ── Types ──────────────────────────────────────────────────────────────────────

type Tipe = 'KEBAIKAN' | 'PELANGGARAN';

interface GuruItem  { id: string; nama: string }
interface KelasItem { id: string; nama: string; tingkat: string }
interface SiswaItem { id: string; nama: string; nis: string }
interface JenisItem { id: string; nama: string; poin: number }

// ── Komponen ───────────────────────────────────────────────────────────────────

export default function LaporPotensi() {
  const cfg        = useSiteConfig();
  const schoolName = cfg.namaSekolah || 'Portal Sekolah';

  // Dropdown data
  const [guruList,  setGuruList]  = useState<GuruItem[]>([]);
  const [kelasList, setKelasList] = useState<KelasItem[]>([]);
  const [siswaList, setSiswaList] = useState<SiswaItem[]>([]);
  const [loadingSiswa, setLoadingSiswa] = useState(false);

  // Jenis options
  const [jenisKebaikan,    setJenisKebaikan]    = useState<JenisItem[]>([]);
  const [jenisPelanggaran, setJenisPelanggaran] = useState<JenisItem[]>([]);

  // Form state
  const [guruId,     setGuruId]     = useState('');
  const [kelasId,    setKelasId]    = useState('');
  const [siswaId,    setSiswaId]    = useState('');
  const [tipe,       setTipe]       = useState<Tipe>('PELANGGARAN');
  const [jenisId,    setJenisId]    = useState('');
  const [keterangan, setKeterangan] = useState('');
  const [buktiPreview, setBuktiPreview] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted,  setSubmitted]  = useState(false);

  // Siswa yang dipilih (untuk pesan sukses)
  const [selectedSiswa, setSelectedSiswa] = useState<SiswaItem | null>(null);

  // Errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load data statis
  useEffect(() => {
    api.get('/api/public/guru').then((r: any) => setGuruList(Array.isArray(r) ? r : [])).catch(() => {});
    api.get('/api/public/kelas').then((r: any) => setKelasList(Array.isArray(r) ? r : [])).catch(() => {});
    api.get('/api/public/jenis-kebaikan').then((r: any) => setJenisKebaikan(Array.isArray(r) ? r : [])).catch(() => {});
    api.get('/api/public/jenis-pelanggaran').then((r: any) => setJenisPelanggaran(Array.isArray(r) ? r : [])).catch(() => {});
  }, []);

  // Load siswa saat kelas berubah
  useEffect(() => {
    setSiswaId('');
    setSiswaList([]);
    setSelectedSiswa(null);
    if (!kelasId) return;
    setLoadingSiswa(true);
    api.get(`/api/public/siswa-by-kelas?kelasId=${kelasId}`)
      .then((r: any) => setSiswaList(Array.isArray(r) ? r : []))
      .catch(() => {})
      .finally(() => setLoadingSiswa(false));
  }, [kelasId]);

  // Auto-reset jenis saat tipe berubah
  useEffect(() => { setJenisId(''); }, [tipe]);

  const jenisList    = tipe === 'KEBAIKAN' ? jenisKebaikan : jenisPelanggaran;
  const selectedJenis = jenisList.find(j => j.id === jenisId);

  const handleBuktiChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Ukuran foto maksimal 5MB'); return; }
    const reader = new FileReader();
    reader.onload = ev => setBuktiPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!guruId)  errs.guru  = 'Pilih nama guru';
    if (!kelasId) errs.kelas = 'Pilih kelas';
    if (!siswaId) errs.siswa = 'Pilih siswa';
    if (!jenisId) errs.jenis = 'Pilih jenis laporan';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const guru = guruList.find(g => g.id === guruId);
    const siswa = siswaList.find(s => s.id === siswaId);
    setSubmitting(true);
    try {
      await api.post('/api/public/laporan-potensi', {
        siswaId,
        namaPelapor: guru?.nama ?? '',
        tipe,
        jenisId,
        keterangan: keterangan.trim() || undefined,
        buktiUrl: buktiPreview || undefined,
      });
      setSelectedSiswa(siswa ?? null);
      setSubmitted(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Gagal mengirim laporan');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setGuruId(''); setKelasId(''); setSiswaId('');
    setTipe('PELANGGARAN'); setJenisId('');
    setKeterangan(''); setBuktiPreview('');
    setSelectedSiswa(null); setErrors({}); setSubmitted(false);
  };

  // ── Shared select style ────────────────────────────────────────────────────
  const selectCls = (err?: string) =>
    `w-full px-3 py-2.5 border rounded-xl text-sm focus:border-primary outline-none bg-surface appearance-none transition-colors ${err ? 'border-error' : 'border-outline-variant'}`;

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

              {/* Guru */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-on-surface">
                  Nama Guru <span className="text-error">*</span>
                </label>
                <select
                  value={guruId}
                  onChange={e => { setGuruId(e.target.value); setErrors(p => ({ ...p, guru: '' })); }}
                  className={selectCls(errors.guru)}
                >
                  <option value="">Pilih guru...</option>
                  {guruList.map(g => <option key={g.id} value={g.id}>{g.nama}</option>)}
                </select>
                {errors.guru && <p className="text-xs text-error">{errors.guru}</p>}
              </div>

              {/* Kelas */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-on-surface">
                  Kelas <span className="text-error">*</span>
                </label>
                <select
                  value={kelasId}
                  onChange={e => { setKelasId(e.target.value); setErrors(p => ({ ...p, kelas: '', siswa: '' })); }}
                  className={selectCls(errors.kelas)}
                >
                  <option value="">Pilih kelas...</option>
                  {kelasList.map(k => <option key={k.id} value={k.id}>{k.nama}</option>)}
                </select>
                {errors.kelas && <p className="text-xs text-error">{errors.kelas}</p>}
              </div>

              {/* Siswa */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-on-surface">
                  Siswa <span className="text-error">*</span>
                </label>
                <select
                  value={siswaId}
                  disabled={!kelasId || loadingSiswa}
                  onChange={e => { setSiswaId(e.target.value); setErrors(p => ({ ...p, siswa: '' })); }}
                  className={`${selectCls(errors.siswa)} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <option value="">
                    {!kelasId ? 'Pilih kelas terlebih dahulu' : loadingSiswa ? 'Memuat...' : 'Pilih siswa...'}
                  </option>
                  {siswaList.map(s => <option key={s.id} value={s.id}>{s.nama} — {s.nis}</option>)}
                </select>
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
                  className={selectCls(errors.jenis)}
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
                      onClick={() => setBuktiPreview('')}
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
