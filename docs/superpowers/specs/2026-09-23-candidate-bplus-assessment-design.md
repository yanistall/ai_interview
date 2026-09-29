# 候選人 B+ 四級評測設計

日期：2026-09-23

## 目標與成功標準

第一階段將面試後報告定位為候選人的練習與改善工具，使用 B+ 四級能力評測，不再把候選人的表現壓縮成單一總分或錄用結論。同時保留可追溯、可版本化的結構化資料，讓未來企業版可以加入職缺權重與排序，而不必重新解讀既有逐字稿。

成功標準：

- 新報告不顯示或產生整體分數、整體等級與錄用建議。
- 每個能力維度都有能力等級、判定證據、缺少內容、下一步行動及證據充分度。
- 資訊不足時使用「無法判定」，不得自動判為最低等級。
- 停頓、語速、口音、單次重複、疑似網路延遲或語音辨識錯誤不影響能力等級。
- 職務能力匹配以「問題＋回答＋職缺需求」為評測單位，而不是履歷關鍵字或單一回答。
- 所有既有舊版報告與關聯影片在 migration 前清除；完成後系統只保存與顯示 B+ 報告。

## 範圍

本階段包含：

- 後端面試報告 prompt 與結果驗證。
- B+ 評測 TypeScript 型別與版本化資料結構。
- 既有舊報告與關聯影片的範圍確認及一次性清除。
- 資料庫收斂為只保存 B+ 報告。
- 候選人與企業目前共用報告畫面的 B+ 呈現。
- 逐字稿證據定位，以及預設題目與臨場追問的混合能力對應。
- 針對評測規則、舊 payload 拒絕、資料清理範圍及畫面內容的自動測試。

本階段不包含：

- 企業候選人排名、錄用門檻或職缺權重 UI。
- 依外貌、表情、眼神、姿勢或其他非語言行為評分。
- 依停頓、語速、口音、口頭禪或單次重複評分。
- 讓企業自行編輯能力模型或手動標記每一題。
- 從舊報告推算或捏造 B+ 等級；舊資料會直接刪除。

## 方案選擇

### 採用：單一版本化 B+ 評測

新增必要的 `assessmentVersion` 與 `assessment`，清除舊資料後移除數字評分、錄用建議與非語言分析欄位。前後端只維護 B+ 契約。

優點是資料語意乾淨、沒有兩套畫面與型別，也不會讓未來企業版誤用舊分數。代價是既有舊報告與關聯影片無法保留；使用者已明確接受此取捨。

### 不採用：沿用原數字欄位

把四級制轉成 25／50／75／100 或保留隱藏總分，會產生不存在的精確度，也容易讓未來企業版誤用，不符合本次產品目的。

### 不採用：平行保留舊版報告

將舊數字欄位改為可空並維護兩套畫面可保留歷史資料，但會增加持續維護成本。因本階段允許刪除舊報告，所以不採用。

### 暫不採用：每個能力與證據拆成關聯資料表

完整關聯模型最適合日後進行跨候選人統計與企業權重計算，但第一階段的查詢需求仍以單份報告為主。先使用有版本的 JSON，等企業版需求穩定後再正規化，可避免過早固定資料模型。

## 評測模型

### 四個能力維度

1. `ANSWER_EVIDENCE`／回答具體度與證據
   - 評估是否提供情境、行動、成果或可驗證細節。
   - STAR 只是可用結構之一，不得要求所有技術題或知識題都使用 STAR。
2. `CONTENT_CLARITY`／內容組織與可理解性
   - 評估是否切題、脈絡清楚、重點可理解。
   - 不評語速、停頓、口音、口頭禪、單次重複或疑似技術干擾。
3. `JOB_COMPETENCY_MATCH`／職務能力匹配
   - 將問題意圖、候選人回答及職缺說明一起判定。
   - 未被提問或未取得回答的職務能力只能標示未驗證，不能判為不匹配。
4. `PROFESSIONAL_DEPTH`／專業深度與問題解決
   - 評估分析方法、判斷依據、取捨、領域知識及解決問題的過程。

### 四級代碼

穩定代碼與顯示文字分離：

| 代碼 | 顯示文字 | 定義 |
|---|---|---|
| `DEVELOPING` | 發展中 | 已有相關內容，但核心做法、證據或判斷仍有明顯缺口。 |
| `BASIC` | 基本達標 | 能回答核心問題並呈現基本能力，但細節、結果或深度有限。 |
| `PROFICIENT` | 穩定展現 | 有具體且一致的證據，能清楚說明做法、判斷與結果。 |
| `DISTINCT_STRENGTH` | 明確優勢 | 多段證據顯示能處理複雜情境、權衡限制並產生明確成果。 |

`NOT_ASSESSABLE` 是判定狀態，不是第五個能力等級。狀態為 `NOT_ASSESSABLE` 時，`level` 必須為 `null`。

### 證據充分度

- `SUFFICIENT`／充分：至少有清楚、直接且足以支撐判定的回答；較高等級原則上需要跨問題或同一回答內多項一致證據。
- `PARTIAL`／部分：有相關內容，但資訊不足以做完整判定。
- `INSUFFICIENT`／不足：沒有被問到、沒有實質回答，或逐字稿品質不足。

