import { Router, Request, Response } from 'express';
import prisma from '../db/client.js';
import { authenticate } from '../middleware/auth.js';
import { roleGuard } from '../middleware/roleGuard.js';

const router = Router();

// GET /api/reports - list reports by role scope
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    let reports;

    if (req.user!.role === 'CANDIDATE') {
      reports = await prisma.interviewReport.findMany({
        where: { candidateId: req.user!.userId },
        orderBy: { timestamp: 'desc' },
      });
    } else if (req.user!.role === 'ENTERPRISE') {
      reports = await prisma.interviewReport.findMany({
        where: {
          jobProfile: { createdById: req.user!.userId },
        },
        orderBy: { timestamp: 'desc' },
      });
    } else {
      reports = await prisma.interviewReport.findMany({
        orderBy: { timestamp: 'desc' },
      });
    }

    res.json(reports);
  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({ error: '取得報告失敗' });
  }
});

// GET /api/reports/:id
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const report = await prisma.interviewReport.findUnique({
      where: { id: req.params.id as string },
      include: { jobProfile: { select: { createdById: true } } },
    });
    if (!report) {
      res.status(404).json({ error: '報告不存在' });
      return;
    }

    const isCandidateOwner =
      req.user!.role === 'CANDIDATE' && report.candidateId === req.user!.userId;
    const isEnterpriseOwner =
      req.user!.role === 'ENTERPRISE' &&
      report.jobProfile?.createdById === req.user!.userId;
    const isAdminOwner = req.user!.role === 'ADMIN';

    if (!isCandidateOwner && !isEnterpriseOwner && !isAdminOwner) {
      res.status(403).json({ error: '無權限查看此報告' });
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

// DELETE /api/reports/:id (ENTERPRISE own / ADMIN all)
router.delete('/:id', authenticate, roleGuard('ADMIN', 'ENTERPRISE'), async (req: Request, res: Response) => {
  try {
    const report = await prisma.interviewReport.findUnique({
      where: { id: req.params.id as string },
      include: { jobProfile: { select: { createdById: true } } },
    });
    if (!report) {
      res.status(404).json({ error: '報告不存在' });
      return;
    }
    if (req.user!.role === 'ENTERPRISE' && report.jobProfile?.createdById !== req.user!.userId) {
      res.status(403).json({ error: '僅能刪除自己職缺的報告' });
      return;
    }

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
