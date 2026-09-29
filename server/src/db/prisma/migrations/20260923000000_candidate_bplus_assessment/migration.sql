-- Destructive reset: apply only after confirming the database target and
-- completing Task 7's linked video file cleanup. Do not migrate legacy scores.
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
