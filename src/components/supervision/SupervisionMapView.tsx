'use client';

import React from 'react';
import type {
  V1Object,
  V1AssetData,
  V1RelationshipData,
  V1States,
} from '@/lib/supervision/types';

function formatDate(iso: string | null): string {
  if (!iso) return 'Sin fecha de verificación';
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

function DimensionBadges({ states }: { states: V1States }) {
  return (
    <div className="flex flex-wrap gap-1.5 my-2">
      <span className="spv-dimension-pill spv-pill-fresh">conn: {states.connection}</span>
      <span className="spv-dimension-pill spv-pill-fresh">ver: {states.verification}</span>
      <span className="spv-dimension-pill spv-pill-fresh">fresh: {states.freshness}</span>
      <span className="spv-dimension-pill spv-pill-fresh">work: {states.work}</span>
    </div>
  );
}

export default function SupervisionMapView({ objects }: { objects: V1Object[] }) {
  const assets = objects.filter(o => o.kind === 'asset');
  const relationships = objects.filter(o => o.kind === 'relationship');

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
        <div>
          <h3 className="text-lg font-bold text-slate-100">Mapa de Activos y Red de Relaciones</h3>
          <p className="text-xs text-slate-400">
            Inventario de recursos, autenticación sin secretos y grafo relacional intra-empresa.
          </p>
        </div>
        <span className="text-xs bg-slate-800 text-slate-300 px-3 py-1 rounded-full border border-slate-700">
          {assets.length} activos · {relationships.length} relaciones
        </span>
      </div>

      <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-lg text-xs text-slate-400">
        🛡️ <strong>Reglas del Grafo:</strong> Las relaciones (<em>belongs_to, depends_on, produces, documents, publishes_in, monitors</em>) se circunscriben estrictamente a la empresa seleccionada. Una relación con condición <code>verified</code> exige referencias de evidencia explícitas.
      </div>

      {/* Activos */}
      <section className="space-y-4">
        <h4 className="text-md font-semibold text-slate-200">Activos Identificados</h4>
        {assets.length === 0 ? (
          <div className="spv-card text-center py-6 text-slate-400 text-sm">
            No hay activos inventariados en este negocio.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {assets.map(a => {
              const data = a.data as V1AssetData;
              return (
                <article key={a.id} className="spv-card border-l-4 border-l-amber-500">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[11px] font-mono text-slate-400 block">{a.id}</span>
                      <h5 className="text-base font-bold text-slate-100 mt-0.5">
                        {data.account_ref || a.id}
                      </h5>
                    </div>
                    <span className="text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                      rev {a.revision}
                    </span>
                  </div>

                  <DimensionBadges states={a.states} />

                  <div className="space-y-2 my-3 text-xs bg-slate-900/50 p-3 rounded-lg border border-slate-800">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Propietario / Responsable:</span>
                      <span className="text-slate-200 font-medium">{data.owner || 'null'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Nivel de Acceso:</span>
                      <span className="text-slate-200 font-mono">{data.access}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Última Verificación:</span>
                      <span className="text-slate-200">{formatDate(data.last_verified_at)}</span>
                    </div>
                    <div className="pt-2 border-t border-slate-800">
                      <span className="text-slate-400 block mb-0.5">Descriptor de Autenticación:</span>
                      <span className="text-amber-200/90 font-mono text-[11px] bg-slate-950 p-1.5 rounded block border border-slate-800">
                        {data.authentication}
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Relaciones */}
      <section className="space-y-4">
        <h4 className="text-md font-semibold text-slate-200">Grafo de Relaciones</h4>
        {relationships.length === 0 ? (
          <div className="spv-card text-center py-6 text-slate-400 text-sm">
            No hay relaciones registradas en este scope.
          </div>
        ) : (
          <div className="overflow-x-auto spv-card p-0">
            <table className="spv-table">
              <thead>
                <tr>
                  <th>Origen (Source)</th>
                  <th>Tipo de Relación</th>
                  <th>Destino (Target)</th>
                  <th>Condición</th>
                  <th>Evidencias de Soporte</th>
                </tr>
              </thead>
              <tbody>
                {relationships.map(rel => {
                  const data = rel.data as V1RelationshipData;
                  const isVerified = data.condition === 'verified';
                  return (
                    <tr key={rel.id}>
                      <td className="font-mono text-xs text-cyan-300">{data.source}</td>
                      <td>
                        <span className="spv-dimension-pill spv-pill-fresh">
                          {data.relation}
                        </span>
                      </td>
                      <td className="font-mono text-xs text-emerald-300">{data.target}</td>
                      <td>
                        <span
                          className={`text-xs px-2 py-0.5 rounded font-semibold ${
                            isVerified
                              ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-700'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {data.condition}
                        </span>
                      </td>
                      <td className="text-xs">
                        {data.evidence_refs && data.evidence_refs.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {data.evidence_refs.map(ref => (
                              <span
                                key={ref}
                                className="font-mono text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700"
                              >
                                {ref}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-500 italic">Sin evidencias</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
