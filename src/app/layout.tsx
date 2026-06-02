import './globals.css';
import React from 'react';

export const metadata = {
  title: 'Hermes Hub - Dashboard',
  description: 'Enterprise task dashboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="h-full bg-primary-50">
      <body className="h-full bg-primary-50 text-primary-900 antialiased font-sans">
        {/* The E2E-compliant data-testid="app-shell" wrapper container */}
        <div 
          data-testid="app-shell" 
          className="min-h-screen flex flex-col lg:flex-row bg-primary-50"
        >
          {/* Mobile responsive drawer controller - Pure CSS Checkbox Hack */}
          <input 
            type="checkbox" 
            id="sidebar-mobile-toggle" 
            className="peer hidden" 
          />

          {/* Sidebar Navigation Panel (Premium Tailwind Design) */}
          <aside className="
            fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-primary-900 text-primary-100 border-r border-primary-800/80
            transform -translate-x-full transition-transform duration-300 ease-in-out
            peer-checked:translate-x-0
            lg:translate-x-0 lg:static lg:z-auto lg:flex
          ">
            {/* Header: Logo and Brand Title */}
            <div className="flex h-16 shrink-0 items-center justify-between px-6 border-b border-primary-800/60 bg-primary-950/40">
              <div className="flex items-center gap-3">
                {/* Premium Golden Winged Logo SVG */}
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-gold-400 to-gold-600 shadow-md shadow-gold-500/20">
                  <svg className="w-5 h-5 text-primary-950 font-bold" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div className="flex flex-col">
                  <span className="text-lg font-extrabold tracking-wide bg-gradient-to-r from-gold-300 via-gold-400 to-gold-200 bg-clip-text text-transparent">
                    HERMES
                  </span>
                  <span className="text-[10px] font-semibold text-gold-500/80 tracking-widest uppercase -mt-1">
                    Task Dashboard
                  </span>
                </div>
              </div>

              {/* Close Drawer Button for Mobile */}
              <label htmlFor="sidebar-mobile-toggle" className="p-1 rounded-md hover:bg-primary-800 text-primary-400 hover:text-white cursor-pointer lg:hidden">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </label>
            </div>

            {/* Navigation Menu Links */}
            <nav className="flex-1 space-y-1.5 px-4 py-6 overflow-y-auto">
              <p className="px-3 text-[10px] font-bold text-primary-500 uppercase tracking-widest mb-3">
                Main Console
              </p>

              {/* Link: Dashboard */}
              <a 
                href="/" 
                data-testid="nav-dashboard"
                className="group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-primary-300 hover:text-white hover:bg-primary-800/60 border-l-2 border-transparent hover:border-gold-500/85 transition-all duration-150"
              >
                <svg className="w-5 h-5 text-primary-400 group-hover:text-gold-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z" />
                </svg>
                Dashboard
              </a>

              {/* Link: Tasks */}
              <a 
                href="/tasks" 
                data-testid="nav-tasks"
                className="group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-primary-300 hover:text-white hover:bg-primary-800/60 border-l-2 border-transparent hover:border-gold-500/85 transition-all duration-150"
              >
                <svg className="w-5 h-5 text-primary-400 group-hover:text-gold-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                Tasks Board
              </a>

              {/* Link: Projects */}
              <a 
                href="/projects" 
                data-testid="nav-projects"
                className="group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-primary-300 hover:text-white hover:bg-primary-800/60 border-l-2 border-transparent hover:border-gold-500/85 transition-all duration-150"
              >
                <svg className="w-5 h-5 text-primary-400 group-hover:text-gold-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                Projects Console
              </a>

              {/* Link: Company Dashboard */}
              <a 
                href="/company-dashboard" 
                data-testid="nav-company-dashboard"
                className="group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-primary-300 hover:text-white hover:bg-primary-800/60 border-l-2 border-transparent hover:border-gold-500/85 transition-all duration-150"
              >
                <svg className="w-5 h-5 text-primary-400 group-hover:text-gold-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 8v8m-4-5v5m-4-2v2M2 4h20v16H2V4z" />
                </svg>
                Company Dashboard
              </a>

              {/* Link: User Dashboard */}
              <a 
                href="/user-dashboard" 
                data-testid="nav-user-dashboard"
                className="group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-primary-300 hover:text-white hover:bg-primary-800/60 border-l-2 border-transparent hover:border-gold-500/85 transition-all duration-150"
              >
                <svg className="w-5 h-5 text-primary-400 group-hover:text-gold-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                User Dashboard
              </a>

              {/* Link: Companies & Persons (Required for full E2E Coverage) */}
              <a 
                href="/companies" 
                data-testid="nav-companies"
                className="group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-primary-300 hover:text-white hover:bg-primary-800/60 border-l-2 border-transparent hover:border-gold-500/85 transition-all duration-150"
              >
                <svg className="w-5 h-5 text-primary-400 group-hover:text-gold-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                Companies
              </a>

              {/* Link: Categories */}
              <a 
                href="/categories" 
                data-testid="nav-categories"
                className="group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-primary-300 hover:text-white hover:bg-primary-800/60 border-l-2 border-transparent hover:border-gold-500/85 transition-all duration-150"
              >
                <svg className="w-5 h-5 text-primary-400 group-hover:text-gold-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                Categories
              </a>

              {/* Link: Calendar */}
              <a 
                href="/calendar" 
                data-testid="nav-calendar"
                className="group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-primary-300 hover:text-white hover:bg-primary-800/60 border-l-2 border-transparent hover:border-gold-500/85 transition-all duration-150"
              >
                <svg className="w-5 h-5 text-primary-400 group-hover:text-gold-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Calendar
              </a>

              {/* Link: Settings */}
              <a 
                href="/settings" 
                data-testid="nav-settings"
                className="group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-primary-300 hover:text-white hover:bg-primary-800/60 border-l-2 border-transparent hover:border-gold-500/85 transition-all duration-150"
              >
                <svg className="w-5 h-5 text-primary-400 group-hover:text-gold-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Settings Hub
              </a>
            </nav>

            {/* Footer Profile Container */}
            <div className="shrink-0 border-t border-primary-800/80 bg-primary-950/20 p-4">
              <div className="flex items-center gap-3 rounded-lg p-2 hover:bg-primary-800/40 transition-colors">
                {/* Premium gold-bordered avatar outline */}
                <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-gold-500 to-gold-400 p-[1.5px] shadow-sm">
                  <div className="h-full w-full rounded-full bg-primary-880 flex items-center justify-center overflow-hidden">
                    <span className="text-xs font-bold text-gold-400">AS</span>
                  </div>
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-semibold text-white truncate">Alice Smith</span>
                  <span className="text-[10px] text-gold-500 font-medium tracking-wide uppercase -mt-0.5">Admin Role</span>
                </div>
              </div>
            </div>
          </aside>

          {/* Interactive drawer overlay backdrop for Mobile */}
          <label 
            htmlFor="sidebar-mobile-toggle" 
            className="fixed inset-0 z-40 bg-black/60 opacity-0 pointer-events-none transition-opacity duration-300 peer-checked:opacity-100 peer-checked:pointer-events-auto lg:hidden"
          />

          {/* Core Page Content Shell */}
          <div className="flex flex-col flex-1 min-h-screen overflow-hidden">
            {/* Header for Mobile (lg:hidden) */}
            <header className="lg:hidden flex h-16 shrink-0 items-center justify-between px-6 bg-primary-900 border-b border-primary-850 shadow-md">
              <div className="flex items-center gap-3">
                <label 
                  htmlFor="sidebar-mobile-toggle" 
                  className="p-1 rounded-md text-primary-300 hover:text-white cursor-pointer select-none"
                >
                  {/* Hamburger Menu Icon */}
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </label>
                <span className="text-md font-bold tracking-wider text-gold-400">HERMES HUB</span>
              </div>

              {/* Mini avatar */}
              <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-gold-500 to-gold-400 p-[1px]">
                <div className="h-full w-full rounded-full bg-primary-850 flex items-center justify-center">
                  <span className="text-[10px] font-bold text-gold-400">AS</span>
                </div>
              </div>
            </header>

            {/* Scrollable Main Area containing page components */}
            <main className="flex-1 overflow-y-auto bg-primary-50 focus:outline-none">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
