import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Message } from '@anthropic-ai/sdk/resources/messages/messages';
import { getPresetCompetencyTags, validateCandidateAssessment } from '../src/services/candidateAssessment.js';

const transcript = [
  { role: 'model', text: '請分享一個改善前端效能的案例。', timestamp: 1, relativeTime: 0, itemId: 'question-1' },
  { role: 'user', text: '我量測並改善了載入速度。', timestamp: 2, relativeTime: 12, itemId: 'answer-1' },
];

const evidence = {
  transcriptItemId: 'answer-1',
  relativeTime: 12,
  quote: '我量測並改善了載入速度。',
  rationale: '候選人描述了可驗證的改善行動。',
};

const validAssessment = {
  summary: '候選人能說明前端效能改善的具體作法與成果。',
  dimensions: [
    {
      code: 'ANSWER_EVIDENCE',
      status: 'ASSESSED',
      level: 'PROFICIENT',
      evidenceSufficiency: 'SUFFICIENT',
      evidence: [evidence],
      missingEvidence: ['可補充更多量化成果。'],
      nextActions: ['下次回答時補充改善前後的量化數據。'],
    },
    {
      code: 'CONTENT_CLARITY',
      status: 'ASSESSED',
      level: 'BASIC',
      evidenceSufficiency: 'PARTIAL',
      evidence: [evidence],
      missingEvidence: ['可補充決策脈絡。'],
      nextActions: ['依情境、行動與結果整理回答。'],
    },
    {
      code: 'JOB_COMPETENCY_MATCH',
      status: 'ASSESSED',
      level: 'BASIC',
      evidenceSufficiency: 'PARTIAL',
      evidence: [evidence],
      missingEvidence: ['尚缺職缺需求的對照說明。'],
      nextActions: ['說明做法如何對應職務需求。'],
    },
    {
      code: 'PROFESSIONAL_DEPTH',
      status: 'NOT_ASSESSABLE',
      level: null,
      evidenceSufficiency: 'INSUFFICIENT',
      evidence: [],
      missingEvidence: ['逐字稿沒有足夠的技術取捨說明。'],
      nextActions: ['準備一個含取捨與驗證方法的案例。'],
    },
  ],
  questionAnalyses: [
    {
      question: '請分享一個改善前端效能的案例。',
      answerSummary: '候選人提到量測後改善載入速度。',
      competencyTags: ['效能優化'],
      evidence: [evidence],
      nextAction: '補充使用的量測指標與改善結果。',
    },
  ],
  technicalQuality: {
    status: 'CLEAR',
    notes: ['逐字稿內容可判讀。'],
    affectedTranscriptRefs: [],
  },
};

test('maps fixed preset questions to deterministic competency tags', () => {
  assert.deepEqual(
    getPresetCompetencyTags('分享一個您解決過最困難的技術問題。'),
    ['問題分析', '解決方案', '專業知識'],
  );
  assert.deepEqual(getPresetCompetencyTags('自訂追問題目'), []);
});

test('accepts all four unique B+ dimensions in their stable order', () => {
  const normalized = validateCandidateAssessment(validAssessment, transcript);

  assert.equal(normalized.dimensions.length, 4);
  assert.deepEqual(normalized.dimensions.map((dimension) => dimension.code), [
    'ANSWER_EVIDENCE',
    'CONTENT_CLARITY',
    'JOB_COMPETENCY_MATCH',
    'PROFESSIONAL_DEPTH',
  ]);
  assert.notEqual(normalized, validAssessment);
});

test('rejects duplicate dimensions instead of accepting an incomplete assessment', () => {
  const duplicatedDimensions = [
    ...validAssessment.dimensions.slice(0, 3),
    { ...validAssessment.dimensions[2] },
  ];

  assert.throws(
    () => validateCandidateAssessment({ ...validAssessment, dimensions: duplicatedDimensions }, transcript),
    /four unique dimensions/i,
  );
});

test('requires NOT_ASSESSABLE dimensions to use a null level', () => {
  const withNotAssessableLevel = {
    ...validAssessment,
    dimensions: validAssessment.dimensions.map((dimension, index) => index === 3
      ? { ...dimension, level: 'DEVELOPING' }
      : dimension),
  };

  assert.throws(
    () => validateCandidateAssessment(withNotAssessableLevel, transcript),
    /NOT_ASSESSABLE.*null/i,
  );
});

