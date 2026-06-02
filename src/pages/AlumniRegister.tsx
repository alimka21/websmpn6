import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { GraduationCap, ArrowLeft, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input, Label } from '../components/ui/input';
import { Select } from '../components/ui/select';
import api from '../lib/api';

const STATUS_OPTIONS = [
  { value: 'KULIAH', label: 'Sedang Kuliah' },
  { value: 'BEKERJA', label: 'Sedang Bekerja' },
  { value: 'WIRAUSAHA', label: 'Wirausaha' },
  { value: 'TIDAK_DIKETAHUI', label: 'Belum mau menyebutkan' },
];

const JURUSAN_OPTIONS = ['TKJ', 'TKRO', 'APAT'];

const CURRENT_YEAR = new Date().getFullYear();

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-xs text-error mt-1 font-medium">{msg}</p>;
}

export default function AlumniRegister() {
  const navigate = useNavigate();

  const [nama, setNama] = useState('');
  const [nis, setNis] = useState('');
  const [tahunLulus, setTahunLulus] = useState<string>(String(CURRENT_YEAR));
  const [jurusan, setJurusan] = useState('');
  const [status, setStatus] = useState<string>('KULIAH');
  const [instansi, setInstansi] = useState('');
  const [posisi, setPosisi] = useState('');
  const [kontak, setKontak] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!nama.trim() || nama.trim().length < 3) errs.nama = 'Nama wajib diisi (min 3 karakter)';
    const tahun = Number(tahunLulus);
    if (!Number.isFinite(tahun) || tahun < 1950 || tahun > CURRENT_YEAR + 1) {
      errs.tahunLulus = `Tahun lulus harus antara 1950 dan ${CURRENT_YEAR + 1}`;
    }
    if (!status) errs.status = 'Pilih status saat ini';

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});

    try {
      setIsSubmitting(true);
      await api.post('/api/alumni/register', {
        nama: nama.trim(),
        nis: nis.trim() || null,
        tahunLulus: tahun,
        jurusan: jurusan.trim() || null,
        status,
        instansi: instansi.trim() || null,
        posisi: posisi.trim() || null,
        kontak: kontak.trim() || null,
      });
      setIsSuccess(true);
      toast.success('Pendaftaran berhasil dikirim');
    } catch (err: any) {
      toast.error(err?.message || 'Gagal mengirim pendaftaran');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm p-8 text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-secondary-container/40 text-on-secondary-container rounded-xl flex items-center justify-center">
            <CheckCircle2 className="w-9 h-9" />
          </div>
          <h1 className="text-headline-sm text-on-surface">Terima Kasih!</h1>
          <p className="text-sm text-on-surface-variant">
            Data alumni Anda berhasil dikirim. Tim sekolah akan memverifikasi dan menampilkan data
            Anda di tracer alumni publik.
          </p>
          <div className="flex flex-col gap-2 pt-2">
            <Link to="/">
              <Button className="w-full">Kembali ke Beranda</Button>
            </Link>
            <Button
              variant="outline"
              onClick={() => {
                setNama(''); setNis(''); setTahunLulus(String(CURRENT_YEAR));
                setJurusan(''); setStatus('KULIAH'); setInstansi('');
                setPosisi(''); setKontak(''); setIsSuccess(false);
              }}
            >
              Daftar Alumni Lain
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Navbar */}
      <nav className="h-16 bg-surface/95 backdrop-blur-md border-b border-outline-variant sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 h-full flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary text-on-primary flex items-center justify-center shrink-0">
              <GraduationCap className="w-5 h-5" />
            </div>
            <span className="font-bold text-xl tracking-tight text-primary hidden sm:block">Beranda</span>
          </Link>
          <Button variant="outline" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Kembali
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <header className="bg-primary text-on-primary py-12 md:py-16">
        <div className="max-w-3xl mx-auto px-4">
          <p className="text-label-sm uppercase tracking-wider font-bold text-on-primary/70 mb-2">Tracer Alumni</p>
          <h1 className="text-headline-lg leading-tight">Daftar Sebagai Alumni</h1>
          <p className="text-on-primary/85 max-w-xl mt-3 text-sm md:text-base leading-relaxed">
            Isi data Anda di bawah ini. Data akan ditampilkan di halaman statistik alumni publik
            setelah diverifikasi oleh sekolah.
          </p>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 -mt-8 pb-12">
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm p-6 md:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="nama">Nama Lengkap <span className="text-error">*</span></Label>
                <Input
                  id="nama" value={nama} onChange={e => setNama(e.target.value)}
                  placeholder="Nama lengkap sesuai ijazah"
                  className={errors.nama ? 'border-error' : ''}
                  autoFocus
                />
                <FieldError msg={errors.nama} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="nis">NIS (opsional)</Label>
                <Input
                  id="nis" value={nis} onChange={e => setNis(e.target.value)}
                  placeholder="Nomor Induk Siswa saat sekolah"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="tahunLulus">Tahun Lulus <span className="text-error">*</span></Label>
                <Input
                  id="tahunLulus" type="number" min={1950} max={CURRENT_YEAR + 1}
                  value={tahunLulus} onChange={e => setTahunLulus(e.target.value)}
                  placeholder={String(CURRENT_YEAR)}
                  className={errors.tahunLulus ? 'border-error' : ''}
                />
                <FieldError msg={errors.tahunLulus} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="jurusan">Jurusan (opsional)</Label>
                <Select
                  id="jurusan" value={jurusan} onChange={e => setJurusan(e.target.value)}
                >
                  <option value="">-- Pilih Jurusan --</option>
                  {JURUSAN_OPTIONS.map(j => <option key={j} value={j}>{j}</option>)}
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="status">Status Saat Ini <span className="text-error">*</span></Label>
                <Select
                  id="status" value={status}
                  onChange={e => {
                    setStatus(e.target.value);
                    if (e.target.value === 'TIDAK_DIKETAHUI') {
                      setInstansi('');
                      setPosisi('');
                    }
                  }}
                  className={errors.status ? 'border-error' : ''}
                >
                  {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
                <FieldError msg={errors.status} />
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="instansi" className={status === 'TIDAK_DIKETAHUI' ? 'opacity-40' : ''}>
                  Instansi / Kampus / Perusahaan
                </Label>
                <Input
                  id="instansi" value={instansi} onChange={e => setInstansi(e.target.value)}
                  placeholder="Nama universitas atau perusahaan"
                  disabled={status === 'TIDAK_DIKETAHUI'}
                  className={status === 'TIDAK_DIKETAHUI' ? 'opacity-40 cursor-not-allowed' : ''}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="posisi" className={status === 'TIDAK_DIKETAHUI' ? 'opacity-40' : ''}>
                  Posisi / Jurusan Kuliah
                </Label>
                <Input
                  id="posisi" value={posisi} onChange={e => setPosisi(e.target.value)}
                  placeholder="Contoh: Mahasiswa Teknik Informatika"
                  disabled={status === 'TIDAK_DIKETAHUI'}
                  className={status === 'TIDAK_DIKETAHUI' ? 'opacity-40 cursor-not-allowed' : ''}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="kontak">Kontak (opsional)</Label>
                <Input
                  id="kontak" value={kontak} onChange={e => setKontak(e.target.value)}
                  placeholder="Email atau no. HP"
                />
              </div>
            </div>

            <div className="flex items-start gap-2 text-xs text-on-surface-variant bg-tertiary-fixed/40 border border-tertiary-fixed rounded-lg p-3">
              <AlertTriangle className="w-4 h-4 text-on-tertiary-fixed shrink-0 mt-0.5" />
              <p>
                Pastikan data benar. Data yang sudah terkirim akan dimoderasi sekolah sebelum
                tampil di tracer alumni publik. Kontak hanya untuk keperluan verifikasi.
              </p>
            </div>

            <Button type="submit" disabled={isSubmitting} size="lg" className="w-full text-white">
              {isSubmitting ? 'Mengirim...' : 'Kirim Data Alumni'}
            </Button>
          </form>
        </div>
      </main>

      <footer className="bg-inverse-surface text-inverse-on-surface/70 py-5 text-center text-xs">
        &copy; {new Date().getFullYear()} Tracer Alumni Sekolah
      </footer>
    </div>
  );
}
