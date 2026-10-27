'use client';

import React, { useState, useMemo, useEffect } from 'react';
import './supervision.css';
import { SupervisionEngine } from '@/lib/supervision/engine';
import type { V1ViewName, FixtureScope, V1ChangesResponse } from '@/lib/supervision/types';
import SupervisionSummaryView from './SupervisionSummaryView';
import SupervisionTasksView from './SupervisionTasksView';
import SupervisionMemoryView from './SupervisionMemoryView';
import SupervisionMapView from './SupervisionMapView';
import SupervisionEvidenceView from './SupervisionEvidenceView';
import { HB_CANONICAL_COMPANIES } from '@/lib/hbCompanies';

const BUSINESS_OPTIONS = [
  { id: 'fixture-business', name: 'Fixture Business (Canónica Contract v1)' },
  ...HB_CANONICAL_COMPANIES.map(c => ({ id: c.id, name: `${c.icon} ${c.name}` })),
];

export default function SupervisionModule() {
  const [selectedBusiness, setSelectedBusiness] = useState<string>('fixture-business');
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [activeTab, setActiveTab] = useState<V1ViewName>('summary');
  const [allowDocumentContent, setAllowDocumentContent] = useState<boolean>(false);
  const [simulatedClockMode, setSimulatedClockMode] = useState<'fresh' | 'stale' | 'obsolete'>('fresh');
  const [incrementalResult, setIncrementalResult] = useState<V1ChangesResponse | null>(null);

  const engine = useMemo(() => new SupervisionEngine(), []);

  // Proyectos disponibles en el negocio seleccionado
  const availableProjects = useMemo(() => {
    if (!selectedBusiness) return [];
    const all = engine.getObjects().filter(o => o.business_id === selectedBusiness && o.project_id);
    const set = new Set(all.map(o => o.project_id!));
    return Array.from(set);
  }, [engine, selectedBusiness]);

  // Reset de proyecto al cambiar de negocio
  useEffect(() => {
    setSelectedProject('');
    setIncrementalResult(null);
  }, [selectedBusiness]);

  // Simulación de reloj: fresca (12:02), caducada (12:10) u obsoleta (anterior a última evaluación)
  const evaluationDate = useMemo(() => {
    if (simulatedClockMode === 'stale') {
      return new Date('2026-01-01T12:10:00Z');
    }
    if (simulatedClockMode === 'obsolete') {
      return new Date('2025-12-31T23:59:59Z');
    }
    return new Date('2026-01-01T12:02:00Z');
  }, [simulatedClockMode]);

  const scope: FixtureScope = useMemo(() => {
    return {
      business_ids: selectedBusiness ? [selectedBusiness] : [],
      project_id: selectedProject || undefined,
      permissions: {
        document_content: allowDocumentContent,
      },
    };
  }, [selectedBusiness, selectedProject, allowDocumentContent]);

  let envelope = null;
  let errorMsg = '';

  try {
    if (!selectedBusiness) {
      errorMsg = 'Scope obligatorio: se requiere seleccionar una empresa para proyectar datos.';
    } else {
      envelope = engine.snapshot(scope, evaluationDate, activeTab);
    }
  } catch (err: any) {
    errorMsg = err.message || 'Error al proyectar la vista de supervisión.';
  }

  const handleTestValidChanges = () => {
    if (!envelope) return;
    try {
      const res = engine.changes(scope, envelope.cursor, evaluationDate);
      setIncrementalResult(res);
    } catch (e: any) {
      setIncrementalResult({
        api_version: '1.0',
        proposal: true,
        fixture_only: true,
        snapshot_required: true,
        events: [],
        cursor: envelope.cursor,
        reason: e.message,
      });
    }
  };

  const handleTestCorruptCursor = () => {
    const corruptCursor = Buffer.from(
      JSON.stringify({ scope: ['other-business'], generation: 'foreign_gen', event_index: 0 })
    ).toString('base64url');
    const res = engine.changes(scope, corruptCursor, evaluationDate);
    setIncrementalResult(res);
  };

  return (
    <div className="spv-container">
      {/* Banner de estado durmiente / Aislamiento */}
      <div className="spv-banner-dormant" role="alert">
        <div className="flex items-center gap-2">
          <span className="text-xl">⚠️</span>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide">
              DATOS DE DEMOSTRACIÓN / SIN CONEXIÓN · COMPLEMENTO INACTIVO
            </h2>
            <p className="text-xs text-amber-200/90 mt-0.5">
              Este módulo visual de supervisión opera estrictamente con fixtures locales sintéticos aislados.
              El complemento Lumen AGI permanece inactivo: sin servidor HTTP abierto, sin schedulers, sin envío de correos ni acceso a vaults.
            </p>
          </div>
        </div>
      </div>

      {/* Barra de control y filtrado */}
      <header className="spv-card flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex flex-col text-xs font-semibold text-slate-300">
            Empresa / Scope:
            <select
              value={selectedBusiness}
              onChange={e => setSelectedBusiness(e.target.value)}
              className="mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 font-normal focus:ring-1 focus:ring-teal-500"
            >
              <option value="">-- Sin empresa (Prueba de scope vacío) --</option>
              {BUSINESS_OPTIONS.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col text-xs font-semibold text-slate-300">
            Proyecto (filtro granular):
            <select
              value={selectedProject}
              onChange={e => setSelectedProject(e.target.value)}
              disabled={!selectedBusiness || availableProjects.length === 0}
              className="mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 font-normal focus:ring-1 focus:ring-teal-500 disabled:opacity-50"
            >
              <option value="">-- Todos los proyectos ({availableProjects.length} detectados) --</option>
              {availableProjects.map(p => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col text-xs font-semibold text-slate-300">
            Simulador de Reloj:
            <select
              value={simulatedClockMode}
              onChange={e => setSimulatedClockMode(e.target.value as any)}
              className="mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 font-normal focus:ring-1 focus:ring-teal-500"
            >
              <option value="fresh">Normal (120s &lt; 300s · periodic_fixture)</option>
              <option value="stale">Pérdida de señal (600s &gt; 300s · stale)</option>
              <option value="obsolete">Lectura obsoleta (Simular rechazo at &lt; lastEvaluatedAt)</option>
            </select>
          </label>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">
            Versión Contrato: <strong className="text-slate-200">v1.0 (propuesta técnica)</strong>
          </span>
        </div>
      </header>

      {/* Panel de prueba de reconciliación incremental (GET /v1/changes) */}
      <details className="spv-card text-xs">
        <summary className="font-semibold text-slate-300 cursor-pointer flex justify-between items-center py-1">
          <span>🔄 Consulta Incremental Simulada y Reconciliación de Cursores (GET /v1/changes)</span>
          <span className="text-slate-500 font-mono text-[10px]">
            {envelope ? `Cursor actual: ${envelope.cursor.slice(0, 18)}…` : 'Sin cursor'}
          </span>
        </summary>
        <div className="mt-3 pt-3 border-t border-slate-800 space-y-2">
          <p className="text-slate-400 text-xs">
            Demuestra el mecanismo contractual de cursores opacos. Si el cursor es ajeno al scope o de otra generación, devuelve <code>snapshot_required: true</code> forzando una nueva instantánea completa.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleTestValidChanges}
              disabled={!envelope}
              className="px-3 py-1.5 bg-teal-900/40 text-teal-300 border border-teal-700 rounded hover:bg-teal-800/40"
            >
              Consultar cambios con cursor válido
            </button>
            <button
              onClick={handleTestCorruptCursor}
              className="px-3 py-1.5 bg-rose-900/40 text-rose-300 border border-rose-700 rounded hover:bg-rose-800/40"
            >
              Simular cursor desalineado (snapshot_required)
            </button>
          </div>

          {incrementalResult && (
            <div className="mt-3 p-3 bg-slate-950 rounded border border-slate-800 font-mono text-[11px] text-slate-300">
              <div className="flex justify-between items-center mb-1 font-sans">
                <span className="font-semibold">Resultado de GET /v1/changes:</span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    incrementalResult.snapshot_required
                      ? 'bg-rose-900/60 text-rose-300 border border-rose-700'
                      : 'bg-emerald-900/60 text-emerald-300 border border-emerald-700'
                  }`}
                >
                  {incrementalResult.snapshot_required
                    ? '🔴 snapshot_required: true'
                    : '🟢 snapshot_required: false'}
                </span>
              </div>
              <div>Eventos devueltos: {incrementalResult.events.length}</div>
              {incrementalResult.reason && (
                <div className="text-rose-400 mt-1">Razón: {incrementalResult.reason}</div>
              )}
              <div className="truncate text-slate-500 mt-1">
                Nuevo cursor: {incrementalResult.cursor}
              </div>
            </div>
          )}
        </div>
      </details>

      {/* Navegación por Pestañas de las 5 Vistas */}
      <nav className="flex flex-wrap gap-2 border-b border-slate-800 pb-2" aria-label="Vistas de Supervisión">
        <button
          onClick={() => setActiveTab('summary')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
            activeTab === 'summary'
              ? 'bg-teal-500/20 text-teal-300 border border-teal-500/50'
              : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800'
          }`}
        >
          1. Resumen y Cobertura
        </button>

        <button
          onClick={() => setActiveTab('tasks')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
            activeTab === 'tasks'
              ? 'bg-teal-500/20 text-teal-300 border border-teal-500/50'
              : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800'
          }`}
        >
          2. Flujos y Tareas
        </button>

        <button
          onClick={() => setActiveTab('documents')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
            activeTab === 'documents'
              ? 'bg-teal-500/20 text-teal-300 border border-teal-500/50'
              : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800'
          }`}
        >
          3. Memoria (Documentos)
        </button>

        <button
          onClick={() => setActiveTab('assets')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
            activeTab === 'assets'
              ? 'bg-teal-500/20 text-teal-300 border border-teal-500/50'
              : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800'
          }`}
        >
          4. Mapa de Activos y Grafo
        </button>

        <button
          onClick={() => setActiveTab('evidence')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
            activeTab === 'evidence'
              ? 'bg-teal-500/20 text-teal-300 border border-teal-500/50'
              : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800'
          }`}
        >
          5. Evidencias e Incidentes
        </button>
      </nav>

      {/* Manejo de errores de scope o proyección */}
      {errorMsg ? (
        <div className="spv-card border-rose-800 bg-rose-950/20 text-rose-200 p-6 text-center">
          <span className="text-2xl block mb-2">🛑</span>
          <h3 className="font-bold text-sm">Validación de Contrato v1</h3>
          <p className="text-xs text-rose-300/90 mt-1">{errorMsg}</p>
        </div>
      ) : envelope ? (
        <main className="mt-2">
          {activeTab === 'summary' && <SupervisionSummaryView envelope={envelope} />}
          {activeTab === 'tasks' && <SupervisionTasksView objects={envelope.objects} />}
          {activeTab === 'documents' && (
            <SupervisionMemoryView
              objects={envelope.objects}
              allowContent={allowDocumentContent}
              onToggleContent={() => setAllowDocumentContent(v => !v)}
            />
          )}
          {activeTab === 'assets' && <SupervisionMapView objects={envelope.objects} />}
          {activeTab === 'evidence' && <SupervisionEvidenceView objects={envelope.objects} />}
        </main>
      ) : null}
    </div>
  );
}
