'use client';
import React, { useCallback, useEffect, useState } from 'react';
import PageHero from '@/components/PageHero';
import { usePagesT } from '@/lib/pagesI18n';

type Shared = { brainId: string; owner: string; id: string; title: string; type: string; visibility: string; excerpt: string };
export default function CompaniaPage() {
  const { T } = usePagesT();
  const [st, setSt] = useState<{ companyExists: boolean; viewing: string | null; canEditCompany: boolean } | null>(null);
  const [shared, setShared] = useState<Shared[] | null>(null);
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const load = useCallback(async () => { const r = await fetch('/api/brain-view', { cache: 'no-store' }); if (r.ok) setSt(await r.json()); else setMsg('Inicia sesión con tu cuenta.'); }, []);
  const search = useCallback(async (text: string) => { const r = await fetch(`/api/agent/shared?q=${encodeURIComponent(text)}`, { cache: 'no-store' }); const d = await r.json().catch(() => ({})); setShared(r.ok ? d.results : []); }, []);
  useEffect(() => { load(); search(''); }, [load, search]);
  const view = async (brainId: string | null) => { const r = await fetch('/api/brain-view', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brainId }) }); if (r.ok && brainId) window.location.href = '/cerebro'; else { const d = await r.json().catch(() => ({})); if (!r.ok) setMsg(d.error || 'No se pudo.'); await load(); } };
  const create = async () => { const r = await fetch('/api/admin/brain-view', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create_company' }) }); const d = await r.json().catch(() => ({})); setMsg(r.ok ? 'Cerebro de la compañía creado.' : d.error || 'No se pudo crear.'); await load(); };
  const btn = 'rounded-xl bg-[#0a3fbf] px-4 py-2 text-sm font-semibold text-white hover:bg-[#08318f]';
  return (
    <div className="min-h-full bg-[#f2f6fd] text-[#0b1f4d]" style={{ fontFamily: 'Poppins, system-ui, sans-serif' }}>
      <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
        <PageHero title={T('Compañía')} subtitle={T('El cerebro compartido de la compañía y lo que otras personas decidieron compartir contigo.')} />
        {msg && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{T(msg)}</p>}
        {st && (
          <div className="rounded-2xl border border-[#dbe4f3] bg-white p-5 shadow-[0_12px_28px_-18px_rgba(11,31,77,0.22)] space-y-3">
            <h2 className="text-base font-semibold">{T('Cerebro de la compañía')}</h2>
            {!st.companyExists && <p className="text-sm text-slate-600">{T('Todavía no existe.')}{st.canEditCompany ? '' : T(' Lo crea un administrador.')}</p>}
            {!st.companyExists && st.canEditCompany && <button className={btn} onClick={create}>{T('Crear el cerebro de la compañía')}</button>}
            {st.companyExists && st.viewing !== 'compania' && <><p className="text-sm text-slate-600">{st.canEditCompany ? T('Puedes consultarlo y editarlo.') : T('Puedes consultarlo; solo los administradores lo editan.')}</p><button className={btn} onClick={() => view('compania')}>{T('Abrir el cerebro de la compañía')}</button></>}
            {st.viewing === 'compania' && <><p className="text-sm">{T('Ahora mismo «Cerebro» muestra el de la compañía.')}</p><button className={btn} onClick={() => view(null)}>{T('Volver a mi cerebro')}</button></>}
          </div>
        )}
        <div className="rounded-2xl border border-[#dbe4f3] bg-white p-5 shadow-[0_12px_28px_-18px_rgba(11,31,77,0.22)] space-y-3">
          <h2 className="text-base font-semibold">{T('Compartido conmigo')}</h2>
          <p className="text-xs text-slate-500">{T('Solo aparece lo que su dueño marcó para compartir. Lo privado de los demás nunca sale de su cerebro. Cada consulta queda registrada.')}</p>
          <form onSubmit={e => { e.preventDefault(); search(q); }} className="flex gap-2"><input className="min-w-0 flex-1 rounded-xl border border-[#dbe4f3] bg-[#f2f6fd] px-3 py-2 text-sm outline-none focus:border-[#0a3fbf]" placeholder={T('Buscar en lo compartido')} value={q} onChange={e => setQ(e.target.value)} /><button className={btn}>{T('Buscar')}</button></form>
          {shared && shared.length === 0 && <p className="text-sm text-slate-500">{T('Nadie ha compartido nada contigo todavía.')}</p>}
          <ul className="divide-y divide-[#eef3fb]">{(shared || []).map(s => (
            <li key={s.brainId + s.id} className="py-2.5"><p className="text-sm font-semibold">{s.title} <span className="font-normal text-slate-500">· {s.type} · {T('de')} {s.owner}</span></p><p className="text-xs text-slate-600">{s.excerpt}</p></li>))}</ul>
        </div>
      </div>
    </div>
  );
}
