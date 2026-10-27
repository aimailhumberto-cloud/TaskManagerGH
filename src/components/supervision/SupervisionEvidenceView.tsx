'use client';

import React from 'react';
import type {
  V1Object,
  V1EvidenceData,
  V1IncidentData,
  V1ContinuityEvidenceData,
  V1ContinuityIncidentData,
} from '@/lib/supervision/types';

function formatDate(iso: string | null): string {
  if (!iso) return 'Sin fecha';
  try {
    return new Date(iso).toLocaleString('es', {
      timeZone: 'America/Panama',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function SupervisionEvidenceView({ objects }: { objects: V1Object[] }) {
  const evidences = objects.filter(o => o.kind === 'evidence');
  const incidents = objects.filter(o => o.kind === 'incident');

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
        <div>
          <h3 className="text-lg font-bold text-slate-100">Evidencias, Ejecuciones e Incidentes</h3>
          <p className="text-xs text-slate-400">
            Pistas durables de auditoría, trazabilidad de corridas y resolución de alertas.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs bg-slate-800 text-slate-300 px-3 py-1 rounded-full border border-slate-700">
            {evidences.length} evidencias · {incidents.length} incidentes
          </span>
        </div>
      </div>

      {/* Incidentes */}
      <section className="space-y-4">
        <h4 className="text-md font-semibold text-slate-200">Incidentes de Continuidad</h4>
        {incidents.length === 0 ? (
          <div className="spv-card text-center py-6 text-slate-400 text-sm">
            No hay incidentes abiertos ni registrados en este scope.
          </div>
        ) : (
          incidents.map(inc => {
            const data = inc.data as V1IncidentData;
            const continuity = inc.continuity as V1ContinuityIncidentData | undefined;
            const isOpen = data.status === 'open';

            return (
              <article
                key={inc.id}
                className={`spv-card border-l-4 ${
                  isOpen ? 'border-l-rose-500 bg-rose-950/15' : 'border-l-slate-600'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-mono text-slate-400 block">{inc.id}</span>
                    <h5 className="text-base font-bold text-slate-100 mt-0.5">
                      Razón: {data.reason}
                    </h5>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded font-semibold ${
                        isOpen
                          ? 'bg-rose-900/50 text-rose-300 border border-rose-700'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {isOpen ? '🔴 Abierto' : '🟢 Recuperado'}
                    </span>
                    <span className="text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                      rev {inc.revision}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-3 text-xs bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                  <div>
                    <span className="text-slate-400 block font-medium">Abierto el:</span>
                    <span className="text-slate-200">
                      {continuity?.opened_at ? formatDate(continuity.opened_at) : 'Sin fecha'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Resuelto el:</span>
                    <span className="text-slate-200">
                      {continuity?.resolved_at ? formatDate(continuity.resolved_at) : 'Pendiente'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Entidad Afectada:</span>
                    <span className="font-mono text-cyan-300">
                      {continuity?.entity_ref || 'null'}
                    </span>
                  </div>
                </div>

                <div className="text-xs text-slate-300 bg-slate-950/60 p-2.5 rounded border border-slate-800">
                  <strong>Próximos pasos requeridos:</strong> {data.next_steps}
                </div>
              </article>
            );
          })
        )}
      </section>

      {/* Evidencias */}
      <section className="space-y-4">
        <h4 className="text-md font-semibold text-slate-200">Inventario de Evidencias</h4>
        {evidences.length === 0 ? (
          <div className="spv-card text-center py-6 text-slate-400 text-sm">
            No hay evidencias registradas en este negocio.
          </div>
        ) : (
          evidences.map(ev => {
            const data = ev.data as V1EvidenceData;
            const continuity = ev.continuity as V1ContinuityEvidenceData | undefined;
            const runs = continuity?.runs || [];

            return (
              <article key={ev.id} className="spv-card border-l-4 border-l-teal-500">
                <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-800 pb-2 mb-3">
                  <div>
                    <span className="text-[11px] font-mono text-slate-400 block">{ev.id}</span>
                    <h5 className="text-sm font-bold text-slate-200 mt-0.5">{data.description}</h5>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="spv-dimension-pill spv-pill-fresh">
                      propósito: {continuity?.purpose || 'general'}
                    </span>
                    <span className="text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                      rev {ev.revision}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-slate-900/60 p-2.5 rounded-lg border border-slate-800 mb-3">
                  <div>
                    <span className="text-slate-400 block">Observado en origen:</span>
                    <span className="text-slate-200">{formatDate(continuity?.observed_at || null)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Recepción Externa:</span>
                    <span className="text-slate-400">
                      {continuity?.received_at ? formatDate(continuity.received_at) : 'null (sintético)'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Referencia a Entidad:</span>
                    <span className="font-mono text-cyan-300 truncate block">
                      {continuity?.entity_ref || 'null'}
                    </span>
                  </div>
                </div>

                {/* Sub-tabla de ejecuciones si purpose === 'run' */}
                {runs.length > 0 && (
                  <div className="mt-3">
                    <span className="text-xs font-semibold text-slate-300 block mb-1">
                      Ejecuciones Registradas (Corridas No Coalescentes):
                    </span>
                    <div className="overflow-x-auto">
                      <table className="spv-table">
                        <thead>
                          <tr>
                            <th>Run ID</th>
                            <th>Esperado</th>
                            <th>Obtenido</th>
                            <th>Estado</th>
                            <th>Resultado</th>
                            <th>Completado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {runs.map(r => (
                            <tr key={r.id}>
                              <td className="font-mono text-xs text-slate-300">{r.id}</td>
                              <td className="text-slate-300">{r.expected} {r.unit}</td>
                              <td className="text-amber-300 font-semibold">{r.actual} {r.unit}</td>
                              <td>
                                <span className="spv-dimension-pill spv-pill-fresh">
                                  {r.status}
                                </span>
                              </td>
                              <td className="text-xs text-slate-300">{r.result}</td>
                              <td className="text-xs text-slate-400">{formatDate(r.completed_at)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
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
