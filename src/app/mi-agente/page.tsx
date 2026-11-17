'use client';
import React, { useCallback, useEffect, useState } from 'react';
import PageHero from '@/components/PageHero';
import { usePagesT } from '@/lib/pagesI18n';
import { cleanKey, looksLikeKey, pasteToAgent, testConnection, GPT_STEPS_ES, type ConnectResult } from '@/lib/agentConnect';

type K = { id: string; name: string; scope: string; hint: string; createdAt: string; lastUsedAt?: string; revokedAt?: string };
const SCOPE_TEXT: Record<string, string> = {
  leer: 'Leer: solo consulta tu cerebro.',
  cerebro: 'Pedir y consultar: lee todo y, para cambiar algo, se lo pide al Cerebro en palabras. El Cerebro es quien escribe; cada cambio queda en el diario con deshacer.',
  proponer: 'Proponer (llave antigua): solo pide y consulta.',
  escribir: 'Escribir (llave antigua): solo pide y consulta.',
};
const SCOPE_NAME: Record<string, string> = { leer: 'Leer', cerebro: 'Pedir y consultar', proponer: 'Proponer', escribir: 'Escribir' };
type Tab = 'chatgpt' | 'claude' | 'otro';

const card = 'rounded-2xl border border-[#dbe4f3] bg-white p-5 shadow-[0_12px_28px_-18px_rgba(11,31,77,0.22)]';
const btn = 'rounded-xl bg-[#0a3fbf] px-4 py-2 text-sm font-semibold text-white hover:bg-[#08318f] disabled:opacity-50';
const ghost = 'rounded-xl border border-[#dbe4f3] bg-[#f2f6fd] px-3 py-1.5 text-xs font-semibold text-[#0a3fbf] hover:bg-[#e8eef9]';

function Num({ n, done }: { n: number; done?: boolean }) {
  return <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${done ? 'bg-emerald-600 text-white' : 'bg-[#0a3fbf] text-white'}`} aria-hidden="true">{done ? '✓' : n}</span>;
}

/** Un texto para copiar, con su botón. */
function CopyBlock({ text, label, T, mono = true, rows }: { text: string; label: string; T: (s: string) => string; mono?: boolean; rows?: number }) {
  const [ok, setOk] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(text); } catch {
      const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); } catch {} document.body.removeChild(t);
    }
    setOk(true); setTimeout(() => setOk(false), 2000);
  }
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-slate-600">{label}</span><button type="button" onClick={copy} className={ghost}>{ok ? T('¡Copiado!') : T('Copiar')}</button></div>
      <pre className={`max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-[#0b1f4d] p-3 text-xs text-[#dbeafe] ${mono ? 'font-mono' : ''}`} style={rows ? { maxHeight: `${rows * 1.4}rem` } : undefined}>{text}</pre>
    </div>
  );
}

