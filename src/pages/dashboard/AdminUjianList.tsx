import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Trash2, FileText, AlertTriangle, ClipboardList, Plus, PenTool, BarChart3 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Pagination } from '../../components/ui/pagination';
import { useModalA11y } from '../../hooks/useModalA11y';
import { toast } from 'sonner';
import api from '../../lib/api';

const ITEMS_PER_PAGE = 15;

interface UjianRow {
  id: string;
  judul: string;
  mataPelajaran: string;
  tipeUjian: string | null;
  durasi: number;
  tanggalMulai: string | null;
  tanggalSelesai: string | null;
  createdAt: string;
  guru: { id: string; nama: string; nip: string; mataPelajaran: string } | null;
  kelas: { kelas: { id: string; nama: string; tingkat: string } }[];
  _count: { soal: number; sesiUjian: number };
}

const formatDateRange = (start: string | null, end: string | null) => {
  if (!start || !end) return '-';
  const s = new Date(start);
  const e = new Date(end);
  const fmt = (d: Date) => d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  return `${fmt(s)} → ${fmt(e)}`;
};

// Status badge dengan accent design system
const getStatus = (start: string | null, end: string | null): { label: string; cls: string } => {
  if (!start || !end) return { label: 'Draft', cls: 'bg-surface-container text-on-surface-variant' };
  const now = Date.now();
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (now < s) return { label: 'Belum mulai', cls: 'bg-tertiary-fixed text-on-tertiary-fixed' };
  if (now > e) return { label: 'Selesai', cls: 'bg-surface-container text-on-surface-variant' };
  return { label: 'Aktif', cls: 'bg-secondary-container/40 text-on-secondary-container' };
};

