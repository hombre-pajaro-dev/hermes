import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import RegisterView from './views/RegisterView';
import CheckoutView from './views/CheckoutView';
import TabsView from './views/TabsView';
import ProductsView from './views/ProductsView';
import RestockView from './views/RestockView';
import InventoryView from './views/InventoryView';
import LedgerView from './views/LedgerView';
import ReportsView from './views/ReportsView';
import AdminView from './views/AdminView';
import './App.css';

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/register" replace />} />
          <Route path="/register" element={<RegisterView />} />
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
    </BrowserRouter>
  );
}
