import { toast } from 'sonner';
import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '../../../components/ui/button';
import { Select } from '../../../components/ui/select';
import { Badge } from '../../../components/ui/badge';
import { Search, Download, AlertTriangle, X, ChevronUp, ChevronDown, CheckCircle2, XCircle, MinusCircle, RotateCcw } from 'lucide-react';
import api from '../../../lib/api';
import { useModalA11y } from '../../../hooks/useModalA11y';

export default function RekapNilai() {
  const [searchParams] = useSearchParams();
  const preselectedId = searchParams.get('ujianId');

  const [ujianList, setUjianList] = useState<any[]>([]);
  const [selectedUjian, setSelectedUjian] = useState<string>('');
  const [rekapData, setRekapData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState<'xlsx' | 'pdf' | null>(null);

  // Sort
  const [sortField, setSortField] = useState<string>('nilaiAkhir');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Detail modal
  const [detailSesiId, setDetailSesiId] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<any | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const detailModalRef = useModalA11y<HTMLDivElement>(detailSesiId !== null, () => setDetailSesiId(null));

  // Reset confirm
  const [resetTarget, setResetTarget] = useState<{ sesiId: string; nama: string; nis: string } | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const resetModalRef = useModalA11y<HTMLDivElement>(resetTarget !== null, () => setResetTarget(null));

  const handleResetSesi = async () => {
    if (!resetTarget || !selectedUjian) return;
    try {
      setIsResetting(true);
      const res = await api.delete(`/api/guru/ujian/${selectedUjian}/sesi/${resetTarget.sesiId}`);
      toast.success(res?.message || `Sesi siswa "${resetTarget.nama}" berhasil di-reset`);
      setResetTarget(null);
      // Refresh rekap
      fetchRekap();
    } catch (err: any) {
      toast.error(err.message || 'Gagal reset sesi siswa');
    } finally {
      setIsResetting(false);
    }
  };

  useEffect(() => { fetchUjian(); }, []);

  const fetchUjian = async () => {
    try {
      // Endpoint paginated — dropdown ujian ambil 100 terbaru.
      const res = await api.get('/api/guru/ujian?limit=100');
      const list = res?.data ?? [];
      const filtered = list.filter((u: any) => new Date() >= new Date(u.tanggalMulai));
      setUjianList(filtered);
      if (filtered.length > 0) {
        const targetId = preselectedId && filtered.some((u: any) => u.id === preselectedId)
          ? preselectedId
          : filtered[0].id;
        setSelectedUjian(targetId);
      }
    } catch (error: any) {
      toast.error(error?.message || 'Gagal memuat daftar ujian');
    }
  };

  useEffect(() => {
    if (selectedUjian) fetchRekap();
  }, [selectedUjian]);

  const fetchRekap = async () => {
    try {
      setIsLoading(true);
      setRekapData(null);
      const res = await api.get(`/api/guru/ujian/${selectedUjian}/hasil`);
      setRekapData(res);
    } catch (error: any) {
      toast.error(error?.message || 'Gagal memuat rekap nilai');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir(field === 'nilaiAkhir' ? 'desc' : 'asc');
    }
  };

  const sortedData = Array.isArray(rekapData) ? [...rekapData].sort((a, b) => {
    const mul = sortDir === 'asc' ? 1 : -1;
    if (sortField === 'nama') return (a.siswa.nama as string).localeCompare(b.siswa.nama) * mul;
    if (sortField === 'kelas') return ((a.siswa.kelas?.nama ?? '') as string).localeCompare(b.siswa.kelas?.nama ?? '') * mul;
    if (sortField === 'status') return (a.status as string).localeCompare(b.status) * mul;
    // nilaiAkhir: null goes last
    const va = a.nilaiAkhir ?? (sortDir === 'asc' ? Infinity : -Infinity);
    const vb = b.nilaiAkhir ?? (sortDir === 'asc' ? Infinity : -Infinity);
    return (va - vb) * mul;
  }) : [];

  const getToken = () => {
    let token = localStorage.getItem('token');
    if (!token) {
      try {
        const raw = localStorage.getItem('auth-storage');
        if (raw) token = JSON.parse(raw)?.state?.token;
      } catch { /* ignore */ }
    }
    return token;
  };

  const handleExport = async (format: 'xlsx' | 'pdf') => {
    if (!selectedUjian) return;
    try {
      setIsExporting(format);
      const token = getToken();
      const resp = await fetch(`/api/guru/ujian/${selectedUjian}/export?format=${format}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!resp.ok) throw new Error('Gagal mengunduh file');
      const blob = await resp.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = `nilai-ujian.${format === 'xlsx' ? 'xlsx' : 'pdf'}`;
      a.click();
      URL.revokeObjectURL(href);
      toast.success(`File ${format.toUpperCase()} berhasil diunduh`);
    } catch (err: any) {
      toast.error(err.message || 'Gagal mengunduh file');
    } finally {
      setIsExporting(null);
    }
  };

  const handleOpenDetail = async (sesiId: string) => {
    if (!sesiId) {
      toast.error('Siswa belum mulai mengerjakan ujian');
      return;
    }
    setDetailSesiId(sesiId);
    setDetailData(null);
    setIsLoadingDetail(true);
    try {
      const res = await api.get(`/api/guru/ujian/${selectedUjian}/sesi/${sesiId}`);
      setDetailData(res);
    } catch (err: any) {
      toast.error('Gagal memuat detail jawaban');
      setDetailSesiId(null);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const getScoreColor = (score: number | null) => {
    if (score === null) return 'text-outline-variant bg-surface-container';
    if (score >= 75) return 'text-on-secondary-container bg-secondary-container/30';
    if (score >= 60) return 'text-on-tertiary-fixed bg-tertiary-fixed/50';
    return 'text-error bg-error-container';
  };

  const statusBadge = (status: string, reason: string | null) => {
    if (status === 'AUTO_SUBMIT') {
      return (
        <span title={`Alasan: ${reason || 'pelanggaran'}`}>
          <Badge variant="destructive" className="cursor-help">Auto-Submit</Badge>
        </span>
      );
    }
    if (status === 'SELESAI') {
      if (reason === 'timeout') return <Badge variant="warning">Waktu Habis</Badge>;
      return <Badge variant="success">Selesai</Badge>;
    }
    if (status === 'SEDANG_BERLANGSUNG') return <Badge className="bg-primary-container/150 text-white border-0">Berlangsung</Badge>;
    return <Badge variant="outline" className="text-on-surface-variant">Belum Mulai</Badge>;
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <ChevronUp className="w-3.5 h-3.5 opacity-20" />;
    return sortDir === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />;
  };

  // Stats
  const stats = useMemo(() => {
    const result = { peserta: 0, rataRata: 0, tertinggi: 0, terendah: 0 };
    if (!Array.isArray(rekapData) || rekapData.length === 0) return result;
    const selesai = rekapData.filter((s: any) => (s.status === 'SELESAI' || s.status === 'AUTO_SUBMIT') && s.nilaiAkhir !== null);
    result.peserta = selesai.length;
    if (selesai.length > 0) {
      const sum = selesai.reduce((a: number, b: any) => a + b.nilaiAkhir, 0);
      result.rataRata = Math.round(sum / selesai.length);
      result.tertinggi = Math.max(...selesai.map((s: any) => s.nilaiAkhir));
      result.terendah = Math.min(...selesai.map((s: any) => s.nilaiAkhir));
    }
    return result;
  }, [rekapData]);

  return (
    <div className="space-y-6">
      {/* Modal Detail Jawaban */}
      {detailSesiId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setDetailSesiId(null)}>
          <div
            ref={detailModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="detail-jawaban-title"
            className="bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant">
              <div>
                <h2 id="detail-jawaban-title" className="text-lg font-bold text-on-surface">Detail Jawaban</h2>
                {detailData && (
                  <p className="text-sm text-on-surface-variant mt-0.5">
                    {detailData.siswa.nama} — NIS {detailData.siswa.nis}
                    {detailData.sesi.nilaiAkhir !== null && (
                      <span className={`ml-2 font-bold px-2 py-0.5 rounded ${getScoreColor(detailData.sesi.nilaiAkhir)}`}>
                        Nilai: {detailData.sesi.nilaiAkhir}
                      </span>
                    )}
                  </p>
                )}
              </div>
              <button className="p-2 rounded-lg hover:bg-surface-container text-on-surface-variant" onClick={() => setDetailSesiId(null)}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-6">
              {isLoadingDetail ? (
                <div className="py-12 text-center text-on-surface-variant">Memuat jawaban...</div>
              ) : detailData ? (
                <div className="space-y-3">
                  {detailData.detail.map((item: any) => (
                    <div key={item.nomor} className={`rounded-xl border p-4 ${item.tidakDijawab ? 'border-outline-variant bg-surface-container-low' : item.isBenar ? 'border-secondary/30 bg-secondary-container/30/50' : 'border-error/20 bg-error-container/50'}`}>
                      <div className="flex items-start gap-3">
                        <span className="shrink-0 w-7 h-7 rounded-full bg-surface-container-high text-on-surface text-xs font-bold flex items-center justify-center">{item.nomor}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-on-surface leading-snug">{item.teks}</p>
                          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            <div className="flex items-center gap-1.5">
                              <span className="text-on-surface-variant shrink-0">Jawaban siswa:</span>
                              {item.tidakDijawab ? (
                                <span className="text-outline-variant italic">Tidak dijawab</span>
                              ) : (
                                <span className={`font-medium ${item.isBenar ? 'text-on-secondary-container' : 'text-error'}`}>
                                  {item.opsiDipilih?.teks ?? '-'}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-on-surface-variant shrink-0">Jawaban benar:</span>
                              <span className="font-medium text-on-secondary-container">{item.opsiBenar?.teks ?? '-'}</span>
                            </div>
                          </div>
                        </div>
                        <div className="shrink-0">
                          {item.tidakDijawab ? (
                            <MinusCircle className="w-5 h-5 text-outline-variant" />
                          ) : item.isBenar ? (
                            <CheckCircle2 className="w-5 h-5 text-secondary" />
                          ) : (
                            <XCircle className="w-5 h-5 text-error" />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="px-6 py-4 border-t border-outline-variant flex justify-between items-center text-sm text-on-surface-variant">
              {detailData && (
                <>
                  <span>
                    {detailData.detail.filter((d: any) => d.isBenar).length} benar /&nbsp;
                    {detailData.detail.filter((d: any) => !d.isBenar && !d.tidakDijawab).length} salah /&nbsp;
                    {detailData.detail.filter((d: any) => d.tidakDijawab).length} tidak dijawab
                  </span>
                  <span>{detailData.detail.length} soal total</span>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-on-surface">Rekapitulasi Nilai</h1>
          <p className="text-on-surface-variant mt-1">Pantau hasil ujian dan analisis performa siswa.</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => handleExport('xlsx')}
            disabled={isExporting !== null || !selectedUjian}
            className="gap-2 bg-secondary-container/30 text-on-secondary-container border-secondary/30 hover:bg-secondary-container/60 hover:text-on-secondary-container"
          >
            {isExporting === 'xlsx' ? <div className="w-4 h-4 border-2 border-secondary/40 border-t-green-700 rounded-full animate-spin" /> : <Download className="w-4 h-4" />}
            Export Excel
          </Button>
          <Button
            variant="outline"
            onClick={() => handleExport('pdf')}
            disabled={isExporting !== null || !selectedUjian}
            className="gap-2 bg-error-container text-error border-error/20 hover:bg-error-container hover:text-error"
          >
            {isExporting === 'pdf' ? <div className="w-4 h-4 border-2 border-error/40 border-t-red-700 rounded-full animate-spin" /> : <Download className="w-4 h-4" />}
            Export PDF
          </Button>
        </div>
      </div>

      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant overflow-hidden shadow-[0px_4px_20px_rgba(0,0,0,0.03)]">
        <div className="px-6 py-5 border-b border-outline-variant">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h2 className="text-xl font-semibold text-on-surface">Filter Ujian</h2>
            <div className="w-full sm:w-96">
              <Select value={selectedUjian} onChange={e => setSelectedUjian(e.target.value)} disabled={ujianList.length === 0}>
                {ujianList.length === 0 && <option value="">Belum ada ujian terlaksana</option>}
                {ujianList.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.judul} — {u.mataPelajaran} ({new Date(u.tanggalMulai).toLocaleDateString('id-ID')})
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </div>

        <div className="p-6">
          {isLoading ? (
            <div className="py-16 flex flex-col items-center gap-3">
              <div className="w-6 h-6 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
              <p className="text-sm text-on-surface-variant">Memuat analisis data...</p>
            </div>
          ) : !Array.isArray(rekapData) ? (
            <div className="py-16 text-center space-y-2">
              <p className="text-on-surface font-medium">Silakan pilih ujian</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Stat Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl">
                  <p className="text-sm text-on-surface-variant font-medium mb-1">Total Selesai</p>
                  <p className="text-2xl font-bold text-on-surface">{stats.peserta} <span className="text-sm font-normal text-on-surface-variant">siswa</span></p>
                </div>
                <div className="bg-primary-container/15 border border-primary/20 p-4 rounded-xl">
                  <p className="text-sm text-primary font-medium mb-1">Rata-rata Kelas</p>
                  <p className="text-2xl font-bold text-primary">{stats.rataRata}</p>
                </div>
                <div className="bg-secondary-container/30 border border-secondary/20 p-4 rounded-xl">
                  <p className="text-sm text-secondary font-medium mb-1">Nilai Tertinggi</p>
                  <p className="text-2xl font-bold text-on-secondary-container">{stats.tertinggi}</p>
                </div>
                <div className="bg-error-container border border-error/20 p-4 rounded-xl">
                  <p className="text-sm text-error font-medium mb-1">Nilai Terendah</p>
                  <p className="text-2xl font-bold text-error">{stats.terendah}</p>
                </div>
              </div>

              {/* Tabel */}
              <div className="overflow-x-auto border rounded-xl">
                <table className="w-full text-sm text-left">
                  <thead className="bg-surface-container-low text-on-surface-variant border-b border-outline-variant">
                    <tr>
                      <th className="px-4 py-3 font-semibold w-12 text-center">No</th>
                      {[
                        { field: 'nama', label: 'Identitas Siswa' },
                        { field: 'kelas', label: 'Kelas' },
                        { field: 'nilaiAkhir', label: 'Nilai Akhir' },
                        { field: 'status', label: 'Status' },
                      ].map(col => (
                        <th
                          key={col.field}
                          className={`px-4 py-3 font-semibold cursor-pointer select-none hover:bg-surface-container transition-colors ${col.field === 'nilaiAkhir' || col.field === 'status' ? 'text-center' : ''}`}
                          onClick={() => handleSort(col.field)}
                        >
                          <span className="inline-flex items-center gap-1">
                            {col.label}
                            <SortIcon field={col.field} />
                          </span>
                        </th>
                      ))}
                      <th className="px-4 py-3 font-semibold text-center">Pelanggaran</th>
                      <th className="px-4 py-3 font-semibold text-center w-24">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/40">
                    {sortedData.map((sesi: any, index: number) => (
                      <tr key={sesi.sesiId ?? sesi.siswa.id} className="hover:bg-surface-container-low/70 transition-colors">
                        <td className="px-4 py-4 text-center text-outline-variant font-medium">{index + 1}</td>
                        <td className="px-4 py-4">
                          <p className="font-semibold text-on-surface">{sesi.siswa.nama}</p>
                          <p className="text-xs text-on-surface-variant mt-0.5">NIS: {sesi.siswa.nis}</p>
                        </td>
                        <td className="px-4 py-4 text-on-surface-variant">{sesi.siswa.kelas?.nama || '-'}</td>
                        <td className="px-4 py-4">
                          <div className="flex flex-col items-center gap-1.5">
                            <span className={`inline-flex items-center justify-center min-w-[2.5rem] px-2 py-1 rounded-md font-bold text-sm ${getScoreColor(sesi.nilaiAkhir)}`}>
                              {sesi.nilaiAkhir !== null ? sesi.nilaiAkhir : '—'}
                            </span>
                            {sesi.nilaiAkhir !== null && (
                              <div className="w-full h-1.5 bg-surface-container rounded-full overflow-hidden max-w-[72px]">
                                <div
                                  className={`h-full rounded-full ${sesi.nilaiAkhir >= 75 ? 'bg-secondary-container/300' : sesi.nilaiAkhir >= 60 ? 'bg-tertiary-fixed/500' : 'bg-error-container0'}`}
                                  style={{ width: `${sesi.nilaiAkhir}%` }}
                                />
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className="flex flex-col items-center gap-1">
                            {statusBadge(sesi.status, sesi.submitReason)}
                            {sesi.selesaiAt && (
                              <p className="text-[10px] text-outline-variant uppercase">
                                {new Date(sesi.selesaiAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          {sesi.pelanggaran?.length > 0 ? (
                            <Badge variant="outline" className="text-error border-error/20 bg-error-container">
                              <AlertTriangle className="w-3 h-3 mr-1" /> {sesi.pelanggaran.length}x
                            </Badge>
                          ) : (
                            <span className="text-outline-variant">—</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className="flex gap-1 justify-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-primary bg-primary-container/15 hover:bg-primary-container/30 h-8"
                              onClick={() => handleOpenDetail(sesi.sesiId)}
                              disabled={!sesi.sesiId}
                            >
                              <Search className="w-4 h-4 mr-1" /> Detail
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-on-tertiary-fixed hover:bg-tertiary-fixed/50 h-8 px-2"
                              onClick={() => setResetTarget({
                                sesiId: sesi.sesiId,
                                nama: sesi.siswa.nama,
                                nis: sesi.siswa.nis,
                              })}
                              disabled={!sesi.sesiId}
                              title="Reset — siswa bisa kerjakan ulang"
                              aria-label={`Reset sesi ujian ${sesi.siswa.nama}`}
                            >
                              <RotateCcw className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {rekapData.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-10 text-center text-on-surface-variant">
                          Belum ada peserta yang mengikuti ujian ini.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Modal Konfirmasi Reset Sesi ──────────────────── */}
      {resetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-inverse-surface/50 backdrop-blur-sm">
          <div
            ref={resetModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-sesi-title"
            className="w-full max-w-md bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-xl animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="px-6 pt-6 pb-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-tertiary-fixed/50 flex items-center justify-center mb-3">
                <RotateCcw className="w-6 h-6 text-on-tertiary-fixed" />
              </div>
              <h2 id="reset-sesi-title" className="text-lg font-bold text-on-surface text-center">
                Reset Sesi Ujian?
              </h2>
              <p className="text-sm text-on-surface-variant text-center mt-1">
                <strong className="text-on-surface">{resetTarget.nama}</strong>
                <span className="text-outline-variant"> (NIS {resetTarget.nis})</span>
              </p>
              <div className="mt-4 text-xs text-on-tertiary-fixed bg-tertiary-fixed/50 border border-tertiary-fixed rounded-lg p-3">
                Jawaban, nilai, dan catatan pelanggaran siswa ini akan <strong>dihapus permanen</strong>. Siswa bisa mengerjakan ujian dari awal lagi.
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setResetTarget(null)}
                disabled={isResetting}
                className="flex-1"
              >
                Batal
              </Button>
              <Button
                type="button"
                onClick={handleResetSesi}
                disabled={isResetting}
                className="flex-1 bg-tertiary hover:bg-tertiary/90"
              >
                {isResetting ? 'Memproses...' : 'Ya, Reset'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