test('requires assessed dimensions to cite evidence', () => {
  const withAssessedWithoutEvidence = {
    ...validAssessment,
    dimensions: validAssessment.dimensions.map((dimension, index) => index === 0
      ? { ...dimension, evidence: [] }
      : dimension),
  };

  assert.throws(
    () => validateCandidateAssessment(withAssessedWithoutEvidence, transcript),
    /ASSESSED.*evidence/i,
  );
});

test('rejects an assessed level when evidence sufficiency is insufficient', () => {
  const withInsufficientAssessedDimension = {
    ...validAssessment,
    dimensions: validAssessment.dimensions.map((dimension, index) => index === 0
      ? { ...dimension, evidenceSufficiency: 'INSUFFICIENT' }
      : dimension),
  };

  assert.throws(
    () => validateCandidateAssessment(withInsufficientAssessedDimension, transcript),
    /ASSESSED.*INSUFFICIENT/i,
  );
});

test('rejects sufficient evidence for a dimension that cannot be assessed', () => {
  const withSufficientUnassessableDimension = {
    ...validAssessment,
    dimensions: validAssessment.dimensions.map((dimension, index) => index === 3
      ? { ...dimension, evidenceSufficiency: 'SUFFICIENT' }
      : dimension),
  };

  assert.throws(
    () => validateCandidateAssessment(withSufficientUnassessableDimension, transcript),
    /NOT_ASSESSABLE.*SUFFICIENT/i,
  );
});

test('rejects evidence outside the transcript time range', () => {
  const withOutOfRangeTimestamp = {
    ...validAssessment,
    dimensions: validAssessment.dimensions.map((dimension, index) => index === 0
      ? { ...dimension, evidence: [{ ...evidence, relativeTime: 14.1 }] }
      : dimension),
  };

  assert.throws(
    () => validateCandidateAssessment(withOutOfRangeTimestamp, transcript),
    /transcript range/i,
  );
});

test('does not lower an assessed level when technical quality is severe', () => {
  const withSevereTechnicalQuality = {
    ...validAssessment,
    technicalQuality: {
      status: 'SEVERE',
      notes: ['部分語音疑似受技術干擾。'],
      affectedTranscriptRefs: [evidence],
    },
  };

  assert.equal(
    validateCandidateAssessment(withSevereTechnicalQuality, transcript).dimensions[0].level,
    withSevereTechnicalQuality.dimensions[0].level,
  );
});

test('rejects an evidence item id that is absent from the supplied transcript', () => {
  const withUnknownTranscriptItemId = {
    ...validAssessment,
    dimensions: validAssessment.dimensions.map((dimension, index) => index === 0
      ? { ...dimension, evidence: [{ ...evidence, transcriptItemId: 'missing-item' }] }
      : dimension),
  };

  assert.throws(
    () => validateCandidateAssessment(withUnknownTranscriptItemId, transcript),
    /transcriptItemId/i,
  );
});

test('rejects unknown fields so unrecognised model output is not persisted', () => {
  assert.throws(
    () => validateCandidateAssessment({ ...validAssessment, overallScore: 100 }, transcript),
    /unknown key/i,
  );
});

async function loadClaudeService() {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';
  process.env.ANTHROPIC_API_KEY ??= 'test-anthropic-key';
  process.env.JWT_SECRET ??= 'test-jwt-secret';

  return import('../src/services/claudeService.js');
}

function messageWithAssessment(assessment: unknown): Message {
  return {
    id: 'msg_test',
    container: null,
    content: [{ type: 'text', text: JSON.stringify(assessment), citations: null }],
    model: 'claude-sonnet-4-5',
    role: 'assistant',
    stop_reason: 'end_turn',
    stop_sequence: null,
    type: 'message',
    usage: {
      cache_creation: null,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
      inference_geo: null,
      input_tokens: 1,
      output_tokens: 1,
      server_tool_use: null,
      service_tier: 'standard',
    },
  };
}

