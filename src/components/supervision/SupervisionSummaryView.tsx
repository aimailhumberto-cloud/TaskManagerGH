'use client';

import React from 'react';
import type { V1Envelope } from '@/lib/supervision/types';

function formatDate(iso: string | null): string {
  if (!iso) return 'Sin fecha registrada';
  try {
    return new Date(iso).toLocaleString('es', {
      timeZone: 'America/Panama',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function SupervisionSummaryView({ envelope }: { envelope: V1Envelope }) {
  const {
    supervisor_evaluated_at,
    last_document_capture_at,
    last_received_at,
    last_source_observed_at,
    last_verified_at,
    age_basis,
    age_seconds,
    update_status,
    update_label,
    coverage,
    continuity,
  } = envelope;

  const statusColor =
    update_status === 'periodic_fixture'
      ? 'spv-pill-fresh'
      : update_status === 'stale'
      ? 'spv-pill-stale'
      : 'spv-pill-unknown';

  return (
    <div className="flex flex-col gap-6">
      {/* Telemetría y Relojes */}
      <section className="spv-card" aria-label="Telemetría de relojes v1">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-700/60 pb-3 mb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-100">Telemetría de Relojes y Fuentes</h3>
            <p className="text-xs text-slate-400">
              Separación explícita de captura documental, observación canónica y recepción.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`spv-dimension-pill ${statusColor}`}>
              ● {update_status} ({age_seconds}s)
            </span>
            <span className="text-xs text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded border border-slate-700">
              {update_label}
            </span>
          </div>
        </div>

        <div className="spv-telemetry-grid">
          <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
              Evaluación Supervisor
            </span>
            <strong className="text-sm text-slate-200 mt-1 block">
              {formatDate(supervisor_evaluated_at)}
            </strong>
            <span className="text-[10px] text-slate-500">Reloj local de evaluación</span>
          </div>

          <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
              Última Captura Documental
            </span>
            <strong className="text-sm text-slate-200 mt-1 block">
              {formatDate(last_document_capture_at)}
            </strong>
            <span className="text-[10px] text-slate-500">Documentos registrados</span>
          </div>

          <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
              Última Observación en Origen
            </span>
            <strong className="text-sm text-slate-200 mt-1 block">
              {formatDate(last_source_observed_at)}
            </strong>
            <span className="text-[10px] text-slate-500">
              Base de antigüedad: {age_basis || 'ninguna'}
            </span>
          </div>

          <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
              Última Verificación Registrada
            </span>
            <strong className="text-sm text-slate-200 mt-1 block">
              {formatDate(last_verified_at)}
            </strong>
            <span className="text-[10px] text-slate-500">Pruebas vigentes en scope</span>
          </div>

          <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
              Última Recepción Externa
            </span>
            <strong className="text-sm text-slate-200 mt-1 block">
              {last_received_at ? formatDate(last_received_at) : 'null (laboratorio sintético)'}
            </strong>
            <span className="text-[10px] text-slate-500">Sin recepción externa en fixtures</span>
          </div>
        </div>

        <div className="mt-4 p-3 bg-amber-950/20 border border-amber-800/30 rounded-lg text-xs text-amber-200/90">
          ⚠️ <strong>Aviso contractual:</strong> Nunca se declara actualización en vivo. Si el reloj excede los 300 segundos sin nueva señal, el estado pasa automáticamente a <em>stale</em>.
        </div>
      </section>

      {/* Cobertura y Continuidad */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Cobertura */}
        <section className="spv-card" aria-label="Cobertura de Supervisión">
          <h3 className="text-md font-bold text-slate-100 border-b border-slate-700/60 pb-2 mb-3">
            Cobertura y Proyecciones
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-slate-800 text-sm">
              <span className="text-slate-400">Objetos Inventariados:</span>
              <span className="font-semibold text-slate-100">{coverage.inventoried}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-800 text-sm">
              <span className="text-slate-400">Verificados en Producción Real:</span>
              <span className="font-semibold text-amber-400">
                {coverage.real_verified} (estrictamente 0 en fixtures)
              </span>
            </div>
            <div className="flex justify-between items-center py-2 text-sm">
              <span className="text-slate-400">Total Esperado:</span>
              <span className="font-semibold text-slate-400">
                {coverage.expected_total === null ? 'null (no delimitado)' : coverage.expected_total}
              </span>
            </div>
            <p className="text-xs text-slate-400 bg-slate-900/60 p-2.5 rounded border border-slate-800">
              📌 <strong>Regla de integridad:</strong> La ausencia de un total esperado jamás se convierte en un 100% de cobertura.
            </p>
          </div>
        </section>

        {/* Continuidad y Alertas */}
        <section className="spv-card" aria-label="Estado de Continuidad">
          <h3 className="text-md font-bold text-slate-100 border-b border-slate-700/60 pb-2 mb-3">
            Salud de Continuidad
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-slate-800 text-sm">
              <span className="text-slate-400">Último chequeo:</span>
              <span className="text-slate-200">{formatDate(continuity.last_check_at)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-800 text-sm">
              <span className="text-slate-400">Intervalo de chequeo:</span>
              <span className="text-slate-200">{continuity.check_interval_seconds}s (5 min)</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-800 text-sm">
              <span className="text-slate-400">Entidades monitoreadas en scope:</span>
              <span className="text-slate-200">{continuity.entities}</span>
            </div>
            <div className="flex justify-between items-center py-2 text-sm">
              <span className="text-slate-400">Incidentes abiertos:</span>
              <span
                className={`font-semibold px-2 py-0.5 rounded ${
                  continuity.open_incidents > 0
                    ? 'bg-rose-900/40 text-rose-300 border border-rose-800'
                    : 'bg-emerald-900/30 text-emerald-300'
                }`}
              >
                {continuity.open_incidents}
              </span>
            </div>
          </div>
        </section>
      </div>

      {/* Estado de Adaptadores */}
      <section className="spv-card" aria-label="Adaptadores externos">
        <h3 className="text-md font-bold text-slate-100 border-b border-slate-700/60 pb-2 mb-3">
          Adaptadores Externos (Aislamiento Total)
        </h3>
        <p className="text-xs text-slate-400 mb-3">
          Todos los adaptadores de sincronización externa permanecen explícitamente deshabilitados en esta versión preliminar.
        </p>

        <div className="overflow-x-auto">
          <table className="spv-table">
            <thead>
              <tr>
                <th>Adaptador</th>
                <th>Estado</th>
                <th>Detalle de Integración</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="font-semibold text-slate-200">dot_wake (Dispositivo físico)</td>
                <td>
                  <span className="spv-dimension-pill spv-pill-unknown">
                    {continuity.adapters.dot_wake.enabled ? 'Habilitado' : 'Deshabilitado'}
                  </span>
                </td>
                <td className="text-xs text-slate-400">
                  {continuity.adapters.dot_wake.status} · Sin API pública autorizada
                </td>
              </tr>
              <tr>
                <td className="font-semibold text-slate-200">obsidian (Espejo documental)</td>
                <td>
                  <span className="spv-dimension-pill spv-pill-unknown">
                    {continuity.adapters.obsidian.enabled ? 'Habilitado' : 'Deshabilitado'}
                  </span>
                </td>
                <td className="text-xs text-slate-400">
                  {continuity.adapters.obsidian.status} · Sin conexión de vault ni sincronización bidireccional
                </td>
              </tr>
              <tr>
                <td className="font-semibold text-slate-200">task_manager (Conexión activa)</td>
                <td>
                  <span className="spv-dimension-pill spv-pill-unknown">
                    {continuity.adapters.task_manager.enabled ? 'Habilitado' : 'Deshabilitado'}
                  </span>
                </td>
                <td className="text-xs text-slate-400">
                  {continuity.adapters.task_manager.status} · Módulo local de solo lectura
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
