import express from 'express';
import cors from 'cors';
import { toNodeHandler, fromNodeHeaders } from 'better-auth/node';
import { auth } from './auth';
import productsRouter from './routes/products';
import registerRouter from './routes/register';
import checkoutRouter from './routes/checkout';
import tabsRouter from './routes/tabs';
import ledgerRouter from './routes/ledger';
import reportsRouter from './routes/reports';
import restockRouter from './routes/restock';
import inventoryRouter from './routes/inventory';
import adminRouter from './routes/admin';
import { resetDb } from './db/database';

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
