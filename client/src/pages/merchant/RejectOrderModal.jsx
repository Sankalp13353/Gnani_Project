import React, { useState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { rejectMerchantOrder } from '../../services/api.js';

export const RejectOrderModal = ({ order, onClose, onSuccess }) => {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason || reason.trim().length < 2) {
      setError('Please provide a valid rejection reason (minimum 2 characters).');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      const res = await rejectMerchantOrder(order.id, reason.trim());
      if (res.success) {
        onSuccess(res.data);
      } else {
        throw new Error(res.message || 'Failed to reject order');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error rejecting order');
    } finally {
      setIsSubmitting(false);
    }
  };

  const quickReasons = [
    'One or more items are out of stock',
    'Store is closing early today',
    'Item damaged in storage',
    'Cannot fulfill requested quantity',
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-red-50 border-b border-red-100 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-red-800">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <h3 className="font-bold text-sm">Reject Customer Order</h3>
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
          <div className="text-xs text-slate-600">
            You are rejecting order <strong className="text-slate-900 font-mono">{order.orderNumber}</strong> for customer{' '}
            <strong className="text-slate-900">{order.customer?.name || 'Customer'}</strong>.
            A clear rejection reason will be shared with the customer on their order tracking page.
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
              {error}
            </div>
          )}

          {/* Quick Reason Suggestions */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Common Reasons:
            </label>
            <div className="flex flex-wrap gap-1.5">
              {quickReasons.map((qr) => (
                <button
                  type="button"
                  key={qr}
                  onClick={() => setReason(qr)}
                  className="px-2.5 py-1 text-[11px] rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors text-left"
                >
                  {qr}
                </button>
              ))}
            </div>
          </div>

          {/* Rejection Reason Input */}
          <div className="space-y-1">
            <label htmlFor="rejectionReason" className="block text-xs font-bold text-slate-700">
              Rejection Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              id="rejectionReason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this order cannot be fulfilled..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
              required
            />
          </div>

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
              disabled={isSubmitting || !reason || reason.trim().length < 2}
              className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg transition-colors shadow-sm cursor-pointer"
            >
              {isSubmitting ? 'Rejecting Order...' : 'Confirm Rejection'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RejectOrderModal;

