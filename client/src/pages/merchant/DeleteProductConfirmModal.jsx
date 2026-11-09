import React from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';

export const DeleteProductConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  product,
  isDeleting,
}) => {
  if (!isOpen || !product) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-6">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mb-4">
            <AlertTriangle className="w-6 h-6" />
          </div>

          <h3 className="text-lg font-bold text-slate-900">Delete Product from Catalogue?</h3>
          <p className="text-sm text-slate-600 mt-2">
            Are you sure you want to remove <strong className="text-slate-900 font-semibold">{product.name}</strong> ({product.unit})?
          </p>

          <div className="mt-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
            <p className="font-semibold text-slate-800">Soft-Deletion Guarantee:</p>
            <p className="leading-relaxed">
              This product will be hidden from customer voice orders and search listings, but will <strong>never be physically deleted</strong>. All existing order history and customer receipts remain intact.
            </p>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isDeleting}
              className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-70"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <span>Confirm Soft-Delete</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeleteProductConfirmModal;

