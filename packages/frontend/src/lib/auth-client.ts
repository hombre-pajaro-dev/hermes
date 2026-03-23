import { createAuthClient } from 'better-auth/react';

// Better Auth is mounted at /api/auth/* on the same origin (Vite proxies /api → :3001 in dev)
export const authClient = createAuthClient({
  baseURL: typeof window !== 'undefined' ? window.location.origin : '',
  basePath: '/api/auth',
});

export type Session = Awaited<ReturnType<typeof authClient.getSession>>['data'];
