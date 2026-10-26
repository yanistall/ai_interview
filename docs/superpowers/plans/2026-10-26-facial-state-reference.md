# 面試表情與狀態參考更改計劃（提案）

> **For agentic workers:** 後續獲授權實作時使用 superpowers:executing-plans，逐項執行與驗證。本文件只有規劃，不代表已授權安裝相依套件、部署、commit 或開啟 PR。

**Goal:** 提供企業可選擇開關、求職者可獨立同意的表情觀察展示，並評估「自信／緊張」狀態參考是否具有足夠的驗證依據。

**Architecture:** 沿用 React、Vite、Express、Prisma。職缺設定由後端保存，前端讀取已授權的既有鏡頭串流，在瀏覽器背景執行緒進行臉部動作推論。心理狀態研究與正式招募評估分開。

**Tech Stack:** 既有 TypeScript、React 19、Vite 6、Express、PostgreSQL、Prisma；MediaPipe Face Landmarker 為待評估的新依賴，尚未安裝。

**Spec:** 本文件「需求與建議範圍」。日期：2026-10-26。

## 需求與建議範圍

- 使用者目標：以臉部表情作為自信、緊張等當下狀態的輔助參考及創新展示；企業發布或編輯職缺時可開啟／關閉。
- 「企業發布履歷」先按「企業發布職缺」理解。
- 現況已查核：職缺無表情功能設定；LiveSession 有既有鏡頭串流；InterviewConsent 排除人格及情緒推論；Claude 能力報告限定逐字稿證據。
- 推薦分兩條交付：正式流程先提供可觀察的臉部動作展示；自信／緊張自動推測先在志願者模擬面試中做可行性研究。
- MediaPipe 輸出臉部 landmarks 與 blendshape 係數，不直接提供已驗證的自信／緊張判斷。不得把微笑、皺眉、眨眼或頭部動作直接對應為心理狀態。
- 如需展示自信／緊張，第一版可另提供求職者選填自評，明確標記「本人自評」，與模型觀察分開；此為建議，尚未作為使用者已同意的規格。

## Global Constraints

- 新職缺及既有職缺預設關閉；企業開啟僅代表提供選用功能，求職者另行選擇，拒絕不阻擋面試。
- 模型觀察不進入 B+ 能力等級、錄用建議、排名或 Realtime 追問邏輯；不以未啟用、技術失敗或資料不足作負面判定。
- 第一版影格、landmarks、動作結果僅在瀏覽器記憶體處理，不新增上傳或持久化；原本的面試錄影仍依原流程處理與上傳，兩者需清楚告知。
- 僅於真正「開始面試」後處理影格；結束、關閉鏡頭、撤回同意、登出或離開時立即停止並清除分析暫存。若研究模式另有開始時間，需獨立告知與操作。
- 既有雙方字幕、語音、錄影與背景完成流程必須繼續正常運作。
- 不變更 .env，不安裝依賴，不清除資料，不修改無關使用者變更，不執行 migration 或部署。

## Review Focus

- 開關由 true 更新成 false 必須成功；不可用 truthy 判斷省略 false。
- 畫面仍持有舊職缺設定時，正式開始前重新確認後端設定；既有已開始面試使用開始時快照，新設定對後續面試生效。
- 關鏡頭、撤回同意或關閉功能時，過期推論回覆不可再更新畫面。
- 無臉、多人、低品質或模型失敗應顯示不可用，不產生心理標籤或預設零分；實際多人判定需驗證模型設定，不能由單臉模式推斷。
- StrictMode 重複掛載、語音重連及頁面隱藏不得建立重複推論循環或誤停既有錄影串流。

## Task 1：先驗證自信／緊張的技術可行性

**Deliverable:** 可重現的研究結果與模型適用範圍，決定是否值得另行實作自動心理狀態推測。

- [ ] 比較動作估計、情緒類別模型與自信／緊張目標的差異，查核訓練資料、授權、適用情境及輸出意義。
- [ ] 用另外同意的模擬面試志願者資料，配合選填自評及時間標記建立探索資料；不把自評視為可直接驗證的心理真值。
- [ ] 評估使用者之間、照明、眼鏡、遮擋、鏡頭角度與說話動作造成的誤差；驗證時以受試者分組，避免同一人的資料同時出現在訓練與測試中。
- [ ] 如模型有分類輸出，報告各類別 precision/recall、混淆情形、機率校準及拒絕判斷比例；不預先宣稱準確率。
- [ ] 若結果不支持跨人、跨情境使用，交付保留為動作展示及本人自評，不把推測接入企業正式招募報告。

## Task 2：企業職缺設定與持久化

**Files:** `types.ts`、`components/EnterpriseJobBuilder.tsx`、`services/jobService.ts`、`server/src/routes/jobs.ts`、`server/src/db/prisma/schema.prisma`，及新增 migration。

**Interface:** `JobProfile.facialObservationEnabled: boolean`，資料庫 `Boolean @default(false)`；`InterviewConfig` 帶入開始時的功能快照。

- [ ] 在新增、編輯、清空表單及職缺列表完整接入「表情觀察輔助（實驗功能）」開關。
- [ ] POST 省略值時預設 false；PUT 省略時保留原值，明確 false 時寫入 false；拒絕字串、數字及 null。
- [ ] 沿用企業只能修改自己職缺的權限；測試跨企業禁止更新及列表、單筆讀取往返一致性。
- [ ] 產出可審查的非破壞 migration；部署時另行執行並驗證 schema 版本，不能只靠 build 宣稱已上線。

