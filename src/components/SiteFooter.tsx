import React from 'react';
import { Link } from 'react-router-dom';
import {
  GraduationCap, Facebook, Instagram, Twitter, Youtube, Music2,
  MapPin, Mail, Phone,
} from 'lucide-react';
import { useSiteConfig } from '../hooks/useSiteConfig';

const DEFAULT_TAGLINE = 'Pusat pendidikan terdepan yang mendidik generasi berprestasi.';

export default function SiteFooter() {
  const rawCfg = useSiteConfig();
  // Apply default kalau tagline kosong supaya footer tidak terlihat janggal.
  const cfg = { tagline: DEFAULT_TAGLINE, ...rawCfg };

  const socials = [
    { url: cfg.facebook,  label: 'Facebook',  Icon: Facebook },
    { url: cfg.instagram, label: 'Instagram', Icon: Instagram },
    { url: cfg.twitter,   label: 'Twitter / X', Icon: Twitter },
    { url: cfg.youtube,   label: 'YouTube',   Icon: Youtube },
    { url: cfg.tiktok,    label: 'TikTok',    Icon: Music2 },
  ].filter(s => s.url && s.url.trim() !== '');

  const namaSekolah = cfg.namaSekolah || 'Portal Sekolah';

  return (
    <footer id="kontak" className="bg-inverse-surface text-inverse-on-surface px-4 sm:px-6 py-14">
      <div className="max-w-7xl mx-auto grid md:grid-cols-4 gap-10">
        {/* Brand */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            {cfg.logoUrl ? (
              <img src={cfg.logoUrl} alt={namaSekolah} className="w-9 h-9 rounded-lg object-contain bg-inverse-on-surface p-1" />
            ) : (
              <div className="w-9 h-9 rounded-lg bg-inverse-primary text-primary flex items-center justify-center">
                <GraduationCap className="w-5 h-5" />
              </div>
            )}
            <div className="flex flex-col">
              <span className="font-bold text-lg leading-tight">{namaSekolah}</span>
              {cfg.jenjang && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-inverse-on-surface/70">
                  Jenjang {cfg.jenjang}
                </span>
              )}
            </div>
          </div>
          {cfg.tagline && <p className="text-sm text-inverse-on-surface/75 leading-relaxed">{cfg.tagline}</p>}
        </div>

        {/* Tautan cepat */}
        <div>
          <h4 className="text-label-sm uppercase tracking-wider font-bold mb-4">Tautan Cepat</h4>
          <ul className="space-y-2 text-sm">
            <li><Link to="/" className="hover:text-inverse-primary transition-colors">Beranda</Link></li>
            <li><Link to="/berita" className="hover:text-inverse-primary transition-colors">Berita</Link></li>
            {/* ALUMNI_HIDDEN: <li><Link to="/alumni/daftar" className="hover:text-inverse-primary transition-colors">Daftar Alumni</Link></li> */}
            <li><Link to="/login" className="hover:text-inverse-primary transition-colors">Login Portal</Link></li>
          </ul>
        </div>

        {/* Kontak (kolom 3) */}
        <div>
          <h4 className="text-label-sm uppercase tracking-wider font-bold mb-4">Hubungi Kami</h4>
          <ul className="space-y-2.5 text-sm text-inverse-on-surface/85">
            {cfg.alamat && (
              <li className="flex items-start gap-2">
                <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                <span className="whitespace-pre-wrap">{cfg.alamat}</span>
              </li>
            )}
            {cfg.email && (
              <li className="flex items-center gap-2">
                <Mail className="w-4 h-4 shrink-0" />
                <a href={`mailto:${cfg.email}`} className="hover:text-inverse-primary transition-colors break-all">{cfg.email}</a>
              </li>
            )}
            {cfg.telepon && (
              <li className="flex items-center gap-2">
                <Phone className="w-4 h-4 shrink-0" />
                <a href={`tel:${cfg.telepon.replace(/[^\d+]/g, '')}`} className="hover:text-inverse-primary transition-colors">{cfg.telepon}</a>
              </li>
            )}
            {cfg.whatsapp && (
              <li className="flex items-center gap-2">
                <Phone className="w-4 h-4 shrink-0" />
                <a
                  href={`https://wa.me/${cfg.whatsapp.replace(/[^\d]/g, '')}`}
                  target="_blank" rel="noopener noreferrer"
                  className="hover:text-inverse-primary transition-colors"
                >
                  WhatsApp: {cfg.whatsapp}
                </a>
              </li>
            )}
          </ul>
        </div>

        {/* Peta lokasi (kolom 4) — hanya muncul kalau admin sudah set mapsEmbedUrl */}
        {cfg.mapsEmbedUrl && (
          <div>
            <h4 className="text-label-sm uppercase tracking-wider font-bold mb-4">Lokasi Kami</h4>
            <div className="rounded-lg overflow-hidden border border-inverse-on-surface/15">
              <iframe
                src={cfg.mapsEmbedUrl}
                className="w-full h-48"
                style={{ border: 0 }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title={`Lokasi ${namaSekolah}`}
              />
            </div>
          </div>
        )}
      </div>

      <div className="max-w-7xl mx-auto mt-12 pt-6 border-t border-inverse-on-surface/10 flex flex-col sm:flex-row justify-between items-center gap-4">
        <p className="text-sm text-inverse-on-surface/70">
          &copy; {new Date().getFullYear()} {namaSekolah}. Semua hak dilindungi.
        </p>
        {socials.length > 0 && (
          <div className="flex gap-3">
            {socials.map(({ url, label, Icon }) => (
              <a
                key={label}
                href={url ?? '#'}
                target="_blank" rel="noopener noreferrer"
                className="w-9 h-9 rounded-full bg-inverse-on-surface/10 hover:bg-inverse-primary hover:text-primary text-inverse-on-surface flex items-center justify-center transition-colors"
                aria-label={label}
                title={label}
              >
                <Icon className="w-4 h-4" />
              </a>
            ))}
          </div>
        )}
      </div>
    </footer>
  );
}
