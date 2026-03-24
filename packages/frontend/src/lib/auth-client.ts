import { createAuthClient } from 'better-auth/react';

// In production, VITE_API_BASE_URL points to the backend (e.g. https://hermes-backend-nine.vercel.app).
// In local dev it's unset, so we fall back to the same origin (Vite proxy forwards /api → :3001).
const apiBase = import.meta.env.VITE_API_BASE_URL as string | undefined;

export const authClient = createAuthClient({
  baseURL: apiBase ?? (typeof window !== 'undefined' ? window.location.origin : ''),
  basePath: '/api/auth',
  fetchOptions: {
    credentials: 'include',
  },
});

export type Session = Awaited<ReturnType<typeof authClient.getSession>>['data'];
