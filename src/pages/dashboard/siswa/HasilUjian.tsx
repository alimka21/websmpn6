import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle2, XCircle, Clock, AlertTriangle, ArrowLeft, ShieldAlert, ChevronDown, ChevronUp, MinusCircle } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import api from '../../../lib/api';

interface Pelanggaran {
  tipe: string;
  pesan: string;
  timestamp: string;
}

interface JawabanItem {
  nomor: number;
  teks: string;
  tipe: string;
  opsiDipilih: { teks: string } | null;
  opsiBenar: { teks: string } | null;
  // Untuk PG_KOMPLEKS — list opsi (single-select tetap pakai opsiDipilih/opsiBenar di atas)
  opsiDipilihList?: { teks: string }[];
  opsiBenarList?: { teks: string }[];
  isBenar: boolean;
  tidakDijawab: boolean;
}

interface HasilData {
  id: string;
  status: string;
  nilaiAkhir: number;
  submitReason: string;
  mulaiAt: string;
  selesaiAt: string;
  jumlahBenar: number;
  totalSoal: number;
  siswa: { nama: string };
  ujian: { judul: string; mataPelajaran: string; durasi: number; tampilkanPembahasan?: boolean; tampilkanNilai?: boolean };
  pelanggaran: Pelanggaran[];
  jawaban: JawabanItem[];
}

function formatDurasi(mulaiAt: string, selesaiAt: string, maksMenit?: number): string {
  let diff = Math.floor((new Date(selesaiAt).getTime() - new Date(mulaiAt).getTime()) / 1000);
  // Cap ke durasi maks ujian — kalau wall-clock melebihi (mis. siswa idle/abandon),
  // pakai durasi resmi ujian. Lebih masuk akal daripada angka jam-jaman.
  if (typeof maksMenit === 'number' && diff > maksMenit * 60) {
    diff = maksMenit * 60;
  }
  const menit = Math.floor(diff / 60);
  const detik = diff % 60;
  if (menit === 0) return `${detik} detik`;
  return `${menit} menit ${detik > 0 ? `${detik} detik` : ''}`.trim();
}

