import { NavLink, useLocation } from 'react-router-dom';

const NAV = [
  { to: '/register', label: 'Register', icon: '🏧' },
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
  '/register': 'Register',
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
  return (
    <div className="layout">
      <header className="layout__header">
        <span className="layout__title">{TITLES[pathname] ?? 'POS - El Nido'}</span>
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
