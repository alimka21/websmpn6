import React, { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import {
  LogOut, Menu, X, LayoutDashboard, Users, FileText, Settings,
  GraduationCap, ClipboardList, PenTool, BarChart3, Newspaper,
  ExternalLink, CalendarCheck, FolderOpen,
} from 'lucide-react';
import { useAuthStore, Role } from '../../store/authStore';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import { useModalA11y } from '../../hooks/useModalA11y';
import { useSiteConfig } from '../../hooks/useSiteConfig';

interface NavItem { label: string; href: string; icon: React.ReactNode }

const navConfig: Record<Role, NavItem[]> = {
  SUPER_ADMIN: [
    { label: 'Dashboard',        href: '/dashboard/admin',       icon: <LayoutDashboard className="w-5 h-5" /> },
    { label: 'Pengguna',         href: '/dashboard/admin/users', icon: <Users className="w-5 h-5" /> },
    { label: 'Ujian',            href: '/dashboard/admin/ujian', icon: <FileText className="w-5 h-5" /> },
    { label: 'Presensi',         href: '/dashboard/admin/presensi',  icon: <CalendarCheck className="w-5 h-5" /> },
    { label: 'Dokumen & Agenda', href: '/dashboard/admin/konten',    icon: <FolderOpen className="w-5 h-5" /> },
    { label: 'Berita / CMS',     href: '/dashboard/admin/cms',       icon: <Newspaper className="w-5 h-5" /> },
    { label: 'Pengaturan Situs', href: '/dashboard/admin/site',     icon: <Settings className="w-5 h-5" /> },
    { label: 'Statistik',        href: '/dashboard/admin/stats',    icon: <BarChart3 className="w-5 h-5" /> },
  ],
  GURU: [
    { label: 'Dashboard',     href: '/dashboard/guru',            icon: <LayoutDashboard className="w-5 h-5" /> },
    { label: 'Ujian Saya',    href: '/dashboard/guru/ujian',      icon: <FileText className="w-5 h-5" /> },
    { label: 'Buat Ujian',    href: '/dashboard/guru/ujian/baru', icon: <PenTool className="w-5 h-5" /> },
    { label: 'Siswa & Kelas', href: '/dashboard/guru/siswa',      icon: <Users className="w-5 h-5" /> },
    { label: 'Rekap Nilai',   href: '/dashboard/guru/rekap',      icon: <ClipboardList className="w-5 h-5" /> },
  ],
  SISWA: [
    { label: 'Dashboard',     href: '/dashboard/siswa',         icon: <LayoutDashboard className="w-5 h-5" /> },
    { label: 'Ujian Aktif',   href: '/dashboard/siswa/ujian',   icon: <FileText className="w-5 h-5" /> },
    { label: 'Riwayat Nilai', href: '/dashboard/siswa/riwayat', icon: <ClipboardList className="w-5 h-5" /> },
  ],
};

const PAGE_TITLES: Record<string, string> = {
  '/dashboard/admin':           'Dashboard Admin',
  '/dashboard/admin/users':     'Manajemen Pengguna',
  '/dashboard/admin/ujian':     'Kelola Ujian',
  '/dashboard/admin/presensi':  'Manajemen Presensi',
  '/dashboard/admin/konten':    'Dokumen & Agenda',
  '/dashboard/admin/cms':       'Berita / CMS',
  '/dashboard/admin/site':      'Pengaturan Situs',
  '/dashboard/admin/stats':     'Statistik',
  '/dashboard/guru':            'Dashboard Guru',
  '/dashboard/guru/ujian':      'Daftar Ujian',
  '/dashboard/guru/ujian/baru': 'Buat Ujian Baru',
  '/dashboard/guru/siswa':      'Siswa & Kelas',
  '/dashboard/guru/rekap':      'Rekap Nilai',
  '/dashboard/siswa':           'Dashboard Siswa',
  '/dashboard/siswa/ujian':     'Ujian Aktif',
  '/dashboard/siswa/riwayat':   'Riwayat Nilai',
};

function getPageTitle(pathname: string, role?: Role): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  const matched = Object.entries(PAGE_TITLES)
    .filter(([p]) => pathname.startsWith(p + '/'))
    .sort((a, b) => b[0].length - a[0].length)[0];
  if (matched) return matched[1];
  if (role === 'SUPER_ADMIN') return 'Dashboard Admin';
  if (role === 'GURU') return 'Dashboard Guru';
  return 'Dashboard Siswa';
}

