import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Mic2, Store, LogOut, LayoutDashboard, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export const MainLayout = ({ children }) => {
  const { store, isAuthenticated, logout } = useAuth();
  const location = useLocation();

  const isMerchantRoute = location.pathname.startsWith('/merchant');

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo & Brand */}
          <Link to="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm shadow-blue-500/20">
              <Mic2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-slate-900 tracking-tight">CallSaar</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                  v1.0-alpha
                </span>
              </div>
              <p className="text-[11px] text-slate-500">Retail AI Voice Assistant</p>
            </div>
          </Link>

          {/* Navigation Links */}
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                !isMerchantRoute
                  ? 'bg-slate-100 text-slate-900 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Customer Voice Order
            </Link>

            {isAuthenticated ? (
              <div className="flex items-center gap-2">
                <Link
                  to="/merchant/dashboard"
                  className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                    location.pathname === '/merchant/dashboard'
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <LayoutDashboard className="w-3.5 h-3.5 text-blue-600" />
                  <span className="font-semibold">{store?.name || 'My Store'}</span>
                </Link>
                <Link
                  to="/merchant/catalogue"
                  className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                    location.pathname === '/merchant/catalogue'
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Store className="w-3.5 h-3.5 text-slate-500" />
                  <span>Catalogue</span>
                </Link>
                <button
                  onClick={logout}
                  title="Sign Out"
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/merchant/login"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 hover:text-blue-600 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Shopkeeper Login</span>
                </Link>
                <Link
                  to="/merchant/register"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg shadow-sm transition-colors"
                >
                  <Store className="w-3.5 h-3.5" />
                  <span>Register Store</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 mt-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} CallSaar. All rights reserved.</p>
          <p>Built for Indian Kirana & Retail Automation</p>
        </div>
      </footer>
    </div>
  );
};

export default MainLayout;
