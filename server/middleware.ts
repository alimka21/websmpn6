// server/middleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Augment Express Request supaya TS tahu req.userId ada — di-set oleh
// extractUserId middleware di bawah, dibaca oleh rate-limit keyGenerator
// dan boleh dipakai handler lain yang butuh user ID anonymous-safe.
declare module 'express-serve-static-core' {
  interface Request { userId?: string }
}

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET wajib di-set di environment variable dan minimal 32 karakter. Generate dengan: openssl rand -base64 48');
}

/**
 * Soft JWT decode untuk rate limiter — set req.userId kalau ada token valid,
 * silent pass-through kalau tidak ada / invalid (TIDAK return 401).
 *
 * Tujuan: rate limit bucket per user, bukan per IP. 500 siswa di balik
 * 1 NAT sekolah jadi 500 bucket terpisah, bukan 1 bucket 200/min yang
 * habis dalam 12 detik.
 */
export const extractUserId = (req: Request, _res: Response, next: NextFunction) => {
  try {
    let token = req.cookies?.token;
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET!) as { userId?: string };
      if (decoded?.userId) req.userId = decoded.userId;
    }
  } catch { /* anonymous — biarkan req.userId undefined, fallback ke IP */ }
  next();
};

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  try {
    let token = req.cookies?.token;
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ error: 'Belum login' });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; role: string };
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token tidak valid atau sudah kadaluarsa' });
  }
};

export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Akses ditolak. Anda tidak memiliki izin.' });
    }
    next();
  };
};

export const logger = (req: Request, res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
};

export const errorHandler = (err: any, req: Request, res: Response, _next: NextFunction) => {
  // Trap Prisma engine panic / spawn EAGAIN — kasih user error message
  // yang clean, tidak expose stack trace ratusan baris.
  const msg = String(err?.message || '');
  const isPrismaPanic =
    err?.name === 'PrismaClientRustPanicError' ||
    /timer has gone away/i.test(msg) ||
    /PANIC/i.test(msg);
  const isSpawnEagain = /spawn\b.*EAGAIN/i.test(msg);

  if (isPrismaPanic || isSpawnEagain) {
    console.error('[PRISMA ENGINE FAIL]', err?.name, msg.slice(0, 200));
    return res.status(503).json({
      error: 'Sistem database sedang mengalami gangguan. Mohon coba lagi dalam beberapa menit. Kalau berulang, hubungi admin.',
      _internalCode: isPrismaPanic ? 'PRISMA_PANIC' : 'SPAWN_EAGAIN',
    });
  }

  // Prisma P2025 — record not found (mis. delete() tanpa record yang cocok)
  if (err?.code === 'P2025' || (msg.includes('No record was found for a delete') || msg.includes('did not find a record') || msg.includes('expected one record to be affected'))) {
    return res.status(404).json({ error: 'Data tidak ditemukan atau sudah dihapus sebelumnya.' });
  }

  // Prisma P2003 — FK constraint (record masih direferensi tabel lain)
  if (err?.code === 'P2003') {
    return res.status(400).json({ error: 'Tidak dapat dihapus karena masih ada data terkait yang bergantung pada record ini.' });
  }

  // Prisma P2002 — unique constraint violation
  if (err?.code === 'P2002') {
    const field = err?.meta?.target;
    return res.status(400).json({ error: field ? `Nilai "${field}" sudah digunakan, gunakan nilai yang berbeda.` : 'Data duplikat — nilai sudah ada.' });
  }

  console.error('[SERVER ERROR]', err);
  res.status(err.status || 500).json({ error: err.message || 'Terjadi kesalahan pada server.' });
};
