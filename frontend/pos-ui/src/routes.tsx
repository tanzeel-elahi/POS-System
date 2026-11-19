import { Navigate, Route, Routes } from 'react-router-dom';
import { MainLayout } from '@/layouts/MainLayout';
import { ProductsPage } from '@pages/products/ProductsPage';
import { CustomersPage } from '@pages/customers/CustomersPage';
import { BillingPage } from './pages/billing/BillingPage';
import { BulkUpdatePage } from './pages/products/BulkUpdatePage';

export const AppRoutes = () => (
  <Routes>
    <Route element={<MainLayout />}>
      <Route path="/" element={<Navigate to="/products" replace />} />
      <Route path="/products" element={<ProductsPage />} />
      <Route path="/customers" element={<CustomersPage />} />
      <Route path="*" element={<Navigate to="/products" replace />} />
      <Route path="/billing" element={<BillingPage />} />
      <Route path="/products/bulk" element={<BulkUpdatePage />} />
    </Route>
  </Routes>
);
