import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Mic, History, BarChart2 } from 'lucide-react';
import { clsx } from 'clsx';

interface NavItem {
  name: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { name: 'Home', to: '/home', icon: Home },
  { name: 'Practice', to: '/practice', icon: Mic },
  { name: 'History', to: '/history', icon: History },
  { name: 'Progress', to: '/progress', icon: BarChart2 }
];

export const MobileNavigation: React.FC = () => {
  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/80 shadow-lg px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-1.5"
      aria-label="Mobile navigation"
    >
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                clsx(
                  'flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all duration-150 min-w-[64px]',
                  isActive
                    ? 'text-teal-700 font-semibold scale-105'
                    : 'text-slate-600 hover:text-slate-800 font-medium'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <div
                    className={clsx(
                      'p-1.5 rounded-xl transition-colors',
                      isActive ? 'bg-teal-50 text-teal-600' : 'text-slate-600'
                    )}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] mt-0.5 tracking-tight">{item.name}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};
