"use client";

import React, { useState } from 'react';
import type { UnifiedBrainTask } from '@/lib/smjBrainService';

interface TaskDotsModalProps {
  task: UnifiedBrainTask | null;
  isOpen: boolean;
  onClose: () => void;
  onDispatched: (taskId: string, workingMemoryId?: string) => void;
}

const PRESET_ACTIONS = [
  {
    label: "Redactar correo formal de seguimiento",
    prompt: "Por favor redactar un correo formal de seguimiento ejecutivo al distribuidor solicitando actualización inmediata de estatus y confirmación de fechas.",
  },
  {
    label: "Auditar cuota vs órdenes de compra",
    prompt: "Auditar el cumplimiento de cuota anual del distribuidor respecto a las órdenes de compra (POs) recibidas y calcular proyección de cierre de trimestre.",
  },
  {
    label: "Confirmación sanitaria / aduanal",
    prompt: "Revisar los requerimientos de registro sanitario ante la autoridad local y preparar resumen de documentos pendientes para despacho aduanal.",
  },
  {
    label: "Minuta de riesgos para Comité S&OP",
    prompt: "Preparar una minuta ejecutiva concisa para el Comité S&OP destacando este ítem, los impactos comerciales y la recomendación de suministro desde Planta Trinidad.",
  },
];

export default function TaskDotsModal({ task, isOpen, onClose, onDispatched }: TaskDotsModalProps) {
  const [instruction, setInstruction] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!isOpen || !task) return null;

  const handleSelectPreset = (prompt: string) => {
    setInstruction(prompt);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instruction.trim()) {
      setError('Por favor redacta o selecciona una instrucción para DOTS.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/agent/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ask_dots',
          taskId: task.id,
          instruction: instruction.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Error al despachar instrucción a DOTS');
      }

      setSuccess(`Instrucción despachada con éxito. Expediente: ${data.workingMemoryId || 'WM-ACTIVA'}`);
      setTimeout(() => {
        onDispatched(task.id, data.workingMemoryId);
        onClose();
        setSuccess(null);
        setInstruction('');
      }, 1400);
    } catch (err: any) {
      setError(err.message || 'Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-2xl bg-[#0f172a] border border-[#334155] rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#1e293b] flex items-center justify-between bg-[#131d31]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-950/80 border border-indigo-700/50 flex items-center justify-center text-indigo-400">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 8V4H8" />
                <rect width="16" height="12" x="4" y="8" rx="2" />
                <path d="M2 14h2" />
                <path d="M20 14h2" />
                <path d="M15 13v2" />
                <path d="M9 13v2" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-100 tracking-tight">Despacho Ejecutivo a DOTS</h3>
              <p className="text-xs text-slate-400">Instrucción directa al agente autónomo de gobernanza SMJ</p>
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

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Context box */}
          <div className="p-3.5 bg-[#172236] border border-[#23354e] rounded-lg space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-800 text-slate-300 border border-slate-700">
                [{task.countryCode || 'GL'}]
              </span>
              <span className="text-xs font-semibold text-amber-300">{task.sourceNodeTitle}</span>
              <span className="text-xs text-slate-400">|</span>
              <span className="text-xs text-slate-400 font-mono">Vence: {task.dueDate}</span>
            </div>
            <p className="text-sm font-medium text-slate-200">{task.title}</p>
          </div>

          {/* Preset quick actions */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Acciones Ejecutivas Predefinidas
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PRESET_ACTIONS.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectPreset(preset.prompt)}
                  className="p-2.5 text-left rounded-lg border border-[#24354c] bg-[#111c2e] hover:bg-[#1a2b45] hover:border-indigo-500/50 transition-all text-xs text-slate-300 flex items-start gap-2 group"
                >
                  <svg className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0 group-hover:text-indigo-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                  <span className="leading-snug">{preset.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Custom prompt textarea */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Instrucción o Mandato para DOTS
              </label>
              <span className="text-[11px] text-slate-400">Se guardará en 00-Working-Memory</span>
            </div>
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="Escribe la instrucción ejecutiva detallada para DOTS (ej. Redactar borrador de correo a MEDIMEX con fecha límite de entrega)..."
              rows={4}
              className="w-full px-3.5 py-2.5 bg-[#0b1324] border border-[#2b3a4f] rounded-lg text-slate-100 text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-sans"
            />
          </div>

          {/* Feedback states */}
          {error && (
            <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-lg text-rose-300 text-xs flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-lg text-emerald-300 text-xs flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <span>{success}</span>
            </div>
          )}

          {/* Footer buttons */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-[#1e293b]">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-lg border border-[#334155] text-slate-300 hover:bg-slate-800 text-xs font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-semibold text-xs flex items-center gap-2 shadow-md transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                    <path d="M12 2a10 10 0 0 1 10 10" />
                  </svg>
                  <span>Despachando...</span>
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                  <span>Despachar a DOTS</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