test('builds a B+ prompt that keeps technical interference out of ability levels', async () => {
  const { buildCandidateAssessmentPrompt } = await loadClaudeService();
  const prompt = buildCandidateAssessmentPrompt({
    transcript,
    jobTitle: '前端工程師',
    candidateName: '測試候選人',
    jobDescription: '負責網站效能優化與跨團隊協作。',
  });

  for (const code of ['ANSWER_EVIDENCE', 'CONTENT_CLARITY', 'JOB_COMPETENCY_MATCH', 'PROFESSIONAL_DEPTH']) {
    assert.match(prompt, new RegExp(code));
  }
  for (const level of ['DEVELOPING', 'BASIC', 'PROFICIENT', 'DISTINCT_STRENGTH']) {
    assert.match(prompt, new RegExp(level));
  }
  assert.match(prompt, /NOT_ASSESSABLE/);
  assert.match(prompt, /問題、候選人回答、職務需求/);
  assert.match(prompt, /停頓、重複、技術干擾.*權重為零/);
  assert.match(prompt, /嚴重技術干擾.*證據充分度或狀態.*不得降低能力等級/);
  for (const legacyField of ['overallScore', 'hiringRecommendation', 'bodyLanguageScore', '"score"']) {
    assert.doesNotMatch(prompt, new RegExp(legacyField));
  }
});

test('marks unverified job competencies as non-assessable without penalising irrelevant questions', async () => {
  const { buildCandidateAssessmentPrompt } = await loadClaudeService();
  const prompt = buildCandidateAssessmentPrompt({
    transcript,
    jobTitle: '前端工程師',
    candidateName: '測試候選人',
    jobDescription: '',
  });

  assert.match(prompt, /未被提問或未被回答的職務能力.*尚未驗證.*不得推論為缺乏能力/);
  assert.match(prompt, /與職務需求無關的題目.*不得降低 JOB_COMPETENCY_MATCH/);
  assert.match(prompt, /職位描述為空或未提供時.*JOB_COMPETENCY_MATCH.*NOT_ASSESSABLE/);
});

test('defines B+ levels and evidence sufficiency before requesting the assessment', async () => {
  const { buildCandidateAssessmentPrompt } = await loadClaudeService();
  const prompt = buildCandidateAssessmentPrompt({
    transcript,
    jobTitle: '前端工程師',
    candidateName: '測試候選人',
    jobDescription: '負責網站效能優化與跨團隊協作。',
  });

  assert.match(prompt, /DEVELOPING（發展中）/);
  assert.match(prompt, /BASIC（基本達標）/);
  assert.match(prompt, /PROFICIENT（穩定展現）/);
  assert.match(prompt, /DISTINCT_STRENGTH（明確優勢）/);
  assert.match(prompt, /DEVELOPING（發展中）：已有相關內容，但核心做法、證據或判斷仍有明顯缺口/);
  assert.match(prompt, /BASIC（基本達標）：能回答核心問題並呈現基本能力，但細節、結果或深度有限/);
  assert.match(prompt, /PROFICIENT（穩定展現）：有具體且一致的證據，能清楚說明做法、判斷與結果/);
  assert.match(prompt, /DISTINCT_STRENGTH（明確優勢）：多段證據顯示能處理複雜情境、權衡限制並產生明確成果/);
  assert.match(prompt, /SUFFICIENT（充分）/);
  assert.match(prompt, /PARTIAL（部分）/);
  assert.match(prompt, /INSUFFICIENT（不足）/);
  assert.match(prompt, /SUFFICIENT（充分）：至少有清楚、直接且足以支撐判定的回答/);
  assert.match(prompt, /PARTIAL（部分）：有相關內容，但資訊不足以做完整判定/);
  assert.match(prompt, /INSUFFICIENT（不足）：沒有被問到、沒有實質回答，或逐字稿品質不足/);
  assert.match(prompt, /較高等級原則上需要跨問題或同一回答內多項一致證據/);
  assert.match(prompt, /證據充分度與能力等級分開。資訊不足不能用 DEVELOPING 代替/);
  assert.match(prompt, /職務需求對照僅用於 JOB_COMPETENCY_MATCH，不得作為其他維度判定 SUFFICIENT 的前提/);
  assert.match(prompt, /職位描述為空或未提供時，只有 JOB_COMPETENCY_MATCH 必須為 NOT_ASSESSABLE/);
  assert.match(prompt, /ANSWER_EVIDENCE、CONTENT_CLARITY、PROFESSIONAL_DEPTH 仍可依逐字稿判定/);
});

test('keeps all surface fluency and suspected technical issues out of ability levels', async () => {
  const { buildCandidateAssessmentPrompt } = await loadClaudeService();
  const prompt = buildCandidateAssessmentPrompt({
    transcript,
    jobTitle: '前端工程師',
    candidateName: '測試候選人',
    jobDescription: '負責網站效能優化與跨團隊協作。',
  });

  assert.match(prompt, /說話速度、口音、填充詞、單次重複、停頓、疑似技術或逐字稿轉寫干擾及所有表面流暢度.*權重為零/);
  assert.match(prompt, /只能標為「疑似」.*不得斷言/);
  assert.match(prompt, /只能改變證據充分度或狀態.*不得降低能力等級/);
});

