import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { RegisterSession, Tab, ClosePreviewProduct } from '../api/client';
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
  const [actualDigital, setActualDigital] = useState('');
  const [cashoutAmount, setCashoutAmount] = useState('');
  const [cashoutReason, setCashoutReason] = useState('');
  const [closePreviewProducts, setClosePreviewProducts] = useState<ClosePreviewProduct[]>([]);
  const [physicalCounts, setPhysicalCounts] = useState<Record<number, string>>({});

  async function load() {
    try {
      const s = await api.getSession();
      setRegisterSession(s);
      if (s) {
        const tabs = await api.getTabs();
        setOpenTabs(tabs.filter(t => t.status === 'open'));
        try {
          const preview = await api.getClosePreview();
          setClosePreviewProducts(preview.products);
        } catch {
          setClosePreviewProducts([]);
        }
      } else {
        setOpenTabs([]);
        setClosePreviewProducts([]);
      }
    } catch {
      setRegisterSession(null);
      setOpenTabs([]);
      setClosePreviewProducts([]);
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
      const counts = Object.entries(physicalCounts)
        .filter(([, v]) => v !== '')
        .map(([id, v]) => ({ product_id: Number(id), units: Number(v) }));
      await api.closeRegister(Number(closingCash), {
        actual_digital: actualDigital !== '' ? Number(actualDigital) : undefined,
        physical_counts: counts.length > 0 ? counts : undefined,
      });
      setSuccess('Register closed');
      setClosingCash('');
      setActualDigital('');
      setPhysicalCounts({});
      load();
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
            <div className="field">
              <label className="label">Actual Digital Balance ($)</label>
              <input data-testid="actual-digital-input" className="input" type="number" min="0" step="0.01"
                placeholder="0.00" value={actualDigital} onChange={e => setActualDigital(e.target.value)} />
            </div>
            {closePreviewProducts.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>
                  Physical Counts
                </div>
                <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th style={{ textAlign: 'left', padding: '4px 8px' }}>Product</th>
                      <th style={{ textAlign: 'right', padding: '4px 8px' }}>System</th>
                      <th style={{ textAlign: 'right', padding: '4px 8px' }}>Counted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {closePreviewProducts.map(p => (
                      <tr key={p.product_id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '6px 8px' }}>{p.name}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                          {p.system_count}
                        </td>
                        <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                          <input
                            type="number" min="0" step="1"
                            data-testid={`physical-count-${p.name.toLowerCase().replace(/\s+/g, '-')}`}
                            style={{ width: 70, textAlign: 'right', padding: '2px 4px', border: '1px solid var(--border)', borderRadius: 4 }}
                            placeholder={String(p.system_count)}
                            value={physicalCounts[p.product_id] ?? ''}
                            onChange={e => setPhysicalCounts(prev => ({ ...prev, [p.product_id]: e.target.value }))}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <button data-testid="close-register-btn" className="btn btn--danger" style={{ marginTop: 12 }}
              onClick={handleClose} disabled={!closingCash || openTabs.length > 0}>
              Close Register
            </button>
          </div>
        </>
      )}
    </div>
  );
}
