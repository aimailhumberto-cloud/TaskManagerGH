'use client';

import React, { useState } from 'react';

export default function LoginPage() {
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
        window.location.href = '/';
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
    <div className="min-h-screen flex items-center justify-center bg-[#faf9f6] px-4 py-12 sm:px-6 lg:px-8 relative overflow-hidden font-sans">
      {/* Background dynamic blur gradients for a premium feel */}
      <div className="absolute top-0 left-0 w-80 h-80 bg-gradient-to-br from-gold-300/10 to-gold-500/10 rounded-full blur-3xl -ml-20 -mt-20"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-gradient-to-br from-primary-400/5 to-gold-600/10 rounded-full blur-3xl -mr-20 -mb-20"></div>

      <div className="max-w-md w-full space-y-8 bg-white border border-gold-200/50 rounded-3xl p-8 md:p-10 shadow-xl relative backdrop-blur-md">
        {/* Header Branding */}
        <div className="text-center">
          <div className="relative inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-gold-400 via-gold-500 to-gold-600 shadow-lg mb-4">
            <span className="font-serif text-white font-bold text-2xl select-none">H</span>
            <div className="absolute inset-0.5 rounded-[14px] border border-white/25"></div>
          </div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-primary-900 via-gold-800 to-gold-600 bg-clip-text text-transparent">
            HERMES TASK HUB
          </h2>
          <p className="text-xs uppercase tracking-widest text-gold-600 font-bold leading-none mt-1">
            Sign in to your account
          </p>
        </div>

        {/* Login Form */}
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div
              id="login-error-message"
              className="text-xs font-bold text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3 shadow-sm animate-pulse flex items-center gap-2"
            >
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="email-address" className="block text-xs font-semibold text-primary-600 uppercase tracking-wider mb-2">
                Correo Electrónico
              </label>
              <input
                id="email-address"
                name="email"
                type="text"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ej: usuario@holding.com"
                className="w-full px-4 py-3 bg-[#faf9f6] border border-primary-200 rounded-xl text-sm text-primary-900 placeholder-primary-400 focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-gold-500 transition-all duration-200"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-primary-600 uppercase tracking-wider mb-2">
                Contraseña
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 bg-[#faf9f6] border border-primary-200 rounded-xl text-sm text-primary-900 placeholder-primary-400 focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-gold-500 transition-all duration-200"
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-gold-500 via-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-white rounded-xl font-bold text-sm shadow-md shadow-gold-500/10 hover:shadow-lg transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="animate-spin">🔄</span>
                  Iniciando sesión...
                </>
              ) : (
                <>
                  <span>🔐</span>
                  Ingresar al Sistema
                </>
              )}
            </button>
          </div>
        </form>

        {/* Demo instructions */}
        <div className="border-t border-primary-150 pt-4 mt-6 text-center text-[10px] text-primary-450">
          <p className="font-semibold text-gold-650 mb-1">🔑 Credenciales de Demostración:</p>
          <p>Email: <span className="font-mono bg-primary-100 px-1 py-0.5 rounded">admin@hermes.com</span> | Contraseña: <span className="font-mono bg-primary-100 px-1 py-0.5 rounded">admin123</span></p>
        </div>
      </div>
    </div>
  );
}
