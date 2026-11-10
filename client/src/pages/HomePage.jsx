import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Bot, Store, ArrowRight } from 'lucide-react';
import { useHealthCheck } from '../hooks/useHealthCheck.js';
import HealthStatusCard from '../components/HealthStatusCard.jsx';
import OrderManagementPlaceholder from '../components/OrderManagementPlaceholder.jsx';
import VoiceOrderIntake from '../components/VoiceOrderIntake.jsx';

export const HomePage = () => {
  const { status, data, dbStatus, error, lastChecked, refresh } = useHealthCheck();

  return (
    <div className="space-y-8">
      {/* Hero / Branding Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white p-8 md:p-10 shadow-lg">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-medium mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Voice Commerce for Local Stores</span>
          </div>

          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            OrderSaathi
          </h1>

          <p className="mt-3 text-lg md:text-xl text-slate-300 leading-relaxed font-normal">
            Your AI-powered voice employee for smarter retail operations.
          </p>

          <p className="mt-3 text-sm text-slate-400 max-w-xl">
            A voice-first ordering platform that connects customers with local retail stores, allowing customers to discover products and place orders naturally using their voice in their preferred language.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              to="/stores"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-sm transition-colors"
            >
              <Store className="w-4 h-4" />
              <span>Browse Local Stores Near You</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-3.5 py-1.5 rounded-lg border border-white/10 text-xs text-slate-200">
              <Bot className="w-4 h-4 text-emerald-400" />
              <span>Gnani AI Prisma STT Active</span>
            </div>
          </div>
        </div>

        {/* Subtle decorative background circle */}
        <div className="absolute -right-10 -bottom-10 w-72 h-72 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Voice Order Intake Component (Phase 4) */}
      <VoiceOrderIntake />

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

