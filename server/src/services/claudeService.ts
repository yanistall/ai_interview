import Anthropic from '@anthropic-ai/sdk';
import { env } from '../config/env.js';
import {
  ASSESSMENT_VERSION,
  DIMENSION_CODES,
  getPresetCompetencyTags,
  validateCandidateAssessment,
  type CandidateAssessmentV1,
  type TranscriptTurn,
} from './candidateAssessment.js';

export interface GenerateReportParams {
  transcript: TranscriptTurn[];
  jobTitle: string;
  candidateName: string;
  jobDescription: string;
}

export interface GeneratedInterviewReport {
  assessmentVersion: typeof ASSESSMENT_VERSION;
  assessment: CandidateAssessmentV1;
  candidateName: string;
  jobTitle: string;
  fullTranscript: TranscriptTurn[];
}

type AnthropicMessageCreator = (
  params: Anthropic.MessageCreateParamsNonStreaming,
) => Promise<Anthropic.Message>;

let anthropicMessageCreatorForTesting: AnthropicMessageCreator | undefined;

const evidenceReferenceSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['relativeTime', 'quote', 'rationale'],
  properties: {
    transcriptItemId: { type: 'string' },
    relativeTime: { type: 'number' },
    quote: { type: 'string' },
    rationale: { type: 'string' },
  },
} as const;

const candidateAssessmentSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'dimensions', 'questionAnalyses', 'technicalQuality'],
  properties: {
    summary: { type: 'string' },
    dimensions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'code', 'status', 'level', 'evidenceSufficiency',
          'evidence', 'missingEvidence', 'nextActions',
        ],
        properties: {
          code: { type: 'string', enum: [...DIMENSION_CODES] },
          status: { type: 'string', enum: ['ASSESSED', 'NOT_ASSESSABLE'] },
          level: {
            anyOf: [
              { type: 'string', enum: ['DEVELOPING', 'BASIC', 'PROFICIENT', 'DISTINCT_STRENGTH'] },
              { type: 'null' },
            ],
          },
          evidenceSufficiency: { type: 'string', enum: ['SUFFICIENT', 'PARTIAL', 'INSUFFICIENT'] },
          evidence: { type: 'array', items: { $ref: '#/$defs/evidenceReference' } },
          missingEvidence: { type: 'array', items: { type: 'string' } },
          nextActions: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    questionAnalyses: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['question', 'answerSummary', 'competencyTags', 'evidence', 'nextAction'],
        properties: {
          question: { type: 'string' },
          answerSummary: { type: 'string' },
          competencyTags: { type: 'array', items: { type: 'string' } },
          evidence: { type: 'array', items: { $ref: '#/$defs/evidenceReference' } },
          nextAction: { type: 'string' },
        },
      },
    },
    technicalQuality: {
      type: 'object',
      additionalProperties: false,
      required: ['status', 'notes', 'affectedTranscriptRefs'],
      properties: {
        status: { type: 'string', enum: ['CLEAR', 'MINOR_ISSUES', 'PARTIAL', 'SEVERE'] },
        notes: { type: 'array', items: { type: 'string' } },
        affectedTranscriptRefs: { type: 'array', items: { $ref: '#/$defs/evidenceReference' } },
      },
    },
  },
  $defs: { evidenceReference: evidenceReferenceSchema },
} as const;

/** Test-only seam for replacing the external Anthropic request. */
export function setAnthropicMessageCreatorForTesting(
  creator: AnthropicMessageCreator | undefined,
): void {
  anthropicMessageCreatorForTesting = creator;
}

function formatTranscript(transcript: readonly TranscriptTurn[]): string {
  return transcript.map((turn) => {
    const speaker = turn.role === 'model' ? '面試官' : '候選人';
    const itemId = turn.itemId ? ` [itemId: ${turn.itemId}]` : '';
    const prefix = `[${turn.relativeTime.toFixed(1)}s] ${speaker}${itemId}: ${turn.text}`;

    if (turn.role !== 'model') {
      return prefix;
    }

    const tags = getPresetCompetencyTags(turn.text);
    return tags.length > 0
      ? `${prefix}\n  預設能力標籤：${tags.join('、')}`
      : `${prefix}\n  預設能力標籤：無（請依題目內容推論能力標籤）`;
  }).join('\n');
}

