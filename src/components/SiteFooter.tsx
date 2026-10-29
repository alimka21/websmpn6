import React from 'react';
import { Link } from 'react-router-dom';
import {
  GraduationCap, Facebook, Instagram, Twitter, Youtube, Music2,
  MapPin, Mail, Phone, Globe,
} from 'lucide-react';
import { useSiteConfig } from '../hooks/useSiteConfig';

const QUICK_LINKS = [
  { to: '/berita',                     label: 'Berita' },
  { to: '/dokumen',                    label: 'Dokumen' },
  { to: '/dashboard-publik/kehadiran', label: 'Kehadiran' },
  { to: '/dashboard-publik/tugas',     label: 'Tugas & Nilai' },
  { to: '/login',                      label: 'Login Portal' },
];

const DEFAULT_TAGLINE = 'Pusat pendidikan terdepan yang mendidik generasi berprestasi.';

export default function SiteFooter() {
  const rawCfg = useSiteConfig();
  const cfg = { tagline: DEFAULT_TAGLINE, ...rawCfg };
  const namaSekolah = cfg.namaSekolah || 'Portal Sekolah';

  const socials = [
    { url: cfg.facebook,  label: 'Facebook',    Icon: Facebook },
    { url: cfg.instagram, label: 'Instagram',   Icon: Instagram },
    { url: cfg.twitter,   label: 'Twitter / X', Icon: Twitter },
    { url: cfg.youtube,   label: 'YouTube',     Icon: Youtube },
    { url: cfg.tiktok,    label: 'TikTok',      Icon: Music2 },
  ].filter(s => s.url && s.url.trim() !== '');

  return (
    <footer id="kontak" className="bg-inverse-surface text-inverse-on-surface">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-10 px-4 md:px-8 lg:px-20 py-16 md:py-20 max-w-screen-2xl mx-auto">

        {/* Kolom 1: Brand */}
        <div className="space-y-6 lg:col-span-4">
          <div className="flex items-center gap-2.5">
            {cfg.logoUrl ? (
              <img src={cfg.logoUrl} alt={namaSekolah} className="w-9 h-9 rounded-lg object-contain bg-inverse-on-surface/10 p-1" />
            ) : (
              <div className="w-9 h-9 rounded-lg bg-inverse-on-surface/10 flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-primary-fixed" />
              </div>
            )}
            <div className="flex flex-col">
              <span className="font-bold text-lg leading-tight text-white">{namaSekolah}</span>
              {cfg.jenjang && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-inverse-on-surface/70">
                  Jenjang {cfg.jenjang}
                </span>
              )}
            </div>
          </div>

          {cfg.tagline && (
            <p className="text-sm text-inverse-on-surface/70 leading-relaxed">{cfg.tagline}</p>
          )}

          {socials.length > 0 && (
            <div className="flex gap-3 flex-wrap">
              {socials.map(({ url, label, Icon }) => (
                <a
                  key={label}
                  href={url ?? '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  title={label}
                  className="w-10 h-10 rounded-xl bg-inverse-on-surface/10 border border-inverse-on-surface/10 flex items-center justify-center hover:bg-primary hover:border-primary transition-colors"
                >
                  <Icon className="w-4 h-4" />
                </a>
              ))}
              {cfg.email && (
                <a
                  href={`mailto:${cfg.email}`}
                  aria-label="Email"
                  className="w-10 h-10 rounded-xl bg-inverse-on-surface/10 border border-inverse-on-surface/10 flex items-center justify-center hover:bg-primary hover:border-primary transition-colors"
                >
                  <Mail className="w-4 h-4" />
                </a>
              )}
            </div>
          )}
        </div>

        {/* Kolom 2: Tautan Cepat */}
        <div className="space-y-6 lg:col-span-2">
          <h4 className="text-sm font-bold uppercase tracking-wider text-white">Tautan Cepat</h4>
          <ul className="space-y-3 text-sm text-inverse-on-surface/70">
            {QUICK_LINKS.map(l => (
              <li key={l.to}>
                <Link to={l.to} className="hover:text-white transition-colors">{l.label}</Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Kolom 3: Hubungi Kami */}
        <div className="space-y-6 lg:col-span-3">
          <h4 className="text-sm font-bold uppercase tracking-wider text-white">Hubungi Kami</h4>
          <div className="space-y-5 text-sm text-inverse-on-surface/80">
            {cfg.alamat && (
              <div className="flex items-start gap-4">
                <MapPin className="w-4 h-4 text-primary-fixed-dim shrink-0 mt-0.5" />
                <span className="leading-relaxed whitespace-pre-wrap">{cfg.alamat}</span>
              </div>
            )}
            {cfg.telepon && (
              <div className="flex items-center gap-4">
                <Phone className="w-4 h-4 text-primary-fixed-dim shrink-0" />
                <a href={`tel:${cfg.telepon.replace(/[^\d+]/g, '')}`} className="hover:text-white transition-colors">
                  {cfg.telepon}
                </a>
              </div>
            )}
            {cfg.email && (
              <div className="flex items-center gap-4">
                <Mail className="w-4 h-4 text-primary-fixed-dim shrink-0" />
                <a href={`mailto:${cfg.email}`} className="hover:text-white transition-colors break-all">
                  {cfg.email}
                </a>
              </div>
            )}
            {cfg.whatsapp && (
              <div className="flex items-center gap-4">
                <Phone className="w-4 h-4 text-primary-fixed-dim shrink-0" />
                <a
                  href={`https://wa.me/${cfg.whatsapp.replace(/[^\d]/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  WhatsApp: {cfg.whatsapp}
                </a>
              </div>
            )}
            {!cfg.alamat && !cfg.telepon && !cfg.email && !cfg.whatsapp && (
              <p className="text-inverse-on-surface/40 italic">Belum ada informasi kontak.</p>
            )}
          </div>
        </div>

        {/* Kolom 4: Lokasi */}
        <div className="space-y-6 lg:col-span-3">
          <h4 className="text-sm font-bold uppercase tracking-wider text-white">Lokasi</h4>
          {cfg.mapsEmbedUrl ? (
            <div className="rounded-2xl overflow-hidden border border-inverse-on-surface/15 shadow-2xl h-48">
              <iframe
                src={cfg.mapsEmbedUrl}
                className="w-full h-full"
                style={{ border: 0 }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title={`Lokasi ${namaSekolah}`}
              />
            </div>
          ) : (
            <div className="rounded-2xl border border-inverse-on-surface/15 h-48 flex items-center justify-center bg-inverse-on-surface/5">
              <div className="text-center text-inverse-on-surface/30 space-y-2">
                <MapPin className="w-8 h-8 mx-auto" />
                <p className="text-xs">Peta belum dikonfigurasi</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="px-4 md:px-8 lg:px-20 max-w-screen-2xl mx-auto py-8 border-t border-inverse-on-surface/10">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-inverse-on-surface/60">
            &copy; {new Date().getFullYear()} {namaSekolah}. Semua hak dilindungi.
          </p>
          <div className="flex gap-8">
            <a href="#" className="text-sm text-inverse-on-surface/60 hover:text-white transition-colors">
              Kebijakan Privasi
            </a>
            <a href="#" className="text-sm text-inverse-on-surface/60 hover:text-white transition-colors">
              Syarat &amp; Ketentuan
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