證據充分度與能力等級分開。資訊不足不能用 `DEVELOPING` 代替。

## 問題與職務能力的混合對應

- 系統預設題目使用程式內穩定映射，標記其主要能力意圖。
- 自訂題目與即時追問由分析模型根據問題文字、回答內容及職缺說明推論能力標籤。
- 每組問答輸出 `competencyTags`、回答摘要及引用證據。
- 問題與職缺無關時，不得用該問答降低 `JOB_COMPETENCY_MATCH`。
- 相同能力只有單一薄弱問答時，證據充分度不得標為充分。
- 維度結論不得以每題等權平均計算；模型需綜合核心職務需求與證據一致性。

第一階段不修改職缺建立 UI。未來若要讓企業明確指定每題能力標籤，可沿用同一 `competencyTags` 契約。

## 技術干擾規則

評測資料包含獨立的 `technicalQuality`：

- `CLEAR`：未發現明顯干擾。
- `MINOR_ISSUES`：可能有局部斷句、重複或辨識問題，但仍可評估。
- `PARTIAL`：部分回答無法可靠判定，受影響維度降低證據充分度。
- `SEVERE`：整體資訊不足，相關維度使用 `NOT_ASSESSABLE`，並建議重新面試。

逐字稿本身無法證明網路問題，因此模型只能標示「疑似技術或轉錄干擾」，不可斷言原因。無論技術品質狀態為何，表面流暢度的評分權重都是 0%。只有重複或混亂持續出現在不同回答、排除明顯轉錄問題，且確實妨礙理解時，才能列為不計分的改善提醒。

## 資料契約

新報告使用 `candidate-bplus-v1`。核心結構如下：

```ts
type AssessmentLevel =
  | 'DEVELOPING'
  | 'BASIC'
  | 'PROFICIENT'
  | 'DISTINCT_STRENGTH';

type AssessmentStatus = 'ASSESSED' | 'NOT_ASSESSABLE';
type EvidenceSufficiency = 'SUFFICIENT' | 'PARTIAL' | 'INSUFFICIENT';

interface EvidenceReference {
  transcriptItemId?: string;
  relativeTime: number;
  quote: string;
  rationale: string;
}

interface CompetencyAssessment {
  code:
    | 'ANSWER_EVIDENCE'
    | 'CONTENT_CLARITY'
    | 'JOB_COMPETENCY_MATCH'
    | 'PROFESSIONAL_DEPTH';
  status: AssessmentStatus;
  level: AssessmentLevel | null;
  evidenceSufficiency: EvidenceSufficiency;
  evidence: EvidenceReference[];
  missingEvidence: string[];
  nextActions: string[];
}

interface CandidateAssessmentV1 {
  summary: string;
  dimensions: CompetencyAssessment[];
  questionAnalyses: Array<{
    question: string;
    answerSummary: string;
    competencyTags: string[];
    evidence: EvidenceReference[];
    nextAction: string;
  }>;
  technicalQuality: {
    status: 'CLEAR' | 'MINOR_ISSUES' | 'PARTIAL' | 'SEVERE';
    notes: string[];
    affectedTranscriptRefs: EvidenceReference[];
  };
}
```

`TranscriptItem` 新增可選的 `itemId`。新逐字稿保存 Realtime item ID，證據優先以 `itemId` 定位；若輸入來源沒有 ID，則以 `relativeTime` 與引用文字回退定位。

資料庫保留必要的報告識別、逐字稿、擁有權與影片關聯欄位，並新增：

- `assessmentVersion String`
- `assessment Json`

移除 `overallScore`、`hiringRecommendation`、`hiringReason`、`strengths`、`weaknesses`、`improvementPlan`、`dimensionScores`、`questionAnalysis`、`nonVerbalAnalysis` 與 `nonVerbalLog`。若 `HiringRecommendation` enum 沒有其他引用，也一併移除。

### 一次性舊資料清除

資料清除不能只靠 SQL migration，因為影片位於檔案系統。實作時依以下順序執行：

1. 只讀列出舊版 `InterviewReport` 筆數、其 `videoPath` 及對應 `VideoUpload` 筆數，並檢查檔案是否位於受控的 `server/uploads` 目錄。
2. 以既有資料生命週期服務逐筆刪除報告與其唯一關聯影片，避免直接使用廣泛路徑或遞迴刪除。
3. 清除只屬於舊報告的孤立 `VideoUpload` 紀錄與受控影片；不碰使用者、職缺、履歷或其他檔案。
4. 驗證報告、關聯上傳紀錄與目標影片均為零，再執行 schema migration。
5. Migration 移除舊欄位並加入非空的 B+ 欄位。因資料表已清空，不需要建立假預設值。

刪除不可回復。執行前的只讀盤點結果要向使用者報告，且實際清除範圍必須與本規格一致。

## 產生與驗證流程

