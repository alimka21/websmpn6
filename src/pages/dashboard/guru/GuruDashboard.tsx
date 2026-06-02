import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import {
  Users, FileText, CheckCircle2, Clock, PlusCircle, AlertTriangle,
  ListChecks, Activity, ArrowRight, RefreshCw,
} from 'lucide-react';
import api from '../../../lib/api';
import { formatDate } from '../../../lib/utils';

type Accent = 'primary' | 'secondary' | 'tertiary';
const ACCENT_CLASS: Record<Accent, { bg: string; text: string }> = {
  primary:   { bg: 'bg-primary-container/15',  text: 'text-primary' },
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

export default function GuruDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [ujianMendatang, setUjianMendatang] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const fetchData = async () => {
    try {
      setIsLoading(true);
      setError('');
      const [statsRes, ujianRes] = await Promise.all([
        api.get('/api/guru/stats'),
        // Endpoint paginated — widget "ujian mendatang" cukup 100 terbaru utk filter waktu.
        api.get('/api/guru/ujian?limit=100'),
      ]);

      setStats(statsRes);

      const now = new Date();
      const ujianList = ujianRes?.data ?? [];
      const mendatang = ujianList
        .filter((u: any) => new Date(u.tanggalMulai) > now)
        .sort((a: any, b: any) => new Date(a.tanggalMulai).getTime() - new Date(b.tanggalMulai).getTime())
        .slice(0, 3);
      setUjianMendatang(mendatang);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat data dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-on-surface-variant font-medium">Memuat ringkasan...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-error-container border border-error/20 text-error rounded-xl p-5 flex items-start gap-3">
        <AlertTriangle className="w-6 h-6 shrink-0" />
        <div className="flex-1">
          <h3 className="font-bold text-base">Gagal memuat data</h3>
          <p className="text-sm text-on-surface">{error}</p>
          <Button onClick={fetchData} variant="outline" size="sm" className="mt-3 gap-2">
            <RefreshCw className="w-3.5 h-3.5" /> Muat Ulang
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header + quick actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-headline-md text-on-surface">Ringkasan Mengajar</h1>
          <p className="text-on-surface-variant mt-1">Aktivitas ujian dan performa kelas Anda.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button onClick={() => navigate('/dashboard/guru/ujian/baru')} className="flex-1 sm:flex-none gap-2">
            <PlusCircle className="w-4 h-4" />
            <span className="hidden sm:inline">Buat Ujian Baru</span>
            <span className="sm:hidden">Ujian</span>
          </Button>
          <Button variant="outline" onClick={() => navigate('/dashboard/guru/presensi')} className="flex-1 sm:flex-none gap-2">
            <ListChecks className="w-4 h-4" />
            <span className="hidden sm:inline">Input Presensi</span>
            <span className="sm:hidden">Presensi</span>
          </Button>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={FileText}     label="Total Ujian"   value={stats?.totalUjian || 0}   accent="primary"   />
        <StatCard icon={Users}        label="Siswa Anda"    value={stats?.totalSiswa || 0}   accent="primary"   />
        <StatCard icon={CheckCircle2} label="Rataan Nilai"  value={stats?.rataRataNilai || 0} accent="secondary" />
        <StatCard icon={Clock}        label="Ujian Aktif"   value={stats?.ujianAktif || 0}   accent="tertiary"  />
      </div>

      {/* Detail row */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Ujian Mendatang */}
        <div className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant rounded-xl">
          <div className="px-6 py-5 border-b border-outline-variant">
            <h2 className="text-headline-sm text-on-surface">Ujian Mendatang</h2>
            <p className="text-sm text-on-surface-variant mt-0.5">Jadwal ujian yang akan datang dalam waktu dekat.</p>
          </div>
          <div className="p-6">
            {ujianMendatang.length === 0 ? (
              <div className="py-10 text-center border-2 border-dashed border-outline-variant rounded-xl">
                <Clock className="w-10 h-10 mx-auto text-outline-variant mb-2" />
                <p className="text-on-surface font-medium">Tidak ada ujian mendatang</p>
                <p className="text-sm text-on-surface-variant mt-1">
                  Semua ujian sedang berjalan atau sudah selesai.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {ujianMendatang.map((ujian) => (
                  <div
                    key={ujian.id}
                    className="flex flex-col sm:flex-row gap-4 p-4 rounded-xl border border-outline-variant bg-surface-container-low hover:bg-surface-container transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h4 className="font-bold text-on-surface truncate">{ujian.judul}</h4>
                        {ujian.tipeUjian && (
                          <Badge variant="outline" className="text-xs uppercase tracking-wider">
                            {String(ujian.tipeUjian).replace('_', ' ')}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-on-surface-variant mb-2">{ujian.mataPelajaran}</p>
                      <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-on-surface-variant">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {ujian.durasi} menit
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          {ujian._count?.siswa || 0} peserta
                        </span>
                      </div>
                    </div>
                    <div className="text-left sm:text-right flex sm:flex-col justify-between sm:justify-start gap-2">
                      <span className="text-label-sm uppercase tracking-wider font-bold text-primary bg-primary-container/20 px-2.5 py-1 rounded-lg w-fit">
                        {formatDate(ujian.tanggalMulai, 'datetime')}
                      </span>
                      <button
                        onClick={() => navigate(`/dashboard/guru/ujian/${ujian.id}/soal`)}
                        className="text-label-sm uppercase tracking-wider font-bold text-primary inline-flex items-center gap-1 hover:underline"
                      >
                        Kelola Soal <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Aktivitas Terbaru (placeholder) */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl">
          <div className="px-6 py-5 border-b border-outline-variant">
            <h2 className="text-headline-sm text-on-surface">Aktivitas Terbaru</h2>
            <p className="text-sm text-on-surface-variant mt-0.5">Pembaruan ujian dan log sistem.</p>
          </div>
          <div className="p-6">
            <div className="py-10 text-center border-2 border-dashed border-outline-variant rounded-xl flex flex-col items-center justify-center">
              <Activity className="w-10 h-10 text-outline-variant mb-2" />
              <p className="text-on-surface font-medium">Dalam pengembangan</p>
              <p className="text-sm text-on-surface-variant mt-1 max-w-[220px]">
                Aktivitas (sesi ujian selesai, pelanggaran) akan tampil di sini.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
