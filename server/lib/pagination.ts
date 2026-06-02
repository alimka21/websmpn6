// Helper pagination untuk semua route Express.
// Pakai pola: parse query params → kirim ke prisma.findMany via { skip, take }
// → bungkus hasil + total via buildPaginatedResult.

export interface PaginationQuery {
  page?: string;
  limit?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Default limit = 20, max = 100 untuk cegah klien minta limit terlalu besar.
export function getPaginationParams(query: PaginationQuery) {
  const page  = Math.max(1, parseInt(query.page  || "1",  10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit || "20", 10) || 20));
  const skip  = (page - 1) * limit;
  return { page, limit, skip };
}

export function buildPaginatedResult<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): PaginatedResult<T> {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    data,
    pagination: {
      page, limit, total, totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}
