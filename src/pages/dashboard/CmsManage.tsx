import { toast } from 'sonner';
import React, { useState, useEffect } from 'react';
import { Button } from '../../components/ui/button';
import { Input, Label } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Plus, Edit, Trash2, Eye, ExternalLink, Search, Globe, FileEdit, X, Copy, Tag } from 'lucide-react';
import api from '../../lib/api';
import { useModalA11y } from '../../hooks/useModalA11y';
import { ErrorState } from '../../components/ui/ErrorState';
import { RichTextEditor } from '../../components/ui/RichTextEditor';
import { useAuthStore } from '../../store/authStore';

const EMPTY_FORM = {
  judul: '', ringkasan: '', konten: '', imageUrl: '', status: 'DRAFT', slug: '',
  kategori: '', tags: '[]', metaDescription: '', penulis: ''
};

const KATEGORI_OPTIONS = [
  { value: '', label: '-- Pilih Kategori --' },
  { value: 'Akademik', label: 'Akademik' },
  { value: 'Prestasi', label: 'Prestasi' },
  { value: 'Kegiatan', label: 'Kegiatan' },
  { value: 'Pengumuman', label: 'Pengumuman' },
  { value: 'Umum', label: 'Umum' }
];

const statusBadge = (status: string) => {
  const base = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-label-sm uppercase tracking-wider font-bold';
  if (status === 'PUBLISHED') return <span className={`${base} bg-secondary-container/40 text-on-secondary-container`}>Published</span>;
  if (status === 'DRAFT') return <span className={`${base} bg-tertiary-fixed text-on-tertiary-fixed`}>Draft</span>;
  return <span className={`${base} bg-surface-container text-on-surface-variant`}>Archived</span>;
};

