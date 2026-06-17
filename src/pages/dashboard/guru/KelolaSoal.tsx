import { toast } from 'sonner';
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import ExcelJS from 'exceljs';
import { Button } from '../../../components/ui/button';
import { Input, Label } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { ArrowLeft, Plus, Save, Trash2, Edit, CheckCircle2, Copy, XCircle, RefreshCw, FileText, Upload, Download, X, ImagePlus, Loader2 } from 'lucide-react';
import api from '../../../lib/api';
import { useSiteConfig, defaultPgOpsiCount } from '../../../hooks/useSiteConfig';

interface OpsiInput {
  teks: string;
  imageUrl?: string;
  benar: boolean;
}

interface SoalForm {
  teks: string;
  imageUrl: string;
  tipe: 'PILIHAN_GANDA' | 'PG_KOMPLEKS' | 'BENAR_SALAH' | 'URAIAN_SINGKAT' | 'ESAI';
  poin: number;
  opsi: OpsiInput[];
}

const isUraianTipe = (tipe: string) => tipe === 'URAIAN_SINGKAT' || tipe === 'ESAI';

// Default 4 opsi PG — bisa di-override jadi 5 untuk SMA/SMK via SiteConfig.jenjang.
const makeDefaultOpsi = (count: number): OpsiInput[] =>
  Array.from({ length: count }, () => ({ teks: '', benar: false }));

