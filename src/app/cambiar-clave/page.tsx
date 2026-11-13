'use client';
import React, { useState } from 'react';
import PageHero from '@/components/PageHero';
import { usePagesT } from '@/lib/pagesI18n';

export default function CambiarClavePage() {
  const { T } = usePagesT();
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
  const input = 'w-full rounded-xl border border-[#dbe4f3] bg-[#f2f6fd] px-3 py-2 text-sm outline-none focus:border-[#0a3fbf]';
  return (
    <div className="min-h-full bg-[#f2f6fd] text-[#0b1f4d]" style={{ fontFamily: 'Poppins, system-ui, sans-serif' }}>
      <div className="mx-auto max-w-xl space-y-5 p-4 sm:p-6">
        <PageHero title={T('Cambiar contraseña')} subtitle={T('Tu acceso, bajo tu control.')} />
        <form onSubmit={submit} className="rounded-2xl border border-[#dbe4f3] bg-white p-5 shadow-[0_12px_28px_-18px_rgba(11,31,77,0.22)] space-y-3">
          <p className="text-sm text-slate-600">{T('Escribe la contraseña actual (la temporal si es tu primer acceso) y elige una nueva de 12 caracteres o más.')}</p>
          <input className={input} type="password" placeholder={T('Contraseña actual')} value={f.current} onChange={set('current')} autoComplete="current-password" />
          <input className={input} type="password" placeholder={T('Contraseña nueva')} value={f.next} onChange={set('next')} autoComplete="new-password" />
          <input className={input} type="password" placeholder={T('Repite la nueva')} value={f.again} onChange={set('again')} autoComplete="new-password" />
          {msg && <p className={`text-sm ${msg.ok ? 'text-emerald-700' : 'text-red-600'}`} role="status">{T(msg.text)}</p>}
          <button className="w-full rounded-xl bg-[#0a3fbf] px-4 py-2 text-sm font-semibold text-white hover:bg-[#08318f]">{T('Guardar')}</button>
        </form>
      </div>
    </div>
  );
}
