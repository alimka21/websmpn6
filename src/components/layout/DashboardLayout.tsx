import React, { useState, useEffect } from 'react';
import { Link, NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import {
  LogOut, Menu, X, LayoutDashboard, Users, FileText, Settings, Home,
  GraduationCap, ClipboardList, PenTool, BarChart3, Newspaper, CalendarCheck,
} from 'lucide-react';
import { useAuthStore, Role } from '../../store/authStore';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import { useModalA11y } from '../../hooks/useModalA11y';
import api from '../../lib/api';
import { useSiteConfig } from '../../hooks/useSiteConfig';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const navConfig: Record<Role, NavItem[]> = {
  SUPER_ADMIN: [
    { label: 'Dashboard',        href: '/dashboard/admin',         icon: <LayoutDashboard className="w-5 h-5" /> },
    { label: 'Pengguna',         href: '/dashboard/admin/users',   icon: <Users className="w-5 h-5" /> },
    { label: 'Ujian',            href: '/dashboard/admin/ujian',   icon: <FileText className="w-5 h-5" /> },
    // ALUMNI_HIDDEN: { label: 'Alumni', href: '/dashboard/admin/alumni', icon: <GraduationCap className="w-5 h-5" /> },
    { label: 'Berita / CMS',     href: '/dashboard/admin/cms',     icon: <Newspaper className="w-5 h-5" /> },
    { label: 'Pengaturan Situs', href: '/dashboard/admin/site',    icon: <Settings className="w-5 h-5" /> },
    { label: 'Statistik',        href: '/dashboard/admin/stats',   icon: <BarChart3 className="w-5 h-5" /> },
  ],
  GURU: [
    { label: 'Dashboard',     href: '/dashboard/guru',           icon: <LayoutDashboard className="w-5 h-5" /> },
    { label: 'Ujian Saya',    href: '/dashboard/guru/ujian',     icon: <FileText className="w-5 h-5" /> },
    { label: 'Buat Ujian',    href: '/dashboard/guru/ujian/baru', icon: <PenTool className="w-5 h-5" /> },
    { label: 'Siswa & Kelas', href: '/dashboard/guru/siswa',     icon: <Users className="w-5 h-5" /> },
    { label: 'Presensi',      href: '/dashboard/guru/presensi',  icon: <CalendarCheck className="w-5 h-5" /> },
    { label: 'Rekap Nilai',   href: '/dashboard/guru/rekap',     icon: <ClipboardList className="w-5 h-5" /> },
  ],
  SISWA: [
    { label: 'Dashboard',     href: '/dashboard/siswa',         icon: <LayoutDashboard className="w-5 h-5" /> },
    { label: 'Ujian Aktif',   href: '/dashboard/siswa/ujian',   icon: <FileText className="w-5 h-5" /> },
    { label: 'Riwayat Nilai', href: '/dashboard/siswa/riwayat', icon: <ClipboardList className="w-5 h-5" /> },
  ],
};

// Mapping path → judul halaman untuk topbar.
const PAGE_TITLES: Record<string, string> = {
  '/dashboard/admin':              'Dashboard Admin',
  '/dashboard/admin/users':        'Manajemen Pengguna',
  '/dashboard/admin/ujian':        'Kelola Ujian',
  // ALUMNI_HIDDEN: '/dashboard/admin/alumni': 'Tracer Alumni',
  '/dashboard/admin/cms':          'Berita / CMS',
  '/dashboard/admin/site':         'Pengaturan Situs',
  '/dashboard/admin/stats':        'Statistik',
  '/dashboard/guru':               'Dashboard Guru',
  '/dashboard/guru/ujian':         'Daftar Ujian',
  '/dashboard/guru/ujian/baru':    'Buat Ujian Baru',
  '/dashboard/guru/siswa':         'Siswa & Kelas',
  '/dashboard/guru/presensi':      'Presensi Sesi Saya',
  '/dashboard/guru/rekap':         'Rekap Nilai',
  '/dashboard/siswa':              'Dashboard Siswa',
  '/dashboard/siswa/ujian':        'Ujian Aktif',
  '/dashboard/siswa/riwayat':      'Riwayat Nilai',
};

function getPageTitle(pathname: string, role?: Role): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  // Match prefix terpanjang untuk sub-path seperti /ujian/:id/soal
  const matched = Object.entries(PAGE_TITLES)
    .filter(([p]) => pathname.startsWith(p + '/'))
    .sort((a, b) => b[0].length - a[0].length)[0];
  if (matched) return matched[1];
  // Fallback ke nama role
  if (role === 'SUPER_ADMIN') return 'Dashboard Admin';
  if (role === 'GURU') return 'Dashboard Guru';
  if (role === 'SISWA') return 'Dashboard Siswa';
  return 'Dashboard';
}

