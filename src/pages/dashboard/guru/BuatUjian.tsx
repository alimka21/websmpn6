import { toast } from 'sonner';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../../components/ui/button';
import { Input, Label } from '../../../components/ui/input';
import { Select } from '../../../components/ui/select';
import {
  ArrowLeft, CheckCircle2, Save, AlertTriangle, X,
  Info, Clock, SlidersHorizontal, Shuffle, List,
  BarChart3, BookOpen, Plus,
} from 'lucide-react';
import api from '../../../lib/api';
import { useModalA11y } from '../../../hooks/useModalA11y';
import { useAuthStore } from '../../../store/authStore';

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-xs text-error mt-1">{msg}</p>;
}

/** Header tiap section card — ikon + judul + separator bawah */
function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 pb-4 mb-6 border-b border-outline-variant/20">
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <h3 className="text-lg font-semibold text-on-surface">{title}</h3>
    </div>
  );
}

export default function BuatUjian() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'SUPER_ADMIN';
  const [kelasList, setKelasList] = useState<any[]>([]);
  const [guruList, setGuruList] = useState<{ id: string; nama: string; mataPelajaran: string; mapelList: string[] }[]>([]);
  const [guruId, setGuruId] = useState<string>('');
  const [mapelList, setMapelList] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Form State
  const [judul, setJudul] = useState('');
  const [mataPelajaran, setMataPelajaran] = useState('');
  const PRESET_TIPE = ['LATIHAN', 'ULANGAN_HARIAN', 'UTS', 'UAS'];
  const [tipeUjian, setTipeUjian] = useState('LATIHAN');
  const [tipeKustom, setTipeKustom] = useState('');
  const [durasi, setDurasi] = useState('60');
  const [tanggalMulai, setTanggalMulai] = useState('');
  const [tanggalSelesai, setTanggalSelesai] = useState('');
  const [acak, setAcak] = useState(true);
  const [acakOpsi, setAcakOpsi] = useState(false);
  const [selectedKelas, setSelectedKelas] = useState<string[]>([]);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const cancelModalRef = useModalA11y<HTMLDivElement>(showCancelConfirm, () => setShowCancelConfirm(false));

  useEffect(() => {
    const now = new Date();
    now.setHours(8, 0, 0, 0);
    const tzOffset = now.getTimezoneOffset() * 60000;
    const localNow = new Date(now.getTime() - tzOffset);
    const end = new Date(now.getTime() + 2 * 60 * 60 * 1000 - tzOffset);
    setTanggalMulai(localNow.toISOString().slice(0, 16));
    setTanggalSelesai(end.toISOString().slice(0, 16));

    const fetchKelas = async () => {
      try {
        const res = await api.get('/api/guru/kelas');
        setKelasList(Array.isArray(res) ? res : res?.data ?? []);
      } catch (err: any) {
        toast.error(err?.message || 'Gagal memuat daftar kelas');
      }
    };
    fetchKelas();

    if (isAdmin) {
      api.get('/api/admin/users?role=GURU&limit=100')
        .then((res: any) => {
          const users = res?.data ?? [];
          const list = users
            .filter((u: any) => u.guru)
            .map((u: any) => ({
              id: u.guru.id,
              nama: u.guru.nama,
              mataPelajaran: u.guru.mataPelajaran,
              mapelList: u.guru.guruMataPelajaran?.map((m: any) => m.nama) ?? (u.guru.mataPelajaran ? [u.guru.mataPelajaran] : []),
            }));
          setGuruList(list);
        })
        .catch(() => toast.error('Gagal memuat daftar guru'));
    } else {
      api.get('/api/guru/mapel')
        .then((res: any) => setMapelList(Array.isArray(res) ? res : []))
        .catch(() => {});
    }
  }, [isAdmin]);

  const handleGuruChange = (id: string) => {
    setGuruId(id);
    const guru = guruList.find(g => g.id === id);
    setMapelList(guru?.mapelList ?? []);
    setMataPelajaran('');
  };

  const toggleKelas = (id: string) => {
    setSelectedKelas(prev =>
      prev.includes(id) ? prev.filter(k => k !== id) : [...prev, id]
    );
  };

  const isDirty = judul !== '' || mataPelajaran !== '' || selectedKelas.length > 0;

  const handleCancel = () => {
    if (isDirty) setShowCancelConfirm(true);
    else navigate('/dashboard/guru/ujian');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const errs: Record<string, string> = {};
    if (isAdmin && !guruId) errs.guruId = 'Pilih guru pemilik ujian';
    if (!judul.trim()) errs.judul = 'Judul ujian wajib diisi';
    if (!mataPelajaran.trim()) errs.mataPelajaran = 'Mata pelajaran wajib diisi';
    if (!durasi || parseInt(durasi) < 5) errs.durasi = 'Durasi minimal 5 menit';
    if (!tanggalMulai) errs.tanggalMulai = 'Waktu dibuka wajib diisi';
    if (!tanggalSelesai) errs.tanggalSelesai = 'Waktu ditutup wajib diisi';
    if (tanggalMulai && tanggalSelesai && new Date(tanggalSelesai) <= new Date(tanggalMulai))
      errs.tanggalSelesai = 'Waktu ditutup harus lebih besar dari waktu dibuka';
    if (tanggalSelesai && new Date(tanggalSelesai) <= new Date())
      errs.tanggalSelesai = 'Waktu ditutup sudah lewat — siswa tidak bisa mengikuti ujian ini';
    if (tipeUjian === '__LAINNYA__' && !tipeKustom.trim()) errs.tipeUjian = 'Isi nama tipe ujian kustom';
    if (selectedKelas.length === 0) errs.kelasIds = 'Pilih minimal satu kelas peserta';
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setErrors({});
    try {
      setIsLoading(true);
      const finalTipe = tipeUjian === '__LAINNYA__' ? tipeKustom.trim() : tipeUjian;
      const res = await api.post('/api/guru/ujian', {
        judul, mataPelajaran, tipeUjian: finalTipe,
        durasi: parseInt(durasi), tanggalMulai, tanggalSelesai,
        acak, acakOpsi,
        tampilkanPembahasan: true, tampilkanNilai: true,
        kelasIds: selectedKelas,
        ...(isAdmin && guruId ? { guruId } : {}),
      });
      toast.success('Ujian berhasil dibuat! Silakan tambahkan soal.');
      navigate(`/dashboard/guru/ujian/${res.id}/soal`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menyimpan ujian');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setIsLoading(false);
    }
  };

  const selectedKelasData = kelasList.filter(k => selectedKelas.includes(k.id));
  const unselectedKelasData = kelasList.filter(k => !selectedKelas.includes(k.id));

  return (
    <div className="max-w-4xl mx-auto pb-20">

      {/* ── Page header ──────────────────────────── */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => navigate('/dashboard/guru/ujian')}
          className="p-2 rounded-full hover:bg-surface-container transition-colors text-on-surface-variant"
          aria-label="Kembali"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-on-background">Buat Ujian Baru</h2>
          <p className="text-sm text-on-surface-variant mt-0.5">Konfigurasi parameter ujian untuk siswa</p>
        </div>
      </div>

      {errorMsg && (
        <div className="mb-6 bg-error-container text-error border border-error/20 p-4 rounded-xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <p className="font-medium">{errorMsg}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* ── Section 1: Informasi Dasar ───────────── */}
        <section className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-6 shadow-sm">
          <SectionHeader icon={Info} title="Informasi Dasar" />
          <div className="space-y-5">
            {isAdmin && (
              <div className="space-y-1.5">
                <Label htmlFor="guruId" className="text-on-surface">
                  Buat Ujian Atas Nama Guru <span className="text-error">*</span>
                </Label>
                <Select
                  id="guruId"
                  value={guruId}
                  onChange={e => handleGuruChange(e.target.value)}
                  className={errors.guruId ? 'border-error' : ''}
                >
                  <option value="">Pilih Guru...</option>
                  {guruList.map(g => (
                    <option key={g.id} value={g.id}>{g.nama} ({g.mataPelajaran})</option>
                  ))}
                </Select>
                <p className="text-xs text-on-surface-variant italic">
                  Sebagai admin, Anda dapat membuat sesi ujian untuk guru tertentu.
                </p>
                <FieldError msg={errors.guruId} />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="judul" className="text-on-surface">
                Judul Ujian <span className="text-error">*</span>
              </Label>
              <Input
                id="judul"
                placeholder="Contoh: Penilaian Tengah Semester 1"
                value={judul}
                onChange={e => setJudul(e.target.value)}
                autoFocus
                className={errors.judul ? 'border-error' : ''}
              />
              <FieldError msg={errors.judul} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <Label htmlFor="mataPelajaran" className="text-on-surface">
                  Mata Pelajaran <span className="text-error">*</span>
                </Label>
                {mapelList.length > 0 ? (
                  <Select
                    id="mataPelajaran"
                    value={mataPelajaran}
                    onChange={e => setMataPelajaran(e.target.value)}
                    className={errors.mataPelajaran ? 'border-error' : ''}
                  >
                    <option value="">Pilih Mata Pelajaran...</option>
                    {mapelList.map(m => <option key={m} value={m}>{m}</option>)}
                  </Select>
                ) : (
                  <Input
                    id="mataPelajaran"
                    placeholder={isAdmin && !guruId ? 'Pilih guru terlebih dahulu' : 'Contoh: Matematika Peminatan'}
                    value={mataPelajaran}
                    onChange={e => setMataPelajaran(e.target.value)}
                    disabled={isAdmin && !guruId}
                    className={errors.mataPelajaran ? 'border-error' : ''}
                  />
                )}
                <FieldError msg={errors.mataPelajaran} />
              </div>

              <div className="space-y-1.5">
                <Label className="text-on-surface">Tipe Ujian <span className="text-error">*</span></Label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_TIPE.map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setTipeUjian(type)}
                      className={`px-4 py-2 rounded-full border text-sm font-medium transition-colors ${
                        tipeUjian === type
                          ? 'border-primary bg-primary-fixed text-primary font-bold'
                          : 'border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary'
                      }`}
                    >
                      {type.replace('_', ' ')}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setTipeUjian('__LAINNYA__')}
                    className={`px-4 py-2 rounded-full border text-sm font-medium transition-colors ${
                      tipeUjian === '__LAINNYA__'
                        ? 'border-primary bg-primary-fixed text-primary font-bold'
                        : 'border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary'
                    }`}
                  >
                    Lainnya
                  </button>
                </div>
                {tipeUjian === '__LAINNYA__' && (
                  <div className="space-y-1.5 pt-2">
                    <Input
                      placeholder="Contoh: REMEDIAL, TRYOUT, dst"
                      value={tipeKustom}
                      onChange={e => setTipeKustom(e.target.value.toUpperCase().replace(/\s+/g, '_'))}
                      className={errors.tipeUjian ? 'border-error' : ''}
                    />
                    <p className="text-xs text-on-surface-variant">Spasi otomatis diganti underscore, huruf besar.</p>
                    <FieldError msg={errors.tipeUjian} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ── Section 2: Pengaturan Waktu ──────────── */}
        <section className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-6 shadow-sm">
          <SectionHeader icon={Clock} title="Pengaturan Waktu" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="space-y-1.5">
              <Label htmlFor="tanggalMulai" className="text-on-surface">
                Waktu Dibuka <span className="text-error">*</span>
              </Label>
              <Input
                id="tanggalMulai"
                type="datetime-local"
                value={tanggalMulai}
                onChange={e => setTanggalMulai(e.target.value)}
                className={errors.tanggalMulai ? 'border-error' : ''}
              />
              <FieldError msg={errors.tanggalMulai} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tanggalSelesai" className="text-on-surface">
                Waktu Ditutup <span className="text-error">*</span>
              </Label>
              <Input
                id="tanggalSelesai"
                type="datetime-local"
                value={tanggalSelesai}
                onChange={e => setTanggalSelesai(e.target.value)}
                className={errors.tanggalSelesai ? 'border-error' : ''}
              />
              <FieldError msg={errors.tanggalSelesai} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="durasi" className="text-on-surface">
                Durasi Pengerjaan (Menit) <span className="text-error">*</span>
              </Label>
              <Input
                id="durasi"
                type="number"
                min="5"
                max="300"
                placeholder="90"
                value={durasi}
                onChange={e => setDurasi(e.target.value)}
                className={errors.durasi ? 'border-error' : ''}
              />
              <FieldError msg={errors.durasi} />
            </div>
          </div>
        </section>

        {/* ── Section 3: Peserta & Opsi Lanjutan ───── */}
        <section className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-6 shadow-sm">
          <SectionHeader icon={SlidersHorizontal} title="Peserta & Opsi Lanjutan" />
          <div className="space-y-6">

            {/* Kelas Peserta */}
            <div className="space-y-2">
              <Label className="text-on-surface">
                Pilih Kelas Peserta <span className="text-error">*</span>
              </Label>
              {kelasList.length === 0 ? (
                <div className="p-4 border border-dashed border-outline-variant rounded-xl text-center text-sm text-on-surface-variant">
                  Anda belum memiliki kelas. Silakan buat kelas terlebih dahulu.
                </div>
              ) : (
                <div className={`min-h-[56px] p-3 border rounded-xl bg-surface-container-low flex flex-wrap gap-2 items-center ${
                  errors.kelasIds ? 'border-error' : 'border-outline-variant'
                }`}>
                  {/* Selected kelas — blue pills with × */}
                  {selectedKelasData.map(k => (
                    <span
                      key={k.id}
                      className="inline-flex items-center gap-1.5 bg-primary text-on-primary px-3 py-1.5 rounded-full text-sm font-medium"
                    >
                      {k.nama}
                      <button
                        type="button"
                        onClick={() => toggleKelas(k.id)}
                        className="hover:bg-white/20 rounded-full p-0.5 transition-colors"
                        aria-label={`Hapus ${k.nama}`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                  {/* Unselected kelas — dashed add buttons */}
                  {unselectedKelasData.map(k => (
                    <button
                      key={k.id}
                      type="button"
                      onClick={() => toggleKelas(k.id)}
                      className="inline-flex items-center gap-1 border border-dashed border-primary text-primary px-3 py-1.5 rounded-full text-sm hover:bg-primary/5 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {k.nama}
                    </button>
                  ))}
                </div>
              )}
              <FieldError msg={errors.kelasIds} />
            </div>

            {/* Opsi Acak — 2 kolom side-by-side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                {
                  id: 'acak',
                  icon: Shuffle,
                  label: 'Acak Urutan Soal',
                  desc: 'Urutan soal akan berbeda untuk setiap siswa',
                  value: acak,
                  set: setAcak,
                },
                {
                  id: 'acakOpsi',
                  icon: List,
                  label: 'Acak Opsi Pilihan Jawaban',
                  desc: 'Opsi A–E akan diacak posisinya',
                  value: acakOpsi,
                  set: setAcakOpsi,
                },
              ].map(t => (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-4 p-4 bg-surface border border-outline-variant/20 rounded-xl"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <t.icon className="w-5 h-5 text-outline mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-semibold text-on-surface text-sm">{t.label}</p>
                      <p className="text-xs text-on-surface-variant mt-0.5">{t.desc}</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      id={t.id}
                      className="sr-only peer"
                      checked={t.value}
                      onChange={e => t.set(e.target.checked)}
                    />
                    <div className="w-11 h-6 bg-surface-container-high rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-outline-variant after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
                  </label>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Footer Actions ────────────────────────── */}
        <div className="flex flex-col-reverse md:flex-row justify-end items-center gap-3 py-6">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            className="w-full md:w-auto px-8"
          >
            Batal
          </Button>
          <Button
            type="submit"
            disabled={isLoading}
            className="w-full md:w-auto gap-2 px-8 bg-primary hover:bg-primary-container shadow-md hover:shadow-lg transition-shadow"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Simpan & Lanjut Buat Soal
          </Button>
        </div>
      </form>

      {/* ── Bento reference section ───────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-4">
        <div className="md:col-span-2 bg-gradient-to-br from-primary-container to-primary rounded-xl p-8 text-on-primary relative overflow-hidden h-48 shadow-lg">
          <div className="relative z-10">
            <h4 className="text-xl font-bold mb-3">Panduan Cepat</h4>
            <p className="text-white/80 text-sm leading-relaxed max-w-sm">
              Pastikan semua jadwal ujian telah dikoordinasikan dengan kurikulum untuk menghindari bentrokan waktu pengerjaan siswa.
            </p>
          </div>
          <div className="absolute -right-8 -bottom-8 w-36 h-36 rounded-full bg-white/10 pointer-events-none" />
          <div className="absolute -right-2 -top-8 w-24 h-24 rounded-full bg-white/5 pointer-events-none" />
        </div>
        <div className="bg-surface-container-highest rounded-xl p-6 flex flex-col justify-center border border-primary/10 shadow-sm">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
            <BarChart3 className="w-6 h-6 text-primary" />
          </div>
          <h4 className="font-semibold text-primary mb-1">Statistik Sesi</h4>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            Terdapat ujian yang sedang aktif hari ini untuk seluruh tingkatan kelas.
          </p>
        </div>
      </div>

      {/* ── Modal Konfirmasi Batal ─────────────────── */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-inverse-surface/50 backdrop-blur-sm">
          <div
            ref={cancelModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-modal-title"
            className="w-full max-w-sm bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-xl p-6 text-center space-y-4 animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="w-12 h-12 bg-tertiary-fixed/70 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6 text-on-tertiary-fixed" />
            </div>
            <div>
              <h3 id="cancel-modal-title" className="font-bold text-on-surface text-lg">Buang Perubahan?</h3>
              <p className="text-on-surface-variant text-sm mt-1.5">
                Ada perubahan yang belum disimpan. Yakin ingin membatalkan pembuatan ujian ini?
              </p>
            </div>
            <div className="flex gap-3 justify-center pt-1">
              <Button variant="outline" onClick={() => setShowCancelConfirm(false)}>
                Lanjut Edit
              </Button>
              <Button
                className="bg-error hover:bg-error/90 text-white"
                onClick={() => navigate('/dashboard/guru/ujian')}
              >
                Buang Perubahan
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
