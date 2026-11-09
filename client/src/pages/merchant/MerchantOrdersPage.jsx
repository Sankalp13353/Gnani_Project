import React, { useState, useEffect, useCallback } from 'react';
import {
  ClipboardList,
  Clock,
  CheckCircle2,
  Package,
  Check,
  Search,
  Filter,
  RefreshCw,
  Printer,
  ChevronRight,
  AlertCircle,
  Eye,
  CreditCard,
  Ban,
  ArrowUpDown,
  ShoppingBag,
} from 'lucide-react';
import {
  fetchMerchantOrders,
  fetchMerchantOrderSummary,
  acceptMerchantOrder,
  prepareMerchantOrder,
  markMerchantOrderReady,
} from '../../services/api.js';
import { OrderDetailsModal } from './OrderDetailsModal.jsx';
import { PackingSlipModal } from './PackingSlipModal.jsx';
import { RejectOrderModal } from './RejectOrderModal.jsx';
import { RecordPaymentModal } from './RecordPaymentModal.jsx';

export const MerchantOrdersPage = () => {
  const [orders, setOrders] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Filters & Search
  const [activeTab, setActiveTab] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, totalOrders: 0, totalPages: 1 });

  // Modal States
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderForReject, setOrderForReject] = useState(null);
  const [orderForPayment, setOrderForPayment] = useState(null);
  const [packingSlipOrderId, setPackingSlipOrderId] = useState(null);

  // Load orders and summary from backend
  const loadData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setIsRefreshing(true);
      setError(null);

      const params = {
        page,
        limit: 20,
        ...(activeTab !== 'ALL' && { status: activeTab }),
        ...(searchQuery.trim().length > 0 && { search: searchQuery.trim() }),
      };

      const [ordersRes, summaryRes] = await Promise.all([
        fetchMerchantOrders(params),
        fetchMerchantOrderSummary(),
      ]);

      if (ordersRes.success && ordersRes.data) {
        setOrders(ordersRes.data);
        if (ordersRes.pagination) setPagination(ordersRes.pagination);
      }

      if (summaryRes.success && summaryRes.data) {
        setSummary(summaryRes.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error loading store orders');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [activeTab, searchQuery, page]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Sensible auto-polling every 15 seconds to receive new customer orders in real time
  useEffect(() => {
    const interval = setInterval(() => {
      loadData(true);
    }, 15000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Quick Action Handlers
  const handleQuickAccept = async (orderId) => {
    try {
      const res = await acceptMerchantOrder(orderId);
      if (res.success && res.data) {
        setOrders((prev) => prev.map((o) => (o.id === orderId ? res.data : o)));
        if (selectedOrder?.id === orderId) setSelectedOrder(res.data);
        loadData(true);
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to accept order');
    }
  };

  const handleQuickPrepare = async (orderId) => {
    try {
      const res = await prepareMerchantOrder(orderId);
      if (res.success && res.data) {
        setOrders((prev) => prev.map((o) => (o.id === orderId ? res.data : o)));
        if (selectedOrder?.id === orderId) setSelectedOrder(res.data);
        loadData(true);
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to start preparation');
    }
  };

  const handleQuickReady = async (orderId) => {
    try {
      const res = await markMerchantOrderReady(orderId);
      if (res.success && res.data) {
        setOrders((prev) => prev.map((o) => (o.id === orderId ? res.data : o)));
        if (selectedOrder?.id === orderId) setSelectedOrder(res.data);
        loadData(true);
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to mark order ready');
    }
  };

  const handleOrderUpdated = (updated) => {
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    if (selectedOrder?.id === updated.id) {
      setSelectedOrder(updated);
    }
    loadData(true);
  };

  const tabs = [
    { id: 'ALL', label: 'All Orders', count: summary?.all ?? 0 },
    { id: 'PENDING_APPROVAL', label: 'Pending Review', count: summary?.PENDING_APPROVAL ?? 0, highlight: true },
    { id: 'ACCEPTED', label: 'Accepted', count: summary?.ACCEPTED ?? 0 },
    { id: 'PREPARING', label: 'In Prep', count: summary?.PREPARING ?? 0 },
    { id: 'READY_FOR_PICKUP', label: 'Ready', count: summary?.READY_FOR_PICKUP ?? 0 },
    { id: 'COMPLETED', label: 'Completed', count: summary?.COMPLETED ?? 0 },
    { id: 'REJECTED', label: 'Rejected', count: summary?.REJECTED ?? 0 },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Order Management</h1>
            <span className="text-[11px] font-bold bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              Phase F
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Review incoming customer voice orders, accept/reject, print packing slips, and complete in-store collections.
          </p>
        </div>

        <button
          onClick={() => loadData(false)}
          disabled={loading || isRefreshing}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-sm transition-colors cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>{isRefreshing ? 'Refreshing...' : 'Refresh Orders'}</span>
        </button>
      </div>

      {/* Summary KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Pending Card */}
        <div
          onClick={() => setActiveTab('PENDING_APPROVAL')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeTab === 'PENDING_APPROVAL'
              ? 'bg-amber-500 text-white border-amber-600 shadow-md ring-2 ring-amber-400/40'
              : 'bg-amber-50/80 border-amber-200 text-amber-900 hover:bg-amber-100/70'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold opacity-80">
            <span>Pending Review</span>
            <Clock className="w-4 h-4 animate-pulse" />
          </div>
          <p className="text-2xl font-black mt-2 font-mono">{summary?.PENDING_APPROVAL ?? 0}</p>
          <span className="text-[10px] font-medium opacity-75">Action required</span>
        </div>

        {/* Accepted Card */}
        <div
          onClick={() => setActiveTab('ACCEPTED')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeTab === 'ACCEPTED'
              ? 'bg-blue-600 text-white border-blue-700 shadow-md ring-2 ring-blue-400/40'
              : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>Accepted</span>
            <CheckCircle2 className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-black mt-2 font-mono">{summary?.ACCEPTED ?? 0}</p>
          <span className="text-[10px] text-slate-400">Ready to pack</span>
        </div>

        {/* Preparing Card */}
        <div
          onClick={() => setActiveTab('PREPARING')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeTab === 'PREPARING'
              ? 'bg-purple-600 text-white border-purple-700 shadow-md ring-2 ring-purple-400/40'
              : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>In Prep</span>
            <Package className="w-4 h-4 text-purple-500" />
          </div>
          <p className="text-2xl font-black mt-2 font-mono">{summary?.PREPARING ?? 0}</p>
          <span className="text-[10px] text-slate-400">Currently packing</span>
        </div>

        {/* Ready for Pickup Card */}
        <div
          onClick={() => setActiveTab('READY_FOR_PICKUP')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeTab === 'READY_FOR_PICKUP'
              ? 'bg-emerald-600 text-white border-emerald-700 shadow-md ring-2 ring-emerald-400/40'
              : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>Ready</span>
            <Check className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black mt-2 font-mono">{summary?.READY_FOR_PICKUP ?? 0}</p>
          <span className="text-[10px] text-slate-400">Awaiting pickup</span>
        </div>

        {/* Completed Card */}
        <div
          onClick={() => setActiveTab('COMPLETED')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeTab === 'COMPLETED'
              ? 'bg-slate-800 text-white border-slate-900 shadow-md'
              : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>Completed</span>
            <CheckCircle2 className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-black mt-2 font-mono">{summary?.COMPLETED ?? 0}</p>
          <span className="text-[10px] text-slate-400">Collected & paid</span>
        </div>

        {/* Total Orders Card */}
        <div
          onClick={() => setActiveTab('ALL')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeTab === 'ALL'
              ? 'bg-blue-900 text-white border-blue-950 shadow-md'
              : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>Total Orders</span>
            <ShoppingBag className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-black mt-2 font-mono">{summary?.all ?? 0}</p>
          <span className="text-[10px] text-slate-400">Store lifetime</span>
        </div>
      </div>

      {/* Filter Tabs & Search Controls */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Scrollable Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                    isActive
                      ? tab.highlight
                        ? 'bg-amber-500 text-white shadow-sm'
                        : 'bg-slate-900 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by order #..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Orders List / Table */}
      {loading ? (
        <div className="bg-white rounded-3xl p-16 text-center border border-slate-200 shadow-sm space-y-3">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs text-slate-500 font-medium">Loading store orders...</p>
        </div>
      ) : error ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-red-200 shadow-sm space-y-3">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
          <h3 className="text-sm font-bold text-slate-900">Error Loading Orders</h3>
          <p className="text-xs text-red-600">{error}</p>
          <button
            onClick={() => loadData(false)}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 cursor-pointer"
          >
            Try Again
          </button>
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-3xl p-16 text-center border border-slate-200 shadow-sm space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <ClipboardList className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">No Orders Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchQuery
              ? `No orders matched "${searchQuery}". Try searching with a different order number.`
              : activeTab !== 'ALL'
              ? `There are currently no orders in status "${activeTab}".`
              : 'You have not received any orders yet. Customer voice orders will appear here automatically.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const isPending = order.status === 'PENDING_APPROVAL';
            const isAccepted = order.status === 'ACCEPTED';
            const isPreparing = order.status === 'PREPARING';
            const isReady = order.status === 'READY_FOR_PICKUP';
            const isCanPrint = ['ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP', 'COMPLETED'].includes(order.status);

            return (
              <div
                key={order.id}
                className={`bg-white rounded-2xl border p-4 sm:p-5 shadow-sm transition-all hover:shadow-md ${
                  isPending
                    ? 'border-amber-300 ring-2 ring-amber-400/20 bg-amber-50/20'
                    : 'border-slate-200'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  {/* Left: Metadata */}
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-bold text-sm text-slate-900">{order.orderNumber}</span>

                      {/* Status Badge */}
                      {isPending && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          <Clock className="w-3 h-3 animate-pulse text-amber-600" />
                          <span>Needs Approval</span>
                        </span>
                      )}
                      {isAccepted && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800">
                          <span>Accepted</span>
                        </span>
                      )}
                      {isPreparing && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800">
                          <span>In Prep</span>
                        </span>
                      )}
                      {isReady && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                          <span>Ready for Pickup</span>
                        </span>
                      )}
                      {order.status === 'COMPLETED' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">
                          <span>Completed</span>
                        </span>
                      )}
                      {order.status === 'REJECTED' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-800">
                          <span>Rejected</span>
                        </span>
                      )}

                      {/* Payment Badge */}
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase font-mono ${
                          order.paymentStatus === 'PAID'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {order.paymentStatus}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-xs text-slate-600">
                      <span>Customer: <strong className="text-slate-900">{order.customer?.name || 'Customer'}</strong></span>
                      {order.customer?.phone && (
                        <>
                          <span className="text-slate-300">•</span>
                          <span className="font-mono text-slate-700">+91 {order.customer.phone}</span>
                        </>
                      )}
                      <span className="text-slate-300">•</span>
                      <span>
                        {order.itemsCount || order.items?.length || 0} items
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="font-mono text-slate-500">
                        {new Date(order.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {order.notes && (
                      <p className="text-[11px] text-amber-800 italic line-clamp-1">
                        Note: "{order.notes}"
                      </p>
                    )}
                  </div>

                  {/* Middle: Subtotal */}
                  <div className="sm:text-right flex items-center sm:block justify-between pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Subtotal</span>
                    <span className="text-lg font-black text-slate-900 font-mono">₹{order.subtotal}</span>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-auto justify-end">
                    {/* Packing Slip Button */}
                    {isCanPrint && (
                      <button
                        type="button"
                        onClick={() => setPackingSlipOrderId(order.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                        title="View & Print Packing Slip"
                      >
                        <Printer className="w-3.5 h-3.5 text-blue-600" />
                        <span className="hidden sm:inline">Slip</span>
                      </button>
                    )}

                    {/* Pending Actions */}
                    {isPending && (
                      <>
                        <button
                          type="button"
                          onClick={() => setOrderForReject(order)}
                          className="px-3 py-1.5 rounded-xl bg-white hover:bg-red-50 text-red-600 border border-red-200 text-xs font-bold transition-colors cursor-pointer"
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickAccept(order.id)}
                          className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-colors cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Accept</span>
                        </button>
                      </>
                    )}

                    {/* Accepted Actions */}
                    {isAccepted && (
                      <button
                        type="button"
                        onClick={() => handleQuickPrepare(order.id)}
                        className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-sm transition-colors cursor-pointer"
                      >
                        <span>Start Prep</span>
                      </button>
                    )}

                    {/* Preparing Actions */}
                    {isPreparing && (
                      <button
                        type="button"
                        onClick={() => handleQuickReady(order.id)}
                        className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-colors cursor-pointer"
                      >
                        <span>Mark Ready</span>
                      </button>
                    )}

                    {/* Ready Actions */}
                    {isReady && (
                      <button
                        type="button"
                        onClick={() => setOrderForPayment(order)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-colors cursor-pointer"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        <span>Collect & Complete</span>
                      </button>
                    )}

                    {/* View Details */}
                    <button
                      type="button"
                      onClick={() => setSelectedOrder(order)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition-colors cursor-pointer"
                    >
                      <span>Details</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-slate-200 text-xs text-slate-600">
          <p>
            Showing Page <strong>{pagination.page}</strong> of <strong>{pagination.totalPages}</strong> ({pagination.totalOrders} total)
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={pagination.page <= 1}
              className="px-3 py-1.5 rounded-lg border border-slate-300 disabled:opacity-40 hover:bg-slate-50 font-semibold"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={pagination.page >= pagination.totalPages}
              className="px-3 py-1.5 rounded-lg border border-slate-300 disabled:opacity-40 hover:bg-slate-50 font-semibold"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {selectedOrder && (
        <OrderDetailsModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onUpdateOrder={handleOrderUpdated}
          onOpenRejectModal={(ord) => setOrderForReject(ord)}
          onOpenPaymentModal={(ord) => setOrderForPayment(ord)}
          onOpenPackingSlip={(id) => setPackingSlipOrderId(id)}
        />
      )}

      {packingSlipOrderId && (
        <PackingSlipModal
          orderId={packingSlipOrderId}
          onClose={() => setPackingSlipOrderId(null)}
        />
      )}

      {orderForReject && (
        <RejectOrderModal
          order={orderForReject}
          onClose={() => setOrderForReject(null)}
          onSuccess={(updated) => {
            setOrderForReject(null);
            handleOrderUpdated(updated);
          }}
        />
      )}

      {orderForPayment && (
        <RecordPaymentModal
          order={orderForPayment}
          storeUpiId={orderForPayment.store?.upiId}
          onClose={() => setOrderForPayment(null)}
          onSuccess={(updated) => {
            setOrderForPayment(null);
            handleOrderUpdated(updated);
          }}
        />
      )}
    </div>
  );
};

export default MerchantOrdersPage;