export default function CmsManage() {
  const { user } = useAuthStore();
  const [beritaList, setBeritaList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [search, setSearch] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ ...EMPTY_FORM });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState('');
  const modalRef = useModalA11y<HTMLDivElement>(showModal, () => setShowModal(false));

  const fetchBerita = async () => {
    try {
      setIsLoading(true);
      // Endpoint paginated — ambil 100 (cukup utk CMS berita sekolah typical).
      // Filter status + search masih client-side; kalau dataset > 100 refactor jadi server-search.
      const res = await api.get('/api/admin/berita?limit=100');
      setBeritaList(res?.data ?? []);
      setErrorMsg(null);
      if (res?.pagination?.total > 100) {
        toast.info(`Total ${res.pagination.total} berita — hanya 100 terbaru ditampilkan.`);
      }
    } catch (error: any) {
      setErrorMsg(error?.message || 'Gagal memuat daftar berita');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchBerita(); }, []);

  const generateSlug = (title: string) =>
    title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const title = e.target.value;
    setFormData(prev => ({ ...prev, judul: title, slug: editingId ? prev.slug : generateSlug(title) }));
  };

  const handleOpenModal = (b?: any) => {
    if (b) {
      setEditingId(b.id);
      setFormData({
        judul: b.judul,
        ringkasan: b.ringkasan || '',
        konten: b.konten,
        imageUrl: b.imageUrl || '',
        status: b.status,
        slug: b.slug,
        kategori: b.kategori || '',
        tags: b.tags || '[]',
        metaDescription: b.metaDescription || '',
        penulis: b.penulis || user?.profile?.nama || ''
      });
    } else {
      setEditingId(null);
      setFormData({ ...EMPTY_FORM, penulis: user?.profile?.nama || '' });
    }
    setShowModal(true);
  };

  const handleSave = async (overrideStatus?: string) => {
    const payload = overrideStatus ? { ...formData, status: overrideStatus } : formData;
    if (!payload.judul || !payload.konten || !payload.slug) {
      toast.error('Judul, Slug, dan Konten wajib diisi!');
      return;
    }
    try {
      setIsSubmitting(true);
      if (editingId) {
        await api.patch(`/api/admin/berita/${editingId}`, payload);
      } else {
        await api.post('/api/admin/berita', payload);
      }
      toast.success(overrideStatus === 'PUBLISHED' ? 'Berita berhasil diterbitkan!' : 'Draft berhasil disimpan!');
      setShowModal(false);
      fetchBerita();
    } catch (error: any) {
      toast.error(error.message || 'Gagal menyimpan berita');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTogglePublish = async (b: any) => {
    const next = b.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
    try {
      setTogglingId(b.id);
      await api.patch(`/api/admin/berita/${b.id}`, { status: next });
      toast.success(next === 'PUBLISHED' ? 'Berita diterbitkan!' : 'Berita dijadikan draft.');
      fetchBerita();
    } catch (err: any) {
      toast.error(err.message || 'Gagal mengubah status');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/api/admin/berita/${id}`);
      setDeleteConfirmId(null);
      toast.success('Berita dihapus.');
      fetchBerita();
    } catch (error: any) {
      toast.error(error.message || 'Gagal menghapus berita');
    }
  };

  const handleDuplikat = async (id: string) => {
    try {
      const result = await api.post(`/api/admin/berita/${id}/duplikat`);
      toast.success('Berita berhasil diduplikat', {
        description: 'Draft baru siap diedit.',
        action: {
          label: 'Edit sekarang',
          onClick: () => handleOpenModal(result)
        }
      });
      fetchBerita();
    } catch (error: any) {
      toast.error(error.message || 'Gagal menduplikat berita');
    }
  };

  // Tags management
  const handleAddTag = () => {
    if (!tagInput.trim()) return;
    try {
      const currentTags = JSON.parse(formData.tags || '[]');
      if (currentTags.length >= 5) {
        toast.error('Maksimal 5 tag');
        return;
      }
      if (currentTags.includes(tagInput.trim())) {
        toast.error('Tag sudah ada');
        return;
      }
      const newTags = [...currentTags, tagInput.trim()];
      setFormData({ ...formData, tags: JSON.stringify(newTags) });
      setTagInput('');
    } catch (e) {
      console.error('Tag parse error:', e);
    }
  };

  const handleRemoveTag = (tag: string) => {
    try {
      const currentTags = JSON.parse(formData.tags || '[]');
      const newTags = currentTags.filter((t: string) => t !== tag);
      setFormData({ ...formData, tags: JSON.stringify(newTags) });
    } catch (e) {
      console.error('Tag parse error:', e);
    }
  };

  const displayList = beritaList
    .filter(b => filterStatus === 'ALL' || b.status === filterStatus)
    .filter(b => !search || b.judul.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-headline-md text-on-surface">Konten Berita</h1>
          <p className="text-on-surface-variant mt-1">Kelola berita, pengumuman, dan artikel di website sekolah.</p>
        </div>
        <Button onClick={() => handleOpenModal()}>
          <Plus className="w-4 h-4 mr-1.5" /> Tambah Berita
        </Button>
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl">
        <div className="px-6 py-4 border-b border-outline-variant flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <h2 className="text-headline-sm text-on-surface">Daftar Artikel</h2>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none" />
              <Input
                placeholder="Cari judul..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <Select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="w-full sm:w-52 h-9">
              <option value="ALL">Semua Status</option>
              <option value="PUBLISHED">Published</option>
              <option value="DRAFT">Draft</option>
              <option value="ARCHIVED">Archived</option>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-on-surface-variant">Memuat konten...</div>
        ) : errorMsg ? (
          <ErrorState message={errorMsg} onRetry={fetchBerita} />
        ) : displayList.length === 0 ? (
          <div className="py-12 m-6 flex flex-col items-center justify-center text-on-surface-variant border-2 border-dashed border-outline-variant rounded-xl">
            <p className="text-base font-medium text-on-surface">Tidak ada berita</p>
            <p className="text-sm">{search ? 'Coba kata kunci lain.' : 'Klik "Tambah Berita" untuk mulai menulis.'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-surface-container border-b border-outline-variant">
                <tr>
                  <th className="px-4 py-3 text-label-sm uppercase tracking-wider font-bold text-on-surface-variant w-20">Gambar</th>
                  <th className="px-4 py-3 text-label-sm uppercase tracking-wider font-bold text-on-surface-variant">Judul & Detail</th>
                  <th className="px-4 py-3 text-label-sm uppercase tracking-wider font-bold text-on-surface-variant text-center">Status</th>
                  <th className="px-4 py-3 text-label-sm uppercase tracking-wider font-bold text-on-surface-variant text-center whitespace-nowrap">Dibuat</th>
                  <th className="px-4 py-3 text-label-sm uppercase tracking-wider font-bold text-on-surface-variant text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {displayList.map(b => (
                  <React.Fragment key={b.id}>
                    <tr className="hover:bg-surface-container-low transition-colors">
                      <td className="px-4 py-4">
                        <div className="w-16 h-12 bg-surface-container rounded border border-outline-variant overflow-hidden flex items-center justify-center shrink-0">
                          {b.imageUrl
                            ? <img src={b.imageUrl} alt={b.judul} className="w-full h-full object-cover" />
                            : <span className="text-[10px] text-outline-variant">No Img</span>
                          }
                        </div>
                      </td>
                      <td className="px-4 py-4 max-w-xs">
                        <p className="font-semibold text-on-surface line-clamp-1">{b.judul}</p>
                        <p className="text-xs text-on-surface-variant font-mono mt-0.5 truncate">/{b.slug}</p>
                        {b.ringkasan && <p className="text-xs text-on-surface-variant mt-1 line-clamp-1">{b.ringkasan}</p>}
                        <div className="flex gap-1.5 mt-1.5 flex-wrap">
                          {b.kategori && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary-container/20 text-primary">
                              {b.kategori}
                            </span>
                          )}
                          {b.penulis && (
                            <span className="text-[10px] text-on-surface-variant">
                              oleh {b.penulis}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">{statusBadge(b.status)}</td>
                      <td className="px-4 py-4 text-center text-xs text-on-surface-variant whitespace-nowrap">
                        <div>{new Date(b.createdAt).toLocaleDateString('id-ID')}</div>
                        {b.publishedAt && b.status === 'PUBLISHED' && (
                          <div className="text-secondary mt-0.5">
                            Publish: {new Date(b.publishedAt).toLocaleDateString('id-ID')}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-center items-center gap-1 flex-wrap">
                          <Button
                            variant="ghost" size="sm"
                            onClick={() => handleTogglePublish(b)}
                            disabled={togglingId === b.id || b.status === 'ARCHIVED'}
                            title={b.status === 'PUBLISHED' ? 'Jadikan Draft' : 'Terbitkan'}
                            className="h-8 px-2"
                          >
                            {b.status === 'PUBLISHED' ? <FileEdit className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleOpenModal(b)} className="h-8 px-2" title="Edit">
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDuplikat(b.id)} className="h-8 px-2" title="Duplikat">
                            <Copy className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setDeleteConfirmId(b.id)} className="h-8 px-2 text-error hover:bg-error-container" title="Hapus">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                          {b.status === 'PUBLISHED' && (
                            <Button variant="ghost" size="sm" onClick={() => window.open(`/berita/${b.slug}`, '_blank')} className="h-8 px-2" title="Lihat Publik">
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {deleteConfirmId === b.id && (
                      <tr className="bg-error-container/50">
                        <td colSpan={5} className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-error font-medium flex-1">
                              Hapus "<strong>{b.judul}</strong>"? Tindakan ini tidak dapat dibatalkan.
                            </span>
                            <Button variant="destructive" size="sm" onClick={() => handleDelete(b.id)}>
                              Ya, Hapus
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setDeleteConfirmId(null)}>
                              Batal
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Form */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-on-surface/40 backdrop-blur-sm overflow-y-auto">
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="berita-modal-title"
            className="bg-surface-container-lowest border border-outline-variant w-full max-w-4xl rounded-xl shadow-xl my-auto flex flex-col max-h-[90vh]"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant shrink-0">
              <h2 id="berita-modal-title" className="text-headline-sm text-on-surface">{editingId ? 'Edit Berita' : 'Tulis Berita Baru'}</h2>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-lg hover:bg-surface-container text-on-surface-variant" aria-label="Tutup modal">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="judul">Judul Artikel <span className="text-error">*</span></Label>
                <Input id="judul" value={formData.judul} onChange={handleTitleChange} placeholder="Tuliskan judul menarik..." className="text-base font-medium h-11" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="slug">Slug (URL) <span className="text-error">*</span></Label>
                  <Input id="slug" value={formData.slug} onChange={e => setFormData({ ...formData, slug: e.target.value })} placeholder="contoh-judul-berita" className="font-mono text-sm" />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}>
                    <option value="DRAFT">Draft</option>
                    <option value="PUBLISHED">Published</option>
                    <option value="ARCHIVED">Archived</option>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="imageUrl">URL Gambar Header</Label>
                <Input id="imageUrl" value={formData.imageUrl} onChange={e => setFormData({ ...formData, imageUrl: e.target.value })} placeholder="https://..." />
                {formData.imageUrl && (
                  <div className="mt-2 h-36 w-64 bg-surface-container rounded-lg overflow-hidden border border-outline-variant">
                    <img src={formData.imageUrl} alt="preview" className="w-full h-full object-cover" onError={e => (e.currentTarget.style.display = 'none')} />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="ringkasan">Ringkasan</Label>
                <textarea
                  id="ringkasan"
                  value={formData.ringkasan}
                  onChange={e => setFormData({ ...formData, ringkasan: e.target.value })}
                  rows={2}
                  className="w-full p-3 rounded-lg border border-outline-variant bg-surface-container-lowest text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                  placeholder="Ringkasan singkat 1-2 kalimat yang tampil di halaman depan..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="kategori">Kategori</Label>
                <Select
                  value={formData.kategori}
                  onChange={(e) => setFormData({ ...formData, kategori: e.target.value })}
                  className="w-full"
                >
                  {KATEGORI_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="penulis">Penulis</Label>
                <Input
                  id="penulis"
                  value={formData.penulis}
                  onChange={e => setFormData({ ...formData, penulis: e.target.value })}
                  placeholder="Nama penulis berita"
                />
              </div>

              <div className="space-y-2">
                <Label>Tags (Maksimal 5)</Label>
                <div className="flex gap-2">
                  <Input
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                    placeholder="Ketik tag dan tekan Enter"
                    className="flex-1"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={handleAddTag}>
                    <Tag className="w-4 h-4 mr-1" /> Tambah
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {JSON.parse(formData.tags || '[]').map((tag: string, idx: number) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-secondary-container/40 text-on-secondary-container"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="hover:text-error transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="metaDescription">
                  Meta Description (SEO)
                  <span className={`ml-2 text-xs ${(formData.metaDescription?.length || 0) > 160 ? 'text-error' : 'text-on-surface-variant'}`}>
                    {formData.metaDescription?.length || 0}/160
                  </span>
                </Label>
                <textarea
                  id="metaDescription"
                  value={formData.metaDescription}
                  onChange={e => setFormData({ ...formData, metaDescription: e.target.value })}
                  rows={2}
                  maxLength={160}
                  className="w-full p-3 rounded-lg border border-outline-variant bg-surface-container-lowest text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                  placeholder="Deskripsi singkat yang muncul di hasil pencarian Google (max 160 karakter)"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="konten">Isi Konten Lengkap <span className="text-error">*</span></Label>
                <RichTextEditor
                  value={formData.konten}
                  onChange={(html) => setFormData({ ...formData, konten: html })}
                  placeholder="Tulis konten berita dengan Rich Text Editor..."
                  minHeight="400px"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-outline-variant flex justify-between items-center gap-3 shrink-0 bg-surface-container-low rounded-b-xl">
              <div>
                {formData.status === 'PUBLISHED' && formData.slug && (
                  <Button type="button" variant="outline" size="sm" onClick={() => window.open(`/berita/${formData.slug}`, '_blank')}>
                    <Eye className="w-3.5 h-3.5 mr-1.5" /> Preview
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setShowModal(false)} disabled={isSubmitting}>Batal</Button>
                <Button type="button" variant="outline" onClick={() => handleSave('DRAFT')} disabled={isSubmitting}>
                  Simpan Draft
                </Button>
                <Button type="button" onClick={() => handleSave('PUBLISHED')} disabled={isSubmitting}>
                  <Globe className="w-3.5 h-3.5 mr-1.5" />
                  Publish Sekarang
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
