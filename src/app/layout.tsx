import './globals.css';
import React from 'react';
import { cookies } from 'next/headers';
import { decryptSession } from '@/lib/session';
import FooterProfile from '@/components/FooterProfile';
import WorkspaceNavigation from '@/components/WorkspaceNavigation';
import dbService from '@/services/dbService';
import {verifiedProfile} from '@/lib/publicWorkspace';

export const metadata = {
  title: 'TaskManager · Mi trabajo',
  description: 'Tareas, negocios y compromisos en un solo lugar',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('hermes_session');
  let sessionData = null;
  
  if (sessionCookie && sessionCookie.value) {
    const parsed = decryptSession(sessionCookie.value);
    if (parsed) {
      try {
        const data=await dbService.readData();
        const person=verifiedProfile(data,parsed);
        const user=data.users.find(u=>u.id===parsed.userId)!;
        sessionData={userId:user.id,personId:person.id,email:user.email,name:person.name,role:person.role};
      } catch (e) {
        sessionData = null;
      }
    }
  }
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
                    TASKMANAGER
                  </span>
                  <span className="text-[10px] font-semibold text-gold-500/80 tracking-widest uppercase -mt-1">
                    Mi centro de trabajo
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
            <WorkspaceNavigation publicOnly={!sessionData} />

            {/* Footer Profile Container */}
            <FooterProfile session={sessionData} />
          </aside>

          {/* Interactive drawer overlay backdrop for Mobile */}
          <label 
            htmlFor="sidebar-mobile-toggle" 
            className="fixed inset-0 z-40 bg-black/60 opacity-0 pointer-events-none transition-opacity duration-300 peer-checked:opacity-100 peer-checked:pointer-events-auto lg:hidden"
          />

          {/* Core Page Content Shell */}
          <div className="flex min-w-0 flex-col flex-1 min-h-screen overflow-hidden">
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
                <span className="text-md font-bold tracking-wider text-gold-400">TASKMANAGER</span>
              </div>

              {/* Mini avatar */}
              <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-gold-500 to-gold-400 p-[1px]">
                <div className="h-full w-full rounded-full bg-primary-850 flex items-center justify-center">
                  <span className="text-[10px] font-bold text-gold-400">{sessionData?.email.slice(0, 2).toUpperCase() || 'TM'}</span>
                </div>
              </div>
            </header>

            {/* Scrollable Main Area containing page components */}
            <main className="min-w-0 flex-1 overflow-y-auto bg-primary-50 focus:outline-none pb-20 lg:pb-0">
              {children}
            </main>

            {/* Mobile Bottom Navigation Bar */}
            <WorkspaceNavigation mobile publicOnly={!sessionData} />
          </div>
        </div>
      </body>
    </html>
  );
}
