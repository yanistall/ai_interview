# Candidate B+ Assessment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace numeric hiring reports with a candidate-focused, evidence-backed B+ four-level assessment and remove all legacy reports plus their associated videos.

**Architecture:** Add one versioned `candidate-bplus-v1` JSON assessment contract, validate it on the server, and persist it as the only report format. Preserve Realtime item IDs so evidence can jump to transcript/video timestamps, render four competency cards instead of scores, and use a narrowly scoped pre-migration file purge followed by a destructive database migration that removes legacy report fields.

**Tech Stack:** React 19, TypeScript 5.8, Express 4, Anthropic SDK, Prisma 6, PostgreSQL, Node built-in test runner with `tsx`.

**Spec:** `docs/superpowers/specs/2026-09-23-candidate-bplus-assessment-design.md`

## Global Constraints

- UI and AI prompt copy use Traditional Chinese (Taiwan).
- Use exactly four assessment levels: `DEVELOPING`, `BASIC`, `PROFICIENT`, `DISTINCT_STRENGTH`.
- `NOT_ASSESSABLE` is a status and always has `level: null`; it is not a fifth level.
- Technical interference, pauses, speaking speed, accent, filler words, and isolated repetition have zero scoring weight.
- Job competency match must use question, answer, and job requirements together; unasked competencies are unverified, not weak.
- Do not generate or display overall scores, overall levels, per-question scores, or hiring recommendations.
- Do not add third-party dependencies or modify `.env` files.
- Preserve unrelated dirty-worktree changes and the existing privacy, ownership, Realtime, and background-save work.
- Do not create commits; the user did not authorize commits.
- Before deleting data, show the exact report count, distinct referenced video count, and validated filenames, then obtain immediate confirmation for that exact scope.
- Only run migration deployment against the configured local database after verifying its host/database and pending migration list; never target a production or shared database.

## Review Focus

- Model returns all four dimensions but duplicates one code: validation must reject the entire response rather than silently keep one.
- Model returns `NOT_ASSESSABLE` with a non-null level or `ASSESSED` without evidence: validation must reject it.
- A transcript lacks `itemId` or contains repeated text: evidence must still resolve by `relativeTime`, without guessing a different turn.
- A report has severe technical-quality issues: affected dimensions may be unassessable, but the system must not lower their level because of the interference.
- Legacy purge sees an invalid filename or a file outside `server/uploads`: it must stop before database migration and never delete that path.

---

## File Structure

- Create `server/src/services/candidateAssessment.ts`: server-owned B+ codes, types, runtime validation, prompt-safe preset competency mapping, and evidence-bound checks.
- Create `server/src/services/reportPayload.ts`: strict B+ report-create request parser used by the route and tests.
- Create `server/test/candidateAssessment.test.ts`: runtime-contract and policy tests.
- Create `server/src/scripts/purgeLegacyReports.ts`: dry-run inventory and explicit `--execute-files` deletion of only distinct report-linked upload filenames.
- Create `server/src/scripts/verifyBplusMigration.ts`: read-only post-migration report/upload counts and schema-column verification.
- Create `server/test/purgeLegacyReports.test.ts`: filename validation, deduplication, and dry-run behavior.
- Create `server/src/db/prisma/migrations/20260923000000_candidate_bplus_assessment/migration.sql`: purge legacy DB rows, remove old columns/enum, and add required B+ columns.
- Modify `types.ts`: frontend B+ contract and `TranscriptItem.itemId`.
- Modify `services/realtimeTranscript.ts`: preserve `itemId` in final snapshots.
- Modify `server/src/services/claudeService.ts`: B+ prompt construction, model call, parse, and validation.
- Modify `server/src/routes/reports.ts`: accept and persist only B+ reports.
- Modify `server/src/db/prisma/schema.prisma`: make B+ the only report schema.
- Modify `components/ReportView.tsx`: competency cards, evidence jump links, missing evidence, actions, and technical-quality notice.
- Modify `components/AdminDashboard.tsx` and `components/EnterpriseWorkspace.tsx`: remove score/hiring aggregates and labels.
- Modify `services/claudeService.ts`, `services/interviewCompletion.ts`, `services/storageService.ts`, and relevant tests: carry the new report contract end to end.
- Modify `server/test/interviewCompletion.test.tsx` and `server/test/realtimeFixes.test.ts`: update fixtures and pin item-ID/report behavior.

