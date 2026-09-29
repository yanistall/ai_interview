import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { authenticate } from '../middleware/auth.js';
import { roleGuard } from '../middleware/roleGuard.js';
import { env } from '../config/env.js';
import prisma from '../db/client.js';
import { canViewVideo } from '../services/videoAuthorization.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const uniqueName = `${randomUUID()}${path.extname(file.originalname || '.webm')}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
});

const router = Router();

const resolveUploadPath = (filename: string): string | null => {
  const resolved = path.resolve(UPLOADS_DIR, filename);
  if (!resolved.startsWith(UPLOADS_DIR + path.sep)) return null;
  return resolved;
};

const getVideoContentType = (filename: string): string => {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.mp4') return 'video/mp4';
  if (ext === '.webm') return 'video/webm';
  return 'application/octet-stream';
};

// POST /api/videos/upload - candidates and admins using the candidate portal
router.post('/upload', authenticate, roleGuard('CANDIDATE', 'ADMIN'), upload.single('video'), async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: '未上傳影片檔案' });
    return;
  }
  try {
    await prisma.videoUpload.create({
      data: { filename: req.file.filename, uploaderId: req.user!.userId },
    });
    res.status(201).json({ videoPath: req.file.filename });
  } catch (error) {
    fs.unlink(req.file.path, (unlinkError) => {
      if (unlinkError) console.error('Remove untracked video error:', unlinkError);
    });
    console.error('Register video upload error:', error);
    res.status(500).json({ error: '儲存影片失敗' });
  }
});

// GET /api/videos/token/:filename — 用主 JWT 換取短效影片存取 token
// 必須在 GET /:filename 之前註冊
router.get('/token/:filename', authenticate, async (req: Request, res: Response) => {
  const filename = req.params.filename as string;
  const filePath = resolveUploadPath(filename);
  if (!filePath) {
    res.status(400).json({ error: '無效的檔案名稱' });
    return;
  }
  try {
    if (req.user!.role !== 'ADMIN') {
      const uploadRecord = await prisma.videoUpload.findUnique({
        where: { filename },
        select: {
          uploaderId: true,
          report: {
            select: {
              candidateId: true,
              videoPath: true,
              jobProfile: { select: { createdById: true } },
            },
          },
        },
      });
      if (!canViewVideo(req.user!.role, req.user!.userId, filename, uploadRecord)) {
        res.status(403).json({ error: '無權限查看此影片' });
        return;
      }
    }

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: '影片不存在' });
      return;
    }

    const token = jwt.sign(
      { filename, userId: req.user!.userId },
      env.JWT_SECRET,
      { expiresIn: '5m' }
    );

    res.set('Cache-Control', 'no-store');
    res.json({ token, expiresAt: Date.now() + 5 * 60 * 1000 });
  } catch (error) {
    console.error('Issue video token error:', error);
    res.status(500).json({ error: '取得影片權杖失敗' });
  }
});

// GET /api/videos/:filename — 驗短效 token，串流影片
router.get('/:filename', async (req: Request, res: Response) => {
  const filename = req.params.filename as string;
  const token = req.query.token as string | undefined;

  if (!token) {
    res.status(401).json({ error: '缺少存取 token' });
    return;
  }

  let userId: string;
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as { filename: string; userId: string };
    if (payload.filename !== filename) {
      res.status(401).json({ error: 'Token 與影片不符' });
      return;
    }
    userId = payload.userId;
  } catch {
    res.status(401).json({ error: 'Token 無效或已過期' });
    return;
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { closedAt: true } });
    if (!user || user.closedAt) {
      res.status(401).json({ error: '帳號已註銷或不存在' });
      return;
    }
  } catch (error) {
    console.error('Check video token owner error:', error);
    res.status(500).json({ error: '無法驗證影片存取權限' });
    return;
  }

  const filePath = resolveUploadPath(filename);
  if (!filePath) {
    res.status(400).json({ error: '無效的檔案名稱' });
    return;
  }
  const contentType = getVideoContentType(filename);

  let stat: fs.Stats;
  try {
    stat = fs.statSync(filePath);
  } catch {
    res.status(404).json({ error: '影片不存在' });
    return;
  }
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = Math.min(parts[1] ? parseInt(parts[1], 10) : stat.size - 1, stat.size - 1);

    if (isNaN(start) || start < 0 || start >= stat.size || end < start) {
      res.status(416).set('Content-Range', `bytes */${stat.size}`).end();
      return;
    }

    const chunkSize = end - start + 1;

    const stream = fs.createReadStream(filePath, { start, end });
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${stat.size}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': contentType,
    });
    stream.pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': stat.size,
      'Content-Type': contentType,
    });
    fs.createReadStream(filePath).pipe(res);
  }
});

// DELETE /api/videos/:filename (ADMIN only)
router.delete('/:filename', authenticate, roleGuard('ADMIN'), (req: Request, res: Response) => {
  const filePath = resolveUploadPath(req.params.filename as string);
  if (!filePath) {
    res.status(400).json({ error: '無效的檔案名稱' });
    return;
  }
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: '影片不存在' });
    return;
  }

  fs.unlinkSync(filePath);
  res.json({ message: '影片已刪除' });
});

export default router;