function formatWaktu(iso: string): string {
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function labelTipe(tipe: string): string {
  const map: Record<string, string> = {
    TAB_SWITCH: 'Berpindah Tab',
    FULLSCREEN_EXIT: 'Keluar Layar Penuh',
    WINDOW_BLUR: 'Aplikasi Kehilangan Fokus',
    DEVTOOLS: 'Membuka Developer Tools',
  };
  return map[tipe] ?? tipe;
}

function labelSubmit(reason: string, status: string): { teks: string; variant: 'default' | 'destructive' | 'outline' } {
  if (status === 'AUTO_SUBMIT') return { teks: 'Auto-submit (Pelanggaran)', variant: 'destructive' };
  if (reason === 'timeout') return { teks: 'Waktu Habis', variant: 'outline' };
  return { teks: 'Selesai Manual', variant: 'default' };
}

export default function HasilUjian() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<HasilData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    api.get(`/api/siswa/sesi/${sessionId}/hasil`)
      .then(setData)
      .catch((err: any) => setError(err?.message ?? 'Gagal memuat hasil ujian.'));
  }, [sessionId]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <XCircle className="w-12 h-12 text-error" />
        <p className="text-on-surface-variant">{error}</p>
        <Button variant="outline" onClick={() => navigate('/dashboard/siswa')}>
          Kembali ke Dashboard
        </Button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const nilai = data.nilaiAkhir ?? 0;
  const nilaiDisplay = Math.round(nilai * 100) / 100;

  const scoreColor =
    nilai >= 75 ? 'text-secondary' :
    nilai >= 60 ? 'text-tertiary' :
    'text-error';

  const scoreBg =
    nilai >= 75 ? 'bg-secondary-container/30 border-secondary/20' :
    nilai >= 60 ? 'bg-tertiary-fixed/50 border-tertiary-fixed' :
    'bg-error-container border-error/20';

  const scoreLabel =
    nilai >= 75 ? 'Lulus' :
    nilai >= 60 ? 'Cukup' :
    'Belum Lulus';

  const submitInfo = labelSubmit(data.submitReason, data.status);
  const tidakDijawabCount = data.jawaban?.filter(j => j.tidakDijawab).length ?? 0;

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">

      {/* Header */}
      <div>
        <button
          onClick={() => navigate('/dashboard/siswa')}
          className="flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-on-surface transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali ke Dashboard
        </button>
        <h1 className="text-2xl font-bold text-on-surface">{data.ujian.judul}</h1>
        <p className="text-on-surface-variant mt-0.5">{data.ujian.mataPelajaran}</p>
      </div>

      {/* Skor utama — selalu tampilkan (per kebijakan user) */}
      <div className={`rounded-2xl border p-8 text-center ${scoreBg}`}>
        <p className="text-sm font-medium text-on-surface-variant uppercase tracking-widest mb-2">Nilai Anda</p>
        <p className={`text-5xl sm:text-6xl md:text-7xl font-extrabold tabular-nums ${scoreColor}`}>{nilaiDisplay}</p>
        <span className={`inline-block mt-3 text-sm font-semibold px-3 py-1 rounded-full ${
          nilai >= 75 ? 'bg-secondary-container/60 text-on-secondary-container' :
          nilai >= 60 ? 'bg-tertiary-fixed/70 text-on-tertiary-fixed' :
          'bg-error-container text-error'
        }`}>
          {scoreLabel}
        </span>
      </div>

      {/* Statistik */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-4 flex items-center gap-3">
          <CheckCircle2 className="w-8 h-8 text-secondary shrink-0" />
          <div>
            <p className="text-xs text-on-surface-variant">Jawaban Benar</p>
            <p className="text-xl font-bold text-on-surface">
              {data.jumlahBenar}
              <span className="text-sm font-normal text-outline-variant"> / {data.totalSoal}</span>
            </p>
          </div>
        </div>

        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-4 flex items-center gap-3">
          <Clock className="w-8 h-8 text-primary shrink-0" />
          <div>
            <p className="text-xs text-on-surface-variant">Durasi Pengerjaan</p>
            <p className="text-lg font-bold text-on-surface">
              {data.mulaiAt && data.selesaiAt
                ? formatDurasi(data.mulaiAt, data.selesaiAt, data.ujian.durasi)
                : `${data.ujian.durasi} menit`}
            </p>
            <p className="text-[10px] text-outline-variant mt-0.5">Maks: {data.ujian.durasi} menit</p>
          </div>
        </div>
      </div>

      {/* Status Submit */}
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-4 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs text-on-surface-variant mb-1">Status Ujian</p>
          <Badge variant={submitInfo.variant}>{submitInfo.teks}</Badge>
        </div>
        {data.mulaiAt && (
          <div className="text-right">
            <p className="text-xs text-on-surface-variant mb-1">Waktu Mulai</p>
            <p className="text-sm font-medium text-on-surface">{formatWaktu(data.mulaiAt)}</p>
          </div>
        )}
        {data.selesaiAt && (
          <div className="text-right">
            <p className="text-xs text-on-surface-variant mb-1">Waktu Selesai</p>
            <p className="text-sm font-medium text-on-surface">{formatWaktu(data.selesaiAt)}</p>
          </div>
        )}
      </div>

      {/* Pelanggaran */}
      {data.pelanggaran.length > 0 && (
        <div className="bg-surface-container-lowest rounded-xl border border-tertiary-fixed p-4 space-y-3">
          <div className="flex items-center gap-2 text-on-tertiary-fixed">
            <ShieldAlert className="w-5 h-5" />
            <p className="font-semibold text-sm">
              Catatan Pelanggaran ({data.pelanggaran.length})
            </p>
          </div>
          <ul className="space-y-2">
            {data.pelanggaran.map((p, i) => (
              <li key={i} className="flex items-start justify-between gap-2 text-sm">
                <span className="flex items-center gap-1.5 text-on-surface">
                  <AlertTriangle className="w-3.5 h-3.5 text-tertiary shrink-0 mt-0.5" />
                  {labelTipe(p.tipe)}
                </span>
                <span className="text-outline-variant shrink-0">{formatWaktu(p.timestamp)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Review Jawaban (collapsible) — selalu tampilkan (per kebijakan user) */}
      {data.jawaban && data.jawaban.length > 0 && (
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-surface-container-low transition-colors"
            onClick={() => setReviewOpen(o => !o)}
          >
            <div className="flex items-center gap-2">
              <span className="font-semibold text-on-surface">Review Jawaban</span>
              <span className="text-xs text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full">
                {data.jumlahBenar} benar · {data.totalSoal - data.jumlahBenar - tidakDijawabCount} salah · {tidakDijawabCount} kosong
              </span>
            </div>
            {reviewOpen
              ? <ChevronUp className="w-5 h-5 text-outline-variant" />
              : <ChevronDown className="w-5 h-5 text-outline-variant" />
            }
          </button>

          {reviewOpen && (
            <div className="border-t border-outline-variant divide-y divide-outline-variant/40">
              {data.jawaban.map((item) => (
                <div
                  key={item.nomor}
                  className={`px-5 py-4 flex gap-4 items-start ${
                    item.tidakDijawab ? 'bg-surface-container-low/50' :
                    item.isBenar ? 'bg-secondary-container/30/40' : 'bg-error-container/40'
                  }`}
                >
                  {/* Nomor + ikon */}
                  <div className="flex flex-col items-center gap-1.5 shrink-0 pt-0.5">
                    <span className="w-7 h-7 rounded-full bg-surface-container-high text-on-surface text-xs font-bold flex items-center justify-center">
                      {item.nomor}
                    </span>
                    {item.tidakDijawab
                      ? <MinusCircle className="w-4 h-4 text-outline-variant" />
                      : item.isBenar
                        ? <CheckCircle2 className="w-4 h-4 text-secondary" />
                        : <XCircle className="w-4 h-4 text-error" />
                    }
                  </div>

                  {/* Konten */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-on-surface leading-snug mb-2">{item.teks}</p>
                    <div className="space-y-1 text-xs">
                      {(() => {
                        const isMulti = item.tipe === 'PG_KOMPLEKS';
                        const dipilihTeks = isMulti
                          ? (item.opsiDipilihList || []).map(o => o.teks)
                          : (item.opsiDipilih ? [item.opsiDipilih.teks] : []);
                        const benarTeks = isMulti
                          ? (item.opsiBenarList || []).map(o => o.teks)
                          : (item.opsiBenar ? [item.opsiBenar.teks] : []);
                        return (
                          <>
                            <div className="flex items-baseline gap-1.5">
                              <span className="text-on-surface-variant shrink-0 w-28">Jawaban kamu:</span>
                              {item.tidakDijawab ? (
                                <span className="italic text-outline-variant">Tidak dijawab</span>
                              ) : (
                                <span className={`font-medium ${item.isBenar ? 'text-on-secondary-container' : 'text-error'}`}>
                                  {dipilihTeks.length > 0 ? dipilihTeks.join(', ') : '—'}
                                </span>
                              )}
                            </div>
                            {!item.isBenar && (
                              <div className="flex items-baseline gap-1.5">
                                <span className="text-on-surface-variant shrink-0 w-28">Jawaban benar:</span>
                                <span className="font-medium text-on-secondary-container">
                                  {benarTeks.length > 0 ? benarTeks.join(', ') : '—'}
                                </span>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CTA */}
      <Button className="w-full" onClick={() => navigate('/dashboard/siswa')}>
        Kembali ke Dashboard
      </Button>
    </div>
  );
}
