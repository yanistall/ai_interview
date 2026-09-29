import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../db/client.js';
import { env } from '../config/env.js';
import { authenticate } from '../middleware/auth.js';
import { eraseCandidateData } from '../services/dataRetention.js';

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
      select: { id: true, email: true, passwordHash: true, name: true, role: true, closedAt: true },
    });
    if (!user) {
      res.status(401).json({ error: 'Email 或密碼錯誤' });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid || user.closedAt) {
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

const verifyCandidatePassword = async (userId: string, password: unknown): Promise<boolean> => {
  if (typeof password !== 'string' || !password) return false;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true, role: true } });
  return !!user && user.role === 'CANDIDATE' && bcrypt.compare(password, user.passwordHash);
};

// Account closure disables access immediately; the scheduled purge removes data after 30 days.
router.post('/close-account', authenticate, async (req: Request, res: Response) => {
  try {
    if (!await verifyCandidatePassword(req.user!.userId, req.body?.password)) {
      res.status(403).json({ error: '密碼錯誤或帳號不支援此操作' });
      return;
    }
    const closedAt = new Date();
    await prisma.user.update({
      where: { id: req.user!.userId },
      data: { closedAt, resetToken: null, resetTokenExp: null },
    });
    res.json({ message: '帳號已註銷，資料將於 30 天後刪除', purgeAt: new Date(closedAt.getTime() + 30 * 86400000) });
  } catch (error) {
    console.error('Close account error:', error);
    res.status(500).json({ error: '註銷帳號失敗' });
  }
});

// A verified candidate's explicit request erases account data immediately.
router.delete('/my-data', authenticate, async (req: Request, res: Response) => {
  try {
    if (!await verifyCandidatePassword(req.user!.userId, req.body?.password)) {
      res.status(403).json({ error: '密碼錯誤或帳號不支援此操作' });
      return;
    }
    await eraseCandidateData(req.user!.userId);
    res.json({ message: '個人資料與面試紀錄已刪除' });
  } catch (error) {
    console.error('Erase candidate data error:', error);
    res.status(500).json({ error: '刪除資料失敗，請稍後重試或聯絡管理員' });
  }
});

// Self-service resets stay unavailable until a private delivery channel exists.
// Disable redemption too, so tokens exposed by older versions cannot be used.
const passwordResetUnavailable = (_req: Request, res: Response): void => {
  res.set('Cache-Control', 'no-store');
  res.status(503).json({ error: '目前暫停自助密碼重設，請聯絡系統管理員。' });
};

router.post('/forgot-password', passwordResetUnavailable);
router.post('/reset-password', passwordResetUnavailable);

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
