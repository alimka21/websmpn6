import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FileText, ExternalLink, Home, Loader2 } from 'lucide-react';
import SiteFooter from '../components/SiteFooter';
import api from '../lib/api';
import { useSiteConfig } from '../hooks/useSiteConfig';

interface Dokumen { id: string; judul: string; linkDrive: string }

const ICON_COLORS = [
  { bg: 'bg-blue-50',   text: 'text-blue-600',   hover: 'group-hover:bg-blue-600' },
  { bg: 'bg-red-50',    text: 'text-red-600',     hover: 'group-hover:bg-red-600' },
  { bg: 'bg-green-50',  text: 'text-green-600',   hover: 'group-hover:bg-green-600' },
  { bg: 'bg-purple-50', text: 'text-purple-600',  hover: 'group-hover:bg-purple-600' },
  { bg: 'bg-amber-50',  text: 'text-amber-600',   hover: 'group-hover:bg-amber-600' },
  { bg: 'bg-cyan-50',   text: 'text-cyan-600',    hover: 'group-hover:bg-cyan-600' },
];

export default function DokumenPublik() {
  const [dokumen, setDokumen]       = useState<Dokumen[]>([]);
  const [isLoading, setIsLoading]   = useState(true);
  const cfg = useSiteConfig();
  const schoolName = cfg.namaSekolah || 'Portal Sekolah';

  useEffect(() => {
    api.get('/api/dokumen')
      .then((r: any) => setDokumen(Array.isArray(r) ? r : []))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-surface-container-lowest border-b border-outline-variant px-4 md:px-20 py-5">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-xs text-on-surface-variant uppercase tracking-widest font-semibold">{schoolName}</p>
            <h1 className="text-2xl font-bold text-on-surface tracking-tight mt-0.5">Dokumen Sekolah</h1>
          </div>
          <Link to="/" className="flex items-center gap-2 text-sm font-medium text-primary hover:opacity-80 transition-opacity">
            <Home className="w-4 h-4" /> Beranda
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-4 md:px-20 py-12 max-w-screen-2xl mx-auto w-full">
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : dokumen.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-3">
            <FileText className="w-12 h-12 text-outline" />
            <p className="text-on-surface-variant font-medium">Belum ada dokumen yang dipublikasikan.</p>
            <Link to="/" className="text-sm text-primary hover:underline">Kembali ke Beranda</Link>
          </div>
        ) : (
          <>
            <p className="text-sm text-on-surface-variant mb-8">{dokumen.length} dokumen tersedia</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {dokumen.map((doc, idx) => {
                const color = ICON_COLORS[idx % ICON_COLORS.length];
                return (
                  <a
                    key={doc.id}
                    href={doc.linkDrive}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-4 p-5 bg-surface-container-lowest border border-outline-variant/30 rounded-xl card-hover shadow-[0px_4px_20px_rgba(0,0,0,0.04)]"
                  >
                    <div className={`w-12 h-12 rounded-lg ${color.bg} ${color.text} ${color.hover} group-hover:text-white flex items-center justify-center shrink-0 transition-all`}>
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-on-surface group-hover:text-primary transition-colors truncate">
                        {doc.judul}
                      </h3>
                      <p className="text-xs text-on-surface-variant mt-0.5 flex items-center gap-1">
                        <ExternalLink className="w-3 h-3" /> Google Drive
                      </p>
                    </div>
                    <ExternalLink className="w-4 h-4 text-on-surface-variant opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </a>
                );
              })}
            </div>
          </>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
