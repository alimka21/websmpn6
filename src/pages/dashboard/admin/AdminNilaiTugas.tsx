import React, { useState, useEffect, useMemo } from 'react';
import {
  BookOpen, Search, AlertTriangle, ChevronRight, X, Users,
  CheckCircle2, Clock, Filter,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Select } from '../../../components/ui/select';
import { Pagination } from '../../../components/ui/pagination';
import { toast } from 'sonner';
import api from '../../../lib/api';

const ITEMS_PER_PAGE = 20;

const JENIS_LABEL: Record<string, string> = {
  UH: 'Ulangan Harian', UTS: 'UTS', UAS: 'UAS', PR: 'PR/Tugas',
  ULANGAN_LISAN: 'Ulangan Lisan', PRAKTEK: 'Praktek', LAINNYA: 'Lainnya',
};

const JENIS_BADGE: Record<string, string> = {
  UH: 'bg-blue-50 text-blue-700',
  UTS: 'bg-amber-50 text-amber-700',
  UAS: 'bg-red-50 text-red-700',
  PR: 'bg-green-50 text-green-700',
  ULANGAN_LISAN: 'bg-purple-50 text-purple-700',
  PRAKTEK: 'bg-teal-50 text-teal-700',
  LAINNYA: 'bg-surface-container text-on-surface-variant',
};

interface KolomRow {
  id: string;
  judul: string;
  jenis: string;
  materi: string;
  mataPelajaran: string;
  tanggal: string;
  guruId: string;
  guru?: { nama: string; nip: string };
  kelasTarget: { kelas: { id: string; nama: string } }[];
  _count: { nilai: number };
}

interface SiswaNilaiRow {
  siswaId: string; nama: string; nis: string; kelas: string;
  nilai: number | null; keterangan: string | null;
}

interface DetailData {
  kolom: KolomRow;
  rows: SiswaNilaiRow[];
}

