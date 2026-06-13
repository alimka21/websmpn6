import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { CalendarCheck, CheckCircle, AlertTriangle, Clock, Save, RefreshCw, ChevronDown } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import api from '../../../lib/api';

// ── Types ──────────────────────────────────────────────────────────────────────

type StatusAbsensi = 'HADIR' | 'SAKIT' | 'IZIN' | 'ALFA';

interface SiswaEntry {
  siswaId: string;
  nama: string;
  nis: string;
  kelas: string;
  statusKiosk: { hadir: boolean; waktu: string } | null;
  absensiId: string | null;
  statusManual: string | null;
  keterangan: string | null;
  // state lokal form
  _status: StatusAbsensi;
  _keterangan: string;
  _dirty: boolean;
}

interface KelasItem {
  id: string;
  nama: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const today = () => new Date().toISOString().slice(0, 10);

const fmtWaktu = (iso: string) =>
  new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

const STATUS_OPTIONS: { value: StatusAbsensi; label: string; color: string }[] = [
  { value: 'HADIR', label: 'Hadir',  color: 'text-green-600' },
  { value: 'SAKIT', label: 'Sakit',  color: 'text-yellow-600' },
  { value: 'IZIN',  label: 'Izin',   color: 'text-blue-600' },
  { value: 'ALFA',  label: 'Alfa',   color: 'text-red-600' },
];

// ── Komponen ───────────────────────────────────────────────────────────────────

export default function InputAbsensi() {
  const [tanggal, setTanggal]       = useState(today());
  const [kelasId, setKelasId]       = useState('');
  const [kelasList, setKelasList]   = useState<KelasItem[]>([]);
  const [entries, setEntries]       = useState<SiswaEntry[]>([]);
  const [loading, setLoading]       = useState(false);
  const [saving, setSaving]         = useState(false);
  const [loaded, setLoaded]         = useState(false);

  // Ambil kelas yang diajar guru
  useEffect(() => {
    api.get('/api/guru/kelas')
      .then((r: any) => {
        const list = Array.isArray(r) ? r : (r.data || []);
        setKelasList(list);
        if (list.length === 1) setKelasId(list[0].id);
      })
      .catch(() => {});
  }, []);

  const loadData = useCallback(async () => {
    if (!kelasId) return;
    setLoading(true);
    setLoaded(false);
    try {
      const r: any = await api.get(`/api/guru/absensi?tanggal=${tanggal}&kelasId=${kelasId}`);
      const list: SiswaEntry[] = (r.siswaList || []).map((s: any) => {
        // Jika sudah hadir kiosk, locked sebagai HADIR
        const locked = !!s.statusKiosk?.hadir;
        return {
          ...s,
          _status: locked ? 'HADIR' : (s.statusManual as StatusAbsensi) || 'HADIR',
          _keterangan: s.keterangan || '',
          _dirty: false,
        };
      });
      setEntries(list);
      setLoaded(true);
    } catch {
      toast.error('Gagal memuat data siswa');
    } finally {
      setLoading(false);
    }
  }, [tanggal, kelasId]);

  const updateEntry = (siswaId: string, field: '_status' | '_keterangan', value: string) => {
    setEntries(prev => prev.map(e =>
      e.siswaId === siswaId ? { ...e, [field]: value, _dirty: true } : e
    ));
  };

  const handleSimpan = async () => {
    if (!kelasId) return;
    setSaving(true);
    try {
      const payload = entries
        .filter(e => !e.statusKiosk?.hadir) // kiosk hadir tidak dikirim
        .map(e => ({
          siswaId: e.siswaId,
          status: e._status === 'HADIR' ? null : e._status, // HADIR = hapus record
          keterangan: e._keterangan || null,
        }));

      const r: any = await api.post('/api/guru/absensi', { tanggal, kelasId, entries: payload });
      toast.success(`Absensi disimpan — ${r.saved} siswa tercatat`);
      setEntries(prev => prev.map(e => ({ ...e, _dirty: false })));
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Gagal menyimpan absensi');
    } finally {
      setSaving(false);
    }
  };

  const dirtyCount  = entries.filter(e => e._dirty).length;
  const absenCount  = entries.filter(e => e._status !== 'HADIR').length;
  const hadirCount  = entries.filter(e => e._status === 'HADIR').length;

  return (
    <div className="space-y-5 max-w-5xl">

      {/* ── Filter ── */}
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant p-5 space-y-4">
        <h2 className="font-bold text-on-surface flex items-center gap-2">
          <CalendarCheck className="w-5 h-5 text-primary" />
          Input Absensi Siswa
        </h2>

        <div className="flex flex-wrap gap-4 items-end">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-on-surface-variant">Tanggal</label>
            <input
              type="date"
              value={tanggal}
              max={today()}
              onChange={e => { setTanggal(e.target.value); setLoaded(false); }}
              className="px-3 py-2.5 border border-outline-variant rounded-xl text-sm focus:border-primary outline-none bg-surface"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-on-surface-variant">Kelas</label>
            <div className="relative">
              <select
                value={kelasId}
                onChange={e => { setKelasId(e.target.value); setLoaded(false); }}
                className="pl-3 pr-8 py-2.5 border border-outline-variant rounded-xl text-sm focus:border-primary outline-none bg-surface appearance-none min-w-[160px]"
              >
                <option value="">Pilih kelas</option>
                {kelasList.map(k => <option key={k.id} value={k.id}>{k.nama}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none" />
            </div>
          </div>

          <Button onClick={loadData} disabled={!kelasId || loading} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Memuat...' : 'Tampilkan'}
          </Button>
        </div>
      </div>

      {/* ── Tabel Input ── */}
      {loaded && entries.length > 0 && (
        <>
          {/* Summary mini */}
          <div className="flex flex-wrap gap-3">
            {[
              { label: 'Total Siswa', value: entries.length,  color: 'bg-surface-container text-on-surface' },
              { label: 'Hadir',       value: hadirCount,       color: 'bg-green-50 text-green-700' },
              { label: 'Tidak Hadir', value: absenCount,       color: 'bg-red-50 text-red-700' },
              { label: 'Belum disimpan', value: dirtyCount,   color: dirtyCount > 0 ? 'bg-yellow-50 text-yellow-700' : 'bg-surface-container text-on-surface-variant' },
            ].map(({ label, value, color }) => (
              <div key={label} className={`px-4 py-2 rounded-xl text-sm font-semibold ${color} border border-outline-variant/30`}>
                {value} {label}
              </div>
            ))}
          </div>

          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/50">
              <div>
                <p className="font-bold text-on-surface text-sm">
                  {kelasList.find(k => k.id === kelasId)?.nama} — {new Date(tanggal).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Siswa yang sudah hadir kiosk tidak dapat diubah statusnya
                </p>
              </div>
              <Button onClick={handleSimpan} disabled={saving || dirtyCount === 0} className="gap-2">
                {saving
                  ? <><RefreshCw className="w-4 h-4 animate-spin" /> Menyimpan...</>
                  : <><Save className="w-4 h-4" /> Simpan Absensi</>
                }
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-container/50 text-on-surface-variant text-xs font-semibold uppercase tracking-wide">
                    <th className="px-4 py-3 text-left w-10">No</th>
                    <th className="px-4 py-3 text-left">Nama Siswa</th>
                    <th className="px-4 py-3 text-left">NIS</th>
                    <th className="px-4 py-3 text-center w-28">Hadir Kiosk</th>
                    <th className="px-4 py-3 text-center w-40">Status</th>
                    <th className="px-4 py-3 text-left">Keterangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/30">
                  {entries.map((entry, idx) => {
                    const locked = !!entry.statusKiosk?.hadir;
                    return (
                      <tr
                        key={entry.siswaId}
                        className={`transition-colors ${entry._dirty ? 'bg-yellow-50/40' : 'hover:bg-surface-container/30'}`}
                      >
                        <td className="px-4 py-3 text-on-surface-variant text-xs">{idx + 1}</td>
                        <td className="px-4 py-3 font-semibold text-on-surface">{entry.nama}</td>
                        <td className="px-4 py-3 text-on-surface-variant font-mono text-xs">{entry.nis}</td>
                        <td className="px-4 py-3 text-center">
                          {locked ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-600">
                              <CheckCircle className="w-3.5 h-3.5" />
                              {fmtWaktu(entry.statusKiosk!.waktu)}
                            </span>
                          ) : (
                            <span className="text-xs text-on-surface-variant">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {locked ? (
                            <span className="text-xs font-semibold text-green-600 bg-green-50 px-3 py-1 rounded-lg">Hadir</span>
                          ) : (
                            <div className="relative">
                              <select
                                value={entry._status}
                                onChange={e => updateEntry(entry.siswaId, '_status', e.target.value)}
                                className={`w-full pl-2 pr-7 py-1.5 border rounded-lg text-xs font-semibold outline-none appearance-none focus:border-primary transition-colors ${
                                  entry._status === 'HADIR' ? 'border-green-200 bg-green-50 text-green-700' :
                                  entry._status === 'SAKIT' ? 'border-yellow-200 bg-yellow-50 text-yellow-700' :
                                  entry._status === 'IZIN'  ? 'border-blue-200 bg-blue-50 text-blue-700' :
                                  'border-red-200 bg-red-50 text-red-700'
                                }`}
                              >
                                {STATUS_OPTIONS.map(s => (
                                  <option key={s.value} value={s.value}>{s.label}</option>
                                ))}
                              </select>
                              <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none text-on-surface-variant" />
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {!locked && (
                            <input
                              type="text"
                              value={entry._keterangan}
                              onChange={e => updateEntry(entry.siswaId, '_keterangan', e.target.value)}
                              placeholder="Keterangan opsional..."
                              className="w-full px-2 py-1.5 border border-outline-variant rounded-lg text-xs focus:border-primary outline-none bg-surface"
                            />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="px-5 py-3 border-t border-outline-variant/30 flex justify-end">
              <Button onClick={handleSimpan} disabled={saving || dirtyCount === 0} className="gap-2">
                {saving
                  ? <><RefreshCw className="w-4 h-4 animate-spin" /> Menyimpan...</>
                  : <><Save className="w-4 h-4" /> Simpan Absensi</>
                }
              </Button>
            </div>
          </div>
        </>
      )}

      {loaded && entries.length === 0 && (
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant py-16 flex flex-col items-center gap-3 text-on-surface-variant">
          <AlertTriangle className="w-10 h-10 opacity-30" />
          <p className="text-sm font-medium">Tidak ada siswa di kelas ini</p>
        </div>
      )}

      {!loaded && !loading && (
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant py-16 flex flex-col items-center gap-3 text-on-surface-variant">
          <CalendarCheck className="w-10 h-10 opacity-30" />
          <p className="text-sm font-medium">Pilih tanggal dan kelas, lalu klik Tampilkan</p>
        </div>
      )}
    </div>
  );
}
