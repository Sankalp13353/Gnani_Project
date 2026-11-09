import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import MainLayout from './layouts/MainLayout.jsx';
import HomePage from './pages/HomePage.jsx';
import MerchantLoginPage from './pages/merchant/MerchantLoginPage.jsx';
import MerchantRegisterPage from './pages/merchant/MerchantRegisterPage.jsx';
import MerchantDashboardPage from './pages/merchant/MerchantDashboardPage.jsx';
import MerchantCataloguePage from './pages/merchant/MerchantCataloguePage.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

export const App = () => {
  return (
    <Router>
      <AuthProvider>
        <MainLayout>
          <Routes>
            <Route path="/" element={<HomePage />} />
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
              path="/merchant/catalogue"
              element={
                <ProtectedRoute>
                  <MerchantCataloguePage />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </MainLayout>
      </AuthProvider>
    </Router>
  );
};

export default App;
