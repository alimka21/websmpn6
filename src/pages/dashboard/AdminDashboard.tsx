import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Users, GraduationCap, FileText, Newspaper, Shield,
  Settings, ArrowRight, RefreshCw, Activity, History, Star, ClipboardList,
} from 'lucide-react';
import api from '../../lib/api';
import { toast } from 'sonner';
import { ErrorState } from '../../components/ui/ErrorState';

type Accent = 'primary' | 'secondary' | 'tertiary' | 'error';

const ACCENT_CLASS: Record<Accent, { bg: string; text: string }> = {
  primary:   { bg: 'bg-primary-container/15',  text: 'text-primary' },
  secondary: { bg: 'bg-secondary-container/40', text: 'text-on-secondary-container' },
  tertiary:  { bg: 'bg-tertiary-fixed',         text: 'text-on-tertiary-fixed' },
  error:     { bg: 'bg-error-container',        text: 'text-error' },
};

type BadgeColor = 'default' | 'green' | 'error';

const BADGE_CLASS: Record<BadgeColor, string> = {
  default: 'text-on-surface-variant bg-surface-container border border-outline-variant',
  green:   'text-green-700 bg-green-50 border border-green-200',
  error:   'text-error bg-error-container border border-error/20',
};

function StatCard({ icon: Icon, label, value, accent = 'primary', badge, badgeColor = 'default' }: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  accent?: Accent;
  badge?: string;
  badgeColor?: BadgeColor;
}) {
  const c = ACCENT_CLASS[accent];
  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-5 shadow-[0px_4px_20px_rgba(0,0,0,0.04)] hover:shadow-[0px_8px_30px_rgba(0,0,0,0.07)] transition-shadow">
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-11 h-11 ${c.bg} rounded-xl flex items-center justify-center shrink-0`}>
          <Icon className={`w-5 h-5 ${c.text}`} />
        </div>
        <p className="text-sm font-medium text-on-surface-variant leading-tight">{label}</p>
      </div>
      <div className="flex items-end gap-2.5">
        <p className="text-4xl font-extrabold text-on-surface leading-none">{value}</p>
        {badge && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full mb-0.5 ${BADGE_CLASS[badgeColor]}`}>
            {badge}
          </span>
        )}
      </div>
    </div>
  );
}

