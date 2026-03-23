import express from 'express';
import cors from 'cors';
import type { IncomingMessage, ServerResponse, IncomingHttpHeaders } from 'http';

function fromNodeHeaders(nodeHeaders: IncomingHttpHeaders): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(nodeHeaders)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) value.forEach(v => headers.append(key, v));
    else headers.set(key, value);
  }
  return headers;
}

function toNodeHandler(auth: { handler: (req: Request) => Promise<Response> }) {
  return async (nodeReq: IncomingMessage, nodeRes: ServerResponse) => {
    const proto = (nodeReq.headers['x-forwarded-proto'] as string | undefined)
      ?? ((nodeReq.socket as { encrypted?: boolean }).encrypted ? 'https' : 'http');
    const url = `${proto}://${nodeReq.headers.host ?? 'localhost'}${nodeReq.url ?? '/'}`;

    const chunks: Buffer[] = [];
    for await (const chunk of nodeReq) chunks.push(chunk as Buffer);
    const body = Buffer.concat(chunks);

    const request = new Request(url, {
      method: nodeReq.method ?? 'GET',
      headers: fromNodeHeaders(nodeReq.headers),
      body: body.length > 0 ? body : undefined,
    });

    const response = await auth.handler(request);

    nodeRes.statusCode = response.status;
    const setCookies = response.headers.getSetCookie?.() ?? [];
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() !== 'set-cookie') nodeRes.setHeader(key, value);
    });
    if (setCookies.length > 0) nodeRes.setHeader('set-cookie', setCookies);

    nodeRes.end(Buffer.from(await response.arrayBuffer()));
  };
}
import { auth } from './auth.js';
import productsRouter from './routes/products.js';
import registerRouter from './routes/register.js';
import checkoutRouter from './routes/checkout.js';
import tabsRouter from './routes/tabs.js';
import ledgerRouter from './routes/ledger.js';
import reportsRouter from './routes/reports.js';
import restockRouter from './routes/restock.js';
import inventoryRouter from './routes/inventory.js';
import adminRouter from './routes/admin.js';
import { resetDb } from './db/database.js';

// Sub-paths under /api that don't require authentication
const PUBLIC_PATHS = new Set(['/health']);

export function createApp() {
  const app = express();
  app.use(cors({
    origin: process.env.FRONTEND_URL ?? ['http://localhost:5173', 'http://localhost:4173'],
    credentials: true,
  }));

  // Better Auth handler — must be registered BEFORE express.json() so it can parse its own bodies
  app.all('/api/auth/*', toNodeHandler(auth));

  app.use(express.json());

  if (process.env.NODE_ENV === 'test') {
    app.post('/api/test/reset', async (_req, res) => {
      await resetDb();
      res.json({ ok: true });
    });
  }

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Auth guard — protect all /api/* routes except public paths and /api/auth/* (already handled)
  app.use('/api', async (req, res, next) => {
    if (PUBLIC_PATHS.has(req.path) || req.path.startsWith('/auth/') || process.env.NODE_ENV === 'test') return next();
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) }).catch(() => null);
    if (!session) return res.status(401).json({ error: 'Unauthorized' });
    (req as express.Request & { session: typeof session }).session = session;
    next();
  });

  app.use('/api/products', productsRouter);
  app.use('/api/register', registerRouter);
  app.use('/api/checkout', checkoutRouter);
  app.use('/api/tabs', tabsRouter);
  app.use('/api/ledger', ledgerRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/restock', restockRouter);
  app.use('/api/inventory', inventoryRouter);
  app.use('/api/admin', adminRouter);

  return app;
}

export default createApp();
