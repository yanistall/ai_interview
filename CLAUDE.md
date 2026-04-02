# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 開發指令

```bash
# 前端
npm install       # 安裝前端相依套件
npm run dev       # 啟動前端開發伺服器（port 3000）
npm run build     # 正式環境建置
npm run preview   # 預覽正式環境建置結果

# 後端
cd server
npm install       # 安裝後端相依套件
npm run dev       # 啟動後端開發伺服器（port 4000）
npx prisma migrate dev --schema=src/db/prisma/schema.prisma   # 執行資料庫遷移
npx prisma studio --schema=src/db/prisma/schema.prisma        # 開啟 Prisma Studio
```

## 環境設定

**前端 `.env.local`：**
```
GEMINI_API_KEY=AIzaSy...             # Google Gemini Live API（即時面試）
```

**後端 `server/.env`：**
```
DATABASE_URL=postgresql://postgres:password@localhost:5432/ai_interview
ANTHROPIC_API_KEY=sk-ant-...    # Claude API（報告生成，僅後端）
JWT_SECRET=<隨機長字串>
PORT=4000
```

**注意環境變數注入方式：** `GEMINI_API_KEY` 透過 `vite.config.ts` 的 define 同時注入為 `process.env.API_KEY` 和 `process.env.GEMINI_API_KEY`（兩者等價）。前端透過 Vite dev proxy 存取 `/api` 路由，自動轉發至後端 `http://localhost:4000`。

## 架構概覽

本專案為 **React 19 + Vite 6 前端** 搭配 **Express + TypeScript 後端**，使用 PostgreSQL + Prisma ORM 做資料持久化。

### 雙 AI 設計

- **Google Gemini Live API**（`LiveSession` 元件）：透過 WebSocket 驅動即時音視訊面試，負責擷取逐字稿、非語言快照（由 Gemini Flash 進行表情分析）以及影片錄製。此部分維持在前端直連。
- **Anthropic Claude**（`server/src/services/claudeService.ts`）：面試結束後的分析，使用 `claude-sonnet-4-5`，API Key 安全存放於後端。前端透過 `/api/analysis/generate-report` 代理呼叫。

### 認證系統

- JWT 認證，24 小時有效
- 角色：`CANDIDATE`（求職者）、`ADMIN`（管理員）
- 前端 token 存於 `localStorage` (`auth_token`)
- `AuthContext` 提供 `{ user, login, register, logout, isLoading }`

### 狀態機導航

`App.tsx` 透過 `appState` enum 控制所有路由（不使用 React Router）：

```
LOGIN / REGISTER / FORGOT_PASSWORD（未登入狀態）
HOME → CANDIDATE_JOB_LIST → SESSION → PROCESSING → THANKS
HOME → ADMIN_DASHBOARD → ADMIN_REPORT_DETAIL（需 ADMIN 角色）
```

### 後端 API 路由

| 路徑前綴 | 說明 |
|---------|------|
| `/api/auth` | 認證（register, login, forgot-password, reset-password, me） |
| `/api/jobs` | 職缺 CRUD（GET/POST/PUT/DELETE） |
| `/api/reports` | 報告 CRUD（GET/POST/DELETE） |
| `/api/videos` | 影片上傳/串流/刪除 |
| `/api/analysis` | Claude 分析代理 |

### 資料持久化

| 儲存方式 | 服務檔案 | 內容 |
|---------|---------|------|
| PostgreSQL (Prisma) | `server/src/db/` | 使用者、職缺、面試報告 |
| 檔案系統 | `server/uploads/` | 面試影片 |

### 重要慣例

- **路徑別名：** `@/` 對應專案根目錄（同時設定於 `tsconfig.json` 與 `vite.config.ts`）
- **Tailwind CSS：** 透過 CDN 載入於 `index.html`，非 PostCSS
- **語言：** 所有 UI 文字與 AI prompt 均使用**繁體中文（台灣）**
- **音訊格式：** Gemini 輸入為 16kHz PCM，輸出為 24kHz PCM（參見 `services/audioUtils.ts`）
- **前端 Service 層：** 所有 service 函式皆為 async，透過 `services/api.ts` 的 `apiFetch` 與後端通訊
- **Prisma Schema：** 位於 `server/src/db/prisma/schema.prisma`（非預設路徑，所有 prisma CLI 指令需加 `--schema=src/db/prisma/schema.prisma`）
- **無 Linting/Testing 設定：** 專案目前無 ESLint、Prettier、或測試框架配置
- **React StrictMode：** `index.tsx` 使用 `<React.StrictMode>`，開發模式下 useEffect 會執行兩次，修改 `LiveSession` 等有副作用的元件時需注意
- **影片處理：** 前端使用 MediaRecorder（WebM），後端用 Multer 儲存至 `server/uploads/`，支援 HTTP 206 Range Request 串流播放
- **面試官人格系統：** 4 種 Persona（`FRIENDLY_HR`、`STRICT_MANAGER`、`TECHNICAL_LEAD`、`EXECUTIVE`），各有詳細行為腳本於 `services/personaPrompts.ts`
- **履歷上傳：** PDF/PNG/JPG/WEBP 轉 base64 後傳給 Gemini