1. 面試結束後，前端送出逐字稿、職稱、職缺說明及候選人名稱。
2. 後端建立只要求 B+ JSON 的分析 prompt；禁止總分、錄用建議、視覺判斷及表面流暢度評分。
3. 後端解析 JSON 後執行本地結構驗證與正規化：
   - 四個維度必須各出現一次，且不得有未知維度。
   - `ASSESSED` 必須有等級與至少一項判定依據。
   - `NOT_ASSESSABLE` 必須為 `level: null`。
   - 證據引用時間必須存在於逐字稿範圍，引用文字不得為空。
   - 技術品質為 `SEVERE` 時，不可產生無證據的高能力判定。
4. 驗證失敗時，API 回傳一般化的報告生成失敗訊息並記錄不含敏感逐字稿的結構錯誤；不得保存半成品報告。
5. 儲存時寫入 `assessmentVersion`、`assessment`、原始逐字稿及既有擁有權欄位，不接受舊版分數或錄用建議欄位。

不新增第三方驗證套件；使用集中、可單元測試的 TypeScript 驗證函式。

## 畫面設計

### B+ 報告

- 頂部顯示「本次練習摘要」與技術品質提醒，不顯示總分或錄用結果。
- 四個能力以卡片呈現，不使用暗示精密數值的雷達圖。
- 每張卡片顯示能力等級或「無法判定」、證據充分度、引用證據、缺少內容與下一步行動。
- 引用證據可跳轉到對應影片／逐字稿時間。
- 問答分析顯示該題對應的職務能力與改善方向，不顯示每題分數。
- 技術干擾只影響「是否能判定」與提醒文字，不呈現為候選人的缺點。

### 企業目前看到的內容

第一階段企業與候選人仍共用 B+ 能力報告。企業端不新增排名或錄用建議。未來企業版以同一證據資料加入權重與決策層，不改寫候選人版原始判定。

## 錯誤與邊界處理

- 完全沒有候選人回答：四個維度皆為 `NOT_ASSESSABLE`，技術品質依逐字稿情況標示，畫面提示無足夠內容。
- 只有一至兩個短回答：允許局部判定，但證據充分度通常為部分或不足。
- 職缺說明空白：`JOB_COMPETENCY_MATCH` 標示無法判定；其他維度仍可評估。
- 模型回傳未知代碼、重複維度或矛盾狀態：後端拒絕結果，不保存。
- 儲存請求缺少 `assessmentVersion` 或合法 `assessment`：回傳 400，不建立報告。

## 預計修改範圍

- `types.ts`：以 B+ 型別取代舊分數型別，新增版本欄位及可選 `TranscriptItem.itemId`。
- `services/realtimeTranscript.ts`：新快照保留 `itemId`。
- `server/src/services/claudeService.ts`：改為 B+ prompt，加入解析、驗證與正規化。
- `server/src/routes/reports.ts`：只接受並保存 B+ 欄位。
- `server/src/db/prisma/schema.prisma`：新增必要的版本化評測欄位並移除舊欄位。
- `server/src/db/prisma/migrations/<timestamp>_candidate_bplus_assessment/`：明確標示會刪除舊評測欄位的破壞性 schema migration。
- `server/src/services/dataRetention.ts` 或一次性受控清理入口：盤點並刪除舊報告及關聯影片。
- `components/ReportView.tsx`：只呈現 B+ 報告。
- `components/AdminDashboard.tsx`、`components/EnterpriseWorkspace.tsx`：列表不再顯示 Score，改顯示「四級能力報告」。
- 測試檔：新增評測驗證、逐字稿 ID、B+ 畫面、舊 payload 拒絕與完成流程測試。

## 驗證策略

先以測試驅動完成：

1. 驗證四級代碼、四個必要維度、`NOT_ASSESSABLE` 規則與證據充分度。
2. 驗證停頓、重複與疑似技術干擾不會出現在評分規則中，且 prompt 明確禁止因此降低等級。
3. 驗證職務匹配 prompt 同時包含問題、回答與職缺需求，未提問能力只能標示未驗證。
4. 驗證 Realtime transcript 快照保留 item ID。
5. 驗證 B+ 畫面不含總分、錄用建議、每題分數與雷達圖，並完整呈現 B+ 欄位。
6. 驗證舊版儲存 payload 會被拒絕，且資料清理只涵蓋報告及關聯影片。
7. 執行前端正式建置、後端 TypeScript 建置、Prisma schema 驗證及既有 Node 測試。

資料庫 migration 會建立並驗證。這次只對目前專案設定所指向、經盤點確認的本機資料庫執行；不碰正式或共享資料庫。

## 相容與風險

- 模型輸出仍可能不穩定，因此不能只靠 prompt；後端結構驗證是必要條件。
- JSON 適合第一階段單份報告讀取，但未來跨報告統計前應評估正規化資料表。
- 同一 `ReportView` 目前服務多種角色；本階段刻意維持一致內容，未來企業決策層應另行設計，不在 B+ 卡片中偷加錄用結論。
- 工作樹已有多項未提交修改；實作只接觸本規格列出的檔案，保留並整合既有語音、隱私、影片授權與背景儲存變更。
