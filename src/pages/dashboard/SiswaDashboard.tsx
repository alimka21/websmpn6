import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FileText, ClipboardList, TrendingUp, ArrowRight, Sparkles, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';
import { ErrorState } from '../../components/ui/ErrorState';

type Accent = 'primary' | 'secondary' | 'tertiary';
const ACCENT_CLASS: Record<Accent, { bg: string; text: string }> = {
  primary:   { bg: 'bg-primary-container/15',   text: 'text-primary' },
  secondary: { bg: 'bg-secondary-container/40', text: 'text-on-secondary-container' },
  tertiary:  { bg: 'bg-tertiary-fixed',         text: 'text-on-tertiary-fixed' },
};

function StatCard({ icon: Icon, label, value, accent = 'primary' }: {
  icon: React.ElementType; label: string; value: number | string; accent?: Accent;
}) {
  const c = ACCENT_CLASS[accent];
  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 flex items-start gap-4">
      <div className={`w-12 h-12 ${c.bg} rounded-xl flex items-center justify-center shrink-0`}>
        <Icon className={`w-6 h-6 ${c.text}`} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-label-md text-on-surface-variant">{label}</p>
        <p className="text-3xl font-bold text-on-surface mt-0.5">{value}</p>
      </div>
    </div>
  );
}

const nilaiColor = (n: number) => {
  if (n >= 75) return 'text-secondary';
  if (n >= 60) return 'text-on-tertiary-fixed';
  return 'text-error';
};

