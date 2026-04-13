import { NavLink, useLocation } from 'react-router-dom';
import { authClient } from '../lib/auth-client';

const NAV = [
  { to: '/checkout', label: 'Checkout', icon: '🛒' },
  { to: '/tabs', label: 'Tabs', icon: '📋' },
  { to: '/products', label: 'Products', icon: '📦' },
  { to: '/restock', label: 'Restock', icon: '🔄' },
  { to: '/inventory', label: 'Inventory', icon: '🔢' },
  { to: '/ledger', label: 'Ledger', icon: '📒' },
  { to: '/reports', label: 'Reports', icon: '📊' },
  { to: '/admin', label: 'Admin', icon: '⚙️' },
];

const TITLES: Record<string, string> = {
  '/checkout': 'Checkout',
  '/tabs': 'Tabs',
  '/products': 'Products',
  '/restock': 'Restock',
  '/inventory': 'Inventory',
  '/ledger': 'Ledger',
  '/reports': 'Reports',
  '/admin': 'Admin',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const { data: session } = authClient.useSession();
  const user = session?.user as { name?: string; email?: string; image?: string } | undefined;

  const initials = user?.name
    ? user.name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? '?';

  async function handleSignOut() {
    await authClient.signOut();
    window.location.href = '/login';
  }

  return (
    <div className="layout">
      <header className="layout__header">
        <span className="layout__title">{TITLES[pathname] ?? 'POS - El Nido'}</span>
        {user && (
          <div className="layout__user">
            <div className="layout__avatar">
              {user.image
                ? <img src={user.image} alt={user.name ?? user.email} referrerPolicy="no-referrer" />
                : <span>{initials}</span>}
            </div>
            <span className="layout__user-name">{user.name || user.email}</span>
            <button className="layout__signout" onClick={handleSignOut} title="Sign out">
              ⏻
            </button>
          </div>
        )}
      </header>
      <main className="layout__content">{children}</main>
      <nav className="layout__nav">
        {NAV.map(n => (
          <NavLink key={n.to} to={n.to} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <span style={{ fontSize: '1.2rem' }}>{n.icon}</span>
            <span>{n.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
