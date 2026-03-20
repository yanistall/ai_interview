import { Router, Request, Response } from 'express';
import prisma from '../db/client.js';
import { authenticate } from '../middleware/auth.js';
import { roleGuard } from '../middleware/roleGuard.js';

const router = Router();

// GET /api/jobs - list all jobs
router.get('/', authenticate, async (_req: Request, res: Response) => {
  try {
    const jobs = await prisma.jobProfile.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json(jobs);
  } catch (error) {
    console.error('Get jobs error:', error);
    res.status(500).json({ error: '取得職缺失敗' });
  }
});

// GET /api/jobs/:id
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const job = await prisma.jobProfile.findUnique({
      where: { id: req.params.id as string },
    });
    if (!job) {
      res.status(404).json({ error: '職缺不存在' });
      return;
    }
    res.json(job);
  } catch (error) {
    console.error('Get job error:', error);
    res.status(500).json({ error: '取得職缺失敗' });
  }
});

// POST /api/jobs - create job (ADMIN only)
router.post('/', authenticate, roleGuard('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { companyName, title, description, persona, voiceName, questions } = req.body;

    if (!companyName || !title || !description) {
      res.status(400).json({ error: '請填寫完整職缺資訊' });
      return;
    }

    const job = await prisma.jobProfile.create({
      data: {
        companyName,
        title,
        description,
        persona: persona || 'FRIENDLY_HR',
        voiceName: voiceName || 'Kore',
        questions: questions || [],
        createdById: req.user!.userId,
      },
    });

    res.status(201).json(job);
  } catch (error) {
    console.error('Create job error:', error);
    res.status(500).json({ error: '建立職缺失敗' });
  }
});

// PUT /api/jobs/:id - update job (ADMIN only)
router.put('/:id', authenticate, roleGuard('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { companyName, title, description, persona, voiceName, questions } = req.body;

    const job = await prisma.jobProfile.update({
      where: { id: req.params.id as string },
      data: {
        ...(companyName && { companyName }),
        ...(title && { title }),
        ...(description && { description }),
        ...(persona && { persona }),
        ...(voiceName && { voiceName }),
        ...(questions && { questions }),
      },
    });

    res.json(job);
  } catch (error) {
    console.error('Update job error:', error);
    res.status(500).json({ error: '更新職缺失敗' });
  }
});

// DELETE /api/jobs/:id - delete job (ADMIN only)
router.delete('/:id', authenticate, roleGuard('ADMIN'), async (req: Request, res: Response) => {
  try {
    await prisma.jobProfile.delete({
      where: { id: req.params.id as string },
    });
    res.json({ message: '職缺已刪除' });
  } catch (error) {
    console.error('Delete job error:', error);
    res.status(500).json({ error: '刪除職缺失敗' });
  }
});

export default router;
