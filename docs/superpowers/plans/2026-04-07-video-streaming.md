# Video Streaming Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓影片回放改用短效 token + 原生 `<video>` 串流，取代先下載整個 Blob 的做法。

**Architecture:** 後端新增 `GET /api/videos/token/:filename` 端點，用主 JWT 換取 5 分鐘短效 token；原 `GET /api/videos/:filename` 改為驗 query param `?token=xxx`，移除 `authenticate` middleware，讓瀏覽器原生發出 Range Request。前端取得 token 後直接設給 `<video src>`，不再下載整個 Blob。

**Tech Stack:** Express + jsonwebtoken (已安裝)、React、TypeScript

---

### Task 1：後端修改 `server/src/routes/videos.ts`

**Files:**
- Modify: `server/src/routes/videos.ts`

**注意：** `GET /token/:filename` 必須在 `GET /:filename` 之前註冊，否則 Express 會把 "token" 當成 filename 處理。

- [ ] **Step 1: 確認目前 videos.ts 狀態**

  確認檔案開頭 import 區塊（已有 `Router`, `path`, `fs`, `authenticate`），以及路由順序。

- [ ] **Step 2: 加入 jwt import 與新 token 端點，並移除串流端點的 authenticate**

  將整個 `server/src/routes/videos.ts` 改為以下內容：

  ```typescript
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
    const filePath = path.join(UPLOADS_DIR, filename);

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

    const filePath = path.join(UPLOADS_DIR, filename);
    const contentType = getVideoContentType(filename);

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
    const filePath = path.join(UPLOADS_DIR, req.params.filename as string);

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: '影片不存在' });
      return;
    }

    fs.unlinkSync(filePath);
    res.json({ message: '影片已刪除' });
  });

  export default router;
  ```

- [ ] **Step 3: 手動驗證後端（啟動後端）**

  ```bash
  cd server && npm run dev
  ```

  預期輸出：`Server running on port 4000`，無 TypeScript 編譯錯誤。

- [ ] **Step 4: 驗證新 token 端點（需要有效 JWT）**

  先登入取得 JWT，再測試（把 `<JWT>` 換成實際 token，`<filename>` 換成 uploads 裡的真實檔名）：

  ```bash
  curl -H "Authorization: Bearer <JWT>" \
    http://localhost:4000/api/videos/token/<filename>
  ```

  預期回應：
  ```json
  { "token": "eyJ...", "expiresAt": 1234567890000 }
  ```

- [ ] **Step 5: 驗證串流端點接受 token**

  把上一步拿到的 token 放進 URL：

  ```bash
  curl -v -H "Range: bytes=0-1023" \
    "http://localhost:4000/api/videos/<filename>?token=<video-token>" \
    -o /dev/null
  ```

  預期：HTTP 206，`Content-Range: bytes 0-1023/...`

- [ ] **Step 6: 驗證舊 Authorization header 已不被接受**

  ```bash
  curl -v -H "Authorization: Bearer <JWT>" \
    http://localhost:4000/api/videos/<filename>
  ```

  預期：HTTP 401，`{ "error": "缺少存取 token" }`

- [ ] **Step 7: Commit**

  ```bash
  git add server/src/routes/videos.ts
  git commit -m "feat: add video token endpoint and migrate streaming to query-param token"
  ```

---

### Task 2：前端 `services/db.ts` — 替換 fetchVideoBlobUrl

**Files:**
- Modify: `services/db.ts`

