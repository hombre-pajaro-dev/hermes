# Hermes Mercury POS — Project Guide

## Overview

Hermes is a point-of-sale system for a café/bar. It supports checkout, long-lasting customer tabs, inventory management, a general ledger, sales reports, and admin controls (PIN security, product management).

Stack: React 19 + TypeScript + Vite (frontend) / Express + TypeScript + PostgreSQL (backend) / pnpm monorepo / Vercel deployment.

---

## Repository structure

```
hermes/
├── packages/
│   ├── backend/          # Express API, port 3001
│   │   ├── src/
│   │   │   ├── index.ts          # Entry point (createApp + listen)
│   │   │   ├── app.ts            # createApp() — Express setup, routes, Better Auth
│   │   │   ├── db/
│   │   │   │   ├── schema.ts     # Migration runner (runs on startup)
│   │   │   │   └── index.ts      # getDb() — pg Pool singleton
│   │   │   ├── routes/           # products, orders, tabs, register, ledger, reports, restock, adjustment
│   │   │   └── scripts/
│   │   │       ├── migrate.ts    # Standalone migration script
│   │   │       └── seed.ts       # Seeds 15 sample products
│   │   ├── features/             # BDD feature files (.feature)
│   │   └── cucumber.js           # Cucumber config
│   └── frontend/         # Vite/React SPA, port 5173
│       ├── src/
│       │   ├── api/client.ts     # Typed API wrapper (all backend calls)
│       │   ├── components/
│       │   │   ├── ProductPicker.tsx  # Shared product display + filters
│       │   │   ├── ProductThumb.tsx
│       │   │   └── ReceiptModal.tsx
│       │   └── views/
│       │       ├── CheckoutView.tsx
│       │       ├── TabsView.tsx
│       │       ├── ProductsView.tsx
│       │       ├── RegisterView.tsx
│       │       ├── LedgerView.tsx
│       │       ├── ReportsView.tsx
│       │       └── AdminView.tsx
│       └── features/             # BDD feature files + step definitions
├── api/
│   └── index.ts          # Vercel serverless entrypoint (re-exports createApp)
├── vercel.json           # All routes rewrite to /api/index
├── docs/
│   └── FEATURES_AND_SCENARIOS.md
└── CHANGELOG.md
```

---

## Local development

### Prerequisites

- Docker (for PostgreSQL)
- Node.js 20+
- pnpm

### Start the database

```bash
docker start hermes-db
# If the container doesn't exist yet:
docker run --name hermes-db -e POSTGRES_USER=hermes -e POSTGRES_PASSWORD=hermes -e POSTGRES_DB=hermes -p 5432:5432 -d postgres
```

Database URL: `postgresql://hermes:hermes@localhost:5432/hermes`

### Backend `.env`

```
DATABASE_URL=postgresql://hermes:hermes@localhost:5432/hermes
PORT=3001
BETTER_AUTH_SECRET=<secret>
BETTER_AUTH_URL=http://localhost:3001
```

### Run everything

```bash
# From repo root — install dependencies
pnpm install

# Start backend (auto-runs migrations on startup)
cd packages/backend && pnpm dev

# Start frontend (separate terminal)
cd packages/frontend && pnpm dev

# Seed sample products (first time or after reset)
cd packages/backend && pnpm seed
```

---

## Key commands

| Command | What it does |
|---------|-------------|
| `pnpm dev` (backend) | Start backend with tsx watch on port 3001 |
| `pnpm dev` (frontend) | Start Vite dev server on port 5173 |
| `pnpm seed` (backend) | Insert 15 sample coffee-shop products (idempotent) |
| `pnpm test` (backend) | Run 42 BDD scenarios against in-memory SQLite test DB |
| `pnpm test` (frontend) | Start backend on :3002, frontend on :5174, run Playwright/Cucumber BDD |
| `pnpm build` (frontend) | TypeScript check + Vite build |

