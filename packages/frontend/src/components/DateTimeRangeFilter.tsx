import { useState } from 'react';

interface Props {
  initialFrom: string;
  initialTo: string;
  onApply: (from: string, to: string) => void;
  loading?: boolean;
}

export default function DateTimeRangeFilter({ initialFrom, initialTo, onApply, loading }: Props) {
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);

  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 160px', minWidth: 0 }}>
        <label className="label">From</label>
        <input
          className="input"
          type="datetime-local"
          value={from}
          onChange={e => setFrom(e.target.value)}
        />
      </div>
      <div style={{ flex: '1 1 160px', minWidth: 0 }}>
        <label className="label">To</label>
        <input
          className="input"
          type="datetime-local"
          value={to}
          onChange={e => setTo(e.target.value)}
        />
      </div>
      <button
        className="btn btn--primary btn--sm"
        data-testid="date-range-apply-btn"
        onClick={() => onApply(from, to)}
        disabled={loading}
        style={{ flex: '1 1 100%', marginBottom: 1 }}
      >
        Apply
      </button>
    </div>
  );
}
