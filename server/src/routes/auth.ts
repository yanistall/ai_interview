import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../db/client.js';
import { env } from '../config/env.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

const isMissingResumeColumnError = (error: unknown): boolean => {
  const code = (error as any)?.code;
  if (code === 'P2022') return true; // Column does not exist
  const msg = String((error as any)?.message || '');
  return (
    msg.includes('resumeFileName') ||
    msg.includes('resumeMimeType') ||
    msg.includes('resumeData') ||
    msg.includes('companyName')
  );
};

const getUserProfileSafe = async (userId: string) => {
  try {
    return await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        companyName: true,
        role: true,
        resumeFileName: true,
        resumeMimeType: true,
        resumeData: true,
      },
    });
  } catch (error) {
    if (!isMissingResumeColumnError(error)) throw error;
    const base = await prisma.user.findUnique({
      where: { id: userId },
      // Keep fallback select to core columns only, so it still works on old schemas/clients.
      select: { id: true, email: true, name: true, role: true },
    });
    if (!base) return null;
    return {
      ...base,
      companyName: null,
      resumeFileName: null,
      resumeMimeType: null,
      resumeData: null,
    };
  }
};

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name, role } = req.body;

    if (!email || !password || !name) {
      res.status(400).json({ error: '請提供 email、password 和 name' });
      return;
    }

    if (role === 'ADMIN') {
      res.status(403).json({ error: '禁止前台註冊管理員帳號，請由後台建立。' });
      return;
    }

    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing) {
      res.status(409).json({ error: '此 email 已被註冊' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        role: role === 'ENTERPRISE' ? 'ENTERPRISE' : 'CANDIDATE',
      },
      select: { id: true, email: true, name: true, role: true },
    });

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: '註冊失敗' });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: '請提供 email 和 password' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, passwordHash: true, name: true, role: true },
    });
    if (!user) {
      res.status(401).json({ error: 'Email 或密碼錯誤' });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Email 或密碼錯誤' });
      return;
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: '登入失敗' });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ error: '請提供 email' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true },
    });
    if (!user) {
      // Don't reveal whether user exists
      res.json({ message: '如果此 email 已註冊，將會收到重設密碼的指示' });
      return;
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExp = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken, resetTokenExp },
    });

    // In production, send email with resetToken
    // For now, return it directly (development only)
    res.json({
      message: '如果此 email 已註冊，將會收到重設密碼的指示',
      resetToken, // Remove in production
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: '處理失敗' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      res.status(400).json({ error: '請提供 token 和 newPassword' });
      return;
    }

    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExp: { gt: new Date() },
      },
    });

    if (!user) {
      res.status(400).json({ error: '重設 token 無效或已過期' });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, resetToken: null, resetTokenExp: null },
    });

    res.json({ message: '密碼重設成功' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: '密碼重設失敗' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    const user = await getUserProfileSafe(req.user!.userId);

    if (!user) {
      res.status(404).json({ error: '使用者不存在' });
      return;
    }

    res.json({ user });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ error: '取得使用者資訊失敗' });
  }
});

// PUT /api/auth/profile
router.put('/profile', authenticate, async (req: Request, res: Response) => {
  try {
    const { name, companyName, resume } = req.body as {
      name?: string;
      companyName?: string;
      resume?: { fileName?: string; mimeType?: string; data?: string } | null;
    };

    let updated;
    try {
      updated = await prisma.user.update({
        where: { id: req.user!.userId },
        data: {
          ...(typeof name === 'string' ? { name } : {}),
          ...(typeof companyName === 'string' ? { companyName } : {}),
          ...(resume === null
            ? { resumeFileName: null, resumeMimeType: null, resumeData: null }
            : resume
            ? {
                resumeFileName: resume.fileName || null,
                resumeMimeType: resume.mimeType || null,
                resumeData: resume.data || null,
              }
            : {}),
        },
        select: {
          id: true,
          email: true,
          name: true,
          companyName: true,
          role: true,
          resumeFileName: true,
          resumeMimeType: true,
          resumeData: true,
        },
      });
    } catch (error) {
      if (!isMissingResumeColumnError(error)) throw error;
      const fallbackUser = await getUserProfileSafe(req.user!.userId);
      res.status(409).json({
        error: '資料庫尚未完成欄位升級（履歷/企業名稱），請先執行 migration。',
        user: fallbackUser,
      });
      return;
    }

    res.json({ user: updated });
  } catch (error) {
    console.error('Update profile error:', error);
    const code = (error as any)?.code;
    if (code === 'P2000') {
      res.status(400).json({ error: '履歷檔案過大，請壓縮後再上傳。' });
      return;
    }
    res.status(500).json({ error: `更新個人檔案失敗 (${String((error as any)?.message || 'unknown')})` });
  }
});

export default router;
