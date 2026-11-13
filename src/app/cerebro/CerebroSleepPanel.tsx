'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLang } from './i18n';

interface Proposal {
  id: string;
  kind: string;
  severity: 'alta' | 'media' | 'baja';
  title: string;
  reason: string;
  suggestion: string;
  nodeIds: string[];
  decision?: { decision: 'aprobada' | 'rechazada' | 'pospuesta' };
  ai?: { apply: number | null; urgency: number | null };
}
interface SleepView {
  generatedAt: string;
  day: string;
  proposals: Proposal[];
  hidden?: { rechazadas: number; pospuestas: number };
}

const DOT: Record<string, string> = { alta: 'bg-red-400', media: 'bg-amber-400', baja: 'bg-sky-400' };
const SHOW = 8;

/** Informe del ciclo nocturno de DOTS. Solo propuestas: aprobar/rechazar registra la decisión, no cambia notas. */
export function CerebroSleepPanel({ onFocusNode }: { onFocusNode?: (id: string) => void }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<SleepView | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [busy, setBusy] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [jev, setJev] = useState<{ busy: boolean; msg: string | null }>({ busy: false, msg: null });

  const load = useCallback(async () => {
    setState('loading');
    try {
      const res = await fetch('/api/agent/dots-sleep', { cache: 'no-store' });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'error');
      setData(json.report);
      setState('idle');
    } catch {
      setState('error');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const decide = async (id: string, decision: 'aprobada' | 'rechazada' | 'pospuesta') => {
    setBusy(id);
    try {
      await fetch('/api/agent/dots-sleep', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'decide', id, decision, by: 'HB' }),
      });
      await load();
    } finally {
      setBusy(null);
    }
  };

  const askJev = async (action: 'ping' | 'review') => {
    setJev({ busy: true, msg: null });
    try {
      const res = await fetch('/api/agent/decisions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action }) });
      const j = await res.json();
      if (!j.ok && !j.reviewed) setJev({ busy: false, msg: j.error || (j.errors && j.errors[0]) || t('Jev no respondió.') });
      else if (action === 'ping') setJev({ busy: false, msg: `${t('Jev responde')} · ${j.model} · ${j.ms} ms` });
      else { setJev({ busy: false, msg: `${t('Jev revisó')} ${j.reviewed}/${j.pending}${j.errors?.length ? ` · ${j.errors[0]}` : ''}` }); await load(); }
    } catch { setJev({ busy: false, msg: t('Jev no respondió.') }); }
  };

  const pending = (data?.proposals || []).filter((p) => !p.decision);
  const approved = (data?.proposals || []).filter((p) => p.decision?.decision === 'aprobada');
  const list = showAll ? pending : pending.slice(0, SHOW);

  return (
    <div className="space-y-2 pt-1 border-t border-gray-800">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="w-full flex items-center justify-between text-[10px] uppercase font-mono text-gray-400 hover:text-gray-200 transition"
      >
        <span>{t('Informe nocturno de DOTS')}{data ? ` (${pending.length})` : ''}</span>
        <span>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="space-y-2">
          <p className="text-[10px] text-gray-500 leading-snug">
            {t('Solo propuestas: DOTS no cambia ninguna nota por sí solo. Tu decisión queda registrada.')}
          </p>
          {state === 'loading' && !data && <p className="text-[11px] text-gray-400">{t('Cargando…')}</p>}
          {state === 'error' && <p className="text-[11px] text-red-300">{t('No se pudo cargar el informe.')}</p>}
          {data && (
            <p className="text-[10px] text-gray-500 font-mono">
              {t('Informe del')} {data.day}
              {data.hidden && (data.hidden.rechazadas || data.hidden.pospuestas)
                ? ` · ${data.hidden.rechazadas} ${t('rechazadas')} · ${data.hidden.pospuestas} ${t('pospuestas')}`
                : ''}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-1.5">
            <button disabled={jev.busy} onClick={() => askJev('ping')} className="px-2 py-0.5 rounded border border-gray-700 text-[10px] text-gray-300 hover:bg-gray-800 disabled:opacity-50 transition">{t('Probar Jev')}</button>
            <button disabled={jev.busy || pending.length === 0} onClick={() => askJev('review')} className="px-2 py-0.5 rounded border border-sky-800 text-[10px] text-sky-300 hover:bg-sky-950 disabled:opacity-50 transition">{jev.busy ? t('Consultando…') : t('Revisar con Jev')}</button>
            {jev.msg && <span className="text-[10px] text-gray-400">{jev.msg}</span>}
          </div>
          {data && pending.length === 0 && <p className="text-[11px] text-emerald-300">{t('Nada pendiente por revisar.')}</p>}

          <ul className="space-y-1.5 max-h-72 overflow-y-auto pr-0.5">
            {list.map((p) => (
              <li key={p.id} className="rounded-lg border border-gray-800 bg-gray-900/70 p-2">
                <div className="flex items-start gap-1.5">
                  <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${DOT[p.severity]}`} title={p.severity} />
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-gray-100 leading-snug">{p.title}</p>
                    <p className="text-[10px] text-gray-400 leading-snug mt-0.5">{p.reason}</p>
                    <p className="text-[10px] text-gray-500 leading-snug mt-0.5">→ {p.suggestion}</p>
                    {p.ai && p.ai.apply !== null && (
                      <p className="text-[10px] text-sky-300/90 leading-snug mt-0.5 font-mono">
                        Jev: {Math.round(p.ai.apply * 100)}% {t('a favor')}{p.ai.urgency !== null ? ` · ${t('urgencia')} ${p.ai.urgency >= 1.34 ? t('hoy') : p.ai.urgency >= 0.67 ? t('esta semana') : t('puede esperar')}` : ''}
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {onFocusNode && p.nodeIds[0] && (
                    <button onClick={() => onFocusNode(p.nodeIds[0])} className="px-2 py-0.5 rounded border border-gray-700 text-[10px] text-gray-300 hover:bg-gray-800 transition">
                      {t('Ver ficha')}
                    </button>
                  )}
                  <button disabled={busy === p.id} onClick={() => decide(p.id, 'aprobada')} className="px-2 py-0.5 rounded border border-emerald-700 text-[10px] text-emerald-300 hover:bg-emerald-950 disabled:opacity-50 transition">
                    {t('Aprobar')}
                  </button>
                  <button disabled={busy === p.id} onClick={() => decide(p.id, 'pospuesta')} className="px-2 py-0.5 rounded border border-gray-700 text-[10px] text-gray-300 hover:bg-gray-800 disabled:opacity-50 transition">
                    {t('Posponer')}
                  </button>
                  <button disabled={busy === p.id} onClick={() => decide(p.id, 'rechazada')} className="px-2 py-0.5 rounded border border-red-800 text-[10px] text-red-300 hover:bg-red-950 disabled:opacity-50 transition">
                    {t('Rechazar')}
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {pending.length > SHOW && (
            <button onClick={() => setShowAll(!showAll)} className="text-[10px] text-sky-300 hover:underline">
              {showAll ? t('Ver menos') : `${t('Ver las')} ${pending.length - SHOW} ${t('restantes')}`}
            </button>
          )}
          {approved.length > 0 && (
            <p className="text-[10px] text-gray-500">{approved.length} {t('aprobadas (anotadas, sin cambios en el vault)')}</p>
          )}
        </div>
      )}
    </div>
  );
}
