import { toast } from 'sonner';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../../components/ui/button';
import { Input, Label } from '../../../components/ui/input';
import { Select } from '../../../components/ui/select';
import { ArrowLeft, CheckCircle2, Save, AlertTriangle, X } from 'lucide-react';
import api from '../../../lib/api';
import { useModalA11y } from '../../../hooks/useModalA11y';
import { useAuthStore } from '../../../store/authStore';

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-xs text-error mt-1">{msg}</p>;
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
  const [tipeKustom, setTipeKustom] = useState(''); // dipakai saat tipeUjian = '__LAINNYA__'
  const [durasi, setDurasi] = useState('60');
  const [tanggalMulai, setTanggalMulai] = useState('');
  const [tanggalSelesai, setTanggalSelesai] = useState('');
  const [acak, setAcak] = useState(true);
  const [acakOpsi, setAcakOpsi] = useState(false);
  // tampilkanPembahasan + tampilkanNilai dihapus dari UI per request user
  // (kebijakan: SELALU tampilkan nilai & pembahasan). Field masih ada di
  // schema/backend untuk kompat, default true tetap dikirim.
  const [selectedKelas, setSelectedKelas] = useState<string[]>([]);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const cancelModalRef = useModalA11y<HTMLDivElement>(showCancelConfirm, () => setShowCancelConfirm(false));

  useEffect(() => {
    // Set default datetime to today at 08:00
    const now = new Date();
    now.setHours(8, 0, 0, 0);
    const tzOffset = now.getTimezoneOffset() * 60000;
    const localNow = new Date(now.getTime() - tzOffset);
    
    const end = new Date(now.getTime() + 2 * 60 * 60 * 1000 - tzOffset); // + 2 hrs
    
    setTanggalMulai(localNow.toISOString().slice(0, 16));
    setTanggalSelesai(end.toISOString().slice(0, 16));

    const fetchKelas = async () => {
      try {
        const res = await api.get('/api/guru/kelas');
        setKelasList(res);
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
      // Guru biasa: ambil mapel milik sendiri
      api.get('/api/guru/mapel')
        .then((res: any) => setMapelList(Array.isArray(res) ? res : []))
        .catch(() => {});
    }
  }, [isAdmin]);

  // Saat admin ganti guru, update mapelList dan reset mataPelajaran
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
    if (isDirty) {
      setShowCancelConfirm(true);
    } else {
      navigate('/dashboard/guru/ujian');
    }
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
    if (tanggalMulai && tanggalSelesai && new Date(tanggalSelesai) <= new Date(tanggalMulai)) {
      errs.tanggalSelesai = 'Waktu ditutup harus lebih besar dari waktu dibuka';
    }
    if (tanggalSelesai && new Date(tanggalSelesai) <= new Date()) {
      errs.tanggalSelesai = 'Waktu ditutup sudah lewat — siswa tidak akan bisa mengikuti ujian ini';
    }
    if (tipeUjian === '__LAINNYA__' && !tipeKustom.trim()) {
      errs.tipeUjian = 'Isi nama tipe ujian kustom';
    }
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
        judul,
        mataPelajaran,
        tipeUjian: finalTipe,
        durasi: parseInt(durasi),
        tanggalMulai,
        tanggalSelesai,
        acak,
        acakOpsi,
        // Hardcoded true — toggle dihapus per kebijakan user (selalu tampil)
        tampilkanPembahasan: true,
        tampilkanNilai: true,
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

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/guru/ujian')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <div className="text-sm text-on-surface-variant font-medium breadcrumbs flex items-center gap-1.5">
            <span className="hover:text-on-surface cursor-pointer" onClick={() => navigate('/dashboard/guru')}>Dashboard</span>
            <span>/</span>
            <span className="hover:text-on-surface cursor-pointer" onClick={() => navigate('/dashboard/guru/ujian')}>Ujian</span>
            <span>/</span>
            <span className="text-primary">Buat Baru</span>
          </div>
          <h1 className="text-2xl font-bold text-on-surface tracking-tight mt-1">Buat Ujian Baru</h1>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-error-container text-error border border-error/20 p-4 rounded-xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <p className="font-medium">{errorMsg}</p>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant overflow-hidden shadow-[0px_4px_20px_rgba(0,0,0,0.03)]">
            <div className="px-6 py-5 border-b border-outline-variant">
              <h2 className="text-xl font-semibold text-on-surface">Informasi Dasar</h2>
              <p className="text-sm text-on-surface-variant mt-0.5">Berikan judul dan mata pelajaran untuk ujian ini.</p>
            </div>
            <div className="p-6 space-y-5">
              {isAdmin && (
                <div className="space-y-2 p-4 bg-primary-container/15 border border-primary/30 rounded-lg">
                  <Label htmlFor="guruId" className="text-primary">
                    Buat Ujian Atas Nama Guru <span className="text-error">*</span>
                  </Label>
                  <p className="text-xs text-primary">Sebagai admin, kamu wajib memilih guru yang menjadi pemilik ujian ini.</p>
                  <Select
                    id="guruId"
                    value={guruId}
                    onChange={e => handleGuruChange(e.target.value)}
                    className={errors.guruId ? 'border-error' : 'bg-white'}
                  >
                    <option value="">-- Pilih guru pemilik ujian --</option>
                    {guruList.map(g => (
                      <option key={g.id} value={g.id}>{g.nama} ({g.mataPelajaran})</option>
                    ))}
                  </Select>
                  <FieldError msg={errors.guruId} />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="judul">Judul Ujian <span className="text-error">*</span></Label>
                <Input
                  id="judul"
                  placeholder="Contoh: Penilaian Tengah Semester 1"
                  value={judul}
                  onChange={e => setJudul(e.target.value)}
                  autoFocus
                  className={`font-medium text-lg h-12 ${errors.judul ? 'border-error' : ''}`}
                />
                <FieldError msg={errors.judul} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mataPelajaran">Mata Pelajaran <span className="text-error">*</span></Label>
                {mapelList.length > 0 ? (
                  <Select
                    id="mataPelajaran"
                    value={mataPelajaran}
                    onChange={e => setMataPelajaran(e.target.value)}
                    className={errors.mataPelajaran ? 'border-error' : 'bg-white'}
                  >
                    <option value="">-- Pilih mata pelajaran --</option>
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

              <div className="space-y-3 pt-2">
                <Label>Tipe Ujian <span className="text-error">*</span></Label>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {PRESET_TIPE.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setTipeUjian(type)}
                      className={`py-3 px-2 rounded-xl text-sm font-medium border text-center transition-all ${
                        tipeUjian === type
                          ? 'border-primary bg-primary-container/15 text-primary shadow-sm'
                          : 'border-outline-variant bg-white text-on-surface-variant hover:border-outline-variant hover:bg-surface-container-low'
                      }`}
                    >
                      {type.replace('_', ' ')}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setTipeUjian('__LAINNYA__')}
                    className={`py-3 px-2 rounded-xl text-sm font-medium border text-center transition-all ${
                      tipeUjian === '__LAINNYA__'
                        ? 'border-primary bg-primary-container/15 text-primary shadow-sm'
                        : 'border-outline-variant bg-white text-on-surface-variant hover:border-outline-variant hover:bg-surface-container-low'
                    }`}
                  >
                    LAINNYA
                  </button>
                </div>
                {tipeUjian === '__LAINNYA__' && (
                  <div className="space-y-1.5 pt-1">
                    <Input
                      placeholder="Contoh: KUIS_HARIAN, REMEDIAL, TRYOUT, dst"
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

          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant overflow-hidden shadow-[0px_4px_20px_rgba(0,0,0,0.03)]">
            <div className="px-6 py-5 border-b border-outline-variant">
              <h2 className="text-xl font-semibold text-on-surface">Pengaturan Waktu</h2>
              <p className="text-sm text-on-surface-variant mt-0.5">Batas waktu dan durasi pengerjaan siswa.</p>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label htmlFor="tanggalMulai">Waktu Dibuka <span className="text-error">*</span></Label>
                  <Input
                    id="tanggalMulai"
                    type="datetime-local"
                    value={tanggalMulai}
                    onChange={e => setTanggalMulai(e.target.value)}
                    className={errors.tanggalMulai ? 'border-error' : ''}
                  />
                  <FieldError msg={errors.tanggalMulai} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tanggalSelesai">Waktu Ditutup <span className="text-error">*</span></Label>
                  <Input
                    id="tanggalSelesai"
                    type="datetime-local"
                    value={tanggalSelesai}
                    onChange={e => setTanggalSelesai(e.target.value)}
                    className={errors.tanggalSelesai ? 'border-error' : ''}
                  />
                  <FieldError msg={errors.tanggalSelesai} />
                </div>
              </div>
              <div className="space-y-2 max-w-sm">
                <Label htmlFor="durasi">Durasi Pengerjaan (Menit) <span className="text-error">*</span></Label>
                <div className="relative">
                  <Input
                    id="durasi"
                    type="number"
                    min="5"
                    max="300"
                    value={durasi}
                    onChange={e => setDurasi(e.target.value)}
                    className={`pr-16 ${errors.durasi ? 'border-error' : ''}`}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-on-surface-variant font-medium">Menit</span>
                </div>
                <FieldError msg={errors.durasi} />
              </div>
            </div>
          </div>

          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant overflow-hidden shadow-[0px_4px_20px_rgba(0,0,0,0.03)]">
            <div className="px-6 py-5 border-b border-outline-variant">
              <h2 className="text-xl font-semibold text-on-surface">Peserta & Opsi Lanjutan</h2>
              <p className="text-sm text-on-surface-variant mt-0.5">Pilih kelas yang wajib mengikuti ujian ini.</p>
            </div>
            <div className="p-6 space-y-6">
              <div className="space-y-3">
                <Label>Pilih Kelas Peserta <span className="text-error">*</span></Label>
                {kelasList.length === 0 ? (
                  <div className="p-4 border border-dashed border-outline-variant rounded-xl text-center text-on-surface-variant text-sm">
                    Anda belum memiliki kelas. Silakan buat kelas terlebih dahulu di menu Siswa & Kelas.
                  </div>
                ) : (
                  <div className={`flex flex-wrap gap-3 ${errors.kelasIds ? 'p-2 border border-error/40 rounded-lg bg-error-container/30' : ''}`}>
                    {kelasList.map(kelas => {
                      const isSelected = selectedKelas.includes(kelas.id);
                      return (
                        <button
                          key={kelas.id}
                          type="button"
                          onClick={() => toggleKelas(kelas.id)}
                          className={`flex items-center gap-2 px-4 py-2.5 rounded-full border text-sm font-medium transition-all ${
                            isSelected 
                              ? 'bg-primary border-primary text-white shadow-sm' 
                              : 'bg-white border-outline-variant text-on-surface hover:border-outline-variant hover:bg-surface-container-low'
                          }`}
                        >
                          {isSelected && <CheckCircle2 className="w-4 h-4 text-primary/40" />}
                          {kelas.nama}
                          <span className={`text-xs ml-1 px-1.5 py-0.5 rounded-full ${isSelected ? 'bg-primary-container/150 text-white' : 'bg-surface-container text-on-surface-variant'}`}>
                            {kelas._count?.siswa || 0}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
                <FieldError msg={errors.kelasIds} />
              </div>

              <div className="border-t border-outline-variant pt-5 space-y-4">
                {[
                  { id: 'acak', label: 'Acak Urutan Soal', desc: 'Urutan soal diacak untuk setiap siswa.', value: acak, set: setAcak },
                  { id: 'acakOpsi', label: 'Acak Opsi Pilihan Jawaban', desc: 'Urutan pilihan A/B/C/D di tiap soal juga diacak.', value: acakOpsi, set: setAcakOpsi },
                ].map(t => (
                  <div key={t.id} className="flex items-center justify-between gap-4">
                    <div>
                      <Label htmlFor={t.id} className="text-base font-semibold text-on-surface cursor-pointer">{t.label}</Label>
                      <p className="text-sm text-on-surface-variant">{t.desc}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input type="checkbox" id={t.id} className="sr-only peer" checked={t.value} onChange={e => t.set(e.target.checked)} />
                      <div className="w-11 h-6 bg-surface-container-high rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-outline-variant after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-surface-container-low px-6 py-4 border-t border-outline-variant flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={handleCancel}>Batal</Button>
              <Button type="submit" disabled={isLoading} className="gap-2 px-6">
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Simpan & Lanjut Buat Soal
              </Button>
            </div>
          </div>
        </div>
      </form>

      {/* Modal Konfirmasi Batal */}
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
