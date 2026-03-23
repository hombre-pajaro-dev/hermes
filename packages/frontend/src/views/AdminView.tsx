import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { AuthorizedUser } from '../api/client';
import { authClient } from '../lib/auth-client';

export default function AdminView() {
  const { data: session } = authClient.useSession();
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === 'admin';

  // PIN management
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinSuccess, setPinSuccess] = useState('');

  async function handleChangePin() {
    setPinError(''); setPinSuccess('');
    if (newPin !== confirmPin) { setPinError('New PINs do not match'); return; }
    if (newPin.length < 4) { setPinError('PIN must be at least 4 characters'); return; }
    try {
      await api.changePin(currentPin, newPin);
      setPinSuccess('PIN changed successfully');
      setCurrentPin(''); setNewPin(''); setConfirmPin('');
    } catch (e: unknown) { setPinError((e as Error).message); }
  }

  // Authorized users management (admin only)
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

      {/* PIN management */}
      {pinError && <div className="error-banner" data-testid="error-banner">{pinError}</div>}
      {pinSuccess && <div className="success-banner" data-testid="success-banner">{pinSuccess}</div>}

      <div className="card">
        <div className="card__title">Change PIN</div>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
          The PIN protects cash-outs, closing the register, and opening staff cost tabs.
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

      {/* Authorized users — admin only */}
      {isAdmin && (
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
