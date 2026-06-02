import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware';

const router = Router();

// ── Publik ────────────────────────────────────────────────────────────────────

// GET /api/agenda?limit=5  — agenda aktif untuk landing page
router.get('/', async (req, res, next) => {
  try {
    const limit = req.query.limit ? Math.min(100, Number(req.query.limit)) : 100;
    const data = await prisma.agendaSekolah.findMany({
      where: { isActive: true },
      orderBy: { waktu: 'asc' },
      take: limit,
      select: { id: true, judul: true, waktu: true, lokasi: true },
    });
    res.json(data);
  } catch (err) { next(err); }
});

// ── Admin ─────────────────────────────────────────────────────────────────────

// GET /api/agenda/all — semua agenda
router.get('/all', requireAuth, requireRole(['SUPER_ADMIN']), async (req, res, next) => {
  try {
    const data = await prisma.agendaSekolah.findMany({
      orderBy: { waktu: 'asc' },
    });
    res.json(data);
  } catch (err) { next(err); }
});

// POST /api/agenda
router.post('/', requireAuth, requireRole(['SUPER_ADMIN']), async (req, res, next) => {
  try {
    const { judul, waktu, lokasi } = req.body;
    if (!judul?.trim()) return res.status(400).json({ error: 'Judul agenda wajib diisi' });
    if (!waktu)         return res.status(400).json({ error: 'Waktu agenda wajib diisi' });
    const data = await prisma.agendaSekolah.create({
      data: { judul: judul.trim(), waktu: new Date(waktu), lokasi: lokasi?.trim() || null },
    });
    res.json(data);
  } catch (err) { next(err); }
});

// PATCH /api/agenda/:id
router.patch('/:id', requireAuth, requireRole(['SUPER_ADMIN']), async (req, res, next) => {
  try {
    const { judul, waktu, lokasi, isActive } = req.body;
    const payload: any = {};
    if (judul    !== undefined) payload.judul    = String(judul).trim();
    if (waktu    !== undefined) payload.waktu    = new Date(waktu);
    if (lokasi   !== undefined) payload.lokasi   = lokasi?.trim() || null;
    if (isActive !== undefined) payload.isActive = Boolean(isActive);
    const data = await prisma.agendaSekolah.update({ where: { id: req.params.id }, data: payload });
    res.json(data);
  } catch (err) { next(err); }
});

// DELETE /api/agenda/:id
router.delete('/:id', requireAuth, requireRole(['SUPER_ADMIN']), async (req, res, next) => {
  try {
    await prisma.agendaSekolah.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
