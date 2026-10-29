import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  LogIn, ArrowRight, Users, GraduationCap, BookOpen, Building2,
  Eye, Target, CalendarCheck, ShieldCheck,
  FileText, ClipboardList, MapPin, Clock, ExternalLink, Newspaper,
  Briefcase, Menu, Quote, Calendar, Compass, Lightbulb,
  Home, Phone, ChevronDown, KeyRound, Loader2,
  ChevronLeft, ChevronRight, Sparkles, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '../components/ui/dialog';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '../components/ui/sheet';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from '../components/ui/dropdown-menu';
import { Avatar, AvatarImage, AvatarFallback } from '../components/ui/avatar';
import { Skeleton } from '../components/ui/skeleton';
import SiteFooter from '../components/SiteFooter';
import api from '../lib/api';
import { useSiteConfig } from '../hooks/useSiteConfig';

const ICON_MAP: Record<string, React.ElementType> = {
  FileText, CalendarCheck, GraduationCap, ClipboardList, Newspaper,
  ShieldCheck, Users, BookOpen, Briefcase, Target, Compass, Lightbulb,
  Calendar, Eye,
};

interface Berita {
  id: string; judul: string; slug: string;
  ringkasan: string | null; imageUrl: string | null; publishedAt: string | null;
}
interface DokumenItem { id: string; judul: string; linkDrive: string }
interface AgendaItem  { id: string; judul: string; waktu: string; lokasi: string | null }

interface FiturItem  { icon: string; title: string; desc: string }
interface GuruProfil { id: string; nama: string; mataPelajaran: string; fotoUrl: string | null }

const CARDS_PER_PAGE = 4;

const DEFAULT_FITUR: FiturItem[] = [
  { icon: 'BookOpen',    title: 'Perpustakaan Digital',  desc: 'Akses ribuan judul buku digital dan modul pembelajaran kapanpun dan dimanapun tanpa batas fisik gedung.' },
  { icon: 'Calendar',    title: 'Kalender Akademik',     desc: 'Pantau jadwal ujian, libur sekolah, dan acara penting lainnya secara real-time lewat notifikasi terintegrasi.' },
  { icon: 'ShieldCheck', title: 'Akses Portal',          desc: 'Login terpusat untuk siswa, guru, dan orang tua untuk melihat nilai, absensi, dan tagihan sekolah secara transparan.' },
];

const DEFAULT_MISI = [
  'Menyelenggarakan pembelajaran berbasis teknologi dan industri terkini yang adaptif.',
  'Membangun karakter siswa melalui nilai-nilai integritas dan akhlak mulia.',
  'Menjalin kemitraan strategis dengan dunia industri dan dunia kerja.',
  'Mengembangkan kurikulum yang responsif terhadap perubahan tuntutan pasar kerja global.',
  'Meningkatkan kompetensi pendidik dan tenaga kependidikan secara berkelanjutan.',
];

const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

const formatTanggal = (iso: string | null) => {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
};

