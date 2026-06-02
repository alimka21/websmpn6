import { useEffect, useState } from 'react';
import api from '../lib/api';

/**
 * Tipe full SiteConfig — semua field yang dikirim dari backend.
 * Pakai Partial untuk semua, supaya komponen tidak crash kalau field
 * baru belum ditambah di DB (rolling deploy).
 */
export interface SiteConfig {
  namaSekolah?: string;
  jenjang?: 'SD' | 'SMP' | 'SMA' | 'SMK' | null;
  tagline?: string;
  deskripsi?: string;
  logoUrl?: string;
  faviconUrl?: string;
  heroImageUrl?: string;
  heroBadge?: string;
  heroTitle?: string;
  heroSubtitle?: string;
  profilImageUrl?: string;
  sejarah?: string;
  visi?: string;
  misi?: string;
  tujuan?: string;
  kepsekNama?: string;
  kepsekJabatan?: string;
  kepsekFotoUrl?: string;
  kepsekSambutan?: string;
  fiturUnggulan?: string;
  alamat?: string;
  telepon?: string;
  email?: string;
  whatsapp?: string;
  mapsEmbedUrl?: string;
  facebook?: string;
  instagram?: string;
  twitter?: string;
  youtube?: string;
  tiktok?: string;
  [key: string]: any;
}

// Singleton — semua komponen share 1 cache + 1 in-flight promise.
// Dipakai useSiteConfig hook + getSiteConfig() function call.
let cached: SiteConfig | null = null;
let inflight: Promise<SiteConfig> | null = null;
// Listeners untuk re-render saat cache di-invalidate / refresh
const listeners = new Set<(cfg: SiteConfig) => void>();

function notify(cfg: SiteConfig) {
  for (const l of listeners) l(cfg);
}

/**
 * Fetch site config (dedupe). Aman dipanggil dari banyak tempat —
 * request hanya 1× per session sampai invalidate.
 */
export async function getSiteConfig(): Promise<SiteConfig> {
  if (cached) return cached;
  if (inflight) return inflight;
  inflight = api.get('/api/site-config').then(
    (cfg) => { cached = cfg; inflight = null; notify(cfg); return cfg; },
    () => { cached = {}; inflight = null; notify(cached!); return cached!; },
  );
  return inflight;
}

/**
 * Clear cache. Dipanggil setelah admin save SiteSettings supaya
 * komponen lain dapat data fresh tanpa reload page.
 */
export function invalidateSiteConfig(): void {
  cached = null;
  inflight = null;
  getSiteConfig(); // refetch + notify listeners
}

/**
 * Hook React — auto re-render saat cache update.
 */
export function useSiteConfig() {
  const [config, setConfig] = useState<SiteConfig>(cached ?? {});

  useEffect(() => {
    let mounted = true;
    getSiteConfig().then((cfg) => {
      if (mounted) setConfig(cfg);
    });
    const listener = (cfg: SiteConfig) => {
      if (mounted) setConfig(cfg);
    };
    listeners.add(listener);
    return () => { mounted = false; listeners.delete(listener); };
  }, []);

  return config;
}

/**
 * List tingkat yang valid berdasarkan jenjang.
 * - SD: 1-6
 * - SMP: 7-9
 * - SMA / SMK: 10-12
 * - undefined / lain: 1-12 (semua)
 */
export function tingkatOptions(jenjang?: string | null): number[] {
  if (jenjang === 'SD') return [1, 2, 3, 4, 5, 6];
  if (jenjang === 'SMP') return [7, 8, 9];
  if (jenjang === 'SMA' || jenjang === 'SMK') return [10, 11, 12];
  return Array.from({ length: 12 }, (_, i) => i + 1);
}

/** Jumlah opsi default pada soal pilihan ganda berdasarkan jenjang */
export function defaultPgOpsiCount(jenjang?: string | null): 4 | 5 {
  return jenjang === 'SMA' || jenjang === 'SMK' ? 5 : 4;
}
