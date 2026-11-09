import React, { useState, useEffect, useCallback } from 'react';
import {
  Package,
  Plus,
  Upload,
  Search,
  Filter,
  RefreshCw,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  Check,
  X,
  Sparkles,
} from 'lucide-react';
import {
  fetchProducts,
  updateProduct,
  deleteProduct,
  downloadImportTemplate,
} from '../../services/api.js';
import ProductFormModal from './ProductFormModal.jsx';
import DeleteProductConfirmModal from './DeleteProductConfirmModal.jsx';
import BulkImportModal from './BulkImportModal.jsx';

export const MerchantCataloguePage = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState(null);

  // Filter & Pagination States
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [availabilityFilter, setAvailabilityFilter] = useState(''); // '' | 'true' | 'false'
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deletingProduct, setDeletingProduct] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [isImportOpen, setIsImportOpen] = useState(false);

  // Load Products
  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page,
        limit: 20,
        search: search.trim() || undefined,
        category: category.trim() || undefined,
        isAvailable: availabilityFilter !== '' ? availabilityFilter : undefined,
      };

      const res = await fetchProducts(params);
      if (res?.success) {
        setProducts(res.data || []);
        setTotalCount(res.total || 0);
        setTotalPages(res.totalPages || 1);
      } else {
        throw new Error(res?.message || 'Failed to load catalogue');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error loading catalogue products');
    } finally {
      setLoading(false);
    }
  }, [page, search, category, availabilityFilter]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Quick Availability Toggle
  const handleToggleAvailability = async (product) => {
    const updatedStatus = !product.isAvailable;
    try {
      await updateProduct(product.id, { isAvailable: updatedStatus });
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, isAvailable: updatedStatus } : p))
      );
      setFeedback(`"${product.name}" marked ${updatedStatus ? 'Available' : 'Out of Stock'}`);
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      setError('Failed to update product availability: ' + (err.message || 'Error'));
    }
  };

  // Soft Delete Action
  const handleConfirmDelete = async () => {
    if (!deletingProduct) return;
    setIsDeleting(true);
    try {
      await deleteProduct(deletingProduct.id);
      setIsDeleteOpen(false);
      setDeletingProduct(null);
      setFeedback(`"${deletingProduct.name}" soft-deleted from catalogue`);
      setTimeout(() => setFeedback(null), 3000);
      loadProducts();
    } catch (err) {
      setError('Failed to delete product: ' + (err.message || 'Error'));
    } finally {
      setIsDeleting(false);
    }
  };

  // Feedback Notification
  const handleSuccess = (msg) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 4000);
    loadProducts();
  };

  // Derived Metrics
  const availableCount = products.filter((p) => p.isAvailable).length;
  const outOfStockCount = products.filter((p) => !p.isAvailable).length;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Page Header */}
      <div className="bg-gradient-to-r from-blue-900 via-slate-900 to-indigo-950 rounded-2xl p-6 sm:p-8 text-white shadow-sm border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Phase C: Store Catalogue Management</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Product Catalogue</h1>
            <p className="text-xs sm:text-sm text-slate-300">
              Manage inventory pricing, units, availability, and bulk spreadsheets for voice ordering.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => downloadImportTemplate()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors border border-white/10"
              title="Download Sample CSV Template"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">CSV Template</span>
            </button>

            <button
              onClick={() => setIsImportOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 text-blue-200 hover:text-white text-xs font-semibold transition-colors border border-blue-400/30"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Bulk Import</span>
            </button>

            <button
              onClick={() => {
                setEditingProduct(null);
                setIsFormOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Product</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium">Total Active Products</p>
            <p className="text-2xl font-bold text-slate-900 mt-0.5">{totalCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Package className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium">In Stock (Current Page)</p>
            <p className="text-2xl font-bold text-emerald-600 mt-0.5">{availableCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium">Out of Stock (Current Page)</p>
            <p className="text-2xl font-bold text-amber-600 mt-0.5">{outOfStockCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Toast Feedback */}
      {feedback && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span className="font-medium">{feedback}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-emerald-600 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search products by name..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Category Filter */}
          <div className="relative flex-1 sm:flex-none">
            <input
              type="text"
              placeholder="Filter category..."
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full sm:w-36"
            />
          </div>

          {/* Availability Filter */}
          <select
            value={availabilityFilter}
            onChange={(e) => {
              setAvailabilityFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-slate-700"
          >
            <option value="">All Statuses</option>
            <option value="true">In Stock Only</option>
            <option value="false">Out of Stock Only</option>
          </select>

          {/* Reset Filters */}
          {(search || category || availabilityFilter) && (
            <button
              onClick={() => {
                setSearch('');
                setCategory('');
                setAvailabilityFilter('');
                setPage(1);
              }}
              className="text-xs text-blue-600 hover:text-blue-800 font-semibold px-2 py-1"
            >
              Clear
            </button>
          )}

          {/* Refresh Button */}
          <button
            onClick={() => loadProducts()}
            disabled={loading}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            title="Refresh catalogue"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Catalogue Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading && products.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600" />
            <p className="text-xs font-medium">Loading store catalogue...</p>
          </div>
        ) : products.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">No products found</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {search || category || availabilityFilter
                  ? 'No products matched your search filters.'
                  : 'Your catalogue is currently empty. Add your first product or use bulk import.'}
              </p>
            </div>
            <div className="pt-2 flex items-center justify-center gap-2">
              <button
                onClick={() => {
                  setEditingProduct(null);
                  setIsFormOpen(true);
                }}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 shadow-sm"
              >
                Add First Product
              </button>
              <button
                onClick={() => setIsImportOpen(true)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200"
              >
                Import from Spreadsheet
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Product Name</th>
                  <th className="py-3 px-3">Brand</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3">Unit</th>
                  <th className="py-3 px-3">Price</th>
                  <th className="py-3 px-3 text-center">In Stock?</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((product) => (
                  <tr key={product.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900 text-sm">{product.name}</div>
                      {product.description && (
                        <div className="text-[11px] text-slate-400 truncate max-w-xs mt-0.5">
                          {product.description}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-3 text-slate-600 font-medium">{product.brand || '—'}</td>
                    <td className="py-3.5 px-3">
                      {product.category ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-medium">
                          {product.category}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-3 font-mono font-medium text-slate-700">{product.unit}</td>
                    <td className="py-3.5 px-3 font-semibold text-slate-900">
                      ₹{Number(product.price).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <button
                        onClick={() => handleToggleAvailability(product)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                          product.isAvailable
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                            : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                        }`}
                        title="Click to toggle availability"
                      >
                        {product.isAvailable ? (
                          <>
                            <Check className="w-3 h-3" />
                            <span>In Stock</span>
                          </>
                        ) : (
                          <>
                            <X className="w-3 h-3" />
                            <span>Out of Stock</span>
                          </>
                        )}
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditingProduct(product);
                            setIsFormOpen(true);
                          }}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit product"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setDeletingProduct(product);
                            setIsDeleteOpen(true);
                          }}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Soft-delete product"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <div>
              Showing page <strong className="text-slate-900">{page}</strong> of{' '}
              <strong className="text-slate-900">{totalPages}</strong> ({totalCount} total items)
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Product Modal */}
      <ProductFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSuccess={handleSuccess}
        initialData={editingProduct}
      />

      {/* Soft-Delete Confirmation Modal */}
      <DeleteProductConfirmModal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleConfirmDelete}
        product={deletingProduct}
        isDeleting={isDeleting}
      />

      {/* Bulk Import Modal */}
      <BulkImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onSuccess={handleSuccess}
      />
    </div>
  );
};

export default MerchantCataloguePage;

