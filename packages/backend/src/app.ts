import express from 'express';
import cors from 'cors';
import productsRouter from './routes/products';
import registerRouter from './routes/register';
import checkoutRouter from './routes/checkout';
import tabsRouter from './routes/tabs';
import ledgerRouter from './routes/ledger';
import reportsRouter from './routes/reports';
import restockRouter from './routes/restock';
import inventoryRouter from './routes/inventory';
import { resetDb } from './db/database';

export function createApp() {
  const app = express();
  app.use(cors({ origin: '*' }));
  app.use(express.json());

  if (process.env.NODE_ENV === 'test') {
    app.post('/api/test/reset', (_req, res) => {
      resetDb();
      res.json({ ok: true });
    });
  }

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/products', productsRouter);
  app.use('/api/register', registerRouter);
  app.use('/api/checkout', checkoutRouter);
  app.use('/api/tabs', tabsRouter);
  app.use('/api/ledger', ledgerRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/restock', restockRouter);
  app.use('/api/inventory', inventoryRouter);

  return app;
}
