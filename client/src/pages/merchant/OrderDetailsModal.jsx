import React, { useState } from 'react';
import {
  X,
  Phone,
  User,
  Clock,
  CheckCircle2,
  AlertCircle,
  Package,
  Printer,
  ChevronRight,
  CreditCard,
  Ban,
  Play,
  Check,
} from 'lucide-react';
import {
  acceptMerchantOrder,
  prepareMerchantOrder,
  markMerchantOrderReady,
} from '../../services/api.js';

export const OrderDetailsModal = ({
  order,
  onClose,
  onUpdateOrder,
  onOpenRejectModal,
  onOpenPaymentModal,
  onOpenPackingSlip,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);

  const handleAccept = async () => {
    try {
      setIsProcessing(true);
      setError(null);
      const res = await acceptMerchantOrder(order.id);
      if (res.success && res.data) {
        onUpdateOrder(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to accept order');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStartPrep = async () => {
    try {
      setIsProcessing(true);
      setError(null);
      const res = await prepareMerchantOrder(order.id);
      if (res.success && res.data) {
        onUpdateOrder(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to start preparation');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMarkReady = async () => {
    try {
      setIsProcessing(true);
      setError(null);
      const res = await markMerchantOrderReady(order.id);
      if (res.success && res.data) {
        onUpdateOrder(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to mark order ready');
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PENDING_APPROVAL':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
            <Clock className="w-3.5 h-3.5 animate-pulse text-amber-600" />
            <span>Pending Review</span>
          </span>
        );
      case 'ACCEPTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
            <span>Accepted</span>
          </span>
        );
      case 'PREPARING':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-300">
            <Package className="w-3.5 h-3.5 text-purple-600 animate-bounce" />
            <span>In Preparation</span>
          </span>
        );
      case 'READY_FOR_PICKUP':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <Check className="w-3.5 h-3.5 text-emerald-600" />
            <span>Ready for Pickup</span>
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-slate-600" />
            <span>Completed</span>
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300">
            <Ban className="w-3.5 h-3.5 text-red-600" />
            <span>Rejected</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800">
            {status}
          </span>
        );
    }
  };

  const isEligibleForPackingSlip = ['ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP', 'COMPLETED'].includes(order.status);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold text-slate-900 font-mono">
                {order.orderNumber}
              </h2>
              {getStatusBadge(order.status)}
            </div>
            <p className="text-[11px] text-slate-500 font-mono">
              Created on {new Date(order.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Customer Card */}
          <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200/80 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">Customer Details</span>
              <p className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                <User className="w-4 h-4 text-slate-500" />
                <span>{order.customer?.name || 'Customer'}</span>
              </p>
              {order.customer?.phone && (
                <a
                  href={`tel:${order.customer.phone}`}
                  className="text-xs font-mono font-semibold text-blue-700 hover:text-blue-900 flex items-center gap-1"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>+91 {order.customer.phone}</span>
                </a>
              )}
            </div>

            <div className="text-right">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Payment</span>
              <span
                className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold uppercase mt-1 ${
                  order.paymentStatus === 'PAID'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-amber-100 text-amber-800 border border-amber-300'
                }`}
              >
                {order.paymentStatus}
              </span>
              <p className="text-[10px] text-slate-500 mt-0.5 lowercase font-mono">
                {order.paymentMethod ? order.paymentMethod.replace(/_/g, ' ') : 'pay on pickup'}
              </p>
            </div>
          </div>

          {/* Rejection Notice */}
          {order.status === 'REJECTED' && order.rejectionReason && (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-900 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-xs text-red-800">
                <Ban className="w-4 h-4 text-red-600" />
                <span>Rejection Reason Shared with Customer:</span>
              </div>
              <p className="text-xs italic pl-5 text-red-700 font-medium">"{order.rejectionReason}"</p>
            </div>
          )}

          {/* Customer Pickup Notes */}
          {order.notes && (
            <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 text-amber-900 text-xs">
              <strong className="block text-[10px] uppercase tracking-wider font-bold text-amber-800 mb-0.5">
                Customer Instructions:
              </strong>
              "{order.notes}"
            </div>
          )}

          {/* Items Breakdown */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Ordered Items ({order.items?.length || 0})
            </h4>

            <div className="rounded-2xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
              {(order.items || []).map((item, idx) => (
                <div key={item.id || idx} className="p-3.5 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-bold text-slate-900">{item.productName}</p>
                    <p className="text-slate-500 font-mono text-[11px] mt-0.5">
                      {item.quantity} {item.unit} × ₹{item.unitPrice}
                    </p>
                  </div>
                  <span className="font-mono font-bold text-slate-900 text-sm">₹{item.lineTotal}</span>
                </div>
              ))}
            </div>

            {/* Total Footer */}
            <div className="p-3.5 rounded-xl bg-slate-900 text-white flex items-center justify-between font-mono">
              <span className="text-xs uppercase font-bold tracking-wider text-slate-300">Total Order Amount</span>
              <span className="text-lg font-black text-white">₹{order.subtotal}</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {isEligibleForPackingSlip && (
              <button
                type="button"
                onClick={() => onOpenPackingSlip(order.id)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-300 shadow-sm transition-colors cursor-pointer"
              >
                <Printer className="w-4 h-4 text-blue-600" />
                <span>Packing Slip</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* PENDING APPROVAL ACTIONS */}
            {order.status === 'PENDING_APPROVAL' && (
              <>
                <button
                  type="button"
                  onClick={() => onOpenRejectModal(order)}
                  disabled={isProcessing}
                  className="px-4 py-2 rounded-xl bg-white hover:bg-red-50 text-red-600 text-xs font-bold border border-red-300 transition-colors shadow-sm cursor-pointer"
                >
                  Reject Order
                </button>
                <button
                  type="button"
                  onClick={handleAccept}
                  disabled={isProcessing}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-colors cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Accept Order</span>
                </button>
              </>
            )}

            {/* ACCEPTED ACTIONS */}
            {order.status === 'ACCEPTED' && (
              <button
                type="button"
                onClick={handleStartPrep}
                disabled={isProcessing}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-sm transition-colors cursor-pointer"
              >
                <Play className="w-4 h-4" />
                <span>Start Preparation</span>
              </button>
            )}

            {/* PREPARING ACTIONS */}
            {order.status === 'PREPARING' && (
              <button
                type="button"
                onClick={handleMarkReady}
                disabled={isProcessing}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-colors cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Mark Ready for Pickup</span>
              </button>
            )}

            {/* READY FOR PICKUP ACTIONS */}
            {order.status === 'READY_FOR_PICKUP' && (
              <button
                type="button"
                onClick={() => onOpenPaymentModal(order)}
                disabled={isProcessing}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-colors cursor-pointer"
              >
                <CreditCard className="w-4 h-4" />
                <span>Collect Payment & Complete</span>
              </button>
            )}

            {/* COMPLETED / REJECTED / CANCELLED */}
            {['COMPLETED', 'REJECTED', 'CANCELLED'].includes(order.status) && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
              >
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderDetailsModal;

