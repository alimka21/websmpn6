import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  LogIn, ArrowRight, Users, GraduationCap, BookOpen, Building2,
  Eye, Target, CheckCircle, CalendarCheck, ShieldCheck,
  FileText, ClipboardList, MapPin, Clock, ExternalLink, Newspaper,
  Briefcase, Menu, X, Quote, Calendar, Compass, Lightbulb,
  Home, Layers, Phone, ChevronDown,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import SiteFooter from '../components/SiteFooter';
import api from '../lib/api';
import { useSiteConfig } from '../hooks/useSiteConfig';

// ── Icon map untuk fiturUnggulan dari siteConfig ────────────────────────────
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

interface FiturItem { icon: string; title: string; desc: string }

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
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase();
};

export default function LandingPage() {
  const [beritaList, setBeritaList]     = useState<Berita[]>([]);
  const [isLoadingBerita, setIsLoadingBerita] = useState(true);
  const [dokumenList, setDokumenList]   = useState<DokumenItem[]>([]);
  const [agendaList, setAgendaList]     = useState<AgendaItem[]>([]);
  const [mobileOpen, setMobileOpen]       = useState(false);
  const [activeSection, setActiveSection] = useState('beranda');
  const [scrolled, setScrolled]           = useState(false);
  const [presensiDropdown, setPresensiDropdown] = useState(false);
  const navigate = useNavigate();
  const cfg       = useSiteConfig();
  const schoolName = cfg.namaSekolah || 'Portal Sekolah';

  // Scroll tracking — active section + navbar shadow
  useEffect(() => {
    const SECTIONS = ['kontak', 'berita', 'fitur', 'profil', 'beranda'];
    const onScroll = () => {
      setScrolled(window.scrollY > 20);
      for (const id of SECTIONS) {
        const el = document.getElementById(id);
        if (el && window.scrollY >= el.offsetTop - 120) {
          setActiveSection(id);
          break;
        }
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    api.get('/api/berita?limit=3')
      .then((r: any) => setBeritaList(r.data || r.items || (Array.isArray(r) ? r : [])))
      .catch(() => {})
      .finally(() => setIsLoadingBerita(false));
    api.get('/api/dokumen?limit=5')
      .then((r: any) => setDokumenList(Array.isArray(r) ? r : []))
      .catch(() => {});
    api.get('/api/agenda?limit=5')
      .then((r: any) => setAgendaList(Array.isArray(r) ? r : []))
      .catch(() => {});
  }, []);

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

  return (
    <div className="bg-background text-on-background antialiased">

      {/* ══════════════════════════════════════════════════
          NAVBAR
      ══════════════════════════════════════════════════ */}
      <header className={`fixed top-0 w-full z-50 border-b border-outline-variant/30 glass-header transition-shadow duration-300 ${scrolled ? 'shadow-md shadow-black/5' : ''}`}>
        <div className="flex justify-between items-center w-full px-4 md:px-20 py-4 max-w-screen-2xl mx-auto">
          {/* Brand */}
          <div className="flex items-center gap-2.5">
            {cfg.logoUrl && (
              <img src={cfg.logoUrl} alt={schoolName} className="w-8 h-8 rounded-lg object-contain" />
            )}
            <span className="text-xl font-extrabold text-primary tracking-tight">{schoolName}</span>
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-8">
            {[
              { label: 'Beranda', id: 'beranda' },
              { label: 'Profil',  id: 'profil',  skip: !showProfil },
              { label: 'Fitur',   id: 'fitur' },
              { label: 'Berita',  id: 'berita' },
              { label: 'Kontak',  id: 'kontak' },
            ].filter(n => !n.skip).map(n => (
              <button
                key={n.id}
                onClick={() => scrollTo(n.id)}
                className={`text-sm font-semibold transition-colors relative pb-1 ${
                  activeSection === n.id
                    ? 'text-primary after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary after:rounded-full'
                    : 'text-on-surface-variant hover:text-primary'
                }`}
              >
                {n.label}
              </button>
            ))}

            {/* Dropdown Presensi */}
            <div
              className="relative group"
              onMouseEnter={() => setPresensiDropdown(true)}
              onMouseLeave={() => setPresensiDropdown(false)}
            >
              <button
                onClick={() => setPresensiDropdown(!presensiDropdown)}
                className="text-sm font-semibold text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1 py-2"
              >
                Presensi
                <ChevronDown className={`w-4 h-4 transition-transform ${presensiDropdown ? 'rotate-180' : ''}`} />
              </button>
              {presensiDropdown && (
                <div className="absolute top-full left-0 pt-2">
                  <div className="bg-surface-container-lowest rounded-xl shadow-xl border border-outline-variant overflow-hidden min-w-[180px]">
                    <Link
                      to="/presensi/guru"
                      className="flex items-center gap-3 px-4 py-3 text-sm font-semibold text-on-surface hover:bg-surface-container hover:text-primary transition-colors"
                      onClick={() => setPresensiDropdown(false)}
                    >
                      <GraduationCap className="w-4 h-4" />
                      Presensi Guru
                    </Link>
                    <Link
                      to="/presensi/siswa"
                      className="flex items-center gap-3 px-4 py-3 text-sm font-semibold text-on-surface hover:bg-surface-container hover:text-primary transition-colors border-t border-outline-variant/30"
                      onClick={() => setPresensiDropdown(false)}
                    >
                      <Users className="w-4 h-4" />
                      Presensi Siswa
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </nav>

          <div className="flex items-center gap-3">
            <Button onClick={() => navigate('/login')} size="sm" className="hidden md:inline-flex gap-2">
              <LogIn className="w-4 h-4" /> Login Portal
            </Button>
            <button
              className="md:hidden p-2 rounded-lg text-on-surface-variant"
              onClick={() => setMobileOpen(o => !o)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden bg-surface border-t border-outline-variant/30 px-4 py-4 space-y-1">
            {[
              { label: 'Beranda', id: 'beranda',  icon: Home },
              { label: 'Profil',  id: 'profil',   icon: Users,    skip: !showProfil },
              { label: 'Fitur',   id: 'fitur',    icon: Layers },
              { label: 'Berita',  id: 'berita',   icon: Newspaper },
              { label: 'Kontak',  id: 'kontak',   icon: Phone },
            ].filter(n => !n.skip).map(n => {
              const NavIcon = n.icon;
              const isActive = activeSection === n.id;
              return (
                <button
                  key={n.id}
                  onClick={() => { scrollTo(n.id); setMobileOpen(false); }}
                  className={`flex items-center gap-3 w-full text-left text-sm font-semibold py-2.5 px-3 rounded-lg transition-colors ${
                    isActive ? 'bg-primary/10 text-primary' : 'text-on-surface-variant hover:text-primary hover:bg-surface-container'
                  }`}
                >
                  <NavIcon className="w-4 h-4 shrink-0" />
                  {n.label}
                </button>
              );
            })}

            {/* Presensi Dropdown Mobile */}
            <div className="border-t border-outline-variant/30 pt-2 mt-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant px-3 mb-1">Presensi</p>
              <Link
                to="/presensi/guru"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 w-full text-left text-sm font-semibold py-2.5 px-3 rounded-lg transition-colors text-on-surface-variant hover:text-primary hover:bg-surface-container"
              >
                <GraduationCap className="w-4 h-4 shrink-0" />
                Presensi Guru
              </Link>
              <Link
                to="/presensi/siswa"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 w-full text-left text-sm font-semibold py-2.5 px-3 rounded-lg transition-colors text-on-surface-variant hover:text-primary hover:bg-surface-container"
              >
                <Users className="w-4 h-4 shrink-0" />
                Presensi Siswa
              </Link>
            </div>

            <Button onClick={() => navigate('/login')} className="w-full mt-3 gap-2">
              <LogIn className="w-4 h-4" /> Login Portal
            </Button>
          </div>
        )}
      </header>

      {/* ══════════════════════════════════════════════════
          HERO
      ══════════════════════════════════════════════════ */}
      <section id="beranda" className="hero-gradient pt-40 pb-24 md:pt-48 md:pb-40 text-white overflow-hidden relative">
        <div className="px-4 md:px-20 max-w-screen-2xl mx-auto grid md:grid-cols-2 gap-12 items-center relative z-10">
          <div className="space-y-8">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-white/15 px-4 py-2 rounded-full backdrop-blur-md border border-white/20">
              <span className="w-2 h-2 rounded-full bg-primary-fixed animate-pulse" />
              <span className="text-xs font-extrabold uppercase tracking-[0.2em] text-primary-fixed">
                {cfg.heroBadge || schoolName.toUpperCase()}
              </span>
            </div>

            {/* Heading */}
            <h1 className="text-4xl md:text-6xl font-extrabold leading-tight tracking-tight">
              {cfg.heroTitle || 'Portal Akademik'}
              <br />
              <span className="text-amber-400">
                {cfg.heroSubtitle || 'Digital Masa Depan'}
              </span>
            </h1>

            {/* Description */}
            <p className="text-lg text-white/90 max-w-lg leading-relaxed">
              {cfg.deskripsi || 'Platform digital terintegrasi untuk seluruh ekosistem pendidikan sekolah Anda.'}
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap gap-4">
              <button
                onClick={() => navigate('/login')}
                className="bg-white text-primary font-bold px-8 py-4 rounded-xl flex items-center gap-2 hover:bg-primary-fixed transition-all shadow-xl shadow-black/20 group"
              >
                Login Portal
                <LogIn className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
              <button
                onClick={() => scrollTo('fitur')}
                className="bg-white/10 hover:bg-white/20 border border-white/30 text-white font-bold px-8 py-4 rounded-xl transition-all backdrop-blur-sm"
              >
                Lihat Fitur
              </button>
            </div>
          </div>

          {/* Hero image */}
          <div className="relative group">
            <div className="absolute -inset-4 bg-primary-fixed/30 blur-[100px] rounded-full opacity-50" />
            {cfg.heroImageUrl ? (
              <img
                src={cfg.heroImageUrl}
                alt={schoolName}
                className="w-full h-auto rounded-2xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] relative z-20 border border-white/20 transition-transform duration-700 group-hover:scale-[1.01]"
              />
            ) : (
              <div className="w-full aspect-video rounded-2xl bg-white/10 border border-white/20 relative z-20 flex items-center justify-center">
                <GraduationCap className="w-24 h-24 text-white/30" />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          SAMBUTAN & STATISTIK
      ══════════════════════════════════════════════════ */}
      <section id="profil" className="py-16 md:py-24 bg-surface-container-low">
        <div className="px-4 md:px-20 max-w-screen-2xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-semibold text-on-background">Sambutan & Data Sekolah</h2>
          </div>

          <div className="grid lg:grid-cols-12 gap-6 items-stretch">
            {/* Sambutan */}
            <div className="lg:col-span-8 bg-surface-container-lowest rounded-2xl p-8 md:p-12 shadow-sm border border-outline-variant/30 card-hover">
              <div className="grid md:grid-cols-12 gap-8 items-start">
                {/* Foto kepsek */}
                <div className="md:col-span-4 text-center">
                  <div className="relative inline-block mb-6">
                    {cfg.kepsekFotoUrl ? (
                      <img
                        src={cfg.kepsekFotoUrl}
                        alt={cfg.kepsekNama || 'Kepala Sekolah'}
                        className="w-48 h-60 object-cover rounded-xl shadow-lg border-2 border-white mx-auto"
                      />
                    ) : (
                      <div className="w-48 h-60 bg-surface-container rounded-xl border-2 border-white mx-auto flex items-center justify-center">
                        <Users className="w-16 h-16 text-outline" />
                      </div>
                    )}
                    <div className="absolute -bottom-3 -right-3 bg-primary p-3 rounded-xl text-white shadow-lg">
                      <Quote className="w-4 h-4" />
                    </div>
                  </div>
                  {cfg.kepsekNama && (
                    <>
                      <h3 className="text-xl font-semibold text-primary tracking-tight">{cfg.kepsekNama}</h3>
                      <p className="text-on-surface-variant font-bold uppercase tracking-wider text-[11px] mt-1">
                        {cfg.kepsekJabatan || 'Kepala Sekolah'}
                      </p>
                    </>
                  )}
                </div>

                {/* Teks sambutan */}
                <div className="md:col-span-8 space-y-6">
                  <p className="text-on-surface italic leading-relaxed text-lg">
                    "{cfg.kepsekSambutan || `Selamat datang di portal resmi ${schoolName}. Kami berkomitmen untuk menyediakan pendidikan yang berfokus pada keahlian teknis sekaligus membangun karakter dan literasi digital yang kokoh bagi seluruh siswa kami.`}"
                  </p>
                  <div className="flex gap-2">
                    <div className="w-16 h-1.5 bg-primary rounded-full" />
                    <div className="w-6 h-1.5 bg-primary/20 rounded-full" />
                  </div>
                  <p className="text-on-surface-variant leading-relaxed">
                    Melalui platform ini, kami berharap komunikasi antara pihak sekolah, siswa, dan orang tua dapat berjalan lebih transparan, efisien, dan mendukung ekosistem belajar yang modern.
                  </p>
                </div>
              </div>
            </div>

            {/* Stat cards */}
            <div className="lg:col-span-4 grid grid-cols-2 gap-4">
              {[
                { icon: Users,         value: cfg.statSiswaValue  || '—', label: cfg.statSiswaLabel  || 'Siswa Aktif' },
                { icon: GraduationCap, value: cfg.statGuruValue   || '—', label: cfg.statGuruLabel   || 'Tenaga Pendidik' },
                { icon: BookOpen,      value: cfg.statTahunValue  || '—', label: cfg.statTahunLabel  || 'Berdiri Sejak' },
                { icon: Building2,     value: cfg.statRombelValue || '24', label: cfg.statRombelLabel || 'Rombel' },
              ].map(({ icon: Icon, value, label }) => (
                <div key={label} className="bg-primary p-6 rounded-2xl text-white flex flex-col items-center justify-center text-center shadow-lg shadow-primary/20 card-hover border border-white/10">
                  <Icon className="text-primary-fixed mb-3 w-7 h-7" />
                  <div className="text-4xl font-extrabold tracking-tight leading-none mb-1">{value}</div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.15em] opacity-80">{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Visi & Misi */}
          <div className="grid lg:grid-cols-2 gap-8 mt-12 items-start">
            {/* Kiri: Foto Sekolah */}
            {cfg.profilImageUrl && (
              <div className="relative group overflow-hidden rounded-2xl shadow-lg border border-outline-variant/30 h-full">
                <img
                  src={cfg.profilImageUrl}
                  alt={schoolName}
                  className="w-full h-full min-h-[500px] object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                <div className="absolute bottom-6 left-6 text-white">
                  <p className="text-sm font-bold uppercase tracking-[0.2em] opacity-90">Kampus Kami</p>
                </div>
              </div>
            )}

            {/* Kanan: Visi & Misi */}
            <div className="space-y-6">
              {/* Visi */}
              {cfg.visi && (
                <div className="bg-surface-container-lowest p-8 md:p-10 rounded-2xl shadow-sm border border-outline-variant/30 card-hover space-y-4">
                  <div className="flex items-center gap-4 mb-2">
                    <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary border border-primary/20">
                      <Eye className="w-6 h-6" />
                    </div>
                    <h3 className="text-2xl font-semibold text-on-background">Visi</h3>
                  </div>
                  <p className="text-on-surface-variant leading-relaxed text-lg">{cfg.visi}</p>
                </div>
              )}

              {/* Misi */}
              {misiLines.length > 0 && (
                <div className="bg-surface-container-lowest p-8 md:p-10 rounded-2xl shadow-sm border border-outline-variant/30 card-hover flex flex-col">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary border border-primary/20">
                      <Target className="w-6 h-6" />
                    </div>
                    <h3 className="text-2xl font-semibold text-on-background">Misi</h3>
                  </div>
                  <ul className="space-y-6">
                    {misiLines.map((item, i) => (
                      <li key={i} className="flex gap-4 items-start">
                        <CheckCircle className="w-6 h-6 text-primary mt-0.5 shrink-0" />
                        <span className="text-on-surface-variant text-lg leading-relaxed">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          INOVASI / FITUR UNGGULAN
      ══════════════════════════════════════════════════ */}
      <section id="fitur" className="py-16 md:py-24 bg-surface">
        <div className="px-4 md:px-20 max-w-screen-2xl mx-auto space-y-12">
          <div className="text-center">
            <h2 className="text-3xl font-semibold text-on-background">Inovasi Sekolah Kami</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {fiturItems.map((item, i) => {
              const Icon = ICON_MAP[item.icon] || BookOpen;
              return (
                <div key={i} className="group bg-surface-container-lowest p-8 rounded-2xl border border-outline-variant/30 card-hover shadow-sm">
                  <div className="w-14 h-14 bg-surface-container rounded-xl flex items-center justify-center text-primary mb-6 group-hover:bg-primary group-hover:text-white transition-all duration-300">
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-2xl font-semibold mb-4 text-on-background group-hover:text-primary transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-on-surface-variant mb-8 leading-relaxed">{item.desc}</p>
                  <button
                    onClick={() => navigate('/login')}
                    className="text-primary font-bold text-xs flex items-center gap-2 group-hover:translate-x-2 transition-transform uppercase tracking-wider"
                  >
                    PELAJARI LEBIH LANJUT <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          DOKUMEN & AGENDA
      ══════════════════════════════════════════════════ */}
      {(dokumenList.length > 0 || agendaList.length > 0) && (
        <section className="py-16 md:py-24 bg-surface-container-low">
          <div className="px-4 md:px-20 max-w-screen-2xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12">

              {/* Dokumen Sekolah */}
              {dokumenList.length > 0 && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-3xl font-semibold text-on-background flex items-center gap-3">
                      <FileText className="w-7 h-7 text-primary" />
                      Dokumen Sekolah
                    </h2>
                    <Link
                      to="/dokumen"
                      className="text-sm font-semibold text-primary hover:underline flex items-center gap-1"
                    >
                      Lihat Semua <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                  <div className="space-y-3">
                    {dokumenList.map((doc, idx) => {
                      const colors = [
                        { bg: 'bg-blue-50',   text: 'text-blue-600',   hover: 'group-hover:bg-blue-600' },
                        { bg: 'bg-red-50',    text: 'text-red-600',    hover: 'group-hover:bg-red-600' },
                        { bg: 'bg-green-50',  text: 'text-green-600',  hover: 'group-hover:bg-green-600' },
                        { bg: 'bg-purple-50', text: 'text-purple-600', hover: 'group-hover:bg-purple-600' },
                        { bg: 'bg-amber-50',  text: 'text-amber-600',  hover: 'group-hover:bg-amber-600' },
                      ];
                      const c = colors[idx % colors.length];
                      return (
                        <a
                          key={doc.id}
                          href={doc.linkDrive}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group flex items-center gap-4 p-4 bg-surface-container-lowest border border-outline-variant/30 rounded-xl card-hover shadow-sm"
                        >
                          <div className={`w-12 h-12 rounded-lg ${c.bg} ${c.text} flex items-center justify-center ${c.hover} group-hover:text-white transition-all shrink-0`}>
                            <FileText className="w-5 h-5" />
                          </div>
                          <div className="flex-grow min-w-0">
                            <h4 className="font-bold text-on-surface truncate">{doc.judul}</h4>
                            <p className="text-xs text-on-surface-variant mt-0.5 flex items-center gap-1">
                              <ExternalLink className="w-3 h-3" /> Google Drive
                            </p>
                          </div>
                          <ExternalLink className="w-4 h-4 text-on-surface-variant opacity-30 group-hover:opacity-100 transition-opacity shrink-0" />
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Agenda Sekolah */}
              {agendaList.length > 0 && (
                <div className="space-y-6">
                  <h2 className="text-3xl font-semibold text-on-background flex items-center gap-3">
                    <Calendar className="w-7 h-7 text-primary" />
                    Agenda Sekolah
                  </h2>
                  <div className="space-y-4">
                    {agendaList.map(item => {
                      const d = new Date(item.waktu);
                      const bulan = d.toLocaleDateString('id-ID', { month: 'short' });
                      const tgl   = d.getDate();
                      const jam   = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                      return (
                        <div key={item.id} className="flex items-center gap-6 p-5 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl card-hover shadow-sm group">
                          <div className="flex flex-col items-center justify-center min-w-[60px] h-[60px] bg-primary/5 rounded-xl text-primary font-bold shrink-0">
                            <span className="text-xs uppercase leading-none">{bulan}</span>
                            <span className="text-xl">{tgl}</span>
                          </div>
                          <div className="flex-grow min-w-0">
                            <h4 className="font-bold text-on-surface group-hover:text-primary transition-colors truncate">{item.judul}</h4>
                            <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-on-surface-variant">
                              <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {jam}</span>
                              {item.lokasi && (
                                <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {item.lokasi}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════
          BERITA SEKOLAH
      ══════════════════════════════════════════════════ */}
      <section id="berita" className="py-16 md:py-24 bg-surface">
        <div className="px-4 md:px-20 max-w-screen-2xl mx-auto space-y-12">
          <div className="flex justify-between items-end border-b border-outline-variant/30 pb-6">
            <div className="space-y-2">
              <span className="text-primary font-extrabold tracking-[0.2em] text-xs uppercase">INFORMASI TERKINI</span>
              <h2 className="text-3xl font-semibold text-on-background">Berita Sekolah</h2>
            </div>
            <Link
              to="/berita"
              className="text-primary font-bold text-xs flex items-center gap-2 border-b-2 border-transparent hover:border-primary transition-all pb-1 uppercase tracking-wider group"
            >
              LIHAT SEMUA BERITA <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          {isLoadingBerita ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-sm animate-pulse">
                  <div className="h-56 bg-surface-container rounded-t-2xl" />
                  <div className="p-8 space-y-3">
                    <div className="h-3 bg-surface-container rounded w-1/2" />
                    <div className="h-5 bg-surface-container rounded" />
                    <div className="h-5 bg-surface-container rounded w-3/4" />
                    <div className="h-3 bg-surface-container rounded" />
                    <div className="h-3 bg-surface-container rounded w-5/6" />
                  </div>
                </div>
              ))}
            </div>
          ) : beritaList.length === 0 ? (
            <div className="text-center py-16 text-on-surface-variant">
              <Newspaper className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p className="font-medium">Belum ada berita yang dipublikasikan.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {beritaList.map(item => (
                <Link
                  key={item.id}
                  to={`/berita/${item.slug}`}
                  className="group bg-surface-container-lowest rounded-2xl overflow-hidden border border-outline-variant/30 shadow-sm card-hover block"
                >
                  <div className="h-56 overflow-hidden relative bg-surface-container">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.judul}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Newspaper className="w-12 h-12 text-outline" />
                      </div>
                    )}
                    <div className="absolute top-4 left-4 bg-primary text-white text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider shadow-lg">
                      BERITA
                    </div>
                  </div>
                  <div className="p-8 space-y-4">
                    <div className="text-[11px] text-primary font-bold flex items-center gap-2 uppercase tracking-wider">
                      <Clock className="w-3.5 h-3.5" /> {formatTanggal(item.publishedAt)}
                    </div>
                    <h3 className="text-xl font-semibold leading-tight text-on-background group-hover:text-primary transition-colors line-clamp-2">
                      {item.judul}
                    </h3>
                    {item.ringkasan && (
                      <p className="text-on-surface-variant line-clamp-3 leading-relaxed text-sm">
                        {item.ringkasan}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
