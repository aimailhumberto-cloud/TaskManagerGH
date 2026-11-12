'use client';
import React, { useCallback, useEffect, useState } from 'react';

type Acc = { id: string; email: string; name: string; role: string; isActive: boolean; mustChange: boolean; createdAt: string; lastLoginAt?: string };
const genPassword = () => { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'; const b = crypto.getRandomValues(new Uint32Array(16)); return Array.from(b, n => a[n % a.length]).join('') + '-7'; };

export default function UsuariosPage() {
  const [accounts, setAccounts] = useState<Acc[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
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
    if (await call('/api/admin/users', 'POST', form)) { setInfo(`Cuenta creada. Entrégale esta contraseña temporal (no se vuelve a mostrar): ${pw}`); setForm({ name: '', email: '', role: 'Miembro', password: genPassword() }); }
  }
  async function reset(a: Acc) {
    const pw = genPassword();
    if (await call(`/api/admin/users/${a.id}`, 'PATCH', { newPassword: pw })) setInfo(`Contraseña temporal de ${a.email} (no se vuelve a mostrar): ${pw}`);
  }
  const input = 'rounded-lg border border-primary-300 px-3 py-2 text-sm';
  return (
    <div className="mx-auto max-w-4xl p-6 space-y-6">
      <div><h1 className="text-xl font-bold">Usuarios y perfiles</h1>
        <p className="text-sm text-primary-600">Crea cuentas, cambia roles, desactiva accesos y restablece contraseñas. Las contraseñas nunca se guardan en claro.</p></div>
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {info && <p className="rounded-lg bg-green-50 p-3 text-sm break-all">{info}</p>}
      {!error && (<>
        <form onSubmit={create} className="grid gap-2 sm:grid-cols-5 rounded-xl border border-primary-200 p-4">
          <input className={input} placeholder="Nombre" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <input className={input} type="email" placeholder="Correo" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          <select className={input} value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>{roles.map(r => <option key={r}>{r}</option>)}</select>
          <input className={input} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} aria-label="Contraseña temporal" />
          <button className="rounded-lg bg-primary-900 px-3 py-2 text-sm font-semibold text-white">Crear usuario</button>
          <p className="sm:col-span-5 text-xs text-primary-500">La persona deberá cambiar la contraseña temporal al entrar. Mínimo 12 caracteres.</p>
        </form>
        <div className="overflow-x-auto rounded-xl border border-primary-200">
          <table className="w-full text-sm"><thead className="bg-primary-100 text-left"><tr><th className="p-2">Nombre</th><th className="p-2">Correo</th><th className="p-2">Rol</th><th className="p-2">Estado</th><th className="p-2">Último acceso</th><th className="p-2"></th></tr></thead>
            <tbody>{accounts.map(a => (
              <tr key={a.id} className="border-t border-primary-100">
                <td className="p-2">{a.name}</td><td className="p-2">{a.email}</td>
                <td className="p-2"><select className="rounded border border-primary-300 px-1 py-0.5" value={a.role} onChange={e => call(`/api/admin/users/${a.id}`, 'PATCH', { role: e.target.value })}>{roles.map(r => <option key={r}>{r}</option>)}</select></td>
                <td className="p-2">{a.isActive ? 'Activa' : 'Desactivada'}{a.mustChange ? ' · debe cambiar clave' : ''}</td>
                <td className="p-2">{a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleString('es-PA') : 'Nunca'}</td>
                <td className="p-2 whitespace-nowrap space-x-2"><button className="underline" onClick={() => reset(a)}>Restablecer clave</button><button className="underline" onClick={() => call(`/api/admin/users/${a.id}`, 'PATCH', { isActive: !a.isActive })}>{a.isActive ? 'Desactivar' : 'Activar'}</button></td>
              </tr>))}
              {accounts.length === 0 && <tr><td className="p-3 text-primary-500" colSpan={6}>Aún no hay cuentas propias.</td></tr>}
            </tbody></table>
        </div>
      </>)}
    </div>
  );
}