export function buildCandidateAssessmentPrompt({
  transcript,
  jobTitle,
  candidateName,
  jobDescription,
}: GenerateReportParams): string {
  const conversationText = formatTranscript(transcript);

  return `
你是一位協助候選人提升面試表現的台灣職涯顧問。請依據面試逐字稿產出可解釋、可行動的 B+ 能力評估。不得推測候選人的表情、外貌、肢體語言或其他非逐字稿可得資訊。

## 候選人與職缺
- 候選人：${candidateName}
- 職位名稱：${jobTitle}
- 職位描述：${jobDescription || '未提供'}

## 面試逐字稿
${conversationText || '（無對話紀錄）'}

## 評估規則
1. ANSWER_EVIDENCE、CONTENT_CLARITY、PROFESSIONAL_DEPTH 應依問題及候選人回答的逐字稿證據判定。JOB_COMPETENCY_MATCH 才必須以「問題、候選人回答、職務需求」三者的組合為依據；不可只依單一句回答或履歷關鍵字推論。
2. 必須產出且僅產出以下四個維度，各一筆：ANSWER_EVIDENCE（回答具體度與證據）、CONTENT_CLARITY（內容組織與可理解性）、JOB_COMPETENCY_MATCH（職務能力匹配）、PROFESSIONAL_DEPTH（專業深度與問題解決）。
3. 未被提問或未被回答的職務能力一律視為尚未驗證，不得推論為缺乏能力。與職務需求無關的題目不得降低 JOB_COMPETENCY_MATCH。職務需求對照僅用於 JOB_COMPETENCY_MATCH，不得作為其他維度判定 SUFFICIENT 的前提。職位描述為空或未提供時，只有 JOB_COMPETENCY_MATCH 必須為 NOT_ASSESSABLE，並將 level 設為 null；ANSWER_EVIDENCE、CONTENT_CLARITY、PROFESSIONAL_DEPTH 仍可依逐字稿判定。
4. 可判定的能力等級僅能使用 DEVELOPING、BASIC、PROFICIENT、DISTINCT_STRENGTH；證據不足時使用 NOT_ASSESSABLE，並將 level 設為 null；不可為了湊齊評估而猜測。等級定義如下：
   - DEVELOPING（發展中）：已有相關內容，但核心做法、證據或判斷仍有明顯缺口。
   - BASIC（基本達標）：能回答核心問題並呈現基本能力，但細節、結果或深度有限。
   - PROFICIENT（穩定展現）：有具體且一致的證據，能清楚說明做法、判斷與結果。
   - DISTINCT_STRENGTH（明確優勢）：多段證據顯示能處理複雜情境、權衡限制並產生明確成果。
5. 證據充分度只能使用下列定義：
   - SUFFICIENT（充分）：至少有清楚、直接且足以支撐判定的回答；較高等級原則上需要跨問題或同一回答內多項一致證據。
   - PARTIAL（部分）：有相關內容，但資訊不足以做完整判定。
   - INSUFFICIENT（不足）：沒有被問到、沒有實質回答，或逐字稿品質不足。
   - 證據充分度與能力等級分開。資訊不足不能用 DEVELOPING 代替。
6. 每個維度都要提供逐字稿證據、缺少的內容與下一步行動。證據需引用逐字稿中的 relativeTime、quote、rationale；逐字稿列有 itemId 時，必須一併提供相同的 transcriptItemId。
7. 每一個可辨識的面試官問題都要有 questionAnalyses。逐字稿中已列在問題旁的預設能力標籤必須原樣使用；沒有預設標籤的題目，請依題目內容推論 competencyTags。
8. 停頓、重複、技術干擾的能力評估權重為零。嚴重技術干擾只得改變證據充分度或狀態，不得降低能力等級；請在 technicalQuality 記錄其影響。
9. 說話速度、口音、填充詞、單次重複、停頓、疑似技術或逐字稿轉寫干擾及所有表面流暢度的能力評估權重為零。任何這類狀況及其成因只能標為「疑似」，不得斷言；這些因素只能改變證據充分度或狀態，不得降低能力等級。
10. 不可產生總分、錄用建議、外貌或肢體相關判斷，也不可為單題提供數字分數。

你必須只回傳一個合法 JSON 物件，不能使用 Markdown 或加入任何額外文字。JSON 必須只有下列欄位：
{
  "summary": "候選人導向的整體摘要",
  "dimensions": [
    {
      "code": "ANSWER_EVIDENCE | CONTENT_CLARITY | JOB_COMPETENCY_MATCH | PROFESSIONAL_DEPTH",
      "status": "ASSESSED | NOT_ASSESSABLE",
      "level": "DEVELOPING | BASIC | PROFICIENT | DISTINCT_STRENGTH | null",
      "evidenceSufficiency": "SUFFICIENT | PARTIAL | INSUFFICIENT",
      "evidence": [{ "transcriptItemId": "可選", "relativeTime": 0, "quote": "逐字稿原文", "rationale": "判定理由" }],
      "missingEvidence": ["尚缺少的資訊"],
      "nextActions": ["候選人可執行的下一步"]
    }
  ],
  "questionAnalyses": [
    {
      "question": "面試官問題",
      "answerSummary": "候選人回答摘要",
      "competencyTags": ["能力標籤"],
      "evidence": [{ "transcriptItemId": "可選", "relativeTime": 0, "quote": "逐字稿原文", "rationale": "判定理由" }],
      "nextAction": "候選人可執行的下一步"
    }
  ],
  "technicalQuality": {
    "status": "CLEAR | MINOR_ISSUES | PARTIAL | SEVERE",
    "notes": ["技術品質說明"],
    "affectedTranscriptRefs": [{ "transcriptItemId": "可選", "relativeTime": 0, "quote": "逐字稿原文", "rationale": "技術品質影響" }]
  }
}
`;
}

