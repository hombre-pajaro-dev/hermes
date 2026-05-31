import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { RegisterSession, Tab } from '../api/client';
import { authClient } from '../lib/auth-client';

export default function RegisterView() {
  const { data: session } = authClient.useSession();
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === 'admin';

  const [registerSession, setRegisterSession] = useState<RegisterSession | null>(null);
  const [openTabs, setOpenTabs] = useState<Tab[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [openingCash, setOpeningCash] = useState('');
  const [closingCash, setClosingCash] = useState('');
  const [cashoutAmount, setCashoutAmount] = useState('');
  const [cashoutReason, setCashoutReason] = useState('');

  async function load() {
    try {
      const s = await api.getSession();
      setRegisterSession(s);
      if (s) {
        const tabs = await api.getTabs();
        setOpenTabs(tabs.filter(t => t.status === 'open'));
      } else {
        setOpenTabs([]);
      }
    } catch {
      setRegisterSession(null);
      setOpenTabs([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleOpen() {
    setError(''); setSuccess('');
    try {
      await api.openRegister(Number(openingCash));
      setSuccess('Register opened'); setOpeningCash(''); load();
    } catch (e: unknown) { setError((e as Error).message); }
  }

  async function handleCashout() {
    setError(''); setSuccess('');
    try {
      await api.cashout(Number(cashoutAmount), cashoutReason);
      setSuccess(`Cashout of $${cashoutAmount} recorded`);
      setCashoutAmount(''); setCashoutReason('');
    } catch (e: unknown) { setError((e as Error).message); }
  }

  async function handleClose() {
    setError(''); setSuccess('');
    try {
      await api.closeRegister(Number(closingCash));
      setSuccess('Register closed'); setClosingCash(''); load();
    } catch (e: unknown) { setError((e as Error).message); }
  }

  if (loading) return <div className="spinner">⏳</div>;

  return (
    <div>
      {error && <div className="error-banner" data-testid="error-banner">{error}</div>}
      {success && <div className="success-banner" data-testid="success-banner">{success}</div>}

      <div className="card" data-testid="session-status">
        <div className="card__title">Status</div>
        {registerSession ? (
          <>
            <span className="badge badge--open">OPEN</span>
            <p style={{ marginTop: 8, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Opened with <strong>${registerSession.opening_cash.toFixed(2)}</strong>
            </p>
          </>
        ) : (
          <span className="badge badge--closed" data-testid="status-closed">CLOSED</span>
        )}
      </div>

      {registerSession && openTabs.length > 0 && (
        <div className="card" data-testid="open-tabs-warning" style={{ borderColor: 'var(--warning, #f59e0b)', borderWidth: 2 }}>
          <div className="card__title" style={{ color: 'var(--warning, #f59e0b)' }}>
            {openTabs.length} Open Tab{openTabs.length !== 1 ? 's' : ''} — Must Be Paid Before Closing
          </div>
          {openTabs.map(t => (
            <div key={t.id} className="list-item" data-testid={`open-tab-warning-${t.id}`}>
              <div className="list-item__main">
                <div className="list-item__name">{t.name || `Tab #${t.id}`}</div>
              </div>
              <div className="list-item__right" style={{ fontWeight: 700 }}>${Number(t.total).toFixed(2)}</div>
            </div>
          ))}
        </div>
      )}

      {!registerSession && (
        <div className="card">
          <div className="card__title">Open Register</div>
          <div className="field">
            <label className="label">Opening Cash ($)</label>
            <input data-testid="opening-cash-input" className="input" type="number" min="0" step="0.01"
              placeholder="0.00" value={openingCash} onChange={e => setOpeningCash(e.target.value)} />
          </div>
          <button data-testid="open-register-btn" className="btn btn--primary"
            onClick={handleOpen} disabled={!openingCash}>
            Open Register
          </button>
        </div>
      )}

      {registerSession && isAdmin && (
        <>
          <div className="card">
            <div className="card__title">Cash Out</div>
            <div className="field">
              <label className="label">Amount ($)</label>
              <input data-testid="cashout-amount-input" className="input" type="number" min="0" step="0.01"
                placeholder="0.00" value={cashoutAmount} onChange={e => setCashoutAmount(e.target.value)} />
            </div>
            <div className="field">
              <label className="label">Reason</label>
              <input data-testid="cashout-reason-input" className="input" type="text"
                placeholder="Safe drop…" value={cashoutReason} onChange={e => setCashoutReason(e.target.value)} />
            </div>
            <button data-testid="cashout-btn" className="btn btn--ghost"
              onClick={handleCashout} disabled={!cashoutAmount}>
              Cash Out
            </button>
          </div>

          <div className="card">
            <div className="card__title">Close Register</div>
            {openTabs.length > 0 && (
              <p style={{ fontSize: '0.85rem', color: 'var(--warning, #f59e0b)', marginBottom: 8 }}>
                {openTabs.length} open tab{openTabs.length !== 1 ? 's' : ''} must be paid first.
              </p>
            )}
            <div className="field">
              <label className="label">Closing Cash ($)</label>
              <input data-testid="closing-cash-input" className="input" type="number" min="0" step="0.01"
                placeholder="0.00" value={closingCash} onChange={e => setClosingCash(e.target.value)} />
            </div>
            <button data-testid="close-register-btn" className="btn btn--danger"
              onClick={handleClose} disabled={!closingCash || openTabs.length > 0}>
              Close Register
            </button>
          </div>
        </>
      )}
    </div>
  );
}
