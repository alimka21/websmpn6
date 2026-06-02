import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware';

const router = Router();

// ── Publik ────────────────────────────────────────────────────────────────────

// GET /api/dokumen?limit=5  — dokumen aktif untuk landing page / halaman publik
router.get('/', async (req, res, next) => {
  try {
    const limit = req.query.limit ? Math.min(100, Number(req.query.limit)) : 100;
    const data = await prisma.dokumenSekolah.findMany({
      where: { isActive: true },
      orderBy: [{ urutan: 'asc' }, { createdAt: 'desc' }],
      take: limit,
      select: { id: true, judul: true, linkDrive: true, urutan: true },
    });
    res.json(data);
  } catch (err) { next(err); }
});

// ── Admin ─────────────────────────────────────────────────────────────────────

// GET /api/dokumen/all — semua dokumen (termasuk non-aktif)
router.get('/all', requireAuth, requireRole(['SUPER_ADMIN']), async (req, res, next) => {
  try {
    const data = await prisma.dokumenSekolah.findMany({
      orderBy: [{ urutan: 'asc' }, { createdAt: 'desc' }],
    });
    res.json(data);
  } catch (err) { next(err); }
});

// POST /api/dokumen — tambah dokumen baru
router.post('/', requireAuth, requireRole(['SUPER_ADMIN']), async (req, res, next) => {
  try {
    const { judul, linkDrive, urutan } = req.body;
    if (!judul?.trim()) return res.status(400).json({ error: 'Judul wajib diisi' });
    if (!linkDrive?.trim()) return res.status(400).json({ error: 'Link Google Drive wajib diisi' });
    const data = await prisma.dokumenSekolah.create({
      data: { judul: judul.trim(), linkDrive: linkDrive.trim(), urutan: Number(urutan) || 0 },
    });
    res.json(data);
  } catch (err) { next(err); }
});

// PATCH /api/dokumen/:id — update dokumen
router.patch('/:id', requireAuth, requireRole(['SUPER_ADMIN']), async (req, res, next) => {
  try {
    const { judul, linkDrive, urutan, isActive } = req.body;
    const payload: any = {};
    if (judul     !== undefined) payload.judul     = String(judul).trim();
    if (linkDrive !== undefined) payload.linkDrive = String(linkDrive).trim();
    if (urutan    !== undefined) payload.urutan    = Number(urutan);
    if (isActive  !== undefined) payload.isActive  = Boolean(isActive);
    const data = await prisma.dokumenSekolah.update({ where: { id: req.params.id }, data: payload });
    res.json(data);
  } catch (err) { next(err); }
});

// DELETE /api/dokumen/:id
router.delete('/:id', requireAuth, requireRole(['SUPER_ADMIN']), async (req, res, next) => {
  try {
    await prisma.dokumenSekolah.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
