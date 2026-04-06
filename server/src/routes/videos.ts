import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import { authenticate } from '../middleware/auth.js';
import { roleGuard } from '../middleware/roleGuard.js';
import { env } from '../config/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${path.extname(file.originalname || '.webm')}`;
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

// POST /api/videos/upload
router.post('/upload', authenticate, upload.single('video'), (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: '未上傳影片檔案' });
    return;
  }
  res.status(201).json({ videoPath: req.file.filename });
});

// GET /api/videos/token/:filename — 用主 JWT 換取短效影片存取 token
// 必須在 GET /:filename 之前註冊
router.get('/token/:filename', authenticate, (req: Request, res: Response) => {
  const filename = req.params.filename as string;
  const filePath = resolveUploadPath(filename);
  if (!filePath) {
    res.status(400).json({ error: '無效的檔案名稱' });
    return;
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

  res.json({ token, expiresAt: Date.now() + 5 * 60 * 1000 });
});

// GET /api/videos/:filename — 驗短效 token，串流影片
router.get('/:filename', (req: Request, res: Response) => {
  const filename = req.params.filename as string;
  const token = req.query.token as string | undefined;

  if (!token) {
    res.status(401).json({ error: '缺少存取 token' });
    return;
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as { filename: string; userId: string };
    if (payload.filename !== filename) {
      res.status(401).json({ error: 'Token 與影片不符' });
      return;
    }
  } catch {
    res.status(401).json({ error: 'Token 無效或已過期' });
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
