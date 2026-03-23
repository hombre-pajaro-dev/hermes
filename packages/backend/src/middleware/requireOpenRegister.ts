import { Request, Response, NextFunction } from 'express';
import { getDb } from '../db/database.js';

export async function requireOpenRegister(req: Request, res: Response, next: NextFunction): Promise<void> {
  const db = await getDb();
  const { rows } = await db.query("SELECT id FROM register_sessions WHERE status = 'open' LIMIT 1");
  if (!rows[0]) {
    res.status(403).json({ error: 'Register is not open' });
    return;
  }
  (req as Request & { sessionId: number }).sessionId = rows[0].id;
  next();
}
