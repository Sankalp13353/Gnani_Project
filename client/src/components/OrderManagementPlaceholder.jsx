import React from 'react';
import { ShoppingBag, Mic, FileText, CheckCircle } from 'lucide-react';

export const OrderManagementPlaceholder = () => {
  const upcomingModules = [
    {
      title: 'Voice Order Intake',
      desc: 'Multilingual voice input support for Hindi, English, and Hinglish via Gnani AI Prisma.',
      icon: Mic,
      status: 'Phase 3-4',
    },
    {
      title: 'Intelligent Order Extraction',
      desc: 'Automatic parsing of store items, quantities, and units into structured cart orders.',
      icon: ShoppingBag,
      status: 'Phase 4',
    },
    {
      title: 'Order Confirmation & TTS',
      desc: 'Voice feedback and confirmation stream to customers powered by Gnani AI Timbre.',
      icon: CheckCircle,
      status: 'Phase 5',
    },
    {
      title: 'Printable Packing Slips',
      desc: 'Instant generation of physical packing slips for store staff order fulfillment.',
      icon: FileText,
      status: 'Phase 6',
    },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div>
          <h3 className="text-base font-semibold text-slate-800">
            Order Management & Voice Operations
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Core workflow modules scheduled for subsequent phases
          </p>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full border border-blue-200/50">
          Phase 1 Foundation Ready
        </span>
      </div>

      <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        {upcomingModules.map((module) => {
          const Icon = module.icon;
          return (
            <div
              key={module.title}
              className="p-4 rounded-lg border border-dashed border-slate-200 bg-slate-50/50 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600">
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-[11px] font-medium text-slate-500 bg-slate-200/70 px-2 py-0.5 rounded">
                    {module.status}
                  </span>
                </div>
                <h4 className="text-sm font-medium text-slate-800">
                  {module.title}
                </h4>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  {module.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 bg-slate-50 rounded-lg p-3.5 border border-slate-200/70 text-center">
        <p className="text-xs text-slate-600">
          Database schemas (PostgreSQL / Prisma) and order processing pipelines will be initialized in Phase 2.
        </p>
      </div>
    </div>
  );
};

export default OrderManagementPlaceholder;

