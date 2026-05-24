import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { AuthorizedUser, CommissionSettings, Discount, Product, RegisterSession, Supply } from '../api/client';
import { authClient } from '../lib/auth-client';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface DiscountForm {
  name: string;
  description: string;
  type: 'percentage' | 'bxgy';
  value: string;
  buy_qty: string;
  get_qty: string;
  is_manual: boolean;
  requires_pin: boolean;
  days_of_week: number[];
  valid_from: string;
  valid_until: string;
  max_redemptions: string;
  product_ids: number[];
  active: boolean;
}

const emptyForm: DiscountForm = {
  name: '', description: '', type: 'percentage',
  value: '20', buy_qty: '2', get_qty: '1',
  is_manual: false, requires_pin: false,
  days_of_week: [], valid_from: '', valid_until: '',
  max_redemptions: '', product_ids: [], active: true,
};

export default function AdminView() {
  const { data: session } = authClient.useSession();
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === 'admin';

  // ── Register ────────────────────────────────────────────────────────────────
  const [registerSession, setRegisterSession] = useState<RegisterSession | null>(null);
  const [registerLoading, setRegisterLoading] = useState(true);
  const [registerError, setRegisterError] = useState('');
  const [registerSuccess, setRegisterSuccess] = useState('');
  const [openingCash, setOpeningCash] = useState('');
  const [closingCash, setClosingCash] = useState('');
  const [cashoutAmount, setCashoutAmount] = useState('');
  const [cashoutReason, setCashoutReason] = useState('');
  const [closeProducts, setCloseProducts] = useState<Product[]>([]);
  const [physicalCounts, setPhysicalCounts] = useState<Record<number, string>>({});

  async function loadRegister() {
    try {
      const s = await api.getSession();
      setRegisterSession(s);
      if (s) {
        const products = await api.getProducts();
        const active = products.filter(p => p.active && p.track_inventory && !p.uses_supplies);
        setCloseProducts(active);
        setPhysicalCounts(Object.fromEntries(active.map(p => [p.id, String(p.units)])));
      }
    }
    catch { setRegisterSession(null); }
    finally { setRegisterLoading(false); }
  }

  useEffect(() => { loadRegister(); }, []);

  async function handleOpenRegister() {
    setRegisterError(''); setRegisterSuccess('');
    try {
      await api.openRegister(Number(openingCash));
      setRegisterSuccess('Register opened'); setOpeningCash(''); loadRegister();
    } catch (e: unknown) { setRegisterError((e as Error).message); }
  }

  async function handleCashout() {
    setRegisterError(''); setRegisterSuccess('');
    try {
      await api.cashout(Number(cashoutAmount), cashoutReason);
      setRegisterSuccess(`Cashout of $${cashoutAmount} recorded`);
      setCashoutAmount(''); setCashoutReason('');
    } catch (e: unknown) { setRegisterError((e as Error).message); }
  }

  async function handleCloseRegister() {
    setRegisterError(''); setRegisterSuccess('');
    try {
      const counts = closeProducts.map(p => ({ product_id: p.id, units: Number(physicalCounts[p.id] ?? p.units) }));
      await api.closeRegister(Number(closingCash), counts);
      setRegisterSuccess('Register closed'); setClosingCash(''); setPhysicalCounts({}); setCloseProducts([]); loadRegister();
    } catch (e: unknown) { setRegisterError((e as Error).message); }
  }

  // ── Authorized users management (admin only) ────────────────────────────────
  const [users, setUsers] = useState<AuthorizedUser[]>([]);
  const [usersError, setUsersError] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<'staff' | 'admin'>('staff');
  const [addingUser, setAddingUser] = useState(false);

  async function loadUsers() {
    if (!isAdmin) return;
    try { setUsers(await api.getAuthorizedUsers()); }
    catch (e: unknown) { setUsersError((e as Error).message); }
  }

  useEffect(() => { loadUsers(); }, [isAdmin]);

  async function handleAddUser() {
    setUsersError('');
    if (!newEmail) return;
    try {
      await api.addAuthorizedUser(newEmail.toLowerCase(), newRole);
      setNewEmail(''); setNewRole('staff');
      loadUsers();
    } catch (e: unknown) { setUsersError((e as Error).message); }
  }

  async function handleRemoveUser(id: number) {
    setUsersError('');
    try { await api.removeAuthorizedUser(id); loadUsers(); }
    catch (e: unknown) { setUsersError((e as Error).message); }
  }

  async function handleRoleChange(id: number, role: 'staff' | 'admin') {
    setUsersError('');
    try { await api.updateAuthorizedUserRole(id, role); loadUsers(); }
    catch (e: unknown) { setUsersError((e as Error).message); }
  }

  async function handleSignOut() {
    await authClient.signOut();
    window.location.href = '/login';
  }

  // ── Discounts (admin only) ──────────────────────────────────────────────────
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [discountProducts, setDiscountProducts] = useState<Product[]>([]);
  const [discountsError, setDiscountsError] = useState('');
  const [showDiscountForm, setShowDiscountForm] = useState(false);
  const [editingDiscountId, setEditingDiscountId] = useState<number | null>(null);
  const [discountForm, setDiscountForm] = useState<DiscountForm>(emptyForm);

  async function loadDiscounts() {
    if (!isAdmin) return;
    try { setDiscounts(await api.getDiscounts()); }
    catch (e: unknown) { setDiscountsError((e as Error).message); }
  }

  useEffect(() => {
    if (!isAdmin) return;
    loadDiscounts();
    api.getProducts().then(setDiscountProducts).catch(() => {});
  }, [isAdmin]);

  function openNewDiscountForm() {
    setEditingDiscountId(null);
    setDiscountForm(emptyForm);
    setDiscountsError('');
    setShowDiscountForm(true);
  }

  function openEditDiscountForm(d: Discount) {
    setEditingDiscountId(d.id);
    setDiscountForm({
      name: d.name,
      description: d.description,
      type: d.type,
      value: d.value != null ? String(d.value) : '20',
      buy_qty: d.buy_qty != null ? String(d.buy_qty) : '2',
      get_qty: d.get_qty != null ? String(d.get_qty) : '1',
      is_manual: d.is_manual,
      requires_pin: d.requires_pin,
      days_of_week: d.days_of_week ?? [],
      valid_from: d.valid_from ? d.valid_from.slice(0, 10) : '',
      valid_until: d.valid_until ? d.valid_until.slice(0, 10) : '',
      max_redemptions: d.max_redemptions != null ? String(d.max_redemptions) : '',
      product_ids: d.product_ids,
      active: d.active,
    });
    setDiscountsError('');
    setShowDiscountForm(true);
  }

  async function handleSaveDiscount() {
    setDiscountsError('');
    const payload = {
      name: discountForm.name,
      description: discountForm.description,
      type: discountForm.type,
      value: discountForm.type === 'percentage' ? Number(discountForm.value) : null,
      buy_qty: discountForm.type === 'bxgy' ? Number(discountForm.buy_qty) : null,
      get_qty: discountForm.type === 'bxgy' ? Number(discountForm.get_qty) : null,
      is_manual: discountForm.is_manual,
      requires_pin: discountForm.is_manual ? discountForm.requires_pin : false,
      days_of_week: discountForm.days_of_week.length > 0 ? discountForm.days_of_week : null,
      valid_from: discountForm.valid_from || null,
      valid_until: discountForm.valid_until || null,
      max_redemptions: discountForm.max_redemptions ? Number(discountForm.max_redemptions) : null,
      product_ids: discountForm.product_ids,
      active: discountForm.active,
      redemptions: 0,
      created_at: '',
    };
    try {
      if (editingDiscountId != null) {
        await api.updateDiscount(editingDiscountId, payload);
      } else {
        await api.createDiscount(payload);
      }
      setShowDiscountForm(false);
      setEditingDiscountId(null);
      loadDiscounts();
    } catch (e: unknown) { setDiscountsError((e as Error).message); }
  }

  async function handleDeleteDiscount(id: number) {
    setDiscountsError('');
    try { await api.deleteDiscount(id); loadDiscounts(); }
    catch (e: unknown) { setDiscountsError((e as Error).message); }
  }

  function toggleDay(day: number) {
    setDiscountForm(f => ({
      ...f,
      days_of_week: f.days_of_week.includes(day)
        ? f.days_of_week.filter(d => d !== day)
        : [...f.days_of_week, day].sort((a, b) => a - b),
    }));
  }

  function toggleProductId(pid: number) {
    setDiscountForm(f => ({
      ...f,
      product_ids: f.product_ids.includes(pid)
        ? f.product_ids.filter(id => id !== pid)
        : [...f.product_ids, pid],
    }));
  }

  // ── Supplies (admin only) ────────────────────────────────────────────────────
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [suppliesError, setSuppliesError] = useState('');
  const [showSupplyForm, setShowSupplyForm] = useState(false);
  const [editingSupplyId, setEditingSupplyId] = useState<number | null>(null);
  const [supplyForm, setSupplyForm] = useState({ name: '', unit: 'units', quantity: '0' });

  async function loadSupplies() {
    if (!isAdmin) return;
    try { setSupplies(await api.getSupplies()); }
    catch (e: unknown) { setSuppliesError((e as Error).message); }
  }

  useEffect(() => { loadSupplies(); }, [isAdmin]);

  function openNewSupplyForm() {
    setEditingSupplyId(null);
    setSupplyForm({ name: '', unit: 'units', quantity: '0' });
    setSuppliesError('');
    setShowSupplyForm(true);
  }

  function openEditSupplyForm(s: Supply) {
    setEditingSupplyId(s.id);
    setSupplyForm({ name: s.name, unit: s.unit, quantity: String(s.quantity) });
    setSuppliesError('');
    setShowSupplyForm(true);
  }

  async function handleSaveSupply() {
    setSuppliesError('');
    const qty = Number(supplyForm.quantity);
    if (isNaN(qty) || qty < 0) { setSuppliesError('Quantity must be ≥ 0'); return; }
    try {
      if (editingSupplyId != null) {
        await api.updateSupply(editingSupplyId, { name: supplyForm.name, unit: supplyForm.unit, quantity: qty });
      } else {
        await api.createSupply({ name: supplyForm.name, unit: supplyForm.unit, quantity: qty });
      }
      setShowSupplyForm(false);
      setEditingSupplyId(null);
      loadSupplies();
    } catch (e: unknown) { setSuppliesError((e as Error).message); }
  }

  async function handleDeleteSupply(id: number) {
    setSuppliesError('');
    try { await api.deleteSupply(id); loadSupplies(); }
    catch (e: unknown) { setSuppliesError((e as Error).message); }
  }

  // ── Commission settings (admin only) ────────────────────────────────────────
  const [commissionSettings, setCommissionSettings] = useState<CommissionSettings | null>(null);
  const [commissionRate, setCommissionRate] = useState('');
  const [commissionIvaRate, setCommissionIvaRate] = useState('');
  const [commissionError, setCommissionError] = useState('');
  const [commissionSuccess, setCommissionSuccess] = useState('');

  async function loadCommissionSettings() {
    if (!isAdmin) return;
    try {
      const s = await api.getCommissionSettings();
      setCommissionSettings(s);
      setCommissionRate(String(+(s.rate * 100).toFixed(4)));
      setCommissionIvaRate(String(+(s.iva_rate * 100).toFixed(4)));
    } catch (e: unknown) { setCommissionError((e as Error).message); }
  }

  useEffect(() => { loadCommissionSettings(); }, [isAdmin]);

  async function handleSaveCommissions() {
    setCommissionError(''); setCommissionSuccess('');
    const rate = Number(commissionRate) / 100;
    const ivaRate = Number(commissionIvaRate) / 100;
    if (isNaN(rate) || rate < 0 || rate > 1) { setCommissionError('Rate must be 0–100%'); return; }
    if (isNaN(ivaRate) || ivaRate < 0 || ivaRate > 1) { setCommissionError('IVA rate must be 0–100%'); return; }
    try {
      const s = await api.updateCommissionSettings({ rate, iva_rate: ivaRate });
      setCommissionSettings(s);
      setCommissionSuccess('Commission settings saved');
    } catch (e: unknown) { setCommissionError((e as Error).message); }
  }

  const [adminSection, setAdminSection] = useState<'register' | 'discounts' | 'supplies' | 'users' | 'commissions'>('register');

  return (
    <div>
      {/* Session info + sign out */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{session?.user?.name || session?.user?.email}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {session?.user?.email} · <span style={{ textTransform: 'capitalize' }}>{(session?.user as { role?: string })?.role ?? 'staff'}</span>
          </div>
        </div>
        <button className="btn btn--ghost" style={{ width: 'auto', padding: '8px 14px' }} onClick={handleSignOut}>
          Sign out
        </button>
      </div>

      {/* Submenu */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
        {([
          { key: 'register', label: 'Register' },
          ...(isAdmin ? [
            { key: 'discounts', label: 'Discounts' },
            { key: 'supplies', label: 'Supplies' },
            { key: 'users', label: 'Users' },
            { key: 'commissions', label: 'Commissions' },
          ] : []),
        ] as { key: typeof adminSection; label: string }[]).map(({ key, label }) => (
          <button
            key={key}
            className={`btn btn--sm ${adminSection === key ? 'btn--primary' : 'btn--ghost'}`}
            style={{ flex: '1 1 auto' }}
            data-testid={`admin-section-${key}-btn`}
          onClick={() => setAdminSection(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Register */}
      {adminSection === 'register' && registerError && <div className="error-banner" data-testid="error-banner">{registerError}</div>}
      {adminSection === 'register' && registerSuccess && <div className="success-banner" data-testid="success-banner">{registerSuccess}</div>}

      {adminSection === 'register' && (registerLoading ? (
        <div className="spinner">⏳</div>
      ) : (
        <>
          <div className="card" data-testid="session-status">
            <div className="card__title">Register Status</div>
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

          {!registerSession && (
            <div className="card">
              <div className="card__title">Open Register</div>
              <div className="field">
                <label className="label">Opening Cash ($)</label>
                <input data-testid="opening-cash-input" className="input" type="number" min="0" step="0.01"
                  placeholder="0.00" value={openingCash} onChange={e => setOpeningCash(e.target.value)} />
              </div>
              <button data-testid="open-register-btn" className="btn btn--primary"
                onClick={handleOpenRegister} disabled={!openingCash}>
                Open Register
              </button>
            </div>
          )}

          {registerSession && (
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
                <div className="field">
                  <label className="label">Closing Cash ($)</label>
                  <input data-testid="closing-cash-input" className="input" type="number" min="0" step="0.01"
                    placeholder="0.00" value={closingCash} onChange={e => setClosingCash(e.target.value)} />
                </div>
                {closeProducts.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div className="label" style={{ marginBottom: 6 }}>Physical Count</div>
                    <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                          <th style={{ textAlign: 'left', padding: '4px 8px 4px 0', fontWeight: 600 }}>Product</th>
                          <th style={{ textAlign: 'right', padding: '4px 6px', fontWeight: 600 }}>System</th>
                          <th style={{ textAlign: 'right', padding: '4px 6px', fontWeight: 600 }}>Counted</th>
                        </tr>
                      </thead>
                      <tbody>
                        {closeProducts.map(p => {
                          const counted = Number(physicalCounts[p.id] ?? p.units);
                          const diff = counted - p.units;
                          return (
                            <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td style={{ padding: '5px 8px 5px 0' }}>{p.name}</td>
                              <td style={{ textAlign: 'right', padding: '5px 6px', color: 'var(--text-secondary)' }}>{p.units}</td>
                              <td style={{ textAlign: 'right', padding: '5px 4px' }}>
                                <input
                                  data-testid={`physical-count-${p.name.toLowerCase().replace(/\s+/g, '-')}`}
                                  type="number" min="0" step="1"
                                  value={physicalCounts[p.id] ?? String(p.units)}
                                  onChange={e => setPhysicalCounts(prev => ({ ...prev, [p.id]: e.target.value }))}
                                  style={{ width: 64, textAlign: 'right', padding: '2px 6px', border: '1px solid var(--border)', borderRadius: 4, background: diff !== 0 ? 'var(--surface-secondary, #f3f4f6)' : 'transparent', color: diff < 0 ? 'var(--danger)' : diff > 0 ? 'var(--success)' : 'inherit' }}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                <button data-testid="close-register-btn" className="btn btn--danger"
                  onClick={handleCloseRegister} disabled={!closingCash}>
                  Close Register
                </button>
              </div>
            </>
          )}
        </>
      ))}

      {/* Discounts — admin only */}
      {adminSection === 'discounts' && isAdmin && (
        <>
          {discountsError && <div className="error-banner">{discountsError}</div>}

          <div className="card">
            <div className="card__title">Discounts</div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
              Auto-discounts apply automatically when conditions match. Manual discounts are applied by the cashier and may require a PIN.
            </p>

            {/* Discount list */}
            {discounts.length === 0 ? (
              <div className="empty" style={{ paddingBottom: 12 }}>No discounts yet</div>
            ) : (
              discounts.map(d => (
                <div className="list-item" key={d.id} style={{ gap: 10, opacity: d.active ? 1 : 0.55 }}>
                  <div className="list-item__main" style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <div className="list-item__name">{d.name}</div>
                      {!d.active && <span className="badge badge--void" style={{ fontSize: '0.65rem' }}>INACTIVE</span>}
                      <span className="badge badge--pending" style={{ fontSize: '0.65rem' }}>
                        {d.is_manual ? 'MANUAL' : 'AUTO'}
                      </span>
                    </div>
                    <div className="list-item__sub" style={{ marginTop: 2 }}>
                      {d.type === 'percentage'
                        ? `${d.value}% off${d.product_ids.length > 0 ? ' (selected products)' : ' (whole order)'}`
                        : `Buy ${d.buy_qty} get ${d.get_qty} free`}
                      {d.days_of_week && d.days_of_week.length > 0 &&
                        ` · ${d.days_of_week.map(n => DAY_LABELS[n]).join(', ')}`}
                      {d.max_redemptions != null &&
                        ` · ${d.redemptions}/${d.max_redemptions} used`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button className="btn btn--sm btn--ghost" onClick={() => openEditDiscountForm(d)}>Edit</button>
                    <button className="btn btn--sm btn--danger" onClick={() => handleDeleteDiscount(d.id)}>Delete</button>
                  </div>
                </div>
              ))
            )}

            {!showDiscountForm && (
              <button className="btn btn--primary" style={{ marginTop: 12 }} onClick={openNewDiscountForm}>
                + Add Discount
              </button>
            )}

            {/* Create / Edit form */}
            {showDiscountForm && (
              <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                <div className="card__title">{editingDiscountId != null ? 'Edit Discount' : 'New Discount'}</div>

                <div className="field">
                  <label className="label">Name</label>
                  <input className="input" value={discountForm.name}
                    onChange={e => setDiscountForm(f => ({ ...f, name: e.target.value }))} />
                </div>

                <div className="field">
                  <label className="label">Description (optional)</label>
                  <input className="input" value={discountForm.description}
                    onChange={e => setDiscountForm(f => ({ ...f, description: e.target.value }))} />
                </div>

                <div className="field">
                  <label className="label">Type</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {(['percentage', 'bxgy'] as const).map(t => (
                      <button key={t}
                        className={`btn btn--sm ${discountForm.type === t ? 'btn--primary' : 'btn--ghost'}`}
                        style={{ flex: 1 }}
                        onClick={() => setDiscountForm(f => ({ ...f, type: t }))}
                      >
                        {t === 'percentage' ? 'Percentage' : 'Buy X Get Y Free'}
                      </button>
                    ))}
                  </div>
                </div>

                {discountForm.type === 'percentage' ? (
                  <div className="field">
                    <label className="label">Discount %</label>
                    <input className="input" type="number" min="1" max="100" value={discountForm.value}
                      onChange={e => setDiscountForm(f => ({ ...f, value: e.target.value }))} />
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div className="field" style={{ flex: 1 }}>
                      <label className="label">Buy qty</label>
                      <input className="input" type="number" min="1" value={discountForm.buy_qty}
                        onChange={e => setDiscountForm(f => ({ ...f, buy_qty: e.target.value }))} />
                    </div>
                    <div className="field" style={{ flex: 1 }}>
                      <label className="label">Get free</label>
                      <input className="input" type="number" min="1" value={discountForm.get_qty}
                        onChange={e => setDiscountForm(f => ({ ...f, get_qty: e.target.value }))} />
                    </div>
                  </div>
                )}

                <div className="field">
                  <label className="label">Days of week (empty = every day)</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {DAY_LABELS.map((label, i) => (
                      <button key={i}
                        className={`btn btn--sm ${discountForm.days_of_week.includes(i) ? 'btn--primary' : 'btn--ghost'}`}
                        style={{ minWidth: 44 }}
                        onClick={() => toggleDay(i)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <div className="field" style={{ flex: 1 }}>
                    <label className="label">Valid from</label>
                    <input className="input" type="date" value={discountForm.valid_from}
                      onChange={e => setDiscountForm(f => ({ ...f, valid_from: e.target.value }))} />
                  </div>
                  <div className="field" style={{ flex: 1 }}>
                    <label className="label">Valid until</label>
                    <input className="input" type="date" value={discountForm.valid_until}
                      onChange={e => setDiscountForm(f => ({ ...f, valid_until: e.target.value }))} />
                  </div>
                </div>

                <div className="field">
                  <label className="label">Max redemptions (empty = unlimited)</label>
                  <input className="input" type="number" min="1" placeholder="Unlimited"
                    value={discountForm.max_redemptions}
                    onChange={e => setDiscountForm(f => ({ ...f, max_redemptions: e.target.value }))} />
                </div>

                <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input type="checkbox" checked={discountForm.is_manual}
                      onChange={e => setDiscountForm(f => ({ ...f, is_manual: e.target.checked, requires_pin: e.target.checked ? f.requires_pin : false }))}
                      style={{ width: 18, height: 18, accentColor: 'var(--primary)' }} />
                    <span style={{ fontSize: '0.9rem' }}>Manual (cashier-triggered only)</span>
                  </label>
                  {discountForm.is_manual && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input type="checkbox" checked={discountForm.requires_pin}
                        onChange={e => setDiscountForm(f => ({ ...f, requires_pin: e.target.checked }))}
                        style={{ width: 18, height: 18, accentColor: 'var(--primary)' }} />
                      <span style={{ fontSize: '0.9rem' }}>Admin only</span>
                    </label>
                  )}
                </div>

                {editingDiscountId != null && (
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input type="checkbox" checked={discountForm.active}
                        onChange={e => setDiscountForm(f => ({ ...f, active: e.target.checked }))}
                        style={{ width: 18, height: 18, accentColor: 'var(--primary)' }} />
                      <span style={{ fontSize: '0.9rem' }}>Active</span>
                    </label>
                  </div>
                )}

                <div className="field">
                  <label className="label">
                    Qualifying products
                    {discountForm.type === 'percentage' && (
                      <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}> — empty = entire order</span>
                    )}
                  </label>
                  <div style={{ maxHeight: 180, overflowY: 'auto', border: '1.5px solid var(--border)', borderRadius: 8, padding: '8px 12px' }}>
                    {discountProducts.filter(p => p.active).map(p => (
                      <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', cursor: 'pointer' }}>
                        <input type="checkbox"
                          checked={discountForm.product_ids.includes(p.id)}
                          onChange={() => toggleProductId(p.id)}
                          style={{ width: 16, height: 16, accentColor: 'var(--primary)' }} />
                        <span style={{ fontSize: '0.9rem' }}>{p.name}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: 'auto' }}>${p.price.toFixed(2)}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button className="btn btn--ghost" style={{ flex: 1 }}
                    onClick={() => { setShowDiscountForm(false); setEditingDiscountId(null); }}>
                    Cancel
                  </button>
                  <button className="btn btn--primary" style={{ flex: 1 }}
                    onClick={handleSaveDiscount}
                    disabled={!discountForm.name || (discountForm.type === 'bxgy' && discountForm.product_ids.length === 0)}>
                    {editingDiscountId != null ? 'Save Changes' : 'Create Discount'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Supplies — admin only */}
      {adminSection === 'supplies' && isAdmin && (
        <>
          {suppliesError && <div className="error-banner">{suppliesError}</div>}

          <div className="card">
            <div className="card__title">Supplies</div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
              Supplies are consumed when selling products linked to them. Products using supplies have computed stock.
            </p>

            {supplies.length === 0 ? (
              <div className="empty" style={{ paddingBottom: 12 }}>No supplies yet</div>
            ) : (
              supplies.map(s => (
                <div className="list-item" key={s.id}>
                  <div className="list-item__main">
                    <div className="list-item__name">{s.name}</div>
                    <div className="list-item__sub">{s.quantity} {s.unit}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button className="btn btn--sm btn--ghost" onClick={() => openEditSupplyForm(s)}>Edit</button>
                    <button className="btn btn--sm btn--danger" onClick={() => handleDeleteSupply(s.id)}>Delete</button>
                  </div>
                </div>
              ))
            )}

            {!showSupplyForm && (
              <button className="btn btn--primary" style={{ marginTop: 12 }} onClick={openNewSupplyForm}>
                + Add Supply
              </button>
            )}

            {showSupplyForm && (
              <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                <div className="card__title">{editingSupplyId != null ? 'Edit Supply' : 'New Supply'}</div>

                <div className="field">
                  <label className="label">Name</label>
                  <input className="input" placeholder="e.g. Coffee grounds"
                    value={supplyForm.name}
                    onChange={e => setSupplyForm(f => ({ ...f, name: e.target.value }))} />
                </div>

                <div className="field">
                  <label className="label">Unit</label>
                  <input className="input" placeholder="e.g. g, ml, units"
                    value={supplyForm.unit}
                    onChange={e => setSupplyForm(f => ({ ...f, unit: e.target.value }))} />
                </div>

                <div className="field">
                  <label className="label">Initial quantity</label>
                  <input className="input" type="number" min="0" step="0.01"
                    value={supplyForm.quantity}
                    onChange={e => setSupplyForm(f => ({ ...f, quantity: e.target.value }))} />
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button className="btn btn--ghost" style={{ flex: 1 }}
                    onClick={() => { setShowSupplyForm(false); setEditingSupplyId(null); }}>
                    Cancel
                  </button>
                  <button className="btn btn--primary" style={{ flex: 1 }}
                    onClick={handleSaveSupply}
                    disabled={!supplyForm.name || !supplyForm.unit}>
                    {editingSupplyId != null ? 'Save Changes' : 'Create Supply'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Commissions — admin only */}
      {adminSection === 'commissions' && isAdmin && (
        <>
          {commissionError && <div className="error-banner">{commissionError}</div>}
          {commissionSuccess && <div className="success-banner" data-testid="commission-success">{commissionSuccess}</div>}

          <div className="card">
            <div className="card__title">Credit Card Commission</div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
              Commission is automatically deducted from card payment income and tracked separately.
              Set rate to 0 to disable commission tracking.
            </p>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <div className="field" style={{ flex: 1, minWidth: 140 }}>
                <label className="label">Commission rate (%)</label>
                <input
                  data-testid="commission-rate-input"
                  className="input"
                  type="number"
                  min="0"
                  max="100"
                  step="0.001"
                  value={commissionRate}
                  onChange={e => setCommissionRate(e.target.value)}
                />
              </div>
              <div className="field" style={{ flex: 1, minWidth: 140 }}>
                <label className="label">IVA on commission (%)</label>
                <input
                  data-testid="commission-iva-rate-input"
                  className="input"
                  type="number"
                  min="0"
                  max="100"
                  step="0.001"
                  value={commissionIvaRate}
                  onChange={e => setCommissionIvaRate(e.target.value)}
                />
              </div>
            </div>

            {commissionSettings && (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
                Example: $100 card payment → ${(100 * (Number(commissionRate) / 100) * (1 + Number(commissionIvaRate) / 100)).toFixed(2)} commission deducted
              </div>
            )}

            <button
              data-testid="save-commissions-btn"
              className="btn btn--primary"
              onClick={handleSaveCommissions}
            >
              Save
            </button>
          </div>

          {commissionSettings && (
            <div className="card">
              <div className="card__title">Total Commissions Paid</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f59e0b' }} data-testid="total-commissions-paid">
                ${commissionSettings.total_paid.toFixed(2)}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                Cumulative card commissions charged since tracking began
              </div>
            </div>
          )}
        </>
      )}

      {/* Authorized users — admin only */}
      {adminSection === 'users' && isAdmin && (
        <>
          {usersError && <div className="error-banner">{usersError}</div>}

          <div className="card">
            <div className="card__title">Authorized Users</div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
              Only users on this list can sign in. Add a user before they attempt to log in.
            </p>

            {/* Add user form */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              <input
                data-testid="new-user-email"
                className="input"
                type="email"
                placeholder="user@example.com"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                style={{ flex: 1, minWidth: 180 }}
              />
              <select
                data-testid="new-user-role"
                className="input"
                style={{ width: 'auto' }}
                value={newRole}
                onChange={e => setNewRole(e.target.value as 'staff' | 'admin')}
              >
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
              </select>
              <button
                data-testid="add-user-btn"
                className="btn btn--primary"
                style={{ width: 'auto', padding: '10px 16px' }}
                onClick={() => { setAddingUser(true); handleAddUser().finally(() => setAddingUser(false)); }}
                disabled={addingUser || !newEmail}
              >
                Add
              </button>
            </div>

            {/* User list */}
            {users.length === 0 ? (
              <div className="empty">No authorized users yet</div>
            ) : (
              users.map(u => (
                <div className="list-item" key={u.id}>
                  <div className="list-item__main">
                    <div className="list-item__name" data-testid="authorized-user-email">{u.email}</div>
                    <div className="list-item__sub">{u.created_at.slice(0, 10)}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <select
                      className="input"
                      style={{ width: 'auto', fontSize: '0.85rem', padding: '4px 8px' }}
                      value={u.role}
                      onChange={e => handleRoleChange(u.id, e.target.value as 'staff' | 'admin')}
                    >
                      <option value="staff">Staff</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button
                      data-testid={`remove-user-${u.id}`}
                      className="btn btn--sm btn--danger"
                      onClick={() => handleRemoveUser(u.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
