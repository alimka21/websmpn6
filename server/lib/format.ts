/**
 * Convert string to Title Case, dengan penanganan gelar akademik (S.Pd., M.Pd., dll.)
 * Huruf pertama setiap segmen yang dipisahkan titik juga dikapitalisasi.
 */
export function toTitleCase(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .trim()
    .toLowerCase()
    .split(' ')
    .filter(word => word.length > 0)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    // Kapitalisasi huruf setelah titik (untuk gelar: S.Pd. → S.Pd., M.pd. → M.Pd.)
    .replace(/\.([a-z])/g, (_, ch) => '.' + ch.toUpperCase());
}
