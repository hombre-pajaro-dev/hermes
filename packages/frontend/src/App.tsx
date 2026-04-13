import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { authClient } from './lib/auth-client';
import Layout from './components/Layout';
import LoginView from './views/LoginView';
import CheckoutView from './views/CheckoutView';
import TabsView from './views/TabsView';
import ProductsView from './views/ProductsView';
import RestockView from './views/RestockView';
import InventoryView from './views/InventoryView';
import LedgerView from './views/LedgerView';
import ReportsView from './views/ReportsView';
import AdminView from './views/AdminView';
import './App.css';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = authClient.useSession();
  if (isPending) return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="spinner">⏳</div>
    </div>
  );
  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginView />} />
        <Route
          path="/*"
          element={
            <RequireAuth>
              <Layout>
                <Routes>
                  <Route path="/" element={<Navigate to="/checkout" replace />} />
                  <Route path="/register" element={<Navigate to="/admin" replace />} />
                  <Route path="/checkout" element={<CheckoutView />} />
                  <Route path="/tabs" element={<TabsView />} />
                  <Route path="/products" element={<ProductsView />} />
                  <Route path="/restock" element={<RestockView />} />
                  <Route path="/inventory" element={<InventoryView />} />
                  <Route path="/ledger" element={<LedgerView />} />
                  <Route path="/reports" element={<ReportsView />} />
                  <Route path="/admin" element={<AdminView />} />
                </Routes>
              </Layout>
            </RequireAuth>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
