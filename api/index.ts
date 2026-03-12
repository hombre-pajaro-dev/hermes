import type { IncomingMessage, ServerResponse } from 'http';
import { createApp } from '../packages/backend/src/app';

const app = createApp();

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return app(req, res);
}
