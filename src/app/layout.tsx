import './globals.css';
import React from 'react';
import { cookies } from 'next/headers';
import { decryptSession } from '@/lib/session';
import { UiLangProvider } from '@/lib/uiLang';
import FooterProfile from '@/components/FooterProfile';
import WorkspaceNavigation from '@/components/WorkspaceNavigation';
import dbService from '@/services/dbService';
import {verifiedProfile} from '@/lib/publicWorkspace';

/** Idioma de la pantalla según la cookie: la página sale ya en ese idioma, sin salto. */
const uiLangOf = async (): Promise<'es' | 'en'> => ((await cookies()).get('cerebro_lang')?.value === 'en' ? 'en' : 'es');
export async function generateMetadata() {
  const en = (await uiLangOf()) === 'en';
  return { title: en ? 'Second Brain · S.M. Jaleel' : 'Segundo Cerebro · S.M. Jaleel', description: en ? 'Tasks, business and commitments in one place' : 'Tareas, negocios y compromisos en un solo lugar' };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const uiLang: 'es' | 'en' = cookieStore.get('cerebro_lang')?.value === 'en' ? 'en' : 'es';
  const sessionCookie = cookieStore.get('hermes_session');
  let sessionData = null;
  let ownBrain = false; // sesión de una cuenta propia
  let canManage = false;
  
  if (sessionCookie && sessionCookie.value) {
    const parsed = decryptSession(sessionCookie.value);
    if (parsed) {
      if (parsed.userId.startsWith('local-')) {
        const { getAccount } = await import('@/lib/localAccounts');
        const acc = getAccount(parsed.userId);
        if (acc?.isActive) { sessionData = { userId: acc.id, personId: acc.id, email: acc.email, name: acc.name, role: acc.role }; ownBrain = true; canManage = ['Owner', 'Admin', 'Gerente'].includes(acc.role); }
      } else try {
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
    <html lang={uiLang} className="h-full bg-primary-50" suppressHydrationWarning>
      <head>
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" />
      </head>
      <body className="h-full bg-primary-50 text-primary-900 antialiased font-sans" suppressHydrationWarning>
        <UiLangProvider initial={uiLang}>
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
            fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-[#0b1f4d] text-white
            transform -translate-x-full transition-transform duration-300 ease-in-out
            peer-checked:translate-x-0
            lg:translate-x-0 lg:sticky lg:top-0 lg:h-screen lg:self-start lg:shrink-0 lg:z-auto lg:flex
          ">
            {/* Marca: logo de S.M. Jaleel */}
            <div className="flex h-[76px] shrink-0 items-center justify-between px-5 border-b border-white/10">
              <a href={ownBrain ? '/inicio' : '/'} className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/brands/smjaleel_white.png" alt="S.M. Jaleel" className="h-12 w-12 rounded-full bg-white" />
                <div className="flex flex-col">
                  <span className="text-[15px] font-bold text-white leading-tight">S.M. Jaleel</span>
                  <span className="text-[11px] font-medium text-[#9fdcff] tracking-wide">{uiLang === 'en' ? 'Second Brain' : 'Segundo Cerebro'}</span>
                </div>
              </a>

              {/* Close Drawer Button for Mobile */}
              <label htmlFor="sidebar-mobile-toggle" className="p-1 rounded-md hover:bg-white/10 text-[#9fdcff] hover:text-white cursor-pointer lg:hidden">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </label>
            </div>

            {/* Navigation Menu Links */}
            <WorkspaceNavigation publicOnly={!sessionData} local={ownBrain} canManage={canManage} userName={sessionData?.name || ''} />

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
            <header className="lg:hidden flex h-16 shrink-0 items-center justify-between px-5 bg-[#0b1f4d] shadow-md">
              <div className="flex items-center gap-3">
                <label 
                  htmlFor="sidebar-mobile-toggle" 
                  className="p-1 rounded-md text-[#9fdcff] hover:text-white cursor-pointer select-none"
                >
                  {/* Hamburger Menu Icon */}
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </label>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/brands/smjaleel_white.png" alt="" className="h-9 w-9 rounded-full bg-white" />
                <span className="text-[15px] font-bold text-white">S.M. Jaleel</span>
              </div>

              {/* Mini avatar */}
              <div className="h-8 w-8 rounded-full bg-[#00a8f0]">
                <div className="h-full w-full rounded-full flex items-center justify-center">
                  <span className="text-[10px] font-bold text-[#0b1f4d]">{sessionData?.email.slice(0, 2).toUpperCase() || 'TM'}</span>
                </div>
              </div>
            </header>

            {/* Scrollable Main Area containing page components */}
            <main className="min-w-0 flex-1 overflow-y-auto bg-[#f2f6fd] focus:outline-none pb-20 lg:pb-0">
              {children}
            </main>

            {/* Mobile Bottom Navigation Bar */}
            <WorkspaceNavigation mobile publicOnly={!sessionData} local={ownBrain} canManage={canManage} />
          </div>
        </div>
        </UiLangProvider>
      </body>
    </html>
  );
}