### Task 1: Define and validate the B+ assessment contract

**Files:**
- Create: `server/src/services/candidateAssessment.ts`
- Create: `server/test/candidateAssessment.test.ts`
- Modify: `types.ts:45-105`

**Interfaces:**
- Produces: `ASSESSMENT_VERSION`, `DIMENSION_CODES`, `validateCandidateAssessment(value, transcript)`, `CandidateAssessmentV1`, and matching frontend `InterviewReport` types.
- Consumes: transcript turns with `role`, `text`, `timestamp`, `relativeTime`, and optional `itemId`.

- [ ] **Step 1: Write failing validator tests**

Create fixtures containing four dimensions and assert:

```ts
assert.equal(validateCandidateAssessment(validAssessment, transcript).dimensions.length, 4);
assert.throws(
  () => validateCandidateAssessment({ ...validAssessment, dimensions: duplicatedDimensions }, transcript),
  /four unique dimensions/i,
);
assert.throws(
  () => validateCandidateAssessment(withNotAssessableLevel, transcript),
  /NOT_ASSESSABLE.*null/i,
);
assert.throws(
  () => validateCandidateAssessment(withAssessedWithoutEvidence, transcript),
  /ASSESSED.*evidence/i,
);
assert.throws(
  () => validateCandidateAssessment(withOutOfRangeTimestamp, transcript),
  /transcript range/i,
);
assert.equal(
  validateCandidateAssessment(withSevereTechnicalQuality, transcript).dimensions[0].level,
  withSevereTechnicalQuality.dimensions[0].level,
);
```

- [ ] **Step 2: Run the focused test and verify failure**

Run:

```bash
cd server
node --import tsx --test test/candidateAssessment.test.ts
```

Expected: FAIL because `candidateAssessment.ts` and its exports do not exist.

- [ ] **Step 3: Implement the server contract and validator**

Define exact stable codes:

```ts
export const ASSESSMENT_VERSION = 'candidate-bplus-v1' as const;
export const DIMENSION_CODES = [
  'ANSWER_EVIDENCE',
  'CONTENT_CLARITY',
  'JOB_COMPETENCY_MATCH',
  'PROFESSIONAL_DEPTH',
] as const;
export const ASSESSMENT_LEVELS = [
  'DEVELOPING',
  'BASIC',
  'PROFICIENT',
  'DISTINCT_STRENGTH',
] as const;
```

`validateCandidateAssessment` must return a normalized copy, reject unknown keys/codes and duplicate/missing dimensions, enforce status/level/evidence rules, require non-empty `summary`, `missingEvidence`, `nextActions`, and validate every evidence `relativeTime` against the transcript minimum/maximum with a one-second tolerance. `transcriptItemId` is accepted only when it matches a supplied turn; otherwise reject it rather than silently falling back.

- [ ] **Step 4: Replace frontend legacy report types**

Add matching string unions and interfaces in `types.ts`, add `itemId?: string` to `TranscriptItem`, and define `InterviewReport` with:

```ts
assessmentVersion: 'candidate-bplus-v1';
assessment: CandidateAssessmentV1;
```

Remove `overallScore`, `hiringRecommendation`, `hiringReason`, `strengths`, `weaknesses`, `improvementPlan`, `dimensionScores`, `questionAnalysis`, `nonVerbalAnalysis`, and `nonVerbalLog`.

- [ ] **Step 5: Run focused tests and static checks**

Run the candidate assessment test again; expected PASS. Defer the repository-wide build until the legacy consumers are replaced in Tasks 3–6.

- [ ] **Step 6: Review checkpoint**

Run `git diff --check -- server/src/services/candidateAssessment.ts server/test/candidateAssessment.test.ts types.ts`; expected no whitespace errors. Do not commit.

### Task 2: Preserve transcript item IDs and question-to-competency inputs

**Files:**
- Modify: `services/realtimeTranscript.ts:1-110`
- Modify: `server/test/realtimeFixes.test.ts:40-95`
- Modify: `server/src/services/candidateAssessment.ts`
- Modify: `server/test/candidateAssessment.test.ts`

**Interfaces:**
- Consumes: Realtime `itemId` and role from existing turn aggregation.
- Produces: final `TranscriptItem[]` retaining `itemId`; `getPresetCompetencyTags(question): string[]` for fixed questions.

- [ ] **Step 1: Add failing item-ID and preset-mapping tests**

Add:

