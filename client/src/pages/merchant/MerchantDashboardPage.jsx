import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  Store,
  User,
  Phone,
  MapPin,
  CreditCard,
  LogOut,
  Package,
  ClipboardList,
  CheckCircle2,
  Clock,
  ShieldCheck,
  ExternalLink,
  Sparkles,
} from 'lucide-react';

export const MerchantDashboardPage = () => {
  const navigate = useNavigate();
  const { store, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/merchant/login');
  };

  if (!store) {
    return null;
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Store Header Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-slate-900 to-indigo-950 rounded-2xl p-6 sm:p-8 text-white shadow-sm border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Phase B — Store Authentication Active</span>
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>{store.isOpen ? 'Store Open' : 'Store Closed'}</span>
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{store.name}</h1>
            <p className="text-sm text-slate-300 flex items-center gap-2">
              <User className="w-4 h-4 text-slate-400" />
              <span>Owner: <strong className="text-white">{store.ownerName}</strong></span>
              <span className="text-slate-500">•</span>
              <span className="text-xs text-slate-400 font-mono">ID: {store.id}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
            <button
              onClick={() => navigate('/merchant/orders')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-colors"
            >
              <ClipboardList className="w-3.5 h-3.5" />
              <span>Manage Orders</span>
            </button>
            <button
              onClick={() => navigate('/merchant/catalogue')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors border border-white/10"
            >
              <Package className="w-3.5 h-3.5" />
              <span>Catalogue</span>
            </button>
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors border border-white/10"
              title="Test Voice Ordering as a Customer"
            >
              <span>Customer View</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-200 hover:text-white text-xs font-medium transition-colors border border-red-500/30"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>

      {/* Store Profile Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Contact Info Card */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
            <Phone className="w-4 h-4 text-blue-600" />
            <span>Contact & Phone</span>
          </div>
          <div>
            <p className="text-xs text-slate-500">Registered Mobile</p>
            <p className="text-sm font-semibold text-slate-900 font-mono mt-0.5">
              +91 {store.phone}
            </p>
          </div>
          <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
            <ShieldCheck className="w-4 h-4" />
            <span>Verified Store Owner</span>
          </div>
        </div>

        {/* Location Card */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
            <MapPin className="w-4 h-4 text-blue-600" />
            <span>Store Location</span>
          </div>
          <div>
            <p className="text-xs text-slate-500">Address</p>
            <p className="text-sm text-slate-800 mt-0.5 leading-snug">{store.address}</p>
            <p className="text-xs text-slate-600 font-medium mt-1">
              {store.city} — {store.pincode}
            </p>
          </div>
        </div>

        {/* Payment & UPI Card */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
            <CreditCard className="w-4 h-4 text-blue-600" />
            <span>Payment & In-Store Pickup</span>
          </div>
          <div>
            <p className="text-xs text-slate-500">Store UPI ID</p>
            <p className="text-sm font-mono text-slate-800 mt-0.5">
              {store.upiId ? (
                <span className="text-blue-700 font-semibold">{store.upiId}</span>
              ) : (
                <span className="text-slate-400 italic">Not configured</span>
              )}
            </p>
          </div>
          <p className="text-[11px] text-slate-500">
            Used on printable packing slips for customer in-store UPI payments during pickup.
          </p>
        </div>
      </div>

      {/* Roadmap & Upcoming Modules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
        {/* Phase C Active Card */}
        <div className="bg-white rounded-xl border border-blue-200 shadow-sm p-6 space-y-4 relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700">
              <Package className="w-5 h-5" />
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>Active & Ready</span>
            </span>
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">Store Catalogue & Bulk Import</h3>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Add products, configure units & pricing, toggle inventory availability, and bulk import catalogue spreadsheets (.csv / .xlsx) with transactional validation.
            </p>
          </div>
          <button
            onClick={() => navigate('/merchant/catalogue')}
            className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm transition-colors flex items-center justify-center gap-1.5"
          >
            <span>Open Product Catalogue</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Phase F Active Card: Orders & Packing Slips */}
        <div className="bg-white rounded-xl border border-blue-200 shadow-sm p-6 space-y-4 relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700">
              <ClipboardList className="w-5 h-5" />
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>Phase F Active</span>
            </span>
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">Order Management & Packing Slips</h3>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Review customer voice orders in real-time. Accept or reject with reasons, print professional packing slips, track preparation, and complete in-store collections.
            </p>
          </div>
          <button
            onClick={() => navigate('/merchant/orders')}
            className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>Manage Orders & Queue</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Security & Multi-Store Architecture Notice */}
      <div className="bg-slate-100 border border-slate-200 rounded-xl p-4 text-xs text-slate-600 flex items-start gap-3">
        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
        <div>
          <strong className="text-slate-800">Multi-Store Tenant Isolation Active:</strong> Your merchant session is secured using HTTP-only JWT cookies. All requests are strictly bound to Store ID <span className="font-mono font-medium text-slate-700">{store.id}</span>. Cross-store access is blocked by backend middleware.
        </div>
      </div>
    </div>
  );
};

export default MerchantDashboardPage;

