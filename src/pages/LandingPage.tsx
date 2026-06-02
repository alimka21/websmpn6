import React, { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import {
  GraduationCap, ArrowRight, FileText, CalendarCheck, ClipboardList,
  Newspaper, ShieldCheck, Users, Briefcase, BookOpen,
  Target, Compass, Lightbulb, Quote, User as UserIcon,
} from 'lucide-react';
import SiteFooter from '../components/SiteFooter';

// Whitelist nama ikon Lucide yg boleh dipilih admin untuk fitur unggulan
const FITUR_ICON_MAP: Record<string, React.ElementType> = {
  FileText, CalendarCheck, GraduationCap, ClipboardList, Newspaper,
  ShieldCheck, Users, BookOpen, Briefcase, Target, Compass, Lightbulb,
};
import api from '../lib/api';
import { useSiteConfig } from '../hooks/useSiteConfig';

// Fallback config — dipakai kalau admin belum atur SiteSettings
const DEFAULT_CONFIG = {
  namaSekolah: 'Portal Sekolah',
  jenjang: '',
  tagline: 'Pusat pendidikan terdepan yang mendidik generasi berprestasi.',
  deskripsi: 'Sistem manajemen sekolah terpadu — ujian online, presensi digital, tracer alumni, dan portal informasi dalam satu platform.',
  logoUrl: '',
  faviconUrl: '',
  heroImageUrl: '',
  profilImageUrl: '',
  statSiswaValue: '1,250+',
  statSiswaLabel: 'Siswa Aktif',
  statGuruValue: '85+',
  statGuruLabel: 'Tenaga Pendidik',
  statTahunValue: '2005',
  statTahunLabel: 'Berdiri Sejak',
  statAlumniLabel: 'Alumni Terdata',
  sejarah: '',
  visi: '',
  misi: '',
  tujuan: '',
  kepsekNama: '',
  kepsekJabatan: 'Kepala Sekolah',
  kepsekFotoUrl: '',
  kepsekSambutan: '',
  fiturUnggulan: '',
  alamat: '',
  telepon: '',
  email: '',
  whatsapp: '',
  facebook: '', instagram: '', twitter: '', youtube: '', tiktok: '',
};

type SiteConfig = typeof DEFAULT_CONFIG;

interface FiturItem { icon: string; title: string; desc: string }

const DEFAULT_FITUR: FiturItem[] = [
  { icon: 'FileText', title: 'Ujian Online',
    desc: 'Bank soal lengkap dengan timer otomatis, anti-cheat, dan koreksi instan. Hasil & rekap nilai langsung tersedia.' },
  { icon: 'CalendarCheck', title: 'Presensi Digital',
    desc: 'Catat kehadiran siswa per sesi pelajaran. Setiap guru punya rekap presensi sendiri, export Excel.' },
  { icon: 'GraduationCap', title: 'Tracer Alumni',
    desc: 'Lulusan bisa daftar mandiri. Lihat sebaran karir & pendidikan alumni lewat statistik publik.' },
];

// (HERO_FEATURES dihapus — hero sekarang pakai image + floating card, bukan icon grid)

export default function LandingPage() {
  const navigate = useNavigate();
  const [berita, setBerita] = useState<any[]>([]);
  const [alumniStats, setAlumniStats] = useState<Record<string, number>>({});
  const [totalSiswa, setTotalSiswa] = useState<number | null>(null);
  // Site config via shared hook (dedupe — semua komponen share 1 fetch)
  const siteConfig = useSiteConfig();

  const cfg = useMemo<SiteConfig>(() => {
    const merged: any = { ...DEFAULT_CONFIG };
    for (const key of Object.keys(DEFAULT_CONFIG) as (keyof SiteConfig)[]) {
      const v = (siteConfig as any)[key];
      if (v != null && String(v).trim() !== '') merged[key] = v;
    }
    return merged;
  }, [siteConfig]);

  // Loading flags — track per-fetch supaya bisa render placeholder spesifik
  // dan hindari layout shift (CLS) saat konten muncul mendadak.
  const [isLoadingBerita, setIsLoadingBerita] = useState(true);
  const [isLoadingAlumni, setIsLoadingAlumni] = useState(true);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  // siteConfig hook tidak expose isLoaded flag — derive dari presence
  // namaSekolah (selalu ada di config valid, undefined saat init kosong).
  const isCfgLoaded = !!(siteConfig as any).namaSekolah;

  useEffect(() => {
    Promise.all([
      api.get('/api/berita?limit=3').catch(() => ({ data: [] })),
      api.get('/api/alumni/stats').catch(() => ({ perStatus: {} })),
      api.get('/api/stats').catch(() => ({ totalSiswa: null })),
    ]).then(([resBerita, resAlumni, resStats]) => {
      setBerita(resBerita.data || []);
      setIsLoadingBerita(false);
      setAlumniStats(resAlumni.perStatus || {});
      setIsLoadingAlumni(false);
      setTotalSiswa(resStats.totalSiswa ?? null);
      setIsLoadingStats(false);
    });
  }, []);

  // Auto-refresh stats saat user kembali ke tab. Cache server tetap berlaku.
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') {
        api.get('/api/alumni/stats')
          .then((r: any) => setAlumniStats(r?.perStatus || {}))
          .catch(() => { /* abaikan */ });
        api.get('/api/stats')
          .then((r: any) => setTotalSiswa(r?.totalSiswa ?? null))
          .catch(() => { /* abaikan */ });
      }
    };
    document.addEventListener('visibilitychange', refresh);
    return () => document.removeEventListener('visibilitychange', refresh);
  }, []);

  // Document title + favicon
  useEffect(() => {
    document.title = cfg.namaSekolah;
    if (cfg.faviconUrl) {
      let link = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = cfg.faviconUrl;
    }
  }, [cfg.namaSekolah, cfg.faviconUrl]);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  // Parse fitur unggulan JSON dari config; fallback ke default kalau invalid/kosong
  const fiturList: FiturItem[] = useMemo(() => {
    if (!cfg.fiturUnggulan?.trim()) return DEFAULT_FITUR;
    try {
      const parsed = JSON.parse(cfg.fiturUnggulan);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
          .filter((it: any) => it && typeof it === 'object' && it.title)
          .map((it: any) => ({
            icon: typeof it.icon === 'string' ? it.icon : 'FileText',
            title: String(it.title),
            desc: String(it.desc || ''),
          }));
      }
    } catch { /* fallback */ }
    return DEFAULT_FITUR;
  }, [cfg.fiturUnggulan]);

  // Parse misi (satu poin per baris) untuk profil sekolah
  const misiList = (cfg.misi || '').split('\n').map(s => s.trim()).filter(Boolean);
  const showProfil = !!(cfg.sejarah?.trim() || cfg.visi?.trim() || cfg.misi?.trim() || cfg.tujuan?.trim() || cfg.profilImageUrl?.trim());
  const showSambutan = !!(cfg.kepsekSambutan?.trim() || cfg.kepsekNama?.trim() || cfg.kepsekFotoUrl?.trim());

  const totalAlumni = Object.values(alumniStats).reduce((sum, n) => sum + (n || 0), 0);
  const alumniBekerja = alumniStats.BEKERJA || 0;
  const alumniKuliah = alumniStats.KULIAH || 0;
  const alumniWirausaha = alumniStats.WIRAUSAHA || 0;

  return (
    <div className="min-h-screen bg-background text-on-background">
      {/* ═════════════════ 1. NAVBAR ═════════════════ */}
      <nav className="sticky top-0 z-40 h-16 bg-surface/95 backdrop-blur-md border-b border-outline-variant">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-full flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo(0, 0)}>
            {cfg.logoUrl ? (
              <img src={cfg.logoUrl} alt={cfg.namaSekolah} className="w-9 h-9 rounded-lg object-contain shrink-0" />
            ) : (
              <div className="w-9 h-9 rounded-lg bg-primary text-on-primary flex items-center justify-center shrink-0">
                <GraduationCap className="w-5 h-5" />
              </div>
            )}
            <div className="hidden sm:flex flex-col">
              <span className="font-bold text-lg tracking-tight text-primary leading-tight">{cfg.namaSekolah}</span>
              {cfg.jenjang && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                  Jenjang {cfg.jenjang}
                </span>
              )}
            </div>
          </div>

          <div className="hidden md:flex items-center gap-7 text-label-md font-medium text-on-surface-variant">
            <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="hover:text-primary transition-colors">Beranda</button>
            {/* Always render — opacity toggle hindari layout shift saat cfg loading */}
            <button
              onClick={() => scrollTo('profil')}
              aria-hidden={!(isCfgLoaded && showProfil)}
              tabIndex={isCfgLoaded && showProfil ? 0 : -1}
              className={`hover:text-primary transition-opacity duration-200 ${
                isCfgLoaded && showProfil ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
            >
              Profil
            </button>
            <button onClick={() => scrollTo('fitur')} className="hover:text-primary transition-colors">Fitur</button>
            <button onClick={() => scrollTo('berita')} className="hover:text-primary transition-colors">Berita</button>
            {/* ALUMNI_HIDDEN: <button onClick={() => scrollTo('alumni')} className="hover:text-primary transition-colors">Alumni</button> */}
            <button onClick={() => scrollTo('kontak')} className="hover:text-primary transition-colors">Kontak</button>
          </div>

          <Button onClick={() => navigate('/login')} size="sm" className="text-white">
            Login Portal
          </Button>
        </div>
      </nav>

      {/* ═════════════════ 2. HERO ═════════════════ */}
      <section className="relative bg-primary text-on-primary px-4 sm:px-6 py-20 sm:py-28 overflow-hidden">
        {/* Soft glow accents */}
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-tertiary-fixed rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-primary-container rounded-full blur-3xl" />
        </div>
        <div className="max-w-7xl mx-auto relative z-10 grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-7">
            <span className="inline-flex items-center gap-2 rounded-full bg-on-primary/10 border border-on-primary/15 px-3 py-1 text-label-sm font-bold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-tertiary-fixed animate-pulse" />
              {cfg.namaSekolah}
            </span>
            <h1 className="text-headline-lg leading-tight">
              Portal Akademik <br className="hidden sm:block" />
              <span className="text-white">Digital</span>
            </h1>
            <p className="text-lg text-on-primary/85 max-w-lg leading-relaxed">
              {cfg.deskripsi}
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                onClick={() => navigate('/login')}
                className="inline-flex items-center gap-2 rounded-full bg-on-primary text-primary px-7 py-3 font-bold uppercase tracking-wider text-label-md hover:bg-on-primary/90 active:translate-y-px transition-all shadow-sm"
              >
                Login Portal <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => scrollTo('fitur')}
                className="inline-flex items-center gap-2 rounded-full border border-on-primary/30 text-on-primary px-7 py-3 font-bold uppercase tracking-wider text-label-md hover:bg-on-primary/10 transition-all"
              >
                Lihat Fitur
              </button>
            </div>
          </div>

          {/* Image besar + floating "Ujian Online" card */}
          <div className="relative group">
            <div className="absolute -inset-4 bg-gradient-to-tr from-tertiary-fixed/20 to-transparent rounded-[2rem] blur-2xl group-hover:blur-3xl transition-all" />
            <div className="relative aspect-[4/3] rounded-[2rem] overflow-hidden border-4 border-on-primary/10 shadow-2xl bg-on-primary/5">
              {cfg.heroImageUrl ? (
                <img
                  src={cfg.heroImageUrl}
                  alt={cfg.namaSekolah}
                  className="w-full h-full object-cover"
                />
              ) : cfg.profilImageUrl ? (
                <img
                  src={cfg.profilImageUrl}
                  alt={cfg.namaSekolah}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <GraduationCap className="w-32 h-32 text-on-primary/30" />
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ═════════════════ 2.5 SAMBUTAN KEPALA SEKOLAH ═════════════════ */}
      {/* Placeholder min-h saat cfg loading — hindari shift kalau section muncul.
          Setelah cfg loaded: render section asli kalau ada konten, null kalau kosong. */}
      {!isCfgLoaded ? (
        <div className="bg-surface min-h-[500px]" aria-hidden="true" />
      ) : showSambutan && (
        <section id="sambutan" className="bg-surface px-4 sm:px-6 py-20">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <p className="text-label-sm text-on-surface-variant uppercase tracking-wider font-bold mb-2">Sambutan</p>
              <h2 className="text-headline-md text-on-surface">Kata Sambutan {cfg.kepsekJabatan || 'Kepala Sekolah'}</h2>
            </div>
            {/* Card besar dgn quote icon di sudut atas-kanan + foto miring kiri */}
            <div className="relative flex flex-col md:flex-row items-center gap-12 bg-surface-container-lowest p-8 md:p-12 rounded-3xl border border-outline-variant shadow-sm">
              <Quote className="absolute top-8 right-8 w-24 h-24 text-primary/10 pointer-events-none" />
              <div className="w-64 flex-shrink-0 text-center relative z-10">
                {cfg.kepsekFotoUrl ? (
                  <img
                    src={cfg.kepsekFotoUrl}
                    alt={cfg.kepsekNama || 'Kepala Sekolah'}
                    className="w-56 h-72 mx-auto mb-6 rounded-2xl object-cover border-8 border-surface-container-lowest shadow-lg rotate-[-2deg] transition-transform hover:rotate-0"
                  />
                ) : (
                  <div className="w-56 h-72 mx-auto mb-6 rounded-2xl bg-surface-container border border-outline-variant flex items-center justify-center rotate-[-2deg] transition-transform hover:rotate-0">
                    <UserIcon className="w-20 h-20 text-outline-variant" />
                  </div>
                )}
                {cfg.kepsekNama && <h3 className="text-headline-sm text-primary">{cfg.kepsekNama}</h3>}
                <p className="text-on-surface-variant text-sm font-medium">{cfg.kepsekJabatan || 'Kepala Sekolah'}</p>
              </div>
              <div className="flex-1 relative z-10">
                <p className="text-on-surface-variant leading-relaxed italic text-base sm:text-lg whitespace-pre-wrap">
                  {cfg.kepsekSambutan || 'Selamat datang di portal sekolah kami.'}
                </p>
                <div className="mt-8 flex gap-2">
                  <span className="w-12 h-1 bg-primary rounded-full" />
                  <span className="w-4 h-1 bg-tertiary-fixed rounded-full" />
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ═════════════════ 2.6 PROFIL SEKOLAH (Sejarah + Visi/Misi/Tujuan) ═════════════════ */}
      {!isCfgLoaded ? (
        <div className="bg-surface-container-low border-y border-outline-variant min-h-[700px]" aria-hidden="true" />
      ) : showProfil && (
        <section id="profil" className="bg-surface-container-low border-y border-outline-variant px-4 sm:px-6 py-20">
          <div className="max-w-7xl mx-auto space-y-12">
            <div className="text-center max-w-2xl mx-auto">
              <p className="text-label-sm text-on-surface-variant uppercase tracking-wider font-bold mb-2">Tentang Kami</p>
              <h2 className="text-headline-md text-on-surface">Profil Sekolah</h2>
            </div>

            {(cfg.sejarah?.trim() || cfg.profilImageUrl?.trim()) && (
              <div className="grid md:grid-cols-2 gap-10 items-center">
                {/* Aspect-ratio container — reserve height sebelum image load,
                    hindari CLS dari h-auto yg bergantung natural size image */}
                <div className="w-full aspect-[4/3] rounded-2xl overflow-hidden border border-outline-variant shadow-sm bg-surface-container">
                  {cfg.profilImageUrl ? (
                    <img
                      src={cfg.profilImageUrl}
                      alt={`Profil ${cfg.namaSekolah}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <BookOpen className="w-16 h-16 text-outline-variant" />
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="text-headline-sm text-on-surface mb-3">Sejarah Singkat</h3>
                  <p className="text-on-surface-variant leading-relaxed whitespace-pre-wrap">
                    {cfg.sejarah || 'Belum ada cerita sejarah.'}
                  </p>
                </div>
              </div>
            )}

            {(cfg.visi?.trim() || cfg.misi?.trim() || cfg.tujuan?.trim()) && (
              <div className="grid lg:grid-cols-3 gap-4">
                {cfg.visi?.trim() && (
                  <div className="group bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 hover:border-primary transition-colors">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary-container/15 text-primary group-hover:bg-primary group-hover:text-on-primary flex items-center justify-center shrink-0 transition-all">
                        <Target className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-primary mb-1">Visi</h4>
                        <p className="text-label-sm text-on-surface-variant leading-relaxed whitespace-pre-wrap">{cfg.visi}</p>
                      </div>
                    </div>
                  </div>
                )}
                {misiList.length > 0 && (
                  <div className="group bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 hover:border-primary transition-colors">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary-container/15 text-primary group-hover:bg-primary group-hover:text-on-primary flex items-center justify-center shrink-0 transition-all">
                        <Compass className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-primary mb-1">Misi</h4>
                        <ol className="list-decimal list-inside space-y-1 text-label-sm text-on-surface-variant leading-relaxed">
                          {misiList.map((m, i) => <li key={i}>{m}</li>)}
                        </ol>
                      </div>
                    </div>
                  </div>
                )}
                {cfg.tujuan?.trim() && (
                  <div className="group bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 hover:border-primary transition-colors">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary-container/15 text-primary group-hover:bg-primary group-hover:text-on-primary flex items-center justify-center shrink-0 transition-all">
                        <Lightbulb className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-primary mb-1">Tujuan</h4>
                        <p className="text-label-sm text-on-surface-variant leading-relaxed whitespace-pre-wrap">{cfg.tujuan}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ═════════════════ 3. STATISTIK (banner di bg-primary) ═════════════════ */}
      <section id="statistik" className="bg-primary text-on-primary px-4 sm:px-6 py-16">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { icon: Users,         label: cfg.statSiswaLabel  || 'Siswa Aktif',     value: isLoadingStats ? '—' : (totalSiswa !== null && totalSiswa > 0 ? `${totalSiswa}+` : (cfg.statSiswaValue || '—')) },
              { icon: GraduationCap, label: cfg.statGuruLabel   || 'Tenaga Pendidik', value: cfg.statGuruValue  || '—' },
              // ALUMNI_HIDDEN: { icon: BookOpen, label: cfg.statAlumniLabel || 'Alumni Terdata', value: isLoadingAlumni ? '—' : (totalAlumni > 0 ? `${totalAlumni}+` : '—') },
              { icon: Briefcase,     label: cfg.statTahunLabel  || 'Berdiri Sejak',   value: cfg.statTahunValue || '—' },
            ].map(({ icon: Icon, label, value }, i) => (
              <div key={i} className="space-y-2">
                <Icon className="w-9 h-9 mx-auto text-tertiary-fixed" />
                <div className="text-4xl md:text-5xl font-extrabold tracking-tight">{value}</div>
                <div className="text-label-md uppercase tracking-wider text-on-primary/80 font-bold">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═════════════════ 4. FITUR UNGGULAN ═════════════════ */}
      <section id="fitur" className="bg-surface px-4 sm:px-6 py-20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12 max-w-2xl mx-auto space-y-3">
            <p className="text-label-sm text-on-surface-variant uppercase tracking-wider font-bold">Yang Kami Tawarkan</p>
            <h2 className="text-headline-md text-on-surface">Fitur Unggulan</h2>
            <p className="text-on-surface-variant">Solusi digital terintegrasi untuk seluruh aktivitas akademik sekolah.</p>
          </div>
          <div className={`grid gap-6 ${fiturList.length === 1 ? 'md:grid-cols-1 max-w-xl mx-auto' : fiturList.length === 2 ? 'md:grid-cols-2 max-w-3xl mx-auto' : 'md:grid-cols-3'}`}>
            {fiturList.map((f, i) => {
              const Icon = FITUR_ICON_MAP[f.icon] || FileText;
              return (
                <div
                  key={i}
                  className="group bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 hover:border-primary hover:shadow-lg transition-all"
                >
                  <div className="w-16 h-16 rounded-2xl bg-primary-container/15 text-primary flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <Icon className="w-7 h-7" />
                  </div>
                  <h3 className="font-bold text-primary text-lg mb-2">{f.title}</h3>
                  <p className="text-on-surface-variant text-sm leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═════════════════ 5. BERITA TERBARU ═════════════════ */}
      <section id="berita" className="bg-surface-container-low border-y border-outline-variant px-4 sm:px-6 py-20">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
            <div>
              <p className="text-label-sm text-on-surface-variant uppercase tracking-wider font-bold mb-2">Informasi Terkini</p>
              <h2 className="text-headline-md text-on-surface">Berita Sekolah</h2>
            </div>
            <Link to="/berita" className="text-primary font-bold inline-flex items-center gap-1.5 hover:underline text-label-md uppercase tracking-wider">
              Lihat Semua <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {isLoadingBerita ? (
              // Skeleton 3 card — ukuran match card berita asli (aspect-video img + 5p header/title/excerpt)
              Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={`skel-${i}`}
                  className="flex flex-col bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden"
                  aria-hidden="true"
                >
                  <div className="aspect-video bg-surface-container animate-pulse" />
                  <div className="p-5 flex flex-col flex-1 space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-14 bg-surface-container animate-pulse rounded" />
                      <div className="h-4 w-20 bg-surface-container animate-pulse rounded" />
                    </div>
                    <div className="h-5 bg-surface-container animate-pulse rounded w-3/4" />
                    <div className="h-4 bg-surface-container animate-pulse rounded w-full" />
                    <div className="h-4 bg-surface-container animate-pulse rounded w-5/6" />
                  </div>
                </div>
              ))
            ) : berita.length === 0 ? (
              <div className="md:col-span-3 py-16 text-center text-on-surface-variant border-2 border-dashed border-outline-variant rounded-xl bg-surface-container-lowest">
                <Newspaper className="w-10 h-10 mx-auto text-outline-variant mb-2" />
                Belum ada berita yang dipublikasikan.
              </div>
            ) : berita.map((b: any) => (
              <Link
                to={`/berita/${b.slug}`}
                key={b.id}
                className="group flex flex-col bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all"
              >
                <div className="aspect-video bg-surface-container overflow-hidden">
                  {b.imageUrl ? (
                    <img
                      src={b.imageUrl}
                      alt={b.judul}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-outline-variant">
                      <Newspaper className="w-12 h-12" />
                    </div>
                  )}
                </div>
                <div className="p-5 flex flex-col flex-1">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-label-sm font-bold text-primary bg-primary-container/15 px-2 py-0.5 rounded uppercase tracking-wider">
                      Berita
                    </span>
                    <span className="text-label-sm text-on-surface-variant uppercase tracking-wider">
                      {new Date(b.publishedAt ?? b.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  <h3 className="font-bold text-on-surface text-lg leading-tight mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                    {b.judul}
                  </h3>
                  {b.ringkasan && (
                    <p className="text-sm text-on-surface-variant line-clamp-2">{b.ringkasan}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ALUMNI_HIDDEN: section Tracer Alumni — aktifkan kembali saat diperlukan */}

      {/* ═════════════════ 7. FOOTER (komponen reusable) ═════════════════ */}
      <SiteFooter />
    </div>
  );
}
