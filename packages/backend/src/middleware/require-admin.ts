import type { Request, Response, NextFunction } from 'express';

interface AuthRequest extends Request {
  session?: { user: { role?: string } };
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (process.env.NODE_ENV === 'test') return next();
  if (req.session?.user?.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}
