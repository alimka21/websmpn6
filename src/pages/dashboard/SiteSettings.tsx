import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Save, ImageIcon, Building2, BookOpen, Phone, Share2,
  AlertTriangle, Upload, X, ImagePlus, UserSquare, Sparkles, Plus, Trash2, MapPin, BarChart3,
} from 'lucide-react';

// Whitelist ikon Lucide untuk fitur unggulan — harus sinkron dgn FITUR_ICON_MAP di LandingPage.tsx
const FITUR_ICON_KEYS = [
  'FileText', 'CalendarCheck', 'GraduationCap', 'ClipboardList', 'Newspaper',
  'ShieldCheck', 'Users', 'BookOpen', 'Briefcase', 'Target', 'Compass', 'Lightbulb',
];

interface FiturItem { icon: string; title: string; desc: string }
import { Button } from '../../components/ui/button';
import { Input, Label } from '../../components/ui/input';
import api from '../../lib/api';
import { invalidateSiteConfig } from '../../hooks/useSiteConfig';
import { fileToResizedBase64, dataUrlSizeKB } from '../../lib/imageUtils';

type Config = Record<string, string | null>;

const Spinner = () => (
  <div className="w-4 h-4 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin inline-block mr-2" />
);

const Section = ({
  icon: Icon, title, description, children,
}: { icon: any; title: string; description: string; children: React.ReactNode }) => (
  <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
    <div className="flex items-start gap-3 mb-5">
      <div className="w-10 h-10 rounded-lg bg-primary-container/15 text-primary flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <h2 className="text-headline-sm text-on-surface">{title}</h2>
        <p className="text-sm text-on-surface-variant">{description}</p>
      </div>
    </div>
    <div className="space-y-4">{children}</div>
  </section>
);

const TextField = ({
  label, value, onChange, placeholder, type = 'text',
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) => (
  <div className="space-y-1.5">
    <Label>{label}</Label>
    <Input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
  </div>
);

const TextAreaField = ({
  label, value, onChange, placeholder, rows = 3,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) => (
  <div className="space-y-1.5">
    <Label>{label}</Label>
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="flex w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface shadow-sm transition-colors placeholder:text-on-surface-variant/70 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
    />
  </div>
);

interface ImageFieldProps {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  maxWidth?: number;
  preview?: 'wide' | 'square' | 'photo';
}

const ImageField: React.FC<ImageFieldProps> = ({ label, hint, value, onChange, maxWidth = 800, preview = 'photo' }) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File terlalu besar (maks 10MB sebelum resize)');
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await fileToResizedBase64(file, { maxWidth, maxHeight: maxWidth });
      const sizeKb = dataUrlSizeKB(dataUrl);
      onChange(dataUrl);
      toast.success(`Gambar siap (${sizeKb} KB setelah resize)`);
    } catch (err: any) {
      toast.error(err?.message || 'Gagal memproses gambar');
    } finally {
      setUploading(false);
    }
  };

  const aspectClass = preview === 'wide' ? 'aspect-[16/9]' : preview === 'square' ? 'aspect-square max-w-[128px]' : 'aspect-[4/3]';

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <p className="text-xs text-on-surface-variant">{hint}</p>
      {value ? (
        <div className="relative inline-block">
          <img src={value} alt={label} className={`rounded-lg border border-outline-variant object-cover ${aspectClass} bg-surface-container-low`} />
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-error text-on-error flex items-center justify-center shadow hover:bg-error/90"
            aria-label="Hapus gambar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={`flex flex-col items-center justify-center w-full rounded-lg border-2 border-dashed border-outline-variant bg-surface-container-low hover:bg-surface-container transition-colors ${aspectClass}`}
        >
          {uploading ? (
            <div className="w-6 h-6 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
          ) : (
            <>
              <ImagePlus className="w-6 h-6 text-on-surface-variant mb-1.5" />
              <span className="text-xs text-on-surface-variant">Klik untuk upload</span>
            </>
          )}
        </button>
      )}
      <div className="flex gap-2 mt-2">
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
          <Upload className="w-3.5 h-3.5 mr-1.5" />
          {value ? 'Ganti' : 'Pilih file'}
        </Button>
        {value && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange('')} className="text-error hover:bg-error-container">
            Hapus
          </Button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
};