```ts
assert.equal(transcript.snapshot()[0].itemId, 'answer-1');
assert.deepEqual(
  getPresetCompetencyTags('分享一個您解決過最困難的技術問題。'),
  ['問題分析', '解決方案', '專業知識'],
);
assert.deepEqual(getPresetCompetencyTags('自訂追問題目'), []);
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
cd server
node --import tsx --test test/realtimeFixes.test.ts test/candidateAssessment.test.ts
```

Expected: item ID is absent from `snapshot()` and preset mapping export is absent.

- [ ] **Step 3: Preserve IDs and add deterministic preset mappings**

Change snapshot mapping to include `itemId`:

```ts
.map(({ itemId, role, text, timestamp, relativeTime }) => ({
  itemId,
  role,
  text: text.trim(),
  timestamp,
  relativeTime,
}));
```

Add a readonly mapping for every `PRESET_QUESTIONS` string. Return a copied array, not the mutable stored value. Custom and Realtime follow-up questions intentionally return `[]` so the model must infer tags from question, answer, and job description.

- [ ] **Step 4: Run focused tests**

Run the two tests again; expected PASS.

- [ ] **Step 5: Review checkpoint**

Run `git diff --check -- services/realtimeTranscript.ts server/test/realtimeFixes.test.ts server/src/services/candidateAssessment.ts server/test/candidateAssessment.test.ts`; expected no errors. Do not commit.

### Task 3: Generate only validated B+ reports

**Files:**
- Modify: `server/src/services/claudeService.ts`
- Modify: `server/test/candidateAssessment.test.ts`
- Modify: `services/claudeService.ts`

**Interfaces:**
- Consumes: `validateCandidateAssessment`, `getPresetCompetencyTags`, transcript, job title, job description, and candidate name.
- Produces: `buildCandidateAssessmentPrompt(params): string` and `generateInterviewReport(params)` returning only `assessmentVersion`, `assessment`, identity fields, and transcript.

- [ ] **Step 1: Add failing prompt-policy and parse tests**

Assert that the built prompt contains all four dimension codes, the four levels, `NOT_ASSESSABLE`, question+answer+job requirement instructions, and explicit zero-weight language for pauses/repetition/technical interference. Assert it explicitly says severe technical interference changes evidence sufficiency/status rather than lowering a level. Assert it does not request `overallScore`, `hiringRecommendation`, `bodyLanguageScore`, or a per-question numeric `score`.

Also stub a valid model JSON response and assert `generateInterviewReport` returns:

```ts
{
  assessmentVersion: 'candidate-bplus-v1',
  assessment: validAssessment,
  candidateName: '測試候選人',
  jobTitle: '前端工程師',
  fullTranscript: transcript,
}
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
cd server
node --import tsx --test test/candidateAssessment.test.ts
```

Expected: prompt still contains legacy numeric scoring and the result contains legacy fields.

- [ ] **Step 3: Extract prompt construction and replace the response contract**

Export `buildCandidateAssessmentPrompt`. Include preset tags beside matching interviewer questions and instruct the model to infer tags for unmatched questions. Require legal JSON only, with `technicalQuality`, `dimensions`, and `questionAnalyses` matching the spec.

After parsing, call:

```ts
const assessment = validateCandidateAssessment(JSON.parse(cleaned), transcript);
return {
  assessmentVersion: ASSESSMENT_VERSION,
  assessment,
  candidateName,
  jobTitle,
  fullTranscript: transcript,
};
```

Log only the validation error category; never log the full transcript or raw model response.

- [ ] **Step 4: Update the browser service**

Keep its API call shape, but return the new `InterviewReport` contract and stop casting legacy fields. Continue normalizing `id` and `timestamp` only.

- [ ] **Step 5: Run focused tests**

Run the assessment tests; expected PASS. Run `npm run build` in `server`; expected PASS for the server service and any remaining failures should point only to database client fields scheduled for Task 4.

- [ ] **Step 6: Review checkpoint**

Run `git diff --check -- server/src/services/claudeService.ts server/test/candidateAssessment.test.ts services/claudeService.ts`; expected no errors. Do not commit.

### Task 4: Replace the persisted report schema and API

**Files:**
- Modify: `server/src/db/prisma/schema.prisma:23-95`
- Create: `server/src/db/prisma/migrations/20260923000000_candidate_bplus_assessment/migration.sql`
- Modify: `server/src/routes/reports.ts:70-135`
- Create: `server/src/services/reportPayload.ts`
- Create: `server/test/reportPayload.test.ts`
- Modify: `services/storageService.ts`

