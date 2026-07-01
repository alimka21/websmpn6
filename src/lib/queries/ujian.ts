/**
 * Query keys + fetchers untuk semua data ujian.
 * Dipakai oleh DaftarUjian, RekapNilai, AdminUjianList.
 *
 * Pola key: ['ujian', scope, resource, ...params]
 * Ini memungkinkan invalidasi selektif, misal invalidate semua
 * query guru saat satu ujian berubah.
 */
import api from '../api';

/* ── Query Keys ─────────────────────────────────────────────── */
export const ujianKeys = {
  all:         ['ujian'] as const,

  guru:        () => [...ujianKeys.all, 'guru'] as const,
  guruList:    () => [...ujianKeys.guru(), 'list'] as const,
  guruKelas:   () => [...ujianKeys.guru(), 'kelas'] as const,
  guruMapel:   () => [...ujianKeys.guru(), 'mapel'] as const,
  guruRekap:   (ujianId: string) => [...ujianKeys.guru(), 'rekap', ujianId] as const,

  admin:       () => [...ujianKeys.all, 'admin'] as const,
  adminList:   () => [...ujianKeys.admin(), 'list'] as const,
};

/* ── Fetchers ───────────────────────────────────────────────── */
export async function fetchGuruUjianList() {
  const res = await api.get('/api/guru/ujian?limit=100');
  return (res?.data ?? []) as any[];
}

export async function fetchGuruKelas() {
  const res = await api.get('/api/guru/kelas');
  return (Array.isArray(res) ? res : []) as any[];
}

export async function fetchGuruMapel() {
  const res = await api.get('/api/guru/mapel');
  return (Array.isArray(res) ? res : []) as string[];
}

export async function fetchGuruRekap(ujianId: string) {
  return api.get(`/api/guru/ujian/${ujianId}/hasil`);
}

export async function fetchAdminUjianList() {
  const res = await api.get('/api/admin/ujian?limit=100');
  return (res?.data ?? []) as any[];
}
