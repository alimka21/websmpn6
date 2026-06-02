import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { BookOpen, ChevronDown, ChevronRight, ArrowLeft, FileText, PenLine } from 'lucide-react';
import api from '../../../lib/api';
import { ErrorState } from '../../../components/ui/ErrorState';

interface SesiItem {
  sesiId: string;
  ujianJudul: string;
  tipeUjian: string;
  nilaiAkhir: number | null;
  selesaiAt: string | null;
  adaUraian: boolean;
}

interface MapelGroup {
  mataPelajaran: string;
  rataRata: number | null;
  jumlahUjian: number;
  ujian: SesiItem[];
}

function NilaiBadge({ nilai }: { nilai: number | null }) {
  if (nilai === null || nilai === undefined) {
    return <span className="text-xs text-on-surface-variant italic">Belum dinilai</span>;
  }
  const n = Math.round(nilai);
  const variant = n >= 75 ? 'success' : n >= 60 ? 'warning' : 'destructive';
  return <Badge variant={variant}>{n}</Badge>;
}

function tipeLabel(tipe: string) {
  return tipe?.replace(/_/g, ' ') ?? '-';
}

function formatTgl(dt: string | null) {
  if (!dt) return '-';
  return new Date(dt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function RiwayatNilai() {
  const navigate = useNavigate();
  const [data, setData] = useState<MapelGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const fetchData = async () => {
    try {
      setIsLoading(true);
      setErrorMsg(null);
      const res = await api.get('/api/siswa/riwayat-nilai');
      setData(Array.isArray(res) ? res : []);
      // Buka accordion pertama secara default
      if (Array.isArray(res) && res.length > 0) {
        setExpanded({ [res[0].mataPelajaran]: true });
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Gagal memuat riwayat nilai.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const toggle = (mapel: string) =>
    setExpanded(prev => ({ ...prev, [mapel]: !prev[mapel] }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/siswa')} className="gap-1 text-on-surface-variant">
          <ArrowLeft className="w-4 h-4" /> Kembali
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-on-surface tracking-tight">Riwayat Nilai</h1>
          <p className="text-on-surface-variant text-sm mt-0.5">Rekap nilai ujian per mata pelajaran</p>
        </div>
      </div>

      {isLoading ? (
        <div className="py-16 flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-on-surface-variant">Memuat riwayat nilai...</p>
        </div>
      ) : errorMsg ? (
        <ErrorState message={errorMsg} onRetry={fetchData} />
      ) : data.length === 0 ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center gap-3 text-on-surface-variant">
            <FileText className="w-12 h-12 text-outline-variant" />
            <p className="text-lg font-medium text-on-surface">Belum ada riwayat nilai</p>
            <p className="text-sm">Selesaikan ujian terlebih dahulu untuk melihat rekap nilai.</p>
            <Button variant="outline" onClick={() => navigate('/dashboard/siswa')} className="mt-2">
              Kembali ke Dashboard
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Ringkasan statistik */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Card className="bg-primary-container/20 border-primary/20">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-on-surface-variant mb-1">Mata Pelajaran</p>
                <p className="text-2xl font-bold text-primary">{data.length}</p>
              </CardContent>
            </Card>
            <Card className="bg-secondary-container/20 border-secondary/20">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-on-surface-variant mb-1">Total Ujian</p>
                <p className="text-2xl font-bold text-secondary">{data.reduce((a, g) => a + g.jumlahUjian, 0)}</p>
              </CardContent>
            </Card>
            <Card className="bg-tertiary-fixed/20 border-tertiary-fixed/40 col-span-2 sm:col-span-1">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-on-surface-variant mb-1">Rata-rata Keseluruhan</p>
                {(() => {
                  const valid = data.filter(g => g.rataRata !== null);
                  const overall = valid.length > 0
                    ? Math.round(valid.reduce((a, g) => a + (g.rataRata ?? 0), 0) / valid.length)
                    : null;
                  return <p className="text-2xl font-bold text-on-surface">{overall !== null ? overall : '—'}</p>;
                })()}
              </CardContent>
            </Card>
          </div>

          {/* Accordion per mata pelajaran */}
          {data.map(group => (
            <Card key={group.mataPelajaran} className="overflow-hidden">
              <button
                type="button"
                className="w-full text-left"
                onClick={() => toggle(group.mataPelajaran)}
                aria-expanded={!!expanded[group.mataPelajaran]}
              >
                <CardHeader className="pb-3 pt-4 hover:bg-surface-container-low/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary-container/30 flex items-center justify-center shrink-0">
                        <BookOpen className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{group.mataPelajaran}</CardTitle>
                        <CardDescription className="text-xs mt-0.5">
                          {group.jumlahUjian} ujian
                          {group.rataRata !== null && (
                            <span> &bull; Rata-rata: <span className="font-semibold text-on-surface">{Math.round(group.rataRata)}</span></span>
                          )}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 pr-1">
                      {group.rataRata !== null && <NilaiBadge nilai={group.rataRata} />}
                      {expanded[group.mataPelajaran]
                        ? <ChevronDown className="w-4 h-4 text-on-surface-variant" />
                        : <ChevronRight className="w-4 h-4 text-on-surface-variant" />}
                    </div>
                  </div>
                </CardHeader>
              </button>

              {expanded[group.mataPelajaran] && (
                <CardContent className="pt-0 pb-4">
                  <div className="border-t border-outline-variant mt-1 pt-3 space-y-2">
                    {group.ujian.map(u => (
                      <div
                        key={u.sesiId}
                        className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 bg-surface-container-low/60 hover:bg-surface-container-low transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm text-on-surface truncate">{u.ujianJudul}</span>
                            {u.adaUraian && (
                              <span className="flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200">
                                <PenLine className="w-2.5 h-2.5" /> Uraian
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant="outline" className="text-[10px] uppercase">{tipeLabel(u.tipeUjian)}</Badge>
                            <span className="text-xs text-on-surface-variant">{formatTgl(u.selesaiAt)}</span>
                          </div>
                        </div>
                        <div className="shrink-0">
                          <NilaiBadge nilai={u.nilaiAkhir} />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
