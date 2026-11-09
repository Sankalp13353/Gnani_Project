import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Store,
  MapPin,
  Search,
  Package,
  ArrowLeft,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Tag,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ShoppingBag,
} from 'lucide-react';
import { fetchPublicStoreCatalogue } from '../../services/api.js';
import { useCustomerStore } from '../../context/StoreContext.jsx';

export const StoreCataloguePage = () => {
  const { storeId } = useParams();
  const navigate = useNavigate();
  const { selectStore, selectedStoreId } = useCustomerStore();

  const [store, setStore] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const loadCatalogue = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    setError(null);

    try {
      const params = {
        page,
        limit: 24,
        search: search.trim() || undefined,
        category: category.trim() || undefined,
      };

      const res = await fetchPublicStoreCatalogue(storeId, params);
      if (res?.success) {
        setStore(res.store);
        setProducts(res.data || []);
        setTotalCount(res.total || 0);
        setTotalPages(res.totalPages || 1);

        // Update customer selected store context
        if (res.store) {
          selectStore(res.store);
        }
      } else {
        throw new Error(res?.message || 'Failed to load store catalogue');
      }
    } catch (err) {
      setError(
        err.response?.status === 404
          ? 'Store not found. This store may have been removed or does not exist.'
          : err.response?.data?.message || err.message || 'Error loading store catalogue'
      );
    } finally {
      setLoading(false);
    }
  }, [storeId, page, search, category, selectStore]);

  useEffect(() => {
    loadCatalogue();
  }, [loadCatalogue]);

  // Derived list of unique categories from current products or standard
  const availableCategories = Array.from(
    new Set(products.map((p) => p.category).filter(Boolean))
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Back button */}
      <div>
        <button
          onClick={() => navigate('/stores')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Store Directory</span>
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-8 bg-white border border-red-200 rounded-2xl shadow-sm text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 mx-auto flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-lg">Unable to Load Store Catalogue</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">{error}</p>
          </div>
          <button
            onClick={() => navigate('/stores')}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-colors"
          >
            Explore Other Stores
          </button>
        </div>
      )}

      {/* Store Header Banner */}
      {!error && store && (
        <div className="bg-gradient-to-r from-blue-900 via-slate-900 to-indigo-950 rounded-2xl p-6 sm:p-8 text-white shadow-sm border border-slate-800">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                    store.isOpen
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                      : 'bg-slate-700/50 text-slate-300 border border-slate-600/50'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      store.isOpen ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'
                    }`}
                  />
                  <span>{store.isOpen ? 'Store Open for In-Store Pickup' : 'Store Currently Closed'}</span>
                </span>

                {store.id === selectedStoreId && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-300 bg-blue-500/20 px-2.5 py-0.5 rounded-full border border-blue-400/30">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                    <span>Selected Store</span>
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{store.name}</h1>
              <p className="text-xs sm:text-sm text-slate-300 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span>
                  {store.address}, {store.city} — {store.pincode}
                </span>
              </p>
            </div>

            <div className="flex items-center gap-3">
              {store.isOpen ? (
                <Link
                  to={`/stores/${store.id}/order`}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-sm transition-colors"
                  title="Speak grocery order for this store"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Start Voice Order</span>
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-700 text-slate-400 text-xs font-semibold cursor-not-allowed">
                  <span>Store Closed for Orders</span>
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Search & Filter Bar */}
      {!error && store && (
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search available products..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-2.5 w-full md:w-auto">
            <div className="relative flex-1 md:flex-none">
              <input
                type="text"
                placeholder="Filter category (e.g. Flours, Dairy)..."
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setPage(1);
                }}
                className="w-full md:w-60 px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {(search || category) && (
              <button
                onClick={() => {
                  setSearch('');
                  setCategory('');
                  setPage(1);
                }}
                className="text-xs text-blue-600 hover:text-blue-800 font-semibold px-2 py-1"
              >
                Clear
              </button>
            )}

            <button
              onClick={() => loadCatalogue()}
              disabled={loading}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
              title="Refresh catalogue"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      )}

      {/* Category Pills (if available) */}
      {!error && availableCategories.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <span className="text-slate-400 text-[11px] font-semibold mr-1 uppercase tracking-wider">
            Categories:
          </span>
          <button
            onClick={() => setCategory('')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
              category === ''
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            All Items
          </button>
          {availableCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                category.toLowerCase() === cat.toLowerCase()
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Products Grid */}
      {!error && store && (
        <div>
          {loading && products.length === 0 ? (
            <div className="p-16 text-center text-slate-500 space-y-3 bg-white rounded-2xl border border-slate-200">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-600" />
              <p className="text-xs font-medium">Loading store inventory...</p>
            </div>
          ) : products.length === 0 ? (
            <div className="p-16 text-center text-slate-500 space-y-3 bg-white rounded-2xl border border-slate-200">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                <Package className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">No Products Available</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  {search || category
                    ? 'No products matched your search filters.'
                    : 'This store has not listed any in-stock items in their public catalogue yet.'}
                </p>
              </div>
              {(search || category) && (
                <div className="pt-2">
                  <button
                    onClick={() => {
                      setSearch('');
                      setCategory('');
                      setPage(1);
                    }}
                    className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 shadow-sm"
                  >
                    Clear Search Filters
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {products.map((product) => (
                <div
                  key={product.id}
                  className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    {/* Category & Availability Badges */}
                    <div className="flex items-center justify-between text-[11px]">
                      {product.category ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium">
                          {product.category}
                        </span>
                      ) : (
                        <span />
                      )}

                      <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-[10px] bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>In Stock</span>
                      </span>
                    </div>

                    {/* Product Name & Brand */}
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm leading-snug line-clamp-2">
                        {product.name}
                      </h4>
                      {product.brand && (
                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                          Brand: {product.brand}
                        </p>
                      )}
                    </div>

                    {/* Description */}
                    {product.description && (
                      <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                        {product.description}
                      </p>
                    )}
                  </div>

                  {/* Pricing and Unit */}
                  <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                        Unit: <span className="font-mono text-slate-700">{product.unit}</span>
                      </p>
                      <p className="text-base font-bold text-slate-900">
                        ₹{Number(product.price).toFixed(2)}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg">
                        Pickup Item
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 px-4 py-3 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center justify-between text-xs text-slate-600">
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
      )}
    </div>
  );
};

export default StoreCataloguePage;

