'use client';
import React, { useState } from 'react';

export default function CambiarClavePage() {
  const [f, setF] = useState({ current: '', next: '', again: '' });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (f.next !== f.again) return setMsg({ ok: false, text: 'Las contraseñas nuevas no coinciden.' });
    const r = await fetch('/api/auth/password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ current: f.current, next: f.next }) });
    const d = await r.json().catch(() => ({}));
    if (r.ok) { setMsg({ ok: true, text: 'Contraseña cambiada.' }); setTimeout(() => { window.location.href = '/'; }, 800); } else setMsg({ ok: false, text: d.error || 'No se pudo cambiar.' });
  }
  const input = 'w-full rounded-lg border border-primary-300 px-3 py-2 text-sm';
  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-bold mb-1">Cambiar contraseña</h1>
      <p className="text-sm text-primary-600 mb-4">Escribe la contraseña actual (la temporal si es tu primer acceso) y elige una nueva de 12 caracteres o más.</p>
      <form onSubmit={submit} className="space-y-3">
        <input className={input} type="password" placeholder="Contraseña actual" value={f.current} onChange={set('current')} autoComplete="current-password" />
        <input className={input} type="password" placeholder="Contraseña nueva" value={f.next} onChange={set('next')} autoComplete="new-password" />
        <input className={input} type="password" placeholder="Repite la nueva" value={f.again} onChange={set('again')} autoComplete="new-password" />
        {msg && <p className={`text-sm ${msg.ok ? 'text-green-700' : 'text-red-600'}`}>{msg.text}</p>}
        <button className="w-full rounded-lg bg-primary-900 px-3 py-2 text-sm font-semibold text-white">Guardar</button>
      </form>
    </div>
  );
}
