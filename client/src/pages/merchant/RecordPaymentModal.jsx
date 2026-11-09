import React, { useState } from 'react';
import { CreditCard, CheckCircle2, Banknote, QrCode, X, AlertCircle } from 'lucide-react';
import { recordMerchantOrderPayment, completeMerchantOrder } from '../../services/api.js';

export const RecordPaymentModal = ({ order, storeUpiId, onClose, onSuccess }) => {
  const [paymentMethod, setPaymentMethod] = useState(order.paymentMethod || 'CASH_ON_PICKUP');
  const [alsoComplete, setAlsoComplete] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setError(null);

      let updatedOrder;
      if (alsoComplete) {
        // Complete atomically with payment method
        const res = await completeMerchantOrder(order.id, paymentMethod);
        if (res.success && res.data) {
          updatedOrder = res.data;
        } else {
          throw new Error(res.message || 'Failed to complete order');
        }
      } else {
        // Only record payment
        const res = await recordMerchantOrderPayment(order.id, paymentMethod);
        if (res.success && res.data) {
          updatedOrder = res.data;
        } else {
          throw new Error(res.message || 'Failed to record payment');
        }
      }

      onSuccess(updatedOrder);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error processing payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-emerald-50 border-b border-emerald-100 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-emerald-900">
            <CreditCard className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-sm">Record In-Store Payment</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Order Summary Pill */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                {order.orderNumber}
              </p>
              <p className="text-xs font-bold text-slate-800">{order.customer?.name || 'Customer'}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Amount Due</p>
              <p className="text-lg font-black text-slate-900 font-mono">₹{order.subtotal}</p>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Payment Method Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700">Select Collection Method:</label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setPaymentMethod('CASH_ON_PICKUP')}
                className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
                  paymentMethod === 'CASH_ON_PICKUP'
                    ? 'border-emerald-600 bg-emerald-50/60 text-emerald-900 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-xs">
                  <Banknote className="w-4 h-4 text-emerald-600" />
                  <span>Cash on Pickup</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Physical currency collected at counter</p>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('UPI_AT_STORE')}
                className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
                  paymentMethod === 'UPI_AT_STORE'
                    ? 'border-emerald-600 bg-emerald-50/60 text-emerald-900 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-xs">
                  <QrCode className="w-4 h-4 text-emerald-600" />
                  <span>Store UPI</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Scanned store QR ({storeUpiId || 'UPI'})
                </p>
              </button>
            </div>
          </div>

          {/* Also Mark Completed Checkbox */}
          {order.status === 'READY_FOR_PICKUP' && (
            <label className="flex items-center gap-2.5 p-3 rounded-xl bg-blue-50/70 border border-blue-200 cursor-pointer text-xs text-blue-900 select-none">
              <input
                type="checkbox"
                checked={alsoComplete}
                onChange={(e) => setAlsoComplete(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
              />
              <span className="font-medium">
                Customer has collected items — also mark order as <strong>COMPLETED</strong>
              </span>
            </label>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg transition-colors shadow-sm cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {isSubmitting
                  ? 'Recording...'
                  : alsoComplete && order.status === 'READY_FOR_PICKUP'
                  ? 'Confirm Payment & Complete'
                  : 'Confirm Payment Received'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RecordPaymentModal;

