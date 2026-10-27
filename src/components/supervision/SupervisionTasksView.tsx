'use client';

import React from 'react';
import type { V1Object, V1TaskData, V1FlowData, V1States } from '@/lib/supervision/types';

function DimensionBadges({ states }: { states: V1States }) {
  const getPillClass = (dim: string, val: string) => {
    if (val === 'fresh' || val === 'connected' || val === 'verified' || val === 'inventoried') {
      return 'spv-pill-fresh';
    }
    if (val === 'stale' || val === 'pending' || val === 'waiting_third_party') {
      return 'spv-pill-stale';
    }
    if (val === 'hb_decision') {
      return 'spv-pill-decision';
    }
    if (val === 'blocked' || val === 'not_connected') {
      return 'spv-pill-alert';
    }
    return 'spv-pill-unknown';
  };

  return (
    <div className="flex flex-wrap gap-1.5 my-2">
      <span className={`spv-dimension-pill ${getPillClass('reg', states.registration)}`}>
        reg: {states.registration}
      </span>
      <span className={`spv-dimension-pill ${getPillClass('conn', states.connection)}`}>
        conn: {states.connection}
      </span>
      <span className={`spv-dimension-pill ${getPillClass('ver', states.verification)}`}>
        ver: {states.verification}
      </span>
      <span className={`spv-dimension-pill ${getPillClass('fresh', states.freshness)}`}>
        fresh: {states.freshness}
      </span>
      <span className={`spv-dimension-pill ${getPillClass('work', states.work)}`}>
        work: {states.work}
      </span>
    </div>
  );
}

