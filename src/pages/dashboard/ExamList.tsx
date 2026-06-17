import { toast } from 'sonner';
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Select } from "../../components/ui/select";
import { Clock, BookOpen, AlertCircle, FileText, CheckCircle2, History, ChevronUp, ChevronDown } from "lucide-react";
import api from "../../lib/api";
import { formatDate } from "../../lib/utils";
import { useModalA11y } from "../../hooks/useModalA11y";

export default function ExamList() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'AKTIF' | 'RIWAYAT'>('AKTIF');
  const [ujianAktif, setUjianAktif] = useState<any[]>([]);
  const [riwayat, setRiwayat] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [startingUjianId, setStartingUjianId] = useState<string | null>(null);

  // Modal konfirmasi mulai
  const [confirmModal, setConfirmModal] = useState<any | null>(null);
  const confirmModalRef = useModalA11y<HTMLDivElement>(confirmModal !== null, () => setConfirmModal(null));

  // Riwayat filter + sort
  const [filterMapel, setFilterMapel] = useState<string>('');
  const [sortField, setSortField] = useState<'selesaiAt' | 'nilaiAkhir'>('selesaiAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  // Auto-refetch saat user balik ke tab — skenario: admin reset sesi
  // siswa di tab lain, atau siswa pindah app sebentar. Refresh otomatis
  // supaya status ujian (sudah selesai / belum) sinkron dgn server.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') fetchData();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      if (activeTab === 'AKTIF') {
        const res = await api.get('/api/siswa/ujian-aktif');
        setUjianAktif(res);
      } else {
        // Endpoint paginated — tab riwayat di ExamList lebih cocok "ringkasan",
        // halaman dedicated /riwayat punya pagination penuh.
        const res = await api.get('/api/siswa/hasil?limit=100');
        setRiwayat(res?.data ?? []);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMulaiUjian = async (ujianId: string) => {
    try {
      setStartingUjianId(ujianId);
      const res = await api.post(`/api/siswa/ujian/${ujianId}/mulai`);
      setConfirmModal(null);

      // Buka ujian di tab baru supaya dashboard siswa tetap utuh di tab asli.
      // Kalau popup di-block browser, fallback ke navigate biasa (tab yang sama).
      const examUrl = `/exam/${res.sessionId}`;
      const newTab = window.open(examUrl, '_blank', 'noopener,noreferrer');
      if (!newTab) {
        toast.warning('Tab baru di-block browser, lanjut di tab ini');
        navigate(examUrl);
      } else {
        toast.success('Ujian dibuka di tab baru. Selamat mengerjakan!');
      }
    } catch (err: any) {
      toast.error(err.message || 'Gagal memulai ujian');
    } finally {
      setStartingUjianId(null);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 75) return 'text-secondary font-bold bg-secondary-container/30';
    if (score >= 60) return 'text-on-tertiary-fixed font-bold bg-tertiary-fixed/50';
    return 'text-error font-bold bg-error-container';
  };

  const mapelList = Array.from(new Set(riwayat.map(s => s.ujian?.mataPelajaran).filter(Boolean))).sort();

  const handleSortRiwayat = (field: 'selesaiAt' | 'nilaiAkhir') => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const filteredRiwayat = riwayat
    .filter(s => !filterMapel || s.ujian?.mataPelajaran === filterMapel)
    .sort((a, b) => {
      const mul = sortDir === 'asc' ? 1 : -1;
      if (sortField === 'nilaiAkhir') {
        return ((a.nilaiAkhir ?? -1) - (b.nilaiAkhir ?? -1)) * mul;
      }
      return (new Date(a.selesaiAt || a.mulaiAt).getTime() - new Date(b.selesaiAt || b.mulaiAt).getTime()) * mul;
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-on-surface">Ujian Online</h1>
          <p className="text-on-surface-variant mt-1">Selesaikan ujian Anda tepat waktu.</p>
        </div>
      </div>

      <div className="flex border-b border-outline-variant gap-6">
        <button
          className={`pb-3 font-medium transition-colors border-b-2 ${activeTab === 'AKTIF' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}
          onClick={() => setActiveTab('AKTIF')}
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> Ujian Aktif
          </div>
        </button>
        <button
          className={`pb-3 font-medium transition-colors border-b-2 ${activeTab === 'RIWAYAT' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}
          onClick={() => setActiveTab('RIWAYAT')}
        >
          <div className="flex items-center gap-2">
            <History className="w-4 h-4" /> Riwayat Nilai
          </div>
        </button>
      </div>

      {isLoading ? (
         <div className="py-12 text-center text-on-surface-variant">Memuat data...</div>
      ) : activeTab === 'AKTIF' ? (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {ujianAktif.length === 0 ? (
            <div className="col-span-full py-16 flex flex-col items-center justify-center text-on-surface-variant border-2 border-dashed border-outline-variant rounded-xl">
               <CheckCircle2 className="w-12 h-12 text-outline-variant mb-3" />
               <p className="text-lg font-medium text-on-surface">Tidak ada ujian aktif</p>
               <p className="text-sm">Selamat bersantai! Belum ada ujian yang harus dikerjakan.</p>
            </div>
          ) : (
            ujianAktif.map(ujian => (
              <div key={ujian.id} className="bg-surface-container-lowest border border-outline-variant rounded-2xl hover:shadow-md transition-all flex flex-col shadow-[0px_4px_20px_rgba(0,0,0,0.03)]">
                <div className="p-6 flex-1 flex flex-col">
                  <div className="flex justify-between items-start mb-4">
                    <Badge variant="outline" className="text-[10px] uppercase font-medium">{ujian.tipeUjian.replace('_', ' ')}</Badge>
                    <span className="text-xs font-semibold text-error bg-error-container px-2 py-1 rounded-full">
                      Tutup: {formatDate(ujian.tanggalSelesai, 'datetime')}
                    </span>
                  </div>
                  <h3 className="font-bold text-lg text-on-surface mb-2 leading-tight">
                    {ujian.judul}
                  </h3>
                  <div className="space-y-2 mt-auto pt-4 text-sm text-on-surface-variant">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-outline-variant" />
                      {ujian.mataPelajaran}
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-outline-variant" />
                      Durasi: {ujian.durasi} menit
                    </div>
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-outline-variant" />
                      {ujian._count?.soal || 0} Soal
                    </div>
                  </div>
                  <div className="mt-6 pt-4 border-t border-outline-variant">
                    <Button className="w-full bg-primary hover:bg-primary/90" onClick={() => setConfirmModal(ujian)}>
                      Mulai Ujian
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant overflow-hidden shadow-[0px_4px_20px_rgba(0,0,0,0.03)]">
          {riwayat.length > 0 && (
            <div className="px-6 py-3 border-b border-outline-variant flex items-center gap-3">
              <span className="text-sm text-on-surface-variant shrink-0">Filter:</span>
              <Select
                value={filterMapel}
                onChange={e => setFilterMapel(e.target.value)}
                className="h-8 text-sm w-52"
              >
                <option value="">Semua Mata Pelajaran</option>
                {mapelList.map(m => <option key={m} value={m}>{m}</option>)}
              </Select>
              {filterMapel && (
                <button onClick={() => setFilterMapel('')} className="text-xs text-primary hover:underline">Reset</button>
              )}
            </div>
          )}
          <div>
            {riwayat.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-on-surface-variant rounded-xl">
                <History className="w-12 h-12 text-outline-variant mb-3" />
                <p className="text-lg font-medium text-on-surface">Belum ada riwayat</p>
                <p className="text-sm">Anda belum mengerjakan ujian apapun.</p>
              </div>
            ) : filteredRiwayat.length === 0 ? (
              <div className="py-10 text-center text-on-surface-variant text-sm">
                Tidak ada ujian untuk mata pelajaran ini.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="border-b border-outline-variant">
                      <th
                        className="px-5 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider cursor-pointer select-none hover:bg-surface-container-low"
                        onClick={() => handleSortRiwayat('selesaiAt')}
                      >
                        <span className="inline-flex items-center gap-1">
                          Tanggal
                          {sortField === 'selesaiAt'
                            ? sortDir === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
                            : <ChevronUp className="w-3.5 h-3.5 opacity-20" />}
                        </span>
                      </th>
                      <th className="px-5 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Ujian</th>
                      <th className="px-5 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Mata Pelajaran</th>
                      <th className="px-5 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider text-center">Status</th>
                      <th
                        className="px-5 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider text-center cursor-pointer select-none hover:bg-surface-container-low"
                        onClick={() => handleSortRiwayat('nilaiAkhir')}
                      >
                        <span className="inline-flex items-center justify-center gap-1">
                          Nilai
                          {sortField === 'nilaiAkhir'
                            ? sortDir === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
                            : <ChevronUp className="w-3.5 h-3.5 opacity-20" />}
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/40">
                    {filteredRiwayat.map(sesi => (
                      <tr
                        key={sesi.id}
                        className="hover:bg-primary-container/15/40 transition-colors cursor-pointer"
                        onClick={() => navigate(`/dashboard/siswa/hasil/${sesi.id}`)}
                        title="Klik untuk lihat detail"
                      >
                        <td className="px-4 py-3 text-on-surface-variant whitespace-nowrap">
                          {formatDate(sesi.selesaiAt || sesi.mulaiAt)}
                        </td>
                        <td className="px-4 py-3 font-medium text-on-surface">
                          {sesi.ujian?.judul}
                        </td>
                        <td className="px-4 py-3 text-on-surface-variant">
                          {sesi.ujian?.mataPelajaran}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge
                            variant="outline"
                            className={
                              sesi.status === 'SELESAI' ? 'border-secondary/30 text-on-secondary-container bg-secondary-container/30' :
                              sesi.status === 'AUTO_SUBMIT' ? 'border-error/20 text-error bg-error-container' : ''
                            }
                          >
                            {sesi.status === 'SELESAI' ? 'Selesai' :
                             sesi.status === 'AUTO_SUBMIT' ? 'Auto-Submit' : sesi.status}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {sesi.nilaiAkhir !== null ? (
                            <span className={`inline-flex items-center justify-center min-w-[3rem] px-2 py-1 rounded-md ${getScoreColor(sesi.nilaiAkhir)}`}>
                              {sesi.nilaiAkhir}
                            </span>
                          ) : (
                            <span className="text-outline-variant">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Mulai Ujian */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-inverse-surface/50 backdrop-blur-sm">
          <div
            ref={confirmModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="mulai-ujian-title"
            className="w-full max-w-md bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="px-6 py-5 bg-primary-container/15 border-b border-primary/20">
              <h2 id="mulai-ujian-title" className="text-xl font-semibold text-on-surface">Mulai Ujian?</h2>
              <p className="text-sm text-on-surface-variant mt-0.5">Perhatikan peraturan sebelum memulai ujian.</p>
            </div>
            <div className="px-6 pt-6 pb-4 space-y-4">
              <div className="font-semibold text-on-surface text-lg">{confirmModal.judul}</div>
              <ul className="text-sm text-on-surface-variant space-y-2 list-disc pl-5">
                <li>Durasi ujian adalah <b>{confirmModal.durasi} menit</b>. Waktu tidak akan berhenti meskipun Anda keluar dari browser.</li>
                <li>Sistem dilengkapi dengan <b>Anti-Cheat</b>. Keluar dari fullscreen atau pindah tab akan tercatat sebagai pelanggaran.</li>
                <li>Setelah 3x pelanggaran, ujian akan <b>otomatis diakhiri</b>.</li>
                <li>Pastikan koneksi internet Anda stabil sebelum memulai.</li>
              </ul>
              <div className="bg-tertiary-fixed/50 text-on-tertiary-fixed p-3 rounded-lg text-sm border border-tertiary-fixed mt-4 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Ujian yang sudah dimulai tidak bisa dibatalkan atau diulangi.</span>
              </div>
            </div>
            <div className="px-6 py-4 bg-surface-container-low border-t border-outline-variant flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setConfirmModal(null)} disabled={startingUjianId !== null}>Batal</Button>
              <Button onClick={() => handleMulaiUjian(confirmModal.id)} disabled={startingUjianId === confirmModal.id} className="gap-2">
                {startingUjianId === confirmModal.id ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Menyiapkan...
                  </>
                ) : (
                  'Mulai Sekarang'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
