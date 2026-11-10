import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ShoppingBag,
  Trash2,
  Plus,
  Minus,
  ArrowLeft,
  Mic,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  RefreshCw,
  MapPin,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { useCart } from '../../context/CartContext.jsx';
import { useCustomerStore } from '../../context/StoreContext.jsx';
import {
  fetchPublicStoreById,
  fetchPublicStoreCatalogue,
  submitCustomerOrder,
} from '../../services/api.js';

export const StoreCartReviewPage = () => {
  const { storeId } = useParams();
  const navigate = useNavigate();
  const { selectStore } = useCustomerStore();
  const {
    cartStore,
    cartItems,
    cartSubtotal,
    unresolvedItems,
    clarifications,
    isCalculatingPricing,
    pricingError,
    setCartStore,
    updateQuantity,
    removeFromCart,
    clearCart,
    resolveUnresolvedItem,
    removeUnresolvedItem,
    syncWithBackendPricing,
  } = useCart();

  const [store, setStore] = useState(cartStore || null);
  const [storeLoading, setStoreLoading] = useState(!cartStore);
  const [storeError, setStoreError] = useState(null);
  const [catalogue, setCatalogue] = useState([]);

  // Customer pickup details
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  // Security & Idempotency tokens
  const idempotencyKeyRef = useRef(crypto.randomUUID());
  const confirmationSecretRef = useRef(
    typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues
      ? Array.from(window.crypto.getRandomValues(new Uint8Array(32)), (b) =>
          b.toString(16).padStart(2, '0')
        ).join('')
      : (crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')).slice(0, 64)
  );

  const activeStoreIdRef = useRef(storeId);
  activeStoreIdRef.current = storeId;

  // Load store and catalogue details
  const loadStoreData = useCallback(async () => {
    const targetStoreId = storeId;
    if (!targetStoreId) {
      setStoreError('No store ID provided. Please select an active store from the directory.');
      setStoreLoading(false);
      return;
    }

    setStoreLoading(true);
    setStoreError(null);

    try {
      const [storeRes, catRes] = await Promise.all([
        fetchPublicStoreById(targetStoreId),
        fetchPublicStoreCatalogue(targetStoreId, { limit: 100 }),
      ]);

      if (activeStoreIdRef.current !== targetStoreId) return;

      if (storeRes?.success && storeRes?.data) {
        const s = storeRes.data;
        setStore(s);
        selectStore(s);
        setCartStore(s);
        setCatalogue(Array.isArray(catRes?.data) ? catRes.data : []);
      } else {
        throw new Error(storeRes?.message || 'Store not found');
      }
    } catch (err) {
      if (activeStoreIdRef.current !== targetStoreId) return;
      console.error('Error loading store or catalogue for cart review:', err);
      setStoreError(
        err.response?.status === 404
          ? 'Store not found. Please choose an active store from the directory.'
          : err.response?.data?.message || err.message || 'Error loading store'
      );
    } finally {
      if (activeStoreIdRef.current === targetStoreId) {
        setStoreLoading(false);
      }
    }
  }, [storeId, selectStore, setCartStore]);

  useEffect(() => {
    activeStoreIdRef.current = storeId;
    loadStoreData();
  }, [storeId, loadStoreData]);

  const handleRetry = () => {
    loadStoreData();
  };

  // Sync pricing on initial mount if items exist
  useEffect(() => {
    if (storeId && cartItems.length > 0) {
      syncWithBackendPricing(cartItems, storeId);
    }
  }, [storeId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Final Order Submission
  const handleConfirmAndPlaceOrder = async (e) => {
    e.preventDefault();
    if (cartItems.length === 0) {
      setSubmitError('Your cart is empty. Add items from the catalogue or voice order first.');
      return;
    }

    if (unresolvedItems.length > 0) {
      setSubmitError('Please resolve or dismiss all unmatched items before confirming your order.');
      return;
    }

    if (!store?.isOpen) {
      setSubmitError('This store is currently closed and not accepting in-store pickup orders.');
      return;
    }

    if (!customerName.trim() || customerPhone.trim().length !== 10) {
      setSubmitError('Please provide your name and a valid 10-digit mobile phone number.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const payload = {
        storeId,
        idempotencyKey: idempotencyKeyRef.current,
        confirmationToken: confirmationSecretRef.current,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        notes: notes.trim() || undefined,
        source: 'VOICE',
        items: cartItems.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unit: item.unit || item.catalogUnit,
        })),
      };

      const response = await submitCustomerOrder(payload);

      if (response?.success && response?.data) {
        const createdOrder = response.data;
        const token = createdOrder.confirmationToken || confirmationSecretRef.current;

        // Clear shopping cart on successful placement
        clearCart();

        // Navigate to confirmation page with URL fragment #token=...
        navigate(
          `/orders/${createdOrder.id}/confirmation${token ? `#token=${encodeURIComponent(token)}` : ''}`,
          {
            state: { order: createdOrder, token },
          }
        );
      } else {
        throw new Error(response?.message || 'Failed to submit order');
      }
    } catch (err) {
      console.error('Order submission failed:', err);
      const apiMsg = err.response?.data?.message || err.message || 'Failed to submit order.';
      setSubmitError(typeof apiMsg === 'string' ? apiMsg : JSON.stringify(apiMsg));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (storeLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-500 space-y-3">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-sm font-medium">Verifying store and cart pricing...</p>
      </div>
    );
  }

  if (storeError || !store) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">Connection Failed</h2>
        <p className="text-sm text-slate-600">{storeError || 'The store could not be found.'}</p>
        <div className="pt-4 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={handleRetry}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-colors shadow-sm"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Retry Connection</span>
          </button>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium text-sm transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Browse Available Stores</span>
          </Link>
        </div>
      </div>
    );
  }

  const isOrderButtonDisabled =
    cartItems.length === 0 ||
    unresolvedItems.length > 0 ||
    !store.isOpen ||
    isCalculatingPricing ||
    Boolean(pricingError) ||
    !customerName.trim() ||
    customerPhone.trim().length !== 10 ||
    isSubmitting;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      {/* Navigation & Header */}
      <div className="flex items-center justify-between">
        <Link
          to={`/stores/${store.id}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to {store.name} Catalogue</span>
        </Link>

        <Link
          to={`/stores/${store.id}/order`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200"
        >
          <Mic className="w-3.5 h-3.5" />
          <span>Add More Items via Voice</span>
        </Link>
      </div>

      {/* Selected Store Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 to-blue-950 text-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                store.isOpen
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                  : 'bg-red-500/20 text-red-300 border border-red-400/30'
              }`}
            >
              {store.isOpen ? 'Open for Pickup' : 'Store Closed'}
            </span>
            <span className="text-xs text-blue-200">Reviewing Cart for:</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold">{store.name}</h1>
          <p className="text-xs text-slate-300 flex items-center gap-1 mt-1">
            <MapPin className="w-3.5 h-3.5 text-slate-400" />
            <span>
              {store.address}, {store.city} — {store.pincode}
            </span>
          </p>
        </div>

        <div className="text-right">
          <span className="text-xs text-blue-200 block">Server-Verified Subtotal</span>
          <span className="text-2xl font-extrabold text-white">₹{cartSubtotal}</span>
        </div>
      </div>

      {/* Closed Store Warning */}
      {!store.isOpen && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 text-amber-900 text-xs">
          <Clock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-sm">Store is Currently Closed</p>
            <p className="mt-0.5 text-amber-800">
              {store.name} is not accepting orders at this time. You can still review your cart, but the
              order cannot be submitted until the store opens.
            </p>
          </div>
        </div>
      )}

      {/* Pricing / Validation Error */}
      {pricingError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center justify-between text-red-700 text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{pricingError}</span>
          </div>
          <button
            onClick={() => syncWithBackendPricing(cartItems, storeId)}
            className="px-3 py-1 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700"
          >
            Retry Pricing
          </button>
        </div>
      )}

      {/* Section 1: Unresolved Items Warning & Resolution */}
      {unresolvedItems.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-700 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-bold text-amber-900">
                Unmatched Voice Items ({unresolvedItems.length})
              </h3>
              <p className="text-xs text-amber-800">
                The following items from your voice recording could not be matched automatically. Please
                select a matching catalogue item or dismiss them to proceed with checkout.
              </p>
            </div>
          </div>

          <div className="space-y-2 pt-1">
            {unresolvedItems.map((unItem, idx) => (
              <div
                key={idx}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-white rounded-xl border border-amber-200 text-xs"
              >
                <div>
                  <span className="font-semibold text-slate-800">&ldquo;{unItem.originalText}&rdquo;</span>
                  <p className="text-slate-500 mt-0.5">
                    {unItem.clarificationReason || 'Item not recognized in store catalogue.'}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      const prod = catalogue.find((p) => p.id === e.target.value);
                      if (prod) {
                        resolveUnresolvedItem(idx, prod);
                      }
                    }}
                    className="p-1.5 rounded-lg border border-slate-300 text-xs text-slate-700 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="" disabled>
                      + Match from {store.name} catalogue...
                    </option>
                    {catalogue.map((prod) => (
                      <option key={prod.id} value={prod.id}>
                        {prod.name} ({prod.unit}) — ₹{prod.price}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => removeUnresolvedItem(idx)}
                    className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg transition-colors"
                    title="Dismiss item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Clarifications / Questions from AI */}
      {clarifications.length > 0 && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl text-blue-900 text-xs space-y-1">
          <div className="flex items-center gap-2 font-bold">
            <HelpCircle className="w-4 h-4 text-blue-600" />
            <span>Order Clarifications Note</span>
          </div>
          <ul className="list-disc list-inside text-blue-800 space-y-0.5 pl-1">
            {clarifications.map((q, idx) => (
              <li key={idx}>{q}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Section 2: Review Cart Items */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
              <ShoppingBag className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-800">
                Review Cart Items ({cartItems.length})
              </h2>
              <p className="text-xs text-slate-500">
                Grounded strictly in {store.name}&apos;s live database catalogue
              </p>
            </div>
          </div>

          {cartItems.length > 0 && (
            <button
              onClick={clearCart}
              className="text-xs text-red-600 hover:text-red-800 font-medium px-2.5 py-1 rounded-lg hover:bg-red-50 transition-colors"
            >
              Clear Cart
            </button>
          )}
        </div>

        <div className="p-5">
          {cartItems.length === 0 ? (
            <div className="py-12 text-center text-slate-500 space-y-3">
              <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="font-bold text-slate-800 text-base">Your Cart is Empty</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                You haven&apos;t added any items yet. Browse {store.name}&apos;s catalogue or use
                voice ordering to speak an order.
              </p>
              <div className="pt-2 flex items-center justify-center gap-3">
                <Link
                  to={`/stores/${store.id}`}
                  className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700"
                >
                  Browse Catalogue
                </Link>
                <Link
                  to={`/stores/${store.id}/order`}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200"
                >
                  Voice Order
                </Link>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {cartItems.map((item, idx) => (
                <div
                  key={idx}
                  className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <h4 className="font-semibold text-slate-800 text-sm">{item.productName}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Rate: ₹{item.unitPrice} per {item.catalogUnit || item.unit}
                      {item.conversionNote && (
                        <span className="text-blue-600 ml-2 font-medium">({item.conversionNote})</span>
                      )}
                    </p>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-6">
                    {/* Quantity controls */}
                    <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.productId, -1)}
                        className="p-1.5 text-slate-600 hover:bg-slate-200 transition-colors disabled:opacity-40"
                        disabled={isCalculatingPricing}
                        title="Decrease quantity"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="px-3 py-1 text-xs font-semibold text-slate-800 min-w-[3.5rem] text-center">
                        {item.quantity} {item.unit || item.catalogUnit}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.productId, 1)}
                        className="p-1.5 text-slate-600 hover:bg-slate-200 transition-colors disabled:opacity-40"
                        disabled={isCalculatingPricing}
                        title="Increase quantity"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Line Total */}
                    <div className="text-right min-w-[5.5rem]">
                      <span className="text-sm font-bold text-slate-900">₹{item.lineTotal}</span>
                    </div>

                    {/* Remove Item */}
                    <button
                      type="button"
                      onClick={() => removeFromCart(item.productId)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Remove product"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Section 3: Customer Pickup Details & Final Confirmation Form */}
      {cartItems.length > 0 && (
        <form
          onSubmit={handleConfirmAndPlaceOrder}
          className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-5"
        >
          <div>
            <h3 className="text-base font-bold text-slate-800">In-Store Pickup Customer Details</h3>
            <p className="text-xs text-slate-500">
              Provide your name and contact number for pickup verification at {store.name}.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Your Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g. Ramesh Kumar"
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mobile Number (10 Digits) <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                required
                pattern="[0-9]{10}"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="e.g. 9876543210"
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Pickup Instructions / Notes (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Will pick up around 6:30 PM, please pack in one bag"
              className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Payment Notice */}
          <div className="p-4 rounded-xl bg-blue-50/80 border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-blue-950">
            <div className="space-y-0.5">
              <span className="font-bold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                <span>Zero Online Payment Required Now</span>
              </span>
              <p className="text-blue-800">
                You pay at {store.name}&apos;s counter during in-store pickup via Cash or UPI.
              </p>
            </div>
            <span className="px-3 py-1 bg-white font-bold rounded-lg border border-blue-200 text-blue-700 whitespace-nowrap self-start sm:self-center">
              CASH / UPI ON PICKUP
            </span>
          </div>

          {/* Submission Error Banner */}
          {submitError && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Pricing Calculation in Flight */}
          {isCalculatingPricing && (
            <div className="flex items-center gap-2 text-xs text-blue-600">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Syncing prices with store catalogue...</span>
            </div>
          )}

          {/* Order Summary & Final Submission Button */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100">
            <div>
              <span className="text-xs text-slate-500 block">Total Payable at Pickup</span>
              <span className="text-2xl sm:text-3xl font-extrabold text-blue-900">
                ₹{cartSubtotal}
              </span>
            </div>

            <button
              type="submit"
              disabled={isOrderButtonDisabled}
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all transform active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              title={
                unresolvedItems.length > 0
                  ? 'Resolve all unmatched voice items first'
                  : !store.isOpen
                  ? 'Store is closed'
                  : 'Place order for in-store pickup'
              }
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Submitting to Store...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Confirm & Place Order</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default StoreCartReviewPage;