function formatTanggal(t: string) {
  return new Date(t).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Detail Modal ──────────────────────────────────────────────────────────────
function DetailModal({ kolomId, onClose }: { kolomId: string; onClose: () => void }) {
  const [data, setData]       = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');

  useEffect(() => {
    (async () => {
      try {
        const r: any = await api.get(`/api/guru/kolom-nilai/${kolomId}/nilai`);
        setData(r);
      } catch (e: any) {
        toast.error(e.message || 'Gagal memuat detail nilai');
        onClose();
      } finally {
        setLoading(false);
      }
    })();
  }, [kolomId]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.toLowerCase().trim();
    if (!q) return data.rows;
    return data.rows.filter(r =>
      r.nama.toLowerCase().includes(q) || r.nis.includes(q) || r.kelas.toLowerCase().includes(q)
    );
  }, [data, search]);

  const terisi = data?.rows.filter(r => r.nilai !== null).length ?? 0;
  const total  = data?.rows.length ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-inverse-surface/50 backdrop-blur-sm p-4 pt-10 overflow-y-auto">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 p-5 border-b border-outline-variant">
          <div>
            {loading ? (
              <div className="h-5 w-48 bg-surface-container animate-pulse rounded" />
            ) : (
              <>
                <h2 className="text-title-lg font-bold text-on-surface">{data?.kolom.judul}</h2>
                <p className="text-sm text-on-surface-variant mt-0.5">
                  {data?.kolom.mataPelajaran} · {data?.kolom.materi} · {data?.kolom.tanggal ? formatTanggal(data.kolom.tanggal) : '-'}
                </p>
              </>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-container-low transition-colors shrink-0">
            <X className="w-5 h-5 text-on-surface-variant" />
          </button>
        </div>

        {/* Stats */}
        {!loading && data && (
          <div className="flex gap-4 px-5 py-3 bg-surface-container-lowest border-b border-outline-variant">
            <div className="flex items-center gap-1.5 text-sm text-on-surface-variant">
              <Users className="w-4 h-4" />
              <span>{total} siswa</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-green-700">
              <CheckCircle2 className="w-4 h-4" />
              <span>{terisi} sudah dinilai</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-amber-600">
              <Clock className="w-4 h-4" />
              <span>{total - terisi} belum</span>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="px-5 py-3 border-b border-outline-variant">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari nama / NIS / kelas..."
              className="pl-9"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="py-12 flex flex-col items-center">
              <div className="w-6 h-6 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-2" />
              <span className="text-sm text-on-surface-variant">Memuat...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-on-surface-variant text-sm">Tidak ada siswa ditemukan.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-surface-container sticky top-0">
                <tr>
                  <th className="px-4 py-2.5 text-left text-label-sm font-bold text-on-surface-variant uppercase tracking-wider">Nama</th>
                  <th className="px-4 py-2.5 text-left text-label-sm font-bold text-on-surface-variant uppercase tracking-wider">NIS</th>
                  <th className="px-4 py-2.5 text-left text-label-sm font-bold text-on-surface-variant uppercase tracking-wider">Kelas</th>
                  <th className="px-4 py-2.5 text-center text-label-sm font-bold text-on-surface-variant uppercase tracking-wider">Nilai</th>
                  <th className="px-4 py-2.5 text-left text-label-sm font-bold text-on-surface-variant uppercase tracking-wider">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {filtered.map(row => (
                  <tr key={row.siswaId} className="hover:bg-surface-container-low transition-colors">
                    <td className="px-4 py-2.5 font-medium text-on-surface">{row.nama}</td>
                    <td className="px-4 py-2.5 font-mono text-on-surface-variant text-xs">{row.nis}</td>
                    <td className="px-4 py-2.5 text-on-surface-variant">{row.kelas}</td>
                    <td className="px-4 py-2.5 text-center">
                      {row.nilai !== null ? (
                        <span className={`font-bold ${row.nilai >= 75 ? 'text-green-700' : 'text-error'}`}>
                          {row.nilai}
                        </span>
                      ) : (
                        <span className="text-outline-variant text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-on-surface-variant text-xs">{row.keterangan || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-5 py-3 flex justify-end border-t border-outline-variant">
          <Button variant="outline" onClick={onClose}>Tutup</Button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AdminNilaiTugas() {
  const [list, setList]         = useState<KolomRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [search, setSearch]       = useState('');
  const [filterGuru, setFilterGuru] = useState('ALL');
  const [filterJenis, setFilterJenis] = useState('ALL');
  const [filterMapel, setFilterMapel] = useState('ALL');
  const [page, setPage]           = useState(1);

  const [detailId, setDetailId]   = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      setErrorMsg(null);
      const r: any = await api.get('/api/guru/kolom-nilai');
      setList(Array.isArray(r) ? r : []);
    } catch (e: any) {
      setErrorMsg(e.message || 'Gagal memuat data');
      toast.error(e.message || 'Gagal memuat data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { setPage(1); }, [search, filterGuru, filterJenis, filterMapel]);

  // Derive options from data
  const guruOptions = useMemo(() => {
    const map = new Map<string, string>();
    list.forEach(k => { if (k.guru) map.set(k.guruId, k.guru.nama); });
    return Array.from(map.entries()).map(([id, nama]) => ({ id, nama }));
  }, [list]);

  const mapelOptions = useMemo(() => {
    const set = new Set(list.map(k => k.mataPelajaran).filter(Boolean));
    return Array.from(set).sort();
  }, [list]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return list.filter(k => {
      const matchSearch = !q || k.judul.toLowerCase().includes(q) || k.mataPelajaran.toLowerCase().includes(q) || k.materi.toLowerCase().includes(q);
      const matchGuru  = filterGuru  === 'ALL' || k.guruId === filterGuru;
      const matchJenis = filterJenis === 'ALL' || k.jenis === filterJenis;
      const matchMapel = filterMapel === 'ALL' || k.mataPelajaran === filterMapel;
      return matchSearch && matchGuru && matchJenis && matchMapel;
    });
  }, [list, search, filterGuru, filterJenis, filterMapel]);

  const paged = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  // Summary stats
  const totalNilaiTerisi = list.reduce((acc, k) => acc + (k._count?.nilai ?? 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-headline-md text-on-surface">Monitor Nilai & Tugas</h1>
        <p className="text-on-surface-variant mt-1">Pantau semua kolom nilai dan tugas yang dibuat guru.</p>
      </div>

      {/* Summary cards */}
      {!isLoading && !errorMsg && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4">
            <p className="text-label-sm text-on-surface-variant uppercase tracking-wider">Total Kolom Nilai</p>
            <p className="text-3xl font-bold text-on-surface mt-1">{list.length}</p>
          </div>
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4">
            <p className="text-label-sm text-on-surface-variant uppercase tracking-wider">Guru Aktif</p>
            <p className="text-3xl font-bold text-on-surface mt-1">{guruOptions.length}</p>
          </div>
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 col-span-2 sm:col-span-1">
            <p className="text-label-sm text-on-surface-variant uppercase tracking-wider">Nilai Terisi</p>
            <p className="text-3xl font-bold text-green-700 mt-1">{totalNilaiTerisi}</p>
          </div>
        </div>
      )}

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cari judul, mapel, materi..."
            className="pl-9"
          />
        </div>
        <Select value={filterGuru} onChange={e => setFilterGuru(e.target.value)} className="w-full sm:w-52">
          <option value="ALL">Semua Guru</option>
          {guruOptions.map(g => <option key={g.id} value={g.id}>{g.nama}</option>)}
        </Select>
        <Select value={filterMapel} onChange={e => setFilterMapel(e.target.value)} className="w-full sm:w-44">
          <option value="ALL">Semua Mapel</option>
          {mapelOptions.map(m => <option key={m} value={m}>{m}</option>)}
        </Select>
        <Select value={filterJenis} onChange={e => setFilterJenis(e.target.value)} className="w-full sm:w-44">
          <option value="ALL">Semua Jenis</option>
          {Object.entries(JENIS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
      </div>

      {/* Table */}
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
            <Button onClick={fetchData}>Muat Ulang</Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 flex flex-col items-center text-center">
            <Filter className="w-10 h-10 text-outline-variant mb-2" />
            <p className="text-on-surface-variant">
              {list.length === 0 ? 'Belum ada kolom nilai yang dibuat guru.' : 'Tidak ada data yang cocok dengan filter.'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-surface-container border-b border-outline-variant">
                  <tr>
                    <th className="px-4 py-3 text-label-sm uppercase tracking-wider font-bold text-on-surface-variant">Judul / Materi</th>
                    <th className="px-4 py-3 text-label-sm uppercase tracking-wider font-bold text-on-surface-variant">Jenis</th>
                    <th className="px-4 py-3 text-label-sm uppercase tracking-wider font-bold text-on-surface-variant">Mata Pelajaran</th>
                    <th className="px-4 py-3 text-label-sm uppercase tracking-wider font-bold text-on-surface-variant">Guru</th>
                    <th className="px-4 py-3 text-label-sm uppercase tracking-wider font-bold text-on-surface-variant">Kelas</th>
                    <th className="px-4 py-3 text-label-sm uppercase tracking-wider font-bold text-on-surface-variant">Tanggal</th>
                    <th className="px-4 py-3 text-label-sm uppercase tracking-wider font-bold text-on-surface-variant text-center">Terisi</th>
                    <th className="px-4 py-3 text-label-sm uppercase tracking-wider font-bold text-on-surface-variant text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {paged.map(k => (
                    <tr key={k.id} className="hover:bg-surface-container-low transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-on-surface">{k.judul}</p>
                        <p className="text-xs text-on-surface-variant mt-0.5">{k.materi}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${JENIS_BADGE[k.jenis] ?? JENIS_BADGE['LAINNYA']}`}>
                          {JENIS_LABEL[k.jenis] ?? k.jenis}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-on-surface-variant">{k.mataPelajaran}</td>
                      <td className="px-4 py-3">
                        {k.guru ? (
                          <div>
                            <p className="font-medium text-on-surface">{k.guru.nama}</p>
                            <p className="text-xs text-on-surface-variant font-mono">{k.guru.nip}</p>
                          </div>
                        ) : <span className="text-outline-variant">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(k.kelasTarget?.length ?? 0) === 0 ? (
                            <span className="text-outline-variant text-xs">—</span>
                          ) : k.kelasTarget.map(kt => (
                            <span key={kt.kelas?.id} className="inline-flex items-center rounded-full bg-primary-container/15 text-primary px-2 py-0.5 text-xs font-medium">
                              {kt.kelas?.nama}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-on-surface-variant text-xs whitespace-nowrap">
                        {k.tanggal ? formatTanggal(k.tanggal) : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold ${(k._count?.nilai ?? 0) > 0 ? 'text-green-700' : 'text-outline-variant'}`}>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {k._count?.nilai ?? 0}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost" size="sm"
                          onClick={() => setDetailId(k.id)}
                          className="h-8 px-2 gap-1"
                          title="Lihat detail nilai siswa"
                        >
                          <BookOpen className="w-4 h-4" />
                          <ChevronRight className="w-3 h-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filtered.length > ITEMS_PER_PAGE && (
              <div className="px-4 py-3 border-t border-outline-variant">
                <Pagination
                  currentPage={page}
                  totalItems={filtered.length}
                  itemsPerPage={ITEMS_PER_PAGE}
                  onPageChange={setPage}
                />
              </div>
            )}
          </>
        )}
      </div>

      {detailId && (
        <DetailModal kolomId={detailId} onClose={() => setDetailId(null)} />
      )}
    </div>
  );
}
