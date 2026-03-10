# new-hermes-mercury

A full-stack app with a React frontend and Express API backend, managed as a pnpm monorepo.

## Structure

```
packages/
├── frontend/   Vite + React + TypeScript  (port 5173)
└── backend/    Express + TypeScript        (port 3001)
```

## Getting started

```bash
pnpm install
pnpm dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start both frontend and backend in watch mode |
| `pnpm build` | Build both packages for production |

## License

MIT
