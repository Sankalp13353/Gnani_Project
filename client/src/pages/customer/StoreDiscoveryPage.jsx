import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Store,
  Search,
  MapPin,
  Clock,
  ArrowRight,
  RefreshCw,
  Building2,
  CheckCircle2,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  X,
  Filter,
} from 'lucide-react';
import { fetchPublicStores } from '../../services/api.js';
import { useCustomerStore } from '../../context/StoreContext.jsx';
import { useCart } from '../../context/CartContext.jsx';

export const StoreDiscoveryPage = () => {
  const navigate = useNavigate();
  const { selectedStoreId, selectStore } = useCustomerStore();
  const { setCartStore } = useCart();

  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [city, setCity] = useState('');
  const [pincode, setPincode] = useState('');
  const [isOpenFilter, setIsOpenFilter] = useState(''); // '' | 'true' | 'false'

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalStores, setTotalStores] = useState(0);

  const loadStores = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page,
        limit: 12,
        search: search.trim() || undefined,
        city: city.trim() || undefined,
        pincode: pincode.trim() || undefined,
        isOpen: isOpenFilter !== '' ? isOpenFilter : undefined,
      };

      const res = await fetchPublicStores(params);
      if (res?.success) {
        setStores(res.data || []);
        setTotalStores(res.total || 0);
        setTotalPages(res.totalPages || 1);
      } else {
        throw new Error(res?.message || 'Failed to discover stores');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error loading store directory');
    } finally {
      setLoading(false);
    }
  }, [page, search, city, pincode, isOpenFilter]);

  useEffect(() => {
    loadStores();
  }, [loadStores]);

  const handleSelectStore = (store) => {
    selectStore(store);
    setCartStore(store);
    navigate(`/stores/${store.id}`);
  };

  const handleClearFilters = () => {
    setSearch('');
    setCity('');
    setPincode('');
    setIsOpenFilter('');
    setPage(1);
  };

  const hasFilters = Boolean(search || city || pincode || isOpenFilter);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-slate-900 to-indigo-950 rounded-2xl p-6 sm:p-10 text-white shadow-sm border border-slate-800">
        <div className="max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Voice Commerce for Local Stores</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-bold tracking-tight">
            Discover Local Stores Near You
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Select your preferred neighborhood local store to browse products, place voice orders in Hindi or English, and pick up in store.
          </p>
        </div>
      </div>

      {/* Search and Location Filter Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* Store Name Search */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search store name (e.g. Ramesh Store, Gupta Mart)..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* City Filter */}
          <div className="relative w-full md:w-44">
            <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="City (e.g. Bengaluru)"
              value={city}
              onChange={(e) => {
                setCity(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Pincode Filter */}
          <div className="relative w-full md:w-36">
            <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Pincode"
              maxLength={6}
              value={pincode}
              onChange={(e) => {
                setPincode(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Status Dropdown */}
          <div className="w-full md:w-36">
            <select
              value={isOpenFilter}
              onChange={(e) => {
                setIsOpenFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-slate-700"
            >
              <option value="">All Stores</option>
              <option value="true">Open Now</option>
              <option value="false">Closed</option>
            </select>
          </div>

          {/* Reset Filters */}
          {hasFilters && (
            <button
              onClick={handleClearFilters}
              className="px-3 py-2 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors whitespace-nowrap"
            >
              Clear Filters
            </button>
          )}

          {/* Refresh */}
          <button
            onClick={() => loadStores()}
            disabled={loading}
            className="p-2.5 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            title="Refresh stores"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Results summary */}
        <div className="text-xs text-slate-500 flex items-center justify-between pt-1">
          <span>
            Found <strong className="text-slate-900 font-semibold">{totalStores}</strong> store(s)
            {city && ` in ${city}`}
            {pincode && ` (PIN: ${pincode})`}
          </span>
          {selectedStoreId && (
            <span className="text-blue-600 font-medium">
              You have a selected store saved in your session
            </span>
          )}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Stores Grid */}
      {loading && stores.length === 0 ? (
        <div className="p-16 text-center text-slate-500 space-y-3 bg-white rounded-2xl border border-slate-200">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-600" />
          <p className="text-xs font-medium">Discovering stores near you...</p>
        </div>
      ) : stores.length === 0 ? (
        <div className="p-16 text-center text-slate-500 space-y-3 bg-white rounded-2xl border border-slate-200">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
            <Store className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">No Stores Found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {hasFilters
                ? 'No stores match your current filters. Try searching for a different name, city, or clearing your filters.'
                : 'No local stores are currently registered in this directory.'}
            </p>
          </div>
          {hasFilters && (
            <div className="pt-2">
              <button
                onClick={handleClearFilters}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 shadow-sm"
              >
                Reset Search Filters
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {stores.map((store) => {
            const isCurrentSelected = store.id === selectedStoreId;

            return (
              <div
                key={store.id}
                className={`bg-white rounded-2xl border p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between ${
                  isCurrentSelected ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-200'
                }`}
              >
                <div className="space-y-3">
                  {/* Status & Badge */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                        store.isOpen
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          store.isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                        }`}
                      />
                      <span>{store.isOpen ? 'Open Now' : 'Closed'}</span>
                    </span>

                    {isCurrentSelected && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                        <CheckCircle2 className="w-3 h-3 text-blue-600" />
                        <span>Selected</span>
                      </span>
                    )}
                  </div>

                  {/* Store Name & Location */}
                  <div>
                    <h3 className="font-bold text-slate-900 text-base group-hover:text-blue-600 transition-colors">
                      {store.name}
                    </h3>
                    <p className="text-xs text-slate-500 flex items-start gap-1.5 mt-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                      <span>{store.address}</span>
                    </p>
                    <p className="text-xs font-semibold text-slate-700 ml-5 mt-0.5">
                      {store.city} — {store.pincode}
                    </p>
                  </div>
                </div>

                {/* Card Action */}
                <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-mono">
                    ID: {store.id.slice(0, 8)}...
                  </span>

                  <button
                    onClick={() => handleSelectStore(store)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-colors"
                  >
                    <span>Explore Store</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="px-4 py-3 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center justify-between text-xs text-slate-600">
          <div>
            Page <strong className="text-slate-900">{page}</strong> of{' '}
            <strong className="text-slate-900">{totalPages}</strong> ({totalStores} stores total)
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
  );
};

export default StoreDiscoveryPage;

