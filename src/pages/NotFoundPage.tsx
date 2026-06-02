import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { FileQuestion } from 'lucide-react';

const NotFoundPage: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-on-surface p-4">
      <div className="w-20 h-20 rounded-xl bg-primary-container/15 text-primary flex items-center justify-center mb-6">
        <FileQuestion className="w-10 h-10" />
      </div>
      <h1 className="text-headline-lg text-primary mb-2">404</h1>
      <h2 className="text-headline-sm text-on-surface mb-3">Halaman Tidak Ditemukan</h2>
      <p className="text-on-surface-variant mb-8 max-w-md text-center">
        Maaf, halaman yang Anda cari tidak ada atau telah dipindahkan.
      </p>
      <Link to="/">
        <Button>Kembali ke Beranda</Button>
      </Link>
    </div>
  );
};

export default NotFoundPage;
