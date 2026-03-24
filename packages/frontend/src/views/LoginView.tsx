import { useState } from 'react';
import { authClient } from '../lib/auth-client';

export default function LoginView() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleEmailSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    const { error: err } = await authClient.signIn.email({ email, password, callbackURL: '/' });
    if (err) setError(err.message ?? 'Sign in failed');
    setLoading(false);
  }

  async function handleGoogleSignIn() {
    setError(''); setLoading(true);
    await authClient.signIn.social({
      provider: 'google',
      callbackURL: window.location.origin,
      errorCallbackURL: `${window.location.origin}/login`,
    });
    setLoading(false);
  }

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
      background: 'var(--bg)',
    }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🛒</div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700 }}>POS — El Nido</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: 4 }}>
            Sign in to continue
          </p>
        </div>

        {error && (
          <div
            data-testid="login-error"
            style={{
              background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
              padding: '10px 14px', color: '#dc2626', fontSize: '0.875rem', marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}

        <div className="card" style={{ marginBottom: 12 }}>
          <form onSubmit={handleEmailSignIn}>
            <div className="field">
              <label className="label">Email</label>
              <input
                data-testid="login-email"
                className="input"
                type="email"
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label className="label">Password</label>
              <input
                data-testid="login-password"
                className="input"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
            <button
              data-testid="login-submit"
              className="btn btn--primary"
              type="submit"
              disabled={loading || !email || !password}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>or</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>

        <button
          data-testid="login-google"
          className="btn btn--ghost"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}
          onClick={handleGoogleSignIn}
          disabled={loading}
        >
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          Sign in with Google
        </button>

        <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', textAlign: 'center', marginTop: 20 }}>
          Access is restricted to authorized accounts only.
        </p>
      </div>
    </div>
  );
}