function roleLabel(role?: Role): string {
  if (role === 'SUPER_ADMIN') return 'Admin';
  if (role === 'GURU') return 'Guru';
  if (role === 'SISWA') return 'Siswa';
  return '—';
}

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  // Site brand dari shared cache (dedupe)
  const siteCfg = useSiteConfig();
  const siteBrand = {
    nama: siteCfg.namaSekolah?.trim() || 'Sekolah',
    logo: siteCfg.logoUrl || '',
    jenjang: siteCfg.jenjang || '',
  };

  const logoutModalRef = useModalA11y<HTMLDivElement>(showLogoutConfirm, () => setShowLogoutConfirm(false));

  const confirmLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      toast.success('Berhasil keluar. Sampai jumpa!');
      navigate('/');
    } catch (err: any) {
      toast.error(err?.message || 'Gagal keluar, coba lagi');
      setIsLoggingOut(false);
    }
  };

  const navItems = user ? navConfig[user.role] : [];

  // Detect active route — sub-path lebih panjang menang
  const isActiveRoute = (path: string) => {
    if (path.split('/').length > 3) {
      return location.pathname.startsWith(path);
    }
    return location.pathname === path;
  };

  const pageTitle = getPageTitle(location.pathname, user?.role);
  const userName = user?.profile?.nama || user?.email || 'Pengguna';
  const userInitial = (user?.profile?.nama?.[0] || user?.email?.[0] || 'U').toUpperCase();

  return (
    <div className="flex h-screen bg-surface overflow-hidden">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-on-surface/40 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ════════════════ SIDEBAR (light theme) ════════════════ */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-surface-container-low border-r border-outline-variant transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 flex flex-col',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Header sidebar — logo + nama sekolah */}
        <div className="flex items-center justify-between h-16 px-5 border-b border-outline-variant shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {siteBrand.logo ? (
              <img
                src={siteBrand.logo}
                alt={siteBrand.nama}
                className="w-8 h-8 rounded-lg object-contain shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-primary text-on-primary flex items-center justify-center shrink-0">
                <GraduationCap className="w-5 h-5" />
              </div>
            )}
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-primary text-base truncate" title={siteBrand.nama}>
                {siteBrand.nama}
              </span>
              {siteBrand.jenjang && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                  Jenjang {siteBrand.jenjang}
                </span>
              )}
            </div>
          </div>
          <button
            className="lg:hidden text-on-surface-variant hover:text-on-surface"
            onClick={() => setSidebarOpen(false)}
            aria-label="Tutup menu navigasi"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="Menu utama">
          {navItems.map((item) => {
            const active = isActiveRoute(item.href);
            return (
              <NavLink
                key={item.href}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors relative',
                  active
                    ? 'bg-primary-container/20 text-primary font-semibold border-l-2 border-primary pl-[14px]'
                    : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface border-l-2 border-transparent pl-[14px]'
                )}
              >
                {item.icon}
                <span className="truncate">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Footer sidebar — user card + logout */}
        <div className="border-t border-outline-variant p-3 space-y-2 shrink-0">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-surface-container">
            <div className="w-10 h-10 rounded-full bg-primary-container/30 text-primary flex items-center justify-center font-bold shrink-0">
              {userInitial}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-on-surface truncate" title={userName}>
                {userName}
              </p>
              <span className="inline-flex items-center rounded-full bg-primary-container/20 text-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider mt-0.5">
                {roleLabel(user?.role)}
              </span>
            </div>
          </div>
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-on-surface-variant hover:bg-error-container hover:text-error transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Keluar</span>
          </button>
        </div>
      </aside>

      {/* ════════════════ MAIN COLUMN ════════════════ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="h-16 flex items-center gap-3 px-4 sm:px-6 lg:px-8 bg-surface-container-lowest border-b border-outline-variant shrink-0 z-10">
          <button
            className="p-2 -ml-2 rounded-lg text-on-surface-variant hover:bg-surface-container lg:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="Buka menu navigasi"
          >
            <Menu className="w-6 h-6" />
          </button>

          {/* Judul halaman saat ini */}
          <h1 className="text-headline-sm text-on-surface flex-1 truncate" title={pageTitle}>
            {pageTitle}
          </h1>

          {/* Beranda Web link + user info */}
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            <Link
              to="/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-primary hover:bg-primary-container/10 transition-colors"
              title="Buka beranda web sekolah di tab baru"
            >
              <Home className="w-4 h-4" />
              <span className="hidden sm:inline">Beranda Web</span>
            </Link>
            <div className="text-right hidden md:block">
              <p className="text-sm font-semibold text-on-surface truncate max-w-[180px]" title={userName}>
                {userName}
              </p>
              <p className="text-label-sm uppercase tracking-wider text-on-surface-variant">
                {roleLabel(user?.role)}
              </p>
            </div>
            <div className="w-10 h-10 rounded-full bg-primary-container/30 text-primary flex items-center justify-center font-bold border border-outline-variant">
              {userInitial}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-surface">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>

      {/* ════════════════ LOGOUT CONFIRM MODAL ════════════════ */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-on-surface/40 backdrop-blur-sm">
          <div
            ref={logoutModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-modal-title"
            className="w-full max-w-sm bg-surface-container-lowest border border-outline-variant rounded-xl shadow-xl"
          >
            <div className="px-6 pt-6 pb-4 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-error-container flex items-center justify-center mb-3">
                <LogOut className="w-6 h-6 text-error" />
              </div>
              <h2 id="logout-modal-title" className="text-headline-sm text-on-surface">
                Keluar dari sistem?
              </h2>
              <p className="text-sm text-on-surface-variant mt-2">
                Anda harus login kembali untuk mengakses dashboard.
              </p>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowLogoutConfirm(false)}
                disabled={isLoggingOut}
                className="flex-1"
              >
                Batal
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={confirmLogout}
                disabled={isLoggingOut}
                className="flex-1"
              >
                {isLoggingOut ? 'Memproses...' : 'Ya, Keluar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
