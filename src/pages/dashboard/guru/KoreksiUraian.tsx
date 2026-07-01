import { toast } from 'sonner';
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, CheckCircle2, Clock, AlertTriangle, Save,
  ChevronDown, ChevronUp, Sparkles, ThumbsUp,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Input, Label } from '../../../components/ui/input';
import api from '../../../lib/api';
import { formatDate } from '../../../lib/utils';
import { ErrorState } from '../../../components/ui/ErrorState';

interface SoalInfo {
  id: string;
  nomor: number;
  tipe: string;
  teks: string;
  poin: number;
}

interface JawabanUraian {
  jawabanId: string | null;
  soalId: string;
  nomor: number;
  tipe: string;
  poin: number;
  jawabanTeks: string | null;
  nilaiUraian: number | null;
  catatanGuru: string | null;
}

interface SesiKoreksi {
  sesiId: string;
  siswa: { id: string; nama: string; nis: string; kelas: { nama: string } };
  nilaiAkhir: number | null;
  selesaiAt: string | null;
  sudahDinilai: boolean;
  jawaban: JawabanUraian[];
}

interface NilaiDraft {
  nilaiUraian: string;
  catatanGuru: string;
}

interface AiSuggestion {
  nilai: number;
  alasan: string;
}

export default function KoreksiUraian() {
  const { id: ujianId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [ujianJudul, setUjianJudul] = useState('');
  const [soalList, setSoalList] = useState<SoalInfo[]>([]);
  const [sesiList, setSesiList] = useState<SesiKoreksi[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Draft penilaian: Record<sesiId, Record<jawabanId, NilaiDraft>>
  const [drafts, setDrafts] = useState<Record<string, Record<string, NilaiDraft>>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Gemini AI
  const [hasGeminiKey, setHasGeminiKey] = useState(false);
  const [aiLoading, setAiLoading] = useState<string | null>(null); // sesiId
  // Record<sesiId, Record<jawabanId, AiSuggestion>>
  const [aiSuggestions, setAiSuggestions] = useState<Record<string, Record<string, AiSuggestion>>>({});

  const fetchData = async () => {
    try {
      setIsLoading(true);
      setErrorMsg(null);
      const [koreksiRes, ujianRes] = await Promise.all([
        api.get(`/api/guru/ujian/${ujianId}/koreksi`),
        api.get(`/api/guru/ujian/${ujianId}`),
      ]);
      setSoalList(koreksiRes.soal || []);
      setSesiList(koreksiRes.sesi || []);
      // Cek apakah guru punya API key di DB
      api.get('/api/guru/profile').then((p: any) => setHasGeminiKey(!!p.hasGeminiKey)).catch(() => {});
      setUjianJudul(ujianRes.judul || '');

      const initDrafts: Record<string, Record<string, NilaiDraft>> = {};
      for (const sesi of (koreksiRes.sesi || []) as SesiKoreksi[]) {
        initDrafts[sesi.sesiId] = {};
        for (const jwb of sesi.jawaban) {
          if (jwb.jawabanId) {
            initDrafts[sesi.sesiId][jwb.jawabanId] = {
              nilaiUraian: jwb.nilaiUraian != null ? String(jwb.nilaiUraian) : '',
              catatanGuru: jwb.catatanGuru || '',
            };
          }
        }
      }
      setDrafts(initDrafts);

      const firstBelum = (koreksiRes.sesi || []).find((s: SesiKoreksi) => !s.sudahDinilai);
      if (firstBelum) setExpandedId(firstBelum.sesiId);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal memuat data koreksi');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [ujianId]);

  const handleDraftChange = (sesiId: string, jawabanId: string, field: keyof NilaiDraft, value: string) => {
    setDrafts(prev => ({
      ...prev,
      [sesiId]: {
        ...prev[sesiId],
        [jawabanId]: { ...prev[sesiId]?.[jawabanId], [field]: value },
      },
    }));
  };

  const handleSimpan = async (sesi: SesiKoreksi) => {
    const sesiDraft = drafts[sesi.sesiId] || {};
    const penilaian = [];
    for (const jwb of sesi.jawaban) {
      if (!jwb.jawabanId) {
        toast.error(`Siswa belum menjawab soal No. ${jwb.nomor}`);
        return;
      }
      const d = sesiDraft[jwb.jawabanId];
      const nilai = Number(d?.nilaiUraian);
      if (!d?.nilaiUraian || isNaN(nilai) || nilai < 1 || nilai > 10) {
        toast.error(`Nilai soal No. ${jwb.nomor} harus antara 1 dan 10`);
        return;
      }
      penilaian.push({ jawabanId: jwb.jawabanId, nilaiUraian: nilai, catatanGuru: d.catatanGuru || undefined });
    }

    try {
      setSavingId(sesi.sesiId);
      const res = await api.post(`/api/guru/ujian/${ujianId}/koreksi/sesi/${sesi.sesiId}`, { penilaian });
      toast.success(`Penilaian ${sesi.siswa.nama} disimpan — Nilai: ${res.nilaiAkhir?.toFixed(1)}`);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Gagal menyimpan penilaian');
    } finally {
      setSavingId(null);
    }
  };

  // ── Gemini AI ─────────────────────────────────────────────────

  const handleAiKoreksi = async (sesi: SesiKoreksi) => {
    if (!hasGeminiKey) {
      toast.error('API Key Gemini belum diatur. Hubungi admin untuk mengaturnya di database.');
      return;
    }

    const soalInput = sesi.jawaban
      .filter(j => j.jawabanId && j.jawabanTeks)
      .map(j => {
        const soal = soalList.find(s => s.id === j.soalId);
        return {
          soalId: j.soalId,
          nomor: j.nomor,
          pertanyaan: soal?.teks || '',
          tipe: j.tipe,
          jawabanSiswa: j.jawabanTeks!,
        };
      });

    if (soalInput.length === 0) {
      toast.error('Tidak ada jawaban yang bisa dinilai AI');
      return;
    }

    try {
      setAiLoading(sesi.sesiId);
      const res = await api.post(
        `/api/guru/ujian/${ujianId}/koreksi/sesi/${sesi.sesiId}/ai-grade`,
        { soalList: soalInput },
      );

      const suggestions: Record<string, AiSuggestion> = {};
      for (const r of (res.results as any[])) {
        const jwb = sesi.jawaban.find(j => j.soalId === r.soalId);
        if (jwb?.jawabanId) {
          suggestions[jwb.jawabanId] = { nilai: r.nilai, alasan: r.alasan };
        }
      }

      setAiSuggestions(prev => ({ ...prev, [sesi.sesiId]: suggestions }));
      toast.success('AI selesai — periksa saran dan konfirmasi sebelum menyimpan');
    } catch (err: any) {
      toast.error(err.message || 'Gagal menghubungi Gemini AI');
    } finally {
      setAiLoading(null);
    }
  };

  const applyOneSuggestion = (sesiId: string, jawabanId: string) => {
    const sug = aiSuggestions[sesiId]?.[jawabanId];
    if (!sug) return;
    handleDraftChange(sesiId, jawabanId, 'nilaiUraian', String(sug.nilai));
    handleDraftChange(sesiId, jawabanId, 'catatanGuru',
      drafts[sesiId]?.[jawabanId]?.catatanGuru || `[AI] ${sug.alasan}`);
  };

  const applyAllSuggestions = (sesiId: string) => {
    const sesiSugs = aiSuggestions[sesiId];
    if (!sesiSugs) return;
    for (const [jawabanId, sug] of Object.entries(sesiSugs)) {
      handleDraftChange(sesiId, jawabanId, 'nilaiUraian', String(sug.nilai));
      if (!drafts[sesiId]?.[jawabanId]?.catatanGuru) {
        handleDraftChange(sesiId, jawabanId, 'catatanGuru', `[AI] ${sug.alasan}`);
      }
    }
    toast.info('Semua saran AI diterapkan — periksa dan simpan penilaian');
  };

  // ─────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-blue-600 rounded-full animate-spin" />
        <p className="text-sm text-on-surface-variant">Memuat data koreksi...</p>
      </div>
    );
  }

  if (errorMsg) {
    return <ErrorState message={errorMsg} onRetry={fetchData} />;
  }

  const totalSesi = sesiList.length;
  const sudahDinilai = sesiList.filter(s => s.sudahDinilai).length;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/dashboard/guru/ujian`)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="text-sm text-on-surface-variant font-medium">
            <span className="hover:text-on-surface cursor-pointer" onClick={() => navigate('/dashboard/guru/ujian')}>Ujian</span>
            <span className="mx-1.5">/</span>
            <span className="text-on-surface">{ujianJudul}</span>
          </div>
          <h1 className="text-2xl font-bold text-on-surface tracking-tight mt-1">Koreksi Uraian & Esai</h1>
        </div>
        {hasGeminiKey && (
          <span className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-secondary-container/30 border border-secondary/30 text-secondary">
            <Sparkles className="w-3.5 h-3.5" /> AI Aktif
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant p-5 shadow-[0px_4px_20px_rgba(0,0,0,0.03)]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-on-surface">Progress Penilaian</span>
          <span className="text-sm text-on-surface-variant">{sudahDinilai} / {totalSesi} siswa dinilai</span>
        </div>
        <div className="h-2 bg-surface-container rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: totalSesi > 0 ? `${(sudahDinilai / totalSesi) * 100}%` : '0%' }}
          />
        </div>
        {sudahDinilai === totalSesi && totalSesi > 0 && (
          <p className="text-sm text-secondary font-medium mt-2 flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4" /> Semua siswa sudah dinilai
          </p>
        )}
        {/* AI hint banner jika key belum diset */}
        {!hasGeminiKey && totalSesi > 0 && (
          <div className="mt-3 pt-3 border-t border-outline-variant flex items-center gap-2 text-xs text-on-surface-variant">
            <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span>Fitur Nilai dengan AI belum aktif — minta admin untuk menambahkan API Key Gemini di akun Anda.</span>
          </div>
        )}
      </div>

      {sesiList.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant overflow-hidden shadow-[0px_4px_20px_rgba(0,0,0,0.03)]">
          <div className="py-16 flex flex-col items-center text-center text-on-surface-variant gap-3">
            <Clock className="w-12 h-12 text-outline-variant" />
            <p className="font-medium text-on-surface">Belum ada siswa yang submit</p>
            <p className="text-sm">Halaman ini akan tampil setelah siswa menyelesaikan ujian.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {sesiList.map(sesi => {
            const isExpanded = expandedId === sesi.sesiId;
            const sesiDraft = drafts[sesi.sesiId] || {};
            const isSaving = savingId === sesi.sesiId;
            const isAiLoading = aiLoading === sesi.sesiId;
            const sesiSuggestions = aiSuggestions[sesi.sesiId] || {};
            const hasSuggestions = Object.keys(sesiSuggestions).length > 0;

            return (
              <div
                key={sesi.sesiId}
                className={`bg-surface-container-lowest rounded-2xl border overflow-hidden shadow-[0px_4px_20px_rgba(0,0,0,0.03)] ${
                  sesi.sudahDinilai ? 'border-secondary/30' : 'border-outline-variant'
                }`}
              >
                {/* Row header */}
                <button
                  type="button"
                  className="w-full text-left px-5 py-4 flex items-center justify-between gap-3 hover:bg-surface-container-low/50 transition-colors rounded-t-xl"
                  onClick={() => setExpandedId(isExpanded ? null : sesi.sesiId)}
                  aria-expanded={isExpanded}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {sesi.sudahDinilai
                      ? <CheckCircle2 className="w-5 h-5 text-secondary shrink-0" />
                      : <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />}
                    <div className="min-w-0">
                      <p className="font-semibold text-on-surface truncate">{sesi.siswa.nama}</p>
                      <p className="text-xs text-on-surface-variant">{sesi.siswa.nis} &bull; {sesi.siswa.kelas?.nama}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {hasSuggestions && !sesi.sudahDinilai && (
                      <span className="hidden sm:flex items-center gap-1 text-[11px] font-medium text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                        <Sparkles className="w-3 h-3" /> Saran AI tersedia
                      </span>
                    )}
                    {sesi.sudahDinilai ? (
                      <Badge variant="secondary" className="bg-secondary-container text-secondary text-xs">
                        Nilai: {sesi.nilaiAkhir?.toFixed(1)}
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">Belum Dinilai</Badge>
                    )}
                    <span className="text-xs text-on-surface-variant">{sesi.selesaiAt ? formatDate(sesi.selesaiAt) : '—'}</span>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-on-surface-variant" /> : <ChevronDown className="w-4 h-4 text-on-surface-variant" />}
                  </div>
                </button>

                {/* Detail penilaian */}
                {isExpanded && (
                  <div className="border-t border-outline-variant px-5 py-5 space-y-6">

                    {/* Nilai dengan AI bar */}
                    <div className="flex items-center justify-between gap-3 bg-surface-container rounded-xl px-4 py-3">
                      <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span>
                          {!hasGeminiKey
                            ? 'Fitur AI belum aktif — minta admin untuk menambahkan API Key Gemini.'
                            : hasSuggestions
                              ? 'Saran AI sudah tersedia di bawah. Periksa, edit jika perlu, lalu klik Simpan.'
                              : 'AI akan menganalisis semua jawaban siswa ini dan memberi saran nilai 1–10.'
                          }
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {hasSuggestions && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2.5 text-xs gap-1 bg-white text-secondary border-secondary/30"
                            onClick={() => applyAllSuggestions(sesi.sesiId)}
                          >
                            <ThumbsUp className="w-3 h-3" /> Terapkan Semua
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isAiLoading}
                          className="h-7 px-3 text-xs gap-1.5 bg-white"
                          onClick={() => handleAiKoreksi(sesi)}
                        >
                          {isAiLoading ? (
                            <div className="w-3 h-3 border-2 border-outline/40 border-t-amber-500 rounded-full animate-spin" />
                          ) : (
                            <Sparkles className="w-3 h-3 text-amber-500" />
                          )}
                          {isAiLoading ? 'Menilai...' : hasSuggestions ? 'Nilai Ulang' : 'Nilai dengan AI'}
                        </Button>
                      </div>
                    </div>

                    {/* Soal per item */}
                    {sesi.jawaban.map((jwb, idx) => {
                      const draft = jwb.jawabanId ? sesiDraft[jwb.jawabanId] : null;
                      const aiSug = jwb.jawabanId ? sesiSuggestions[jwb.jawabanId] : null;

                      return (
                        <div key={jwb.soalId} className="space-y-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-on-surface">Soal No. {jwb.nomor}</span>
                            <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-700 border-amber-200">
                              {jwb.tipe === 'URAIAN_SINGKAT' ? 'Uraian Singkat' : 'Esai'}
                            </Badge>
                            <span className="text-xs text-on-surface-variant ml-auto">Bobot: {jwb.poin} poin</span>
                          </div>

                          {/* Teks pertanyaan */}
                          {soalList.find(s => s.id === jwb.soalId)?.teks && (
                            <div className="bg-primary/5 border border-primary/10 rounded-lg px-4 py-2.5">
                              <p className="text-[11px] text-primary/70 font-medium mb-1">Pertanyaan:</p>
                              <p className="text-sm text-on-surface">{soalList.find(s => s.id === jwb.soalId)?.teks}</p>
                            </div>
                          )}

                          {/* Jawaban siswa */}
                          <div className="bg-surface-container-low rounded-lg p-4">
                            <p className="text-xs text-on-surface-variant mb-1">Jawaban Siswa:</p>
                            {jwb.jawabanTeks ? (
                              <p className="text-sm text-on-surface whitespace-pre-wrap">{jwb.jawabanTeks}</p>
                            ) : (
                              <p className="text-sm text-error italic">Tidak menjawab</p>
                            )}
                          </div>

                          {/* AI Suggestion chip */}
                          {aiSug && jwb.jawabanId && (
                            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                              <Sparkles className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-amber-700 mb-0.5">
                                  Saran AI: Nilai {aiSug.nilai}/10
                                </p>
                                <p className="text-xs text-amber-800 leading-relaxed">{aiSug.alasan}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => applyOneSuggestion(sesi.sesiId, jwb.jawabanId!)}
                                className="shrink-0 text-xs font-semibold text-amber-700 hover:text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-md px-2.5 py-1 transition-colors"
                              >
                                Terapkan
                              </button>
                            </div>
                          )}

                          {/* Input nilai */}
                          {jwb.jawabanId && draft ? (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
                              <div className="space-y-1">
                                <Label htmlFor={`nilai-${jwb.jawabanId}`} className="text-xs">
                                  Nilai <span className="text-on-surface-variant">(1 – 10)</span> <span className="text-error">*</span>
                                </Label>
                                <Input
                                  id={`nilai-${jwb.jawabanId}`}
                                  type="number"
                                  min={1}
                                  max={10}
                                  step={1}
                                  value={draft.nilaiUraian}
                                  onChange={e => handleDraftChange(sesi.sesiId, jwb.jawabanId!, 'nilaiUraian', e.target.value)}
                                  className="text-center font-bold text-lg"
                                />
                                {draft.nilaiUraian && (
                                  <p className="text-xs text-on-surface-variant text-center">
                                    = {((Number(draft.nilaiUraian) / 10) * jwb.poin).toFixed(1)} / {jwb.poin} poin
                                    &nbsp;({Math.round((Number(draft.nilaiUraian) / 10) * 100)}%)
                                  </p>
                                )}
                              </div>
                              <div className="space-y-1 sm:col-span-2">
                                <Label htmlFor={`catatan-${jwb.jawabanId}`} className="text-xs">
                                  Catatan <span className="text-on-surface-variant">(opsional)</span>
                                </Label>
                                <textarea
                                  id={`catatan-${jwb.jawabanId}`}
                                  value={draft.catatanGuru}
                                  onChange={e => handleDraftChange(sesi.sesiId, jwb.jawabanId!, 'catatanGuru', e.target.value)}
                                  className="w-full min-h-[72px] p-3 rounded-md border border-outline-variant bg-transparent text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-600 resize-y"
                                  placeholder="Catatan atau koreksi untuk siswa..."
                                />
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-on-surface-variant italic">Siswa tidak menjawab soal ini — tidak dapat dinilai.</p>
                          )}

                          {idx < sesi.jawaban.length - 1 && (
                            <div className="border-b border-outline-variant pt-2" />
                          )}
                        </div>
                      );
                    })}

                    {/* Rekap + Simpan */}
                    <div className="flex items-center justify-between pt-4 border-t border-outline-variant gap-4 flex-wrap">
                      <div className="text-sm text-on-surface-variant">
                        {sesi.jawaban.every(j => {
                          if (!j.jawabanId) return false;
                          const d = sesiDraft[j.jawabanId];
                          const n = Number(d?.nilaiUraian);
                          return d?.nilaiUraian && !isNaN(n) && n >= 1 && n <= 10;
                        }) ? (
                          <span className="text-secondary font-medium flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4" /> Semua soal sudah diberi nilai
                          </span>
                        ) : (
                          <span className="text-amber-600 flex items-center gap-1">
                            <AlertTriangle className="w-4 h-4" /> Isi nilai 1–10 untuk semua soal
                          </span>
                        )}
                      </div>
                      <Button onClick={() => handleSimpan(sesi)} disabled={isSaving} className="gap-2 min-w-[140px]">
                        {isSaving ? (
                          <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                        {isSaving ? 'Menyimpan...' : 'Simpan Penilaian'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