function QuickLinkCard({ icon: Icon, title, desc, href, accent = 'primary' }: {
  icon: React.ElementType; title: string; desc: string; href: string; accent?: Accent;
}) {
  const c = ACCENT_CLASS[accent];
  return (
    <Link
      to={href}
      className="group bg-surface-container-lowest border border-outline-variant rounded-xl p-5 hover:border-primary hover:shadow-sm transition-all"
    >
      <div className={`w-10 h-10 ${c.bg} ${c.text} rounded-lg flex items-center justify-center mb-3 group-hover:bg-primary group-hover:text-on-primary transition-colors`}>
        <Icon className="w-5 h-5" />
      </div>
      <h4 className="font-bold text-on-surface group-hover:text-primary transition-colors">{title}</h4>
      <p className="text-sm text-on-surface-variant mt-1 mb-3">{desc}</p>
      <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-primary">
        Buka <ArrowRight className="w-3 h-3" />
      </span>
    </Link>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchStats = async (silent = false) => {
    try {
      if (silent) setIsRefreshing(true);
      else setIsLoading(true);
      setErrorMsg(null);
      const res = await api.get('/api/admin/stats');
      setStats(res);
      if (silent) toast.success('Data berhasil diperbarui');
    } catch (err: any) {
      const msg = err?.message || 'Gagal memuat statistik. Periksa koneksi Anda.';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => { fetchStats(); }, []);

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-on-surface-variant">Memuat dashboard...</p>
        </div>
      </div>
    );
  }

  if (errorMsg) return <ErrorState message={errorMsg} onRetry={() => fetchStats()} className="h-[60vh]" />;

  return (
    <div className="space-y-6">

      {/* ── Hero Banner ─────────────────────────────────────── */}
      <div className="relative bg-primary rounded-2xl p-8 md:p-10 overflow-hidden">
        {/* Blob dekorasi */}
        <div className="absolute -right-10 -top-10 w-64 h-64 rounded-[60%_40%_30%_70%/60%_30%_70%_40%] bg-white/10 pointer-events-none" />
        <div className="absolute right-20 bottom-0 w-40 h-40 rounded-full bg-white/5 pointer-events-none" />

        <div className="relative z-10 max-w-2xl">
          <h1 className="text-3xl md:text-4xl font-extrabold text-on-primary leading-tight mb-3">
            Selamat Datang, Admin!
          </h1>
          <p className="text-on-primary/80 leading-relaxed mb-6 max-w-lg">
            Selamat datang kembali di portal akademik. Semua data operasional dan manajemen
            siswa telah diperbarui hari ini.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => navigate('/dashboard/admin/activity')}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/15 hover:bg-white/25 border border-white/40 text-white font-semibold rounded-xl transition-colors text-sm"
            >
              <Activity className="w-4 h-4" />
              Lihat Aktivitas Terbaru
            </button>
          </div>
        </div>
      </div>

      {/* ── Ikhtisar Sistem ─────────────────────────────────── */}
      <div>
        <div className="flex items-end justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-on-surface">Ikhtisar Sistem</h2>
            <p className="text-sm text-on-surface-variant mt-0.5">
              Statistik dan akses cepat menuju modul operasional.
            </p>
          </div>
          <button
            onClick={() => fetchStats(true)}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary-container transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Perbarui Data
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={Users}
            label="Total Siswa Aktif"
            value={stats?.totalSiswa || 0}
            accent="primary"
            badge="Aktif"
          />
          <StatCard
            icon={GraduationCap}
            label="Total Guru"
            value={stats?.totalGuru || 0}
            accent="secondary"
            badge="Tetap"
          />
          <StatCard
            icon={FileText}
            label="Bank Ujian"
            value={stats?.totalUjian || 0}
            accent="error"
            badge="Butuh Update"
            badgeColor="error"
          />
          <StatCard
            icon={Newspaper}
            label="Artikel Berita"
            value={stats?.totalBerita || 0}
            accent="tertiary"
            badge="Tayang"
          />
        </div>
      </div>

      {/* ── Panel Manajemen Cepat ────────────────────────────── */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-[0px_4px_20px_rgba(0,0,0,0.03)]">
        <div className="flex items-center gap-2 mb-1">
          <Shield className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold text-on-surface">Panel Manajemen Cepat</h2>
        </div>
        <p className="text-sm text-on-surface-variant mb-5">Akses cepat ke modul administrasi sistem.</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <QuickLinkCard
            icon={Users}
            title="Kelola Pengguna"
            desc="Atur akun Siswa, Guru, dan Admin"
            href="/dashboard/admin/users"
            accent="primary"
          />
          <QuickLinkCard
            icon={History}
            title="Log Aktivitas"
            desc="Pantau aktivitas terbaru guru dan siswa"
            href="/dashboard/admin/activity"
            accent="primary"
          />
          <QuickLinkCard
            icon={Newspaper}
            title="Portal Berita"
            desc="Tulis pengumuman dan artikel berita"
            href="/dashboard/admin/cms"
            accent="tertiary"
          />
          <QuickLinkCard
            icon={Settings}
            title="Pengaturan Situs"
            desc="Konfigurasi nama, logo, kontak, dan sosial media"
            href="/dashboard/admin/site"
            accent="secondary"
          />
          <QuickLinkCard
            icon={Star}
            title="Potensi Siswa"
            desc="Kelola jenis kebaikan, pelanggaran, dan rekap laporan"
            href="/dashboard/admin/potensi"
            accent="error"
          />
          <QuickLinkCard
            icon={ClipboardList}
            title="Manajemen Ujian"
            desc="Pantau daftar ujian dan tugas dari semua guru"
            href="/dashboard/admin/ujian"
            accent="secondary"
          />
        </div>
      </div>

    </div>
  );
}
