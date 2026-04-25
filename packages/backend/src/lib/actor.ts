import type { Request } from 'express';

type AuditRequest = Request & { session?: { user?: { email?: string } } };

export function actorEmail(req: Request): string | null {
  return (req as AuditRequest).session?.user?.email ?? null;
}
