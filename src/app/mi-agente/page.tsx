'use client';
import React, { useCallback, useEffect, useState } from 'react';

type K = { id: string; name: string; scope: string; hint: string; createdAt: string; lastUsedAt?: string; revokedAt?: string };
const SCOPE_TEXT: Record<string, string> = {
  leer: 'Leer: solo consulta tu cerebro.',
  proponer: 'Proponer: consulta, captura notas y tareas, pospone o rechaza propuestas. No aprueba.',
  escribir: 'Escribir: todo lo anterior, y además aprueba, deshace y sincroniza la bóveda.',
};

export default function MiAgentePage() {
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
  const input = 'rounded-lg border border-primary-300 px-3 py-2 text-sm';
  const base = typeof window !== 'undefined' ? window.location.origin : '';
  return (
    <div className="mx-auto max-w-3xl p-6 space-y-5">
      <div><h1 className="text-xl font-bold">Mi agente</h1>
        <p className="text-sm text-primary-600">Crea una llave para conectar tu agente de IA a tu cerebro. La llave abre solo tu cerebro, nunca el de otra persona.</p></div>
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {fresh && (
        <div className="rounded-lg bg-green-50 p-3 text-sm space-y-1">
          <p className="font-semibold">Copia esta llave ahora. No se vuelve a mostrar.</p>
          <p className="font-mono break-all select-all">{fresh}</p>
          <p className="text-xs">Guárdala en la configuración secreta de tu agente. No la pegues en chats ni en notas.</p>
        </div>
      )}
      <form onSubmit={create} className="rounded-xl border border-primary-200 p-4 grid gap-2 sm:grid-cols-3">
        <input className={input} placeholder="Nombre del agente" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} />
        <select className={input} value={f.scope} onChange={e => setF({ ...f, scope: e.target.value })} aria-label="Alcance"><option value="leer">Leer</option><option value="proponer">Proponer</option><option value="escribir">Escribir</option></select>
        <button className="rounded-lg bg-primary-900 px-3 py-2 text-sm font-semibold text-white">Crear llave</button>
        <p className="sm:col-span-3 text-xs text-primary-500">{SCOPE_TEXT[f.scope]}</p>
      </form>
      <div className="rounded-xl border border-primary-200 divide-y divide-primary-100">
        {(keys || []).map(k => (
          <div key={k.id} className="p-3 flex items-center justify-between gap-3 text-sm">
            <div className="min-w-0">
              <p className="font-semibold">{k.name} <span className="font-normal text-primary-500">· {k.scope}</span></p>
              <p className="text-xs text-primary-500 font-mono">{k.hint}</p>
              <p className="text-xs text-primary-500">{k.revokedAt ? 'Revocada' : k.lastUsedAt ? `Último uso: ${new Date(k.lastUsedAt).toLocaleString('es-PA')}` : 'Sin usar'}</p>
            </div>
            {!k.revokedAt && <button className="underline text-xs shrink-0" onClick={() => call({ action: 'revoke', id: k.id })}>Revocar</button>}
          </div>))}
        {keys && keys.length === 0 && <p className="p-3 text-sm text-primary-500">Aún no tienes llaves.</p>}
      </div>
      <div className="rounded-xl border border-primary-200 p-4 text-sm space-y-1">
        <h2 className="font-semibold">Cómo se conecta tu agente</h2>
        <p>Dirección: <span className="font-mono">{base}</span></p>
        <p>En cada llamada, el encabezado <span className="font-mono">x-agent-key: tu-llave</span> (o <span className="font-mono">Authorization: Bearer tu-llave</span>).</p>
        <p className="font-mono text-xs">GET /api/agent/brain · GET /api/agent/tasks · GET /api/agent/dots-sleep</p>
        <p className="font-mono text-xs">POST /api/agent/brain {'{'}"action":"remember_working","title":"…","content":"…"{'}'}</p>
        <p className="font-mono text-xs">POST /api/agent/tasks {'{'}"action":"create","title":"…","dueDate":"AAAA-MM-DD"{'}'}</p>
      </div>
    </div>
  );
}
