# AI  interview

下一代智慧面試平台。結合 Google Gemini 即時視訊分析與情感辨識，搭配 Anthropic Claude 生成深度面試報告，為企業挖掘最合適的人才。

## 技術架構

- **前端：** React 19 + Vite 6 + Tailwind CSS
- **後端：** Express + TypeScript
- **資料庫：** PostgreSQL + Prisma ORM
- **AI：** Google Gemini Live API（即時面試）、Anthropic Claude（報告生成）

## 快速開始

### 環境需求

- Node.js 18+
- PostgreSQL

### 1. 安裝相依套件

```bash
# 前端
npm install

# 後端
cd server
npm install
```

### 2. 環境變數設定

**前端** — 建立 `.env.local`：

```
GEMINI_API_KEY=your_gemini_api_key
```

**後端** — 建立 `server/.env`：

```
DATABASE_URL=postgresql://postgres:password@localhost:5432/ai_interview
ANTHROPIC_API_KEY=your_anthropic_api_key
JWT_SECRET=your_random_secret_string
PORT=4000
```

### 3. 初始化資料庫

```bash
cd server
npx prisma migrate dev --schema=src/db/prisma/schema.prisma
```

### 4. 啟動開發伺服器

分別在兩個終端機執行：

```bash
# 終端機 1 — 後端 (port 4000)
cd server
npm run dev

# 終端機 2 — 前端 (port 3000)
npm run dev
```

開啟瀏覽器前往 `http://localhost:3000`。

## 功能特色

- **即時 AI 面試：** 透過 Gemini Live API 進行即時音視訊面試，支援語音辨識與逐字稿生成
- **非語言分析：** 面試過程中擷取表情快照，由 AI 進行情感辨識
- **智慧報告：** 面試結束後由 Claude 自動生成深度分析報告
- **影片錄製：** 完整錄製面試過程，供人資回放檢視
- **角色系統：** 支援求職者與企業管理員兩種角色
- **管理後台：** 管理員可瀏覽所有面試報告與影片紀錄

## 專案結構

```
├── components/          # React 元件
│   ├── AuthContext.tsx   # 認證上下文
│   ├── LiveSession.tsx   # 即時面試元件
│   ├── AdminDashboard.tsx
│   └── ...
├── services/            # 前端服務層
│   ├── api.ts           # API 請求封裝
│   ├── authService.ts   # 認證服務
│   └── ...
├── server/              # Express 後端
│   └── src/
│       ├── routes/      # API 路由
│       ├── db/          # Prisma schema & client
│       ├── middleware/   # 認證中介層
│       └── services/    # Claude 分析服務
├── App.tsx              # 主應用程式 & 狀態機
├── types.ts             # TypeScript 型別定義
└── vite.config.ts       # Vite 設定（含 proxy）
```

## API 路由

| 路徑前綴 | 說明 |
|---------|------|
| `/api/auth` | 認證（註冊、登入、忘記密碼、重設密碼） |
| `/api/jobs` | 職缺 CRUD |
| `/api/reports` | 面試報告 CRUD |
| `/api/videos` | 影片上傳、串流、刪除 |
| `/api/analysis` | Claude 分析代理 |
