import { Request, Response, NextFunction } from 'express';
import { getDb } from '../db/database';

export function requireOpenRegister(req: Request, res: Response, next: NextFunction): void {
  const session = getDb()
    .prepare("SELECT id FROM register_sessions WHERE status = 'open' LIMIT 1")
    .get() as { id: number } | undefined;
  if (!session) {
    res.status(403).json({ error: 'Register is not open' });
    return;
  }
  (req as Request & { sessionId: number }).sessionId = session.id;
  next();
}
