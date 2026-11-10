import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

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

  const selectStore = useCallback((store) => {
    if (!store || !store.id) {
      clearStore();
      return;
    }

    const safeStore = {
      id: store.id,
      name: store.name,
      address: store.address,
      city: store.city,
      pincode: store.pincode,
      isOpen: store.isOpen,
    };

    setSelectedStoreState((prev) => {
      // Avoid re-rendering if store attributes are already identical
      if (
        prev &&
        prev.id === safeStore.id &&
        prev.name === safeStore.name &&
        prev.isOpen === safeStore.isOpen &&
        prev.address === safeStore.address &&
        prev.city === safeStore.city &&
        prev.pincode === safeStore.pincode
      ) {
        return prev;
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(safeStore));
      } catch {
        // Ignore storage write issues
      }
      return safeStore;
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const clearStore = useCallback(() => {
    setSelectedStoreState((prev) => {
      if (prev === null) return prev;
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Ignore storage remove issues
      }
      return null;
    });
  }, []);

  const value = useMemo(
    () => ({
      selectedStore,
      selectedStoreId: selectedStore?.id || null,
      selectStore,
      clearStore,
    }),
    [selectedStore, selectStore, clearStore]
  );

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
