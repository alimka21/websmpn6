// In-memory cache untuk endpoint read-heavy.
//
// Catatan multi-worker (Hostinger LiteSpeed FastCGI):
//   Cache ini hidup di memory tiap worker process. Worker A & worker B
//   punya cache masing-masing. Konsekuensinya:
//   - HIT: tetap hemat round-trip DB per worker.
//   - invalidateByPrefix: hanya bersihkan worker yang serve request mutation
//     itu. Worker lain bisa serve data lama hingga TTL kadaluarsa.
//   TTL pendek (2-10m) membatasi window staleness. Cukup untuk MVP.
//   Kalau perlu strong consistency cross-worker → migrasi ke Redis.

import NodeCache from "node-cache";

export const appCache = new NodeCache({
  stdTTL: 300,       // default 5 menit
  checkperiod: 120,  // bersihkan key expired tiap 2 menit
  useClones: false,  // performa lebih baik — caller TIDAK BOLEH mutate hasil
});

/**
 * Pola read-through cache:
 *   const data = await withCache("key", 600, () => prisma.foo.findMany(...));
 *
 * Kalau key sudah ada → return langsung dari memory.
 * Kalau belum → panggil fetcher, simpan, return.
 */
export async function withCache<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const cached = appCache.get<T>(key);
  if (cached !== undefined) return cached;
  const fresh = await fetcher();
  appCache.set(key, fresh, ttlSeconds);
  return fresh;
}

/**
 * Hapus semua key yang dimulai dengan prefix tertentu.
 * Dipanggil setelah mutation supaya cache tidak serve data basi.
 *
 * Contoh:
 *   invalidateByPrefix("pub:berita")  → hapus pub:berita, pub:berita:slug:foo, dst.
 */
export function invalidateByPrefix(prefix: string): void {
  const matched = appCache.keys().filter(k => k.startsWith(prefix));
  for (const k of matched) appCache.del(k);
}

/** Untuk debug — lihat hit/miss/keys di endpoint health misal. */
export function getCacheStats() {
  return appCache.getStats();
}
