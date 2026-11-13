'use client';
import React, { useEffect, useState } from 'react';
import { useUiLang } from '@/lib/uiLang';

export default function SetupPage() {
  const { L } = useUiLang();
  const [available, setAvailable] = useState<boolean | null>(null);
  const [f, setF] = useState({ token: '', name: '', email: '', password: '', again: '' });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { fetch('/api/auth/setup').then(r => r.json()).then(d => setAvailable(!!d.available)).catch(() => setAvailable(false)); }, []);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setMsg(null);
    if (f.password !== f.again) return setMsg({ ok: false, text: L('Las contraseñas no coinciden.', 'The passwords do not match.') });
    setBusy(true);
    const r = await fetch('/api/auth/setup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: f.token, name: f.name, email: f.email, password: f.password }) });
    const d = await r.json().catch(() => ({})); setBusy(false);
    if (r.ok) { setMsg({ ok: true, text: L('Listo. Ya puedes iniciar sesión.', 'Done. You can now sign in.') }); setAvailable(false); } else setMsg({ ok: false, text: d.error || L('No se pudo completar.', 'Could not complete.') });
  }
  const input = 'w-full rounded-lg border border-primary-300 px-3 py-2 text-sm';
  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-bold mb-1">{L('Configuración inicial', 'Initial setup')}</h1>
      <p className="text-sm text-primary-600 mb-4">{L('Crea el primer administrador. Solo funciona una vez y con el código de configuración que pusiste en Render (variable ', 'Create the first administrator. It works only once and with the setup code you set in Render (variable ')}<code>SETUP_TOKEN</code>).</p>
      {available === null && <p className="text-sm">{L('Comprobando…', 'Checking…')}</p>}
      {available === false && !msg?.ok && <p className="rounded-lg bg-amber-50 p-3 text-sm">{L('No está disponible: o ya existe un administrador, o falta ', 'Not available: either an administrator already exists, or ')}<code>SETUP_TOKEN</code> {L('(16 caracteres o más) en Render.', '(16 characters or more) is missing in Render.')}</p>}
      {msg?.ok && <p className="rounded-lg bg-green-50 p-3 text-sm">{msg.text} <a className="underline" href="/login">{L('Ir al login', 'Go to sign in')}</a></p>}
      {available && (
        <form onSubmit={submit} className="space-y-3">
          <input className={input} type="password" placeholder={L('Código de configuración', 'Setup code')} value={f.token} onChange={set('token')} autoComplete="off" />
          <input className={input} placeholder={L('Tu nombre', 'Your name')} value={f.name} onChange={set('name')} />
          <input className={input} type="email" placeholder={L('Tu correo', 'Your email')} value={f.email} onChange={set('email')} autoComplete="username" />
          <input className={input} type="password" placeholder={L('Contraseña (12 caracteres o más)', 'Password (12 characters or more)')} value={f.password} onChange={set('password')} autoComplete="new-password" />
          <input className={input} type="password" placeholder={L('Repite la contraseña', 'Repeat the password')} value={f.again} onChange={set('again')} autoComplete="new-password" />
          {msg && !msg.ok && <p className="text-sm text-red-600">{msg.text}</p>}
          <button disabled={busy} className="w-full rounded-lg bg-primary-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? L('Creando…', 'Creating…') : L('Crear administrador', 'Create administrator')}</button>
        </form>
      )}
    </div>
  );
}