// Animasi muncul saat elemen masuk viewport
function Reveal({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function SectionHeading({ eyebrow, title, desc, center }: { eyebrow: string; title: string; desc?: string; center?: boolean }) {
  return (
    <div className={`max-w-2xl ${center ? 'mx-auto text-center' : ''}`}>
      <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-primary">
        <span className="w-6 h-px bg-primary" /> {eyebrow}
      </span>
      <h2 className="mt-3 text-3xl md:text-4xl font-extrabold tracking-tight text-on-background">{title}</h2>
      {desc && <p className="mt-3 text-on-surface-variant text-base md:text-lg leading-relaxed">{desc}</p>}
    </div>
  );
}

export default function LandingPage() {
  const [beritaList, setBeritaList]         = useState<Berita[]>([]);
  const [isLoadingBerita, setIsLoadingBerita] = useState(true);
  const [dokumenList, setDokumenList]        = useState<DokumenItem[]>([]);
  const [agendaList, setAgendaList]          = useState<AgendaItem[]>([]);
  const [mobileOpen, setMobileOpen]          = useState(false);
  const [activeSection, setActiveSection]    = useState('beranda');
  const [scrolled, setScrolled]              = useState(false);
  const [aksesModal, setAksesModal]          = useState<{ open: boolean; jenis: 'guru' | 'siswa' | 'lapor' | null }>({ open: false, jenis: null });
  const [kodeInput, setKodeInput]            = useState('');
  const [aksesLoading, setAksesLoading]      = useState(false);
  const kodeRef                              = useRef<HTMLInputElement>(null);
  const [guruProfil, setGuruProfil]          = useState<GuruProfil[]>([]);
  const [isLoadingGuru, setIsLoadingGuru]    = useState(true);
  const [sliderPage, setSliderPage]          = useState(0);
  const sliderTimerRef                       = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const [logoMitra, setLogoMitra]            = useState<{ id: string; nama: string; imageUrl: string; linkUrl: string | null }[]>([]);
  const [logoGagal, setLogoGagal]            = useState<Set<string>>(new Set());
  const navigate = useNavigate();

  const bukaModalAkses = (jenis: 'guru' | 'siswa' | 'lapor') => {
    setKodeInput('');
    setAksesModal({ open: true, jenis });
    setMobileOpen(false);
    setTimeout(() => kodeRef.current?.focus(), 100);
  };

  const verifikasiKode = async () => {
    if (kodeInput.length !== 6) {
      toast.error('Kode akses harus 6 karakter');
      return;
    }
    setAksesLoading(true);
    try {
      await api.post('/api/presensi/verify-akses', { jenis: aksesModal.jenis, kode: kodeInput });
      if (aksesModal.jenis === 'lapor') {
        sessionStorage.setItem('lapor_ok', '1');
        setAksesModal({ open: false, jenis: null });
        navigate('/lapor');
      } else {
        sessionStorage.setItem(`presensi_${aksesModal.jenis}_ok`, '1');
        setAksesModal({ open: false, jenis: null });
        navigate(`/presensi/${aksesModal.jenis}`);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Kode akses salah');
    } finally {
      setAksesLoading(false);
    }
  };

  const cfg        = useSiteConfig();
  const schoolName = cfg.namaSekolah || 'Portal Sekolah';

  useEffect(() => {
    const SECTIONS = ['kontak', 'berita', 'guru', 'profil', 'beranda'];
    const onScroll = () => {
      setScrolled(window.scrollY > 20);
      for (const id of SECTIONS) {
        const el = document.getElementById(id);
        if (el && window.scrollY >= el.offsetTop - 120) { setActiveSection(id); break; }
      }
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    api.get('/api/berita?limit=3')
      .then((r: any) => setBeritaList(r.data || r.items || (Array.isArray(r) ? r : [])))
      .catch(() => {})
      .finally(() => setIsLoadingBerita(false));
    api.get('/api/dokumen?limit=5').then((r: any) => setDokumenList(Array.isArray(r) ? r : [])).catch(() => {});
    api.get('/api/agenda?limit=5').then((r: any) => setAgendaList(Array.isArray(r) ? r : [])).catch(() => {});
    api.get('/api/profil-guru')
      .then((r: any) => setGuruProfil(Array.isArray(r) ? r : []))
      .catch(() => {})
      .finally(() => setIsLoadingGuru(false));
    api.get('/api/logo-mitra').then((r: any) => setLogoMitra(Array.isArray(r) ? r : [])).catch(() => {});
  }, []);

  const totalSliderPages = Math.max(1, Math.ceil(guruProfil.length / CARDS_PER_PAGE));

  const sliderNext = useCallback(() => {
    setSliderPage(p => (p + 1) % totalSliderPages);
  }, [totalSliderPages]);

  const sliderPrev = useCallback(() => {
    setSliderPage(p => (p - 1 + totalSliderPages) % totalSliderPages);
  }, [totalSliderPages]);

  const sliderGoTo = (page: number) => { clearInterval(sliderTimerRef.current); setSliderPage(page); };

  useEffect(() => {
    if (guruProfil.length <= CARDS_PER_PAGE) return;
    sliderTimerRef.current = setInterval(sliderNext, 5000);
    return () => clearInterval(sliderTimerRef.current);
  }, [guruProfil.length, sliderNext]);

  const visibleGuru = guruProfil.slice(sliderPage * CARDS_PER_PAGE, (sliderPage + 1) * CARDS_PER_PAGE);

  const fiturItems: FiturItem[] = (() => {
    try {
      const p = cfg.fiturUnggulan ? JSON.parse(cfg.fiturUnggulan) : [];
      return Array.isArray(p) && p.length > 0 ? p : DEFAULT_FITUR;
    } catch { return DEFAULT_FITUR; }
  })();

  const misiLines = cfg.misi
    ? cfg.misi.split('\n').map(s => s.trim()).filter(Boolean)
    : DEFAULT_MISI;

  const showProfil = !!(cfg.kepsekNama || cfg.visi || cfg.misi || cfg.kepsekSambutan);

  const stats = [
    { icon: Users,         value: cfg.statSiswaValue  || '—',  label: cfg.statSiswaLabel  || 'Siswa Aktif' },
    { icon: GraduationCap, value: cfg.statGuruValue   || '—',  label: cfg.statGuruLabel   || 'Tenaga Pendidik' },
    { icon: BookOpen,      value: cfg.statTahunValue  || '—',  label: cfg.statTahunLabel  || 'Berdiri Sejak' },
    { icon: Building2,     value: cfg.statRombelValue || '24', label: cfg.statRombelLabel || 'Rombel' },
  ];

  // Logo yang file-nya gagal dimuat disembunyikan, bukan tampil sebagai teks alt
  const logoTampil = logoMitra.filter(l => !logoGagal.has(l.id));
  const logoMarquee = logoTampil.length >= 4;

  // Navbar transparan di atas hero gelap, berubah terang saat discroll
  const onDark = !scrolled;
  const navLink = (active: boolean) =>
    `text-sm font-semibold px-3 py-2 rounded-full transition-colors ${
      onDark
        ? active ? 'bg-white/15 text-white' : 'text-white/75 hover:text-white hover:bg-white/10'
        : active ? 'bg-primary/10 text-primary' : 'text-on-surface-variant hover:text-primary hover:bg-primary/5'
    }`;

  return (
    <div className="bg-background text-on-background antialiased">

      {/* ══════════ NAVBAR ══════════ */}
      <header className={`fixed top-0 w-full z-50 transition-all duration-300 ${
        scrolled ? 'glass-header border-b border-outline-variant/30 shadow-sm shadow-black/5' : 'bg-transparent border-b border-transparent'
      }`}>
        <div className={`flex justify-between items-center w-full px-4 md:px-8 lg:px-20 max-w-screen-2xl mx-auto transition-all duration-300 ${scrolled ? 'py-3' : 'py-5'}`}>

          {/* Brand */}
          <button onClick={() => scrollTo('beranda')} className="flex items-center gap-2.5 min-w-0">
            {cfg.logoUrl ? (
              <img src={cfg.logoUrl} alt={schoolName} className={`w-9 h-9 rounded-lg object-contain ${onDark ? 'bg-white p-0.5' : ''}`} />
            ) : (
              <span className={`w-9 h-9 rounded-lg flex items-center justify-center ${onDark ? 'bg-white/15' : 'bg-primary/10'}`}>
                <GraduationCap className={`w-5 h-5 ${onDark ? 'text-white' : 'text-primary'}`} />
              </span>
            )}
            <span className={`text-lg font-extrabold tracking-tight truncate transition-colors ${onDark ? 'text-white' : 'text-primary'}`}>{schoolName}</span>
          </button>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {[
              { label: 'Beranda',     id: 'beranda' },
              { label: 'Profil',      id: 'profil', skip: !showProfil },
              { label: 'Daftar Guru', id: 'guru' },
              { label: 'Berita',      id: 'berita' },
              { label: 'Kontak',      id: 'kontak' },
            ].filter(n => !n.skip).map(n => (
              <button key={n.label} onClick={() => scrollTo(n.id)} className={navLink(activeSection === n.id)}>
                {n.label}
              </button>
            ))}

            <button onClick={() => bukaModalAkses('lapor')} className={`${navLink(false)} flex items-center gap-1.5`}>
              <ShieldCheck className="w-4 h-4" /> Lapor
            </button>

            {/* ── Dropdown Dashboard ── */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={`${navLink(false)} flex items-center gap-1 focus:outline-none`}>
                  Dashboard <ChevronDown className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[230px] rounded-xl p-1.5">
                <DropdownMenuItem asChild>
                  <Link to="/dashboard-publik/kehadiran" className="flex items-center gap-3 font-semibold rounded-lg py-2">
                    <CalendarCheck className="w-4 h-4 shrink-0 text-primary" /> Dashboard Kehadiran
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/dashboard-publik/potensi" className="flex items-center gap-3 font-semibold rounded-lg py-2">
                    <ShieldCheck className="w-4 h-4 shrink-0 text-primary" /> Dashboard Potensi
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/dashboard-publik/tugas" className="flex items-center gap-3 font-semibold rounded-lg py-2">
                    <ClipboardList className="w-4 h-4 shrink-0 text-primary" /> Dashboard Tugas
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* ── Dropdown Presensi ── */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={`${navLink(false)} flex items-center gap-1 focus:outline-none`}>
                  Presensi <ChevronDown className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[190px] rounded-xl p-1.5">
                <DropdownMenuItem onSelect={() => bukaModalAkses('guru')} className="flex items-center gap-3 font-semibold cursor-pointer rounded-lg py-2">
                  <GraduationCap className="w-4 h-4 text-primary" /> Presensi Guru
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => bukaModalAkses('siswa')} className="flex items-center gap-3 font-semibold cursor-pointer rounded-lg py-2">
                  <Users className="w-4 h-4 text-primary" /> Presensi Siswa
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => navigate('/login')}
              className={`hidden lg:inline-flex gap-2 rounded-full h-10 px-5 ${onDark ? 'bg-white text-primary hover:bg-white/90' : ''}`}
            >
              <LogIn className="w-4 h-4" /> Login Portal
            </Button>
            <button
              className={`lg:hidden p-2 rounded-lg transition-colors ${onDark ? 'text-white hover:bg-white/10' : 'text-on-surface-variant hover:bg-surface-container'}`}
              onClick={() => setMobileOpen(true)}
              aria-label="Buka menu"
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>
        </div>
      </header>

      {/* ══════════ MOBILE MENU → Sheet ══════════ */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[300px] p-0 flex flex-col bg-surface" showCloseButton>
          <SheetHeader className="px-5 pt-5 pb-4 border-b border-outline-variant/30">
            <SheetTitle className="text-primary font-extrabold tracking-tight text-lg flex items-center gap-2">
              {cfg.logoUrl && <img src={cfg.logoUrl} alt={schoolName} className="w-7 h-7 rounded object-contain" />}
              {schoolName}
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
            {[
              { label: 'Beranda',     id: 'beranda',  icon: Home },
              { label: 'Profil',      id: 'profil',   icon: Users,         skip: !showProfil },
              { label: 'Daftar Guru', id: 'guru',     icon: GraduationCap },
              { label: 'Berita',      id: 'berita',   icon: Newspaper },
              { label: 'Kontak',      id: 'kontak',   icon: Phone },
            ].filter(n => !n.skip).map(n => {
              const NavIcon = n.icon;
              return (
                <button
                  key={n.label}
                  onClick={() => { scrollTo(n.id); setMobileOpen(false); }}
                  className={`flex items-center gap-3 w-full text-left text-sm font-semibold py-2.5 px-3 rounded-lg transition-colors ${
                    activeSection === n.id
                      ? 'bg-primary/10 text-primary'
                      : 'text-on-surface-variant hover:text-primary hover:bg-surface-container'
                  }`}
                >
                  <NavIcon className="w-4 h-4 shrink-0" /> {n.label}
                </button>
              );
            })}

            <div className="border-t border-outline-variant/30 pt-3 mt-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant px-3 mb-1">Dashboard</p>
              {[
                { to: '/dashboard-publik/kehadiran', icon: CalendarCheck, label: 'Dashboard Kehadiran' },
                { to: '/dashboard-publik/potensi',   icon: ShieldCheck,   label: 'Dashboard Potensi' },
                { to: '/dashboard-publik/tugas',     icon: ClipboardList, label: 'Dashboard Tugas' },
              ].map(({ to, icon: Icon, label }) => (
                <Link
                  key={to} to={to}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 w-full text-sm font-semibold py-2.5 px-3 rounded-lg transition-colors text-on-surface-variant hover:text-primary hover:bg-surface-container"
                >
                  <Icon className="w-4 h-4 shrink-0" /> {label}
                </Link>
              ))}
            </div>

            <div className="border-t border-outline-variant/30 pt-3 mt-3">
              <button
                onClick={() => bukaModalAkses('lapor')}
                className="flex items-center gap-3 w-full text-left text-sm font-semibold py-2.5 px-3 rounded-lg transition-colors text-on-surface-variant hover:text-primary hover:bg-surface-container"
              >
                <ShieldCheck className="w-4 h-4 shrink-0" /> Lapor Potensi
              </button>
            </div>

            <div className="border-t border-outline-variant/30 pt-3 mt-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant px-3 mb-1">Presensi</p>
              <button
                onClick={() => bukaModalAkses('guru')}
                className="flex items-center gap-3 w-full text-left text-sm font-semibold py-2.5 px-3 rounded-lg transition-colors text-on-surface-variant hover:text-primary hover:bg-surface-container"
              >
                <GraduationCap className="w-4 h-4 shrink-0" /> Presensi Guru
              </button>
              <button
                onClick={() => bukaModalAkses('siswa')}
                className="flex items-center gap-3 w-full text-left text-sm font-semibold py-2.5 px-3 rounded-lg transition-colors text-on-surface-variant hover:text-primary hover:bg-surface-container"
              >
                <Users className="w-4 h-4 shrink-0" /> Presensi Siswa
              </button>
            </div>
          </div>

          <div className="px-4 pb-5 pt-3 border-t border-outline-variant/30">
            <Button onClick={() => { setMobileOpen(false); navigate('/login'); }} className="w-full gap-2 h-11 rounded-xl">
              <LogIn className="w-4 h-4" /> Login Portal
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ══════════ HERO ══════════ */}
      <section id="beranda" className="relative hero-modern overflow-hidden">
        <div className="absolute inset-0 bg-grid-white pointer-events-none" />

        <div className="relative px-4 md:px-8 lg:px-20 max-w-screen-2xl mx-auto pt-32 pb-40 md:pt-40 md:pb-48 grid lg:grid-cols-2 gap-14 lg:gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-7 text-white"
          >
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/15 backdrop-blur px-4 py-1.5 rounded-full">
              <Sparkles className="w-3.5 h-3.5 text-sky-200" />
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-sky-100">
                {cfg.heroBadge || schoolName}
              </span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.08] tracking-tight">
              {cfg.heroTitle || 'Portal Akademik'}
              <span className="block mt-1 bg-gradient-to-r from-sky-200 via-white to-sky-200 bg-clip-text text-transparent">
                {cfg.heroSubtitle || 'Digital Masa Depan'}
              </span>
            </h1>

            <p className="text-base md:text-lg text-white/85 max-w-xl leading-relaxed">
              {cfg.deskripsi || 'Platform digital terintegrasi untuk seluruh ekosistem pendidikan sekolah Anda.'}
            </p>

            <div className="flex flex-wrap gap-3 pt-1">
              <button
                onClick={() => navigate('/login')}
                className="bg-white text-primary font-bold px-7 py-3.5 rounded-full flex items-center gap-2 hover:bg-sky-50 transition-all shadow-xl shadow-black/20 group text-sm"
              >
                Masuk Portal <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
              <button
                onClick={() => scrollTo(showProfil ? 'profil' : 'fitur')}
                className="bg-white/10 border border-white/20 text-white font-bold px-7 py-3.5 rounded-full hover:bg-white/15 transition-all text-sm backdrop-blur"
              >
                Kenali Sekolah Kami
              </button>
            </div>

            {/* Statistik ringkas */}
            <dl className="flex flex-wrap gap-x-8 gap-y-4 pt-6 border-t border-white/10 max-w-xl">
              {stats.slice(0, 3).filter(s => s.value !== '—').map(s => (
                <div key={s.label}>
                  <dt className="sr-only">{s.label}</dt>
                  <dd className="text-3xl font-extrabold tracking-tight">{s.value}</dd>
                  <p className="text-xs font-medium text-white/80 mt-0.5">{s.label}</p>
                </div>
              ))}
            </dl>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            <div className="absolute -inset-6 bg-sky-400/20 blur-3xl rounded-full pointer-events-none" />
            <div className="relative rounded-3xl p-2 bg-white/10 border border-white/15 backdrop-blur shadow-2xl shadow-black/30">
              {cfg.heroImageUrl ? (
                <img
                  src={cfg.heroImageUrl} alt={schoolName}
                  className="w-full aspect-[4/3] object-cover rounded-[1.25rem]"
                />
              ) : (
                <div className="w-full aspect-[4/3] rounded-[1.25rem] bg-white/5 flex items-center justify-center">
                  <GraduationCap className="w-20 h-20 text-white/30" />
                </div>
              )}
            </div>

            {/* Kartu melayang — fitur portal */}
            <div className="hidden sm:flex absolute -left-6 bottom-10 items-center gap-3 bg-white rounded-2xl shadow-xl shadow-black/20 px-4 py-3">
              <span className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CalendarCheck className="w-5 h-5" />
              </span>
              <div>
                <p className="text-sm font-bold text-on-surface leading-tight">Presensi Digital</p>
                <p className="text-xs text-on-surface-variant">Guru & siswa</p>
              </div>
            </div>
            <div className="hidden sm:flex absolute -right-4 top-8 items-center gap-3 bg-white rounded-2xl shadow-xl shadow-black/20 px-4 py-3">
              <span className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </span>
              <div>
                <p className="text-sm font-bold text-on-surface leading-tight">Ujian Online</p>
                <p className="text-xs text-on-surface-variant">Aman & terpantau</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ══════════ FITUR UNGGULAN (menimpa bawah hero) ══════════ */}
      <section id="fitur" className="relative z-10 -mt-24 md:-mt-28 px-4 md:px-8 lg:px-20 max-w-screen-2xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          {fiturItems.slice(0, 3).map((item, i) => {
            const Icon = ICON_MAP[item.icon] || BookOpen;
            return (
              <Reveal key={i} delay={i * 0.08}>
                <div className="group h-full bg-white rounded-2xl p-6 md:p-7 border border-outline-variant/30 shadow-[0_12px_40px_-12px_rgba(8,119,187,0.18)] hover:shadow-[0_20px_50px_-12px_rgba(8,119,187,0.28)] hover:-translate-y-1 transition-all duration-300">
                  <div className="flex items-start justify-between mb-5">
                    <span className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary-container text-white flex items-center justify-center shadow-lg shadow-primary/25 group-hover:scale-110 transition-transform">
                      <Icon className="w-6 h-6" />
                    </span>
                    <span className="text-4xl font-extrabold text-primary/10 leading-none">0{i + 1}</span>
                  </div>
                  <h3 className="text-lg font-bold text-on-surface mb-2">{item.title}</h3>
                  <p className="text-sm text-on-surface-variant leading-relaxed">{item.desc}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* ══════════ SAMBUTAN, STATISTIK, VISI-MISI ══════════ */}
      <section id="profil" className="py-20 md:py-28">
        <div className="px-4 md:px-8 lg:px-20 max-w-screen-2xl mx-auto space-y-16 md:space-y-20">

          {/* Sambutan */}
          <div className="grid lg:grid-cols-12 gap-10 lg:gap-16 items-center">
            <Reveal className="lg:col-span-5">
              <div className="relative max-w-md mx-auto lg:mx-0">
                <div className="absolute -top-5 -left-5 w-32 h-32 bg-dots rounded-2xl pointer-events-none" />
                <div className="absolute -bottom-5 -right-5 w-full h-full rounded-3xl bg-primary/10 pointer-events-none" />
                {cfg.kepsekFotoUrl ? (
                  <img
                    src={cfg.kepsekFotoUrl} alt={cfg.kepsekNama || 'Kepala Sekolah'}
                    className="relative w-full aspect-[4/5] object-cover object-top rounded-3xl shadow-xl"
                  />
                ) : (
                  <div className="relative w-full aspect-[4/5] rounded-3xl bg-surface-container flex items-center justify-center">
                    <Users className="w-20 h-20 text-outline" />
                  </div>
                )}
                {cfg.kepsekNama && (
                  <div className="absolute left-4 right-4 bottom-4 bg-white/95 backdrop-blur rounded-2xl px-5 py-4 shadow-lg">
                    <p className="font-bold text-on-surface leading-tight">{cfg.kepsekNama}</p>
                    <p className="text-xs font-semibold uppercase tracking-wider text-primary mt-1">{cfg.kepsekJabatan || 'Kepala Sekolah'}</p>
                  </div>
                )}
              </div>
            </Reveal>

            <Reveal delay={0.1} className="lg:col-span-7 space-y-6">
              <SectionHeading eyebrow="Sambutan" title="Sambutan Kepala Sekolah" />
              <div className="relative">
                <Quote className="absolute -top-2 -left-1 w-12 h-12 text-primary/10" />
                <p className="relative text-lg md:text-xl text-on-surface leading-relaxed pl-6 border-l-4 border-primary/20">
                  {cfg.kepsekSambutan || `Selamat datang di portal resmi ${schoolName}. Kami berkomitmen untuk menyediakan pendidikan yang berfokus pada keahlian teknis sekaligus membangun karakter dan literasi digital yang kokoh bagi seluruh siswa kami.`}
                </p>
              </div>
              <p className="text-on-surface-variant leading-relaxed">
                Melalui platform ini, kami berharap komunikasi antara pihak sekolah, siswa, dan orang tua dapat berjalan lebih transparan, efisien, dan mendukung ekosistem belajar yang modern.
              </p>
            </Reveal>
          </div>

          {/* Statistik */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {stats.map(({ icon: Icon, value, label }, i) => (
              <Reveal key={label} delay={i * 0.06}>
                <div className="h-full bg-white rounded-2xl p-6 border border-outline-variant/30 shadow-sm card-hover flex items-center gap-4">
                  <span className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Icon className="w-6 h-6 md:w-7 md:h-7" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-2xl md:text-3xl font-extrabold text-on-surface tracking-tight leading-none">{value}</div>
                    <div className="text-xs md:text-sm text-on-surface-variant font-medium mt-1.5 truncate">{label}</div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          {/* Visi & Misi */}
          {(cfg.visi || misiLines.length > 0) && (
            <div className={`grid gap-6 lg:gap-8 items-stretch ${cfg.profilImageUrl ? 'lg:grid-cols-2' : ''}`}>
              {cfg.profilImageUrl && (
                <Reveal className="h-full">
                  <div className="relative h-full min-h-[320px] lg:min-h-[520px] overflow-hidden rounded-3xl shadow-lg group">
                    <img src={cfg.profilImageUrl} alt={schoolName} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#05456e]/80 via-[#05456e]/10 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-7 md:p-8 text-white">
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-200">Profil Sekolah</p>
                      <p className="text-2xl md:text-3xl font-extrabold mt-2 tracking-tight">{schoolName}</p>
                      {cfg.alamat && <p className="text-sm text-white/75 mt-2 flex items-start gap-1.5"><MapPin className="w-4 h-4 mt-0.5 shrink-0" /><span className="line-clamp-2">{cfg.alamat}</span></p>}
                    </div>
                  </div>
                </Reveal>
              )}

              <div className="flex flex-col gap-6">
                {cfg.visi && (
                  <Reveal delay={0.08}>
                    <div className="relative overflow-hidden hero-modern rounded-3xl p-8 md:p-10 text-white shadow-xl shadow-primary/20">
                      <div className="absolute inset-0 bg-grid-white opacity-60 pointer-events-none" />
                      <div className="relative">
                        <div className="flex items-center gap-3 mb-4">
                          <span className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center"><Eye className="w-5 h-5" /></span>
                          <h3 className="text-2xl font-extrabold">Visi</h3>
                        </div>
                        <p className="text-lg md:text-xl leading-relaxed text-sky-50">{cfg.visi}</p>
                      </div>
                    </div>
                  </Reveal>
                )}
                {misiLines.length > 0 && (
                  <Reveal delay={0.14} className="flex-1">
                    <div className="h-full bg-white rounded-3xl p-8 md:p-10 border border-outline-variant/30 shadow-sm">
                      <div className="flex items-center gap-3 mb-6">
                        <span className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><Target className="w-5 h-5" /></span>
                        <h3 className="text-2xl font-extrabold text-on-surface">Misi</h3>
                      </div>
                      <ol className="space-y-4">
                        {misiLines.map((item, i) => (
                          <li key={i} className="flex gap-4 items-start">
                            <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary text-sm font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                            <span className="text-on-surface-variant leading-relaxed">{item}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </Reveal>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ══════════ PROFIL GURU — SLIDER ══════════ */}
      <section id="guru" className="py-20 md:py-28 bg-surface-container-low overflow-hidden">
        <div className="px-4 md:px-8 lg:px-20 max-w-screen-2xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-10 md:mb-12">
            <SectionHeading
              eyebrow="Tenaga Pendidik"
              title="Guru & Staf Kami"
              desc="Dibimbing oleh guru-guru profesional yang berdedikasi tinggi untuk mencetak generasi unggul dan berkarakter."
            />
            {totalSliderPages > 1 && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => { sliderPrev(); clearInterval(sliderTimerRef.current); }}
                  className="w-11 h-11 rounded-full bg-white border border-outline-variant/50 flex items-center justify-center text-on-surface-variant hover:bg-primary hover:text-white hover:border-primary transition-all shadow-sm"
                  aria-label="Sebelumnya"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => { sliderNext(); clearInterval(sliderTimerRef.current); }}
                  className="w-11 h-11 rounded-full bg-white border border-outline-variant/50 flex items-center justify-center text-on-surface-variant hover:bg-primary hover:text-white hover:border-primary transition-all shadow-sm"
                  aria-label="Berikutnya"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>

          {isLoadingGuru ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="w-full aspect-[3/4] rounded-2xl" />
              ))}
            </div>
          ) : guruProfil.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-outline-variant">
              <GraduationCap className="w-12 h-12 mx-auto mb-3 text-outline" />
              <p className="font-semibold text-on-surface">Data guru belum tersedia</p>
              <p className="text-sm text-on-surface-variant mt-1">Profil tenaga pendidik akan segera ditampilkan.</p>
            </div>
          ) : (
            <motion.div
              key={sliderPage}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6"
            >
              {visibleGuru.map((guru) => {
                const initials = guru.nama.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
                return (
                  <div key={guru.id} className="group relative w-full aspect-[3/4] rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-shadow duration-300">
                    <Avatar className="w-full h-full rounded-none">
                      <AvatarImage
                        src={guru.fotoUrl ?? undefined}
                        alt={guru.nama}
                        className="w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-105"
                      />
                      <AvatarFallback className="w-full h-full rounded-none hero-modern">
                        <span className="text-5xl md:text-6xl font-extrabold text-white/90 tracking-tight -mt-12">{initials}</span>
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-16 pb-4 px-4">
                      <h3 className="font-bold text-white text-sm md:text-base leading-snug line-clamp-2">{guru.nama}</h3>
                      {guru.mataPelajaran && (
                        <span className="inline-block mt-1.5 text-[11px] md:text-xs font-semibold text-white bg-white/20 backdrop-blur px-2.5 py-0.5 rounded-full line-clamp-1">
                          {guru.mataPelajaran}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </motion.div>
          )}

          {totalSliderPages > 1 && (
            <div className="flex justify-center gap-2 mt-10">
              {Array.from({ length: totalSliderPages }).map((_, i) => (
                <button
                  key={i} onClick={() => sliderGoTo(i)}
                  aria-label={`Halaman ${i + 1}`}
                  className={`h-2 rounded-full transition-all duration-300 ${i === sliderPage ? 'w-8 bg-primary' : 'w-2 bg-outline-variant hover:bg-outline'}`}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ══════════ DOKUMEN & AGENDA ══════════ */}
      {(dokumenList.length > 0 || agendaList.length > 0) && (
        <section className="py-20 md:py-28">
          <div className="px-4 md:px-8 lg:px-20 max-w-screen-2xl mx-auto">
            <div className={`grid gap-10 lg:gap-12 ${dokumenList.length > 0 && agendaList.length > 0 ? 'lg:grid-cols-2' : ''}`}>
              {dokumenList.length > 0 && (
                <Reveal className="space-y-6">
                  <div className="flex items-end justify-between gap-4">
                    <SectionHeading eyebrow="Unduhan" title="Dokumen Sekolah" />
                    <Link to="/dokumen" className="text-sm font-semibold text-primary hover:gap-2 flex items-center gap-1 transition-all shrink-0">
                      Lihat Semua <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                  <div className="space-y-3">
                    {dokumenList.map(doc => (
                      <a key={doc.id} href={doc.linkDrive} target="_blank" rel="noopener noreferrer"
                        className="group flex items-center gap-4 p-4 bg-white border border-outline-variant/30 rounded-2xl hover:border-primary/40 hover:shadow-md transition-all"
                      >
                        <span className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors shrink-0">
                          <FileText className="w-5 h-5" />
                        </span>
                        <div className="flex-grow min-w-0">
                          <h4 className="font-semibold text-on-surface truncate group-hover:text-primary transition-colors">{doc.judul}</h4>
                          <p className="text-xs text-on-surface-variant mt-0.5">Google Drive</p>
                        </div>
                        <ExternalLink className="w-4 h-4 text-on-surface-variant/40 group-hover:text-primary transition-colors shrink-0" />
                      </a>
                    ))}
                  </div>
                </Reveal>
              )}
              {agendaList.length > 0 && (
                <Reveal delay={0.08} className="space-y-6">
                  <SectionHeading eyebrow="Kegiatan" title="Agenda Sekolah" />
                  <div className="space-y-3">
                    {agendaList.map(item => {
                      const d     = new Date(item.waktu);
                      const bulan = d.toLocaleDateString('id-ID', { month: 'short' });
                      const tgl   = d.getDate();
                      const jam   = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                      return (
                        <div key={item.id} className="group flex items-center gap-5 p-4 bg-white border border-outline-variant/30 rounded-2xl hover:border-primary/40 hover:shadow-md transition-all">
                          <div className="flex flex-col items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-primary-container text-white shrink-0 shadow-md shadow-primary/20">
                            <span className="text-[10px] font-bold uppercase leading-none opacity-80">{bulan}</span>
                            <span className="text-xl font-extrabold leading-tight">{tgl}</span>
                          </div>
                          <div className="flex-grow min-w-0">
                            <h4 className="font-semibold text-on-surface group-hover:text-primary transition-colors truncate">{item.judul}</h4>
                            <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-on-surface-variant">
                              <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {jam}</span>
                              {item.lokasi && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {item.lokasi}</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Reveal>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ══════════ BERITA SEKOLAH ══════════ */}
      <section id="berita" className={`py-20 md:py-28 ${dokumenList.length > 0 || agendaList.length > 0 ? 'bg-surface-container-low' : ''}`}>
        <div className="px-4 md:px-8 lg:px-20 max-w-screen-2xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10 md:mb-12">
            <SectionHeading eyebrow="Informasi Terkini" title="Berita Sekolah" />
            <Link to="/berita" className="text-sm font-semibold text-primary flex items-center gap-1 hover:gap-2 transition-all shrink-0">
              Lihat Semua Berita <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {isLoadingBerita ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white rounded-2xl border border-outline-variant/30 overflow-hidden">
                  <Skeleton className="aspect-[16/10] rounded-none" />
                  <div className="p-6 space-y-3">
                    <Skeleton className="h-3 w-1/3 rounded-full" />
                    <Skeleton className="h-5 rounded" />
                    <Skeleton className="h-5 w-3/4 rounded" />
                    <Skeleton className="h-3 w-5/6 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : beritaList.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-outline-variant">
              <Newspaper className="w-12 h-12 mx-auto mb-3 text-outline" />
              <p className="font-semibold text-on-surface">Belum ada berita</p>
              <p className="text-sm text-on-surface-variant mt-1">Berita dan pengumuman sekolah akan tampil di sini.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {beritaList.map((item, i) => (
                <Reveal key={item.id} delay={i * 0.08} className="h-full">
                  <Link
                    to={`/berita/${item.slug}`}
                    className="group h-full flex flex-col bg-white rounded-2xl overflow-hidden border border-outline-variant/30 hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                  >
                    <div className="aspect-[16/10] overflow-hidden relative bg-surface-container">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.judul} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-surface-container to-surface-container-high">
                          <Newspaper className="w-12 h-12 text-primary/30" />
                        </div>
                      )}
                      <span className="absolute top-4 left-4 bg-white/95 backdrop-blur text-primary text-[11px] font-bold px-3 py-1 rounded-full shadow-sm">
                        {(item as any).kategori || 'Berita'}
                      </span>
                    </div>
                    <div className="p-6 flex flex-col flex-1">
                      <p className="text-xs text-on-surface-variant font-medium flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" /> {formatTanggal(item.publishedAt)}
                      </p>
                      <h3 className="mt-3 text-lg font-bold leading-snug text-on-surface group-hover:text-primary transition-colors line-clamp-2">{item.judul}</h3>
                      {item.ringkasan && <p className="mt-2 text-on-surface-variant line-clamp-2 leading-relaxed text-sm">{item.ringkasan}</p>}
                      <span className="mt-auto pt-5 text-sm font-semibold text-primary flex items-center gap-1 group-hover:gap-2 transition-all">
                        Baca selengkapnya <ArrowRight className="w-4 h-4" />
                      </span>
                    </div>
                  </Link>
                </Reveal>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ══════════ LOGO MITRA ══════════ */}
      {logoTampil.length > 0 && (
        <section className="py-12 border-y border-outline-variant/30 bg-white overflow-hidden">
          <p className="text-center text-xs font-bold uppercase tracking-[0.2em] text-on-surface-variant mb-8">Didukung Oleh</p>
          <div className={logoMarquee ? '[mask-image:linear-gradient(90deg,transparent,#000_10%,#000_90%,transparent)]' : ''}>
            <div className={logoMarquee ? 'flex w-max animate-marquee' : 'flex flex-wrap justify-center px-4'}>
              {(logoMarquee ? [...logoTampil, ...logoTampil] : logoTampil).map((logo, idx) => {
                const img = (
                  <img
                    src={logo.imageUrl} alt={logo.nama} title={logo.nama}
                    onError={() => setLogoGagal(prev => new Set(prev).add(logo.id))}
                    className="h-12 md:h-14 w-auto object-contain grayscale opacity-60 hover:grayscale-0 hover:opacity-100 transition-all duration-300"
                  />
                );
                return (
                  <div key={`${logo.id}-${idx}`} className="px-8 md:px-12 flex items-center shrink-0">
                    {logo.linkUrl ? <a href={logo.linkUrl} target="_blank" rel="noopener noreferrer">{img}</a> : img}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ══════════ CTA ══════════ */}
      <section className="py-20 md:py-24">
        <div className="px-4 md:px-8 lg:px-20 max-w-screen-2xl mx-auto">
          <Reveal>
            <div className="relative overflow-hidden hero-modern rounded-3xl px-6 py-12 md:px-16 md:py-16 text-white">
              <div className="absolute inset-0 bg-grid-white pointer-events-none" />
              <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                <div className="max-w-2xl">
                  <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">Akses semua layanan sekolah dalam satu portal</h2>
                  <p className="mt-3 text-white/85 text-base md:text-lg leading-relaxed">
                    Ujian online, nilai, presensi, dan informasi akademik untuk siswa, guru, dan admin.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3 shrink-0">
                  <button
                    onClick={() => navigate('/login')}
                    className="bg-white text-primary font-bold px-7 py-3.5 rounded-full flex items-center gap-2 hover:bg-sky-50 transition-all shadow-xl shadow-black/20 group text-sm"
                  >
                    <LogIn className="w-4 h-4" /> Masuk Portal
                  </button>
                  <Link
                    to="/dashboard-publik/kehadiran"
                    className="bg-white/10 border border-white/20 text-white font-bold px-7 py-3.5 rounded-full hover:bg-white/15 transition-all text-sm flex items-center gap-2"
                  >
                    <CalendarCheck className="w-4 h-4" /> Lihat Kehadiran
                  </Link>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <SiteFooter />

      {/* ══════════ MODAL KODE AKSES → Shadcn Dialog ══════════ */}
      <Dialog
        open={aksesModal.open}
        onOpenChange={(open) => !open && setAksesModal({ open: false, jenis: null })}
      >
        <DialogContent className="max-w-sm rounded-2xl p-6 gap-0" showCloseButton={false}>
          <DialogHeader className="mb-5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-primary-container flex items-center justify-center shrink-0 shadow-md shadow-primary/25">
                <KeyRound className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <DialogTitle className="text-base text-left">
                  {aksesModal.jenis === 'lapor' ? 'Kode Akses Lapor' : 'Kode Akses Presensi'}
                </DialogTitle>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  {aksesModal.jenis === 'guru' ? 'Presensi Guru' : aksesModal.jenis === 'siswa' ? 'Presensi Siswa' : 'Lapor Potensi Siswa'}
                </p>
              </div>
              <button
                className="p-1.5 rounded-lg hover:bg-surface-container text-on-surface-variant transition-colors"
                onClick={() => setAksesModal({ open: false, jenis: null })}
                aria-label="Tutup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </DialogHeader>

          <div className="space-y-2 mb-5">
            <label className="text-sm font-semibold text-on-surface">Masukkan kode akses 6 karakter</label>
            <input
              ref={kodeRef}
              type="text"
              maxLength={6}
              value={kodeInput}
              onChange={e => setKodeInput(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && verifikasiKode()}
              placeholder="Contoh: ABC123"
              className="w-full px-4 py-3.5 rounded-xl border border-outline-variant bg-surface text-on-surface text-center text-xl font-mono tracking-[0.4em] placeholder:tracking-normal placeholder:text-sm placeholder:font-sans placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setAksesModal({ open: false, jenis: null })}
              className="flex-1 px-4 py-2.5 rounded-xl border border-outline-variant text-sm font-semibold text-on-surface-variant hover:bg-surface-container transition-colors"
            >
              Batal
            </button>
            <button
              onClick={verifikasiKode}
              disabled={aksesLoading || kodeInput.length !== 6}
              className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-container disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {aksesLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {aksesLoading ? 'Memverifikasi...' : 'Masuk'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
