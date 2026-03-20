import { Router, Request, Response } from 'express';
import prisma from '../db/client.js';
import { authenticate } from '../middleware/auth.js';
import { roleGuard } from '../middleware/roleGuard.js';

const router = Router();

// GET /api/reports - list all reports (ADMIN only)
router.get('/', authenticate, roleGuard('ADMIN'), async (_req: Request, res: Response) => {
  try {
    const reports = await prisma.interviewReport.findMany({
      orderBy: { timestamp: 'desc' },
    });
    res.json(reports);
  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({ error: '取得報告失敗' });
  }
});

// GET /api/reports/:id
router.get('/:id', authenticate, roleGuard('ADMIN'), async (req: Request, res: Response) => {
  try {
    const report = await prisma.interviewReport.findUnique({
      where: { id: req.params.id as string },
    });
    if (!report) {
      res.status(404).json({ error: '報告不存在' });
      return;
    }
    res.json(report);
  } catch (error) {
    console.error('Get report error:', error);
    res.status(500).json({ error: '取得報告失敗' });
  }
});

// POST /api/reports - create report
router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const {
      candidateName, jobTitle, videoPath,
      fullTranscript, nonVerbalLog,
      overallScore, hiringRecommendation, hiringReason,
      strengths, weaknesses, improvementPlan,
      dimensionScores, questionAnalysis, nonVerbalAnalysis,
      jobProfileId,
    } = req.body;

    const report = await prisma.interviewReport.create({
      data: {
        candidateName,
        jobTitle,
        videoPath,
        fullTranscript,
        nonVerbalLog,
        overallScore,
        hiringRecommendation,
        hiringReason,
        strengths,
        weaknesses,
        improvementPlan,
        dimensionScores,
        questionAnalysis,
        nonVerbalAnalysis,
        candidateId: req.user!.userId,
        jobProfileId,
      },
    });

    res.status(201).json(report);
  } catch (error) {
    console.error('Create report error:', error);
    res.status(500).json({ error: '建立報告失敗' });
  }
});

// DELETE /api/reports/:id (ADMIN only)
router.delete('/:id', authenticate, roleGuard('ADMIN'), async (req: Request, res: Response) => {
  try {
    await prisma.interviewReport.delete({
      where: { id: req.params.id as string },
    });
    res.json({ message: '報告已刪除' });
  } catch (error) {
    console.error('Delete report error:', error);
    res.status(500).json({ error: '刪除報告失敗' });
  }
});

export default router;
