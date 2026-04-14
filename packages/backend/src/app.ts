import express from 'express';
import cors from 'cors';
import path from 'path';
import { existsSync } from 'fs';
import type { IncomingMessage, ServerResponse, IncomingHttpHeaders } from 'http';
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

function fromNodeHeaders(nodeHeaders: IncomingHttpHeaders): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(nodeHeaders)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) value.forEach(v => headers.append(key, v));
    else headers.set(key, value);
  }
  return headers;
}

function toNodeHandler(authInstance: { handler: (req: Request) => Promise<Response> }) {
  return (nodeReq: IncomingMessage, nodeRes: ServerResponse) => {
    const proto = (nodeReq.headers['x-forwarded-proto'] as string | undefined)
      ?? ((nodeReq.socket as { encrypted?: boolean }).encrypted ? 'https' : 'http');
    const fullPath = (nodeReq as IncomingMessage & { originalUrl?: string }).originalUrl ?? nodeReq.url ?? '/';
    const url = `${proto}://${nodeReq.headers.host ?? 'localhost'}${fullPath}`;

    const body = new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      nodeReq.on('data', (chunk: Buffer) => chunks.push(chunk));
      nodeReq.on('end', () => resolve(Buffer.concat(chunks)));
      nodeReq.on('error', reject);
    });

    body.then(async (buf) => {
      const request = new Request(url, {
        method: nodeReq.method ?? 'GET',
        headers: fromNodeHeaders(nodeReq.headers),
        body: buf.length > 0 ? (buf as unknown as BodyInit) : undefined,
      });

      const response = await authInstance.handler(request);

      nodeRes.statusCode = response.status;
      const setCookies = response.headers.getSetCookie?.() ?? [];
      response.headers.forEach((value, key) => {
        if (key.toLowerCase() !== 'set-cookie') nodeRes.setHeader(key, value);
      });
      if (setCookies.length > 0) nodeRes.setHeader('set-cookie', setCookies);
      nodeRes.end(Buffer.from(await response.arrayBuffer()));
    }).catch((err) => {
      console.error('[auth handler]', err);
      if (!nodeRes.headersSent) { nodeRes.statusCode = 500; nodeRes.end(); }
    });
  };
}

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

  // Serve the built frontend in production (Vercel bundles public/ via includeFiles)
  const publicDir = path.join(process.cwd(), 'public');
  if (existsSync(path.join(publicDir, 'index.html'))) {
    app.use(express.static(publicDir));
    app.get('*', (_req, res) => res.sendFile(path.join(publicDir, 'index.html')));
  }

  return app;
}

export default createApp();
