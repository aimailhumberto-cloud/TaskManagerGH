"use client";

import React, { useState, useEffect } from 'react';
import type { UnifiedBrainTask } from '@/lib/smjBrainService';

interface TaskDossierModalProps {
  task: UnifiedBrainTask | null;
  isOpen: boolean;
  onClose: () => void;
  onAskDots?: (task: UnifiedBrainTask) => void;
}

export default function TaskDossierModal({ task, isOpen, onClose, onAskDots }: TaskDossierModalProps) {
  const [nodeDetails, setNodeDetails] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !task) return;
    setLoading(true);
    fetch(`/api/agent/brain?lens=global-core&view=lite`)
      .then(res => res.json())
      .then(data => {
        if (data.ok && Array.isArray(data.nodes)) {
          const matched = data.nodes.find((n: any) =>
            n.id === task.sourceNodeId ||
            n.title.toLowerCase() === task.sourceNodeTitle.toLowerCase() ||
            (task.sourceFile && n.filePath && String(n.filePath).replace(/\\/g, '/').endsWith(String(task.sourceFile).replace(/\\/g, '/')))
          );
          setNodeDetails(matched || null);
        }
      })
      .catch(() => setNodeDetails(null))
      .finally(() => setLoading(false));
  }, [isOpen, task]);

  if (!isOpen || !task) return null;

  const fm = nodeDetails?.frontmatter || {};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-3xl bg-[#0e1726] border border-[#26384f] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#1e2e42] flex items-center justify-between bg-[#121f33]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
                <path d="M6 6h10" />
                <path d="M6 10h10" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  [{task.countryCode || 'GL'}]
                </span>
                <span className="text-xs uppercase tracking-wider text-amber-400 font-semibold">
                  {task.sourceType}
                </span>
              </div>
              <h3 className="text-base font-semibold text-slate-100">{task.sourceNodeTitle}</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Active Task Highlight */}
          <div className="p-4 bg-[#14233a] border border-amber-500/30 rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-400">Tarea en Curso</span>
              <span className="text-xs font-mono text-slate-400">Límite: {task.dueDate}</span>
            </div>
            <p className="text-sm font-medium text-slate-100">{task.title}</p>
            {task.description && (
              <p className="text-xs text-slate-300 leading-relaxed">{task.description}</p>
            )}
          </div>

          {/* Quota / Commercial Status if Distributor */}
          {task.distributorQuota && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-[#111c2e] border border-[#22334a] rounded-lg">
                <span className="text-[10px] uppercase font-semibold text-slate-400 block">Cuota Anual</span>
                <strong className="text-sm text-slate-100 font-mono">
                  {task.distributorQuota.annualTargetCases?.toLocaleString() || 'N/A'} cjs
                </strong>
              </div>
              <div className="p-3 bg-[#111c2e] border border-[#22334a] rounded-lg">
                <span className="text-[10px] uppercase font-semibold text-slate-400 block">Despachado YTD</span>
                <strong className="text-sm text-slate-100 font-mono">
                  {task.distributorQuota.actualCasesYTD?.toLocaleString() || 'N/A'} cjs
                </strong>
              </div>
              <div className="p-3 bg-[#111c2e] border border-[#22334a] rounded-lg">
                <span className="text-[10px] uppercase font-semibold text-slate-400 block">Cumplimiento</span>
                <strong className={`text-sm font-mono ${task.distributorQuota.complianceRate! < 70 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {task.distributorQuota.complianceRate}%
                </strong>
              </div>
              <div className="p-3 bg-[#111c2e] border border-[#22334a] rounded-lg">
                <span className="text-[10px] uppercase font-semibold text-slate-400 block">Estatus Cuota</span>
                <span className={`inline-block mt-0.5 text-xs font-semibold px-2 py-0.5 rounded ${
                  task.distributorQuota.status === 'At Risk'
                    ? 'bg-rose-950/60 text-rose-300 border border-rose-800/50'
                    : 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/50'
                }`}>
                  {task.distributorQuota.status === 'At Risk' ? 'En Riesgo' : 'En Meta'}
                </span>
              </div>
            </div>
          )}

          {/* Dossier Commercial Details */}
          {fm.incoterm && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-[#111c2e] p-3.5 rounded-lg border border-[#22334a]">
              <div>
                <span className="text-slate-400 block font-medium">Incoterm:</span>
                <span className="text-slate-200">{fm.incoterm}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Condición de Pago:</span>
                <span className="text-slate-200">{fm.payment_terms || '30 días'}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Frecuencia / Pedido Mínimo:</span>
                <span className="text-slate-200">{fm.order_frequency || 'Mensual'} (Mín: {fm.minimum_order_containers || 1} cont.)</span>
              </div>
            </div>
          )}

          {/* Executive Observations from Second Brain */}
          {fm.executive_observations && (
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                Observaciones Ejecutivas en Cerebro
              </span>
              <div className="p-3 bg-[#111c2e] border border-[#22334a] rounded-lg text-xs text-slate-300 leading-relaxed">
                {fm.executive_observations}
              </div>
            </div>
          )}

          {/* Recent Actions in Vault Node */}
          {Array.isArray(fm.recent_actions) && fm.recent_actions.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                Bitácora de Acciones Recientes en el Nodo
              </span>
              <div className="space-y-2">
                {fm.recent_actions.slice(0, 4).map((act: any, idx: number) => (
                  <div key={idx} className="p-2.5 bg-[#0f1728] border border-[#1e2f47] rounded text-xs flex items-start justify-between gap-3">
                    <div>
                      <span className="font-semibold text-slate-200 capitalize">{act.type?.replace(/_/g, ' ') || 'Acción'}:</span>
                      <p className="text-slate-300 mt-0.5">{act.summary}</p>
                    </div>
                    <span className="font-mono text-[11px] text-slate-400 shrink-0">{act.date}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Source File Location */}
          <div className="pt-2 text-[11px] text-slate-400 border-t border-[#1e293b] flex items-center justify-between">
            <span>Fuente en Cerebro: <code className="text-amber-300">{task.sourceFile}</code></span>
            <span>Gobernanza: DOTS Second Brain</span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-[#1e293b] bg-[#121f33] flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-[#334155] text-slate-300 hover:bg-slate-800 text-xs font-medium transition-colors"
          >
            Cerrar
          </button>
          {onAskDots && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onAskDots(task);
              }}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-2 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect width="16" height="12" x="4" y="8" rx="2" />
                <path d="M12 8V4H8" />
              </svg>
              <span>Pedir a DOTS sobre este nodo</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
