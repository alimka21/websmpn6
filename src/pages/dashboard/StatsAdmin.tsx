import React, { useState, useEffect } from 'react';
import { Users, GraduationCap, FileText, Newspaper, CalendarCheck } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';

interface Stats {
  totalSiswa: number;
  totalGuru: number;
  totalAlumni: number;
  totalUjian: number;
  totalBerita: number;
  presensiHariIni: number;
}

type Accent = 'primary' | 'secondary' | 'tertiary';
const ACCENT_CLASS: Record<Accent, { bg: string; text: string }> = {
  primary:   { bg: 'bg-primary-container/15',   text: 'text-primary' },
  secondary: { bg: 'bg-secondary-container/40', text: 'text-on-secondary-container' },
  tertiary:  { bg: 'bg-tertiary-fixed',         text: 'text-on-tertiary-fixed' },
};

function StatCard({ icon: Icon, label, value, accent = 'primary' }: {
  icon: React.ElementType; label: string; value: number; accent?: Accent;
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

export default function StatsAdmin() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setIsLoading(true);
        const res = await api.get('/api/admin/stats');
        setStats(res);
      } catch (error: any) {
        toast.error(error.message || 'Gagal memuat statistik');
      } finally {
        setIsLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (isLoading || !stats) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        <p className="text-sm text-on-surface-variant">Memuat statistik...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-headline-md text-on-surface">Statistik Global</h1>
        <p className="text-on-surface-variant mt-1">Ringkasan data seluruh entitas di sistem ini.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard icon={Users}         label="Total Siswa"       value={stats.totalSiswa}      accent="primary"   />
        <StatCard icon={Users}         label="Total Guru"        value={stats.totalGuru}       accent="primary"   />
        {/* ALUMNI_HIDDEN: <StatCard icon={GraduationCap} label="Total Alumni" value={stats.totalAlumni} accent="secondary" /> */}
        <StatCard icon={FileText}      label="Total Ujian CBT"   value={stats.totalUjian}      accent="primary"   />
        <StatCard icon={Newspaper}     label="Total Berita"      value={stats.totalBerita}     accent="tertiary"  />
        <StatCard icon={CalendarCheck} label="Presensi Hari Ini" value={stats.presensiHariIni} accent="secondary" />
      </div>
    </div>
  );
}
