import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  registerMerchant,
  loginMerchant,
  logoutMerchant,
  getMerchantProfile,
} from '../services/api.js';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check existing session on mount via HTTP-only cookie
  const checkAuth = useCallback(async () => {
    try {
      const response = await getMerchantProfile();
      if (response?.success && response?.data?.store) {
        setStore(response.data.store);
      } else {
        setStore(null);
      }
    } catch {
      // 401 or network error on mount indicates unauthenticated state
      setStore(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Merchant Registration
  const register = async (formData) => {
    setError(null);
    try {
      const response = await registerMerchant(formData);
      if (response?.success && response?.data?.store) {
        setStore(response.data.store);
        return response.data.store;
      }
      throw new Error(response?.message || 'Registration failed');
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Registration failed';
      setError(message);
      throw new Error(message);
    }
  };

  // Merchant Login
  const login = async (credentials) => {
    setError(null);
    try {
      const response = await loginMerchant(credentials);
      if (response?.success && response?.data?.store) {
        setStore(response.data.store);
        return response.data.store;
      }
      throw new Error(response?.message || 'Login failed');
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Login failed';
      setError(message);
      throw new Error(message);
    }
  };

  // Merchant Logout
  const logout = async () => {
    try {
      await logoutMerchant();
    } catch (err) {
      console.warn('Logout API call failed:', err);
    } finally {
      setStore(null);
      setError(null);
    }
  };

  const value = {
    store,
    loading,
    isAuthenticated: Boolean(store),
    error,
    register,
    login,
    logout,
    refresh: checkAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;

