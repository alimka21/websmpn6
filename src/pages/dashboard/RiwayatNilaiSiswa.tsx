import React, { useState, useEffect } from 'react';
import { Badge } from '../../components/ui/badge';
import { Pagination } from '../../components/ui/pagination';
import { formatDate } from '../../lib/format';
import api from '../../lib/api';

const PAGE_SIZE = 20;

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function RiwayatNilaiSiswa() {
  const [riwayat, setRiwayat] = useState<any[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchRiwayat(currentPage);
  }, [currentPage]);

  const fetchRiwayat = async (page: number) => {
    try {
      setIsLoading(true);
      const res = await api.get(`/api/siswa/hasil?page=${page}&limit=${PAGE_SIZE}`);
      setRiwayat(res?.data ?? []);
      setPagination(res?.pagination ?? null);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-on-surface">Riwayat Nilai</h1>
        <p className="text-on-surface-variant">Histori nilai ujian CBT yang sudah Anda selesaikan.</p>
      </div>

      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant overflow-hidden shadow-[0px_4px_20px_rgba(0,0,0,0.03)]">
        <div className="px-6 py-5 border-b border-outline-variant">
          <h2 className="text-xl font-semibold text-on-surface">Daftar Nilai</h2>
          <p className="text-sm text-on-surface-variant mt-0.5">
            {pagination && pagination.total > 0
              ? `Menampilkan ${riwayat.length} dari ${pagination.total} hasil ujian`
              : 'Menampilkan ujian terbaru di urutan teratas'}
          </p>
        </div>
        {isLoading ? (
          <div className="py-16 flex flex-col items-center gap-3">
            <div className="w-6 h-6 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
            <p className="text-sm text-on-surface-variant">Memuat riwayat...</p>
          </div>
        ) : riwayat.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <p className="text-on-surface-variant">Belum ada ujian yang diselesaikan.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-outline-variant">
                    <th className="px-5 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Judul Ujian</th>
                    <th className="px-5 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Mata Pelajaran</th>
                    <th className="px-5 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Selesai Pada</th>
                    <th className="px-5 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Status</th>
                    <th className="px-5 py-4 text-right text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Nilai Akhir</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/40">
                  {riwayat.map((item) => (
                    <tr key={item.id} className="hover:bg-surface-container-low/50 transition-colors group">
                      <td className="px-5 py-4 text-sm font-medium text-on-surface">{item.ujian?.judul || '-'}</td>
                      <td className="px-5 py-4 text-sm text-on-surface-variant">{item.ujian?.mataPelajaran || '-'}</td>
                      <td className="px-5 py-4 text-sm text-on-surface-variant">{formatDate(item.selesaiAt)}</td>
                      <td className="px-5 py-4">
                        <Badge variant={item.status === 'SELESAI' ? 'default' : 'secondary'}>
                          {item.status.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <span className="font-bold text-lg text-on-surface">{item.nilaiAkhir}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pagination && pagination.total > PAGE_SIZE && (
              <Pagination
                currentPage={pagination.page}
                totalItems={pagination.total}
                itemsPerPage={pagination.limit}
                onPageChange={setCurrentPage}
                itemLabel="hasil ujian"
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
