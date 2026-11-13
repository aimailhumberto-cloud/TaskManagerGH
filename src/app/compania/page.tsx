'use client';
import React, { useCallback, useEffect, useState } from 'react';

type Shared = { brainId: string; owner: string; id: string; title: string; type: string; visibility: string; excerpt: string };
export default function CompaniaPage() {
  const [st, setSt] = useState<{ companyExists: boolean; viewing: string | null; canEditCompany: boolean } | null>(null);
  const [shared, setShared] = useState<Shared[] | null>(null);
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const load = useCallback(async () => { const r = await fetch('/api/brain-view', { cache: 'no-store' }); if (r.ok) setSt(await r.json()); else setMsg('Inicia sesión con tu cuenta.'); }, []);
  const search = useCallback(async (text: string) => { const r = await fetch(`/api/agent/shared?q=${encodeURIComponent(text)}`, { cache: 'no-store' }); const d = await r.json().catch(() => ({})); setShared(r.ok ? d.results : []); }, []);
  useEffect(() => { load(); search(''); }, [load, search]);
  const view = async (brainId: string | null) => { const r = await fetch('/api/brain-view', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brainId }) }); if (r.ok && brainId) window.location.href = '/cerebro'; else { const d = await r.json().catch(() => ({})); if (!r.ok) setMsg(d.error || 'No se pudo.'); await load(); } };
  const create = async () => { const r = await fetch('/api/admin/brain-view', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create_company' }) }); const d = await r.json().catch(() => ({})); setMsg(r.ok ? 'Cerebro de la compañía creado.' : d.error || 'No se pudo crear.'); await load(); };
  const btn = 'rounded-lg bg-primary-900 px-3 py-2 text-sm font-semibold text-white';
  return (
    <div className="mx-auto max-w-3xl p-6 space-y-5">
      <div><h1 className="text-xl font-bold">Compañía</h1><p className="text-sm text-primary-600">El cerebro compartido de la compañía y lo que otras personas decidieron compartir contigo.</p></div>
      {msg && <p className="rounded-lg bg-amber-50 p-3 text-sm">{msg}</p>}
      {st && (
        <div className="rounded-xl border border-primary-200 p-4 space-y-2">
          <h2 className="text-sm font-semibold">Cerebro de la compañía</h2>
          {!st.companyExists && <p className="text-sm text-primary-600">Todavía no existe.{st.canEditCompany ? '' : ' Lo crea un administrador.'}</p>}
          {!st.companyExists && st.canEditCompany && <button className={btn} onClick={create}>Crear el cerebro de la compañía</button>}
          {st.companyExists && st.viewing !== 'compania' && <><p className="text-sm text-primary-600">{st.canEditCompany ? 'Puedes consultarlo y editarlo.' : 'Puedes consultarlo; solo los administradores lo editan.'}</p><button className={btn} onClick={() => view('compania')}>Abrir el cerebro de la compañía</button></>}
          {st.viewing === 'compania' && <><p className="text-sm">Ahora mismo «Cerebro» muestra el de la compañía.</p><button className={btn} onClick={() => view(null)}>Volver a mi cerebro</button></>}
        </div>
      )}
      <div className="rounded-xl border border-primary-200 p-4 space-y-2">
        <h2 className="text-sm font-semibold">Compartido conmigo</h2>
        <p className="text-xs text-primary-500">Solo aparece lo que su dueño marcó para compartir. Lo privado de los demás nunca sale de su cerebro. Cada consulta queda registrada.</p>
        <form onSubmit={e => { e.preventDefault(); search(q); }} className="flex gap-2"><input className="flex-1 rounded-lg border border-primary-300 px-3 py-2 text-sm" placeholder="Buscar en lo compartido" value={q} onChange={e => setQ(e.target.value)} /><button className={btn}>Buscar</button></form>
        {shared && shared.length === 0 && <p className="text-sm text-primary-500">Nadie ha compartido nada contigo todavía.</p>}
        <ul className="divide-y divide-primary-100">{(shared || []).map(s => (
          <li key={s.brainId + s.id} className="py-2"><p className="text-sm font-semibold">{s.title} <span className="font-normal text-primary-500">· {s.type} · de {s.owner}</span></p><p className="text-xs text-primary-600">{s.excerpt}</p></li>))}</ul>
      </div>
    </div>
  );
}
