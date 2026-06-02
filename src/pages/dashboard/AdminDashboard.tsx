import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, GraduationCap, FileText, Newspaper, Shield, Settings, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';
import { ErrorState } from '../../components/ui/ErrorState';

type Accent = 'primary' | 'secondary' | 'tertiary' | 'error';

const ACCENT_CLASS: Record<Accent, { bg: string; text: string }> = {
  primary:   { bg: 'bg-primary-container/15',  text: 'text-primary' },
  secondary: { bg: 'bg-secondary-container/40', text: 'text-on-secondary-container' },
  tertiary:  { bg: 'bg-tertiary-fixed',         text: 'text-on-tertiary-fixed' },
  error:     { bg: 'bg-error-container',        text: 'text-error' },
};

function StatCard({
  icon: Icon, label, value, accent = 'primary', hint,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  accent?: Accent;
  hint?: string;
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
        {hint && <p className="text-xs text-secondary mt-1">{hint}</p>}
      </div>
    </div>
  );
}

function QuickLinkCard({ icon: Icon, title, desc, href }: { icon: React.ElementType; title: string; desc: string; href: string }) {
  return (
    <Link
      to={href}
      className="group bg-surface-container-lowest border border-outline-variant rounded-xl p-5 hover:border-primary hover:shadow-sm transition-all"
    >
      <div className="w-10 h-10 bg-primary-container/15 text-primary rounded-lg flex items-center justify-center mb-3 group-hover:bg-primary group-hover:text-on-primary transition-colors">
        <Icon className="w-5 h-5" />
      </div>
      <h4 className="font-bold text-on-surface group-hover:text-primary transition-colors">{title}</h4>
      <p className="text-sm text-on-surface-variant mt-1 mb-3">{desc}</p>
      <span className="inline-flex items-center gap-1 text-label-sm font-bold uppercase tracking-wider text-primary">
        Buka <ArrowRight className="w-3 h-3" />
      </span>
    </Link>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      setIsLoading(true);
      setErrorMsg(null);
      const res = await api.get('/api/admin/stats');
      setStats(res);
    } catch (err: any) {
      const msg = err?.message || 'Gagal memuat statistik. Periksa koneksi Anda.';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchStats(); }, []);

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (errorMsg) return <ErrorState message={errorMsg} onRetry={fetchStats} className="h-[60vh]" />;

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-headline-md text-on-surface">Ikhtisar Sistem</h1>
        <p className="text-on-surface-variant mt-1">Statistik dan akses cepat menuju modul operasional.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard icon={Users}         label="Total Siswa Aktif" value={stats?.totalSiswa || 0}      accent="primary"   />
        <StatCard icon={GraduationCap} label="Total Guru"        value={stats?.totalGuru || 0}       accent="primary"   />
        {/* ALUMNI_HIDDEN: <StatCard icon={Users} label="Total Alumni" value={stats?.totalAlumni || 0} accent="secondary" /> */}
        <StatCard icon={FileText}      label="Bank Ujian"        value={stats?.totalUjian || 0}      accent="primary"   />
        <StatCard icon={Newspaper}     label="Artikel Berita"    value={stats?.totalBerita || 0}     accent="tertiary"  />
      </div>

      {/* Manajemen cepat */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
        <div className="flex items-center gap-2 mb-1">
          <Shield className="w-5 h-5 text-primary" />
          <h2 className="text-headline-sm text-on-surface">Panel Manajemen Cepat</h2>
        </div>
        <p className="text-sm text-on-surface-variant mb-5">Akses cepat ke modul administrasi sistem.</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <QuickLinkCard icon={Users}          title="Kelola Pengguna"   desc="Atur akun Siswa, Guru, dan Admin"      href="/dashboard/admin/users" />
          {/* ALUMNI_HIDDEN: <QuickLinkCard icon={GraduationCap} title="Tracer Alumni" desc="Data alumni dan pekerjaannya" href="/dashboard/admin/alumni" /> */}
          <QuickLinkCard icon={Newspaper}      title="Portal Berita"     desc="Tulis pengumuman dan berita"           href="/dashboard/admin/cms" />
          <QuickLinkCard icon={Settings}       title="Pengaturan Situs"  desc="Konfigurasi nama, logo, kontak, dll"   href="/dashboard/admin/site" />
        </div>
      </div>
    </div>
  );
}