export default function MiAgentePage() {
  const { T, lang, locale } = usePagesT();
  const [keys, setKeys] = useState<K[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [f, setF] = useState({ name: '', scope: 'cerebro' });
  const [tab, setTab] = useState<Tab>('chatgpt');
  const [base, setBase] = useState('');
  const [testKey, setTestKey] = useState('');
  const [test, setTest] = useState<ConnectResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [gpt, setGpt] = useState<{ esquema: string; instrucciones: string } | null>(null);
  const [gptErr, setGptErr] = useState(false);
  const [adv, setAdv] = useState(false);
  const load = useCallback(async () => {
    const r = await fetch('/api/keys', { cache: 'no-store' }); const d = await r.json().catch(() => ({}));
    if (r.ok) { setKeys(d.keys); setError(null); } else setError(d.error || 'Sin acceso.');
  }, []);
  useEffect(() => { load(); }, [load]);
  // La dirección se lee después de cargar, para que el servidor y el navegador pinten lo mismo al inicio.
  useEffect(() => { setBase(window.location.origin); }, []);
  async function call(body: unknown) {
    const r = await fetch('/api/keys', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setError(d.error || 'No se pudo completar.'); return null; }
    setError(null); await load(); return d;
  }
  async function create(e: React.FormEvent) {
    e.preventDefault(); setFresh(null); setSaved(false); setTest(null);
    const d = await call(f); if (d?.key) { setFresh(d.key); setTestKey(d.key); setF({ name: '', scope: 'cerebro' }); }
  }
  // El esquema y las instrucciones del GPT salen del Cerebro (siempre al día). Se piden con la sesión de la persona.
  useEffect(() => {
    if (tab !== 'chatgpt' || gpt || !base) return;
    (async () => {
      try { const r = await fetch('/api/agent/cerebro?openapi=1', { cache: 'no-store' }); const d = await r.json(); if (r.ok && d?.esquema) setGpt({ esquema: JSON.stringify(d.esquema, null, 2), instrucciones: String(d.instrucciones || '') }); else setGptErr(true); } catch { setGptErr(true); }
    })();
  }, [tab, gpt, base]);
  async function probar() { setTesting(true); setTest(null); setTest(await testConnection(base, testKey)); setTesting(false); }
  const input = 'rounded-xl border border-[#dbe4f3] bg-[#f2f6fd] px-3 py-2 text-sm outline-none focus:border-[#0a3fbf]';
  const hasKey = (keys || []).some(k => !k.revokedAt);
  const paste = pasteToAgent(base || 'https://tu-cerebro', lang === 'en' ? 'en' : 'es');
  const msg: Record<string, string> = {
    ok: 'Conectado. El Cerebro respondió con tu llave.',
    sin_llave: 'Pega tu llave para probar.',
    llave: 'El Cerebro no reconoce esa llave. Revisa que la copiaste completa, o crea otra.',
    red: 'No se pudo llegar al Cerebro. Revisa tu conexión a internet.',
    otro: 'El Cerebro respondió con un error. Inténtalo de nuevo en un momento.',
  };

  return (
    <div className="min-h-full bg-[#f2f6fd] text-[#0b1f4d]" style={{ fontFamily: 'Poppins, system-ui, sans-serif' }}>
      <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
        <PageHero title={T('Mi agente')} subtitle={T('Tu agente de IA, conectado a tu cerebro.')} />
        <p className="text-sm text-slate-600">{T('Conecta tu agente en tres pasos. Tu agente pide y consulta; el Cerebro es quien escribe en tus fichas, y cada cambio se puede deshacer. La llave abre solo tu cerebro, nunca el de otra persona.')}</p>
        {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{T(error)}</p>}

        {/* Paso 1 */}
        <section className={card} aria-labelledby="p1">
          <div className="mb-3 flex items-center gap-3"><Num n={1} done={hasKey && (!fresh || saved)} /><h2 id="p1" className="text-base font-semibold">{T('Crea tu llave')}</h2></div>
          <p className="mb-3 text-sm text-slate-600">{T('Es la contraseña de tu agente. Cada persona crea la suya: nadie te la da y nadie más la tiene.')}</p>
          {fresh && (
            <div className="mb-3 space-y-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              <p className="font-semibold">{T('Copia esta llave ahora. No se vuelve a mostrar.')}</p>
              <CopyBlock text={fresh} label={T('Tu llave')} T={T} />
              <p className="text-xs">{T('Guárdala en la configuración secreta de tu agente. No la pegues en chats ni en notas, y no se la des a nadie.')}</p>
              <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={saved} onChange={e => setSaved(e.target.checked)} />{T('Ya la copié y la guardé')}</label>
            </div>
          )}
          <form onSubmit={create} className="grid gap-2 sm:grid-cols-3">
            <input className={input} placeholder={T('Nombre del agente (ej. Mi ChatGPT)')} value={f.name} onChange={e => setF({ ...f, name: e.target.value })} />
            <select className={input} value={f.scope} onChange={e => setF({ ...f, scope: e.target.value })} aria-label={T('Alcance')}><option value="cerebro">{T('Pedir y consultar')}</option><option value="leer">{T('Leer')}</option></select>
            <button className={btn}>{hasKey ? T('Crear otra llave') : T('Crear llave')}</button>
            <p className="text-xs text-slate-500 sm:col-span-3">{T(SCOPE_TEXT[f.scope])}</p>
          </form>
        </section>

        {/* Paso 2 */}
        <section className={card} aria-labelledby="p2">
          <div className="mb-3 flex items-center gap-3"><Num n={2} /><h2 id="p2" className="text-base font-semibold">{T('Pega la llave en tu agente')}</h2></div>
          <div role="tablist" className="mb-4 flex flex-wrap gap-2">
            {([['chatgpt', 'ChatGPT'], ['claude', 'Claude'], ['otro', T('Otro agente')]] as [Tab, string][]).map(([k, label]) => (
              <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className="rounded-full px-3.5 py-1.5 text-xs font-semibold" style={tab === k ? { background: '#0a3fbf', color: '#fff' } : { background: '#f2f6fd', color: '#0a3fbf' }}>{label}</button>))}
          </div>
          {tab === 'chatgpt' && (
            <div className="space-y-3 text-sm">
              <ol className="list-decimal space-y-1 pl-5 text-slate-700">{GPT_STEPS_ES.map(s => <li key={s}>{T(s)}</li>)}</ol>
              <p className="text-xs text-slate-500">{T('Los nombres de los botones de ChatGPT pueden cambiar; la idea es la misma.')}</p>
              {gpt ? (<>
                <CopyBlock text={gpt.esquema} label={T('Esquema (pégalo en «Esquema»)')} T={T} rows={14} />
                <CopyBlock text={gpt.instrucciones} label={T('Instrucciones (pégalas en «Instrucciones» del GPT)')} T={T} mono={false} />
              </>) : gptErr ? <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">{T('No se pudo cargar el esquema. Recarga la página.')}</p> : <p className="text-xs text-slate-500">{T('Cargando el esquema…')}</p>}
            </div>
          )}
          {tab === 'claude' && (
            <div className="space-y-3 text-sm">
              <p className="text-slate-700">{T('Dile esto a Claude (o pégalo en las instrucciones de tu proyecto). Reemplaza <mi llave> por tu llave, y guárdala donde Claude guarde sus secretos, no en el chat.')}</p>
              <CopyBlock text={paste} label={T('Pega esto a tu agente')} T={T} mono={false} />
            </div>
          )}
          {tab === 'otro' && (
            <div className="space-y-3 text-sm">
              <p className="text-slate-700">{T('Cualquier agente que pueda hacer llamadas web sirve. Dale este texto y tu llave:')}</p>
              <CopyBlock text={paste} label={T('Pega esto a tu agente')} T={T} mono={false} />
              <p className="text-xs text-slate-500">{T('Solo hay dos verbos: pedir (que algo pase) y consultar (preguntar). Tu agente no escribe directo en las fichas.')}</p>
            </div>
          )}
        </section>

        {/* Paso 3 */}
        <section className={card} aria-labelledby="p3">
          <div className="mb-3 flex items-center gap-3"><Num n={3} done={test?.kind === 'ok'} /><h2 id="p3" className="text-base font-semibold">{T('Pruébalo')}</h2></div>
          <p className="mb-3 text-sm text-slate-600">{T('Comprueba que tu llave abre tu cerebro, igual que lo hará tu agente.')}</p>
          <div className="flex flex-wrap gap-2">
            <input className={`${input} min-w-[240px] flex-1 font-mono text-xs`} type="password" autoComplete="off" placeholder={T('Pega aquí tu llave')} value={testKey} onChange={e => { setTestKey(e.target.value); setTest(null); }} aria-label={T('Tu llave')} />
            <button type="button" className={btn} disabled={testing || !cleanKey(testKey)} onClick={probar}>{testing ? T('Probando…') : T('Probar conexión')}</button>
          </div>
          {testKey && !looksLikeKey(testKey) && <p className="mt-1 text-xs text-amber-700">{T('Esa llave no tiene el formato esperado (empieza con tmk_). ¿Copiaste toda?')}</p>}
          {test && <p className={`mt-3 rounded-xl p-3 text-sm ${test.kind === 'ok' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`} role="status">{test.kind === 'ok' ? '✓ ' : ''}{T(msg[test.kind])}{test.kind === 'ok' && ` ${test.abiertos ? `${T('Tienes')} ${test.abiertos} ${T('casos abiertos.')}` : T('No tienes casos abiertos.')}`}</p>}
        </section>

        {/* Cómo pedirle */}
        <section className={card}>
          <h2 className="mb-2 text-base font-semibold">{T('Cómo pedirle bien')}</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
            <li>{T('Con tus palabras, tal cual. Con nombres y fechas completos (no «mañana»).')}</li>
            <li>{T('Un tema por pedido.')}</li>
            <li>{T('Si es claro y se puede deshacer, pídelo directo, sin pedir permiso antes.')}</li>
            <li>{T('Lo que investigó tu agente (un correo, una búsqueda) va aparte, como evidencia.')}</li>
            <li>{T('Si el Cerebro te pregunta algo, contesta con otro pedido: lo junta con el anterior.')}</li>
            <li>{T('Lo delicado (borrar, compartir, verificar) espera tu aprobación en la pantalla Pedir.')}</li>
          </ul>
        </section>

        {/* Tus llaves */}
        <section className="divide-y divide-[#eef3fb] rounded-2xl border border-[#dbe4f3] bg-white shadow-[0_12px_28px_-18px_rgba(11,31,77,0.22)]">
          <h2 className="p-4 text-base font-semibold">{T('Tus llaves')}</h2>
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
          <p className="p-4 text-xs text-slate-500">{T('Si pierdes una llave o crees que alguien la vio, revócala y crea otra.')}</p>
        </section>

        {/* Para técnicos */}
        <section className={card}>
          <button type="button" className="flex w-full items-center justify-between text-left text-base font-semibold" aria-expanded={adv} onClick={() => setAdv(v => !v)}>{T('Para técnicos')}<span className="text-sm text-[#0a3fbf]">{adv ? '−' : '+'}</span></button>
          {adv && (
            <div className="mt-3 space-y-2 text-sm">
              <p>{T('Dirección:')} <span className="font-mono">{base}</span></p>
              <p>{T('En cada llamada, el encabezado')} <span className="font-mono">Authorization: Bearer tu-llave</span> {T('(o')} <span className="font-mono">x-agent-key: tu-llave</span>).</p>
              <div className="space-y-1 rounded-xl bg-[#0b1f4d] p-3 font-mono text-xs text-[#dbeafe]">
                <p>POST /api/agent/cerebro {'{'}"action":"pedir","text":"lo que quieres que pase, con tus palabras"{'}'}</p>
                <p>GET /api/agent/cerebro?q=pregunta · q=pendientes · q=anoche</p>
                <p>GET /api/agent/cerebro?guia=1 · GET /api/agent/cerebro?openapi=1</p>
                <p>GET /api/agent/dossier?q=… · /api/agent/search?q=… · /api/agent/brief · /api/agent/changes?since=AAAA-MM-DD</p>
              </div>
              <p className="text-xs text-slate-500">{T('Tu agente no escribe directo: las llamadas a las rutas antiguas (brain, tasks, agenda, kpis) se traducen a un pedido y el Cerebro decide qué guardar.')}</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
