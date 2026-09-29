ALTER TABLE "User" ADD COLUMN "closedAt" TIMESTAMP(3);
CREATE INDEX "User_closedAt_idx" ON "User"("closedAt");
CREATE INDEX "VideoUpload_uploadedAt_idx" ON "VideoUpload"("uploadedAt");
