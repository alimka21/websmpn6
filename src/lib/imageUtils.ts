// src/lib/imageUtils.ts
// Helper untuk resize + compress gambar di browser, lalu encode jadi base64 data URL.

export interface ResizeOptions {
  /** Lebar maksimum dalam pixel. Tinggi otomatis proporsional. Default 800. */
  maxWidth?: number;
  /** Tinggi maksimum dalam pixel. Default sama dengan maxWidth. */
  maxHeight?: number;
  /** Quality JPEG 0-1. Default 0.85. PNG diabaikan (lossless). */
  quality?: number;
  /** Force output type. Default: auto (PNG kalau ada transparansi/icon, JPEG kalau foto). */
  outputType?: 'image/jpeg' | 'image/png';
}

/**
 * Baca file gambar, resize, kompres, return data URL base64.
 * Throws Error kalau bukan image atau gagal di-decode.
 */
export async function fileToResizedBase64(file: File, opts: ResizeOptions = {}): Promise<string> {
  const { maxWidth = 800, maxHeight = maxWidth, quality = 0.85, outputType } = opts;

  if (!file.type.startsWith('image/')) {
    throw new Error('File harus berupa gambar');
  }

  const dataUrl = await readFileAsDataURL(file);
  const img = await loadImage(dataUrl);

  const scale = Math.min(1, maxWidth / img.width, maxHeight / img.height);
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas tidak didukung browser ini');
  ctx.drawImage(img, 0, 0, w, h);

  // PNG kalau file asli PNG (kemungkinan punya transparansi seperti logo/favicon).
  // JPEG untuk lainnya (foto besar, ukuran lebih kecil).
  const mime = outputType ?? (file.type === 'image/png' ? 'image/png' : 'image/jpeg');
  return canvas.toDataURL(mime, mime === 'image/jpeg' ? quality : undefined);
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Gagal membaca file'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Gagal memuat gambar (mungkin format tidak didukung)'));
    img.src = src;
  });
}

/** Estimasi ukuran data URL dalam KB (rough — base64 = 4/3 raw). */
export function dataUrlSizeKB(dataUrl: string): number {
  // remove "data:...;base64," prefix to get payload length
  const comma = dataUrl.indexOf(',');
  const payload = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  // base64 chars → bytes: every 4 chars = 3 bytes (minus padding)
  const padding = (payload.match(/=+$/)?.[0].length ?? 0);
  const bytes = Math.floor((payload.length * 3) / 4) - padding;
  return Math.round(bytes / 1024);
}
