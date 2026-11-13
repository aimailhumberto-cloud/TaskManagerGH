'use client';

import React, { useState } from 'react';
import HslAvatar from './HslAvatar';
import { useUiLang } from '@/lib/uiLang';

interface FooterProfileProps {
  session: {
    userId: string;
    personId: string;
    email: string;
    role: string;
    companyId?: string;
    name?: string; // added name support dynamically
  } | null;
}

export default function FooterProfile({ session }: FooterProfileProps) {
  const [loading, setLoading] = useState(false);
  const { lang, setLang, L } = useUiLang();

  const handleLogout = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/logout', {
        method: 'POST',
      });
      if (res.ok) {
        window.location.href = '/login';
      }
    } catch (e) {
      console.error('Logout error:', e);
    } finally {
      setLoading(false);
    }
  };

  if (!session) return <div className="px-6 py-5 text-sm text-[#dbeafe]"><strong>{L('Segundo Cerebro', 'Second Brain')}</strong><p>{L('Inicia sesión para entrar', 'Sign in to enter')}</p></div>;

  // Fallback if session is somehow missing but middleware let it pass
  const name = session?.name || session.email;
  const role = session?.role || 'Member';

  const isLocal = session.userId.startsWith('local-');
  return (
    <div className="shrink-0 border-t border-white/10 p-4">
      {isLocal && (
        <div className="mb-2 flex items-center gap-2.5 px-1 text-[11px] whitespace-nowrap text-[#9fdcff]">
          <a href="/mi-agente" className="hover:text-white underline-offset-2 hover:underline">{L('Mi agente', 'My agent')}</a>
          <a href="/cambiar-clave" className="hover:text-white underline-offset-2 hover:underline">{L('Cambiar clave', 'Change password')}</a>
          <span className="ml-auto flex overflow-hidden rounded-full border border-white/25" role="group" aria-label={L('Idioma', 'Language')}>
            {(['es', 'en'] as const).map(l => (<button key={l} onClick={() => setLang(l)} aria-pressed={lang === l} className={`px-2 py-0.5 text-[10px] font-bold uppercase ${lang === l ? 'bg-[#00a8f0] text-[#0b1f4d]' : 'text-[#9fdcff] hover:text-white'}`}>{l}</button>))}
          </span>
        </div>
      )}
      <div className="flex items-center justify-between gap-2 rounded-lg p-2 hover:bg-white/10 transition-colors">
        <div className="flex items-center gap-3 min-w-0">
          {/* HslAvatar dynamic rendering */}
          <HslAvatar name={name} size={9} />
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-semibold text-white truncate" title={name}>
              {name}
            </span>
            <span className="text-[10px] text-[#9fdcff] font-medium tracking-wide uppercase -mt-0.5 truncate" title={role}>
              {role}
            </span>
          </div>
        </div>

        <button
          onClick={handleLogout}
          disabled={loading}
          className="p-1.5 rounded-lg hover:bg-white/10 text-[#9fdcff] hover:text-white transition"
          title={L('Cerrar sesión', 'Sign out')} aria-label={L('Cerrar sesión', 'Sign out')}
        >
          {loading ? (
            <span className="text-xs">…</span>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