function roleLabel(role?: Role): string {
  if (role === 'SUPER_ADMIN') return 'Admin';
  if (role === 'GURU') return 'Guru';
  return 'Siswa';
}

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen]         = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isLoggingOut, setIsLoggingOut]       = useState(false);

  const { user, logout } = useAuthStore();
  const navigate  = useNavigate();
  const location  = useLocation();
  const cfg       = useSiteConfig();

  const siteName    = cfg.namaSekolah?.trim() || 'Sekolah';
  const siteJenjang = cfg.jenjang || '';
  const siteLogo    = cfg.logoUrl || '';

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

  const isActive = (path: string) =>
    path.split('/').length > 3
      ? location.pathname.startsWith(path)
      : location.pathname === path;

  const pageTitle  = getPageTitle(location.pathname, user?.role);
  const userName   = user?.profile?.nama || user?.email || 'Pengguna';
  const userInitial = (user?.profile?.nama?.[0] || user?.email?.[0] || 'U').toUpperCase();

  const Sidebar = (
    <aside className="w-72 bg-surface-container-lowest border-r border-outline-variant flex flex-col h-full">
      {/* Branding */}
      <div className="px-8 py-8 flex items-center justify-between border-b border-outline-variant/50">
        <div className="flex items-center gap-3 min-w-0">
          {siteLogo ? (
            <img src={siteLogo} alt={siteName} className="w-9 h-9 rounded-lg object-contain shrink-0" />
          ) : (
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <GraduationCap className="w-5 h-5 text-primary" />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-[18px] font-bold text-primary leading-tight tracking-tight truncate">
              {siteName}
            </h1>
            {siteJenjang && (
              <p className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant mt-0.5">
                Jenjang {siteJenjang}
              </p>
            )}
          </div>
        </div>
        <button
          className="lg:hidden text-on-surface-variant hover:text-on-surface"
          onClick={() => setSidebarOpen(false)}
          aria-label="Tutup menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto" aria-label="Menu utama">
        {navItems.map(item => {
          const active = isActive(item.href);
          return (
            <NavLink
              key={item.href}
              to={item.href}
              onClick={() => setSidebarOpen(false)}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200',
                active
                  ? 'bg-primary-fixed text-primary font-semibold shadow-sm'
                  : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
              )}
            >
              {item.icon}
              <span className="text-base truncate">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-on-surface/30 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Desktop sidebar */}
      <div className="hidden lg:flex h-screen sticky top-0">
        {Sidebar}
      </div>

      {/* Mobile sidebar */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 lg:hidden transition-transform duration-300 ease-in-out',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {Sidebar}
      </div>

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Topbar */}
        <header className="h-20 bg-surface/90 backdrop-blur-md border-b border-outline-variant flex items-center justify-between px-8 sticky top-0 z-40 shrink-0">
          <div className="flex items-center gap-4">
            <button
              className="lg:hidden p-2 -ml-2 rounded-lg text-on-surface-variant hover:bg-surface-container"
              onClick={() => setSidebarOpen(true)}
              aria-label="Buka menu"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h2 className="text-[22px] font-bold text-on-surface truncate">{pageTitle}</h2>
          </div>

          <div className="flex items-center gap-6 shrink-0">
            <Link
              to="/"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors font-medium text-sm"
            >
              <ExternalLink className="w-4 h-4" />
              Beranda Web
            </Link>

            <div className="h-8 w-px bg-outline-variant hidden md:block" />

            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-primary text-white rounded-full flex items-center justify-center font-bold text-sm shrink-0">
                {userInitial}
              </div>
              <div className="hidden lg:block">
                <p className="text-sm font-bold leading-none text-on-surface truncate max-w-[160px]">
                  {userName}
                </p>
                <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider mt-1">
                  Role: {roleLabel(user?.role)}
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 text-error hover:bg-error/5 rounded-lg transition-all font-semibold text-sm border border-transparent hover:border-error/20"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-background">
          <div className="p-8 max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Logout confirm modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-on-surface/40 backdrop-blur-sm">
          <div
            ref={logoutModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-title"
            className="w-full max-w-sm bg-surface-container-lowest border border-outline-variant rounded-xl shadow-xl"
          >
            <div className="px-6 pt-6 pb-4 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-error-container flex items-center justify-center mb-3">
                <LogOut className="w-6 h-6 text-error" />
              </div>
              <h2 id="logout-title" className="text-xl font-semibold text-on-surface">
                Keluar dari sistem?
              </h2>
              <p className="text-sm text-on-surface-variant mt-2">
                Anda harus login kembali untuk mengakses dashboard.
              </p>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowLogoutConfirm(false)}
                disabled={isLoggingOut}
                className="flex-1"
              >
                Batal
              </Button>
              <Button
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
