import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  Phone,
  Lock,
  AlertCircle,
  Loader2,
  LogIn,
  Sparkles,
  ArrowRight,
  Store,
} from 'lucide-react';

export const MerchantLoginPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [formData, setFormData] = useState({
    phone: '',
    password: '',
  });

  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (error) setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const cleanPhone = formData.phone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      setError('Please enter a valid 10-digit registered mobile number.');
      return;
    }

    if (!formData.password) {
      setError('Please enter your password.');
      return;
    }

    setIsSubmitting(true);
    try {
      await login({
        phone: cleanPhone,
        password: formData.password,
      });
      navigate('/merchant/dashboard');
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-8">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-blue-900 to-slate-900 p-6 text-white text-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Merchant Portal</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Shopkeeper Login</h1>
          <p className="text-sm text-slate-300 mt-1">
            Access your Kirana store dashboard, catalogue, and voice orders.
          </p>
        </div>

        {/* Form Body */}
        <div className="p-6 sm:p-8">
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-500" />
              <div className="flex-1 font-medium">{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Registered Mobile Number
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="10-digit mobile number"
                  maxLength={10}
                  required
                  autoFocus
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Enter your store password"
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-6 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Logging in...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Sign In to Store</span>
                </>
              )}
            </button>
          </form>

          {/* Registration link */}
          <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col items-center gap-3 text-xs text-slate-600">
            <p>
              New Kirana shopkeeper?{' '}
              <Link
                to="/merchant/register"
                className="text-blue-600 hover:text-blue-800 font-semibold inline-flex items-center gap-1"
              >
                Register your store <ArrowRight className="w-3 h-3" />
              </Link>
            </p>

            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-800 transition-colors"
            >
              <Store className="w-3.5 h-3.5" />
              <span>Back to Customer Ordering</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MerchantLoginPage;

