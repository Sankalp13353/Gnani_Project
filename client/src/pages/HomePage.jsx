import React from 'react';
import { Sparkles, Bot, Store } from 'lucide-react';
import { useHealthCheck } from '../hooks/useHealthCheck.js';
import HealthStatusCard from '../components/HealthStatusCard.jsx';
import OrderManagementPlaceholder from '../components/OrderManagementPlaceholder.jsx';

export const HomePage = () => {
  const { status, data, dbStatus, error, lastChecked, refresh } = useHealthCheck();

  return (
    <div className="space-y-8">
      {/* Hero / Branding Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white p-8 md:p-10 shadow-lg">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-medium mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Voice Commerce for Kirana Stores</span>
          </div>

          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            CallSaar
          </h1>

          <p className="mt-3 text-lg md:text-xl text-slate-300 leading-relaxed font-normal">
            Your AI-powered voice employee for smarter retail operations.
          </p>

          <p className="mt-3 text-sm text-slate-400 max-w-xl">
            Enabling Kirana storekeepers to seamlessly accept, transcribe, and fulfill customer grocery orders in Hindi, English, and Hinglish.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-3.5 py-1.5 rounded-lg border border-white/10 text-xs text-slate-200">
              <Store className="w-4 h-4 text-amber-400" />
              <span>Target: Indian Kirana Stores</span>
            </div>
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-3.5 py-1.5 rounded-lg border border-white/10 text-xs text-slate-200">
              <Bot className="w-4 h-4 text-emerald-400" />
              <span>Gnani AI Integration (Phases 3-5)</span>
            </div>
          </div>
        </div>

        {/* Subtle decorative background circle */}
        <div className="absolute -right-10 -bottom-10 w-72 h-72 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Grid: Health Status & Placeholder Modules */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Backend Connection Status (1 col on desktop) */}
        <div className="lg:col-span-1">
          <HealthStatusCard
            status={status}
            data={data}
            dbStatus={dbStatus}
            error={error}
            lastChecked={lastChecked}
            onRefresh={refresh}
          />
        </div>

        {/* Order Management Placeholder (2 cols on desktop) */}
        <div className="lg:col-span-2">
          <OrderManagementPlaceholder />
        </div>
      </div>
    </div>
  );
};

export default HomePage;

