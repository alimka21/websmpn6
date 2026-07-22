import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, Pencil, Trash2, Search, KeyRound, Users, GraduationCap, BookOpen, AlertTriangle, Download, Upload, CheckCircle2, XCircle, Camera, X as XIcon, Loader2 } from 'lucide-react';
import ExcelJS from 'exceljs';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input, Label } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Pagination } from '../../components/ui/pagination';
import { ErrorState } from '../../components/ui/ErrorState';
import { useModalA11y } from '../../hooks/useModalA11y';
import { useSiteConfig, tingkatOptions } from '../../hooks/useSiteConfig';
import { toast } from 'sonner';
import api from '../../lib/api';

const ITEMS_PER_PAGE = 30;

interface SiswaUser {
  id: string;
  email: string;
  isActive: boolean;
  siswa: {
    id: string;
    nama: string;
    nis: string;
    rfidKode?: string | null;
    kelasId: string;
    kelas: {
      id: string;
      nama: string;
      tingkat: string;
      guru: { id: string; nama: string } | null;
    }
  };
}

interface GuruUser {
  id: string;
  email: string;
  isActive: boolean;
  guru: {
    id: string;
    nama: string;
    nip: string;
    mataPelajaran: string;
    fotoUrl?: string | null;
    guruMataPelajaran?: { id: string; nama: string }[];
    kelas?: { id: string; nama: string }[];
    guruKelas?: { kelas: { id: string; nama: string } }[];
  };
}

// Kompres gambar portrait di client sebelum upload (max 400x600, JPEG 82%)
async function compressPortrait(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = e => { img.src = e.target?.result as string; };
    reader.onerror = reject;
    img.onload = () => {
      const MAX_W = 400, MAX_H = 600;
      let { width, height } = img;
      const ratio = Math.min(MAX_W / width, MAX_H / height, 1);
      width  = Math.round(width  * ratio);
      height = Math.round(height * ratio);
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('Gagal kompres gambar')), 'image/jpeg', 0.82);
    };
    img.onerror = reject;
    reader.readAsDataURL(file);
  });
}

interface KelasItem {
  id: string;
  nama: string;
  tingkat: string;
  tahunAjaran: string;
  guruId: string;
  guru: { id: string; nama: string };
  _count: { siswa: number };
}

interface DeleteConfirm { id: string; nama: string; type: 'SISWA' | 'GURU' | 'KELAS' }
interface ResetConfirm { userId: string; nama: string; resetTo: string }

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-xs text-error mt-1">{msg}</p>;
}

function Spinner() {
  return <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin mr-2" />;
}

