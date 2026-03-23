# new-hermes-mercury

A full-stack app with a React frontend and Express API backend, managed as a pnpm monorepo.

## Structure

```
packages/
├── frontend/   Vite + React + TypeScript  (port 5173)
└── backend/    Express + TypeScript        (port 3001)
```

## Getting started

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure the database

The backend requires a PostgreSQL database. Create `packages/backend/.env` with your connection string:

```
POSTGRES_URL=postgresql://user:password@host:5432/dbname
```

**Local Docker (quick start):**

```bash
docker run -d --name hermes-pg \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=hermes \
  -p 5432:5432 \
  postgres:16-alpine
```

Then set in `packages/backend/.env`:
```
POSTGRES_URL=postgresql://postgres:postgres@localhost:5432/hermes
```

**Vercel Postgres:** copy the `POSTGRES_URL` from your Vercel project → Storage tab.

### 3. Run migrations

```bash
pnpm --filter backend migrate
```

This creates the database if it doesn't exist, then applies all tables. Safe to re-run — uses `CREATE TABLE IF NOT EXISTS` so existing data is never touched.

### 4. Start the app

```bash
pnpm dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start both frontend and backend in watch mode |
| `pnpm build` | Build both packages for production |
| `pnpm --filter backend migrate` | Create database and apply schema |
| `pnpm --filter backend test` | Run backend BDD scenarios |
| `pnpm --filter frontend test` | Run frontend Playwright scenarios |

## License

MIT
