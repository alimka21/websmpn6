// server/routes/auth.ts
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET!;

router.post('/login', async (req, res, next) => {
  try {
    const { identifier, password, role } = req.body;
    if (!identifier || !password || !role) {
      return res.status(400).json({ error: "Field tidak lengkap." });
    }

    let user = null;
    let queryRole = role;
    
    if (role === 'SISWA') {
      const siswa = await prisma.siswa.findUnique({
        where: { nis: identifier },
        include: { user: true },
      });
      user = siswa?.user;
    } else {
      user = await prisma.user.findUnique({ where: { email: identifier } });
    }

    if (!user) {
      return res.status(401).json({ error: "Akun tidak ditemukan." });
    }

    if (user.role !== queryRole && user.role !== role) {
      return res.status(403).json({ error: "Role tidak sesuai." });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: "Akun Anda dinonaktifkan." });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: "Password salah." });
    }
    
    const payload = { userId: user.id, role: user.role };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });

    await prisma.userSession.create({
      data: {
        userId: user.id,
        token: token,
        expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000)
      }
    });

    let name = user.email;
    if (user.role === 'SISWA') {
      const s = await prisma.siswa.findUnique({ where: { userId: user.id } });
      if (s) name = s.nama;
    } else if (user.role === 'GURU') {
      const g = await prisma.guru.findUnique({ where: { userId: user.id } });
      if (g) name = g.nama;
    } else if (user.role === 'SUPER_ADMIN') {
      const a = await prisma.admin.findUnique({ where: { userId: user.id } });
      if (a) name = a.nama;
    }

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 8 * 60 * 60 * 1000 // 8 jam
    });

    res.json({ token, user: { id: user.id, role: user.role, nama: name, email: user.email } });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', async (req, res, next) => {
  try {
    let token = req.cookies?.token;
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (token) {
      await prisma.userSession.deleteMany({ where: { token } });
    }
    res.clearCookie('token');
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const userId = (req.user as any).userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        guru: true,
        siswa: { include: { kelas: true } },
        admin: true,
      }
    });

    if (!user) return res.status(404).json({ error: "User tidak ditemukan" });
    
    const profile = 
      user.role === "GURU" ? user.guru :
      user.role === "SUPER_ADMIN" ? user.admin :
      user.siswa;

    res.json({
      id: user.id,
      email: user.email,
      role: user.role,
      profile
    });
  } catch (err) {
    next(err);
  }
});

export default router;
