import type { IncomingMessage, ServerResponse } from 'http';
import { createApp } from '../packages/backend/src/app';
import { pool } from '../packages/backend/src/db/database';
import { applySchema } from '../packages/backend/src/db/schema';

// Run migrations once on cold start so the production DB is always up to date
const ready = applySchema(pool).catch((err) => {
  console.error('[migrate] schema error:', err);
});

const app = createApp();

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await ready;
  return app(req, res);
}