---

## Architecture decisions

### ProductPicker component

`packages/frontend/src/components/ProductPicker.tsx` is the single shared product display used in Checkout, Tabs (Add Items panel), and Products. All three views use different prop configurations but the same rendering and filter logic.

Filter pipeline (in order): active filter → in-stock filter → most-sold sort → render.

### Shared localStorage keys

These keys are shared across views so filter state persists when navigating:

| Key | Controls |
|-----|----------|
| `product-active-filter` | ● Active toggle (hides inactive products) |
| `product-stock-filter` | ◈ In Stock toggle (hides out-of-stock products) |
| `product-sort` | ↑ Most Sold sort toggle |
| `checkout-view` | Grid/list toggle for Checkout Add Items |
| `tabs-add-view` | Grid/list toggle for Tabs Add Items (defaults to list) |

### Database migrations

`packages/backend/src/db/schema.ts` runs automatically on every backend startup. All migrations use `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` so they are safe to re-run.

### Defensive active filter

Products use `p.active !== false` (not `p.active`) in the frontend filter. This treats `undefined` as active, which handles the period between deploying new frontend code and the backend migration adding the `active` column.

### At-cost tabs

Tabs can be created with `at_cost: true` (staff discount). In this mode, `ProductPicker` receives a custom `getPrice` function that returns `product.cost` instead of `product.price`, and a `getPriceNote` that renders a `(cost)` label.

---

## BDD test conventions

### Test ID patterns

| Context | Pattern |
|---------|---------|
| Checkout Add Items buttons | `add-{slug}` |
| Tabs Add Items buttons | `tab-add-{slug}` |
| Tabs stock labels | `tab-product-stock-{slug}` |
| View toggle (Checkout) | `checkout-grid-view-btn`, `checkout-list-view-btn` |
| View toggle (Tabs) | `tabs-add-grid-view-btn`, `tabs-add-list-view-btn` |
| Filter buttons | `active-filter-btn`, `stock-filter-btn`, `sort-by-sold-btn` |

`{slug}` is the product name lowercased with spaces replaced by hyphens (e.g. `Flat White` → `flat-white`).

### Running tests

```bash
# Backend only (no browser needed)
cd packages/backend && pnpm test

# Frontend (requires both servers to be stopped — test script starts its own)
cd packages/frontend && pnpm test

# HTML reports
# packages/backend/report/cucumber-report.html
# packages/frontend/report/cucumber-report.html
```

---

## API overview

Base path: `/api`

| Resource | Notable endpoints |
|----------|------------------|
| Products | `GET /products`, `POST /products`, `PATCH /products/:id/price`, `PATCH /products/:id/cost`, `PATCH /products/:id/active` |
| Orders | `POST /orders`, `POST /orders/:id/pay` |
| Tabs | `GET /tabs`, `POST /tabs`, `POST /tabs/:id/items`, `PATCH /tabs/:id/items/:itemId`, `POST /tabs/:id/pay` |
| Register | `POST /register/open`, `POST /register/close`, `POST /register/cashout` |
| Ledger | `GET /ledger`, `GET /ledger/:id/items` |
| Reports | `GET /reports/sales`, `GET /reports/daily`, `GET /reports/top-products` |
| Restock | `POST /restock` |
| Adjustment | `POST /adjustment` |
| Admin | `POST /admin/change-pin` |
| Auth | Handled by Better Auth at `/api/auth/*` |

---

## Auth

Better Auth v1.5+ with email/password and Google OAuth. An `authorized_users` table acts as an allowlist — only users in that table can log in. The admin page (`/admin`) is protected by PIN entry for sensitive operations (cashout, close register, at-cost tabs).

---

## Deployment

Deployed on Vercel. `api/index.ts` imports `createApp()` from the backend and exports it as a serverless function handler. `vercel.json` rewrites all traffic to that function. Frontend is deployed as a static site.
