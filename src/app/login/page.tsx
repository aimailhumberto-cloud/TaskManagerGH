'use client';

import React, { useState } from 'react';
import { usePagesT } from '@/lib/pagesI18n';

export default function LoginPage() {
  const { T, lang, setLang } = usePagesT();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Simple validations
    if (!email.trim() || !password) {
      setError('Por favor, ingresa tu correo y contraseña.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError('Por favor, ingresa un formato de correo válido (ej: usuario@empresa.com).');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          password: password,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Redirect to homepage upon successful auth
        window.location.href = data.user?.mustChange ? '/cambiar-clave' : '/';
      } else {
        setError(data.error || 'Credenciales de acceso inválidas. Revisa tus datos.');
      }
    } catch (err) {
      console.error('Login request error:', err);
      setError('Error de conexión. Inténtalo de nuevo más tarde.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] grid overflow-y-auto bg-[#f2f6fd] text-[#0b1f4d] lg:grid-cols-2" style={{ fontFamily: 'Poppins, system-ui, sans-serif' }}>
      <div className="relative hidden overflow-hidden bg-[#0a3fbf] lg:block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brands/smj-bebidas-hero.jpg" alt={T('Bebidas de S.M. Jaleel')} className="absolute inset-0 h-full w-full object-cover" />
        <div aria-hidden className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(10,63,191,0.92) 0%, rgba(10,63,191,0.55) 45%, rgba(11,31,77,0.15) 100%)' }} />
        <div className="relative p-12">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brands/smjaleel_white.png" alt="S.M. Jaleel" className="h-20 w-20 rounded-full bg-white" />
          <h1 className="mt-6 text-4xl font-bold text-white">{T('Segundo Cerebro')}</h1>
          <p className="mt-2 max-w-sm text-lg text-[#dbeafe]">{T('La memoria de la compañía, al alcance de cada persona.')}</p>
        </div>
      </div>
      <div className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3 lg:hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brands/smjaleel_white.png" alt="S.M. Jaleel" className="h-12 w-12 rounded-full bg-white shadow" />
              <span className="text-lg font-bold">{T('Segundo Cerebro')}</span>
            </div>
            <div className="ml-auto flex overflow-hidden rounded-full border border-[#dbe4f3] bg-white text-xs font-semibold" role="group" aria-label="Idioma / Language">
              {(['es', 'en'] as const).map(l => (
                <button key={l} type="button" onClick={() => setLang(l)} aria-pressed={lang === l} className={`px-3 py-1.5 ${lang === l ? 'bg-[#0a3fbf] text-white' : 'text-slate-600 hover:bg-[#f2f6fd]'}`}>{l.toUpperCase()}</button>
              ))}
            </div>
          </div>
          <div className="rounded-3xl border border-[#dbe4f3] bg-white p-7 shadow-[0_24px_48px_-28px_rgba(11,31,77,0.35)] sm:p-9">
            <h2 className="text-2xl font-bold">{T('Inicia sesión')}</h2>
            <p className="mt-1 text-sm text-slate-600">{T('Entra con tu cuenta para abrir tu cerebro.')}</p>
            <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
              {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{T(error)}</p>}
              <div>
                <label htmlFor="email-address" className="mb-1.5 block text-xs font-semibold text-slate-600">{T('Correo electrónico')}</label>
                <input id="email-address" name="email" type="text" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder={T('tu.nombre@empresa.com')} className="w-full rounded-xl border border-[#dbe4f3] bg-[#f2f6fd] px-3.5 py-3 text-sm outline-none focus:border-[#0a3fbf]" />
              </div>
              <div>
                <label htmlFor="password" className="mb-1.5 block text-xs font-semibold text-slate-600">{T('Contraseña')}</label>
                <input id="password" name="password" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full rounded-xl border border-[#dbe4f3] bg-[#f2f6fd] px-3.5 py-3 text-sm outline-none focus:border-[#0a3fbf]" />
              </div>
              <button type="submit" disabled={loading} className="w-full rounded-xl bg-[#0a3fbf] px-4 py-3 text-sm font-semibold text-white hover:bg-[#08318f] disabled:opacity-60">{loading ? T('Entrando...') : T('Entrar')}</button>
            </form>
          </div>
          <p className="mt-5 text-center text-xs text-slate-500">S.M. Jaleel &amp; Co. Ltd.</p>
        </div>
      </div>
    </div>
  );
}
