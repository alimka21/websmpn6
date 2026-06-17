import { toast } from 'sonner';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../../components/ui/button';
import { Input, Label } from '../../../components/ui/input';
import { Select } from '../../../components/ui/select';
import { Badge } from '../../../components/ui/badge';
import {
  Plus, Edit, Eye, Trash2, Calendar, Clock, FileText,
  Copy, Search, Users, AlertTriangle, BookOpen, CheckCircle2, PenLine
} from 'lucide-react';
import api from '../../../lib/api';
import { formatDate } from '../../../lib/utils';
import { ErrorState } from '../../../components/ui/ErrorState';
import { useModalA11y } from '../../../hooks/useModalA11y';

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-xs text-error mt-1">{msg}</p>;
}

interface EditForm {
  judul: string;
  mataPelajaran: string;
  tipeUjian: string;
  durasi: string;
  tanggalMulai: string;
  tanggalSelesai: string;
  kelasIds: string[];
}

export default function DaftarUjian() {
  const [ujianList, setUjianList] = useState<any[]>([]);
  const [kelasList, setKelasList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  // Edit modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingUjian, setEditingUjian] = useState<any>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    judul: '', mataPelajaran: '', tipeUjian: 'ULANGAN_HARIAN',
    durasi: '60', tanggalMulai: '', tanggalSelesai: '', kelasIds: []
  });
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingUjian, setDeletingUjian] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Duplicate
  const [isDuplicating, setIsDuplicating] = useState<string | null>(null);

  // Dashboard toggle state
  const [dashboardModal, setDashboardModal] = useState<{ open: boolean; ujian: any } | null>(null);
  const [dashJenis, setDashJenis]           = useState('UH');
  const [dashMateri, setDashMateri]         = useState('');
  const [dashSaving, setDashSaving]         = useState(false);

  const JENIS_NILAI_OPTIONS = [
    { value: 'UH', label: 'Ulangan Harian' },
    { value: 'UTS', label: 'UTS' },
    { value: 'UAS', label: 'UAS' },
    { value: 'PR', label: 'PR / Tugas Rumah' },
    { value: 'PRAKTEK', label: 'Praktek' },
    { value: 'LAINNYA', label: 'Lainnya' },
  ];

  const openDashboardModal = (ujian: any) => {
    setDashJenis(ujian.jenisNilai || 'UH');
    setDashMateri(ujian.materiNilai || '');
    setDashboardModal({ open: true, ujian });
  };

  const handleDashboardToggle = async (aktif: boolean) => {
    if (!dashboardModal) return;
    if (aktif && !dashJenis) { toast.error('Jenis nilai wajib dipilih'); return; }
    setDashSaving(true);
    try {
      await api.patch(`/api/guru/ujian/${dashboardModal.ujian.id}/dashboard-toggle`, {
        masukkanKeDashboard: aktif,
        jenisNilai: aktif ? dashJenis : undefined,
        materiNilai: aktif ? dashMateri : undefined,
      });
      toast.success(aktif ? 'Ujian ditambahkan ke Dashboard Tugas' : 'Ujian dikeluarkan dari Dashboard Tugas');
      setDashboardModal(null);
      fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Gagal mengubah pengaturan dashboard');
    } finally { setDashSaving(false); }
  };

  // Mapel list untuk edit modal
  const [mapelList, setMapelList] = useState<string[]>([]);

  // Modal a11y
  const editModalRef = useModalA11y<HTMLDivElement>(editModalOpen, () => setEditModalOpen(false));
  const deleteModalRef = useModalA11y<HTMLDivElement>(deleteModalOpen, () => { setDeleteModalOpen(false); setDeletingUjian(null); });

  const fetchData = async () => {
    try {
      setIsLoading(true);
      setErrorMsg(null);
      // Endpoint paginated — halaman ini punya filter/search client-side, ambil 100.
      const res = await api.get('/api/guru/ujian?limit=100');
      setUjianList(res?.data ?? []);
      if (res?.pagination?.total > 100) {
        toast.info(`Total ${res.pagination.total} ujian — hanya 100 terbaru ditampilkan.`);
      }
    } catch (error: any) {
      const msg = error?.message || 'Gagal memuat daftar ujian. Periksa koneksi Anda.';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchKelas = async () => {
    try {
      const res = await api.get('/api/guru/kelas');
      setKelasList(res);
    } catch (error: any) {
      toast.error(error?.message || 'Gagal memuat daftar kelas');
    }
  };

  useEffect(() => {
    fetchData();
    fetchKelas();
    api.get('/api/guru/mapel').then((res: any) => setMapelList(Array.isArray(res) ? res : [])).catch(() => {});
  }, []);

  const getStatus = (ujian: any) => {
    if (!ujian._count?.soal || ujian._count.soal === 0) return 'DRAFT';
    const now = new Date();
    const mulai = new Date(ujian.tanggalMulai);
    const selesai = new Date(ujian.tanggalSelesai);
    if (now < mulai) return 'AKAN_DATANG';
    if (now > selesai) return 'SELESAI';
    return 'BERLANGSUNG';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT': return <Badge variant="secondary">Draft</Badge>;
      case 'AKAN_DATANG': return <Badge variant="warning">Akan Datang</Badge>;
      case 'BERLANGSUNG': return <Badge variant="success">Berlangsung</Badge>;
      case 'SELESAI': return <Badge variant="default">Selesai</Badge>;
      default: return null;
    }
  };

  const filteredList = ujianList
    .filter(u => filterStatus === 'ALL' || getStatus(u) === filterStatus)
    .filter(u => !search.trim() || u.judul.toLowerCase().includes(search.toLowerCase()));

  const hasParticipants = (ujian: any) => (ujian._count?.sesiUjian || 0) > 0;

  // ── Edit modal ──────────────────────────────────────────────
  const toLocalISO = (d: string) => {
    const date = new Date(d);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };

  const handleOpenEdit = (ujian: any) => {
    setEditingUjian(ujian);
    setEditErrors({});
    setEditForm({
      judul: ujian.judul,
      mataPelajaran: ujian.mataPelajaran,
      tipeUjian: ujian.tipeUjian || 'ULANGAN_HARIAN',
      durasi: String(ujian.durasi),
      tanggalMulai: ujian.tanggalMulai ? toLocalISO(ujian.tanggalMulai) : '',
      tanggalSelesai: ujian.tanggalSelesai ? toLocalISO(ujian.tanggalSelesai) : '',
      kelasIds: ujian.kelas.map((uk: any) => uk.kelasId)
    });
    setEditModalOpen(true);
  };

  const toggleEditKelas = (kelasId: string) => {
    setEditForm(prev => ({
      ...prev,
      kelasIds: prev.kelasIds.includes(kelasId)
        ? prev.kelasIds.filter(id => id !== kelasId)
        : [...prev.kelasIds, kelasId]
    }));
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!editForm.judul.trim()) errs.judul = 'Judul wajib diisi';
    if (!editForm.mataPelajaran.trim()) errs.mataPelajaran = 'Mata pelajaran wajib diisi';
    if (!editForm.durasi || parseInt(editForm.durasi) < 5) errs.durasi = 'Durasi minimal 5 menit';
    if (!editForm.tanggalMulai) errs.tanggalMulai = 'Waktu dibuka wajib diisi';
    if (!editForm.tanggalSelesai) errs.tanggalSelesai = 'Waktu ditutup wajib diisi';
    if (editForm.tanggalMulai && editForm.tanggalSelesai &&
        new Date(editForm.tanggalSelesai) <= new Date(editForm.tanggalMulai)) {
      errs.tanggalSelesai = 'Waktu ditutup harus lebih besar dari waktu dibuka';
    }
    if (editForm.kelasIds.length === 0) errs.kelasIds = 'Pilih minimal satu kelas peserta';
    if (Object.keys(errs).length > 0) {
      setEditErrors(errs);
      return;
    }
    setEditErrors({});
    try {
      setIsSubmitting(true);
      await api.patch(`/api/guru/ujian/${editingUjian.id}`, {
        judul: editForm.judul,
        mataPelajaran: editForm.mataPelajaran,
        tipeUjian: editForm.tipeUjian,
        durasi: parseInt(editForm.durasi),
        tanggalMulai: editForm.tanggalMulai,
        tanggalSelesai: editForm.tanggalSelesai,
        kelasIds: editForm.kelasIds
      });
      toast.success('Informasi ujian berhasil diperbarui');
      setEditModalOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Gagal menyimpan perubahan');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Delete modal ─────────────────────────────────────────────
  const handleOpenDelete = (ujian: any) => {
    setDeletingUjian(ujian);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingUjian) return;
    try {
      setIsDeleting(true);
      await api.delete(`/api/guru/ujian/${deletingUjian.id}`);
      toast.success('Ujian berhasil dihapus');
      setDeleteModalOpen(false);
      setDeletingUjian(null);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Gagal menghapus ujian');
    } finally {
      setIsDeleting(false);
    }
  };

  // ── Duplicate ─────────────────────────────────────────────────
  const handleDuplikat = async (ujianId: string) => {
    try {
      setIsDuplicating(ujianId);
      await api.post(`/api/guru/ujian/${ujianId}/duplikat`);
      toast.success('Ujian berhasil diduplikat');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Gagal menduplikat ujian');
    } finally {
      setIsDuplicating(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-on-surface tracking-tight">Manajemen Ujian</h1>
          <p className="text-on-surface-variant mt-1">Daftar semua ujian yang telah Anda buat.</p>
        </div>
        <Button onClick={() => navigate('/dashboard/guru/ujian/baru')} className="gap-2">
          <Plus className="w-4 h-4" /> Buat Ujian Baru
        </Button>
      </div>

      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant overflow-hidden shadow-[0px_4px_20px_rgba(0,0,0,0.03)]">
        <div className="px-6 py-5 border-b border-outline-variant">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-xl font-semibold text-on-surface">Daftar Ujian</h2>
              <p className="text-sm text-on-surface-variant mt-0.5">Menampilkan {filteredList.length} ujian.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline-variant" />
                <Input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Cari judul ujian..."
                  className="pl-9 w-full sm:w-52"
                />
              </div>
              <div className="w-full sm:w-48">
                <Select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                  <option value="ALL">Semua Status</option>
                  <option value="DRAFT">Draft</option>
                  <option value="AKAN_DATANG">Akan Datang</option>
                  <option value="BERLANGSUNG">Berlangsung</option>
                  <option value="SELESAI">Selesai</option>
                </Select>
              </div>
            </div>
          </div>
        </div>
        <div className="p-6">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <div className="w-6 h-6 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
              <p className="text-sm text-on-surface-variant">Memuat data ujian...</p>
            </div>
          ) : errorMsg ? (
            <ErrorState message={errorMsg} onRetry={fetchData} />
          ) : filteredList.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <FileText className="w-10 h-10 text-outline mx-auto" />
              <p className="text-on-surface font-medium">Tidak ada ujian</p>
              <p className="text-sm text-on-surface-variant">Belum ada ujian yang sesuai dengan filter.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-outline-variant">
                    <th className="px-5 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Informasi Ujian</th>
                    <th className="px-5 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Waktu Pelaksanaan</th>
                    <th className="px-5 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider text-center">Soal</th>
                    <th className="px-5 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider text-center">Status</th>
                    <th className="px-5 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/40">
                  {filteredList.map((ujian) => {
                    const status = getStatus(ujian);
                    return (
                      <tr key={ujian.id} className="hover:bg-surface-container-low/50 transition-colors group">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-on-surface">{ujian.judul}</span>
                            {ujian.isOwner === false && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-tertiary-fixed/40 text-on-tertiary-fixed">Lihat Saja</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 mb-1">
                            <Badge variant="outline" className="text-[10px] uppercase font-medium">{ujian.tipeUjian}</Badge>
                            <span className="text-xs text-on-surface-variant">&bull; {ujian.mataPelajaran}</span>
                          </div>
                          <div className="text-xs text-on-surface-variant">
                            Kelas: {ujian.kelas?.map((k: any) => k.kelas?.nama).filter(Boolean).join(', ') || '-'}
                          </div>
                          {ujian.isOwner === false && ujian.guru && (
                            <div className="text-xs text-on-surface-variant mt-0.5">
                              Oleh: {ujian.guru.nama}
                            </div>
                          )}
                          {hasParticipants(ujian) && (
                            <div className="flex items-center gap-1 mt-1.5 text-xs text-outline-variant">
                              <Users className="w-3 h-3" />
                              {ujian._count?.sesiUjian ?? 0} peserta
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-4 align-top">
                          <div className="flex flex-col gap-1.5 text-xs text-on-surface-variant">
                            <span className="flex items-center gap-1.5 font-medium">
                              <Calendar className="w-3.5 h-3.5 text-primary" />
                              {formatDate(ujian.tanggalMulai, 'datetime')}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-outline-variant" />
                              {formatDate(ujian.tanggalSelesai, 'datetime')}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-outline-variant" />
                              {ujian.durasi} Menit
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center align-top">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-surface-container text-on-surface font-semibold text-sm border border-outline-variant">
                            {ujian._count?.soal || 0}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center align-top">
                          {getStatusBadge(status)}
                        </td>
                        <td className="px-4 py-4 align-middle">
                          <div className="flex flex-col gap-1.5 items-center">
                            <div className="flex gap-1.5">
                              <Button
                                variant="outline" size="sm"
                                onClick={() => navigate(`/dashboard/guru/ujian/${ujian.id}/soal`)}
                                className="bg-white h-8 px-2.5 gap-1 text-xs"
                                title={ujian.isOwner === false ? 'Lihat Soal' : 'Kelola Soal'}
                              >
                                <BookOpen className="w-3.5 h-3.5 text-primary" /> Soal
                              </Button>
                              {ujian.isOwner !== false && (
                                <Button
                                  variant="outline" size="sm"
                                  onClick={() => handleOpenEdit(ujian)}
                                  className="bg-white h-8 px-2.5 gap-1 text-xs"
                                  title="Edit Info Ujian"
                                >
                                  <Edit className="w-3.5 h-3.5 text-on-surface-variant" /> Edit
                                </Button>
                              )}
                            </div>
                            <div className="flex gap-1.5">
                              {(status === 'SELESAI' || status === 'BERLANGSUNG') && (
                                <Button
                                  variant="outline" size="sm"
                                  onClick={() => navigate(`/dashboard/guru/rekap?ujianId=${ujian.id}`)}
                                  className="bg-white h-8 px-2.5 gap-1 text-xs"
                                  title="Lihat Hasil"
                                >
                                  <Eye className="w-3.5 h-3.5 text-secondary" /> Hasil
                                </Button>
                              )}
                              {status === 'SELESAI' && (
                                <Button
                                  variant="outline" size="sm"
                                  onClick={() => openDashboardModal(ujian)}
                                  className={`h-8 px-2.5 gap-1 text-xs ${ujian.masukkanKeDashboard ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-white'}`}
                                  title="Masukkan ke Dashboard Tugas"
                                >
                                  <BookOpen className="w-3.5 h-3.5" />
                                  {ujian.masukkanKeDashboard ? 'Di Dashboard' : 'Dashboard'}
                                </Button>
                              )}
                              {ujian.adaUraian && (status === 'SELESAI' || status === 'BERLANGSUNG') && (
                                <Button
                                  variant="outline" size="sm"
                                  onClick={() => navigate(`/dashboard/guru/ujian/${ujian.id}/koreksi`)}
                                  className="bg-white h-8 px-2.5 gap-1 text-xs border-amber-300 hover:bg-amber-50"
                                  title="Koreksi Jawaban Uraian/Esai"
                                >
                                  <PenLine className="w-3.5 h-3.5 text-amber-600" /> Koreksi
                                </Button>
                              )}
                              {ujian.isOwner !== false && (
                                <>
                                  <Button
                                    variant="outline" size="sm"
                                    onClick={() => handleDuplikat(ujian.id)}
                                    disabled={isDuplicating === ujian.id}
                                    className="bg-white h-8 px-2 text-xs"
                                    title="Duplikat Ujian"
                                  >
                                    {isDuplicating === ujian.id
                                      ? <div className="w-3.5 h-3.5 border-2 border-outline/40 border-t-slate-500 rounded-full animate-spin" />
                                      : <Copy className="w-3.5 h-3.5 text-on-surface-variant" />
                                    }
                                  </Button>
                                  <Button
                                    variant="outline" size="sm"
                                    onClick={() => handleOpenDelete(ujian)}
                                    className="bg-white hover:bg-error-container hover:border-error/20 h-8 px-2"
                                    title="Hapus Ujian"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-error" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Modal Edit Info Ujian ─────────────────────────────── */}
      {editModalOpen && editingUjian && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-inverse-surface/50 backdrop-blur-sm overflow-y-auto">
          <div
            ref={editModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-ujian-title"
            className="w-full max-w-2xl bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-xl my-auto overflow-hidden"
          >
            <div className="px-6 py-5 bg-surface-container-low border-b border-outline-variant">
              <div className="flex justify-between items-center">
                <h2 id="edit-ujian-title" className="text-xl font-semibold text-on-surface">Edit Info Ujian</h2>
                <Button variant="ghost" size="sm" onClick={() => setEditModalOpen(false)} aria-label="Tutup modal">Tutup</Button>
              </div>
            </div>
            <form onSubmit={handleSaveEdit}>
              <div className="px-6 pt-6 pb-4 space-y-5 max-h-[65vh] overflow-y-auto">
                <div className="space-y-2">
                  <Label htmlFor="edit-judul">Judul Ujian <span className="text-error">*</span></Label>
                  <Input
                    id="edit-judul"
                    value={editForm.judul}
                    onChange={e => setEditForm({ ...editForm, judul: e.target.value })}
                    className={editErrors.judul ? 'border-error' : ''}
                  />
                  <FieldError msg={editErrors.judul} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-mapel">Mata Pelajaran <span className="text-error">*</span></Label>
                    {mapelList.length > 0 ? (
                      <Select
                        id="edit-mapel"
                        value={editForm.mataPelajaran}
                        onChange={e => setEditForm({ ...editForm, mataPelajaran: e.target.value })}
                        className={editErrors.mataPelajaran ? 'border-error' : ''}
                      >
                        <option value="">-- Pilih Mata Pelajaran --</option>
                        {mapelList.map(m => <option key={m} value={m}>{m}</option>)}
                      </Select>
                    ) : (
                      <Input
                        id="edit-mapel"
                        value={editForm.mataPelajaran}
                        onChange={e => setEditForm({ ...editForm, mataPelajaran: e.target.value })}
                        className={editErrors.mataPelajaran ? 'border-error' : ''}
                      />
                    )}
                    <FieldError msg={editErrors.mataPelajaran} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-durasi">Durasi (Menit) <span className="text-error">*</span></Label>
                    <Input
                      id="edit-durasi"
                      type="number"
                      min="5"
                      value={editForm.durasi}
                      onChange={e => setEditForm({ ...editForm, durasi: e.target.value })}
                      className={editErrors.durasi ? 'border-error' : ''}
                    />
                    <FieldError msg={editErrors.durasi} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Tipe Ujian</Label>
                  <div className="flex flex-wrap gap-2">
                    {['LATIHAN', 'ULANGAN_HARIAN', 'UTS', 'UAS'].map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setEditForm({ ...editForm, tipeUjian: t })}
                        className={`px-4 py-2 rounded-full border text-sm font-medium transition-all ${
                          editForm.tipeUjian === t
                            ? 'border-primary bg-primary-container/15 text-primary'
                            : 'border-outline-variant text-on-surface-variant hover:border-outline-variant hover:bg-surface-container-low'
                        }`}
                      >
                        {t.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-mulai">Waktu Dibuka <span className="text-error">*</span></Label>
                    <Input
                      id="edit-mulai"
                      type="datetime-local"
                      value={editForm.tanggalMulai}
                      onChange={e => setEditForm({ ...editForm, tanggalMulai: e.target.value })}
                      className={editErrors.tanggalMulai ? 'border-error' : ''}
                    />
                    <FieldError msg={editErrors.tanggalMulai} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-selesai">Waktu Ditutup <span className="text-error">*</span></Label>
                    <Input
                      id="edit-selesai"
                      type="datetime-local"
                      value={editForm.tanggalSelesai}
                      onChange={e => setEditForm({ ...editForm, tanggalSelesai: e.target.value })}
                      className={editErrors.tanggalSelesai ? 'border-error' : ''}
                    />
                    <FieldError msg={editErrors.tanggalSelesai} />
                  </div>
                </div>
                <div className="space-y-3">
                  <Label>Kelas Peserta <span className="text-error">*</span></Label>
                  {kelasList.length === 0 ? (
                    <p className="text-sm text-on-surface-variant border border-dashed border-outline-variant rounded-lg p-3 text-center">
                      Tidak ada kelas tersedia.
                    </p>
                  ) : (
                    <div className={`flex flex-wrap gap-2 ${editErrors.kelasIds ? 'p-2 border border-error/40 rounded-lg bg-error-container/30' : ''}`}>
                      {kelasList.map(k => {
                        const selected = editForm.kelasIds.includes(k.id);
                        return (
                          <button
                            key={k.id}
                            type="button"
                            onClick={() => toggleEditKelas(k.id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium transition-all ${
                              selected
                                ? 'bg-primary border-primary text-white'
                                : 'border-outline-variant text-on-surface hover:border-outline-variant hover:bg-surface-container-low'
                            }`}
                          >
                            {selected && <CheckCircle2 className="w-3.5 h-3.5" />}
                            {k.nama}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <FieldError msg={editErrors.kelasIds} />
                </div>
              </div>
              <div className="bg-surface-container-low px-6 py-4 border-t border-outline-variant flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setEditModalOpen(false)} disabled={isSubmitting}>
                  Batal
                </Button>
                <Button type="submit" disabled={isSubmitting} className="bg-primary hover:bg-primary/90">
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal Konfirmasi Hapus ────────────────────────────── */}
      {deleteModalOpen && deletingUjian && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-inverse-surface/50 backdrop-blur-sm">
          <div
            ref={deleteModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-ujian-title"
            className="w-full max-w-md bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-xl overflow-hidden"
          >
            <div className="px-6 py-5 border-b border-outline-variant">
              <h2 id="delete-ujian-title" className="text-xl font-semibold text-on-surface">Hapus Ujian?</h2>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-on-surface-variant">Anda akan menghapus ujian:</p>
              <p className="font-semibold text-on-surface bg-surface-container-low p-3 rounded-lg border border-outline-variant">
                {deletingUjian.judul}
              </p>

              {hasParticipants(deletingUjian) ? (
                <div className="bg-error-container border border-error/20 rounded-lg p-3 text-sm text-error flex gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Ujian ini sudah dikerjakan oleh <strong>{deletingUjian._count?.sesiUjian ?? 0} siswa</strong> dan tidak dapat dihapus. Hubungi Administrator jika perlu menghapus paksa.
                  </span>
                </div>
              ) : (
                <div className="bg-tertiary-fixed/50 border border-tertiary-fixed rounded-lg p-3 text-sm text-on-tertiary-fixed flex gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Semua soal ({deletingUjian._count?.soal || 0} soal) akan ikut terhapus. Tindakan ini tidak dapat dibatalkan.
                  </span>
                </div>
              )}
            </div>
            <div className="px-6 py-4 bg-surface-container-low border-t border-outline-variant flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => { setDeleteModalOpen(false); setDeletingUjian(null); }}
                disabled={isDeleting}
              >
                Batal
              </Button>
              <Button
                onClick={handleConfirmDelete}
                disabled={isDeleting || hasParticipants(deletingUjian)}
                className="bg-error hover:bg-error/90 text-white disabled:opacity-50"
              >
                {isDeleting ? 'Menghapus...' : 'Ya, Hapus Ujian'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Toggle Dashboard Tugas ── */}
      {dashboardModal?.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-xl p-6 space-y-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                <BookOpen className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-on-surface">Dashboard Tugas</h3>
                <p className="text-xs text-on-surface-variant mt-1">Ujian: <strong>{dashboardModal.ujian.judul}</strong></p>
              </div>
            </div>

            <p className="text-sm text-on-surface-variant">
              {dashboardModal.ujian.masukkanKeDashboard
                ? 'Ujian ini sedang ditampilkan di Dashboard Tugas publik. Anda bisa mengubah info atau menonaktifkannya.'
                : 'Aktifkan agar nilai ujian ini tampil di Dashboard Tugas publik. Isi jenis dan materi agar mudah diidentifikasi.'}
            </p>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-on-surface-variant">Jenis Nilai <span className="text-error">*</span></label>
                <select value={dashJenis} onChange={e => setDashJenis(e.target.value)}
                  className="w-full px-3 py-2 border border-outline-variant rounded-xl text-sm focus:border-primary outline-none bg-surface appearance-none">
                  {JENIS_NILAI_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-on-surface-variant">Materi / Bab (opsional)</label>
                <input type="text" value={dashMateri} onChange={e => setDashMateri(e.target.value)}
                  placeholder="Contoh: Bab 5 — Reproduksi"
                  className="w-full px-3 py-2 border border-outline-variant rounded-xl text-sm focus:border-primary outline-none bg-surface" />
              </div>
            </div>

            <div className="flex gap-3 flex-wrap">
              <button onClick={() => setDashboardModal(null)}
                className="flex-1 px-4 py-2.5 border border-outline-variant rounded-xl text-sm font-semibold text-on-surface-variant hover:bg-surface-container transition-colors">
                Batal
              </button>
              {dashboardModal.ujian.masukkanKeDashboard && (
                <button onClick={() => handleDashboardToggle(false)} disabled={dashSaving}
                  className="px-4 py-2.5 border border-error/30 text-error rounded-xl text-sm font-semibold hover:bg-error/5 disabled:opacity-50 transition-colors">
                  Nonaktifkan
                </button>
              )}
              <button onClick={() => handleDashboardToggle(true)} disabled={dashSaving}
                className="flex-1 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                {dashSaving && <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {dashboardModal.ujian.masukkanKeDashboard ? 'Simpan Perubahan' : 'Aktifkan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