export default function AdminUjianList() {
  const navigate = useNavigate();
  const [ujianList, setUjianList] = useState<UjianRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [filterGuru, setFilterGuru] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'Aktif' | 'Belum mulai' | 'Selesai' | 'Draft'>('ALL');
  const [page, setPage] = useState(1);

  const [deleteConfirm, setDeleteConfirm] = useState<UjianRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const deleteModalRef = useModalA11y<HTMLDivElement>(deleteConfirm !== null, () => setDeleteConfirm(null));

  const fetchUjian = async () => {
    try {
      setIsLoading(true);
      setErrorMsg(null);
      // Endpoint paginated — halaman ini punya search + filter guru + filter status client-side,
      // jadi ambil 100 ujian terbaru. Refactor jadi server-search kalau dataset > 100.
      const res = await api.get('/api/admin/ujian?limit=100');
      setUjianList(res?.data ?? []);
      if (res?.pagination?.total > 100) {
        toast.info(`Total ${res.pagination.total} ujian — hanya 100 terbaru ditampilkan.`);
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Gagal memuat data ujian');
      toast.error(e.message || 'Gagal memuat data ujian');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchUjian(); }, []);
  useEffect(() => { setPage(1); }, [search, filterGuru, filterStatus]);

  const guruOptions = useMemo(() => {
    const map = new Map<string, string>();
    ujianList.forEach(u => { if (u.guru) map.set(u.guru.id, u.guru.nama); });
    return Array.from(map.entries()).map(([id, nama]) => ({ id, nama }));
  }, [ujianList]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return ujianList.filter(u => {
      const matchSearch = !q || u.judul.toLowerCase().includes(q) || u.mataPelajaran.toLowerCase().includes(q);
      const matchGuru = filterGuru === 'ALL' || u.guru?.id === filterGuru;
      const status = getStatus(u.tanggalMulai, u.tanggalSelesai).label;
      const matchStatus = filterStatus === 'ALL' || status === filterStatus;
      return matchSearch && matchGuru && matchStatus;
    });
  }, [ujianList, search, filterGuru, filterStatus]);

  const paged = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      setIsDeleting(true);
      await api.delete(`/api/admin/ujian/${deleteConfirm.id}`);
      toast.success(`Ujian "${deleteConfirm.judul}" berhasil dihapus`);
      setDeleteConfirm(null);
      fetchUjian();
    } catch (e: any) {
      toast.error(e.message || 'Gagal menghapus ujian');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-headline-md text-on-surface">Kelola Ujian</h1>
          <p className="text-on-surface-variant mt-1">Pantau & kelola semua ujian dari semua guru.</p>
        </div>
        <Button onClick={() => navigate('/dashboard/guru/ujian/baru')} className="shrink-0">
          <Plus className="w-4 h-4 mr-1.5" /> Buat Ujian Baru
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cari judul ujian atau mata pelajaran..."
            className="pl-9"
          />
        </div>
        <Select value={filterGuru} onChange={e => setFilterGuru(e.target.value)} className="w-full sm:w-52">
          <option value="ALL">Semua Guru</option>
          {guruOptions.map(g => <option key={g.id} value={g.id}>{g.nama}</option>)}
        </Select>
        <Select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)} className="w-full sm:w-44">
          <option value="ALL">Semua Status</option>
          <option value="Aktif">Aktif</option>
          <option value="Belum mulai">Belum mulai</option>
          <option value="Selesai">Selesai</option>
          <option value="Draft">Draft</option>
        </Select>
      </div>

      {/* Tabel */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="py-12 flex flex-col items-center">
            <div className="w-6 h-6 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-2" />
            <span className="text-sm text-on-surface-variant">Memuat...</span>
          </div>
        ) : errorMsg ? (
          <div className="py-12 flex flex-col items-center text-center">
            <AlertTriangle className="w-10 h-10 text-error mb-2" />
            <p className="text-error font-medium mb-1">Gagal memuat data</p>
            <p className="text-sm text-on-surface-variant mb-4">{errorMsg}</p>
            <Button onClick={fetchUjian}>Muat Ulang</Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 flex flex-col items-center text-center">
            <FileText className="w-10 h-10 text-outline-variant mb-2" />
            <p className="text-on-surface-variant">
              {ujianList.length === 0 ? 'Belum ada ujian yang dibuat guru.' : 'Tidak ada ujian yang cocok dengan filter.'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-surface-container border-b border-outline-variant">
                  <tr>
                    <th className="px-4 py-3 text-label-sm uppercase tracking-wider font-bold text-on-surface-variant">Judul Ujian</th>
                    <th className="px-4 py-3 text-label-sm uppercase tracking-wider font-bold text-on-surface-variant">Mata Pelajaran</th>
                    <th className="px-4 py-3 text-label-sm uppercase tracking-wider font-bold text-on-surface-variant">Guru</th>
                    <th className="px-4 py-3 text-label-sm uppercase tracking-wider font-bold text-on-surface-variant">Kelas</th>
                    <th className="px-4 py-3 text-label-sm uppercase tracking-wider font-bold text-on-surface-variant text-center">Soal</th>
                    <th className="px-4 py-3 text-label-sm uppercase tracking-wider font-bold text-on-surface-variant text-center">Sesi</th>
                    <th className="px-4 py-3 text-label-sm uppercase tracking-wider font-bold text-on-surface-variant">Jadwal</th>
                    <th className="px-4 py-3 text-label-sm uppercase tracking-wider font-bold text-on-surface-variant">Status</th>
                    <th className="px-4 py-3 text-label-sm uppercase tracking-wider font-bold text-on-surface-variant text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {paged.map(u => {
                    const status = getStatus(u.tanggalMulai, u.tanggalSelesai);
                    return (
                      <tr key={u.id} className="hover:bg-surface-container-low transition-colors">
                        <td className="px-4 py-3 font-medium text-on-surface">{u.judul}</td>
                        <td className="px-4 py-3 text-on-surface-variant">{u.mataPelajaran}</td>
                        <td className="px-4 py-3">
                          {u.guru ? (
                            <div>
                              <p className="font-medium text-on-surface">{u.guru.nama}</p>
                              <p className="text-xs text-on-surface-variant font-mono">{u.guru.nip}</p>
                            </div>
                          ) : <span className="text-on-surface-variant">-</span>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {u.kelas.length === 0 ? (
                              <span className="text-outline-variant text-xs">—</span>
                            ) : (
                              u.kelas.map(uk => (
                                <span
                                  key={uk.kelas.id}
                                  className="inline-flex items-center rounded-full bg-primary-container/15 text-primary px-2 py-0.5 text-xs font-medium"
                                >
                                  {uk.kelas.nama}
                                </span>
                              ))
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-on-surface-variant">
                          <span className="inline-flex items-center gap-1">
                            <ClipboardList className="w-3.5 h-3.5" />
                            {u._count.soal}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {u._count.sesiUjian > 0 ? (
                            <span className="inline-flex items-center rounded-full bg-secondary-container/40 text-on-secondary-container px-2 py-0.5 text-xs font-bold">
                              {u._count.sesiUjian}
                            </span>
                          ) : (
                            <span className="text-outline-variant text-xs">0</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-on-surface-variant text-xs whitespace-nowrap">
                          {formatDateRange(u.tanggalMulai, u.tanggalSelesai)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full ${status.cls} px-2.5 py-0.5 text-label-sm uppercase tracking-wider font-bold`}>
                            {status.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex gap-1 justify-end">
                            <Button
                              variant="ghost" size="sm"
                              onClick={() => navigate(`/dashboard/guru/ujian/${u.id}/soal`)}
                              className="h-8 px-2"
                              aria-label={`Kelola soal ujian ${u.judul}`}
                              title="Kelola Soal"
                            >
                              <PenTool className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost" size="sm"
                              onClick={() => navigate(`/dashboard/guru/rekap?ujianId=${u.id}`)}
                              className="h-8 px-2"
                              aria-label={`Lihat hasil ujian ${u.judul}`}
                              title="Lihat Hasil / Rekap Nilai"
                            >
                              <BarChart3 className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost" size="sm"
                              onClick={() => setDeleteConfirm(u)}
                              className="h-8 px-2 text-error hover:bg-error-container"
                              aria-label={`Hapus ujian ${u.judul}`}
                              title="Hapus ujian"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination
              currentPage={page}
              totalItems={filtered.length}
              itemsPerPage={ITEMS_PER_PAGE}
              onPageChange={setPage}
              itemLabel="ujian"
            />
          </>
        )}
      </div>

      {/* Modal hapus */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/40 backdrop-blur-sm">
          <div
            ref={deleteModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-ujian-title"
            className="w-full max-w-md bg-surface-container-lowest border border-outline-variant rounded-xl shadow-xl"
          >
            <div className="px-6 pt-6 pb-4 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-error-container flex items-center justify-center mb-3">
                <Trash2 className="w-6 h-6 text-error" />
              </div>
              <h2 id="delete-ujian-title" className="text-headline-sm text-on-surface">Hapus ujian ini?</h2>
              <p className="text-sm text-on-surface-variant mt-2">
                <strong className="text-on-surface">{deleteConfirm.judul}</strong>
              </p>
              {deleteConfirm._count.sesiUjian > 0 && (
                <div className="mt-3 flex items-start gap-2 text-xs text-error bg-error-container/50 border border-error/20 rounded-lg px-3 py-2 text-left">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>
                    <strong>{deleteConfirm._count.sesiUjian} sesi siswa</strong> akan ikut terhapus beserta seluruh jawaban dan nilai.
                  </span>
                </div>
              )}
              <p className="text-xs text-on-surface-variant mt-2">
                Aksi ini tidak bisa dibatalkan. Seluruh soal, kelas, dan sesi siswa akan ikut terhapus.
              </p>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <Button variant="outline" onClick={() => setDeleteConfirm(null)} disabled={isDeleting} className="flex-1">
                Batal
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={isDeleting} className="flex-1">
                {isDeleting ? 'Menghapus...' : 'Ya, Hapus'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
