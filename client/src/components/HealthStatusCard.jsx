import React from 'react';
import { RefreshCw, CheckCircle2, AlertCircle, Loader2, Database } from 'lucide-react';
import { CONNECTION_STATUS } from '../utils/constants.js';

export const HealthStatusCard = ({
  status,
  data,
  dbStatus,
  error,
  lastChecked,
  onRefresh,
}) => {
  const isConnected = status === CONNECTION_STATUS.CONNECTED;
  const isChecking = status === CONNECTION_STATUS.CHECKING;
  const isDbConnected = dbStatus === 'connected';

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div
            className={`w-3 h-3 rounded-full ${
              isConnected
                ? 'bg-emerald-500 animate-pulse'
                : isChecking
                ? 'bg-amber-500 animate-pulse'
                : 'bg-rose-500'
            }`}
          />
          <h3 className="text-base font-semibold text-slate-800">
            System & Database Status
          </h3>
        </div>

        <button
          onClick={onRefresh}
          disabled={isChecking}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
          title="Refresh status"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="mt-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-500">API Endpoint:</span>
          <code className="text-xs font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
            GET /api/health
          </code>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-500">Backend Server:</span>
          {isChecking ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Checking...
            </span>
          ) : isConnected ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Connected
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full">
              <AlertCircle className="w-3.5 h-3.5" />
              Disconnected
            </span>
          )}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-500">PostgreSQL (Prisma):</span>
          {isChecking ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Checking...
            </span>
          ) : isDbConnected ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
              <Database className="w-3.5 h-3.5" />
              Connected
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full">
              <AlertCircle className="w-3.5 h-3.5" />
              Disconnected
            </span>
          )}
        </div>

        {isConnected && data && (
          <div className="bg-emerald-50/60 border border-emerald-100 rounded-lg p-3 text-xs text-emerald-900">
            <p className="font-semibold">{data.message}</p>
            <p className="text-emerald-700 mt-0.5">Database: {isDbConnected ? 'Active (PostgreSQL)' : 'Offline'}</p>
          </div>
        )}

        {!isConnected && !isChecking && error && (
          <div className="bg-rose-50 border border-rose-100 rounded-lg p-3 text-xs text-rose-800">
            <p className="font-semibold">Connection Error:</p>
            <p className="text-rose-600 mt-0.5">{error}</p>
          </div>
        )}

        {lastChecked && (
          <p className="text-xs text-slate-400 text-right pt-2">
            Last checked: {lastChecked.toLocaleTimeString()}
          </p>
        )}
      </div>
    </div>
  );
};

export default HealthStatusCard;