export default function ManageUsers() {
  const [activeTab, setActiveTab] = useState<'SISWA' | 'GURU' | 'KELAS'>('SISWA');
  const siteConfig = useSiteConfig();
  const tingkatList = tingkatOptions(siteConfig.jenjang);

  // ── Data ──
  const [siswaList, setSiswaList] = useState<SiswaUser[]>([]);
  const [guruList, setGuruList] = useState<GuruUser[]>([]);
  const [kelasList, setKelasList] = useState<KelasItem[]>([]);
  const [isLoadingSiswa, setIsLoadingSiswa] = useState(true);
  const [isLoadingGuru, setIsLoadingGuru] = useState(true);
  const [isLoadingKelas, setIsLoadingKelas] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ── Search / Filter ──
  const [siswaSearch, setSiswaSearch] = useState('');
  const [siswaFilterKelas, setSiswaFilterKelas] = useState('ALL');
  const [guruSearch, setGuruSearch] = useState('');
  const [kelasSearch, setKelasSearch] = useState('');

  // ── Siswa Modal ──
  const [showSiswaModal, setShowSiswaModal] = useState(false);
  const [editingSiswaId, setEditingSiswaId] = useState<string | null>(null);
  const [siswaForm, setSiswaForm] = useState({ nis: '', nama: '', kelasId: '', rfidKode: '' });
  const [siswaErrors, setSiswaErrors] = useState<Record<string, string>>({});
  const [isSubmittingSiswa, setIsSubmittingSiswa] = useState(false);

  // ── Guru Modal ──
  const [showGuruModal, setShowGuruModal] = useState(false);
  const [editingGuruId, setEditingGuruId] = useState<string | null>(null);
  const [guruForm, setGuruForm] = useState({ nip: '', nama: '', email: '', password: '', rfidKode: '' });
  const [guruMapelList, setGuruMapelList] = useState<string[]>([]);
  const [guruMapelInput, setGuruMapelInput] = useState('');
  const [guruErrors, setGuruErrors] = useState<Record<string, string>>({});
  const [isSubmittingGuru, setIsSubmittingGuru] = useState(false);

  // ── Foto Guru ──
  const [guruCurrentFoto, setGuruCurrentFoto]   = useState<string | null>(null);
  const [editingGuruModelId, setEditingGuruModelId] = useState<string | null>(null);
  const [fotoPreview, setFotoPreview]           = useState<string | null>(null);
  const [fotoFile, setFotoFile]                 = useState<File | null>(null);
  const [isUploadingFoto, setIsUploadingFoto]   = useState(false);
  const fotoInputRef                            = useRef<HTMLInputElement>(null);

  // ── Kelas Modal ──
  const [showKelasModal, setShowKelasModal] = useState(false);
  const [editingKelasId, setEditingKelasId] = useState<string | null>(null);
  const [kelasForm, setKelasForm] = useState({ nama: '', tingkat: String(tingkatList[0] ?? 1), tahunAjaran: '2025/2026', guruId: '' });
  const [kelasTeacherIds, setKelasTeacherIds] = useState<string[]>([]);
  const [kelasErrors, setKelasErrors] = useState<Record<string, string>>({});
  const [isSubmittingKelas, setIsSubmittingKelas] = useState(false);

  // ── Manage Guru Kelas Modal ──
  const [showManageKelasGuruModal, setShowManageKelasGuruModal] = useState(false);
  const [selectedGuruForKelas, setSelectedGuruForKelas] = useState<GuruUser | null>(null);
  const [availableKelasForGuru, setAvailableKelasForGuru] = useState<KelasItem[]>([]);
  const [isLoadingGuruKelas, setIsLoadingGuruKelas] = useState(false);

  // ── Shared Modals ──
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirm | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [resetConfirm, setResetConfirm] = useState<ResetConfirm | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  // ── Pagination ──
  const [siswaPage, setSiswaPage] = useState(1);
  const [guruPage, setGuruPage] = useState(1);
  const [kelasPage, setKelasPage] = useState(1);

  // Reset page on search/filter change
  useEffect(() => { setSiswaPage(1); }, [siswaSearch, siswaFilterKelas]);
  useEffect(() => { setGuruPage(1); }, [guruSearch]);
  useEffect(() => { setKelasPage(1); }, [kelasSearch]);

  // ── Bulk select siswa ──
  const [selectedSiswaIds, setSelectedSiswaIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  useEffect(() => { setSelectedSiswaIds(new Set()); }, [siswaSearch, siswaFilterKelas]);
  const bulkDeleteModalRef = useModalA11y<HTMLDivElement>(showBulkDeleteConfirm, () => setShowBulkDeleteConfirm(false));

  // ── Modal a11y refs ──
  const siswaModalRef = useModalA11y<HTMLDivElement>(showSiswaModal, () => setShowSiswaModal(false));
  const guruModalRef = useModalA11y<HTMLDivElement>(showGuruModal, () => setShowGuruModal(false));
  const kelasModalRef = useModalA11y<HTMLDivElement>(showKelasModal, () => setShowKelasModal(false));
  const manageKelasGuruModalRef = useModalA11y<HTMLDivElement>(showManageKelasGuruModal, () => setShowManageKelasGuruModal(false));
  const deleteModalRef = useModalA11y<HTMLDivElement>(deleteConfirm !== null, () => setDeleteConfirm(null));
  const resetModalRef = useModalA11y<HTMLDivElement>(resetConfirm !== null, () => setResetConfirm(null));

  // ── Import state ──
  type ImportType = 'siswa' | 'guru';
  type ImportResult = { created: number; skipped: number; failed: { row: number; message: string }[] } | null;
  const [importing, setImporting] = useState<ImportType | null>(null);
  const [importResult, setImportResult] = useState<ImportResult>(null);
  const [importResultType, setImportResultType] = useState<ImportType>('siswa');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingImportType = useRef<ImportType>('siswa');
  const importResultModalRef = useModalA11y<HTMLDivElement>(importResult !== null, () => setImportResult(null));

  // ── Fetch ──
  // TODO: GET /api/admin/users sekarang server-side paginated. Halaman ini
  // masih pakai client-side filter (search + filter kelas), jadi sementara
  // ambil 100 per role. Kalau dataset > 100, refactor jadi server-side search.
  const fetchSiswa = async () => {
    try {
      setIsLoadingSiswa(true);
      const res = await api.get('/api/admin/users?role=SISWA&limit=100');
      setSiswaList(res.data ?? []);
      setErrorMsg(null);
      if (res.pagination?.total > 100) {
        toast.info(`Total ${res.pagination.total} siswa — hanya 100 pertama yang ditampilkan. Refactor server-search akan datang.`);
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Gagal memuat data siswa');
      toast.error(e.message || 'Gagal memuat data siswa');
    }
    finally { setIsLoadingSiswa(false); }
  };

  const fetchGuru = async () => {
    try {
      setIsLoadingGuru(true);
      const res = await api.get('/api/admin/users?role=GURU&limit=100');
      setGuruList(res.data ?? []);
      setErrorMsg(null);
      if (res.pagination?.total > 100) {
        toast.info(`Total ${res.pagination.total} guru — hanya 100 pertama ditampilkan.`);
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Gagal memuat data guru');
      toast.error(e.message || 'Gagal memuat data guru');
    }
    finally { setIsLoadingGuru(false); }
  };

  const fetchKelas = async () => {
    try {
      setIsLoadingKelas(true);
      const res = await api.get('/api/admin/kelas');
      setKelasList(res);
      setErrorMsg(null);
    } catch (e: any) {
      setErrorMsg(e.message || 'Gagal memuat data kelas');
      toast.error(e.message || 'Gagal memuat data kelas');
    }
    finally { setIsLoadingKelas(false); }
  };

  const openManageKelasGuruModal = async (guru: GuruUser) => {
    setSelectedGuruForKelas(guru);
    setShowManageKelasGuruModal(true);
    setIsLoadingGuruKelas(true);

    try {
      // Fetch all kelas
      const allKelas = await api.get('/api/admin/kelas');
      setAvailableKelasForGuru(allKelas);
    } catch (e: any) {
      toast.error('Gagal memuat data kelas');
    } finally {
      setIsLoadingGuruKelas(false);
    }
  };

  const handleAddKelasToGuru = async (kelasId: string) => {
    if (!selectedGuruForKelas) return;

    try {
      await api.post(`/api/admin/guru/${selectedGuruForKelas.guru.id}/kelas`, { kelasId });
      toast.success('Kelas berhasil ditambahkan');
      await fetchGuru(); // Reload data
      // Update selected guru
      const updated = await api.get(`/api/admin/users?role=GURU`);
      const updatedList: GuruUser[] = Array.isArray(updated) ? updated : (updated?.data ?? []);
      const updatedGuru = updatedList.find((u: GuruUser) => u.id === selectedGuruForKelas.id);
      if (updatedGuru) setSelectedGuruForKelas(updatedGuru);
    } catch (e: any) {
      toast.error(e.message || 'Gagal menambahkan kelas');
    }
  };

  const handleRemoveKelasFromGuru = async (kelasId: string) => {
    if (!selectedGuruForKelas) return;

    try {
      await api.delete(`/api/admin/guru/${selectedGuruForKelas.guru.id}/kelas/${kelasId}`);
      toast.success('Kelas berhasil dihapus');
      await fetchGuru();
      // Update selected guru
      const updated = await api.get(`/api/admin/users?role=GURU`);
      const updatedList: GuruUser[] = Array.isArray(updated) ? updated : (updated?.data ?? []);
      const updatedGuru = updatedList.find((u: GuruUser) => u.id === selectedGuruForKelas.id);
      if (updatedGuru) setSelectedGuruForKelas(updatedGuru);
    } catch (e: any) {
      toast.error(e.message || 'Gagal menghapus kelas');
    }
  };

  const retryAll = () => {
    fetchSiswa();
    fetchGuru();
    fetchKelas();
  };

  useEffect(() => { retryAll(); }, []);

  // ── Filtered Lists ──
  const filteredSiswa = siswaList.filter(u => {
    const q = siswaSearch.toLowerCase();
    const match = u.siswa?.nama?.toLowerCase().includes(q) || u.siswa?.nis?.toLowerCase().includes(q);

    // Filter kelas: ALL = tampilkan semua, atau cocokkan dengan kelasId
    const matchKelas = siswaFilterKelas === 'ALL' || u.siswa?.kelasId === siswaFilterKelas;

    return match && matchKelas;
  });

  const filteredGuru = guruList.filter(u => {
    const q = guruSearch.toLowerCase();
    return u.guru?.nama?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
  });

  const filteredKelas = kelasList.filter(k => k.nama.toLowerCase().includes(kelasSearch.toLowerCase()));

  // Paginated slices
  const paginatedSiswa = filteredSiswa.slice((siswaPage - 1) * ITEMS_PER_PAGE, siswaPage * ITEMS_PER_PAGE);
  const paginatedGuru = filteredGuru.slice((guruPage - 1) * ITEMS_PER_PAGE, guruPage * ITEMS_PER_PAGE);
  const paginatedKelas = filteredKelas.slice((kelasPage - 1) * ITEMS_PER_PAGE, kelasPage * ITEMS_PER_PAGE);

  // ── Siswa Handlers ──
  const openSiswaModal = (u?: SiswaUser) => {
    setSiswaErrors({});
    if (u) {
      setEditingSiswaId(u.id);
      setSiswaForm({ nis: u.siswa.nis, nama: u.siswa.nama, kelasId: u.siswa.kelasId, rfidKode: u.siswa.rfidKode || '' });
    } else {
      setEditingSiswaId(null);
      setSiswaForm({ nis: '', nama: '', kelasId: kelasList[0]?.id || '', rfidKode: '' });
    }
    setShowSiswaModal(true);
  };

  const handleSaveSiswa = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!siswaForm.nis.trim()) errs.nis = 'NIS wajib diisi';
    if (!siswaForm.nama.trim()) errs.nama = 'Nama wajib diisi';
    if (!siswaForm.kelasId) errs.kelasId = 'Pilih kelas';
    if (Object.keys(errs).length) { setSiswaErrors(errs); return; }

    try {
      setIsSubmittingSiswa(true);
      if (editingSiswaId) {
        await api.patch(`/api/admin/users/${editingSiswaId}`, {
          nama: siswaForm.nama, nis: siswaForm.nis, kelasId: siswaForm.kelasId,
          rfidKode: siswaForm.rfidKode,
        });
        toast.success('Data siswa berhasil diperbarui');
      } else {
        await api.post('/api/admin/users', {
          role: 'SISWA',
          email: `${siswaForm.nis}@siswa.sch.id`,
          password: siswaForm.nis,
          nama: siswaForm.nama,
          nis: siswaForm.nis,
          kelasId: siswaForm.kelasId,
          ...(siswaForm.rfidKode ? { rfidKode: siswaForm.rfidKode } : {}),
        });
        toast.success('Siswa berhasil ditambahkan');
      }
      setShowSiswaModal(false);
      fetchSiswa();
    } catch (e: any) { toast.error(e.message || 'Gagal menyimpan data siswa'); }
    finally { setIsSubmittingSiswa(false); }
  };

  // ── Guru Handlers ──
  const addGuruMapel = () => {
    const val = guruMapelInput.trim();
    if (!val || guruMapelList.includes(val)) return;
    setGuruMapelList(prev => [...prev, val]);
    setGuruMapelInput('');
  };

  const openGuruModal = (u?: GuruUser) => {
    setGuruErrors({});
    setFotoPreview(null);
    setFotoFile(null);
    if (u) {
      setEditingGuruId(u.id);
      setEditingGuruModelId(u.guru.id);
      setGuruForm({ nip: u.guru.nip || '', nama: u.guru.nama, email: u.email, password: '', rfidKode: (u.guru as any).rfidKode || '' });
      const existing = u.guru.guruMataPelajaran?.map(m => m.nama) ?? (u.guru.mataPelajaran ? [u.guru.mataPelajaran] : []);
      setGuruMapelList(existing);
      setGuruCurrentFoto(u.guru.fotoUrl ?? null);
    } else {
      setEditingGuruId(null);
      setEditingGuruModelId(null);
      setGuruForm({ nip: '', nama: '', email: '', password: '', rfidKode: '' });
      setGuruMapelList([]);
      setGuruCurrentFoto(null);
    }
    setGuruMapelInput('');
    setShowGuruModal(true);
  };

  const handleFotoChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Format foto harus JPEG, PNG, atau WEBP');
      return;
    }
    setFotoFile(file);
    const url = URL.createObjectURL(file);
    setFotoPreview(url);
  }, []);

  const handleUploadFoto = useCallback(async (guruId: string) => {
    if (!fotoFile) return;
    setIsUploadingFoto(true);
    try {
      const compressed = await compressPortrait(fotoFile);
      const fd = new FormData();
      fd.append('foto', compressed, 'foto-guru.jpg');
      const res: any = await api.postForm(`/api/admin/guru/${guruId}/foto`, fd);
      setGuruCurrentFoto(res.url);
      setFotoPreview(null);
      setFotoFile(null);
      toast.success('Foto profil berhasil diunggah');
      fetchGuru();
    } catch { toast.error('Gagal mengunggah foto'); }
    finally { setIsUploadingFoto(false); }
  }, [fotoFile]);

  const handleHapusFoto = useCallback(async (guruId: string) => {
    try {
      await api.delete(`/api/admin/guru/${guruId}/foto`);
      setGuruCurrentFoto(null);
      setFotoPreview(null);
      setFotoFile(null);
      toast.success('Foto profil dihapus');
      fetchGuru();
    } catch { toast.error('Gagal menghapus foto'); }
  }, []);

  const handleSaveGuru = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!guruForm.nama.trim()) errs.nama = 'Nama wajib diisi';
    if (!guruForm.email.trim()) errs.email = 'Email wajib diisi';
    if (guruMapelList.length === 0) errs.mataPelajaran = 'Minimal 1 mata pelajaran wajib diisi';
    if (!editingGuruId && !guruForm.password.trim()) errs.password = 'Password wajib diisi';
    if (Object.keys(errs).length) { setGuruErrors(errs); return; }

    try {
      setIsSubmittingGuru(true);
      if (editingGuruId) {
        await api.patch(`/api/admin/users/${editingGuruId}`, {
          email: guruForm.email, nama: guruForm.nama, nip: guruForm.nip,
          mataPelajaranList: guruMapelList,
          rfidKode: guruForm.rfidKode,
        });
        toast.success('Data guru berhasil diperbarui');
      } else {
        await api.post('/api/admin/users', {
          role: 'GURU',
          email: guruForm.email,
          password: guruForm.password,
          nama: guruForm.nama,
          nip: guruForm.nip || crypto.randomUUID(),
          mataPelajaranList: guruMapelList,
        });
        toast.success('Guru berhasil ditambahkan');
      }
      setShowGuruModal(false);
      fetchGuru();
    } catch (e: any) { toast.error(e.message || 'Gagal menyimpan data guru'); }
    finally { setIsSubmittingGuru(false); }
  };

  // ── Kelas Handlers ──
  const openKelasModal = (k?: KelasItem) => {
    setKelasErrors({});
    if (k) {
      setEditingKelasId(k.id);
      setKelasForm({ nama: k.nama, tingkat: k.tingkat, tahunAjaran: k.tahunAjaran, guruId: k.guruId });
      setKelasTeacherIds((k as any).guruKelas?.map((gk: any) => gk.guruId) ?? []);
    } else {
      setEditingKelasId(null);
      setKelasForm({ nama: '', tingkat: String(tingkatList[0] ?? 1), tahunAjaran: '2025/2026', guruId: guruList[0]?.guru?.id || '' });
      setKelasTeacherIds([]);
    }
    setShowKelasModal(true);
  };

  const handleSaveKelas = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!kelasForm.nama.trim()) errs.nama = 'Nama kelas wajib diisi';
    if (!kelasForm.tahunAjaran.trim()) errs.tahunAjaran = 'Tahun ajaran wajib diisi';
    if (!kelasForm.guruId) errs.guruId = 'Pilih wali kelas';
    if (Object.keys(errs).length) { setKelasErrors(errs); return; }

    try {
      setIsSubmittingKelas(true);
      let savedId = editingKelasId;
      if (editingKelasId) {
        await api.patch(`/api/admin/kelas/${editingKelasId}`, kelasForm);
        toast.success('Kelas berhasil diperbarui');
      } else {
        const res = await api.post('/api/admin/kelas', kelasForm);
        savedId = res.id;
        toast.success('Kelas berhasil ditambahkan');
      }
      // Sync daftar guru pengajar (exclude wali kelas agar tidak duplikasi di GuruKelas)
      if (savedId) {
        const teacherIdsWithoutWali = kelasTeacherIds.filter(id => id !== kelasForm.guruId);
        await api.put(`/api/admin/kelas/${savedId}/guru`, { teacherIds: teacherIdsWithoutWali });
      }
      setShowKelasModal(false);
      fetchKelas();
    } catch (e: any) { toast.error(e.message || 'Gagal menyimpan kelas'); }
    finally { setIsSubmittingKelas(false); }
  };

  // ── Bulk delete siswa ──
  const handleBulkDelete = async () => {
    if (selectedSiswaIds.size === 0) return;
    try {
      setIsBulkDeleting(true);
      await api.post('/api/admin/users/bulk-delete', { ids: Array.from(selectedSiswaIds) });
      toast.success(`${selectedSiswaIds.size} siswa berhasil dihapus`);
      setSelectedSiswaIds(new Set());
      setShowBulkDeleteConfirm(false);
      fetchSiswa();
    } catch (e: any) { toast.error(e.message || 'Gagal menghapus siswa'); }
    finally { setIsBulkDeleting(false); }
  };

  // ── Delete ──
  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      setIsDeletingId(deleteConfirm.id);
      if (deleteConfirm.type === 'KELAS') {
        await api.delete(`/api/admin/kelas/${deleteConfirm.id}`);
      } else {
        await api.delete(`/api/admin/users/${deleteConfirm.id}`);
      }
      const label = deleteConfirm.type === 'KELAS' ? 'Kelas' : deleteConfirm.type === 'GURU' ? 'Guru' : 'Siswa';
      toast.success(`${label} berhasil dihapus`);
      setDeleteConfirm(null);
      if (deleteConfirm.type === 'SISWA') fetchSiswa();
      else if (deleteConfirm.type === 'GURU') { fetchGuru(); fetchKelas(); }
      else fetchKelas();
    } catch (e: any) { toast.error(e.message || 'Gagal menghapus data'); }
    finally { setIsDeletingId(null); }
  };

  // ── Reset Password ──
  const handleResetPassword = async () => {
    if (!resetConfirm) return;
    try {
      setIsResetting(true);
      await api.post(`/api/admin/users/${resetConfirm.userId}/reset-password`);
      toast.success(`Password "${resetConfirm.nama}" direset ke: ${resetConfirm.resetTo}`);
      setResetConfirm(null);
    } catch (e: any) { toast.error(e.message || 'Gagal mereset password'); }
    finally { setIsResetting(false); }
  };

  // ── Import: download template ──
  const handleDownloadTemplate = async (type: ImportType) => {
    try {
      let token = localStorage.getItem('token');
      if (!token) {
        try { const raw = localStorage.getItem('auth-storage'); if (raw) token = JSON.parse(raw)?.state?.token; } catch { /* ignore */ }
      }
      const resp = await fetch(`/api/admin/users/import-template?type=${type}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!resp.ok) throw new Error('Gagal mengunduh template');
      const blob = await resp.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = `template-import-${type}.xlsx`;
      a.click();
      URL.revokeObjectURL(href);
      toast.success('Template berhasil diunduh');
    } catch (e: any) {
      toast.error(e.message || 'Gagal mengunduh template');
    }
  };

  // ── Import: trigger file picker ──
  const handleImportClick = (type: ImportType) => {
    pendingImportType.current = type;
    fileInputRef.current?.click();
  };

  // ── Import: parse Excel + kirim ke backend ──
  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset supaya file yang sama bisa di-pilih lagi
    if (!file) return;

    const type = pendingImportType.current;
    setImporting(type);

    try {
      const buf = await file.arrayBuffer();
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buf);
      const ws = wb.worksheets[0];
      if (!ws) throw new Error('Sheet pertama tidak ditemukan di file');

      // Baca header row → dapatkan nama kolom (case-insensitive normalize)
      const headerRow = ws.getRow(1);
      const headers: string[] = [];
      headerRow.eachCell((cell, colNumber) => {
        headers[colNumber] = String(cell.value ?? '').toLowerCase().trim();
      });

      // Konversi tiap data row jadi object
      const items: any[] = [];
      ws.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // skip header
        const obj: Record<string, any> = {};
        row.eachCell((cell, colNumber) => {
          const key = headers[colNumber];
          if (!key) return;
          // Map header → field name
          let normalized = key;
          if (key === 'nis') normalized = 'nis';
          else if (key === 'nama') normalized = 'nama';
          else if (key === 'nama kelas' || key === 'kelas') normalized = 'kelas';
          else if (key === 'nip') normalized = 'nip';
          else if (key === 'email') normalized = 'email';
          else if (key === 'mata pelajaran' || key === 'mapel') normalized = 'mapel';
          else if (key.startsWith('password')) normalized = 'password';
          obj[normalized] = cell.value;
        });
        // Skip baris kosong
        if (Object.values(obj).every(v => v == null || String(v).trim() === '')) return;
        items.push(obj);
      });

      if (items.length === 0) {
        toast.error('Tidak ada data baris yang ter-baca dari file');
        return;
      }

      // 60s timeout — bulk import bisa lama (bcrypt + 500 row insert) walau
      // sudah dioptimisasi ke ~5 query. Override default 20s.
      const result = await api.post('/api/admin/users/import', { type, items }, 60_000);
      setImportResult(result);
      setImportResultType(type);

      if (result.created > 0) {
        toast.success(`${result.created} ${type === 'siswa' ? 'siswa' : 'guru'} berhasil di-import`);
      }
      // Refresh list
      if (type === 'siswa') fetchSiswa();
      else fetchGuru();
    } catch (err: any) {
      toast.error(err?.message || 'Gagal memproses file');
    } finally {
      setImporting(null);
    }
  };

  const tabs = [
    { id: 'SISWA' as const, label: 'Siswa', Icon: Users, count: siswaList.length },
    { id: 'GURU' as const, label: 'Guru', Icon: GraduationCap, count: guruList.length },
    { id: 'KELAS' as const, label: 'Kelas', Icon: BookOpen, count: kelasList.length },
  ];

  // Tampilkan ErrorState global kalau semua list kosong + ada errorMsg
  // (initial load gagal total). Subsequent error tetap pakai toast.
  const allEmpty = siswaList.length === 0 && guruList.length === 0 && kelasList.length === 0;
  const allLoaded = !isLoadingSiswa && !isLoadingGuru && !isLoadingKelas;
  if (errorMsg && allEmpty && allLoaded) {
    return (
      <div className="py-12">
        <ErrorState message={errorMsg} onRetry={retryAll} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-on-surface tracking-tight">Manajemen Pengguna</h1>
        <p className="text-on-surface-variant mt-1">Kelola data siswa, guru, dan kelas sekolah.</p>
      </div>

      {/* Tabs — pill style (referensi: PresensiAdmin) */}
      <div className="flex p-1.5 bg-surface-container rounded-2xl w-fit">
        {tabs.map(({ id, label, Icon, count }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeTab === id
                ? 'bg-surface-container-lowest text-primary shadow-sm'
                : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
              activeTab === id ? 'bg-primary/10 text-primary' : 'bg-surface-container-high text-on-surface-variant'
            }`}>{count}</span>
          </button>
        ))}
      </div>

      {/* ════ TAB SISWA ════ */}
      {activeTab === 'SISWA' && (
        <div className="space-y-4">
          {/* Filter bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2 flex-1 min-w-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline-variant" />
                <Input value={siswaSearch} onChange={e => setSiswaSearch(e.target.value)} placeholder="Cari nama atau NIS..." className="pl-9 w-56" />
              </div>
              <Select value={siswaFilterKelas} onChange={e => setSiswaFilterKelas(e.target.value)} className="w-44 shrink-0">
                <option value="ALL">Semua Kelas</option>
                {kelasList.map(k => <option key={k.id} value={k.id}>{k.nama}</option>)}
              </Select>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-sm text-on-surface-variant hidden sm:inline">
                {isLoadingSiswa ? 'Memuat...' : `${filteredSiswa.length} data ditemukan`}
              </span>
              <Button onClick={() => handleDownloadTemplate('siswa')} variant="outline" className="gap-2" disabled={importing !== null}>
                <Download className="w-4 h-4" /> Template
              </Button>
              <Button onClick={() => handleImportClick('siswa')} variant="outline" className="gap-2 border-secondary text-on-secondary-container hover:bg-secondary-container/30" disabled={importing !== null}>
                {importing === 'siswa' ? <Spinner /> : <Upload className="w-4 h-4" />}
                {importing === 'siswa' ? 'Memproses...' : 'Import'}
              </Button>
              <Button onClick={() => openSiswaModal()} className="gap-2 bg-primary hover:bg-primary/90">
                <Plus className="w-4 h-4" /> Tambah Siswa
              </Button>
            </div>
          </div>

          {selectedSiswaIds.size > 0 && (
            <div className="flex items-center gap-3 px-1 py-2">
              <span className="text-sm text-on-surface-variant">{selectedSiswaIds.size} siswa dipilih</span>
              <Button
                variant="outline"
                className="gap-2 border-error text-error hover:bg-error-container"
                onClick={() => setShowBulkDeleteConfirm(true)}
              >
                <Trash2 className="w-4 h-4" /> Hapus Terpilih ({selectedSiswaIds.size})
              </Button>
              <button className="text-xs text-on-surface-variant underline" onClick={() => setSelectedSiswaIds(new Set())}>Batalkan pilihan</button>
            </div>
          )}

          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant overflow-hidden shadow-[0px_4px_20px_rgba(0,0,0,0.03)]">
              {isLoadingSiswa ? (
                <div className="py-16 flex flex-col items-center gap-3">
                  <div className="w-6 h-6 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                  <p className="text-sm text-on-surface-variant">Memuat data siswa...</p>
                </div>
              ) : filteredSiswa.length === 0 ? (
                <div className="py-16 text-center space-y-2">
                  <Users className="w-10 h-10 text-outline mx-auto" />
                  <p className="text-on-surface-variant">Tidak ada siswa ditemukan.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead>
                      <tr className="border-b border-outline-variant">
                        <th className="px-5 py-4 w-10">
                          <input
                            type="checkbox"
                            className="w-4 h-4 accent-primary cursor-pointer"
                            checked={filteredSiswa.length > 0 && filteredSiswa.every(u => selectedSiswaIds.has(u.id))}
                            onChange={e => {
                              if (e.target.checked) setSelectedSiswaIds(new Set(filteredSiswa.map(u => u.id)));
                              else setSelectedSiswaIds(new Set());
                            }}
                            aria-label="Pilih semua siswa"
                          />
                        </th>
                        <th className="px-5 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">NIS</th>
                        <th className="px-5 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Nama Siswa</th>
                        <th className="px-5 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Kelas</th>
                        <th className="px-5 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Wali Kelas</th>
                        <th className="px-5 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/40">
                      {paginatedSiswa.map(u => (
                        <tr key={u.id} className={`hover:bg-surface-container-low/50 transition-colors ${selectedSiswaIds.has(u.id) ? 'bg-primary-container/10' : ''}`}>
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              className="w-4 h-4 accent-primary cursor-pointer"
                              checked={selectedSiswaIds.has(u.id)}
                              onChange={e => {
                                const next = new Set(selectedSiswaIds);
                                if (e.target.checked) next.add(u.id); else next.delete(u.id);
                                setSelectedSiswaIds(next);
                              }}
                              aria-label={`Pilih ${u.siswa?.nama}`}
                            />
                          </td>
                          <td className="px-4 py-3 font-mono font-medium text-on-surface">{u.siswa?.nis}</td>
                          <td className="px-4 py-3 font-medium text-on-surface">{u.siswa?.nama}</td>
                          <td className="px-4 py-3 text-on-surface-variant">{u.siswa?.kelas?.nama || '-'}</td>
                          <td className="px-4 py-3 text-on-surface-variant">{u.siswa?.kelas?.guru?.nama || '-'}</td>
                          <td className="px-4 py-3">
                            <div className="flex justify-center gap-1">
                              <Button variant="ghost" size="sm" onClick={() => openSiswaModal(u)} className="h-8 px-2 text-primary hover:bg-primary-container/15" aria-label={`Edit ${u.siswa?.nama}`}><Pencil className="w-4 h-4" /></Button>
                              <Button variant="ghost" size="sm" onClick={() => setResetConfirm({ userId: u.id, nama: u.siswa?.nama, resetTo: u.siswa?.nis })} className="h-8 px-2 text-on-tertiary-fixed hover:bg-tertiary-fixed/50" aria-label={`Reset password ${u.siswa?.nama}`}><KeyRound className="w-4 h-4" /></Button>
                              <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm({ id: u.id, nama: u.siswa?.nama, type: 'SISWA' })} className="h-8 px-2 text-error hover:bg-error-container" aria-label={`Hapus ${u.siswa?.nama}`}><Trash2 className="w-4 h-4" /></Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <Pagination
                    currentPage={siswaPage}
                    totalItems={filteredSiswa.length}
                    itemsPerPage={ITEMS_PER_PAGE}
                    onPageChange={setSiswaPage}
                    itemLabel="siswa"
                  />
                </div>
              )}
          </div>
        </div>
      )}

      {/* ════ TAB GURU ════ */}
      {activeTab === 'GURU' && (
        <div className="space-y-4">
          {/* Filter bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline-variant" />
              <Input value={guruSearch} onChange={e => setGuruSearch(e.target.value)} placeholder="Cari nama atau email..." className="pl-9 w-64" />
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-sm text-on-surface-variant hidden sm:inline">
                {isLoadingGuru ? 'Memuat...' : `${filteredGuru.length} data ditemukan`}
              </span>
              <Button onClick={() => handleDownloadTemplate('guru')} variant="outline" className="gap-2" disabled={importing !== null}>
                <Download className="w-4 h-4" /> Template
              </Button>
              <Button onClick={() => handleImportClick('guru')} variant="outline" className="gap-2 border-secondary text-on-secondary-container hover:bg-secondary-container/30" disabled={importing !== null}>
                {importing === 'guru' ? <Spinner /> : <Upload className="w-4 h-4" />}
                {importing === 'guru' ? 'Memproses...' : 'Import'}
              </Button>
              <Button onClick={() => openGuruModal()} className="gap-2 bg-primary hover:bg-primary/90">
                <Plus className="w-4 h-4" /> Tambah Guru
              </Button>
            </div>
          </div>

          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant overflow-hidden shadow-[0px_4px_20px_rgba(0,0,0,0.03)]">
              {isLoadingGuru ? (
                <div className="py-16 flex flex-col items-center gap-3">
                  <div className="w-6 h-6 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                  <p className="text-sm text-on-surface-variant">Memuat data guru...</p>
                </div>
              ) : filteredGuru.length === 0 ? (
                <div className="py-16 text-center space-y-2">
                  <GraduationCap className="w-10 h-10 text-outline mx-auto" />
                  <p className="text-on-surface-variant">Tidak ada guru ditemukan.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead>
                      <tr className="border-b border-outline-variant">
                        <th className="px-5 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">NIP</th>
                        <th className="px-5 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Nama Guru</th>
                        <th className="px-5 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Email</th>
                        <th className="px-5 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Mata Pelajaran</th>
                        <th className="px-5 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Kelas</th>
                        <th className="px-5 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/40">
                      {paginatedGuru.map(u => (
                        <tr key={u.id} className="hover:bg-surface-container-low/50 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs text-on-surface-variant">{u.guru?.nip || '-'}</td>
                          <td className="px-4 py-3 font-medium text-on-surface">{u.guru?.nama}</td>
                          <td className="px-4 py-3 text-on-surface-variant">{u.email}</td>
                          <td className="px-4 py-3 text-on-surface-variant">
                            {(u.guru?.guruMataPelajaran && u.guru.guruMataPelajaran.length > 0)
                              ? u.guru.guruMataPelajaran.map(m => m.nama).join(', ')
                              : u.guru?.mataPelajaran || '—'}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => openManageKelasGuruModal(u)}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#1e40af] bg-[#dde1ff] hover:bg-[#b8c4ff] rounded-lg transition-colors"
                              title="Manage Kelas"
                            >
                              <BookOpen className="w-3.5 h-3.5" />
                              <span>
                                {(u.guru?.kelas?.length || 0) + (u.guru?.guruKelas?.length || 0)} Kelas
                              </span>
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-center gap-1">
                              <Button variant="ghost" size="sm" onClick={() => openGuruModal(u)} className="h-8 px-2 text-primary hover:bg-primary-container/15" aria-label={`Edit ${u.guru?.nama}`}><Pencil className="w-4 h-4" /></Button>
                              <Button variant="ghost" size="sm" onClick={() => setResetConfirm({ userId: u.id, nama: u.guru?.nama, resetTo: u.guru?.nip || '(NIP kosong, akan direset ke password123)' })} className="h-8 px-2 text-on-tertiary-fixed hover:bg-tertiary-fixed/50" aria-label={`Reset password ${u.guru?.nama}`}><KeyRound className="w-4 h-4" /></Button>
                              <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm({ id: u.id, nama: u.guru?.nama, type: 'GURU' })} className="h-8 px-2 text-error hover:bg-error-container" aria-label={`Hapus ${u.guru?.nama}`}><Trash2 className="w-4 h-4" /></Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <Pagination
                    currentPage={guruPage}
                    totalItems={filteredGuru.length}
                    itemsPerPage={ITEMS_PER_PAGE}
                    onPageChange={setGuruPage}
                    itemLabel="guru"
                  />
                </div>
              )}
          </div>
        </div>
      )}

      {/* ════ TAB KELAS ════ */}
      {activeTab === 'KELAS' && (
        <div className="space-y-4">
          {guruList.length === 0 && !isLoadingGuru && (
            <div className="flex items-center gap-2 p-3 bg-tertiary-fixed/50 border border-tertiary-fixed rounded-lg text-sm text-on-tertiary-fixed">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Tambahkan guru terlebih dahulu sebelum membuat kelas.
            </div>
          )}

          {/* Filter bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline-variant" />
              <Input value={kelasSearch} onChange={e => setKelasSearch(e.target.value)} placeholder="Cari nama kelas..." className="pl-9 w-64" />
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-sm text-on-surface-variant hidden sm:inline">
                {isLoadingKelas ? 'Memuat...' : `${filteredKelas.length} data ditemukan`}
              </span>
              <Button
                onClick={() => openKelasModal()}
                disabled={guruList.length === 0}
                title={guruList.length === 0 ? 'Tambahkan guru terlebih dahulu sebelum membuat kelas' : undefined}
                className="gap-2 bg-primary hover:bg-primary/90"
              >
                <Plus className="w-4 h-4" /> Tambah Kelas
              </Button>
            </div>
          </div>

          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant overflow-hidden shadow-[0px_4px_20px_rgba(0,0,0,0.03)]">
              {isLoadingKelas ? (
                <div className="py-16 flex flex-col items-center gap-3">
                  <div className="w-6 h-6 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                  <p className="text-sm text-on-surface-variant">Memuat data kelas...</p>
                </div>
              ) : filteredKelas.length === 0 ? (
                <div className="py-16 text-center space-y-2">
                  <BookOpen className="w-10 h-10 text-outline mx-auto" />
                  <p className="text-on-surface-variant">Belum ada kelas. Klik "Tambah Kelas" untuk membuat.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead>
                      <tr className="border-b border-outline-variant">
                        <th className="px-5 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Nama Kelas</th>
                        <th className="px-5 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Tingkat</th>
                        <th className="px-5 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Tahun Ajaran</th>
                        <th className="px-5 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Wali Kelas</th>
                        <th className="px-5 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Guru Pengajar</th>
                        <th className="px-5 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider text-center">Siswa</th>
                        <th className="px-5 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/40">
                      {paginatedKelas.map(k => {
                        const guruPengajar = (k as any).guruKelas ?? [];
                        const totalPengajar = guruPengajar.length + 1; // +1 wali kelas
                        const namaPengajar = [
                          k.guru?.nama,
                          ...guruPengajar.map((gk: any) => gk.guru?.nama).filter(Boolean)
                        ].join(', ');
                        return (
                        <tr key={k.id} className="hover:bg-surface-container-low/50 transition-colors">
                          <td className="px-4 py-3 font-semibold text-on-surface">{k.nama}</td>
                          <td className="px-4 py-3"><Badge variant="outline">{k.tingkat}</Badge></td>
                          <td className="px-4 py-3 text-on-surface-variant">{k.tahunAjaran}</td>
                          <td className="px-4 py-3 text-on-surface-variant">{k.guru?.nama || '-'}</td>
                          <td className="px-4 py-3">
                            <span className="text-xs text-on-surface-variant" title={namaPengajar}>
                              {totalPengajar} guru
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-surface-container font-semibold text-on-surface text-sm">{k._count?.siswa ?? 0}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-center gap-1">
                              <Button variant="ghost" size="sm" onClick={() => openKelasModal(k)} className="h-8 px-2 text-primary hover:bg-primary-container/15" aria-label={`Edit kelas ${k.nama}`}><Pencil className="w-4 h-4" /></Button>
                              <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm({ id: k.id, nama: k.nama, type: 'KELAS' })} className="h-8 px-2 text-error hover:bg-error-container" aria-label={`Hapus kelas ${k.nama}`}><Trash2 className="w-4 h-4" /></Button>
                            </div>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <Pagination
                    currentPage={kelasPage}
                    totalItems={filteredKelas.length}
                    itemsPerPage={ITEMS_PER_PAGE}
                    onPageChange={setKelasPage}
                    itemLabel="kelas"
                  />
                </div>
              )}
          </div>
        </div>
      )}

      {/* ════ MODAL SISWA ════ */}
      {showSiswaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-inverse-surface/50 backdrop-blur-sm">
          <div
            ref={siswaModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="siswa-modal-title"
            className="w-full max-w-md bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-xl animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="px-6 pt-6 pb-4 border-b border-outline-variant">
              <h2 id="siswa-modal-title" className="text-lg font-bold text-on-surface">{editingSiswaId ? 'Edit Data Siswa' : 'Tambah Siswa Baru'}</h2>
            </div>
            <form onSubmit={handleSaveSiswa}>
              <div className="px-6 py-5 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="s-nis">NIS <span className="text-error">*</span></Label>
                  <Input id="s-nis" value={siswaForm.nis} onChange={e => setSiswaForm(f => ({ ...f, nis: e.target.value }))} placeholder="Contoh: 12345" />
                  <FieldError msg={siswaErrors.nis} />
                  {!editingSiswaId && <p className="text-xs text-outline-variant">Email & password default dibuat otomatis dari NIS.</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="s-nama">Nama Lengkap <span className="text-error">*</span></Label>
                  <Input id="s-nama" value={siswaForm.nama} onChange={e => setSiswaForm(f => ({ ...f, nama: e.target.value }))} placeholder="Nama Lengkap Siswa" />
                  <FieldError msg={siswaErrors.nama} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="s-kelas">Kelas <span className="text-error">*</span></Label>
                  <Select id="s-kelas" value={siswaForm.kelasId} onChange={e => setSiswaForm(f => ({ ...f, kelasId: e.target.value }))}>
                    <option value="">-- Pilih Kelas --</option>
                    {kelasList.map(k => <option key={k.id} value={k.id}>{k.nama} ({k.tingkat}) — {k.tahunAjaran}</option>)}
                  </Select>
                  <FieldError msg={siswaErrors.kelasId} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="s-rfid">Kode RFID <span className="text-outline-variant text-xs">(opsional)</span></Label>
                  <Input id="s-rfid" value={siswaForm.rfidKode} onChange={e => setSiswaForm(f => ({ ...f, rfidKode: e.target.value }))} placeholder="Kode kartu RFID siswa" />
                  <p className="text-xs text-outline-variant">Kosongkan jika belum ada kartu RFID.</p>
                </div>
                {!editingSiswaId && siswaForm.nis && (
                  <div className="p-3 bg-surface-container-low rounded-lg text-xs text-on-surface-variant border border-outline-variant space-y-1">
                    <p>Email login: <span className="font-mono font-semibold">{siswaForm.nis}@siswa.sch.id</span></p>
                    <p>Password default: <span className="font-mono font-semibold">{siswaForm.nis}</span></p>
                  </div>
                )}
              </div>
              <div className="px-6 pb-6 flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setShowSiswaModal(false)} disabled={isSubmittingSiswa}>Batal</Button>
                <Button type="submit" disabled={isSubmittingSiswa} className="bg-primary hover:bg-primary/90">
                  {isSubmittingSiswa ? <><Spinner />Menyimpan...</> : 'Simpan'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════ MODAL GURU ════ */}
      {showGuruModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-inverse-surface/50 backdrop-blur-sm">
          <div
            ref={guruModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="guru-modal-title"
            className="w-full max-w-md bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-xl animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
          >
            <div className="px-6 pt-6 pb-4 border-b border-outline-variant shrink-0">
              <h2 id="guru-modal-title" className="text-lg font-bold text-on-surface">{editingGuruId ? 'Edit Data Guru' : 'Tambah Guru Baru'}</h2>
            </div>
            <form onSubmit={handleSaveGuru} className="flex flex-col min-h-0">
              <div className="px-6 py-5 space-y-4 overflow-y-auto">

                {/* ── Foto Profil (hanya saat edit) ── */}
                {editingGuruId && (
                  <div className="space-y-2">
                    <Label>Foto Profil <span className="text-outline-variant font-normal text-xs">(potrait, maks 3 MB)</span></Label>
                    <div className="flex items-start gap-4">
                      {/* Preview foto */}
                      <div className="relative shrink-0">
                        {(fotoPreview || guruCurrentFoto) ? (
                          <img
                            src={fotoPreview || guruCurrentFoto!}
                            alt="Foto guru"
                            className="w-20 h-28 object-cover rounded-xl border border-outline-variant shadow-sm"
                          />
                        ) : (
                          <div className="w-20 h-28 rounded-xl bg-surface-container border border-outline-variant flex items-center justify-center">
                            <Camera className="w-7 h-7 text-outline/50" />
                          </div>
                        )}
                        {/* Tombol hapus jika ada foto tersimpan */}
                        {guruCurrentFoto && !fotoPreview && (
                          <button
                            type="button"
                            onClick={() => editingGuruModelId && handleHapusFoto(editingGuruModelId)}
                            className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-error text-white flex items-center justify-center shadow"
                            title="Hapus foto"
                          >
                            <XIcon className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      {/* Kontrol upload */}
                      <div className="flex flex-col gap-2 flex-1 min-w-0">
                        <input
                          ref={fotoInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={handleFotoChange}
                        />
                        <button
                          type="button"
                          onClick={() => fotoInputRef.current?.click()}
                          className="px-3 py-2 rounded-lg border border-outline-variant text-sm text-on-surface hover:bg-surface-container transition-colors text-left"
                        >
                          {guruCurrentFoto || fotoPreview ? 'Ganti Foto' : 'Pilih Foto'}
                        </button>
                        {fotoPreview && (
                          <button
                            type="button"
                            onClick={() => editingGuruModelId && handleUploadFoto(editingGuruModelId)}
                            disabled={isUploadingFoto}
                            className="px-3 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-60 flex items-center gap-2"
                          >
                            {isUploadingFoto ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Mengunggah...</> : 'Upload Foto'}
                          </button>
                        )}
                        <p className="text-[11px] text-on-surface-variant leading-snug">
                          Akan dikompres otomatis ke 400×600 px JPEG.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="g-nama">Nama Lengkap <span className="text-error">*</span></Label>
                  <Input id="g-nama" value={guruForm.nama} onChange={e => setGuruForm(f => ({ ...f, nama: e.target.value }))} placeholder="Nama Lengkap Guru" />
                  <FieldError msg={guruErrors.nama} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="g-email">Email <span className="text-error">*</span></Label>
                  <Input id="g-email" type="email" value={guruForm.email} onChange={e => setGuruForm(f => ({ ...f, email: e.target.value }))} placeholder="guru@sekolah.sch.id" />
                  <FieldError msg={guruErrors.email} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="g-nip">NIP <span className="text-outline-variant font-normal">(opsional)</span></Label>
                  <Input id="g-nip" value={guruForm.nip} onChange={e => setGuruForm(f => ({ ...f, nip: e.target.value }))} placeholder="NIP" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="g-rfid">Kode RFID <span className="text-outline-variant font-normal">(opsional, untuk tap kiosk)</span></Label>
                  <Input id="g-rfid" value={guruForm.rfidKode} onChange={e => setGuruForm(f => ({ ...f, rfidKode: e.target.value }))} placeholder="Kode kartu RFID guru" />
                </div>
                <div className="space-y-1.5">
                  <Label>Mata Pelajaran <span className="text-error">*</span></Label>
                  {/* Tag list */}
                  {guruMapelList.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {guruMapelList.map(m => (
                        <span key={m} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary-container/40 text-primary text-xs font-medium border border-primary/20">
                          {m}
                          <button type="button" onClick={() => setGuruMapelList(l => l.filter(x => x !== m))} className="hover:text-error ml-0.5" aria-label={`Hapus ${m}`}>×</button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Input
                      id="g-mapel"
                      value={guruMapelInput}
                      onChange={e => setGuruMapelInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addGuruMapel(); } }}
                      placeholder="Ketik mata pelajaran, lalu Enter"
                      className="flex-1"
                    />
                    <button
                      type="button"
                      onClick={addGuruMapel}
                      className="px-3 py-1.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 shrink-0"
                    >
                      + Tambah
                    </button>
                  </div>
                  <FieldError msg={guruErrors.mataPelajaran} />
                </div>
                {!editingGuruId && (
                  <div className="space-y-1.5">
                    <Label htmlFor="g-pass">Password <span className="text-error">*</span></Label>
                    <Input id="g-pass" type="password" value={guruForm.password} onChange={e => setGuruForm(f => ({ ...f, password: e.target.value }))} placeholder="Password awal" />
                    <FieldError msg={guruErrors.password} />
                  </div>
                )}
              </div>
              <div className="px-6 pb-6 pt-2 flex justify-end gap-3 shrink-0 border-t border-outline-variant/40">
                <Button type="button" variant="outline" onClick={() => setShowGuruModal(false)} disabled={isSubmittingGuru}>Batal</Button>
                <Button type="submit" disabled={isSubmittingGuru} className="bg-primary hover:bg-primary/90">
                  {isSubmittingGuru ? <><Spinner />Menyimpan...</> : 'Simpan'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════ MODAL KELAS ════ */}
      {showKelasModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-inverse-surface/50 backdrop-blur-sm">
          <div
            ref={kelasModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="kelas-modal-title"
            className="w-full max-w-md bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-xl animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="px-6 pt-6 pb-4 border-b border-outline-variant">
              <h2 id="kelas-modal-title" className="text-lg font-bold text-on-surface">{editingKelasId ? 'Edit Kelas' : 'Tambah Kelas Baru'}</h2>
            </div>
            <form onSubmit={handleSaveKelas}>
              <div className="px-6 py-5 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="k-nama">Nama Kelas <span className="text-error">*</span></Label>
                  <Input id="k-nama" value={kelasForm.nama} onChange={e => setKelasForm(f => ({ ...f, nama: e.target.value }))} placeholder="Contoh: XII IPA 1" />
                  <FieldError msg={kelasErrors.nama} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="k-tingkat">Tingkat <span className="text-error">*</span></Label>
                    <Select id="k-tingkat" value={kelasForm.tingkat} onChange={e => setKelasForm(f => ({ ...f, tingkat: e.target.value }))}>
                      {tingkatList.map(t => (
                        <option key={t} value={String(t)}>Kelas {t}</option>
                      ))}
                    </Select>
                    {siteConfig.jenjang && (
                      <p className="text-[10px] text-outline-variant mt-1">Sesuai jenjang {siteConfig.jenjang}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="k-tahun">Tahun Ajaran <span className="text-error">*</span></Label>
                    <Input id="k-tahun" value={kelasForm.tahunAjaran} onChange={e => setKelasForm(f => ({ ...f, tahunAjaran: e.target.value }))} placeholder="2025/2026" />
                    <FieldError msg={kelasErrors.tahunAjaran} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="k-guru">Wali Kelas <span className="text-error">*</span></Label>
                  <Select id="k-guru" value={kelasForm.guruId} onChange={e => setKelasForm(f => ({ ...f, guruId: e.target.value }))}>
                    <option value="">-- Pilih Guru --</option>
                    {guruList.filter(u => u.guru).map(u => <option key={u.guru!.id} value={u.guru!.id}>{u.guru!.nama} — {u.guru!.mataPelajaran}</option>)}
                  </Select>
                  <FieldError msg={kelasErrors.guruId} />
                </div>

                <div className="space-y-1.5">
                  <Label>Guru Pengajar <span className="text-on-surface-variant font-normal text-xs">(wali kelas otomatis termasuk)</span></Label>
                  <div className="border border-outline-variant rounded-lg max-h-44 overflow-y-auto divide-y divide-outline-variant/40">
                    {guruList.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-on-surface-variant">Belum ada guru.</p>
                    ) : guruList.filter(u => u.guru).map(u => {
                      const gid = u.guru!.id;
                      const isWali = gid === kelasForm.guruId;
                      const checked = isWali || kelasTeacherIds.includes(gid);
                      return (
                        <label key={gid} className={`flex items-center gap-3 px-3 py-2 cursor-pointer text-sm transition-colors ${checked ? 'bg-primary-container/10' : 'hover:bg-surface-container-low'} ${isWali ? 'opacity-60' : ''}`}>
                          <input
                            type="checkbox"
                            className="w-4 h-4 accent-primary"
                            checked={checked}
                            disabled={isWali}
                            onChange={e => {
                              setKelasTeacherIds(prev =>
                                e.target.checked ? [...prev, gid] : prev.filter(id => id !== gid)
                              );
                            }}
                          />
                          <span className="flex-1 font-medium">{u.guru!.nama}</span>
                          <span className="text-xs text-on-surface-variant">{u.guru!.mataPelajaran}</span>
                          {isWali && <span className="text-xs text-primary font-semibold">Wali</span>}
                        </label>
                      );
                    })}
                  </div>
                  <p className="text-xs text-on-surface-variant">Centang guru yang mengajar di kelas ini.</p>
                </div>
              </div>
              <div className="px-6 pb-6 flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setShowKelasModal(false)} disabled={isSubmittingKelas}>Batal</Button>
                <Button type="submit" disabled={isSubmittingKelas} className="bg-primary hover:bg-primary/90">
                  {isSubmittingKelas ? <><Spinner />Menyimpan...</> : 'Simpan'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════ MODAL KONFIRMASI HAPUS ════ */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-inverse-surface/50 backdrop-blur-sm">
          <div
            ref={deleteModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-modal-title"
            className="w-full max-w-sm bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-xl animate-in fade-in zoom-in-95 duration-200 p-6 text-center space-y-4"
          >
            <div className="w-12 h-12 bg-error-container rounded-full flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6 text-error" />
            </div>
            <div>
              <h3 id="delete-modal-title" className="font-bold text-on-surface text-lg">
                Hapus {deleteConfirm.type === 'KELAS' ? 'Kelas' : deleteConfirm.type === 'GURU' ? 'Guru' : 'Siswa'}?
              </h3>
              <p className="text-on-surface-variant text-sm mt-1.5">
                Anda akan menghapus <span className="font-semibold text-on-surface">"{deleteConfirm.nama}"</span>.
                {deleteConfirm.type === 'SISWA' && ' Semua data ujian siswa ini juga akan terhapus.'}
                {deleteConfirm.type === 'KELAS' && ' Kelas tidak dapat dihapus jika masih ada siswa di dalamnya.'}
                {' Tindakan ini tidak dapat dibatalkan.'}
              </p>
            </div>

            {deleteConfirm.type === 'GURU' && (
              <div className="text-left space-y-2">
                <div className="flex items-start gap-2 bg-error-container/60 border border-error/25 rounded-lg px-3 py-2.5 text-xs text-error">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold">Data berikut akan PERMANEN terhapus:</p>
                    <ul className="list-disc list-inside space-y-0.5 text-error/80">
                      <li>Semua ujian yang dibuat guru ini</li>
                      <li>Semua soal & jawaban dari ujian tersebut</li>
                      <li><span className="font-semibold text-error">Nilai siswa dari seluruh ujian guru ini</span> — tidak dapat dipulihkan</li>
                      <li>Riwayat presensi yang dicatat guru ini</li>
                      <li>Kelas kosong (tanpa siswa) yang dikelola guru</li>
                    </ul>
                  </div>
                </div>
                <div className="flex items-start gap-2 bg-tertiary-fixed/30 border border-tertiary-fixed/50 rounded-lg px-3 py-2 text-xs text-on-tertiary-fixed">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <p>Jika guru masih menjadi <strong>wali kelas dengan siswa aktif</strong>, penghapusan akan diblokir — pindahkan siswa terlebih dahulu.</p>
                </div>
              </div>
            )}

            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={() => setDeleteConfirm(null)} disabled={isDeletingId !== null}>Batal</Button>
              <Button onClick={handleDelete} disabled={isDeletingId !== null} className="bg-error hover:bg-error/90 text-white">
                {isDeletingId !== null ? <><Spinner />Menghapus...</> : 'Ya, Hapus'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ════ MODAL KONFIRMASI HAPUS BANYAK SISWA ════ */}
      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-inverse-surface/50 backdrop-blur-sm">
          <div
            ref={bulkDeleteModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="bulk-delete-modal-title"
            className="w-full max-w-sm bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-xl animate-in fade-in zoom-in-95 duration-200 p-6 text-center space-y-4"
          >
            <div className="w-12 h-12 bg-error-container rounded-full flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6 text-error" />
            </div>
            <div>
              <h3 id="bulk-delete-modal-title" className="font-bold text-on-surface text-lg">Hapus {selectedSiswaIds.size} Siswa?</h3>
              <p className="text-on-surface-variant text-sm mt-1.5">
                Semua data ujian dan presensi dari <span className="font-semibold text-on-surface">{selectedSiswaIds.size} siswa terpilih</span> juga akan terhapus. Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={() => setShowBulkDeleteConfirm(false)} disabled={isBulkDeleting}>Batal</Button>
              <Button onClick={handleBulkDelete} disabled={isBulkDeleting} className="bg-error hover:bg-error/90 text-white">
                {isBulkDeleting ? <><Spinner />Menghapus...</> : `Ya, Hapus ${selectedSiswaIds.size} Siswa`}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ════ MODAL RESET PASSWORD ════ */}
      {resetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-inverse-surface/50 backdrop-blur-sm">
          <div
            ref={resetModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-modal-title"
            className="w-full max-w-sm bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-xl animate-in fade-in zoom-in-95 duration-200 p-6 text-center space-y-4"
          >
            <div className="w-12 h-12 bg-tertiary-fixed/70 rounded-full flex items-center justify-center mx-auto">
              <KeyRound className="w-6 h-6 text-on-tertiary-fixed" />
            </div>
            <div>
              <h3 id="reset-modal-title" className="font-bold text-on-surface text-lg">Reset Password?</h3>
              <p className="text-on-surface-variant text-sm mt-1.5">
                Password <span className="font-semibold text-on-surface">{resetConfirm.nama}</span> akan direset ke:
              </p>
              <p className="mt-2 font-mono text-base font-bold text-on-surface bg-surface-container px-3 py-2 rounded-lg inline-block">
                {resetConfirm.resetTo}
              </p>
            </div>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={() => setResetConfirm(null)} disabled={isResetting}>Batal</Button>
              <Button onClick={handleResetPassword} disabled={isResetting} className="bg-tertiary hover:bg-tertiary/90 text-white">
                {isResetting ? <><Spinner />Mereset...</> : 'Ya, Reset'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Hidden file input untuk import Excel ───────────── */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={handleFileSelected}
        aria-hidden="true"
      />

      {/* ════ MODAL HASIL IMPORT ════ */}
      {importResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-inverse-surface/50 backdrop-blur-sm">
          <div
            ref={importResultModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="import-result-title"
            className="w-full max-w-lg bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-xl animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="px-6 pt-6 pb-4 border-b border-outline-variant">
              <h2 id="import-result-title" className="text-lg font-bold text-on-surface">
                Hasil Import {importResultType === 'siswa' ? 'Siswa' : 'Guru'}
              </h2>
            </div>
            <div className="px-6 py-5 space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-secondary-container/30 border border-secondary/20 p-3 text-center">
                  <CheckCircle2 className="w-5 h-5 text-secondary mx-auto mb-1" />
                  <p className="text-2xl font-bold text-on-secondary-container">{importResult.created}</p>
                  <p className="text-xs text-secondary mt-0.5">Berhasil</p>
                </div>
                <div className="rounded-lg bg-surface-container-low border border-outline-variant p-3 text-center">
                  <p className="text-2xl font-bold text-on-surface">{importResult.skipped}</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">Sudah ada (skip)</p>
                </div>
                <div className="rounded-lg bg-error-container border border-error/20 p-3 text-center">
                  <XCircle className="w-5 h-5 text-error mx-auto mb-1" />
                  <p className="text-2xl font-bold text-error">{importResult.failed.length}</p>
                  <p className="text-xs text-error mt-0.5">Gagal</p>
                </div>
              </div>

              {importResult.failed.length > 0 && (
                <div className="rounded-lg border border-error/20 bg-error-container/50 p-3 max-h-60 overflow-y-auto">
                  <p className="text-sm font-semibold text-error mb-2">Detail kegagalan:</p>
                  <ul className="space-y-1 text-xs text-error">
                    {importResult.failed.map((f, i) => (
                      <li key={i}>
                        <span className="font-mono font-semibold">Baris {f.row}:</span> {f.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="px-6 pb-6 flex justify-end">
              <Button onClick={() => setImportResult(null)} className="bg-primary hover:bg-primary/90">
                Tutup
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ════ MODAL: MANAGE KELAS GURU ════ */}
      {showManageKelasGuruModal && selectedGuruForKelas && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowManageKelasGuruModal(false)}>
          <div
            ref={manageKelasGuruModalRef}
            className="bg-surface rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-5 border-b border-outline-variant bg-surface-container-low">
              <h2 className="text-xl font-semibold text-on-surface flex items-center gap-3">
                <BookOpen className="w-6 h-6 text-primary" />
                Manage Kelas: {selectedGuruForKelas.guru.nama}
              </h2>
              <p className="text-sm text-on-surface-variant mt-1">
                NIP: {selectedGuruForKelas.guru.nip}
              </p>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto max-h-[calc(80vh-140px)]">
              {isLoadingGuruKelas ? (
                <div className="py-12 flex flex-col items-center gap-3">
                  <div className="w-6 h-6 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                  <p className="text-sm text-on-surface-variant">Memuat data kelas...</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Kelas Guru Saat Ini */}
                  <div>
                    <h3 className="text-sm font-semibold text-on-surface uppercase tracking-wider mb-3">Kelas Saat Ini</h3>
                    <div className="space-y-2">
                      {/* Wali Kelas */}
                      {selectedGuruForKelas.guru.kelas && selectedGuruForKelas.guru.kelas.length > 0 && (
                        <div>
                          <p className="text-xs text-on-surface-variant mb-2 font-medium">Wali Kelas:</p>
                          <div className="space-y-2">
                            {selectedGuruForKelas.guru.kelas.map(k => (
                              <div key={k.id} className="flex items-center justify-between p-3 bg-primary-fixed rounded-lg border border-primary/20">
                                <div className="flex items-center gap-2">
                                  <GraduationCap className="w-4 h-4 text-primary" />
                                  <span className="font-semibold text-on-surface">{k.nama}</span>
                                  <span className="px-2 py-0.5 bg-primary text-white rounded-full text-[10px] font-bold">WALI KELAS</span>
                                </div>
                                <span className="text-xs text-on-surface-variant">Tidak bisa dihapus di sini</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Kelas Mengajar */}
                      {selectedGuruForKelas.guru.guruKelas && selectedGuruForKelas.guru.guruKelas.length > 0 ? (
                        <div>
                          <p className="text-xs text-on-surface-variant mb-2 font-medium">Kelas Mengajar:</p>
                          <div className="space-y-2">
                            {selectedGuruForKelas.guru.guruKelas.map(gk => (
                              <div key={gk.kelas?.id} className="flex items-center justify-between p-3 bg-surface-container rounded-lg border border-outline-variant">
                                <div className="flex items-center gap-2">
                                  <BookOpen className="w-4 h-4 text-secondary" />
                                  <span className="font-medium text-on-surface">{gk.kelas?.nama}</span>
                                </div>
                                <button
                                  onClick={() => handleRemoveKelasFromGuru(gk.kelas?.id ?? '')}
                                  className="px-3 py-1 text-xs font-medium text-error hover:bg-error-container rounded-lg transition-colors"
                                >
                                  Hapus
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : !selectedGuruForKelas.guru.kelas?.length && (
                        <p className="text-sm text-on-surface-variant italic py-4 text-center bg-surface-container rounded-lg">
                          Belum ada kelas
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Tambah Kelas */}
                  <div>
                    <h3 className="text-sm font-semibold text-on-surface uppercase tracking-wider mb-3">Tambah Kelas</h3>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {availableKelasForGuru
                        .filter(k => {
                          // Filter out kelas yang sudah dipilih
                          const isWaliKelas = selectedGuruForKelas.guru.kelas?.some(wk => wk.id === k.id);
                          const isMengajar = selectedGuruForKelas.guru.guruKelas?.some(gk => gk.kelas.id === k.id);
                          return !isWaliKelas && !isMengajar;
                        })
                        .map(k => (
                          <div key={k.id} className="flex items-center justify-between p-3 bg-surface-container rounded-lg border border-outline-variant hover:border-primary/50 transition-colors">
                            <div>
                              <div className="font-medium text-on-surface">{k.nama}</div>
                              <div className="text-xs text-on-surface-variant">
                                Tingkat {k.tingkat} • {k.tahunAjaran}
                              </div>
                            </div>
                            <button
                              onClick={() => handleAddKelasToGuru(k.id)}
                              className="px-3 py-1 text-xs font-medium bg-primary text-white hover:bg-primary/90 rounded-lg transition-colors"
                            >
                              Tambah
                            </button>
                          </div>
                        ))}
                      {availableKelasForGuru.filter(k => {
                        const isWaliKelas = selectedGuruForKelas.guru.kelas?.some(wk => wk.id === k.id);
                        const isMengajar = selectedGuruForKelas.guru.guruKelas?.some(gk => gk.kelas.id === k.id);
                        return !isWaliKelas && !isMengajar;
                      }).length === 0 && (
                        <p className="text-sm text-on-surface-variant italic py-4 text-center bg-surface-container rounded-lg">
                          Semua kelas sudah ditambahkan
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-outline-variant bg-surface-container-low flex justify-end">
              <Button onClick={() => setShowManageKelasGuruModal(false)} variant="outline">
                Tutup
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