export default function SiteSettings() {
  const [config, setConfig] = useState<Config | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      try {
        setIsLoading(true);
        const res = await api.get('/api/site-config');
        setConfig(res);
      } catch (e: any) {
        setErrorMsg(e.message || 'Gagal memuat konfigurasi');
        toast.error(e.message || 'Gagal memuat konfigurasi');
      } finally {
        setIsLoading(false);
      }
    };
    fetch();
  }, []);

  const set = (key: string, value: string) => setConfig(c => ({ ...c, [key]: value }));
  const get = (key: string) => (config?.[key] ?? '') as string;

  // ── Fitur Unggulan editor (JSON-encoded di SiteConfig.fiturUnggulan) ──
  const fiturList: FiturItem[] = (() => {
    const raw = get('fiturUnggulan');
    if (!raw.trim()) return [];
    try {
      const p = JSON.parse(raw);
      if (Array.isArray(p)) return p.map((it: any) => ({
        icon: it?.icon || 'FileText',
        title: it?.title || '',
        desc: it?.desc || '',
      }));
    } catch { /* ignore */ }
    return [];
  })();
  const setFitur = (items: FiturItem[]) => set('fiturUnggulan', JSON.stringify(items));
  const addFitur = () => {
    if (fiturList.length >= 6) {
      toast.error('Maksimal 6 fitur unggulan');
      return;
    }
    setFitur([...fiturList, { icon: 'FileText', title: '', desc: '' }]);
  };
  const updateFitur = (i: number, patch: Partial<FiturItem>) => {
    const next = fiturList.slice();
    next[i] = { ...next[i], ...patch };
    setFitur(next);
  };
  const removeFitur = (i: number) => setFitur(fiturList.filter((_, idx) => idx !== i));

  const handleSave = async () => {
    if (!config) return;
    try {
      setIsSaving(true);
      const payload: Record<string, any> = { ...config };
      delete payload.id;
      delete payload.updatedAt;

      // ── Workaround Hostinger anti-bot interstitial ("Just a moment...") ──
      // Trigger saat body PATCH besar (base64 image puluhan KB) atau pola
      // suspicious (Google Maps URL dgn banyak "!"). Strategi:
      //
      // 1. Pisahkan field gambar (data URL base64) ke request terpisah,
      //    satu PATCH per gambar — body per request manageable.
      // 2. Untuk field text-only PATCH pertama, encode field "risky"
      //    (mapsEmbedUrl, fiturUnggulan) jadi __b64: supaya WAF tidak
      //    deteksi pola.
      // 3. Header X-Requested-With: XMLHttpRequest sudah di-set global
      //    di api.ts — anti-bot biasanya exempt AJAX-style request.
      const HEAVY_FIELDS = ['logoUrl', 'faviconUrl', 'heroImageUrl', 'profilImageUrl', 'kepsekFotoUrl'];
      const heavy: Record<string, any> = {};
      for (const k of HEAVY_FIELDS) {
        if (payload[k] !== undefined) {
          heavy[k] = payload[k];
          delete payload[k];
        }
      }

      // Per-field __b64 encoding utk WAF-risky text fields
      const WAF_RISKY_FIELDS = ['mapsEmbedUrl', 'fiturUnggulan'];
      for (const k of WAF_RISKY_FIELDS) {
        const v = payload[k];
        if (typeof v === 'string' && v.trim() && !v.startsWith('__b64:')) {
          payload[k] = '__b64:' + btoa(unescape(encodeURIComponent(v)));
        }
      }

      // 1. Save text fields dulu (body kecil, aman lewat anti-bot)
      let res = await api.patch('/api/admin/site-config', payload);

      // 2. Save tiap image field secara sequential (bukan parallel — hindari
      //    burst pattern yg trigger anti-bot frequency check).
      for (const [field, data] of Object.entries(heavy)) {
        res = await api.patch('/api/admin/site-config', { [field]: data }, 60_000);
      }

      setConfig(res);
      // Bust shared cache supaya komponen lain (DashboardLayout sidebar,
      // SiteFooter, LandingPage, title/favicon di App) langsung pakai data baru.
      invalidateSiteConfig();
      toast.success('Konfigurasi berhasil disimpan');
    } catch (e: any) {
      toast.error(e.message || 'Gagal menyimpan konfigurasi');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-12 flex flex-col items-center">
        <div className="w-6 h-6 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-2" />
        <span className="text-sm text-on-surface-variant">Memuat...</span>
      </div>
    );
  }
  if (errorMsg) {
    return (
      <div className="py-12 flex flex-col items-center text-center">
        <AlertTriangle className="w-10 h-10 text-error mb-2" />
        <p className="text-error font-medium mb-1">Gagal memuat konfigurasi</p>
        <p className="text-sm text-on-surface-variant mb-4">{errorMsg}</p>
        <Button onClick={() => window.location.reload()}>Muat Ulang</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-headline-md text-on-surface">Pengaturan Situs</h1>
          <p className="text-on-surface-variant mt-1">Atur konten landing page yang dilihat publik.</p>
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? <><Spinner />Menyimpan...</> : <><Save className="w-4 h-4 mr-1.5" /> Simpan</>}
        </Button>
      </div>

      <Section icon={Building2} title="Identitas Sekolah" description="Nama, tagline, jenjang, dan deskripsi singkat sekolah.">
        <TextField label="Nama Sekolah" value={get('namaSekolah')} onChange={v => set('namaSekolah', v)} placeholder="Contoh: SMA Negeri 1 Demo" />
        <div className="space-y-1.5">
          <Label>Jenjang Sekolah</Label>
          <p className="text-xs text-on-surface-variant">Menentukan tingkat kelas yang valid (SD 1-6, SMP 7-9, SMA/SMK 10-12) dan jumlah opsi pilihan ganda saat membuat soal (SD/SMP 4 opsi, SMA/SMK 5 opsi).</p>
          <select
            value={get('jenjang') || ''}
            onChange={e => set('jenjang', e.target.value)}
            className="flex h-10 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface shadow-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          >
            <option value="">— Pilih jenjang —</option>
            <option value="SD">SD (Sekolah Dasar)</option>
            <option value="SMP">SMP (Sekolah Menengah Pertama)</option>
            <option value="SMA">SMA (Sekolah Menengah Atas)</option>
            <option value="SMK">SMK (Sekolah Menengah Kejuruan)</option>
          </select>
        </div>
        <TextField label="Tagline" value={get('tagline')} onChange={v => set('tagline', v)} placeholder="Slogan singkat sekolah" />
        <TextAreaField label="Deskripsi Singkat" value={get('deskripsi')} onChange={v => set('deskripsi', v)} placeholder="Penjelasan ringkas, tampil di hero subtitle dan footer" rows={3} />
      </Section>

      <Section icon={ImageIcon} title="Logo, Favicon & Hero" description="Branding di navbar, tab browser, dan gambar besar di hero landing.">
        <div className="grid sm:grid-cols-2 gap-6">
          <ImageField
            label="Logo" hint="Tampil di navbar & footer. Disarankan PNG transparan."
            value={get('logoUrl')} onChange={v => set('logoUrl', v)}
            maxWidth={256} preview="square"
          />
          <ImageField
            label="Favicon" hint="Icon kecil di tab browser. PNG square (32x32 atau 64x64)."
            value={get('faviconUrl')} onChange={v => set('faviconUrl', v)}
            maxWidth={128} preview="square"
          />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <TextField
            label="Badge Label (teks kecil berkedip di atas judul)"
            value={get('heroBadge')} onChange={v => set('heroBadge', v)}
            placeholder="Contoh: SMK NEGERI AYAMARU"
          />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <TextField
            label="Judul Utama Hero"
            value={get('heroTitle')} onChange={v => set('heroTitle', v)}
            placeholder="Portal Akademik"
          />
          <TextField
            label="Subtitle Hero (aksen warna amber)"
            value={get('heroSubtitle')} onChange={v => set('heroSubtitle', v)}
            placeholder="Digital Masa Depan"
          />
        </div>
        <ImageField
          label="Gambar Hero (Banner Atas Landing)"
          hint="Tampil besar di kanan judul hero. Rasio landscape (4:3 atau 16:9). Kalau kosong, fallback ke Foto Profil."
          value={get('heroImageUrl')} onChange={v => set('heroImageUrl', v)}
          maxWidth={1200} preview="wide"
        />
      </Section>

<Section icon={BookOpen} title="Profil Sekolah" description="Visi, misi, dan foto fasilitas sekolah.">
        <ImageField
          label="Foto Profil / Fasilitas" hint="Tampil di section Profil Sekolah pada landing."
          value={get('profilImageUrl')} onChange={v => set('profilImageUrl', v)}
          maxWidth={800} preview="photo"
        />
        <TextAreaField label="Visi" value={get('visi')} onChange={v => set('visi', v)} placeholder="Pandangan jangka panjang sekolah" rows={3} />
        <TextAreaField label="Misi" value={get('misi')} onChange={v => set('misi', v)} placeholder="Pisahkan tiap misi dengan baris baru (Enter)" rows={5} />
      </Section>

      <Section
        icon={BarChart3}
        title="Statistik Sekolah"
        description="Angka dan teks 4 kartu statistik di landing. Alumni Terdata otomatis dari data alumni (tidak perlu diisi nilai)."
      >
        <p className="text-xs text-on-surface-variant -mt-2">
          Tip: pakai format ringkas seperti <code className="bg-surface-container px-1 rounded">1,250+</code>, <code className="bg-surface-container px-1 rounded">85</code>, atau <code className="bg-surface-container px-1 rounded">2005</code>.
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          <TextField label="Siswa — Nilai" value={get('statSiswaValue')} onChange={v => set('statSiswaValue', v)} placeholder="1,250+" />
          <TextField label="Siswa — Label" value={get('statSiswaLabel')} onChange={v => set('statSiswaLabel', v)} placeholder="Siswa Aktif" />
          <TextField label="Guru — Nilai" value={get('statGuruValue')} onChange={v => set('statGuruValue', v)} placeholder="85+" />
          <TextField label="Guru — Label" value={get('statGuruLabel')} onChange={v => set('statGuruLabel', v)} placeholder="Tenaga Pendidik" />
          <TextField label="Tahun — Nilai" value={get('statTahunValue')} onChange={v => set('statTahunValue', v)} placeholder="2005" />
          <TextField label="Tahun — Label" value={get('statTahunLabel')} onChange={v => set('statTahunLabel', v)} placeholder="Berdiri Sejak" />
          <TextField label="Rombel — Nilai" value={get('statRombelValue')} onChange={v => set('statRombelValue', v)} placeholder="24" />
          <TextField label="Rombel — Label" value={get('statRombelLabel')} onChange={v => set('statRombelLabel', v)} placeholder="Rombel" />
        </div>
        <TextField
          label="Alumni — Label (nilai auto dari data alumni)"
          value={get('statAlumniLabel')}
          onChange={v => set('statAlumniLabel', v)}
          placeholder="Alumni Terdata"
        />
      </Section>

      <Section icon={UserSquare} title="Sambutan Kepala Sekolah" description="Foto, nama, dan teks sambutan yang tampil di section khusus pada landing.">
        <div className="grid sm:grid-cols-2 gap-4">
          <TextField label="Nama Kepala Sekolah" value={get('kepsekNama')} onChange={v => set('kepsekNama', v)} placeholder="Contoh: Dr. Budi Santoso, M.Pd." />
          <TextField label="Jabatan" value={get('kepsekJabatan')} onChange={v => set('kepsekJabatan', v)} placeholder="Kepala Sekolah" />
        </div>
        <ImageField
          label="Foto Kepala Sekolah" hint="Foto resmi. Disarankan rasio persegi (1:1)."
          value={get('kepsekFotoUrl')} onChange={v => set('kepsekFotoUrl', v)}
          maxWidth={512} preview="square"
        />
        <TextAreaField label="Teks Sambutan" value={get('kepsekSambutan')} onChange={v => set('kepsekSambutan', v)}
          placeholder="Tulis sambutan singkat untuk pengunjung situs..." rows={6} />
      </Section>

      <Section icon={Sparkles} title="Fitur Unggulan" description="Daftar fitur yang ditonjolkan di landing (3–6 item ideal). Pilih ikon dari preset.">
        {fiturList.length === 0 ? (
          <div className="text-center py-8 border-2 border-dashed border-outline-variant rounded-xl text-on-surface-variant">
            <Sparkles className="w-8 h-8 mx-auto mb-2 text-outline-variant" />
            <p className="text-sm mb-3">Belum ada fitur. Default fitur (Ujian Online, Presensi, Tracer Alumni) akan dipakai.</p>
            <Button type="button" variant="outline" size="sm" onClick={addFitur}>
              <Plus className="w-4 h-4 mr-1.5" /> Tambah Fitur
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {fiturList.map((f, i) => (
              <div key={i} className="border border-outline-variant rounded-xl p-4 bg-surface-container-low space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-on-surface">Fitur #{i + 1}</span>
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeFitur(i)} className="text-error hover:bg-error-container">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <div className="grid sm:grid-cols-[160px_1fr] gap-3">
                  <div className="space-y-1.5">
                    <Label>Ikon</Label>
                    <select
                      value={f.icon}
                      onChange={e => updateFitur(i, { icon: e.target.value })}
                      className="flex h-10 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface shadow-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    >
                      {FITUR_ICON_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                  </div>
                  <TextField label="Judul" value={f.title} onChange={v => updateFitur(i, { title: v })} placeholder="Misal: Ujian Online" />
                </div>
                <TextAreaField label="Deskripsi" value={f.desc} onChange={v => updateFitur(i, { desc: v })} placeholder="Penjelasan singkat fitur ini" rows={2} />
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addFitur} disabled={fiturList.length >= 6}>
              <Plus className="w-4 h-4 mr-1.5" /> Tambah Fitur ({fiturList.length}/6)
            </Button>
          </div>
        )}
      </Section>

      <Section icon={Phone} title="Hubungi Kami" description="Info kontak untuk footer landing.">
        <TextAreaField label="Alamat" value={get('alamat')} onChange={v => set('alamat', v)} placeholder="Jl. Pendidikan No. 123, Kota..." rows={2} />
        <div className="grid sm:grid-cols-2 gap-4">
          <TextField label="Telepon" value={get('telepon')} onChange={v => set('telepon', v)} placeholder="(021) 555-0123" />
          <TextField label="WhatsApp" value={get('whatsapp')} onChange={v => set('whatsapp', v)} placeholder="628123456789" />
          <TextField label="Email" type="email" value={get('email')} onChange={v => set('email', v)} placeholder="info@sekolah.sch.id" />
        </div>
        <div className="space-y-1.5">
          <Label>
            <MapPin className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />
            URL Embed Google Maps
          </Label>
          <p className="text-xs text-on-surface-variant">
            Buka Google Maps → cari lokasi sekolah → Bagikan → tab <strong>Sematkan peta</strong> → copy isi <code className="px-1 bg-surface-container rounded text-[11px]">src="..."</code> di iframe-nya. Tempel di sini. Peta akan tampil di footer landing.
          </p>
          <Input
            value={get('mapsEmbedUrl')}
            onChange={e => set('mapsEmbedUrl', e.target.value)}
            placeholder="https://www.google.com/maps/embed?pb=!1m18..."
          />
          {get('mapsEmbedUrl') && (
            <div className="mt-2 rounded-lg overflow-hidden border border-outline-variant">
              <iframe
                src={get('mapsEmbedUrl')}
                className="w-full h-64"
                style={{ border: 0 }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Preview lokasi"
              />
            </div>
          )}
        </div>
      </Section>

      <Section icon={Share2} title="Sosial Media" description="Link akun resmi sekolah. Kosongkan kalau tidak punya.">
        <div className="grid sm:grid-cols-2 gap-4">
          <TextField label="Facebook" value={get('facebook')} onChange={v => set('facebook', v)} placeholder="https://facebook.com/sekolahanda" />
          <TextField label="Instagram" value={get('instagram')} onChange={v => set('instagram', v)} placeholder="https://instagram.com/sekolahanda" />
          <TextField label="Twitter / X" value={get('twitter')} onChange={v => set('twitter', v)} placeholder="https://twitter.com/sekolahanda" />
          <TextField label="YouTube" value={get('youtube')} onChange={v => set('youtube', v)} placeholder="https://youtube.com/@sekolahanda" />
          <TextField label="TikTok" value={get('tiktok')} onChange={v => set('tiktok', v)} placeholder="https://tiktok.com/@sekolahanda" />
        </div>
      </Section>

      {/* Sticky save bar */}
      <div className="fixed bottom-0 left-0 right-0 lg:left-64 bg-surface-container-lowest border-t border-outline-variant px-4 py-3 shadow-lg z-30">
        <div className="max-w-7xl mx-auto flex justify-end">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <><Spinner />Menyimpan...</> : <><Save className="w-4 h-4 mr-1.5" /> Simpan Semua Perubahan</>}
          </Button>
        </div>
      </div>
    </div>
  );
}