**Interfaces:**
- Consumes: `ASSESSMENT_VERSION` and `validateCandidateAssessment`.
- Produces: Prisma `InterviewReport` with required `assessmentVersion` and `assessment`, and POST `/api/reports` rejecting legacy/malformed payloads with 400.

- [ ] **Step 1: Add failing route-payload tests around a pure parser**

Export `parseReportCreateInput(body)` from `server/src/services/reportPayload.ts`. Test valid B+ input and assert rejection of:

```ts
{ ...valid, assessmentVersion: undefined }
{ ...valid, assessmentVersion: 'legacy-v1' }
{ ...valid, assessment: malformedAssessment }
{ ...valid, overallScore: 80 }
{ ...valid, hiringRecommendation: 'HIRE' }
```

The last two are rejected as unknown legacy decision fields, not ignored.

- [ ] **Step 2: Run test and verify failure**

Run `cd server && node --import tsx --test test/reportPayload.test.ts`; expected FAIL because the parser does not exist.

- [ ] **Step 3: Update Prisma schema**

Keep `id`, `timestamp`, `candidateName`, `jobTitle`, `videoPath`, `fullTranscript`, ownership relations, and `videoUpload`. Add:

```prisma
assessmentVersion String
assessment        Json
```

Remove every legacy analysis field and remove `HiringRecommendation` when no longer referenced.

- [ ] **Step 4: Write the destructive migration explicitly**

The migration must execute in this order:

```sql
DELETE FROM "VideoUpload";
DELETE FROM "InterviewReport";
ALTER TABLE "InterviewReport"
  DROP COLUMN "nonVerbalLog",
  DROP COLUMN "overallScore",
  DROP COLUMN "hiringRecommendation",
  DROP COLUMN "hiringReason",
  DROP COLUMN "strengths",
  DROP COLUMN "weaknesses",
  DROP COLUMN "improvementPlan",
  DROP COLUMN "dimensionScores",
  DROP COLUMN "questionAnalysis",
  DROP COLUMN "nonVerbalAnalysis",
  ADD COLUMN "assessmentVersion" TEXT NOT NULL,
  ADD COLUMN "assessment" JSONB NOT NULL;
DROP TYPE "HiringRecommendation";
```

Do not apply it yet; Task 7 first removes files and confirms the database target.

- [ ] **Step 5: Implement strict report payload parsing and persistence**

Allow only identity, video, transcript, version, assessment, and `jobProfileId` fields. Validate the assessment against `fullTranscript`, then create:

```ts
data: {
  candidateName,
  jobTitle,
  videoPath,
  fullTranscript,
  assessmentVersion: ASSESSMENT_VERSION,
  assessment,
  candidateId: req.user!.userId,
  jobProfileId,
}
```

Preserve the existing atomic `VideoUpload` ownership claim and report authorization logic.

- [ ] **Step 6: Generate the Prisma client and run tests**

Run:

```bash
cd server
npx prisma format --schema=src/db/prisma/schema.prisma
npx prisma validate --schema=src/db/prisma/schema.prisma
npx prisma generate --schema=src/db/prisma/schema.prisma
node --import tsx --test test/reportPayload.test.ts test/candidateAssessment.test.ts
npm run build
```

Expected: schema valid, client generated, focused tests PASS, server build PASS. Do not deploy the migration yet.

- [ ] **Step 7: Review checkpoint**

Run `git diff --check -- server/src/db/prisma/schema.prisma server/src/db/prisma/migrations/20260923000000_candidate_bplus_assessment/migration.sql server/src/routes/reports.ts server/src/services/reportPayload.ts server/test/reportPayload.test.ts services/storageService.ts`; expected no errors. Do not commit.

### Task 5: Carry the B+ contract through background completion

**Files:**
- Modify: `services/interviewCompletion.ts`
- Modify: `server/test/interviewCompletion.test.tsx`

**Interfaces:**
- Consumes: the new `InterviewReport` returned by analysis and storage services.
- Produces: unchanged background upload→analysis→save behavior with B+ payloads.

- [ ] **Step 1: Replace the legacy report fixture**

Use a complete four-dimension `assessment` fixture with `assessmentVersion: 'candidate-bplus-v1'`. Assert the saved payload contains `assessment` and does not contain `overallScore` or `hiringRecommendation`.

