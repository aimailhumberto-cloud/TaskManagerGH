'use client';
import React, { useCallback, useEffect, useState } from 'react';
import PageHero from '@/components/PageHero';
import { usePagesT } from '@/lib/pagesI18n';

type Acc = { id: string; email: string; name: string; role: string; isActive: boolean; mustChange: boolean; createdAt: string; lastLoginAt?: string };
const genPassword = () => { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'; const b = crypto.getRandomValues(new Uint32Array(16)); return Array.from(b, n => a[n % a.length]).join('') + '-7'; };

export default function UsuariosPage() {
  const { T, locale } = usePagesT();
  const [accounts, setAccounts] = useState<Acc[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [brains, setBrains] = useState<{ brains: { brainId: string; owner: string; exists: boolean }[]; viewing: string | null; mine: string } | null>(null);
  const loadBrains = useCallback(async () => { const r = await fetch('/api/admin/brain-view', { cache: 'no-store' }); setBrains(r.ok ? await r.json() : null); }, []);
  useEffect(() => { loadBrains(); }, [loadBrains]);
  async function viewBrain(brainId: string | null) { await fetch('/api/admin/brain-view', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brainId }) }); if (brainId) window.location.href = '/cerebro'; else loadBrains(); }
  const [form, setForm] = useState({ name: '', email: '', role: 'Miembro', password: genPassword() });
  const load = useCallback(async () => {
    const r = await fetch('/api/admin/users', { cache: 'no-store' });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setError(r.status === 401 ? 'Inicia sesión con una cuenta de gerencia para administrar usuarios.' : d.error || 'Sin acceso.'); return; }
    setError(null); setAccounts(d.accounts); setRoles(d.roles);
  }, []);
  useEffect(() => { load(); }, [load]);
  async function call(url: string, method: string, body: unknown) {
    setInfo(null);
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setError(d.error || 'No se pudo completar.'); return false; }
    setError(null); await load(); return true;
  }
  async function create(e: React.FormEvent) {
    e.preventDefault();
    const pw = form.password;
    if (await call('/api/admin/users', 'POST', form)) { setInfo(`${T('Cuenta creada. Entrégale esta contraseña temporal (no se vuelve a mostrar):')} ${pw}`); setForm({ name: '', email: '', role: 'Miembro', password: genPassword() }); }
  }
  async function reset(a: Acc) {
    const pw = genPassword();
    if (await call(`/api/admin/users/${a.id}`, 'PATCH', { newPassword: pw })) setInfo(`${T('Contraseña temporal de')} ${a.email} ${T('(no se vuelve a mostrar):')} ${pw}`);
  }
  const input = 'rounded-xl border border-[#dbe4f3] bg-[#f2f6fd] px-3 py-2 text-sm outline-none focus:border-[#0a3fbf]';
  return (
    <div className="min-h-full bg-[#f2f6fd] text-[#0b1f4d]" style={{ fontFamily: 'Poppins, system-ui, sans-serif' }}>
      <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
        <PageHero title={T('Usuarios y perfiles')} subtitle={T('Personas, roles y accesos al Segundo Cerebro.')} />
        <p className="text-sm text-slate-600">{T('Crea cuentas, cambia roles, desactiva accesos y restablece contraseñas. Las contraseñas nunca se guardan en claro. Para dejarle una tarea a alguien, usa ')}<a className="font-medium text-[#0a3fbf] underline underline-offset-2" href="/mis-tareas">{T('Asignar tarea')}</a>{T('. Las llaves de tu agente están en ')}<a className="font-medium text-[#0a3fbf] underline underline-offset-2" href="/mi-agente">{T('Mi agente')}</a>{T('. El cerebro compartido y lo que otros te comparten están en ')}<a className="font-medium text-[#0a3fbf] underline underline-offset-2" href="/compania">{T('Compañía')}</a>.</p>
        {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{T(error)}</p>}
        {info && <p className="break-all rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{info}</p>}
        {!error && brains && (
          <div className="rounded-2xl border border-[#dbe4f3] bg-white p-5 shadow-[0_12px_28px_-18px_rgba(11,31,77,0.22)] space-y-2">
            <h2 className="text-base font-semibold">{T('Cerebros')}</h2>
            <p className="text-xs text-slate-500">{T('Cada persona ve solo su cerebro. Como administrador puedes abrir cualquiera; cada vez que lo haces queda registrado.')}</p>
            {brains.viewing && brains.viewing !== brains.mine && (
              <p className="rounded-xl bg-amber-50 p-2 text-xs text-amber-900">{T('Estás viendo el cerebro')} «{brains.viewing}». <button className="font-medium text-[#0a3fbf] underline underline-offset-2" onClick={() => viewBrain(null)}>{T('Volver al mío')}</button></p>
            )}
            <ul className="divide-y divide-[#eef3fb] text-sm">
              {brains.brains.map(b => (
                <li key={b.brainId} className="flex items-center justify-between gap-3 py-2">
                  <span>{b.owner}{b.brainId === brains.mine ? T(' · el tuyo') : ''}{!b.exists ? T(' · se crea en su primer ingreso') : ''}</span>
                  {b.brainId !== brains.mine && b.exists && <button className="font-medium text-[#0a3fbf] underline underline-offset-2 shrink-0 text-xs" onClick={() => viewBrain(b.brainId)}>{T('Abrir su cerebro')}</button>}
                </li>))}
            </ul>
          </div>
        )}
        {!error && (<>
          <form onSubmit={create} className="rounded-2xl border border-[#dbe4f3] bg-white p-5 shadow-[0_12px_28px_-18px_rgba(11,31,77,0.22)] grid gap-2 sm:grid-cols-5">
            <input className={input} placeholder={T('Nombre')} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <input className={input} type="email" placeholder={T('Correo')} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            <select className={input} value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>{roles.map(r => <option key={r}>{r}</option>)}</select>
            <input className={input} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} aria-label={T('Contraseña temporal')} />
            <button className="rounded-xl bg-[#0a3fbf] px-4 py-2 text-sm font-semibold text-white hover:bg-[#08318f]">{T('Crear usuario')}</button>
            <p className="text-xs text-slate-500 sm:col-span-5">{T('La persona deberá cambiar la contraseña temporal al entrar. Mínimo 12 caracteres.')}</p>
          </form>
          <div className="overflow-x-auto rounded-2xl border border-[#dbe4f3] bg-white shadow-[0_12px_28px_-18px_rgba(11,31,77,0.22)]">
            <table className="w-full text-sm"><thead className="bg-[#eef3fb] text-left text-xs uppercase tracking-wide text-slate-600"><tr><th className="p-3">{T('Nombre')}</th><th className="p-3">{T('Correo')}</th><th className="p-3">{T('Rol')}</th><th className="p-3">{T('Estado')}</th><th className="p-3">{T('Último acceso')}</th><th className="p-3"></th></tr></thead>
              <tbody>{accounts.map(a => (
                <tr key={a.id} className="border-t border-[#eef3fb]">
                  <td className="p-3 font-medium">{a.name}</td><td className="p-3">{a.email}</td>
                  <td className="p-3"><select className="rounded-lg border border-[#dbe4f3] bg-[#f2f6fd] px-2 py-1" value={a.role} onChange={e => call(`/api/admin/users/${a.id}`, 'PATCH', { role: e.target.value })}>{roles.map(r => <option key={r}>{r}</option>)}</select></td>
                  <td className="p-3"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${a.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{a.isActive ? T('Activa') : T('Desactivada')}</span>{a.mustChange ? T(' · debe cambiar clave') : ''}</td>
                  <td className="p-3">{a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleString(locale) : T('Nunca')}</td>
                  <td className="space-x-3 whitespace-nowrap p-3 text-xs"><button className="font-medium text-[#0a3fbf] underline underline-offset-2" onClick={() => reset(a)}>{T('Restablecer clave')}</button><button className="font-medium text-[#0a3fbf] underline underline-offset-2" onClick={() => call(`/api/admin/users/${a.id}`, 'PATCH', { isActive: !a.isActive })}>{a.isActive ? T('Desactivar') : T('Activar')}</button></td>
                </tr>))}
                {accounts.length === 0 && <tr><td className="p-4 text-slate-500" colSpan={6}>{T('Aún no hay cuentas propias.')}</td></tr>}
              </tbody></table>
          </div>
        </>)}
      </div>
    </div>
  );
}
