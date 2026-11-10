import React, { useState, useEffect } from 'react';
import {
  Printer,
  X,
  Store,
  User,
  Phone,
  Clock,
  MapPin,
  CreditCard,
  AlertCircle,
  FileText,
  CheckCircle2,
} from 'lucide-react';
import { fetchPackingSlip } from '../../services/api.js';

export const PackingSlipModal = ({ orderId, onClose }) => {
  const [packingSlip, setPackingSlip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const loadSlip = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetchPackingSlip(orderId);
        if (isMounted) {
          if (res.success && res.data) {
            setPackingSlip(res.data);
          } else {
            throw new Error(res.message || 'Failed to load packing slip');
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err.response?.data?.message || err.message || 'Failed to load packing slip');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    if (orderId) {
      loadSlip();
    }

    return () => {
      isMounted = false;
    };
  }, [orderId]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      {/* Print-specific style tag */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #ordersaathi-printable-slip, #ordersaathi-printable-slip * {
            visibility: visible !important;
          }
          #ordersaathi-printable-slip {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            padding: 16px !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8">
        {/* Modal Toolbar (hidden during print) */}
        <div className="no-print bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-400" />
            <h3 className="font-bold text-sm">Packing Slip Preview</h3>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              disabled={loading || !!error}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print Slip</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="py-20 text-center space-y-3">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-xs text-slate-500 font-medium">Generating packing slip...</p>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="p-8 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-slate-800">Cannot Generate Packing Slip</h4>
            <p className="text-xs text-slate-600 max-w-sm mx-auto">{error}</p>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
            >
              Close
            </button>
          </div>
        )}

        {/* Printable Packing Slip Area */}
        {!loading && packingSlip && (
          <div id="ordersaathi-printable-slip" className="p-8 bg-white text-slate-900 space-y-6 text-xs">
            {/* Header / Branding */}
            <div className="border-b-2 border-slate-900 pb-4 flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">
                  {packingSlip.branding.appName}
                </h1>
                <p className="text-[11px] text-slate-600 font-medium">{packingSlip.branding.tagline}</p>
                <div className="mt-2 text-slate-700 font-medium">
                  <p className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                    <Store className="w-3.5 h-3.5" />
                    <span>{packingSlip.store.name}</span>
                  </p>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    {packingSlip.store.address}, {packingSlip.store.city} — {packingSlip.store.pincode}
                  </p>
                  <p className="text-[11px] text-slate-600">Store Tel: +91 {packingSlip.store.phone}</p>
                </div>
              </div>

              <div className="text-right space-y-1">
                <span className="inline-block px-3 py-1 bg-slate-900 text-white font-mono font-bold text-xs rounded uppercase tracking-wider">
                  PACKING SLIP
                </span>
                <p className="font-mono font-bold text-sm text-slate-900 mt-1">
                  {packingSlip.order.orderNumber}
                </p>
                <p className="text-[11px] text-slate-500 font-mono">
                  {new Date(packingSlip.order.createdAt).toLocaleString('en-IN', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </p>
              </div>
            </div>

            {/* Customer & Order Metadata Grid */}
            <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Customer Details</p>
                <p className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  <span>{packingSlip.customer.name}</span>
                </p>
                <p className="text-slate-700 font-mono flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-500" />
                  <span>+91 {packingSlip.customer.phone}</span>
                </p>
              </div>

              <div className="space-y-1 text-right">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Status & Payment</p>
                <p className="font-semibold text-slate-800">
                  Status: <span className="font-bold uppercase text-slate-900">{packingSlip.order.status}</span>
                </p>
                <p className="font-semibold text-slate-800 font-mono">
                  Payment: <span className="font-bold uppercase text-slate-900">{packingSlip.order.paymentStatus}</span>
                </p>
              </div>
            </div>

            {/* Customer Notes / Instructions */}
            {packingSlip.order.notes && (
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-amber-900">
                <span className="font-bold uppercase text-[10px] tracking-wider block text-amber-800">
                  Customer Pickup Instructions:
                </span>
                <p className="mt-0.5 italic">"{packingSlip.order.notes}"</p>
              </div>
            )}

            {/* Line Items Table */}
            <div>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b-2 border-slate-800 text-[11px] uppercase font-bold text-slate-700">
                    <th className="py-2 text-left w-10">#</th>
                    <th className="py-2 text-left">Product Description</th>
                    <th className="py-2 text-center w-24">Quantity</th>
                    <th className="py-2 text-right w-24">Unit Price</th>
                    <th className="py-2 text-right w-28">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {packingSlip.items.map((item, idx) => (
                    <tr key={item.id} className="text-slate-800 font-medium">
                      <td className="py-2.5 text-slate-400 font-mono">{idx + 1}</td>
                      <td className="py-2.5 font-bold text-slate-900">{item.productName}</td>
                      <td className="py-2.5 text-center font-mono font-semibold">
                        {item.quantity} {item.unit}
                      </td>
                      <td className="py-2.5 text-right font-mono text-slate-600">
                        ₹{item.unitPrice}
                      </td>
                      <td className="py-2.5 text-right font-mono font-bold text-slate-900">
                        ₹{item.lineTotal}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-800">
                    <td colSpan="4" className="py-3 text-right font-bold text-sm text-slate-800 uppercase">
                      Order Subtotal:
                    </td>
                    <td className="py-3 text-right font-mono font-black text-base text-slate-900">
                      ₹{packingSlip.order.subtotal}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Prominent Payment Notice Banner */}
            <div
              className={`p-4 rounded-xl border-2 text-center font-bold tracking-wide uppercase text-xs ${
                packingSlip.order.paymentStatus === 'PAID'
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                  : 'bg-amber-50 border-amber-500 text-amber-900'
              }`}
            >
              {packingSlip.order.paymentNote}
              {packingSlip.order.paymentStatus !== 'PAID' && packingSlip.store.upiId && (
                <span className="block font-mono text-[11px] font-normal lowercase mt-1 text-slate-700">
                  Store UPI: <strong>{packingSlip.store.upiId}</strong> (Collect upon pickup)
                </span>
              )}
            </div>

            {/* Store Staff Checklist / Footer */}
            <div className="border-t border-slate-300 pt-4 text-[10px] text-slate-500 flex items-center justify-between">
              <div>
                <p>Packed by: _______________________</p>
                <p className="mt-1">Verified by: _____________________</p>
              </div>
              <div className="text-right">
                <p>Customer Signature on Pickup: _______________________</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PackingSlipModal;

