import type { IncomingMessage, ServerResponse } from 'http';
import { createApp } from '../packages/backend/src/app';
import { schemaReady } from '../packages/backend/src/db/database';

const app = createApp();

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await schemaReady;
  return app(req, res);
}
