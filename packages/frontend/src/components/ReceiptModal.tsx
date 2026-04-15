export interface ReceiptLine {
  id: number;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface ReceiptDiscount {
  name: string;
  savings: number;
}

interface Props {
  timestamp: Date;
  lines: ReceiptLine[];
  subtotal: number;
  discountLine?: ReceiptDiscount | null;
  total: number;
  changeDue: number | null;
  onClose: () => void;
}

export default function ReceiptModal({ timestamp, lines, subtotal, discountLine, total, changeDue, onClose }: Props) {
  return (
    <div className="modal-overlay" data-testid="receipt-modal">
      <div className="modal">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <div className="card__title" style={{ marginBottom: 4 }}>Receipt</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }} data-testid="receipt-timestamp">
              {timestamp.toLocaleString()}
            </div>
          </div>
          <span className="badge badge--open" data-testid="payment-success">Paid</span>
        </div>

        <div data-testid="receipt-items">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '4px 12px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)', paddingBottom: 6, marginBottom: 6 }}>
            <span>Item</span><span>Qty</span><span>Unit</span><span>Total</span>
          </div>
          {lines.map(line => (
            <div key={line.id} data-testid={`receipt-item-${line.id}`}
              style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '4px 12px', fontSize: '0.9rem', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontWeight: 500 }}>{line.name}</span>
              <span style={{ color: 'var(--text-secondary)' }}>{line.quantity}</span>
              <span>${line.unitPrice.toFixed(2)}</span>
              <span style={{ fontWeight: 600 }}>${(line.unitPrice * line.quantity).toFixed(2)}</span>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 12, paddingTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
            <span>Subtotal</span><span>${subtotal.toFixed(2)}</span>
          </div>
          {discountLine && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: 'var(--success)', fontWeight: 600, marginBottom: 4 }} data-testid="receipt-discount">
              <span>🏷 {discountLine.name}</span>
              <span>−${discountLine.savings.toFixed(2)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1.15rem' }}>
            <span>Total</span><span>${total.toFixed(2)}</span>
          </div>
          {changeDue !== null && changeDue > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--success)', fontWeight: 600, marginTop: 10, fontSize: '1.1rem' }} data-testid="change-due">
              <span>Change Due</span><span>${changeDue.toFixed(2)}</span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 20, flexWrap: 'wrap' }}>
          <button className="btn btn--ghost btn--sm" data-testid="print-receipt-btn" onClick={() => {}}>🖨 Print</button>
          <button className="btn btn--ghost btn--sm" data-testid="email-receipt-btn" onClick={() => {}}>✉ Email</button>
          <button className="btn btn--primary" data-testid="close-receipt-btn"
            style={{ marginLeft: 'auto', width: 'auto', padding: '10px 20px' }}
            onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