- [ ] **Step 2: Run test and verify failure**

Run `cd server && node --import tsx --test test/interviewCompletion.test.tsx`; expected compile/assertion failure while the flow still expects the old shape.

- [ ] **Step 3: Update `ReportToSave` and dependencies**

Keep video upload and report generation concurrent. Change only the type contract required to merge `videoPath` and `jobProfileId`; do not change the existing before-unload guard or success/error callbacks.

- [ ] **Step 4: Run completion tests**

Run the focused test; expected PASS, including existing background-failure and page-unload behavior.

- [ ] **Step 5: Review checkpoint**

Run `git diff --check -- services/interviewCompletion.ts server/test/interviewCompletion.test.tsx`; expected no errors. Do not commit.

### Task 6: Render the B+ report and remove ranking UI

**Files:**
- Modify: `components/ReportView.tsx`
- Modify: `components/AdminDashboard.tsx`
- Modify: `components/EnterpriseWorkspace.tsx`
- Create: `server/test/candidateReportView.test.tsx`

**Interfaces:**
- Consumes: `InterviewReport.assessment` and transcript/video timing.
- Produces: candidate-focused four-card report and neutral list labels with no numeric or hiring UI.

- [ ] **Step 1: Add failing static-render tests**

Render a B+ report with one assessed dimension and one unassessable dimension. Assert the markup contains:

```ts
assert.match(markup, /本次練習摘要/);
assert.match(markup, /穩定展現/);
assert.match(markup, /無法判定/);
assert.match(markup, /證據充分度/);
assert.match(markup, /缺少內容/);
assert.match(markup, /下一步行動/);
assert.doesNotMatch(markup, /綜合評分|建議錄用|不予錄用|\/100/);
```

Render `AdminDashboard` and `EnterpriseWorkspace` fixtures and assert they do not contain `平均得分`, `建議錄取率`, `AI 評分`, or `Score`.

- [ ] **Step 2: Run view tests and verify failure**

Run `cd server && node --import tsx --test test/candidateReportView.test.tsx`; expected FAIL on legacy UI strings and score fields.

- [ ] **Step 3: Replace the report summary and radar chart**

Remove the radar chart and recommendation helpers. Add label maps for level, dimension, sufficiency, and technical-quality codes. Render four cards in the fixed dimension order. For `NOT_ASSESSABLE`, show `無法判定` and no level badge.

- [ ] **Step 4: Render evidence and safe jump behavior**

Each evidence quote shows its rationale and a button that calls `jumpToTime(evidence.relativeTime)`. Do not use quote text to search for another turn. If there is no video, still scroll/highlight the transcript turn matched by `itemId`, or by the closest exact `relativeTime` fallback.

- [ ] **Step 5: Render technical-quality and question analysis**

Display technical issues as neutral recording/transcription notices. Show question, answer summary, competency tags, evidence, and `nextAction`; do not show per-question scores.

- [ ] **Step 6: Remove score aggregates from list views**

`AdminDashboard` keeps total interviews and replaces the other two stats with neutral counts such as completed B+ reports and reports needing more evidence. Both list views display `四級能力報告` instead of `Score` or hiring status.

- [ ] **Step 7: Run view tests and frontend build**

Run:

```bash
cd server
node --import tsx --test test/candidateReportView.test.tsx
cd ..
npm run build
```

Expected: view tests PASS and Vite production build PASS.

- [ ] **Step 8: Review checkpoint**

Run `git diff --check` for the Task 6 files. Search `rg -n "overallScore|hiringRecommendation|questionAnalysis|dimensionScores|綜合評分|建議錄用|Score" --glob '!node_modules' --glob '!dist'`; expected matches only in the design/plan or migration drop statements, not active product code.

### Task 7: Inventory and remove legacy report files safely

**Files:**
- Create: `server/src/scripts/purgeLegacyReports.ts`
- Create: `server/test/purgeLegacyReports.test.ts`

**Interfaces:**
- Consumes: report IDs and `videoPath` values only.
- Produces: dry-run JSON summary and an explicit file-only purge that uses `unlinkVideo` for validated basename filenames.

- [ ] **Step 1: Write failing purge-scope tests**

Test `buildLegacyPurgeInventory(rows)` with duplicate paths, null paths, and `../outside.webm`. It must deduplicate valid basenames and reject the entire execution set if any non-null path fails validation. Test dry-run mode never invokes the unlink dependency.

