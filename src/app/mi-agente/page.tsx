'use client';
import React, { useCallback, useEffect, useState } from 'react';
import PageHero from '@/components/PageHero';
import { usePagesT } from '@/lib/pagesI18n';

type K = { id: string; name: string; scope: string; hint: string; createdAt: string; lastUsedAt?: string; revokedAt?: string };
const SCOPE_TEXT: Record<string, string> = {
  leer: 'Leer: solo consulta tu cerebro.',
  proponer: 'Proponer: consulta, captura notas y tareas, pospone o rechaza propuestas. No aprueba.',
  escribir: 'Escribir: todo lo anterior, y además aprueba, deshace y sincroniza la bóveda.',
};
const SCOPE_NAME: Record<string, string> = { leer: 'Leer', proponer: 'Proponer', escribir: 'Escribir' };

export default function MiAgentePage() {
  const { T, locale } = usePagesT();
  const [keys, setKeys] = useState<K[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const [f, setF] = useState({ name: '', scope: 'proponer' });
  const load = useCallback(async () => {
    const r = await fetch('/api/keys', { cache: 'no-store' }); const d = await r.json().catch(() => ({}));
    if (r.ok) { setKeys(d.keys); setError(null); } else setError(d.error || 'Sin acceso.');
  }, []);
  useEffect(() => { load(); }, [load]);
  async function call(body: unknown) {
    const r = await fetch('/api/keys', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setError(d.error || 'No se pudo completar.'); return null; }
    setError(null); await load(); return d;
  }
  async function create(e: React.FormEvent) { e.preventDefault(); setFresh(null); const d = await call(f); if (d?.key) { setFresh(d.key); setF({ name: '', scope: 'proponer' }); } }
  const input = 'rounded-xl border border-[#dbe4f3] bg-[#f2f6fd] px-3 py-2 text-sm outline-none focus:border-[#0a3fbf]';
  // La dirección se lee después de cargar, para que el servidor y el navegador pinten lo mismo al inicio.
  const [base, setBase] = useState('');
  useEffect(() => { setBase(window.location.origin); }, []);
  return (
    <div className="min-h-full bg-[#f2f6fd] text-[#0b1f4d]" style={{ fontFamily: 'Poppins, system-ui, sans-serif' }}>
      <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
        <PageHero title={T('Mi agente')} subtitle={T('Tu agente de IA, conectado a tu cerebro.')} />
        <p className="text-sm text-slate-600">{T('Crea una llave para conectar tu agente de IA a tu cerebro. La llave abre solo tu cerebro, nunca el de otra persona.')}</p>
        {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{T(error)}</p>}
        {fresh && (
          <div className="space-y-1 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            <p className="font-semibold">{T('Copia esta llave ahora. No se vuelve a mostrar.')}</p>
            <p className="select-all break-all font-mono">{fresh}</p>
            <p className="text-xs">{T('Guárdala en la configuración secreta de tu agente. No la pegues en chats ni en notas.')}</p>
          </div>
        )}
        <form onSubmit={create} className="rounded-2xl border border-[#dbe4f3] bg-white p-5 shadow-[0_12px_28px_-18px_rgba(11,31,77,0.22)] grid gap-2 sm:grid-cols-3">
          <input className={input} placeholder={T('Nombre del agente')} value={f.name} onChange={e => setF({ ...f, name: e.target.value })} />
          <select className={input} value={f.scope} onChange={e => setF({ ...f, scope: e.target.value })} aria-label={T('Alcance')}><option value="leer">{T('Leer')}</option><option value="proponer">{T('Proponer')}</option><option value="escribir">{T('Escribir')}</option></select>
          <button className="rounded-xl bg-[#0a3fbf] px-4 py-2 text-sm font-semibold text-white hover:bg-[#08318f]">{T('Crear llave')}</button>
          <p className="text-xs text-slate-500 sm:col-span-3">{T(SCOPE_TEXT[f.scope])}</p>
        </form>
        <div className="divide-y divide-[#eef3fb] rounded-2xl border border-[#dbe4f3] bg-white shadow-[0_12px_28px_-18px_rgba(11,31,77,0.22)]">
          {(keys || []).map(k => (
            <div key={k.id} className="flex items-center justify-between gap-3 p-4 text-sm">
              <div className="min-w-0">
                <p className="font-semibold">{k.name} <span className="rounded-full bg-[#eef3fb] px-2 py-0.5 text-xs font-medium text-[#0a3fbf]">{T(SCOPE_NAME[k.scope] || k.scope)}</span></p>
                <p className="font-mono text-xs text-slate-500">{k.hint}</p>
                <p className="text-xs text-slate-500">{k.revokedAt ? T('Revocada') : k.lastUsedAt ? `${T('Último uso:')} ${new Date(k.lastUsedAt).toLocaleString(locale)}` : T('Sin usar')}</p>
              </div>
              {!k.revokedAt && <button className="shrink-0 text-xs font-medium text-rose-700 underline underline-offset-2" onClick={() => call({ action: 'revoke', id: k.id })}>{T('Revocar')}</button>}
            </div>))}
          {keys && keys.length === 0 && <p className="p-4 text-sm text-slate-500">{T('Aún no tienes llaves.')}</p>}
        </div>
        <div className="rounded-2xl border border-[#dbe4f3] bg-white p-5 shadow-[0_12px_28px_-18px_rgba(11,31,77,0.22)] space-y-1.5 text-sm">
          <h2 className="text-base font-semibold">{T('Cómo se conecta tu agente')}</h2>
          <p>{T('Dirección:')} <span className="font-mono">{base}</span></p>
          <p>{T('En cada llamada, el encabezado')} <span className="font-mono">x-agent-key: tu-llave</span> {T('(o')} <span className="font-mono">Authorization: Bearer tu-llave</span>).</p>
          <div className="space-y-1 rounded-xl bg-[#0b1f4d] p-3 font-mono text-xs text-[#dbeafe]">
            <p>GET /api/agent/dossier?q=Busta en Canadá · GET /api/agent/search?q=…</p>
            <p>GET /api/agent/brief · GET /api/agent/changes?since=AAAA-MM-DD</p>
            <p>POST /api/agent/brain {'{'}"action":"record","nodeId":"…","summary":"…"{'}'}</p>
            <p>GET /api/agent/brain?node=… · GET /api/agent/tasks · GET /api/agent/dots-sleep</p>
            <p>POST /api/agent/brain {'{'}"action":"remember_working","title":"…","content":"…"{'}'}</p>
            <p>POST /api/agent/tasks {'{'}"action":"create","title":"…","dueDate":"AAAA-MM-DD"{'}'}</p>
            <p>GET /api/agent/dashboard?guide=1 · GET /api/agent/assets</p>
          </div>
        </div>
      </div>
    </div>
  );
}
