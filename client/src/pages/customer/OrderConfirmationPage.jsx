import React, { useState, useEffect } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import {
  CheckCircle2,
  Clock,
  MapPin,
  ShoppingBag,
  Store,
  Printer,
  ArrowRight,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { fetchOrderById } from '../../services/api.js';

export const OrderConfirmationPage = () => {
  const { orderId } = useParams();
  const location = useLocation();

  // Extract confirmation token with priority:
  // 1. Router state (passed during direct SPA navigation)
  // 2. URL hash/fragment: #token=... (preserves bookmarking, hidden from server logs)
  // 3. Fallback for legacy bookmarks: ?token=...
  const [confirmationToken, setConfirmationToken] = useState(() => {
    if (location.state?.token) return location.state.token;

    const hash = location.hash || (typeof window !== 'undefined' ? window.location.hash : '');
    if (hash) {
      const cleanHash = hash.startsWith('#') ? hash.slice(1) : hash;
      const hashParams = new URLSearchParams(cleanHash);
      const token = hashParams.get('token');
      if (token) return token;
    }

    const searchParams = new URLSearchParams(location.search);
    return searchParams.get('token') || null;
  });

  // If a legacy query parameter (?token=...) is detected, migrate to URL hash and strip query param
  useEffect(() => {
    if (typeof window !== 'undefined' && location.search) {
      const searchParams = new URLSearchParams(location.search);
      const legacyToken = searchParams.get('token');
      if (legacyToken) {
        searchParams.delete('token');
        const remainingQuery = searchParams.toString();
        const cleanUrl = `${window.location.pathname}${remainingQuery ? `?${remainingQuery}` : ''}#token=${encodeURIComponent(legacyToken)}`;
        window.history.replaceState(null, '', cleanUrl);
        setConfirmationToken(legacyToken);
      }
    }
  }, [location.pathname, location.search]);

  const [order, setOrder] = useState(location.state?.order || null);
  const [loading, setLoading] = useState(!order);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchOrder = async (isBackground = false) => {
    if (!orderId) return;
    if (!isBackground) setLoading(true);
    else setIsRefreshing(true);
    setError(null);

    try {
      const res = await fetchOrderById(orderId, confirmationToken);
      if (res?.success && res?.data) {
        setOrder(res.data);
      } else {
        throw new Error(res?.message || 'Order not found');
      }
    } catch (err) {
      if (!isBackground) {
        setError(
          err.response?.status === 404
            ? 'Order reference not found. Please verify the order link.'
            : err.response?.status === 403
            ? 'Access to this order confirmation is unauthorized. A valid confirmation access token is required.'
            : err.response?.data?.message || err.message || 'Error loading order details'
        );
      }
    } finally {
      if (!isBackground) setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOrder(false);
  }, [orderId, confirmationToken]);

  // Sensible status auto-polling every 15s while order is awaiting review, accepted, or preparing
  useEffect(() => {
    const isTerminal = order && ['READY_FOR_PICKUP', 'COMPLETED', 'REJECTED', 'CANCELLED'].includes(order.status);
    if (isTerminal) return;

    const interval = setInterval(() => {
      fetchOrder(true);
    }, 15000);

    return () => clearInterval(interval);
  }, [order?.status, orderId, confirmationToken]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-500 space-y-3">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-sm font-medium">Loading order confirmation...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-md mx-auto py-16 px-4 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">Order Not Found</h2>
        <p className="text-sm text-slate-600">{error || 'Could not find the requested order details.'}</p>
        <div className="pt-2">
          <Link
            to="/stores"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white font-medium text-sm hover:bg-blue-700"
          >
            <span>Explore Stores</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20">
      {/* Success Hero Header */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-10 h-10" />
        </div>

        <div>
          <span
            className={`text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full border ${
              order.status === 'REJECTED'
                ? 'bg-red-50 text-red-700 border-red-200'
                : order.status === 'READY_FOR_PICKUP'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : order.status === 'COMPLETED'
                ? 'bg-slate-50 text-slate-700 border-slate-200'
                : 'bg-blue-50 text-blue-700 border-blue-200'
            }`}
          >
            {order.status === 'REJECTED'
              ? 'Order Rejected'
              : order.status === 'READY_FOR_PICKUP'
              ? 'Ready for Collection'
              : order.status === 'COMPLETED'
              ? 'Order Completed'
              : 'Order Placed'}
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2">
            {order.status === 'REJECTED'
              ? 'Order Could Not Be Fulfilled'
              : order.status === 'READY_FOR_PICKUP'
              ? 'Your Order is Ready for Pickup!'
              : order.status === 'COMPLETED'
              ? 'Order Collected & Completed'
              : 'Your Order Has Been Placed!'}
          </h1>
          <p className="text-sm text-slate-500 mt-1 font-mono">
            Reference Number: <span className="font-bold text-slate-800">{order.orderNumber}</span>
          </p>
        </div>

        {/* Status Badges */}
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
          {order.status === 'PENDING_APPROVAL' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-300">
              <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
              <span>Status: Awaiting Shopkeeper Approval</span>
            </span>
          )}

          {order.status === 'ACCEPTED' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-300">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
              <span>Status: Accepted by Shopkeeper</span>
            </span>
          )}

          {order.status === 'PREPARING' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-800 border border-purple-300">
              <ShoppingBag className="w-3.5 h-3.5 text-purple-600 animate-bounce" />
              <span>Status: Store is Packing Your Items</span>
            </span>
          )}

          {order.status === 'READY_FOR_PICKUP' && (
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-sm animate-pulse">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Status: Ready for Pickup! Collect from Store</span>
            </span>
          )}

          {order.status === 'COMPLETED' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-300">
              <CheckCircle2 className="w-3.5 h-3.5 text-slate-600" />
              <span>Status: Order Completed</span>
            </span>
          )}

          {order.status === 'REJECTED' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-300">
              <AlertCircle className="w-3.5 h-3.5 text-red-600" />
              <span>Status: Order Rejected</span>
            </span>
          )}

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200">
            <span>Payment: {order.paymentStatus === 'PAID' ? 'Paid at Store' : `Pay at Store on Pickup (${order.paymentStatus || 'UNPAID'})`}</span>
          </span>

          <button
            onClick={() => fetchOrder(true)}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-full transition-colors cursor-pointer"
            title="Refresh Order Status"
          >
            <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
            <span>{isRefreshing ? 'Checking...' : 'Refresh'}</span>
          </button>
        </div>

        {/* Status Context Notice */}
        {order.status === 'PENDING_APPROVAL' && (
          <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 text-left text-xs text-amber-900 space-y-1 mt-4">
            <p className="font-bold flex items-center gap-1.5 text-amber-800">
              <Clock className="w-4 h-4 flex-shrink-0" />
              <span>Order Review in Progress</span>
            </p>
            <p className="text-amber-800 leading-relaxed">
              Your order has been forwarded to the shopkeeper with status <strong>PENDING APPROVAL</strong>. The shopkeeper will manually review and accept your order before packing items. Payment will be collected in-person via Cash or UPI when you arrive for pickup.
            </p>
          </div>
        )}

        {order.status === 'ACCEPTED' && (
          <div className="p-4 rounded-2xl bg-blue-50/80 border border-blue-200 text-left text-xs text-blue-900 space-y-1 mt-4">
            <p className="font-bold flex items-center gap-1.5 text-blue-800">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>Order Accepted by Store</span>
            </p>
            <p className="text-blue-800 leading-relaxed">
              Good news! The shopkeeper has accepted your grocery order. Store staff will begin gathering and packing your items shortly.
            </p>
          </div>
        )}

        {order.status === 'PREPARING' && (
          <div className="p-4 rounded-2xl bg-purple-50/80 border border-purple-200 text-left text-xs text-purple-900 space-y-1 mt-4">
            <p className="font-bold flex items-center gap-1.5 text-purple-800">
              <ShoppingBag className="w-4 h-4 flex-shrink-0 text-purple-600" />
              <span>Items Being Packed</span>
            </p>
            <p className="text-purple-800 leading-relaxed">
              The shopkeeper is currently weighing and packing your items into store bags. We will update the status to <strong>READY FOR PICKUP</strong> as soon as packing is complete!
            </p>
          </div>
        )}

        {order.status === 'READY_FOR_PICKUP' && (
          <div className="p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-300 text-left text-xs text-emerald-900 space-y-1 mt-4 shadow-sm">
            <p className="font-bold flex items-center gap-1.5 text-emerald-800 text-sm">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
              <span>Ready for In-Store Pickup!</span>
            </p>
            <p className="text-emerald-800 leading-relaxed">
              Your order has been packed and is ready at the counter! Please visit <strong>{order.store?.name}</strong> to collect your items. You can pay via Cash or UPI upon pickup.
            </p>
          </div>
        )}

        {order.status === 'COMPLETED' && (
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-left text-xs text-slate-800 space-y-1 mt-4">
            <p className="font-bold flex items-center gap-1.5 text-slate-900">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
              <span>Order Completed</span>
            </p>
            <p className="text-slate-600 leading-relaxed">
              This order was collected and marked completed. Thank you for supporting your local kirana store with CallSaar!
            </p>
          </div>
        )}

        {order.status === 'REJECTED' && (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-left text-xs text-red-900 space-y-1 mt-4">
            <p className="font-bold flex items-center gap-1.5 text-red-800 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600" />
              <span>Order Could Not Be Accepted</span>
            </p>
            <p className="text-red-800 leading-relaxed">
              The store was unable to fulfill your order.
              {order.rejectionReason && (
                <span className="block mt-1 font-semibold italic">
                  Store note: "{order.rejectionReason}"
                </span>
              )}
            </p>
          </div>
        )}
      </div>

      {/* Store Location & Pickup Details */}
      {order.store && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
            <Store className="w-4 h-4 text-blue-600" />
            <span>Pickup Store Details</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-slate-900">{order.store.name}</h3>
              <p className="text-xs text-slate-600 flex items-center gap-1 mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <span>
                  {order.store.address}, {order.store.city} — {order.store.pincode}
                </span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Order Items Breakdown */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
            <ShoppingBag className="w-4 h-4 text-emerald-600" />
            <span>Ordered Items ({order.items?.length || 0})</span>
          </div>
          <span className="text-xs text-slate-400">Server Verified</span>
        </div>

        <div className="divide-y divide-slate-100 text-sm">
          {order.items?.map((item, idx) => (
            <div key={idx} className="py-3 flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-slate-800">{item.productName}</p>
                <p className="text-xs text-slate-500">
                  {item.quantity} {item.unit} @ ₹{item.unitPrice} per unit
                </p>
              </div>
              <span className="font-bold text-slate-900">₹{item.lineTotal}</span>
            </div>
          ))}
        </div>

        {/* Subtotal Footer */}
        <div className="border-t border-slate-200 pt-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 block">Total Amount to Pay</span>
            <span className="text-xs text-slate-400 font-medium">In-store Cash or UPI</span>
          </div>
          <span className="text-2xl font-extrabold text-blue-900">₹{order.subtotal}</span>
        </div>
      </div>

      {/* Customer Info Card if available */}
      {order.customer?.name && (
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center justify-between text-xs text-slate-600">
          <div>
            <span className="text-slate-400 block font-medium">Customer Name</span>
            <span className="font-bold text-slate-800 text-sm">{order.customer.name}</span>
          </div>
          {order.notes && (
            <div className="text-right max-w-xs">
              <span className="text-slate-400 block font-medium">Pickup Notes</span>
              <span className="italic text-slate-700">{order.notes}</span>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={() => window.print()}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs transition-colors shadow-sm"
        >
          <Printer className="w-4 h-4" />
          <span>Print / Save Receipt</span>
        </button>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {order.store?.id && (
            <Link
              to={`/stores/${order.store.id}`}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 hover:border-slate-300 text-slate-700 font-medium text-xs transition-colors"
            >
              <span>Store Catalogue</span>
            </Link>
          )}

          <Link
            to="/stores"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow transition-colors"
          >
            <span>Explore Stores</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default OrderConfirmationPage;

