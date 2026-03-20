-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CANDIDATE', 'ADMIN');

-- CreateEnum
CREATE TYPE "Persona" AS ENUM ('FRIENDLY_HR', 'STRICT_MANAGER', 'TECHNICAL_LEAD', 'EXECUTIVE');

-- CreateEnum
CREATE TYPE "HiringRecommendation" AS ENUM ('HIRE', 'CONSIDER', 'NO_HIRE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'CANDIDATE',
    "resetToken" TEXT,
    "resetTokenExp" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobProfile" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "persona" "Persona" NOT NULL,
    "voiceName" TEXT NOT NULL,
    "questions" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "JobProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewReport" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "candidateName" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "videoPath" TEXT,
    "fullTranscript" JSONB NOT NULL,
    "nonVerbalLog" JSONB NOT NULL,
    "overallScore" INTEGER NOT NULL,
    "hiringRecommendation" "HiringRecommendation" NOT NULL,
    "hiringReason" TEXT NOT NULL,
    "strengths" TEXT[],
    "weaknesses" TEXT[],
    "improvementPlan" TEXT NOT NULL,
    "dimensionScores" JSONB NOT NULL,
    "questionAnalysis" JSONB NOT NULL,
    "nonVerbalAnalysis" JSONB NOT NULL,
    "candidateId" TEXT,
    "jobProfileId" TEXT,

    CONSTRAINT "InterviewReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "JobProfile" ADD CONSTRAINT "JobProfile_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewReport" ADD CONSTRAINT "InterviewReport_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewReport" ADD CONSTRAINT "InterviewReport_jobProfileId_fkey" FOREIGN KEY ("jobProfileId") REFERENCES "JobProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
