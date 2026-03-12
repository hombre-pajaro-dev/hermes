import { useState } from 'react';

interface PinModalProps {
  title: string;
  onConfirm: (pin: string) => Promise<void>;
  onCancel: () => void;
}

export default function PinModal({ title, onConfirm, onCancel }: PinModalProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!pin) return;
    setError('');
    setLoading(true);
    try {
      await onConfirm(pin);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div className="card" style={{ width: 280, margin: 0 }}>
        <div className="card__title">{title}</div>
        {error && <div className="error-banner" data-testid="pin-error">{error}</div>}
        <div className="field">
          <label className="label">PIN</label>
          <input
            data-testid="pin-input"
            className="input"
            type="password"
            inputMode="numeric"
            autoFocus
            value={pin}
            onChange={e => setPin(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn--ghost" onClick={onCancel} style={{ flex: 1 }}>Cancel</button>
          <button
            data-testid="pin-confirm-btn"
            className="btn btn--primary"
            onClick={handleSubmit}
            disabled={!pin || loading}
            style={{ flex: 1 }}
          >
            {loading ? '…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
