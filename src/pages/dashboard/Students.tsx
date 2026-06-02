import { toast } from 'sonner';
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input, Label } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Plus, Users, Pencil, Trash2, KeyRound } from 'lucide-react';
import api from '../../lib/api';

export default function Students() {
  const [kelasList, setKelasList] = useState<any[]>([]);
  const [selectedKelas, setSelectedKelas] = useState<string>('ALL');
  const [siswaList, setSiswaList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal Siswa
  const [showSiswaModal, setShowSiswaModal] = useState(false);
  const [editingSiswa, setEditingSiswa] = useState<any | null>(null);
  const [siswaForm, setSiswaForm] = useState({ nis: '', nama: '', kelasId: '' });
  const [isSubmittingSiswa, setIsSubmittingSiswa] = useState(false);

  // Modal Kelas
  const [showKelasModal, setShowKelasModal] = useState(false);
  const [kelasForm, setKelasForm] = useState({ nama: '', tingkat: 'X', tahunAjaran: '' });
  const [isSubmittingKelas, setIsSubmittingKelas] = useState(false);

  const fetchKelas = async () => {
    try {
      const res = await api.get('/api/guru/kelas');
      setKelasList(res);
      if (res.length > 0 && selectedKelas === 'ALL') {
        setSelectedKelas(res[0].id);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const fetchSiswa = async () => {
    if (!selectedKelas || selectedKelas === 'ALL') return;
    try {
      setIsLoading(true);
      const res = await api.get(`/api/guru/kelas/${selectedKelas}`);
      setSiswaList(res.siswa || []);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchKelas();
  }, []);

  useEffect(() => {
    if (kelasList.length > 0) {
      fetchSiswa();
    } else {
      setIsLoading(false);
    }
  }, [selectedKelas, kelasList]);

  const handleOpenSiswaModal = (siswa?: any) => {
    if (siswa) {
      setEditingSiswa(siswa);
      setSiswaForm({ nis: siswa.nis, nama: siswa.nama, kelasId: selectedKelas });
    } else {
      setEditingSiswa(null);
      setSiswaForm({ nis: '', nama: '', kelasId: selectedKelas });
    }
    setShowSiswaModal(true);
  };

  const handleSaveSiswa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!siswaForm.nis || !siswaForm.nama || !siswaForm.kelasId) {
      toast.error("Semua field wajib diisi");
      return;
    }
    
    try {
      setIsSubmittingSiswa(true);
      if (editingSiswa) {
        await api.patch(`/api/guru/siswa/${editingSiswa.id}`, { nama: siswaForm.nama, nis: siswaForm.nis });
      } else {
        await api.post('/api/guru/siswa', siswaForm);
      }
      setShowSiswaModal(false);
      fetchSiswa();
    } catch (error: any) {
      toast.error(error.message || 'Gagal menyimpan siswa');
    } finally {
      setIsSubmittingSiswa(false);
    }
  };

  const handleDeleteSiswa = async (id: string) => {
    if (!confirm('Hapus siswa ini? Semua data terkait siswa akan dihapus.')) return;
    try {
      await api.delete(`/api/guru/siswa/${id}`);
      fetchSiswa();
    } catch (error: any) {
      toast.error(error.message || 'Gagal menghapus siswa');
    }
  };

  const handleResetPassword = async (id: string, nis: string) => {
    if (!confirm(`Reset password siswa ini kembali menjadi NIS (${nis})?`)) return;
    try {
      await api.post(`/api/guru/siswa/${id}/reset-password`);
      toast.success("Password berhasil direset!");
    } catch (error: any) {
      toast.error(error.message || 'Gagal mereset password');
    }
  };

  const handleSaveKelas = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kelasForm.nama || !kelasForm.tingkat || !kelasForm.tahunAjaran) {
      toast.error("Semua field wajib diisi");
      return;
    }
    
    try {
      setIsSubmittingKelas(true);
      const res = await api.post('/api/guru/kelas', kelasForm);
      setShowKelasModal(false);
      setKelasForm({ nama: '', tingkat: 'X', tahunAjaran: '' });
      await fetchKelas();
      setSelectedKelas(res.id);
    } catch (error: any) {
      toast.error(error.message || 'Gagal membuat kelas');
    } finally {
      setIsSubmittingKelas(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-on-surface">Siswa & Kelas</h1>
          <p className="text-on-surface-variant mt-1">Kelola data kelas dan siswa yang Anda ajar.</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <Button variant="outline" onClick={() => setShowKelasModal(true)} className="flex-1 md:flex-none gap-2">
            <Plus className="w-4 h-4" /> Kelas Baru
          </Button>
          <Button onClick={() => handleOpenSiswaModal()} disabled={kelasList.length === 0} className="flex-1 md:flex-none gap-2 px-6 bg-primary hover:bg-primary/90">
            <Users className="w-4 h-4" /> Tambah Siswa
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle>Daftar Siswa</CardTitle>
              <CardDescription>Menampilkan {siswaList.length} siswa di kelas terpilih.</CardDescription>
            </div>
            <div className="w-full sm:w-64">
              <Select value={selectedKelas} onChange={e => setSelectedKelas(e.target.value)} disabled={kelasList.length === 0}>
                {kelasList.length === 0 && <option value="ALL">Pilih Kelas</option>}
                {kelasList.map(k => (
                  <option key={k.id} value={k.id}>{k.nama} (Tingkat {k.tingkat})</option>
                ))}
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-12 text-center text-on-surface-variant">Memuat data siswa...</div>
          ) : kelasList.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-on-surface-variant border-2 border-dashed border-outline-variant rounded-xl">
              <Users className="w-12 h-12 text-outline-variant mb-3" />
              <p className="text-lg font-medium text-on-surface">Tidak ada kelas</p>
              <p className="text-sm text-center max-w-sm mt-1">Anda belum memiliki kelas. Silakan buat kelas baru terlebih dahulu untuk menambahkan siswa.</p>
            </div>
          ) : siswaList.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-on-surface-variant border-2 border-dashed border-outline-variant rounded-xl">
              <p className="text-lg font-medium text-on-surface">Belum ada siswa</p>
              <p className="text-sm">Klik "Tambah Siswa" untuk memasukkan data siswa ke kelas ini.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-surface-container-low text-on-surface-variant border-b border-outline-variant uppercase text-xs">
                  <tr>
                    <th className="px-4 py-3 font-semibold rounded-tl-lg">NIS</th>
                    <th className="px-4 py-3 font-semibold">Nama Siswa</th>
                    <th className="px-4 py-3 font-semibold">Email Pengguna</th>
                    <th className="px-4 py-3 font-semibold text-center rounded-tr-lg">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {siswaList.map(siswa => (
                    <tr key={siswa.id} className="hover:bg-surface-container-low/50 transition-colors">
                      <td className="px-4 py-4 font-medium text-on-surface">{siswa.nis}</td>
                      <td className="px-4 py-4 font-medium">{siswa.nama}</td>
                      <td className="px-4 py-4 text-on-surface-variant">{siswa.user?.email || '-'}</td>
                      <td className="px-4 py-4">
                        <div className="flex justify-center gap-2">
                          <Button variant="ghost" size="sm" onClick={() => handleOpenSiswaModal(siswa)} className="text-primary hover:text-primary hover:bg-primary-container/15 h-8 px-2" title="Edit">
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleResetPassword(siswa.id, siswa.nis)} className="text-on-tertiary-fixed hover:text-on-tertiary-fixed hover:bg-tertiary-fixed/50 h-8 px-2" title="Reset Password">
                            <KeyRound className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteSiswa(siswa.id)} className="text-error hover:text-error hover:bg-error-container h-8 px-2" title="Hapus">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Tambah/Edit Siswa */}
      {showSiswaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-inverse-surface/50 backdrop-blur-sm shadow-2xl">
          <Card className="w-full max-w-md border-0 animate-in fade-in zoom-in-95 duration-200">
            <CardHeader className="border-b border-outline-variant pb-4">
              <CardTitle>{editingSiswa ? 'Edit Data Siswa' : 'Tambah Siswa Baru'}</CardTitle>
            </CardHeader>
            <form onSubmit={handleSaveSiswa}>
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="kelasId">Kelas</Label>
                  <Select id="kelasId" value={siswaForm.kelasId} onChange={e => setSiswaForm({ ...siswaForm, kelasId: e.target.value })} disabled={!!editingSiswa}>
                    {kelasList.map(k => (
                      <option key={k.id} value={k.id}>{k.nama}</option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nis">Nomor Induk Siswa (NIS) *</Label>
                  <Input id="nis" required value={siswaForm.nis} onChange={e => setSiswaForm({ ...siswaForm, nis: e.target.value })} placeholder="Contoh: 12345" />
                  {!editingSiswa && <p className="text-xs text-on-surface-variant">NIS ini akan digunakan sebagai password default saat login pertama kali.</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nama">Nama Lengkap *</Label>
                  <Input id="nama" required value={siswaForm.nama} onChange={e => setSiswaForm({ ...siswaForm, nama: e.target.value })} placeholder="Nama Lengkap Siswa" />
                </div>
              </CardContent>
              <div className="bg-surface-container-low p-4 border-t border-outline-variant flex justify-end gap-3 rounded-b-xl">
                <Button type="button" variant="outline" onClick={() => setShowSiswaModal(false)}>Batal</Button>
                <Button type="submit" disabled={isSubmittingSiswa} className="bg-primary hover:bg-primary/90">
                  {isSubmittingSiswa ? 'Menyimpan...' : 'Simpan Siswa'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Modal Tambah Kelas */}
      {showKelasModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-inverse-surface/50 backdrop-blur-sm shadow-2xl">
          <Card className="w-full max-w-md border-0 animate-in fade-in zoom-in-95 duration-200">
            <CardHeader className="border-b border-outline-variant pb-4">
              <CardTitle>Buat Kelas Baru</CardTitle>
            </CardHeader>
            <form onSubmit={handleSaveKelas}>
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="namaKelas">Nama Kelas *</Label>
                  <Input id="namaKelas" required value={kelasForm.nama} onChange={e => setKelasForm({ ...kelasForm, nama: e.target.value })} placeholder="Contoh: X IPA 1" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tingkat">Tingkat *</Label>
                    <Select id="tingkat" value={kelasForm.tingkat} onChange={e => setKelasForm({ ...kelasForm, tingkat: e.target.value })}>
                      <option value="X">Kelas X</option>
                      <option value="XI">Kelas XI</option>
                      <option value="XII">Kelas XII</option>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tahunAjaran">Tahun Ajaran *</Label>
                    <Input id="tahunAjaran" required value={kelasForm.tahunAjaran} onChange={e => setKelasForm({ ...kelasForm, tahunAjaran: e.target.value })} placeholder="2023/2024" />
                  </div>
                </div>
              </CardContent>
              <div className="bg-surface-container-low p-4 border-t border-outline-variant flex justify-end gap-3 rounded-b-xl">
                <Button type="button" variant="outline" onClick={() => setShowKelasModal(false)}>Batal</Button>
                <Button type="submit" disabled={isSubmittingKelas} className="bg-primary hover:bg-primary/90">
                  {isSubmittingKelas ? 'Menyimpan...' : 'Simpan Kelas'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