- [ ] **Step 2: Run test and verify failure**

Run `cd server && node --import tsx --test test/purgeLegacyReports.test.ts`; expected FAIL because the script/helper does not exist.

- [ ] **Step 3: Implement dry-run and explicit file deletion**

Default invocation prints JSON only:

```json
{
  "reportCount": 0,
  "reportsWithVideo": 0,
  "distinctVideoCount": 0,
  "videoFilenames": []
}
```

Only `--execute-files` calls `unlinkVideo` for each validated distinct filename. It must not delete database rows; the migration owns DB deletion so pending migrations remain ordered.

- [ ] **Step 4: Run purge tests**

Run the focused test; expected PASS.

- [ ] **Step 5: Inspect the configured database without exposing credentials**

Run from `server`:

```bash
npx prisma migrate status --schema=src/db/prisma/schema.prisma
npx tsx src/scripts/purgeLegacyReports.ts
```

Report only database host/name (redact user/password), pending migration names, report count, referenced-video count, and validated filenames. Do not execute deletion in this step.

- [ ] **Step 6: Obtain immediate confirmation for the exact destructive scope**

Pause and ask the user to confirm the displayed report count and filename list. This is required even though the feature and general purge were approved earlier, because this is the immediate irreversible action gate.

- [ ] **Step 7: Delete only validated report-linked files**

After confirmation, run:

```bash
npx tsx src/scripts/purgeLegacyReports.ts --execute-files
```

Expected: one success record per distinct filename or a clean missing-file result; any other filesystem error stops execution before migration.

- [ ] **Step 8: Review checkpoint**

Run the script again in dry-run mode to retain the same DB inventory until migration, and verify the target files no longer exist without listing unrelated upload contents. Do not commit.

### Task 8: Apply the migration and verify the complete system

**Files:**
- Verify all files above
- Create: `server/src/scripts/verifyBplusMigration.ts`
- Modify: `README.md:76`

**Interfaces:**
- Consumes: confirmed file purge, validated schema, and all passing focused tests.
- Produces: migrated local database containing no legacy reports and an application that creates only B+ reports.

- [ ] **Step 1: Deploy pending migrations to the confirmed local database**

Run:

```bash
cd server
npx prisma migrate deploy --schema=src/db/prisma/schema.prisma
```

Expected: pending ownership/account migrations, if any, apply in order, then `20260923000000_candidate_bplus_assessment` clears report/upload rows and replaces legacy columns.

- [ ] **Step 2: Verify database shape and empty legacy data**

Create `verifyBplusMigration.ts` using `prisma.$queryRaw` against `information_schema.columns`. It must exit non-zero unless both table counts are zero, `assessmentVersion` and `assessment` exist, and all removed legacy columns are absent. Run:

```bash
npx prisma migrate status --schema=src/db/prisma/schema.prisma
npx tsx src/scripts/verifyBplusMigration.ts
```

Expected output must assert:

```text
InterviewReport count = 0
VideoUpload count = 0
InterviewReport columns include assessmentVersion and assessment
Legacy score/recommendation columns are absent
```

- [ ] **Step 3: Run the complete test suite**

Run:

```bash
cd server
node --import tsx --test test/*.test.ts test/*.test.tsx tests/*.test.ts
npm run build
cd ..
npm run build
```

Expected: all tests PASS, backend TypeScript build PASS, frontend Vite build PASS.

- [ ] **Step 4: Validate Prisma and stale references**

Run:

```bash
cd server
npx prisma validate --schema=src/db/prisma/schema.prisma
cd ..
rg -n "overallScore|hiringRecommendation|bodyLanguageScore|nonVerbalAnalysis|dimensionScores|questionAnalysis" --glob '!node_modules' --glob '!dist' --glob '!docs/superpowers/**' --glob '!server/src/db/prisma/migrations/**'
```

Expected: Prisma valid and no active product-code references to removed fields.

- [ ] **Step 5: Update documentation and perform final diff review**

Update README report descriptions to say B+ four-level candidate coaching report. Run `git diff --check`, inspect `git status --short`, and review only task-scoped diffs. Do not stage, commit, reset, or alter unrelated user changes.

- [ ] **Step 6: Report completion evidence**

Report test/build/migration results, the exact number of deleted reports and distinct associated videos, and any unverified live-model behavior. State explicitly that an end-to-end Anthropic call remains unverified if no configured real call was run.
