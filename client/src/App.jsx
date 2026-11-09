import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { StoreProvider } from './context/StoreContext.jsx';
import MainLayout from './layouts/MainLayout.jsx';
import HomePage from './pages/HomePage.jsx';
import StoreDiscoveryPage from './pages/customer/StoreDiscoveryPage.jsx';
import StoreCataloguePage from './pages/customer/StoreCataloguePage.jsx';
import StoreVoiceOrderPage from './pages/customer/StoreVoiceOrderPage.jsx';
import OrderConfirmationPage from './pages/customer/OrderConfirmationPage.jsx';
import MerchantLoginPage from './pages/merchant/MerchantLoginPage.jsx';
import MerchantRegisterPage from './pages/merchant/MerchantRegisterPage.jsx';
import MerchantDashboardPage from './pages/merchant/MerchantDashboardPage.jsx';
import MerchantCataloguePage from './pages/merchant/MerchantCataloguePage.jsx';
import MerchantOrdersPage from './pages/merchant/MerchantOrdersPage.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

export const App = () => {
  return (
    <Router>
      <AuthProvider>
        <StoreProvider>
          <MainLayout>
            <Routes>
              {/* Customer Routes */}
              <Route path="/" element={<HomePage />} />
              <Route path="/stores" element={<StoreDiscoveryPage />} />
              <Route path="/stores/:storeId" element={<StoreCataloguePage />} />
              <Route path="/stores/:storeId/order" element={<StoreVoiceOrderPage />} />
              <Route path="/orders/:orderId/confirmation" element={<OrderConfirmationPage />} />

              {/* Merchant Routes */}
              <Route path="/merchant/login" element={<MerchantLoginPage />} />
              <Route path="/merchant/register" element={<MerchantRegisterPage />} />
              <Route
                path="/merchant/dashboard"
                element={
                  <ProtectedRoute>
                    <MerchantDashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/merchant/orders"
                element={
                  <ProtectedRoute>
                    <MerchantOrdersPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/merchant/catalogue"
                element={
                  <ProtectedRoute>
                    <MerchantCataloguePage />
                  </ProtectedRoute>
                }
              />

              {/* Catch-all redirect */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </MainLayout>
        </StoreProvider>
      </AuthProvider>
    </Router>
  );
};

export default App;
