import path from 'node:path';
import { fileURLToPath } from 'node:url';

const requiredColumns = ['assessmentVersion', 'assessment'] as const;
const legacyColumns = [
  'nonVerbalLog',
  'overallScore',
  'hiringRecommendation',
  'hiringReason',
  'strengths',
  'weaknesses',
  'improvementPlan',
  'dimensionScores',
  'questionAnalysis',
  'nonVerbalAnalysis',
] as const;

type ColumnRow = { column_name: string };

export type BplusMigrationVerification = {
  interviewReportCount: number;
  videoUploadCount: number;
  interviewReportColumns: string[];
  hasRequiredColumns: boolean;
  legacyColumnsAbsent: boolean;
};

export async function verifyBplusMigration(): Promise<BplusMigrationVerification> {
  const { default: prisma } = await import('../db/client.js');

  try {
    const [interviewReportCount, videoUploadCount, columns] = await Promise.all([
      prisma.interviewReport.count(),
      prisma.videoUpload.count(),
      prisma.$queryRaw<ColumnRow[]>`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'InterviewReport'
        ORDER BY column_name
      `,
    ]);

    const interviewReportColumns = columns.map(({ column_name }) => column_name);
    const hasRequiredColumns = requiredColumns.every((column) => interviewReportColumns.includes(column));
    const legacyColumnsAbsent = legacyColumns.every((column) => !interviewReportColumns.includes(column));

    return {
      interviewReportCount,
      videoUploadCount,
      interviewReportColumns,
      hasRequiredColumns,
      legacyColumnsAbsent,
    };
  } finally {
    await prisma.$disconnect();
  }
}

function writeVerification(result: BplusMigrationVerification): void {
  process.stdout.write(`InterviewReport count = ${result.interviewReportCount}\n`);
  process.stdout.write(`VideoUpload count = ${result.videoUploadCount}\n`);
  process.stdout.write(`InterviewReport columns = ${result.interviewReportColumns.join(', ')}\n`);
  process.stdout.write(`assessmentVersion and assessment exist = ${result.hasRequiredColumns}\n`);
  process.stdout.write(`Legacy score/recommendation columns are absent = ${result.legacyColumnsAbsent}\n`);
}

function verificationMatches(result: BplusMigrationVerification): boolean {
  return result.interviewReportCount === 0
    && result.videoUploadCount === 0
    && result.hasRequiredColumns
    && result.legacyColumnsAbsent;
}

async function main(): Promise<void> {
  const result = await verifyBplusMigration();
  writeVerification(result);
  if (!verificationMatches(result)) process.exitCode = 1;
}

const invokedFile = process.argv[1] ? path.resolve(process.argv[1]) : undefined;
if (invokedFile === fileURLToPath(import.meta.url)) {
  void main().catch(() => {
    process.stderr.write('B+ migration verification failed.\n');
    process.exitCode = 1;
  });
}
