import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { LedgerEntry, Balance, Account } from '../api/client';

export default function LedgerView() {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [tab, setTab] = useState<'entries' | 'balances' | 'payroll'>('entries');
  const [payrollAmount, setPayrollAmount] = useState('');
  const [payrollAccount, setPayrollAccount] = useState('cash');
  const [payrollDesc, setPayrollDesc] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    api.getLedger().then(setEntries).catch(() => {});
    api.getBalances().then(setBalances).catch(() => {});
    api.getAccounts().then(setAccounts).catch(() => {});
  }, []);

  async function handlePayroll() {
    setError(''); setSuccess('');
    try {
      await api.recordPayroll(Number(payrollAmount), payrollAccount, payrollDesc);
      setSuccess('Payroll recorded');
      setPayrollAmount(''); setPayrollDesc('');
      const [e, b] = await Promise.all([api.getLedger(), api.getBalances()]);
      setEntries(e); setBalances(b);
    } catch (e: unknown) { setError((e as Error).message); }
  }

  const TYPE_COLORS: Record<string, string> = {
    sale: '#16a34a', tab_payment: '#2563eb', register_open: '#7c3aed',
    register_close: '#dc2626', cashout: '#d97706', restock: '#0891b2',
    adjustment: '#db2777', payroll: '#ea580c',
  };

  return (
    <div>
      {error && <div className="error-banner" data-testid="error-banner">{error}</div>}
      {success && <div className="success-banner" data-testid="success-banner">{success}</div>}

      <div className="tabs-nav">
        <button className={`tabs-nav__item${tab === 'entries' ? ' active' : ''}`} onClick={() => setTab('entries')}>Entries</button>
        <button className={`tabs-nav__item${tab === 'balances' ? ' active' : ''}`} onClick={() => setTab('balances')}>Balances</button>
        <button className={`tabs-nav__item${tab === 'payroll' ? ' active' : ''}`} onClick={() => setTab('payroll')}>Payroll</button>
      </div>

      {tab === 'entries' && (
        <div className="card" data-testid="ledger-entries">
          {entries.length === 0 ? <div className="empty">No entries yet</div> : entries.map(e => (
            <div className="list-item" key={e.id} data-testid="ledger-entry">
              <div className="list-item__main">
                <div className="list-item__name" style={{ color: TYPE_COLORS[e.entry_type] ?? 'inherit' }}>
                  {e.entry_type.replace('_', ' ')}
                </div>
                <div className="list-item__sub">{e.description}</div>
                <div className="list-item__sub">{e.created_at.slice(0, 16).replace('T', ' ')}</div>
              </div>
              <div className="list-item__right">
                <div style={{ fontWeight: 700, color: e.amount >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                  {e.amount >= 0 ? '+' : ''}${e.amount.toFixed(2)}
                </div>
                {e.account && <div className="list-item__sub">{e.account}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'balances' && (
        <div>
          <div className="stats" data-testid="balances">
            {balances.map(b => (
              <div className="stat" key={b.account} data-testid={`balance-${b.account}`}>
                <div className="stat__label">{b.account}</div>
                <div className="stat__value" style={{ color: b.balance >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                  ${b.balance.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
          <div className="card" data-testid="accounts-list">
            <div className="card__title">Accounts</div>
            {accounts.map(a => (
              <div className="list-item" key={a.id}>
                <div className="list-item__name">{a.label}</div>
                <div className="badge badge--open">{a.name}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'payroll' && (
        <div className="card">
          <div className="card__title">Record Payroll</div>
          <div className="field">
            <label className="label">Amount ($)</label>
            <input data-testid="payroll-amount-input" className="input" type="number" min="0" step="0.01"
              value={payrollAmount} onChange={e => setPayrollAmount(e.target.value)} />
          </div>
          <div className="field">
            <label className="label">Account</label>
            <select data-testid="payroll-account-select" className="select"
              value={payrollAccount} onChange={e => setPayrollAccount(e.target.value)}>
              <option value="cash">Cash</option>
              <option value="credit_card">Credit Card</option>
            </select>
          </div>
          <div className="field">
            <label className="label">Description</label>
            <input data-testid="payroll-desc-input" className="input" type="text"
              placeholder="Weekly payroll…" value={payrollDesc} onChange={e => setPayrollDesc(e.target.value)} />
          </div>
          <button data-testid="record-payroll-btn" className="btn btn--primary"
            onClick={handlePayroll} disabled={!payrollAmount}>
            Record Payroll
          </button>
        </div>
      )}
    </div>
  );
}