export default function KelolaSoal() {
  const { id: ujianId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo: string = (location.state as any)?.returnTo ?? '/dashboard/guru/ujian';
  const returnLabel: string = (location.state as any)?.returnLabel ?? 'Ujian';

  const siteConfig = useSiteConfig();
  const pgOpsiCount = defaultPgOpsiCount(siteConfig.jenjang); // 4 atau 5

  const [ujian, setUjian] = useState<any>(null);
  const [soalList, setSoalList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Bulk import state
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<null | { created: number; failed: { row: number; message: string }[] }>(null);
  const fileInputRef    = useRef<HTMLInputElement | null>(null);
  const imageInputRef   = useRef<HTMLInputElement | null>(null);
  const [uploadingImg, setUploadingImg] = useState(false);

  // Form state
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<SoalForm>({
    teks: '',
    imageUrl: '',
    tipe: 'PILIHAN_GANDA',
    poin: 1,
    opsi: makeDefaultOpsi(pgOpsiCount)
  });

  // Action states
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      setErrorMsg('');
      const res = await api.get(`/api/guru/ujian/${ujianId}`);
      setUjian(res);
      setSoalList(res.soal || []);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal memuat ujian');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [ujianId]);

  const handleAddNew = () => {
    setEditingId(null);
    setFormData({
      teks: '',
      imageUrl: '',
      tipe: 'PILIHAN_GANDA',
      poin: 1,
      opsi: makeDefaultOpsi(pgOpsiCount)
    });
    setIsEditing(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEdit = (soal: any) => {
    setEditingId(soal.id);
    setFormData({
      teks: soal.teks,
      imageUrl: soal.imageUrl || '',
      tipe: soal.tipe,
      poin: soal.poin,
      opsi: soal.opsi.map((o: any) => ({ teks: o.teks, imageUrl: o.imageUrl || '', benar: o.benar }))
    });
    setIsEditing(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = (soalId: string) => {
    setDeleteConfirmId(soalId);
  };

  const handleConfirmDelete = async (soalId: string) => {
    try {
      setIsDeletingId(soalId);
      await api.delete(`/api/guru/soal/${soalId}`);
      toast.success('Soal berhasil dihapus');
      setDeleteConfirmId(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Gagal menghapus soal');
    } finally {
      setIsDeletingId(null);
    }
  };

  const handleDuplikat = async (soal: any) => {
    try {
      setDuplicatingId(soal.id);
      await api.post(`/api/guru/ujian/${ujianId}/soal`, {
        teks: soal.teks,
        imageUrl: soal.imageUrl,
        tipe: soal.tipe,
        poin: soal.poin,
        opsi: soal.opsi.map((o: any) => ({ teks: o.teks, imageUrl: o.imageUrl || '', benar: o.benar }))
      });
      toast.success('Soal berhasil diduplikat');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Gagal menduplikat soal');
    } finally {
      setDuplicatingId(null);
    }
  };

  const handleTypeChange = (newTipe: SoalForm['tipe']) => {
    setFormData(prev => {
      // Uraian/Esai tidak butuh opsi
      if (isUraianTipe(newTipe)) {
        return { ...prev, tipe: newTipe, poin: prev.poin === 1 ? 10 : prev.poin, opsi: [] };
      }
      let newOpsi = isUraianTipe(prev.tipe) ? makeDefaultOpsi(pgOpsiCount) : [...prev.opsi];
      if (newTipe === 'BENAR_SALAH') {
        newOpsi = [{ teks: 'Benar', benar: true }, { teks: 'Salah', benar: false }];
      } else if (prev.tipe === 'BENAR_SALAH') {
        newOpsi = makeDefaultOpsi(pgOpsiCount);
      } else if (newTipe === 'PILIHAN_GANDA') {
        let found = false;
        newOpsi = newOpsi.map(o => {
          if (o.benar && !found) { found = true; return { ...o, benar: true }; }
          return { ...o, benar: false };
        });
      }
      return { ...prev, tipe: newTipe, opsi: newOpsi };
    });
  };

  const handleOpsiTeksChange = (index: number, text: string) => {
    setFormData(prev => {
      const newOpsi = [...prev.opsi];
      newOpsi[index] = { ...newOpsi[index], teks: text };
      return { ...prev, opsi: newOpsi };
    });
  };

  const handleOpsiBenarChange = (index: number, checked: boolean) => {
    setFormData(prev => {
      const newOpsi = [...prev.opsi];
      if (prev.tipe === 'PILIHAN_GANDA' || prev.tipe === 'BENAR_SALAH') {
        return { ...prev, opsi: newOpsi.map((o, i) => ({ ...o, benar: i === index })) };
      }
      newOpsi[index] = { ...newOpsi[index], benar: checked };
      return { ...prev, opsi: newOpsi };
    });
  };

  // Cap atas: default per jenjang +1 toleransi (misal SD/SMP biasanya 4 opsi tapi
  // boleh sampai 5; SMA/SMK 5 boleh sampai 6).
  const maxOpsi = pgOpsiCount + 1;
  const addOpsi = () => {
    if (formData.opsi.length >= maxOpsi) return;
    setFormData(prev => ({ ...prev, opsi: [...prev.opsi, { teks: '', benar: false }] }));
  };

  const removeOpsi = (index: number) => {
    if (formData.opsi.length <= 2) return;
    setFormData(prev => ({ ...prev, opsi: prev.opsi.filter((_, i) => i !== index) }));
  };

  const handleSaveSoal = async () => {
    if (!formData.teks.trim()) {
      toast.error('Teks soal tidak boleh kosong');
      return;
    }
    if (!isUraianTipe(formData.tipe)) {
      if (formData.tipe !== 'BENAR_SALAH' && formData.opsi.some(o => !o.teks.trim())) {
        toast.error('Semua opsi jawaban harus diisi');
        return;
      }
      if (formData.opsi.length < 2) {
        toast.error('Minimal harus ada 2 opsi jawaban');
        return;
      }
      if (!formData.opsi.some(o => o.benar)) {
        toast.error('Harus ada minimal satu jawaban yang benar');
        return;
      }
    }

    try {
      setIsSaving(true);
      if (editingId) {
        await api.patch(`/api/guru/soal/${editingId}`, formData);
        toast.success('Soal berhasil diperbarui');
      } else {
        await api.post(`/api/guru/ujian/${ujianId}/soal`, formData);
        toast.success('Soal berhasil ditambahkan');
      }
      setIsEditing(false);
      setEditingId(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Gagal menyimpan soal');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading && !ujian) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-blue-600 rounded-full animate-spin" />
        <p className="text-sm text-on-surface-variant">Memuat data soal...</p>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <XCircle className="w-12 h-12 text-error" />
        <div>
          <p className="font-semibold text-on-surface">Terjadi Kesalahan</p>
          <p className="text-sm text-on-surface-variant mt-1">{errorMsg}</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => navigate(returnTo)} className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Kembali
          </Button>
          <Button onClick={fetchData} className="gap-2">
            <RefreshCw className="w-4 h-4" /> Coba Lagi
          </Button>
        </div>
      </div>
    );
  }

  // ── Bulk Import Soal ────────────────────────────────────────
  const handleDownloadTemplate = async () => {
    try {
      let token = localStorage.getItem('token');
      if (!token) {
        try { const raw = localStorage.getItem('auth-storage'); if (raw) token = JSON.parse(raw)?.state?.token; } catch { /* ignore */ }
      }
      const resp = await fetch(`/api/guru/ujian/${ujianId}/soal/import-template`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!resp.ok) throw new Error('Gagal mengunduh template');
      const blob = await resp.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = 'template-import-soal.xlsx';
      a.click();
      URL.revokeObjectURL(href);
      toast.success('Template berhasil diunduh');
    } catch (e: any) {
      toast.error(e.message || 'Gagal mengunduh template');
    }
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setIsImporting(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buf);
      const ws = wb.worksheets[0];
      if (!ws) throw new Error('Sheet pertama tidak ditemukan di file');

      const headers: string[] = [];
      ws.getRow(1).eachCell((cell, col) => {
        headers[col] = String(cell.value ?? '').toLowerCase().trim();
      });

      const items: any[] = [];
      ws.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const obj: Record<string, any> = {};
        row.eachCell((cell, col) => {
          const key = headers[col];
          if (!key) return;
          // Normalisasi header → key konsisten
          let normalized = key;
          if (key === 'tipe') normalized = 'tipe';
          else if (key === 'teks') normalized = 'teks';
          else if (key === 'poin') normalized = 'poin';
          else if (key === 'opsia' || key === 'opsi a') normalized = 'opsiA';
          else if (key === 'opsib' || key === 'opsi b') normalized = 'opsiB';
          else if (key === 'opsic' || key === 'opsi c') normalized = 'opsiC';
          else if (key === 'opsid' || key === 'opsi d') normalized = 'opsiD';
          else if (key === 'opsie' || key === 'opsi e') normalized = 'opsiE';
          else if (key === 'kunci' || key === 'jawaban') normalized = 'kunci';
          obj[normalized] = cell.value;
        });
        if (Object.values(obj).every(v => v == null || String(v).trim() === '')) return;
        items.push(obj);
      });

      if (items.length === 0) {
        toast.error('Tidak ada data baris yang ter-baca dari file');
        return;
      }
      if (items.length > 200) {
        toast.error('Maksimal 200 soal per import');
        return;
      }

      // 60s timeout — insert 100+ soal dgn opsi nested bisa lama
      const result = await api.post(`/api/guru/ujian/${ujianId}/soal/import`, { items }, 60_000);
      setImportResult(result);
      if (result.created > 0) {
        toast.success(`${result.created} soal berhasil di-import`);
        fetchData();
      }
      if (result.failed?.length > 0) {
        toast.warning(`${result.failed.length} baris gagal, lihat detail`);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Gagal memproses file');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(returnTo)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <div className="text-sm text-on-surface-variant font-medium">
            <span className="hover:text-on-surface cursor-pointer" onClick={() => navigate(returnTo)}>{returnLabel}</span>
            <span className="mx-1.5">/</span>
            <span className="text-on-surface">{ujian?.judul || 'Loading...'}</span>
          </div>
          <h1 className="text-2xl font-bold text-on-surface tracking-tight mt-1">Bank Soal</h1>
        </div>
      </div>

      {isEditing ? (
        <div className="bg-surface-container-lowest rounded-2xl border border-primary/30 overflow-hidden shadow-[0px_4px_20px_rgba(0,0,0,0.03)]">
          <div className="px-6 py-5 bg-primary-container/15 border-b border-primary/20">
            <h2 className="text-xl font-semibold text-on-surface">{editingId ? 'Edit Soal' : 'Soal Baru'}</h2>
            <p className="text-sm text-on-surface-variant mt-0.5">Pilih tipe soal dan lengkapi pertanyaan serta opsi jawaban.</p>
          </div>
          <div className="p-6 space-y-6">
            <div className="space-y-2">
              <Label>Tipe Pertanyaan</Label>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 'PILIHAN_GANDA', label: 'Pilihan Ganda' },
                  { value: 'PG_KOMPLEKS', label: 'PG Kompleks' },
                  { value: 'BENAR_SALAH', label: 'Benar / Salah' },
                  { value: 'URAIAN_SINGKAT', label: 'Uraian Singkat' },
                  { value: 'ESAI', label: 'Esai' },
                ].map((t) => (
                  <Button
                    key={t.value}
                    type="button"
                    variant={formData.tipe === t.value ? 'default' : 'outline'}
                    onClick={() => handleTypeChange(t.value as SoalForm['tipe'])}
                    className={formData.tipe === t.value ? 'bg-primary hover:bg-primary/90 text-white' : 'bg-white'}
                  >
                    {t.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="teks">Pertanyaan <span className="text-error">*</span></Label>
              <textarea
                id="teks"
                value={formData.teks}
                onChange={e => setFormData({ ...formData, teks: e.target.value })}
                autoFocus
                className="w-full min-h-[120px] p-3 rounded-md border border-outline-variant bg-transparent text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-600 resize-y"
                placeholder="Tuliskan pertanyaan di sini..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="imageUrl">Gambar Soal (Opsional)</Label>
                <div className="flex gap-2">
                  <Input
                    id="imageUrl"
                    value={formData.imageUrl}
                    onChange={e => setFormData({ ...formData, imageUrl: e.target.value })}
                    placeholder="URL atau upload file..."
                    className="flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={uploadingImg}
                    title="Upload gambar soal"
                    className="shrink-0 flex items-center justify-center w-9 h-9 rounded-md border border-outline-variant hover:bg-surface-container transition-colors disabled:opacity-50"
                  >
                    {uploadingImg
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <ImagePlus className="w-4 h-4" />
                    }
                  </button>
                </div>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (!file) return;
                    if (file.size > 3 * 1024 * 1024) { toast.error('Ukuran gambar maksimal 3MB'); return; }
                    setUploadingImg(true);
                    try {
                      const fd = new FormData();
                      fd.append('image', file);
                      const res: any = await api.postForm('/api/guru/upload/soal', fd);
                      setFormData(prev => ({ ...prev, imageUrl: res.url }));
                      toast.success('Gambar berhasil diunggah');
                    } catch {
                      toast.error('Gagal mengunggah gambar');
                    } finally {
                      setUploadingImg(false);
                    }
                  }}
                />
                {formData.imageUrl && (
                  <img src={formData.imageUrl} alt="Preview soal" className="mt-1 max-h-24 rounded border border-outline-variant object-contain" />
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="poin">Bobot Poin</Label>
                <Input
                  id="poin"
                  type="number"
                  min="1"
                  value={formData.poin}
                  onChange={e => setFormData({ ...formData, poin: Number(e.target.value) })}
                />
              </div>
            </div>

            {isUraianTipe(formData.tipe) ? (
              <div className="pt-4 border-t border-outline-variant rounded-xl bg-amber-50 border border-amber-200 p-4 space-y-2">
                <p className="text-sm font-medium text-amber-800">
                  {formData.tipe === 'URAIAN_SINGKAT' ? '✏️ Uraian Singkat' : '📝 Esai'} — Jawaban Teks Bebas
                </p>
                <p className="text-xs text-amber-700">
                  Siswa akan mengetik jawaban secara langsung.
                  {formData.tipe === 'URAIAN_SINGKAT'
                    ? ' Cocok untuk jawaban pendek (1–3 kalimat).'
                    : ' Cocok untuk jawaban panjang dan uraian mendalam.'}
                  {' '}Guru menilai secara manual dengan memberikan nilai <strong>1–10</strong> per soal.
                  Nilai akhir = (nilai guru ÷ 10) × bobot poin soal.
                </p>
              </div>
            ) : (
              <div className="space-y-4 pt-4 border-t border-outline-variant">
                <div className="flex items-center justify-between">
                  <Label>Opsi Jawaban <span className="text-error">*</span></Label>
                  {formData.tipe !== 'BENAR_SALAH' && formData.opsi.length < 6 && (
                    <Button type="button" variant="ghost" size="sm" onClick={addOpsi} className="text-primary h-8">
                      + Tambah Opsi
                    </Button>
                  )}
                </div>

                <div className="space-y-3">
                  {formData.opsi.map((opsi, idx) => {
                    const isBenarSalah = formData.tipe === 'BENAR_SALAH';
                    return (
                      <div key={idx} className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${opsi.benar ? 'border-secondary/40 bg-secondary-container/30' : 'border-outline-variant bg-white'}`}>
                        <div className="flex items-center h-10 w-10 shrink-0 justify-center">
                          {formData.tipe === 'PG_KOMPLEKS' ? (
                            <input
                              type="checkbox"
                              className="w-5 h-5 text-secondary rounded border-outline-variant focus:ring-green-600"
                              checked={opsi.benar}
                              onChange={e => handleOpsiBenarChange(idx, e.target.checked)}
                            />
                          ) : (
                            <input
                              type="radio"
                              name="radio-opsi"
                              className="w-5 h-5 text-secondary border-outline-variant focus:ring-green-600"
                              checked={opsi.benar}
                              onChange={e => handleOpsiBenarChange(idx, e.target.checked)}
                            />
                          )}
                        </div>
                        <div className="flex-1">
                          <Input
                            value={opsi.teks}
                            onChange={e => handleOpsiTeksChange(idx, e.target.value)}
                            placeholder={`Opsi ${idx + 1}`}
                            disabled={isBenarSalah}
                            className={`bg-white ${opsi.benar ? 'font-medium' : ''}`}
                          />
                        </div>
                        {!isBenarSalah && formData.opsi.length > 2 && (
                          <Button type="button" variant="ghost" size="icon" onClick={() => removeOpsi(idx)} className="text-outline-variant hover:text-error shrink-0">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-on-surface-variant mt-2">
                  {formData.tipe === 'PG_KOMPLEKS'
                    ? 'Centang semua opsi yang merupakan jawaban benar.'
                    : 'Pilih radio/centang di kiri untuk menentukan jawaban benar.'}
                </p>
              </div>
            )}
          </div>
          <div className="bg-surface-container-low px-6 py-4 border-t border-outline-variant flex justify-end gap-3">
            <Button variant="outline" onClick={() => { setIsEditing(false); setEditingId(null); }} disabled={isSaving}>
              Batal
            </Button>
            <Button onClick={handleSaveSoal} className="gap-2" disabled={isSaving}>
              {isSaving ? (
                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {isSaving ? 'Menyimpan...' : 'Simpan Soal'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant overflow-hidden shadow-[0px_4px_20px_rgba(0,0,0,0.03)]">
          <div className="px-6 py-5 border-b border-outline-variant flex flex-row items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-xl font-semibold text-on-surface">Daftar Soal</h2>
              <p className="text-sm text-on-surface-variant mt-0.5">
                Total {soalList.length} soal &bull; {soalList.reduce((a, s) => a + s.poin, 0)} poin
              </p>
            </div>
            <div className="flex gap-2 shrink-0 flex-wrap">
              <Button
                variant="outline"
                onClick={handleDownloadTemplate}
                className="gap-2"
                title="Unduh template Excel untuk import soal"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Template</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
                className="gap-2"
                title="Import soal dari file Excel"
              >
                <Upload className="w-4 h-4" />
                {isImporting ? 'Mengunggah...' : 'Import Excel'}
              </Button>
              <Button onClick={handleAddNew} className="gap-2">
                <Plus className="w-4 h-4" /> Tambah Soal
              </Button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileSelected}
            />
          </div>
          <div className="p-6">
            {soalList.length === 0 ? (
              <div className="py-16 text-center space-y-2">
                <FileText className="w-12 h-12 text-outline-variant mb-3" />
                <p className="text-lg font-medium text-on-surface">Belum ada soal</p>
                <p className="text-sm">Klik "Tambah Soal" untuk mulai membuat bank soal.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {soalList.map((soal) => (
                  <div key={soal.id} className="p-5 rounded-xl border border-outline-variant bg-surface-container-lowest hover:bg-surface-container-low transition-colors shadow-sm">
                    <div className="flex justify-between items-start gap-4 mb-3">
                      <div className="flex gap-3 flex-1 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-surface-container text-on-surface flex items-center justify-center font-bold shrink-0 text-sm">
                          {soal.nomor}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap gap-2 mb-2">
                            <Badge variant="secondary" className={`text-[10px] ${isUraianTipe(soal.tipe) ? 'bg-amber-100 text-amber-800 border-amber-200' : ''}`}>
                              {soal.tipe === 'PILIHAN_GANDA' ? 'Pilihan Ganda'
                                : soal.tipe === 'PG_KOMPLEKS' ? 'PG Kompleks'
                                : soal.tipe === 'BENAR_SALAH' ? 'Benar / Salah'
                                : soal.tipe === 'URAIAN_SINGKAT' ? 'Uraian Singkat'
                                : soal.tipe === 'ESAI' ? 'Esai'
                                : soal.tipe}
                            </Badge>
                            <Badge variant="outline" className="text-[10px]">{soal.poin} Poin</Badge>
                          </div>
                          <p className="text-on-surface font-medium leading-relaxed whitespace-pre-wrap">{soal.teks}</p>
                          {soal.imageUrl && (
                            <img src={soal.imageUrl} alt="Lampiran soal" loading="lazy" className="mt-3 max-h-48 rounded border border-outline-variant" />
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(soal)} className="text-primary hover:text-primary hover:bg-primary-container/15 h-8 px-2" title="Edit Soal">
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDuplikat(soal)} disabled={duplicatingId === soal.id} className="text-on-surface-variant hover:text-on-surface hover:bg-surface-container h-8 px-2" title="Duplikat Soal">
                          {duplicatingId === soal.id
                            ? <div className="w-4 h-4 border-2 border-outline/40 border-t-slate-500 rounded-full animate-spin" />
                            : <Copy className="w-4 h-4" />
                          }
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(soal.id)} className="text-error hover:text-error hover:bg-error-container h-8 px-2" title="Hapus Soal">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {deleteConfirmId === soal.id && (
                      <div className="mb-4 flex items-center gap-3 p-3 bg-error-container border border-error/20 rounded-lg text-sm">
                        <span className="text-error font-medium flex-1">Yakin hapus soal ini?</span>
                        <Button
                          size="sm"
                          onClick={() => handleConfirmDelete(soal.id)}
                          disabled={isDeletingId === soal.id}
                          className="h-7 bg-error hover:bg-error/90 text-white text-xs px-3"
                        >
                          {isDeletingId === soal.id ? 'Menghapus...' : 'Ya, Hapus'}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setDeleteConfirmId(null)} className="h-7 text-xs px-3">
                          Batal
                        </Button>
                      </div>
                    )}

                    <div className="pl-11 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {soal.opsi.map((opsi: any) => (
                        <div key={opsi.id} className={`flex items-start gap-2 p-2 rounded-lg text-sm border ${opsi.benar ? 'bg-secondary-container/30/50 border-secondary/30 text-on-secondary-container' : 'bg-surface-container-low border-transparent text-on-surface-variant'}`}>
                          <div className="mt-0.5 shrink-0">
                            {opsi.benar
                              ? <CheckCircle2 className="w-4 h-4 text-secondary" />
                              : <div className="w-4 h-4 rounded-full border border-outline-variant" />
                            }
                          </div>
                          <span>{opsi.teks}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal hasil import */}
      {importResult && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-inverse-surface/50 backdrop-blur-sm"
          onClick={() => setImportResult(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="import-result-title"
            className="w-full max-w-lg bg-surface-container-lowest rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant">
              <h3 id="import-result-title" className="font-bold text-on-surface text-lg">
                Hasil Import Soal
              </h3>
              <button
                onClick={() => setImportResult(null)}
                className="p-1.5 rounded hover:bg-surface-container-low text-on-surface-variant"
                aria-label="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-secondary-container/30 border border-secondary/20 rounded-lg p-4 text-center">
                  <p className="text-3xl font-bold text-secondary">{importResult.created}</p>
                  <p className="text-sm text-on-secondary-container mt-1">Berhasil di-import</p>
                </div>
                <div className="bg-error-container border border-error/20 rounded-lg p-4 text-center">
                  <p className="text-3xl font-bold text-error">{importResult.failed.length}</p>
                  <p className="text-sm text-on-error-container mt-1">Gagal</p>
                </div>
              </div>

              {importResult.failed.length > 0 && (
                <div>
                  <p className="font-semibold text-on-surface text-sm mb-2">Detail baris gagal:</p>
                  <div className="max-h-64 overflow-y-auto border border-outline-variant rounded-lg divide-y divide-outline-variant">
                    {importResult.failed.map((f, i) => (
                      <div key={i} className="px-4 py-2 text-sm flex gap-3">
                        <span className="font-bold text-error shrink-0">Baris {f.row}</span>
                        <span className="text-on-surface-variant">{f.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setImportResult(null)}>Tutup</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
