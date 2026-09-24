import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Mic, History, BarChart2, Settings, ShieldCheck, Activity, Sliders } from 'lucide-react';
import { clsx } from 'clsx';

interface SidebarItem {
  name: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
}

const SIDEBAR_ITEMS: SidebarItem[] = [
  { name: 'Home', to: '/home', icon: Home },
  { name: 'Practice', to: '/practice', icon: Mic },
  { name: 'Calibration', to: '/calibration', icon: Sliders },
  { name: 'History', to: '/history', icon: History },
  { name: 'Progress', to: '/progress', icon: BarChart2 },
  { name: 'Settings', to: '/settings', icon: Settings },
  { name: 'Privacy & Notes', to: '/privacy', icon: ShieldCheck }
];

export const DesktopSidebar: React.FC = () => {
  return (
    <aside
      className="hidden md:flex flex-col w-64 lg:w-72 bg-white border-r border-slate-200/90 h-screen sticky top-0 shrink-0 z-30"
      aria-label="Desktop sidebar"
    >
      {/* Brand Header */}
      <div className="p-6 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center text-white shadow-md shadow-teal-600/20">
            <Mic className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-slate-900 text-base leading-tight">
              Speech Practice
            </h1>
            <p className="text-xs text-slate-600 font-medium">Assistant</p>
          </div>
        </div>
      </div>

      {/* Nav list */}
      <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
        {SIDEBAR_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3.5 px-3.5 py-3 rounded-xl font-medium text-sm transition-all duration-150',
                  isActive
                    ? 'bg-teal-50 text-teal-700 font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                )
              }
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span>{item.name}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Clinical Disclaimer Notice */}
      <div className="p-4 m-4 bg-slate-50 rounded-2xl border border-slate-200/70">
        <div className="flex items-start gap-2 text-slate-500">
          <Activity className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
          <p className="text-[11px] leading-relaxed text-slate-500 font-medium">
            Practice companion only. The speech therapist remains the authority for clinical assessment.
          </p>
        </div>
      </div>
    </aside>
  );
};
