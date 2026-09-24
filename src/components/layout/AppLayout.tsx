import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { DesktopSidebar } from './DesktopSidebar';
import { MobileNavigation } from './MobileNavigation';
import { Settings, Mic } from 'lucide-react';

export const AppLayout: React.FC = () => {
  const location = useLocation();
  const isPracticePage = location.pathname.startsWith('/practice');

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 text-slate-900 font-sans">
      {/* Desktop Left Sidebar */}
      <DesktopSidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header Bar */}
        <header className="md:hidden sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 py-3 flex items-center justify-between">
          <Link to="/home" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center text-white shadow-xs">
              <Mic className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-slate-900 text-sm block leading-tight">Speech Practice</span>
              <span className="text-[10px] text-slate-500 font-medium block">Home Companion</span>
            </div>
          </Link>

          <Link
            to="/settings"
            className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            aria-label="Settings and Profile"
          >
            <Settings className="w-5 h-5" />
          </Link>
        </header>

        {/* Page Content */}
        <main
          className={`flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8 ${
            isPracticePage ? 'pb-28 md:pb-12' : 'pb-24 md:pb-12'
          }`}
        >
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileNavigation />
    </div>
  );
};