export default function SiswaDashboard() {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchDashboard = async () => {
    try {
      setIsLoading(true);
      setErrorMsg(null);
      const res = await api.get('/api/siswa/dashboard');
      setData(res);
    } catch (error: any) {
      const msg = error?.message || 'Gagal memuat data dashboard. Periksa koneksi Anda.';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchDashboard(); }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        <p className="text-sm text-on-surface-variant">Memuat dashboard...</p>
      </div>
    );
  }

  if (errorMsg) return <ErrorState message={errorMsg} onRetry={fetchDashboard} className="h-[60vh]" />;

  const ujianAktifCount = data?.ujianAktif?.length || 0;
  const ujianSelesaiCount = data?.ujianSelesai?.length || 0;

  return (
    <div className="space-y-6">
      {/* Welcome banner — primary jadi sorotan utama */}
      <div className="bg-primary text-on-primary rounded-xl p-6 sm:p-8 overflow-hidden relative">
        <div className="relative z-10 max-w-2xl">
          <p className="text-label-sm uppercase tracking-wider font-bold text-on-primary/70 mb-1">Selamat datang kembali</p>
          <h1 className="text-headline-md leading-tight">Ringkasan akademis Anda hari ini.</h1>
          {ujianAktifCount > 0 ? (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-on-primary/15 px-3 py-1 text-label-sm font-bold uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" />
                {ujianAktifCount} ujian aktif menunggu
              </span>
              <Link
                to="/dashboard/siswa/ujian"
                className="inline-flex items-center gap-1.5 rounded-full bg-on-primary text-primary px-5 py-2 font-bold uppercase tracking-wider text-label-md hover:bg-on-primary/90 active:translate-y-px transition-all"
              >
                Mulai Sekarang <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <p className="text-on-primary/85 mt-3 text-sm">Saat ini tidak ada ujian aktif. Tetap pantau dashboard ini secara berkala.</p>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard icon={FileText}      label="Ujian Aktif"     value={ujianAktifCount}             accent="tertiary"  />
        <StatCard icon={ClipboardList} label="Ujian Selesai"   value={ujianSelesaiCount}           accent="primary"   />
        <StatCard icon={TrendingUp}    label="Rata-Rata Nilai" value={data?.rataRataNilai || 0}    accent="secondary" />
      </div>

      {/* Quick access + aktivitas terakhir */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Akses cepat */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl">
          <div className="px-6 py-5 border-b border-outline-variant">
            <h2 className="text-headline-sm text-on-surface">Akses Cepat</h2>
            <p className="text-sm text-on-surface-variant mt-0.5">Jalan pintas ke ujian dan riwayat.</p>
          </div>
          <div className="p-5 space-y-3">
            <Link
              to="/dashboard/siswa/ujian"
              className="group flex items-center gap-4 p-4 rounded-lg border border-outline-variant bg-surface-container-lowest hover:border-primary hover:bg-primary-container/10 transition-all"
            >
              <div className="w-10 h-10 bg-primary-container/15 text-primary rounded-lg flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-on-primary transition-colors">
                <FileText className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-on-surface group-hover:text-primary transition-colors">Daftar Ujian Aktif</h3>
                <p className="text-sm text-on-surface-variant">Ujian yang sedang berjalan dan siap dikerjakan.</p>
              </div>
              <ArrowRight className="w-4 h-4 text-on-surface-variant group-hover:text-primary transition-colors" />
            </Link>
            <Link
              to="/dashboard/siswa/riwayat"
              className="group flex items-center gap-4 p-4 rounded-lg border border-outline-variant bg-surface-container-lowest hover:border-primary hover:bg-primary-container/10 transition-all"
            >
              <div className="w-10 h-10 bg-secondary-container/40 text-on-secondary-container rounded-lg flex items-center justify-center shrink-0 group-hover:bg-secondary group-hover:text-on-secondary transition-colors">
                <ClipboardList className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-on-surface group-hover:text-primary transition-colors">Riwayat Nilai</h3>
                <p className="text-sm text-on-surface-variant">Histori nilai dari ujian yang sudah diselesaikan.</p>
              </div>
              <ArrowRight className="w-4 h-4 text-on-surface-variant group-hover:text-primary transition-colors" />
            </Link>
            <Link
              to="/dashboard/siswa/riwayat-nilai"
              className="group flex items-center gap-4 p-4 rounded-lg border border-outline-variant bg-surface-container-lowest hover:border-primary hover:bg-primary-container/10 transition-all"
            >
              <div className="w-10 h-10 bg-tertiary-fixed/30 text-on-tertiary-fixed rounded-lg flex items-center justify-center shrink-0 group-hover:bg-tertiary group-hover:text-on-tertiary transition-colors">
                <BookOpen className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-on-surface group-hover:text-primary transition-colors">Rekap per Mata Pelajaran</h3>
                <p className="text-sm text-on-surface-variant">Nilai rata-rata dan daftar ujian per mapel.</p>
              </div>
              <ArrowRight className="w-4 h-4 text-on-surface-variant group-hover:text-primary transition-colors" />
            </Link>
          </div>
        </div>

        {/* Aktivitas terakhir */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl">
          <div className="px-6 py-5 border-b border-outline-variant">
            <h2 className="text-headline-sm text-on-surface">Aktivitas Terakhir</h2>
            <p className="text-sm text-on-surface-variant mt-0.5">Ujian yang baru saja Anda selesaikan.</p>
          </div>
          <div className="p-5">
            {data?.ujianSelesai && data.ujianSelesai.length > 0 ? (
              <div className="space-y-2">
                {data.ujianSelesai.slice(0, 3).map((sesi: any) => (
                  <Link
                    key={sesi.id}
                    to={`/dashboard/siswa/hasil/${sesi.id}`}
                    className="flex items-center justify-between gap-3 p-3 rounded-lg hover:bg-surface-container transition-colors border border-transparent hover:border-outline-variant"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-on-surface truncate">{sesi.ujian.judul}</p>
                      <p className="text-xs text-on-surface-variant">
                        {new Date(sesi.selesaiAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                    <span className={`text-2xl font-bold tabular-nums ${nilaiColor(sesi.nilaiAkhir)}`}>
                      {sesi.nilaiAkhir}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center">
                <ClipboardList className="w-10 h-10 text-outline-variant mx-auto mb-2" />
                <p className="text-sm text-on-surface-variant">Belum ada ujian yang diselesaikan.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
