import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import prisma from '../db/client.js';

interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: '未提供認證 token' });
    return;
  }

  const token = authHeader.split(' ')[1];
  let decoded: JwtPayload;
  try {
    decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
  } catch {
    res.status(401).json({ error: 'Token 無效或已過期' });
    return;
  }
  try {
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, role: true, closedAt: true },
    });
    if (!user || user.closedAt) {
      res.status(401).json({ error: '帳號已註銷或不存在' });
      return;
    }
    req.user = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };
    next();
  } catch (error) {
    console.error('Authentication lookup error:', error);
    res.status(503).json({ error: '暫時無法驗證帳號狀態' });
  }
};
