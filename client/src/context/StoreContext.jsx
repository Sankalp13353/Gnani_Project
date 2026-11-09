import React, { createContext, useContext, useState, useEffect } from 'react';

const StoreContext = createContext(null);
const STORAGE_KEY = 'callsaar_customer_selected_store';

export const StoreProvider = ({ children }) => {
  const [selectedStore, setSelectedStoreState] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const selectStore = (store) => {
    if (!store || !store.id) {
      clearStore();
      return;
    }

    // Persist only safe public store attributes
    const safeStore = {
      id: store.id,
      name: store.name,
      address: store.address,
      city: store.city,
      pincode: store.pincode,
      isOpen: store.isOpen,
    };

    setSelectedStoreState(safeStore);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(safeStore));
    } catch {
      // Ignore storage write issues
    }
  };

  const clearStore = () => {
    setSelectedStoreState(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage remove issues
    }
  };

  const value = {
    selectedStore,
    selectedStoreId: selectedStore?.id || null,
    selectStore,
    clearStore,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
};

export const useCustomerStore = () => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useCustomerStore must be used within a StoreProvider');
  }
  return context;
};

export default StoreContext;