## Task 3：獨立同意與啟用條件

**Files:** `components/InterviewConsent.tsx`、`components/CandidateJobSelector.tsx`、`App.tsx`、`types.ts`；新增 `services/facialObservationPolicy.ts`。

**Interface:** `canRunFacialObservation({ jobEnabled, candidateConsented, hasStarted, cameraEnabled }): boolean`；四項均為 true 才啟用。

- [ ] 基本面試同意與表情功能同意分開；預設不勾選，企業關閉時不要求此項同意。
- [ ] 告知實際分析內容、用途、處理位置、可見對象、暫存期限及停止方式。保留既有對人格／情緒推論的限制，除非未來另有明確的研究流程與同意範圍。
- [ ] 正式面試分析畫面第一版僅供求職者本人觀看；企業以專用模擬展示看技術，不直接取得求職者心理狀態標籤。
- [ ] 測試拒絕仍可面試、未同意無模型載入／取樣、撤回立即停止；若後續需要保存或企業分享，另設服務端同意紀錄、查閱權限及撤回機制，不能只信任前端勾選。

## Task 4：本機推論與即時展示

**Files:** `components/LiveSession.tsx`；新增 `services/facialObservation.ts`、`workers/facialObservation.worker.ts`、`components/FacialObservationPanel.tsx`。

**Interfaces:** 狀態 `OFF | LOADING | ACTIVE | PAUSED | UNAVAILABLE`；觀察輸出含 `relativeTimeMs` 與允許顯示的動作係數，不含自信／緊張分數。

- [ ] 在安裝前交付依賴來源、版本、授權、所需資產與風險供確認；優先採官方 Google MediaPipe，固定版本並自託管模型／WASM 資產。
- [ ] 共用既有 camera stream，只讀取影格，不重複要求鏡頭權限；模組停止時不得 stop 原本錄影所用 track。
- [ ] 使用 Web Worker；先以每秒 5 次作為效能實驗起點，一次只處理一個影格並丟棄積壓，最終頻率依實測調整。
- [ ] 展示微笑相關、眉部及眨眼動作，可切換 landmarks 疊圖；動作係數不得標為心理狀態機率。
- [ ] 關閉／卸載時取消取樣、終止 worker、釋放模型和影格並拒收過期訊息；相機重開可恢復，模型失敗不阻擋語音面試。

## Task 5：可選的研究展示與後續摘要

**第一版範圍:** 不將表情結果存進正式面試報告，不修改 B+ assessment contract 或將視覺資料送入 Claude。

- [ ] 若實作自評，標示「本人自評：目前有些緊張」並由本人主動填寫；不與模型係數合成一個狀態分數。
- [ ] 研究模式獨立於正式企業面試。只有 Task 1 提供足夠依據且另行確認規格後，才考慮顯示實驗模型估計及其不確定性。
- [ ] 若第二階段要保存時間軸，另行設計 `facialObservation` 獨立資料結構、schema 驗證、同意版本、開始設定快照、模型版本及品質摘要。
- [ ] 保存與企業分享需另行同意、物件層級授權與撤回／刪除；表情衍生資料保存期限不得超過所依附影片期限，影片到期時同步清除，避免摘要永久留存。
- [ ] 若改動完成儲存流程，同步修改 `services/interviewCompletion.ts`、`server/src/services/reportPayload.ts`、`server/src/routes/reports.ts`、`components/ReportView.tsx`、`server/src/services/dataRetention.ts`；不得拖延原本返回職缺列表的行為。

## Task 6：驗收與交付證據

- [ ] 新增政策、動作處理、職缺 boolean 往返、權限與 UI 狀態的針對性測試，遵循現有 `server/test` 測試寫法。
- [ ] 驗證企業關閉時無表情模型或資產請求；企業開啟但未同意仍不取樣；無影格或動作結果新增網路上傳。
- [ ] 用真實 Chrome／Safari、桌機與手機測試麥克風、鏡頭、WebRTC、逐字稿、錄影及低效能降級；記錄語音／畫面延遲、CPU 及錯誤，不以模擬測試代替真機證據。
- [ ] 檢查字幕不被新面板遮擋，未偵測到臉及低品質狀態可理解、可繼續面試。
- [ ] 執行前後端 build 與受影響既有測試；分開報告 build、模擬瀏覽器、真機與研究效度的驗證結果。

## 技術與研究來源

- [Google MediaPipe Face Landmarker Web 文件](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker/web_js)：landmarks、blendshapes、VIDEO 模式與 Worker 建議。
- [Google Blendshape 模型卡](https://storage.googleapis.com/mediapipe-assets/Model%20Card%20Blendshape%20V2.pdf)：輸出為動作係數，主要用途為 AR，存在照明、遮擋與角度限制。
- [Barrett 等，2019：Emotional Expressions Reconsidered](https://affective-science.org/wp-content/uploads/2024/04/barrett-et-al-2019-emotional-expressions-reconsidered-challenges-to-inferring-emotion-from-human-facial-movements.pdf)：臉部動作與情緒對應受個人、情境與文化影響，不能直接視為心理狀態真值。

## 本次交付狀態

只有此計劃文件；尚未實作、安裝依賴、執行 migration 或驗證辨識效度。既有無關工作目錄變更均予保留。文件已對照目前職缺、同意、鏡頭、報告與資料保留路徑自查；本計劃中的新檔名、資料欄位及推薦範圍均為提案。
