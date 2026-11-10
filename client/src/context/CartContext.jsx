import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { calculateOrderPricing } from '../services/api.js';

const CartContext = createContext(null);
const CART_STORAGE_KEY = 'callsaar_customer_cart_v1';

export const CartProvider = ({ children }) => {
  // Saved cart in localStorage: { storeId: string, store: object, items: [], subtotal: string, unresolved: [], clarifications: [] }
  const [cartState, setCartState] = useState(() => {
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          storeId: parsed.storeId || null,
          store: parsed.store || null,
          items: Array.isArray(parsed.items) ? parsed.items : [],
          subtotal: parsed.subtotal || '0.00',
          unresolved: Array.isArray(parsed.unresolved) ? parsed.unresolved : [],
          clarifications: Array.isArray(parsed.clarifications) ? parsed.clarifications : [],
        };
      }
    } catch (err) {
      console.warn('Failed to parse cart from storage:', err);
    }
    return {
      storeId: null,
      store: null,
      items: [],
      subtotal: '0.00',
      unresolved: [],
      clarifications: [],
    };
  });

  const [isCalculatingPricing, setIsCalculatingPricing] = useState(false);
  const [pricingError, setPricingError] = useState(null);

  // Sync state to localStorage whenever it changes
  useEffect(() => {
    try {
      if (cartState.items.length === 0 && cartState.unresolved.length === 0 && !cartState.storeId) {
        localStorage.removeItem(CART_STORAGE_KEY);
      } else {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartState));
      }
    } catch (err) {
      console.warn('Failed to save cart to storage:', err);
    }
  }, [cartState]);

  /**
   * Set or switch active store for cart.
   * If customer switches to a different store, reset cart items to enforce store isolation:
   * "Do not allow products from different stores in the same order."
   */
  const setCartStore = useCallback((store) => {
    if (!store || !store.id) return;

    setCartState((prev) => {
      if (prev.storeId && prev.storeId !== store.id) {
        // Different store selected: reset cart to maintain store isolation
        return {
          storeId: store.id,
          store: {
            id: store.id,
            name: store.name,
            address: store.address,
            city: store.city,
            pincode: store.pincode,
            isOpen: store.isOpen,
          },
          items: [],
          subtotal: '0.00',
          unresolved: [],
          clarifications: [],
        };
      }

      // Same store: check if store metadata is unchanged to avoid unnecessary re-renders
      if (
        prev.storeId === store.id &&
        prev.store &&
        prev.store.name === store.name &&
        prev.store.isOpen === store.isOpen &&
        prev.store.address === store.address &&
        prev.store.city === store.city &&
        prev.store.pincode === store.pincode
      ) {
        return prev;
      }

      // Initial assignment or updated properties: update store metadata while preserving items
      return {
        ...prev,
        storeId: store.id,
        store: {
          id: store.id,
          name: store.name,
          address: store.address,
          city: store.city,
          pincode: store.pincode,
          isOpen: store.isOpen,
        },
      };
    });
  }, []);

  /**
   * Recalculates cart items and subtotal via the backend POST /api/orders/calculate.
   * Guarantees all prices, line totals, and subtotals are grounded in the database catalogue.
   */
  const syncWithBackendPricing = useCallback(async (itemsToCalculate, targetStoreId) => {
    if (!targetStoreId || !itemsToCalculate || itemsToCalculate.length === 0) {
      setCartState((prev) => ({
        ...prev,
        items: [],
        subtotal: '0.00',
      }));
      setPricingError(null);
      return;
    }

    setIsCalculatingPricing(true);
    setPricingError(null);

    try {
      const payload = {
        storeId: targetStoreId,
        items: itemsToCalculate.map((item) => ({
          productId: item.productId,
          quantity: String(item.quantity || 1),
          unit: item.unit || item.catalogUnit,
        })),
      };

      const res = await calculateOrderPricing(payload);
      if (res?.success && res?.data) {
        setCartState((prev) => ({
          ...prev,
          items: res.data.items || [],
          subtotal: res.data.subtotal || '0.00',
        }));
      } else {
        throw new Error(res?.message || 'Price calculation failed');
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || 'Error validating items with store catalogue';
      setPricingError(errMsg);
      console.error('Pricing calculation error:', errMsg);
    } finally {
      setIsCalculatingPricing(false);
    }
  }, []);

  /**
   * Add a product from store catalogue to the cart.
   * If already present, increment quantity.
   */
  const addToCart = useCallback(
    async (product, quantity = 1, requestedUnit = null) => {
      if (!product || !product.id) return;

      const targetStoreId = product.storeId || cartState.storeId;
      if (!targetStoreId) {
        console.warn('Cannot add to cart without storeId');
        return;
      }

      let updatedItems = [];
      const existingIdx = cartState.items.findIndex((i) => i.productId === product.id);

      if (existingIdx >= 0) {
        // Increment quantity of existing item
        updatedItems = cartState.items.map((item, idx) => {
          if (idx === existingIdx) {
            const currentQty = parseFloat(item.quantity) || 1;
            const newQty = currentQty + (parseFloat(quantity) || 1);
            return {
              ...item,
              quantity: String(newQty),
            };
          }
          return item;
        });
      } else {
        // Add new item
        const newItem = {
          productId: product.id,
          productName: product.name,
          quantity: String(quantity || 1),
          unit: requestedUnit || product.unit,
          catalogUnit: product.unit,
          unitPrice: String(product.price),
          lineTotal: (parseFloat(quantity || 1) * parseFloat(product.price)).toFixed(2),
        };
        updatedItems = [...cartState.items, newItem];
      }

      // Optimistically update, then sync with backend
      setCartState((prev) => ({
        ...prev,
        storeId: targetStoreId,
        items: updatedItems,
      }));

      await syncWithBackendPricing(updatedItems, targetStoreId);
    },
    [cartState.items, cartState.storeId, syncWithBackendPricing]
  );

  /**
   * Increase or decrease quantity of an item in the cart.
   * Decreasing to <= 0 removes the item.
   */
  const updateQuantity = useCallback(
    async (productId, delta) => {
      const existingIdx = cartState.items.findIndex((i) => i.productId === productId);
      if (existingIdx < 0) return;

      const currentItem = cartState.items[existingIdx];
      const currentQty = parseFloat(currentItem.quantity) || 1;
      const newQty = currentQty + delta;

      let updatedItems = [];
      if (newQty <= 0) {
        updatedItems = cartState.items.filter((i) => i.productId !== productId);
      } else {
        updatedItems = cartState.items.map((item, idx) => {
          if (idx === existingIdx) {
            return {
              ...item,
              quantity: String(newQty),
            };
          }
          return item;
        });
      }

      setCartState((prev) => ({
        ...prev,
        items: updatedItems,
      }));

      await syncWithBackendPricing(updatedItems, cartState.storeId);
    },
    [cartState.items, cartState.storeId, syncWithBackendPricing]
  );

  /**
   * Explicitly set quantity for an item in the cart.
   */
  const setItemQuantity = useCallback(
    async (productId, quantity) => {
      const numQty = parseFloat(quantity);
      if (isNaN(numQty) || numQty <= 0) {
        await removeFromCart(productId);
        return;
      }

      const updatedItems = cartState.items.map((item) => {
        if (item.productId === productId) {
          return {
            ...item,
            quantity: String(numQty),
          };
        }
        return item;
      });

      setCartState((prev) => ({
        ...prev,
        items: updatedItems,
      }));

      await syncWithBackendPricing(updatedItems, cartState.storeId);
    },
    [cartState.items, cartState.storeId, syncWithBackendPricing]
  );

  /**
   * Remove product completely from cart.
   */
  const removeFromCart = useCallback(
    async (productId) => {
      const updatedItems = cartState.items.filter((i) => i.productId !== productId);

      setCartState((prev) => ({
        ...prev,
        items: updatedItems,
        subtotal: updatedItems.length === 0 ? '0.00' : prev.subtotal,
      }));

      if (updatedItems.length === 0) {
        setPricingError(null);
      } else {
        await syncWithBackendPricing(updatedItems, cartState.storeId);
      }
    },
    [cartState.items, cartState.storeId, syncWithBackendPricing]
  );

  /**
   * Clear the entire cart and unresolved items.
   */
  const clearCart = useCallback(() => {
    setCartState((prev) => ({
      ...prev,
      items: [],
      subtotal: '0.00',
      unresolved: [],
      clarifications: [],
    }));
    setPricingError(null);
    try {
      localStorage.removeItem(CART_STORAGE_KEY);
    } catch {
      // Ignore
    }
  }, []);

  /**
   * Merge voice-parsed matched items and store unresolved items/clarifications.
   */
  const addVoiceItems = useCallback(
    async (voiceMatchedItems = [], voiceUnresolved = [], voiceClarifications = []) => {
      const targetStoreId = cartState.storeId;
      if (!targetStoreId) return;

      // Merge matched items by productId
      const mergedMap = new Map();
      // First put existing cart items
      for (const item of cartState.items) {
        mergedMap.set(item.productId, { ...item });
      }

      // Merge new voice matched items
      for (const vItem of voiceMatchedItems) {
        if (!vItem.productId) continue;
        if (mergedMap.has(vItem.productId)) {
          const existing = mergedMap.get(vItem.productId);
          const newQty = (parseFloat(existing.quantity) || 0) + (parseFloat(vItem.quantity) || 1);
          existing.quantity = String(newQty);
        } else {
          mergedMap.set(vItem.productId, { ...vItem });
        }
      }

      const updatedItems = Array.from(mergedMap.values());

      setCartState((prev) => ({
        ...prev,
        items: updatedItems,
        unresolved: voiceUnresolved,
        clarifications: voiceClarifications,
      }));

      await syncWithBackendPricing(updatedItems, targetStoreId);
    },
    [cartState.items, cartState.storeId, syncWithBackendPricing]
  );

  /**
   * Resolve an unresolved voice item by matching it with a chosen catalogue product.
   */
  const resolveUnresolvedItem = useCallback(
    async (unresolvedIndex, catalogProduct) => {
      if (!catalogProduct || !catalogProduct.id) return;

      const unItem = cartState.unresolved[unresolvedIndex];
      const qty = unItem && unItem.quantity ? String(unItem.quantity) : '1';

      // Remove from unresolved
      const updatedUnresolved = cartState.unresolved.filter((_, idx) => idx !== unresolvedIndex);

      setCartState((prev) => ({
        ...prev,
        unresolved: updatedUnresolved,
      }));

      // Add to cart
      await addToCart(catalogProduct, parseFloat(qty) || 1);
    },
    [cartState.unresolved, addToCart]
  );

  /**
   * Dismiss an unresolved voice item without adding to cart.
   */
  const removeUnresolvedItem = useCallback((unresolvedIndex) => {
    setCartState((prev) => ({
      ...prev,
      unresolved: prev.unresolved.filter((_, idx) => idx !== unresolvedIndex),
    }));
  }, []);

  // Compute total item count
  const cartCount = cartState.items.reduce((acc, item) => {
    return acc + (parseFloat(item.quantity) || 1);
  }, 0);

  const value = useMemo(
    () => ({
      cartStore: cartState.store,
      cartStoreId: cartState.storeId,
      cartItems: cartState.items,
      cartSubtotal: cartState.subtotal,
      cartCount,
      unresolvedItems: cartState.unresolved,
      clarifications: cartState.clarifications,
      isCalculatingPricing,
      pricingError,
      setCartStore,
      addToCart,
      updateQuantity,
      setItemQuantity,
      removeFromCart,
      clearCart,
      addVoiceItems,
      resolveUnresolvedItem,
      removeUnresolvedItem,
      syncWithBackendPricing,
    }),
    [
      cartState.store,
      cartState.storeId,
      cartState.items,
      cartState.subtotal,
      cartCount,
      cartState.unresolved,
      cartState.clarifications,
      isCalculatingPricing,
      pricingError,
      setCartStore,
      addToCart,
      updateQuantity,
      setItemQuantity,
      removeFromCart,
      clearCart,
      addVoiceItems,
      resolveUnresolvedItem,
      removeUnresolvedItem,
      syncWithBackendPricing,
    ]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

export default CartContext;

