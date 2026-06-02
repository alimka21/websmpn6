import { toast } from 'sonner';
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, ArrowLeft, Calendar, AlertTriangle, FileText, Search, ArrowRight } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Pagination } from '../components/ui/pagination';
import api from '../lib/api';
import SiteFooter from '../components/SiteFooter';

const PAGE_SIZE = 9;

interface BeritaItem {
  id: string;
  slug: string;
  judul: string;
  ringkasan: string | null;
  imageUrl: string | null;
  publishedAt: string | null;
  createdAt: string;
}

const formatDate = (iso: string | null) => {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
};

export default function BeritaList() {
  const [items, setItems] = useState<BeritaItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchBerita = async () => {
      try {
        setIsLoading(true);
        setErrorMsg(null);
        const res = await api.get(`/api/berita?page=${page}&limit=${PAGE_SIZE}`);
        setItems(res.data || []);
        setTotal(res.total || 0);
      } catch (err: any) {
        setErrorMsg(err.message || 'Gagal memuat berita');
        toast.error(err.message || 'Gagal memuat berita');
      } finally {
        setIsLoading(false);
      }
    };
    fetchBerita();
    window.scrollTo(0, 0);
  }, [page]);

  const q = search.toLowerCase().trim();
  const filtered = q
    ? items.filter(b => b.judul.toLowerCase().includes(q) || (b.ringkasan ?? '').toLowerCase().includes(q))
    : items;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Navbar */}
      <nav className="h-16 bg-surface/95 backdrop-blur-md border-b border-outline-variant sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-full flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary text-on-primary flex items-center justify-center shrink-0">
              <GraduationCap className="w-5 h-5" />
            </div>
            <span className="font-bold text-xl tracking-tight text-primary hidden sm:block">Beranda</span>
          </Link>
          <Link to="/">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-1.5" /> Kembali
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <header className="bg-primary text-on-primary py-12 md:py-16">
        <div className="max-w-6xl mx-auto px-4">
          <p className="text-label-sm uppercase tracking-wider font-bold text-on-primary/70 mb-2">Informasi Terkini</p>
          <h1 className="text-headline-lg leading-tight">Berita & Pengumuman</h1>
          <p className="text-on-primary/85 max-w-2xl mt-3 leading-relaxed">
            Kabar terbaru seputar prestasi siswa, kegiatan sekolah, dan informasi penting untuk seluruh warga sekolah.
          </p>
        </div>
      </header>

      {/* Search bar — floating di atas content */}
      <div className="max-w-6xl mx-auto px-4 -mt-8 mb-8 w-full">
        <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant p-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari berita berdasarkan judul atau ringkasan..."
              className="pl-10 h-11 border-0 bg-surface-container-low"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 max-w-6xl mx-auto px-4 pb-16 w-full">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center text-center">
            <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-3" />
            <p className="text-on-surface-variant">Memuat berita...</p>
          </div>
        ) : errorMsg ? (
          <div className="py-20 flex flex-col items-center text-center">
            <AlertTriangle className="w-12 h-12 text-error mb-3" />
            <p className="text-error font-medium mb-1">Gagal memuat berita</p>
            <p className="text-sm text-on-surface-variant mb-4">{errorMsg}</p>
            <Button onClick={() => setPage(p => p)}>Muat Ulang</Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 flex flex-col items-center text-center">
            <FileText className="w-12 h-12 text-outline-variant mb-3" />
            <p className="text-on-surface-variant">
              {q ? 'Tidak ada berita yang cocok dengan pencarian.' : 'Belum ada berita yang dipublikasikan.'}
            </p>
          </div>
        ) : (
          <>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map(b => (
                <Link
                  to={`/berita/${b.slug}`}
                  key={b.id}
                  className="group flex flex-col h-full bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all"
                >
                  <div className="aspect-video bg-surface-container overflow-hidden">
                    {b.imageUrl ? (
                      <img
                        src={b.imageUrl}
                        alt={b.judul}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-outline-variant">
                        <FileText className="w-12 h-12" />
                      </div>
                    )}
                  </div>
                  <div className="p-5 flex flex-col flex-1">
                    <div className="flex items-center gap-1.5 text-label-sm text-on-surface-variant uppercase tracking-wider mb-2 font-medium">
                      <Calendar className="w-3.5 h-3.5" />
                      {formatDate(b.publishedAt ?? b.createdAt)}
                    </div>
                    <h2 className="font-bold text-on-surface text-lg leading-tight mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                      {b.judul}
                    </h2>
                    {b.ringkasan && (
                      <p className="text-sm text-on-surface-variant line-clamp-3 leading-relaxed">{b.ringkasan}</p>
                    )}
                    <span className="mt-4 text-label-sm font-bold uppercase tracking-wider text-primary inline-flex items-center gap-1">
                      Baca selengkapnya <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>

            {!q && total > PAGE_SIZE && (
              <div className="mt-10 bg-surface-container-lowest border border-outline-variant rounded-xl">
                <Pagination
                  currentPage={page}
                  totalItems={total}
                  itemsPerPage={PAGE_SIZE}
                  onPageChange={setPage}
                  itemLabel="berita"
                />
              </div>
            )}
          </>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
