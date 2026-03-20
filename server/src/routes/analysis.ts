import { Router, Request, Response } from 'express';
import { generateInterviewReport } from '../services/claudeService.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// POST /api/analysis/generate-report
router.post('/generate-report', authenticate, async (req: Request, res: Response) => {
  try {
    const { transcript, nonVerbalSnapshots, jobTitle, candidateName, jobDescription } = req.body;

    if (!transcript || !jobTitle || !candidateName) {
      res.status(400).json({ error: '請提供 transcript、jobTitle 和 candidateName' });
      return;
    }

    const report = await generateInterviewReport({
      transcript,
      nonVerbalSnapshots: nonVerbalSnapshots || [],
      jobTitle,
      candidateName,
      jobDescription: jobDescription || '',
    });

    res.json(report);
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ error: '分析報告生成失敗' });
  }
});

export default router;
