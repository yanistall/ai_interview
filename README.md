# AI  interview

語音面試平台。使用 OpenAI GPT Realtime 進行雙向語音對話與即時逐字稿，並由 Anthropic Claude 依逐字稿產生面試報告。

## 技術架構

- **前端：** React 19 + Vite 6 + Tailwind CSS
- **後端：** Express + TypeScript
- **資料庫：** PostgreSQL + Prisma ORM
- **AI：** OpenAI GPT Realtime（即時語音面試）、GPT-4o Transcribe（候選人逐字稿）、Anthropic Claude（報告生成）

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

**後端** — 建立 `server/.env`：

```
DATABASE_URL=postgresql://postgres:password@localhost:5432/ai_interview
ANTHROPIC_API_KEY=your_anthropic_api_key
OPENAI_API_KEY=your_openai_api_key
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

### 資料保存與刪除

- 部署新版本時先在 `server` 執行 `npx prisma migrate deploy --schema=src/db/prisma/schema.prisma`，再啟動後端。
- 後端啟動時與每小時檢查一次保存期限：影片上傳後 90 天刪除；候選人註銷帳號後 30 天刪除帳號、履歷、報告與相關影片。後端停機期間未執行的清理會在下次啟動時補跑，清理錯誤會記錄於伺服器日誌並在下次執行時重試。
- 候選人可在個人檔案刪除單筆面試紀錄，或輸入目前密碼立即刪除全部資料。企業與管理員刪除報告時由後端一併刪除影片。API 只會在刪除流程完成後回覆成功。
- 這些流程只涵蓋應用程式資料庫與 `server/uploads`。若部署環境另有資料庫備份、檔案備份或受託服務商副本，需在該環境另行設定刪除與驗證；目前程式碼無法保證 7 天內刪除那些副本，因此同意書不再宣稱該期限。
- 寄往同意書聯絡信箱的人工申請仍須由營運人員受理與回覆；應監控信箱，確保有效刪除申請在 72 小時內完成。自助刪除成功時，系統會立即在頁面顯示完成訊息。

## 功能特色

- **即時 AI 面試：** 透過 GPT Realtime 進行雙向語音對話，預設台灣繁體中文，面試中可切換英文
- **雙方字幕：** 即時顯示候選人與 AI 面試官的逐字稿，英文專有名詞不會自動切換面試語言
- **智慧報告：** 面試結束後由 Claude 生成 B+ 四級候選人成長報告，提供各能力面向的證據、缺口與下一步行動
- **面試錄製：** 錄下雙方語音與候選人鏡頭（若授權），逐字稿依時間與錄影一同儲存，回放時顯示同步字幕
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
| `/api/auth` | 認證（註冊、登入；自助密碼重設暫停至安全寄信流程完成） |
| `/api/jobs` | 職缺 CRUD |
| `/api/reports` | 面試報告 CRUD |
| `/api/videos` | 影片上傳、串流、刪除 |
| `/api/realtime` | GPT Realtime WebRTC 建立連線 |
| `/api/analysis` | Claude 分析代理 |
