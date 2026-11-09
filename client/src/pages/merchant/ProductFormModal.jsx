import React, { useState, useEffect } from 'react';
import { X, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { createProduct, updateProduct } from '../../services/api.js';

const COMMON_UNITS = ['kg', 'g', 'litre', 'ml', 'packet', 'piece', 'bottle', 'box', 'pouch'];
const COMMON_CATEGORIES = [
  'Flours & Atta',
  'Grains & Rice',
  'Dals & Pulses',
  'Edible Oils & Ghee',
  'Spices & Masalas',
  'Dairy & Milk',
  'Snacks & Biscuits',
  'Instant Foods',
  'Beverages & Tea',
  'Personal Care',
  'Household & Cleaning',
];

export const ProductFormModal = ({ isOpen, onClose, onSuccess, initialData = null }) => {
  const isEditing = Boolean(initialData && initialData.id);

  const [formData, setFormData] = useState({
    name: '',
    brand: '',
    category: '',
    description: '',
    unit: 'kg',
    price: '',
    isAvailable: true,
  });

  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || '',
        brand: initialData.brand || '',
        category: initialData.category || '',
        description: initialData.description || '',
        unit: initialData.unit || 'kg',
        price: initialData.price ? String(initialData.price) : '',
        isAvailable: initialData.isAvailable !== false,
      });
    } else {
      setFormData({
        name: '',
        brand: '',
        category: '',
        description: '',
        unit: 'kg',
        price: '',
        isAvailable: true,
      });
    }
    setError(null);
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    if (error) setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Client-side UX validations
    if (!formData.name.trim()) {
      setError('Product name is required.');
      return;
    }

    if (!formData.unit.trim()) {
      setError('Product unit is required.');
      return;
    }

    const numPrice = Number(formData.price);
    if (isNaN(numPrice) || numPrice <= 0) {
      setError('Price must be a valid number greater than zero.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: formData.name.trim(),
        brand: formData.brand.trim() || undefined,
        category: formData.category.trim() || undefined,
        description: formData.description.trim() || undefined,
        unit: formData.unit.trim(),
        price: numPrice.toFixed(2),
        isAvailable: formData.isAvailable,
      };

      if (isEditing) {
        await updateProduct(initialData.id, payload);
      } else {
        await createProduct(payload);
      }

      onSuccess(isEditing ? 'Product updated successfully' : 'Product added to catalogue');
      onClose();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to save product';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="font-bold text-slate-900 text-lg">
              {isEditing ? 'Edit Catalogue Product' : 'Add New Product'}
            </h3>
            <p className="text-xs text-slate-500">
              {isEditing
                ? 'Update pricing, availability, and inventory details'
                : 'Add a new Kirana item to your store catalogue'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-500" />
              <div className="font-medium">{error}</div>
            </div>
          )}

          {/* Product Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Product Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g. Aashirvaad Shudh Chakki Atta"
              required
              autoFocus
              className="w-full px-3.5 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Brand & Category Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Brand <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                name="brand"
                value={formData.brand}
                onChange={handleChange}
                placeholder="e.g. Aashirvaad, Tata, Amul"
                className="w-full px-3.5 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Category <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                name="category"
                list="category-suggestions"
                value={formData.category}
                onChange={handleChange}
                placeholder="e.g. Flours & Atta"
                className="w-full px-3.5 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <datalist id="category-suggestions">
                {COMMON_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Unit & Price Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Unit of Measure <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  name="unit"
                  list="unit-suggestions"
                  value={formData.unit}
                  onChange={handleChange}
                  placeholder="e.g. kg, litre, packet"
                  required
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <datalist id="unit-suggestions">
                  {COMMON_UNITS.map((u) => (
                    <option key={u} value={u} />
                  ))}
                </datalist>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Price (₹ INR) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-sm text-slate-400 font-semibold">₹</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  name="price"
                  value={formData.price}
                  onChange={handleChange}
                  placeholder="0.00"
                  required
                  className="w-full pl-8 pr-3.5 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Description <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={2}
              placeholder="e.g. 100% whole wheat chakki atta, no maida added"
              className="w-full px-3.5 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Availability Toggle */}
          <div className="pt-2">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                name="isAvailable"
                checked={formData.isAvailable}
                onChange={handleChange}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
              />
              <div>
                <span className="text-xs font-semibold text-slate-800">Available in Stock</span>
                <p className="text-[11px] text-slate-500">
                  When enabled, customers can order this product via voice ordering and catalogue search.
                </p>
              </div>
            </label>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-70"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{isEditing ? 'Update Product' : 'Add to Catalogue'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProductFormModal;