function logValidationFailure(
  category: 'EMPTY_RESPONSE' | 'INVALID_JSON' | 'INVALID_ASSESSMENT',
  attempt: number,
): void {
  console.error('Candidate assessment validation failed', { category, attempt });
}

export const generateInterviewReport = async ({
  transcript,
  jobTitle,
  candidateName,
  jobDescription,
}: GenerateReportParams): Promise<GeneratedInterviewReport> => {
  const prompt = buildCandidateAssessmentPrompt({
    transcript,
    jobTitle,
    candidateName,
    jobDescription,
  });
  const messageParams: Anthropic.MessageCreateParamsNonStreaming = {
    model: 'claude-sonnet-4-5',
    max_tokens: 8192,
    messages: [{ role: 'user', content: prompt }],
    output_config: {
      format: {
        type: 'json_schema',
        schema: candidateAssessmentSchema,
      },
    },
  };

  const createMessage = anthropicMessageCreatorForTesting
    ?? ((params: Anthropic.MessageCreateParamsNonStreaming) => (
      new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }).messages.create(params)
    ));

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const message = await createMessage(messageParams);
    const responseText = message.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as { type: 'text'; text: string }).text)
      .join('');

    if (!responseText) {
      logValidationFailure('EMPTY_RESPONSE', attempt);
      if (attempt < 2) continue;
      break;
    }

    const cleaned = responseText.replace(/```json|```/g, '').trim();
    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      logValidationFailure('INVALID_JSON', attempt);
      if (attempt < 2) continue;
      break;
    }

    try {
      const assessment: CandidateAssessmentV1 = validateCandidateAssessment(parsed, transcript);
      return {
        assessmentVersion: ASSESSMENT_VERSION,
        assessment,
        candidateName,
        jobTitle,
        fullTranscript: transcript,
      };
    } catch {
      logValidationFailure('INVALID_ASSESSMENT', attempt);
      if (attempt < 2) continue;
      break;
    }
  }

  throw new Error('AI 產出無法驗證，請重新產生報告');
};
