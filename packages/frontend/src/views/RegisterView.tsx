import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { RegisterSession } from '../api/client';
import PinModal from '../components/PinModal';

export default function RegisterView() {
  const [session, setSession] = useState<RegisterSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [openingCash, setOpeningCash] = useState('');
  const [closingCash, setClosingCash] = useState('');
  const [cashoutAmount, setCashoutAmount] = useState('');
  const [cashoutReason, setCashoutReason] = useState('');
  const [pinTarget, setPinTarget] = useState<'cashout' | 'close' | null>(null);

  async function load() {
    try { setSession(await api.getSession()); }
    catch { setSession(null); }
    finally { setLoading(false); }
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
      {pinTarget && (
        <PinModal
          title={pinTarget === 'cashout' ? 'Cash Out — Enter PIN' : 'Close Register — Enter PIN'}
          onConfirm={async (pin) => {
            await api.verifyPin(pin);
            const target = pinTarget;
            setPinTarget(null);
            if (target === 'cashout') await handleCashout();
            else await handleClose();
          }}
          onCancel={() => setPinTarget(null)}
        />
      )}

      {error && <div className="error-banner" data-testid="error-banner">{error}</div>}
      {success && <div className="success-banner" data-testid="success-banner">{success}</div>}

      <div className="card" data-testid="session-status">
        <div className="card__title">Status</div>
        {session ? (
          <>
            <span className="badge badge--open">OPEN</span>
            <p style={{ marginTop: 8, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Opened with <strong>${session.opening_cash.toFixed(2)}</strong>
            </p>
          </>
        ) : (
          <span className="badge badge--closed" data-testid="status-closed">CLOSED</span>
        )}
      </div>

      {!session && (
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

      {session && (
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
              onClick={() => setPinTarget('cashout')} disabled={!cashoutAmount}>
              Cash Out
            </button>
          </div>

          <div className="card">
            <div className="card__title">Close Register</div>
            <div className="field">
              <label className="label">Closing Cash ($)</label>
              <input data-testid="closing-cash-input" className="input" type="number" min="0" step="0.01"
                placeholder="0.00" value={closingCash} onChange={e => setClosingCash(e.target.value)} />
            </div>
            <button data-testid="close-register-btn" className="btn btn--danger"
              onClick={() => setPinTarget('close')} disabled={!closingCash}>
              Close Register
            </button>
          </div>
        </>
      )}
    </div>
  );
}
