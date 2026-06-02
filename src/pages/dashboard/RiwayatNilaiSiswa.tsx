import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
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

      <Card>
        <CardHeader>
          <CardTitle>Daftar Nilai</CardTitle>
          <CardDescription>
            {pagination && pagination.total > 0
              ? `Menampilkan ${riwayat.length} dari ${pagination.total} hasil ujian`
              : 'Menampilkan ujian terbaru di urutan teratas'}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-8 text-on-surface-variant">Memuat riwayat...</div>
          ) : riwayat.length === 0 ? (
            <div className="text-center py-8 text-on-surface-variant">Belum ada ujian yang diselesaikan.</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b bg-surface-container-low">
                      <th className="p-3 text-sm font-semibold text-on-surface-variant">Judul Ujian</th>
                      <th className="p-3 text-sm font-semibold text-on-surface-variant">Mata Pelajaran</th>
                      <th className="p-3 text-sm font-semibold text-on-surface-variant">Selesai Pada</th>
                      <th className="p-3 text-sm font-semibold text-on-surface-variant">Status</th>
                      <th className="p-3 text-right text-sm font-semibold text-on-surface-variant">Nilai Akhir</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-sm">
                    {riwayat.map((item) => (
                      <tr key={item.id} className="hover:bg-surface-container-low">
                        <td className="p-3 font-medium text-on-surface">{item.ujian.judul}</td>
                        <td className="p-3 text-on-surface-variant">{item.ujian.mataPelajaran || '-'}</td>
                        <td className="p-3 text-on-surface-variant">{formatDate(item.selesaiAt)}</td>
                        <td className="p-3">
                          <Badge variant={item.status === 'SELESAI' ? 'default' : 'secondary'}>
                            {item.status.replace('_', ' ')}
                          </Badge>
                        </td>
                        <td className="p-3 text-right">
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
        </CardContent>
      </Card>
    </div>
  );
}
