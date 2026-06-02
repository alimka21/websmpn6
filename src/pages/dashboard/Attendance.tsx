import { toast } from 'sonner';
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Select } from '../../components/ui/select';
import { Input, Label } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Calendar as CalendarIcon, CheckSquare, Save, Download, BarChart2, ChevronUp, ChevronDown } from 'lucide-react';
import api from '../../lib/api';
import { formatDate } from '../../lib/utils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function Attendance() {
  const [activeTab, setActiveTab] = useState<'INPUT' | 'REKAP'>('INPUT');
  const [kelasList, setKelasList] = useState<any[]>([]);
  const [selectedKelas, setSelectedKelas] = useState<string>('');
  
  // Tab Input State
  const [tanggalPilih, setTanggalPilih] = useState(new Date().toISOString().slice(0,10));
  const [presensiSiswa, setPresensiSiswa] = useState<any[]>([]); // id, nama, status, keterangan
  const [isLoadingSiswa, setIsLoadingSiswa] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasExistingPresensi, setHasExistingPresensi] = useState(false);

  // Tab Rekap State
  const [rekapBulan, setRekapBulan] = useState(new Date().getMonth() + 1);
  const [rekapTahun, setRekapTahun] = useState(new Date().getFullYear());
  const [rekapData, setRekapData] = useState<any[]>([]);
  const [isLoadingRekap, setIsLoadingRekap] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [sortField, setSortField] = useState<string>('nama');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    fetchKelas();
  }, []);

  const fetchKelas = async () => {
    try {
      const res = await api.get('/api/guru/kelas');
      setKelasList(res);
      if (res.length > 0) {
        setSelectedKelas(res[0].id);
      }
    } catch (error: any) {
      toast.error(error?.message || 'Gagal memuat daftar kelas');
    }
  };

  useEffect(() => {
    if (activeTab === 'INPUT' && selectedKelas && tanggalPilih) {
      fetchSiswaUntukPresensi();
    } else if (activeTab === 'REKAP' && selectedKelas) {
      fetchRekap();
    }
  }, [selectedKelas, tanggalPilih, activeTab, rekapBulan, rekapTahun]);

  const fetchSiswaUntukPresensi = async () => {
    try {
      setIsLoadingSiswa(true);
      // 1. Ambil daftar siswa
      const listSiswa: any[] = await api.get(`/api/guru/siswa?kelasId=${selectedKelas}`);
      
      // 2. Cek apakah di tanggal tersebut sudah ada presensi?
      const existingPresensi = await api.get(`/api/guru/presensi?kelasId=${selectedKelas}&tanggal=${tanggalPilih}`);
      
      if (existingPresensi.length > 0) {
        setHasExistingPresensi(true);
        // Map data yang sudah ada
        const mapped = listSiswa.map((s: any) => {
          const found = existingPresensi.find((p: any) => p.siswaId === s.id);
          return {
            id: s.id,
            nis: s.nis,
            nama: s.nama,
            status: found ? found.status : 'HADIR',
            keterangan: found ? found.keterangan || '' : ''
          };
        });
        setPresensiSiswa(mapped);
      } else {
        setHasExistingPresensi(false);
        setPresensiSiswa(listSiswa.map((s: any) => ({
          id: s.id,
          nis: s.nis,
          nama: s.nama,
          status: 'HADIR', // Default
          keterangan: ''
        })));
      }
    } catch (error: any) {
      toast.error(error?.message || 'Gagal memuat data siswa');
    } finally {
      setIsLoadingSiswa(false);
    }
  };

  const fetchRekap = async () => {
    try {
      setIsLoadingRekap(true);
      const res = await api.get(`/api/guru/presensi/rekap?kelasId=${selectedKelas}&bulan=${rekapBulan}&tahun=${rekapTahun}`);
      setRekapData(res);
    } catch (error: any) {
      toast.error(error?.message || 'Gagal memuat rekap presensi');
    } finally {
      setIsLoadingRekap(false);
    }
  };

  const handleChangeStatus = (id: string, status: string) => {
    setPresensiSiswa(prev => prev.map(s => s.id === id ? { ...s, status } : s));
  };
  
  const handleChangeKet = (id: string, val: string) => {
    setPresensiSiswa(prev => prev.map(s => s.id === id ? { ...s, keterangan: val } : s));
  };

  const handleMarkAllHadir = () => {
    setPresensiSiswa(prev => prev.map(s => ({ ...s, status: 'HADIR' })));
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const sortedRekap = [...rekapData].sort((a, b) => {
    const mul = sortDir === 'asc' ? 1 : -1;
    if (typeof a[sortField] === 'string') return a[sortField].localeCompare(b[sortField]) * mul;
    return ((a[sortField] ?? 0) - (b[sortField] ?? 0)) * mul;
  });

  const handleExport = async () => {
    try {
      setIsExporting(true);
      let token = localStorage.getItem('token');
      if (!token) {
        try {
          const raw = localStorage.getItem('auth-storage');
          if (raw) token = JSON.parse(raw)?.state?.token;
        } catch { /* ignore */ }
      }
      const url = `/api/guru/presensi/export?kelasId=${selectedKelas}&bulan=${rekapBulan}&tahun=${rekapTahun}`;
      const resp = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!resp.ok) throw new Error('Gagal mengunduh file');
      const blob = await resp.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = `Presensi_${rekapBulan}_${rekapTahun}.xlsx`;
      a.click();
      URL.revokeObjectURL(href);
      toast.success('File Excel berhasil diunduh');
    } catch (err: any) {
      toast.error(err.message || 'Gagal mengunduh file');
    } finally {
      setIsExporting(false);
    }
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      const data = presensiSiswa.map(s => ({
        siswaId: s.id,
        status: s.status,
        keterangan: s.keterangan || undefined
      }));

      await api.post('/api/guru/presensi', {
        kelasId: selectedKelas,
        tanggal: new Date(tanggalPilih).toISOString(),
        presensi: data
      });
      
      setHasExistingPresensi(true);
      toast.success('Presensi berhasil disimpan!');
    } catch (error: any) {
      toast.error(error.message || 'Gagal menyimpan presensi');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPercentageColor = (pct: number) => {
    if (pct >= 90) return '#22c55e'; // green-500
    if (pct >= 75) return '#eab308'; // yellow-500
    return '#ef4444'; // red-500
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-on-surface">Presensi Sesi Saya</h1>
          <p className="text-on-surface-variant mt-1">Catatan kehadiran siswa untuk sesi pelajaran yang Anda ampu. Guru lain punya catatan terpisah.</p>
        </div>
        
        <div className="flex bg-surface-container p-1 rounded-lg">
          <button
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'INPUT' ? 'bg-white text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
            onClick={() => setActiveTab('INPUT')}
          >
            Input Presensi
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'REKAP' ? 'bg-white text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
            onClick={() => setActiveTab('REKAP')}
          >
            Rekap Bulanan
          </button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle>{activeTab === 'INPUT' ? 'Input Kehadiran' : 'Rekap Kehadiran'}</CardTitle>
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <Select value={selectedKelas} onChange={e => setSelectedKelas(e.target.value)} disabled={kelasList.length === 0} className="w-full sm:w-56">
                {kelasList.length === 0 && <option value="">Pilih Kelas</option>}
                {kelasList.map(k => (
                  <option key={k.id} value={k.id}>{k.nama} (Tingkat {k.tingkat})</option>
                ))}
              </Select>
              
              {activeTab === 'INPUT' ? (
                <Input 
                  type="date" 
                  className="w-full sm:w-48"
                  value={tanggalPilih}
                  onChange={e => setTanggalPilih(e.target.value)}
                />
              ) : (
                <div className="flex gap-2">
                  <Select value={rekapBulan} onChange={e => setRekapBulan(Number(e.target.value))} className="w-full sm:w-32">
                    {Array.from({length: 12}, (_, i) => i + 1).map(m => (
                      <option key={m} value={m}>{new Date(0, m - 1).toLocaleString('id-ID', {month: 'long'})}</option>
                    ))}
                  </Select>
                  <Select value={rekapTahun} onChange={e => setRekapTahun(Number(e.target.value))} className="w-full sm:w-28">
                    {[new Date().getFullYear(), new Date().getFullYear() - 1].map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </Select>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {kelasList.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-on-surface-variant border-2 border-dashed border-outline-variant rounded-xl">
              <p className="text-lg font-medium text-on-surface">Tidak ada kelas</p>
              <p className="text-sm">Buat kelas terlebih dahulu di menu Siswa & Kelas.</p>
            </div>
          ) : activeTab === 'INPUT' ? (
            <div className="space-y-4">
              {isLoadingSiswa ? (
                <div className="py-12 text-center text-on-surface-variant">Memuat data siswa...</div>
              ) : presensiSiswa.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-on-surface-variant border-2 border-dashed border-outline-variant rounded-xl">
                   <p className="text-lg font-medium text-on-surface">Belum ada siswa di kelas ini</p>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center bg-surface-container-low p-3 rounded-lg border border-outline-variant">
                    <div className="flex items-center gap-2 text-sm">
                      <CalendarIcon className="w-4 h-4 text-primary" />
                      <span className="font-medium text-on-surface">{formatDate(tanggalPilih)}</span>
                      {hasExistingPresensi && (
                         <Badge variant="outline" className="ml-2 bg-secondary-container/30 text-on-secondary-container border-secondary/30">Sudah Disimpan</Badge>
                      )}
                    </div>
                    <Button
                      size="sm"
                      onClick={handleMarkAllHadir}
                      className="bg-secondary hover:bg-secondary/90 text-white"
                      title="Set semua siswa jadi HADIR"
                    >
                      <CheckSquare className="w-4 h-4 mr-1.5" /> Hadir Semua
                    </Button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-surface-container-low text-on-surface-variant border-b border-outline-variant uppercase text-xs">
                        <tr>
                          <th className="px-4 py-3 font-semibold w-16">No</th>
                          <th className="px-4 py-3 font-semibold">Nama Siswa</th>
                          <th className="px-4 py-3 font-semibold min-w-[280px]">Status Kehadiran</th>
                          <th className="px-4 py-3 font-semibold">Keterangan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {presensiSiswa.map((siswa, idx) => (
                          <tr key={siswa.id} className="hover:bg-surface-container-low/50 transition-colors">
                            <td className="px-4 py-4 text-on-surface-variant">{idx + 1}</td>
                            <td className="px-4 py-4 font-medium text-on-surface">
                              {siswa.nama}
                              <div className="text-xs text-outline-variant font-normal mt-0.5">{siswa.nis}</div>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex flex-wrap gap-3">
                                {[
                                  {val: 'HADIR', label: 'Hadir', col: 'text-on-secondary-container bg-secondary-container/30 border-secondary/30'}, 
                                  {val: 'IZIN', label: 'Izin', col: 'text-on-tertiary-fixed bg-tertiary-fixed/50 border-tertiary-fixed'}, 
                                  {val: 'SAKIT', label: 'Sakit', col: 'text-on-tertiary-fixed bg-tertiary-fixed/50 border-tertiary-fixed'}, 
                                  {val: 'ALPHA', label: 'Alpha', col: 'text-error bg-error-container border-error/20'}
                                ].map(st => (
                                  <label key={st.val} className={`flex items-center gap-1.5 px-2 py-1 rounded-md border cursor-pointer transition-colors ${siswa.status === st.val ? st.col : 'text-on-surface-variant border-transparent hover:bg-surface-container'}`}>
                                    <input 
                                      type="radio" 
                                      name={`status-${siswa.id}`} 
                                      value={st.val}
                                      checked={siswa.status === st.val}
                                      onChange={() => handleChangeStatus(siswa.id, st.val)}
                                      className="sr-only"
                                    />
                                    <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${siswa.status === st.val ? 'border-current bg-current' : 'border-outline-variant bg-white'}`}>
                                       {siswa.status === st.val && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                    </div>
                                    <span className="text-xs font-medium">{st.label}</span>
                                  </label>
                                ))}
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <Input 
                                placeholder="catatan opsional" 
                                className="h-8 text-xs max-w-[200px]"
                                value={siswa.keterangan}
                                onChange={(e) => handleChangeKet(siswa.id, e.target.value)}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-end pt-4 mt-2 border-t border-outline-variant">
                    <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-primary hover:bg-primary/90 gap-2 px-8">
                      {isSubmitting ? (
                        <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      ) : <Save className="w-4 h-4" />}
                      Simpan Presensi
                    </Button>
                  </div>
                </>
              )}
            </div>
          ) : (
            // TAB REKAP
            <div className="space-y-6">
              {isLoadingRekap ? (
                <div className="py-12 text-center text-on-surface-variant">Memuat rekapitulasi...</div>
              ) : rekapData.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-on-surface-variant border-2 border-dashed border-outline-variant rounded-xl">
                   <p className="text-lg font-medium text-on-surface">Belum ada data</p>
                   <p className="text-sm">Tidak ada data presensi pada bulan ini.</p>
                </div>
              ) : (
                <>
                  <div className="h-64 mt-4 mb-8">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={rekapData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <XAxis dataKey="nama" tick={{fontSize: 10}} interval={0} angle={-45} textAnchor="end" height={60} />
                        <YAxis tick={{fontSize: 12}} />
                        <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                        <Bar dataKey="persentase" name="Kehadiran (%)" radius={[4, 4, 0, 0]}>
                          {rekapData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={getPercentageColor(entry.persentase)} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="flex justify-end mb-3">
                    <Button variant="outline" size="sm" className="gap-2 bg-secondary-container/30 text-on-secondary-container border-secondary/30 hover:bg-secondary-container/60" onClick={handleExport} disabled={isExporting}>
                      {isExporting ? <div className="w-4 h-4 border-2 border-secondary/40 border-t-green-700 rounded-full animate-spin" /> : <Download className="w-4 h-4" />}
                      Export Excel
                    </Button>
                  </div>

                  <div className="overflow-x-auto border rounded-lg">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-surface-container-low text-on-surface-variant border-b border-outline-variant">
                        <tr>
                          {[
                            { field: 'nama', label: 'Nama Siswa', cls: '' },
                            { field: 'hadir', label: 'Hadir', cls: 'text-center text-on-secondary-container' },
                            { field: 'izin', label: 'Izin', cls: 'text-center text-on-tertiary-fixed' },
                            { field: 'sakit', label: 'Sakit', cls: 'text-center text-on-tertiary-fixed' },
                            { field: 'alpha', label: 'Alpha', cls: 'text-center text-error' },
                            { field: 'persentase', label: '% Kehadiran', cls: 'text-center' },
                          ].map(col => (
                            <th key={col.field} className={`px-4 py-3 font-semibold cursor-pointer select-none hover:bg-surface-container ${col.cls}`} onClick={() => handleSort(col.field)}>
                              <span className="inline-flex items-center gap-1">
                                {col.label}
                                {sortField === col.field
                                  ? sortDir === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
                                  : <span className="w-3.5 h-3.5 opacity-30"><ChevronUp className="w-3.5 h-3.5" /></span>
                                }
                              </span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {sortedRekap.map((siswa, idx) => (
                          <tr key={idx} className="hover:bg-surface-container-low/50">
                            <td className="px-4 py-3 font-medium text-on-surface">
                              {siswa.nama}
                              <div className="text-xs text-outline-variant font-normal">{siswa.nis}</div>
                            </td>
                            <td className="px-4 py-3 text-center font-medium bg-secondary-container/30/30">{siswa.hadir}</td>
                            <td className="px-4 py-3 text-center bg-tertiary-fixed/50/30">{siswa.izin}</td>
                            <td className="px-4 py-3 text-center bg-tertiary-fixed/50/30">{siswa.sakit}</td>
                            <td className="px-4 py-3 text-center bg-error-container/30 text-error font-medium">{siswa.alpha}</td>
                            <td className="px-4 py-3 text-center font-bold" style={{ color: getPercentageColor(siswa.persentase) }}>
                              {siswa.persentase}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