- [ ] **Step 1: 修改 services/db.ts**

  將整個 `services/db.ts` 改為以下內容（移除 `fetchVideoBlobUrl`，新增 `fetchVideoToken`）：

  ```typescript
  import { apiFetch } from './api';

  const getVideoFileName = (blob: Blob): string => {
    if (blob.type.includes('mp4')) return 'interview.mp4';
    if (blob.type.includes('webm')) return 'interview.webm';
    return 'interview.bin';
  };

  export const saveVideo = async (blob: Blob): Promise<string> => {
    const formData = new FormData();
    formData.append('video', blob, getVideoFileName(blob));

    const res = await apiFetch('/videos/upload', {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      throw new Error('Failed to upload video');
    }

    const data = await res.json();
    return data.videoPath;
  };

  export const getVideoUrl = (videoPath: string): string => {
    return `/api/videos/${videoPath}`;
  };

  export const fetchVideoToken = async (filename: string): Promise<string> => {
    const res = await apiFetch(`/videos/token/${filename}`, { method: 'GET' });
    if (!res.ok) {
      throw new Error(`Failed to get video token: ${res.status}`);
    }
    const data = await res.json();
    return data.token as string;
  };

  export const deleteVideo = async (videoPath: string): Promise<void> => {
    await apiFetch(`/videos/${videoPath}`, { method: 'DELETE' });
  };
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add services/db.ts
  git commit -m "feat: replace fetchVideoBlobUrl with fetchVideoToken for direct streaming"
  ```

---

### Task 3：前端 `components/ReportView.tsx` — 使用 token URL

**Files:**
- Modify: `components/ReportView.tsx:1-56`

- [ ] **Step 1: 更新 import**

  將第 5 行的 import 從：
  ```typescript
  import { fetchVideoBlobUrl } from '../services/db';
  ```
  改為：
  ```typescript
  import { fetchVideoToken } from '../services/db';
  ```

- [ ] **Step 2: 更新 useEffect（第 21–56 行）**

  將 `loadVideo` 的 useEffect 從：
  ```typescript
  useEffect(() => {
    let mounted = true;
    let objectUrl: string | null = null;

    const loadVideo = async () => {
      if (!report.videoPath) {
        setVideoUrl(null);
        setVideoError(null);
        return;
      }

      try {
        setVideoError(null);
        const blobUrl = await fetchVideoBlobUrl(report.videoPath);
        if (!mounted) {
          URL.revokeObjectURL(blobUrl);
          return;
        }
        objectUrl = blobUrl;
        setVideoUrl(blobUrl);
      } catch (e) {
        console.error('Load video failed', e);
        if (mounted) {
          setVideoUrl(null);
          setVideoError('影片載入失敗，請稍後重試');
        }
      }
    };

    loadVideo();

    return () => {
      mounted = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [report.videoPath]);
  ```

  改為：
  ```typescript
  useEffect(() => {
    let mounted = true;

    const loadVideo = async () => {
      if (!report.videoPath) {
        setVideoUrl(null);
        setVideoError(null);
        return;
      }

      try {
        setVideoError(null);
        const token = await fetchVideoToken(report.videoPath);
        if (!mounted) return;
        setVideoUrl(`/api/videos/${report.videoPath}?token=${token}`);
      } catch (e) {
        console.error('Load video failed', e);
        if (mounted) {
          setVideoUrl(null);
          setVideoError('影片載入失敗，請稍後重試');
        }
      }
    };

    loadVideo();

    return () => {
      mounted = false;
    };
  }, [report.videoPath]);
  ```

- [ ] **Step 3: 啟動前端確認無 TypeScript 錯誤**

  ```bash
  npm run dev
  ```

  預期：前端正常啟動，console 無紅字。

- [ ] **Step 4: 瀏覽器手動測試**

  1. 登入後進入一個有影片的報告
  2. 開啟 DevTools → Network tab
  3. 確認有一筆 `GET /api/videos/token/<filename>` 請求（200 OK，回傳 token）
  4. 確認有 `GET /api/videos/<filename>?token=...` 請求，狀態碼為 **206**（非 200）
  5. 確認影片可以立即開始播放（不需等待整個檔案下載）
  6. 確認拖曳進度條可以跳轉

- [ ] **Step 5: Commit**

  ```bash
  git add components/ReportView.tsx
  git commit -m "feat: stream video via token URL, remove blob download"
  ```