export default function SupervisionTasksView({ objects }: { objects: V1Object[] }) {
  const tasks = objects.filter(o => o.kind === 'task');
  const flows = objects.filter(o => o.kind === 'flow');

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
        <div>
          <h3 className="text-lg font-bold text-slate-100">Flujos Operativos y Tareas Supervisadas</h3>
          <p className="text-xs text-slate-400">
            Control de obligaciones, intentos, resultados de ejecución y gobernanza de entregables.
          </p>
        </div>
        <span className="text-xs bg-slate-800 text-slate-300 px-3 py-1 rounded-full border border-slate-700">
          {tasks.length} tareas · {flows.length} flujos
        </span>
      </div>

      {/* Sección Tareas */}
      <section className="space-y-4">
        <h4 className="text-md font-semibold text-slate-200">Tareas</h4>

        {tasks.length === 0 ? (
          <div className="spv-card text-center py-8 text-slate-400 text-sm">
            No hay tareas registradas en el scope seleccionado.
          </div>
        ) : (
          tasks.map(t => {
            const data = t.data as V1TaskData;
            const isUncertain = data.outcome === 'uncertain';
            const lastRun = t.continuity && 'last_run' in t.continuity ? t.continuity.last_run : null;

            return (
              <article
                key={t.id}
                className={`spv-card border-l-4 ${
                  isUncertain ? 'border-l-purple-500' : 'border-l-emerald-500'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-mono text-slate-400 block">{t.id}</span>
                    <h5 className="text-base font-bold text-slate-100 mt-0.5">{data.obligation}</h5>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded font-semibold ${
                        isUncertain
                          ? 'bg-purple-900/40 text-purple-300 border border-purple-700'
                          : 'bg-emerald-900/40 text-emerald-300 border border-emerald-700'
                      }`}
                    >
                      outcome: {data.outcome}
                    </span>
                    <span className="text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                      rev {t.revision}
                    </span>
                  </div>
                </div>

                <DimensionBadges states={t.states} />

                {/* Banner de resultado incierto (desajuste o verificación no certificada) */}
                {isUncertain && (
                  <div className="p-3 my-3 bg-purple-950/30 border border-purple-800/40 rounded-lg text-xs text-purple-200">
                    ⚠️ <strong>Resultado Incierto (hb_decision):</strong> Desajuste en ejecución
                    {lastRun && ` (esperado: ${lastRun.expected} ${lastRun.unit}, obtenido: ${lastRun.actual} ${lastRun.unit})`}.
                    Según el contrato v1, <em>jamás se califica como completado ni entregado</em>. Requiere decisión o validación manual de HB.
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 my-3 text-xs bg-slate-900/50 p-3 rounded-lg border border-slate-800">
                  <div>
                    <span className="text-slate-400 block font-medium">Intentos:</span>
                    <span className="text-slate-200">{data.attempt}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Plazo Límite:</span>
                    <span className="text-slate-200">{data.deadline || 'null (sin plazo explícito)'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Resultado reportado:</span>
                    <span className="text-slate-200">{data.result || 'Sin resultado'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Próximos pasos:</span>
                    <span className="text-slate-200">{data.next_steps}</span>
                  </div>
                </div>

                {/* Referencias de Evidencias */}
                {data.evidence_refs && data.evidence_refs.length > 0 && (
                  <div className="mt-2 text-xs text-slate-400">
                    <span className="font-semibold text-slate-300">Evidencias vinculadas:</span>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {data.evidence_refs.map(ref => (
                        <span
                          key={ref}
                          className="font-mono bg-slate-800/80 px-2 py-0.5 rounded text-[11px] text-cyan-300 border border-slate-700"
                        >
                          {ref}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Historial de Revisiones Antiguas Conservadas */}
                {t.revisions_history && t.revisions_history.length > 0 && (
                  <details className="mt-3 text-xs bg-slate-950/60 p-2.5 rounded border border-slate-800">
                    <summary className="cursor-pointer text-slate-400 hover:text-slate-200 font-medium">
                      📜 Historial de revisiones anteriores ({t.revisions_history.length} registradas sin sustituir)
                    </summary>
                    <div className="mt-2 space-y-1.5 pl-2 border-l-2 border-slate-700">
                      {t.revisions_history.map((prev, idx) => {
                        const pData = prev.data as V1TaskData;
                        return (
                          <div key={idx} className="text-slate-400">
                            <span className="font-semibold text-slate-200">Revisión {prev.revision}:</span>{' '}
                            {pData.obligation} · outcome: <code>{pData.outcome}</code> · work:{' '}
                            <code>{prev.states.work}</code>
                          </div>
                        );
                      })}
                    </div>
                  </details>
                )}
              </article>
            );
          })
        )}
      </section>

      {/* Sección Flujos */}
      <section className="space-y-4">
        <h4 className="text-md font-semibold text-slate-200">Flujos de Trabajo</h4>

        {flows.length === 0 ? (
          <div className="spv-card text-center py-6 text-slate-400 text-sm">
            No hay flujos registrados en este scope.
          </div>
        ) : (
          flows.map(f => {
            const data = f.data as V1FlowData;
            return (
              <article key={f.id} className="spv-card border-l-4 border-l-blue-500">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[11px] font-mono text-slate-400 block">{f.id}</span>
                    <h5 className="text-base font-bold text-slate-100 mt-0.5">{data.planned}</h5>
                  </div>
                  <span className="text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                    rev {f.revision}
                  </span>
                </div>

                <DimensionBadges states={f.states} />

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-3 text-xs bg-slate-900/50 p-3 rounded-lg border border-slate-800">
                  <div>
                    <span className="text-slate-400 block font-medium">Ocurrencias:</span>
                    <span className="text-slate-200">{data.occurrences}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Intentos:</span>
                    <span className="text-slate-200">{data.attempts}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Siguiente acción:</span>
                    <span className="text-slate-200">{data.next_steps}</span>
                  </div>
                </div>

                {data.dependencies && data.dependencies.length > 0 && (
                  <div className="text-xs text-slate-400">
                    <span className="font-semibold text-slate-300">Dependencias:</span>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {data.dependencies.map(dep => (
                        <span
                          key={dep}
                          className="font-mono bg-slate-800/80 px-2 py-0.5 rounded text-[11px] text-blue-300 border border-slate-700"
                        >
                          {dep}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}
