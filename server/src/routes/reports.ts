import { Router, Request, Response } from 'express';
import type { Prisma } from '@prisma/client';
import prisma from '../db/client.js';
import { authenticate } from '../middleware/auth.js';
import { roleGuard } from '../middleware/roleGuard.js';
import { deleteReportAndVideo } from '../services/dataRetention.js';
import { InvalidReportPayloadError, parseReportCreateInput } from '../services/reportPayload.js';

const router = Router();

class InvalidVideoClaimError extends Error {}

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

// POST /api/reports - candidates and admins using the candidate portal
router.post('/', authenticate, roleGuard('CANDIDATE', 'ADMIN'), async (req: Request, res: Response) => {
  try {
    const {
      candidateName, jobTitle, videoPath,
      fullTranscript, assessmentVersion, assessment, jobProfileId,
    } = parseReportCreateInput(req.body);

    if (videoPath != null && (typeof videoPath !== 'string' || !videoPath)) {
      res.status(400).json({ error: '無效的影片檔名' });
      return;
    }

    const report = await prisma.$transaction(async (tx) => {
      const created = await tx.interviewReport.create({
        data: {
          candidateName,
          jobTitle,
          videoPath,
          fullTranscript: fullTranscript as unknown as Prisma.InputJsonValue,
          assessmentVersion,
          assessment: assessment as unknown as Prisma.InputJsonValue,
          candidateId: req.user!.userId,
          jobProfileId,
        },
      });

      if (videoPath) {
        const claim = await tx.videoUpload.updateMany({
          where: {
            filename: videoPath,
            uploaderId: req.user!.userId,
            reportId: null,
          },
          data: { reportId: created.id },
        });
        if (claim.count !== 1) throw new InvalidVideoClaimError();
      }

      return created;
    });

    res.status(201).json(report);
  } catch (error) {
    if (error instanceof InvalidReportPayloadError) {
      res.status(400).json({ error: '報告格式無效，請提供完整的 B+ 評估與逐字稿' });
      return;
    }
    if (error instanceof InvalidVideoClaimError) {
      res.status(403).json({ error: '無權限使用此影片' });
      return;
    }
    console.error('Create report error:', error);
    res.status(500).json({ error: '建立報告失敗' });
  }
});

// DELETE /api/reports/:id (candidate own / enterprise own job / admin all)
router.delete('/:id', authenticate, roleGuard('ADMIN', 'ENTERPRISE', 'CANDIDATE'), async (req: Request, res: Response) => {
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
    if (req.user!.role === 'CANDIDATE' && report.candidateId !== req.user!.userId) {
      res.status(403).json({ error: '僅能刪除自己的報告' });
      return;
    }

    await deleteReportAndVideo(report.id);
    res.json({ message: '報告與相關影片已刪除' });
  } catch (error) {
    console.error('Delete report error:', error);
    res.status(500).json({ error: '刪除報告失敗' });
  }
});

export default router;
