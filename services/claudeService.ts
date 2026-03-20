import Anthropic from "@anthropic-ai/sdk";
import { InterviewReport, TranscriptItem, NonVerbalSnapshot } from "../types";

const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY || '';

export const generateInterviewReport = async (
  transcript: TranscriptItem[],
  nonVerbalSnapshots: NonVerbalSnapshot[],
  jobTitle: string,
  candidateName: string,
  jobDescription: string
): Promise<InterviewReport> => {
  const client = new Anthropic({
    apiKey: API_KEY,
    dangerouslyAllowBrowser: true,
  });

  const conversationText = transcript
    .map((t) => `[${t.relativeTime.toFixed(1)}s] ${t.role === 'model' ? '面試官' : '候選人'}: ${t.text}`)
    .join('\n');

  const nonVerbalLog = nonVerbalSnapshots
    .map(s => `[${s.relativeTime.toFixed(1)}s] 表情: ${s.expression}, 觀察: ${s.feedback}`)
    .join('\n');

  // Calculate interview duration
  const durationSeconds = transcript.length > 0
    ? transcript[transcript.length - 1].relativeTime - transcript[0].relativeTime
    : 0;

  // Count candidate vs interviewer turns
  const candidateTurns = transcript.filter(t => t.role === 'user').length;
  const interviewerTurns = transcript.filter(t => t.role === 'model').length;

  const prompt = `
你是一位擁有 15 年以上經驗的台灣人資面試專家，曾任職於多家台灣上市櫃企業的人力資源部門主管。
你的任務是根據以下面試逐字稿和非語言觀察紀錄，產出一份**嚴謹、貼近真實台灣職場標準**的面試評估報告。

## 職位資訊
- 職位名稱: ${jobTitle}
- 職位描述: ${jobDescription || '未提供'}

## 面試統計
- 面試時長: ${Math.round(durationSeconds / 60)} 分鐘
- 候選人發言次數: ${candidateTurns} 次
- 面試官發言次數: ${interviewerTurns} 次

## 面試逐字稿
${conversationText || '（無對話紀錄）'}

## 非語言觀察紀錄
${nonVerbalLog || '（無觀察紀錄）'}

---

## 評分標準（請嚴格遵守）

### 總分 (overallScore) 對應標準：
- **85-100**: 極為優秀，回答具體且有量化成果，展現深度專業知識，完全符合職位需求，溝通表達出色。此區間應極少出現。
- **70-84**: 良好，多數回答有具體案例支持，專業能力達標，溝通順暢但仍有成長空間。
- **55-69**: 普通，回答偏籠統或缺乏具體細節，部分問題未能展現與職位的關聯性。
- **40-54**: 待加強，多數回答空泛或離題，缺乏相關經驗或無法有效表達。
- **0-39**: 不合格，明顯準備不足、態度消極、或嚴重缺乏基本能力。

### 各維度評分標準 (dimensionScores)：
- **answerQuality (回答品質)**: 候選人是否使用 STAR 法則（情境-任務-行動-結果）回答行為面試題？回答是否具體且有量化數據？是否避免空泛的陳述？
- **communicationSkill (溝通流暢)**: 表達是否清晰有條理？是否有語句不通順、重複、或過長的停頓？是否能針對問題精準回應而非離題？
- **jobFit (職位匹配)**: 候選人的經驗、技能和回答內容與該職位描述的匹配程度如何？是否展現對該職位所需核心能力的理解？
- **professionalDepth (專業深度)**: 回答是否展現技術或領域的深度理解？是否只停留在表面描述？是否能提出見解或方法論？
- **nonVerbalPresence (非語言表現)**: 基於非語言觀察紀錄，候選人的表情、肢體語言、眼神接觸是否適當？是否過度緊張或表現出不自信？

### questionAnalysis 的評分標準：
- 每題 score 需獨立評估，不要所有題目都給差不多的分數
- 如果候選人回答空泛、只講概念不講具體經驗，該題不應超過 60 分
- 如果候選人使用了 STAR 法則且有具體成果，可以給 75-90 分
- 如果回答離題或幾乎沒有實質內容，應給 30-50 分
- suggestedAnswer 應該針對該職位提供具體的回答方向，而不是通用的模板答案

### 重要原則：
1. **不要當好人** — 台灣企業面試評估需要客觀嚴謹，避免所有維度都給高分的「灌水」行為
2. **分數應有區辨度** — 各維度分數應反映候選人的實際表現差異，不要全部集中在 70-80 分
3. **錄用建議要有依據** — hiringReason 必須引用逐字稿中的具體內容作為佐證
4. **改進建議要具體可行** — improvementPlan 不要寫「多練習面試」這種空話，要針對該候選人的具體弱點給出行動方案
5. **如果面試內容很短或對話不足** — 分數應偏低，並在 hiringReason 中註明資訊量不足以做完整評估

你必須 **只回傳一個合法的 JSON 物件**，不要有任何額外文字、markdown code block、或前導說明。
JSON 結構如下：
{
  "overallScore": <整數 0-100>,
  "hiringRecommendation": <"HIRE" | "CONSIDER" | "NO_HIRE">,
  "hiringReason": <字串，200-400字，引用逐字稿具體內容>,
  "strengths": [<字串>, ...],
  "weaknesses": [<字串>, ...],
  "improvementPlan": <字串，具體且可執行的改進建議>,
  "dimensionScores": {
    "answerQuality": <整數 0-100>,
    "communicationSkill": <整數 0-100>,
    "jobFit": <整數 0-100>,
    "professionalDepth": <整數 0-100>,
    "nonVerbalPresence": <整數 0-100>
  },
  "questionAnalysis": [
    {
      "question": <字串>,
      "answerSummary": <字串>,
      "score": <整數 0-100>,
      "feedback": <字串>,
      "suggestedAnswer": <字串，針對 ${jobTitle} 職位的具體建議回答>
    }
  ],
  "nonVerbalAnalysis": {
    "averageExpression": <字串>,
    "bodyLanguageScore": <整數 0-100>,
    "observations": [<字串>, ...],
    "tips": [<字串>, ...]
  }
}
`;

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 8192,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    });

    const responseText = message.content
      .filter(block => block.type === 'text')
      .map(block => (block as { type: 'text'; text: string }).text)
      .join('');

    if (!responseText) {
      throw new Error("No response text generated");
    }

    const cleaned = responseText.replace(/```json|```/g, '').trim();
    const result = JSON.parse(cleaned);

    return {
      ...result,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      candidateName,
      jobTitle,
      fullTranscript: transcript,
      nonVerbalLog: nonVerbalSnapshots
    } as InterviewReport;

  } catch (error) {
    console.error("Analysis failed", error);
    throw error;
  }
};
