'use client';

import React, { useState } from 'react';
import HslAvatar from './HslAvatar';

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

  if (!session) return <div className="px-6 py-5 text-sm text-primary-200"><strong>Segundo Cerebro</strong><p>Inicia sesión para entrar</p></div>;

  // Fallback if session is somehow missing but middleware let it pass
  const name = session?.name || 'User Profile';
  const role = session?.role || 'Member';

  const isLocal = session.userId.startsWith('local-');
  return (
    <div className="shrink-0 border-t border-primary-800/80 bg-primary-950/20 p-4">
      {isLocal && (
        <div className="mb-2 flex gap-3 px-2 text-[11px] text-primary-300">
          <a href="/mi-agente" className="hover:text-white underline-offset-2 hover:underline">Mi agente</a>
          <a href="/cambiar-clave" className="hover:text-white underline-offset-2 hover:underline">Cambiar clave</a>
        </div>
      )}
      <div className="flex items-center justify-between gap-2 rounded-lg p-2 hover:bg-primary-800/20 transition-colors">
        <div className="flex items-center gap-3 min-w-0">
          {/* HslAvatar dynamic rendering */}
          <HslAvatar name={name} size={9} />
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-semibold text-white truncate" title={name}>
              {name}
            </span>
            <span className="text-[10px] text-gold-500 font-medium tracking-wide uppercase -mt-0.5 truncate" title={role}>
              {role}
            </span>
          </div>
        </div>

        <button
          onClick={handleLogout}
          disabled={loading}
          className="p-1.5 rounded-lg hover:bg-red-950/40 text-primary-400 hover:text-red-400 transition"
          title="Cerrar sesión" aria-label="Cerrar sesión"
        >
          {loading ? (
            <span className="animate-spin text-xs">🔄</span>
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
