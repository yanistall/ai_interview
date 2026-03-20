import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';

export const roleGuard = (...allowedRoles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: '未認證' });
      return;
    }

    if (!allowedRoles.includes(req.user.role as Role)) {
      res.status(403).json({ error: '權限不足' });
      return;
    }

    next();
  };
};
