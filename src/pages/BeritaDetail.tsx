import { toast } from 'sonner';
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { GraduationCap, ArrowLeft, Calendar, Share2, Link as LinkIcon, FileText } from 'lucide-react';
import { Button } from '../components/ui/button';
import api from '../lib/api';
import SiteFooter from '../components/SiteFooter';

export default function BeritaDetail() {
  const { slug } = useParams();
  const [berita, setBerita] = useState<any>(null);
  const [beritaLain, setBeritaLain] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        setIsLoading(true);
        window.scrollTo(0, 0);
        const [detail, listResp] = await Promise.all([
          api.get(`/api/berita/${slug}`).catch(() => null),
          api.get('/api/berita?limit=4').catch(() => ({ data: [] })),
        ]);
        if (detail) {
          setBerita(detail);
          const lain = (listResp.data || []).filter((b: any) => b.id !== detail.id).slice(0, 3);
          setBeritaLain(lain);
        } else {
          setBerita(null);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    if (slug) fetchDetail();
  }, [slug]);

  // ── Share handlers ────────────────────────────────────────
  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Link disalin ke clipboard');
    } catch {
      toast.error('Gagal menyalin link');
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && (navigator as any).share) {
      try {
        await (navigator as any).share({
          title: berita?.judul ?? 'Berita Sekolah',
          text: berita?.ringkasan ?? berita?.judul ?? '',
          url: shareUrl,
        });
      } catch (e: any) {
        if (e?.name !== 'AbortError') toast.error('Gagal membuka menu berbagi');
      }
    } else {
      handleCopyLink();
    }
  };

  const shareWhatsApp = () => {
    const text = encodeURIComponent(`${berita?.judul ?? ''}\n${shareUrl}`);
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer');
  };
  const shareFacebook = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank', 'noopener,noreferrer');
  };
  const shareTwitter = () => {
    const text = encodeURIComponent(berita?.judul ?? '');
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(shareUrl)}`, '_blank', 'noopener,noreferrer');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <div className="w-8 h-8 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  if (!berita) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center text-center p-4">
        <div className="w-16 h-16 rounded-xl bg-tertiary-fixed text-on-tertiary-fixed flex items-center justify-center mb-4">
          <FileText className="w-8 h-8" />
        </div>
        <h1 className="text-headline-md text-on-surface mb-2">Berita Tidak Ditemukan</h1>
        <p className="text-on-surface-variant mb-6">Mungkin artikel sudah dihapus atau link tidak valid.</p>
        <Link to="/"><Button>Kembali ke Beranda</Button></Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Navbar */}
      <nav className="h-16 bg-surface/95 backdrop-blur-md border-b border-outline-variant sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 h-full flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary text-on-primary flex items-center justify-center shrink-0">
              <GraduationCap className="w-5 h-5" />
            </div>
            <span className="font-bold text-xl tracking-tight text-primary hidden sm:block">Beranda</span>
          </Link>
          <Button variant="outline" size="sm" onClick={() => window.history.back()}>
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Kembali
          </Button>
        </div>
      </nav>

      {/* Konten Utama */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-10 md:py-14">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-label-sm text-on-surface-variant uppercase tracking-wider font-bold mb-6">
          <Link to="/" className="hover:text-primary transition-colors">Beranda</Link>
          <span className="text-outline-variant">/</span>
          <Link to="/berita" className="hover:text-primary transition-colors">Berita</Link>
        </div>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-headline-lg text-on-surface leading-tight mb-4">{berita.judul}</h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-on-surface-variant font-medium">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              {new Date(berita.publishedAt ?? berita.createdAt).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
            <span className="inline-flex items-center rounded-full bg-primary-container/20 text-primary px-3 py-1 text-label-sm uppercase tracking-wider font-bold">
              Berita Resmi
            </span>
          </div>
        </div>

        {/* Hero image — aspect-ratio container reserve height sebelum
            image load, hindari CLS dari max-h-[500px] yg height implicit */}
        {berita.imageUrl && (
          <div className="w-full aspect-[16/9] overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest mb-10">
            <img src={berita.imageUrl} alt={berita.judul} className="w-full h-full object-cover" />
          </div>
        )}

        {/* Konten */}
        <article className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 md:p-10 mb-12">
          {berita.ringkasan && (
            <p className="text-lg text-on-surface-variant italic mb-6 border-l-4 border-primary pl-4 py-2 bg-primary-container/10 rounded-r-lg leading-relaxed">
              {berita.ringkasan}
            </p>
          )}
          <div className="prose prose-slate md:prose-lg max-w-none text-on-surface leading-relaxed whitespace-pre-wrap">
            {berita.konten}
          </div>

          {/* Share */}
          <div className="mt-10 pt-6 border-t border-outline-variant">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <span className="text-label-md uppercase tracking-wider font-bold text-on-surface">Bagikan artikel:</span>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={handleNativeShare} title="Bagikan">
                  <Share2 className="w-4 h-4 mr-1.5" /> Bagikan
                </Button>
                <Button variant="outline" size="sm" onClick={shareWhatsApp} aria-label="WhatsApp">
                  WhatsApp
                </Button>
                <Button variant="outline" size="sm" onClick={shareFacebook} aria-label="Facebook">
                  Facebook
                </Button>
                <Button variant="outline" size="sm" onClick={shareTwitter} aria-label="X / Twitter">
                  X / Twitter
                </Button>
                <Button variant="outline" size="sm" onClick={handleCopyLink} aria-label="Salin link">
                  <LinkIcon className="w-4 h-4 mr-1.5" /> Salin
                </Button>
              </div>
            </div>
          </div>
        </article>

        {/* Berita Terkait */}
        {beritaLain.length > 0 && (
          <div className="mt-12 pt-12 border-t border-outline-variant">
            <h3 className="text-headline-sm text-on-surface mb-6">Berita Terkait Lainnya</h3>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-5">
              {beritaLain.map((b: any) => (
                <Link
                  to={`/berita/${b.slug}`}
                  key={b.id}
                  className="group flex flex-col h-full bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all"
                >
                  <div className="aspect-video bg-surface-container overflow-hidden">
                    {b.imageUrl ? (
                      <img src={b.imageUrl} alt={b.judul} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-outline-variant">
                        <FileText className="w-10 h-10" />
                      </div>
                    )}
                  </div>
                  <div className="p-4 flex flex-col flex-1">
                    <h4 className="font-bold text-on-surface line-clamp-2 group-hover:text-primary transition-colors mb-2">{b.judul}</h4>
                    <p className="text-label-sm text-on-surface-variant uppercase tracking-wider mt-auto">
                      {new Date(b.publishedAt ?? b.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