test('passes transcript item IDs to the injected model call for evidence citations', async () => {
  const {
    generateInterviewReport,
    setAnthropicMessageCreatorForTesting,
  } = await loadClaudeService();
  let promptPassedToModel = '';
  setAnthropicMessageCreatorForTesting(async (params) => {
    const content = params.messages[0]?.content;
    assert.equal(typeof content, 'string');
    promptPassedToModel = content;
    return messageWithAssessment(validAssessment);
  });

  try {
    await generateInterviewReport({
      transcript,
      jobTitle: '前端工程師',
      candidateName: '測試候選人',
      jobDescription: '負責網站效能優化與跨團隊協作。',
    });

    assert.match(promptPassedToModel, /itemId: question-1/);
    assert.match(promptPassedToModel, /itemId: answer-1/);
  } finally {
    setAnthropicMessageCreatorForTesting(undefined);
  }
});

test('constrains the provider response to the B+ JSON contract', async () => {
  const {
    generateInterviewReport,
    setAnthropicMessageCreatorForTesting,
  } = await loadClaudeService();
  let outputFormat: unknown;
  setAnthropicMessageCreatorForTesting(async (params) => {
    outputFormat = params.output_config?.format;
    return messageWithAssessment(validAssessment);
  });

  try {
    await generateInterviewReport({
      transcript,
      jobTitle: '前端工程師',
      candidateName: '測試候選人',
      jobDescription: '負責網站效能優化與跨團隊協作。',
    });

    assert.deepEqual(
      {
        type: (outputFormat as any)?.type,
        required: (outputFormat as any)?.schema?.required,
        additionalProperties: (outputFormat as any)?.schema?.additionalProperties,
      },
      {
        type: 'json_schema',
        required: ['summary', 'dimensions', 'questionAnalyses', 'technicalQuality'],
        additionalProperties: false,
      },
    );
  } finally {
    setAnthropicMessageCreatorForTesting(undefined);
  }
});

test('retries one invalid provider result before failing the interview report', async () => {
  const {
    generateInterviewReport,
    setAnthropicMessageCreatorForTesting,
  } = await loadClaudeService();
  let attempts = 0;
  setAnthropicMessageCreatorForTesting(async () => {
    attempts += 1;
    return messageWithAssessment(attempts === 1 ? { overallScore: 100 } : validAssessment);
  });

  try {
    const report = await generateInterviewReport({
      transcript,
      jobTitle: '前端工程師',
      candidateName: '測試候選人',
      jobDescription: '負責網站效能優化與跨團隊協作。',
    });

    assert.equal(attempts, 2);
    assert.deepEqual(report.assessment, validAssessment);
  } finally {
    setAnthropicMessageCreatorForTesting(undefined);
  }
});

test('returns only the validated B+ report contract from a valid model response', async () => {
  const {
    generateInterviewReport,
    setAnthropicMessageCreatorForTesting,
  } = await loadClaudeService();
  setAnthropicMessageCreatorForTesting(async () => messageWithAssessment(validAssessment));

  try {
    const report = await generateInterviewReport({
      transcript,
      jobTitle: '前端工程師',
      candidateName: '測試候選人',
      jobDescription: '負責網站效能優化與跨團隊協作。',
    });

    assert.deepEqual(report, {
      assessmentVersion: 'candidate-bplus-v1',
      assessment: validAssessment,
      candidateName: '測試候選人',
      jobTitle: '前端工程師',
      fullTranscript: transcript,
    });
  } finally {
    setAnthropicMessageCreatorForTesting(undefined);
  }
});

test('rejects a model response that does not satisfy the B+ validation contract', async () => {
  const {
    generateInterviewReport,
    setAnthropicMessageCreatorForTesting,
  } = await loadClaudeService();
  let attempts = 0;
  setAnthropicMessageCreatorForTesting(async () => {
    attempts += 1;
    return messageWithAssessment({ overallScore: 100 });
  });

  try {
    await assert.rejects(
      () => generateInterviewReport({
        transcript,
        jobTitle: '前端工程師',
        candidateName: '測試候選人',
        jobDescription: '負責網站效能優化與跨團隊協作。',
      }),
      /無法驗證/,
    );
    assert.equal(attempts, 2);
  } finally {
    setAnthropicMessageCreatorForTesting(undefined);
  }
});
