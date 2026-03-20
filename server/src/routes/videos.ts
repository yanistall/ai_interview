import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { authenticate } from '../middleware/auth.js';
import { roleGuard } from '../middleware/roleGuard.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');

// Ensure uploads directory exists
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

// POST /api/videos/upload
router.post('/upload', authenticate, upload.single('video'), (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: '未上傳影片檔案' });
    return;
  }
  res.status(201).json({ videoPath: req.file.filename });
});

// GET /api/videos/:filename - stream video
router.get('/:filename', authenticate, (req: Request, res: Response) => {
  const filePath = path.join(UPLOADS_DIR, req.params.filename as string);

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: '影片不存在' });
    return;
  }

  const stat = fs.statSync(filePath);
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
    const chunkSize = end - start + 1;

    const stream = fs.createReadStream(filePath, { start, end });
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${stat.size}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': 'video/webm',
    });
    stream.pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': stat.size,
      'Content-Type': 'video/webm',
    });
    fs.createReadStream(filePath).pipe(res);
  }
});

// DELETE /api/videos/:filename (ADMIN only)
router.delete('/:filename', authenticate, roleGuard('ADMIN'), (req: Request, res: Response) => {
  const filePath = path.join(UPLOADS_DIR, req.params.filename as string);

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: '影片不存在' });
    return;
  }

  fs.unlinkSync(filePath);
  res.json({ message: '影片已刪除' });
});

export default router;
