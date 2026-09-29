CREATE TABLE "VideoUpload" (
    "filename" TEXT NOT NULL,
    "uploaderId" TEXT NOT NULL,
    "reportId" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoUpload_pkey" PRIMARY KEY ("filename")
);

CREATE UNIQUE INDEX "VideoUpload_reportId_key" ON "VideoUpload"("reportId");

ALTER TABLE "VideoUpload" ADD CONSTRAINT "VideoUpload_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VideoUpload" ADD CONSTRAINT "VideoUpload_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "InterviewReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill only videos linked to one report with a known candidate. Ambiguous
-- legacy links must be reviewed before granting candidate or enterprise access.
INSERT INTO "VideoUpload" ("filename", "uploaderId", "reportId", "uploadedAt")
SELECT r."videoPath", r."candidateId", r."id", r."timestamp"
FROM "InterviewReport" r
JOIN "User" candidate ON candidate."id" = r."candidateId" AND candidate."role" = 'CANDIDATE'
JOIN (
    SELECT "videoPath"
    FROM "InterviewReport"
    WHERE "videoPath" IS NOT NULL
    GROUP BY "videoPath"
    HAVING COUNT(*) = 1
) unique_video ON unique_video."videoPath" = r."videoPath"
WHERE r."candidateId" IS NOT NULL;
