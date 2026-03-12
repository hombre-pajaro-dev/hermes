import { useState } from 'react';
import { api } from '../api/client';

export default function AdminView() {
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleChangePin() {
    setError(''); setSuccess('');
    if (newPin !== confirmPin) { setError('New PINs do not match'); return; }
    if (newPin.length < 4) { setError('PIN must be at least 4 characters'); return; }
    try {
      await api.changePin(currentPin, newPin);
      setSuccess('PIN changed successfully');
      setCurrentPin(''); setNewPin(''); setConfirmPin('');
    } catch (e: unknown) { setError((e as Error).message); }
  }

  return (
    <div>
      {error && <div className="error-banner" data-testid="error-banner">{error}</div>}
      {success && <div className="success-banner" data-testid="success-banner">{success}</div>}

      <div className="card">
        <div className="card__title">Change PIN</div>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
          The PIN protects cash-outs, closing the register, and opening staff cost tabs.
          Default PIN is <strong>1234</strong>.
        </p>
        <div className="field">
          <label className="label">Current PIN</label>
          <input data-testid="current-pin-input" className="input" type="password" inputMode="numeric"
            value={currentPin} onChange={e => setCurrentPin(e.target.value)} />
        </div>
        <div className="field">
          <label className="label">New PIN</label>
          <input data-testid="new-pin-input" className="input" type="password" inputMode="numeric"
            value={newPin} onChange={e => setNewPin(e.target.value)} />
        </div>
        <div className="field">
          <label className="label">Confirm New PIN</label>
          <input data-testid="confirm-pin-input" className="input" type="password" inputMode="numeric"
            value={confirmPin} onChange={e => setConfirmPin(e.target.value)} />
        </div>
        <button data-testid="change-pin-btn" className="btn btn--primary"
          onClick={handleChangePin} disabled={!currentPin || !newPin || !confirmPin}>
          Change PIN
        </button>
      </div>
    </div>
  );
}
