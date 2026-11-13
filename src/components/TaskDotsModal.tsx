"use client";

import React, { useState } from 'react';
import { useTasksT } from '@/lib/tasksI18n';
import type { UnifiedBrainTask } from '@/lib/smjBrainService';

interface TaskDotsModalProps {
  task: UnifiedBrainTask | null;
  isOpen: boolean;
  onClose: () => void;
  onDispatched: (taskId: string, workingMemoryId?: string) => void;
}

const PRESET_ACTIONS = [
  {
    label: 'Redactar correo formal de seguimiento',
    prompt: "Por favor redactar un correo formal de seguimiento ejecutivo al distribuidor solicitando actualización inmediata de estatus y confirmación de fechas.",
  },
  {
    label: 'Auditar cuota vs órdenes de compra',
    prompt: "Auditar el cumplimiento de cuota anual del distribuidor respecto a las órdenes de compra (POs) recibidas y calcular proyección de cierre de trimestre.",
  },
  {
    label: 'Confirmación sanitaria / aduanal',
    prompt: "Revisar los requerimientos de registro sanitario ante la autoridad local y preparar resumen de documentos pendientes para despacho aduanal.",
  },
  {
    label: 'Minuta de riesgos para Comité S&OP',
    prompt: "Preparar una minuta ejecutiva concisa para el Comité S&OP destacando este ítem, los impactos comerciales y la recomendación de suministro desde Planta Trinidad.",
  },
];

export default function TaskDotsModal({ task, isOpen, onClose, onDispatched }: TaskDotsModalProps) {
  const T = useTasksT();
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
      setError(T('Escribe o elige una instrucción para tu agente.'));
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
        throw new Error(data.error || T('No se pudo enviar la instrucción a tu agente.'));
      }

      setSuccess(`${T('Instrucción despachada con éxito. Expediente:')} ${data.workingMemoryId || 'WM-ACTIVA'}`);
      setTimeout(() => {
        onDispatched(task.id, data.workingMemoryId);
        onClose();
        setSuccess(null);
        setInstruction('');
      }, 1400);
    } catch (err: any) {
      setError(err.message || T('Error de conexión'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0b1f4d]/45 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-2xl bg-white border border-[#dbe4f3] rounded-xl shadow-[0_24px_60px_-24px_rgba(11,31,77,0.35)] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#dbe4f3] flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#e8f1ff] border border-[#bcd0f5] flex items-center justify-center text-[#0a3fbf]">
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
              <h3 className="text-base font-semibold text-[#0b1f4d] tracking-tight">{T('Pedido a mi agente')}</h3>
              <p className="text-xs text-slate-500">{T('Instrucción directa a tu agente')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-[#0b1f4d] p-1.5 rounded-lg hover:bg-[#eef3fb] transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Context box */}
          <div className="p-3.5 bg-[#eef3fb] border border-[#dbe4f3] rounded-lg space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-[#eef3fb] text-slate-700 border border-[#dbe4f3]">
                [{task.countryCode || 'GL'}]
              </span>
              <span className="text-xs font-semibold text-[#0a3fbf]">{task.sourceNodeTitle}</span>
              <span className="text-xs text-slate-500">|</span>
              <span className="text-xs text-slate-500 font-mono">{T('Vence:')} {task.dueDate}</span>
            </div>
            <p className="text-sm font-medium text-[#0b1f4d]">{task.title}</p>
          </div>

          {/* Preset quick actions */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              {T('Acciones sugeridas')}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PRESET_ACTIONS.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectPreset(T(preset.prompt))}
                  className="p-2.5 text-left rounded-lg border border-[#dbe4f3] bg-white hover:bg-[#eef3fb] hover:border-[#bcd0f5] transition-all text-xs text-slate-700 flex items-start gap-2 group"
                >
                  <svg className="w-4 h-4 text-[#0a3fbf] mt-0.5 shrink-0 group-hover:text-[#0a3fbf]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                  <span className="leading-snug">{T(preset.label)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Custom prompt textarea */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                {T('Instrucción para mi agente')}
              </label>
              <span className="text-[11px] text-slate-500">{T('Se guardará en tu memoria de trabajo')}</span>
            </div>
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder={T('Escribe la instrucción para tu agente (ej.: redactar un correo de seguimiento con fecha límite de entrega)...')}
              rows={4}
              className="w-full px-3.5 py-2.5 bg-[#f2f6fd] border border-[#dbe4f3] rounded-lg text-[#0b1f4d] text-sm placeholder-slate-500 focus:outline-none focus:border-[#0a3fbf] focus:ring-1 focus:ring-[#0a3fbf] font-sans"
            />
          </div>

          {/* Feedback states */}
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-xs flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <span>{success}</span>
            </div>
          )}

          {/* Footer buttons */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-[#dbe4f3]">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-lg border border-[#dbe4f3] text-slate-700 hover:bg-[#eef3fb] text-xs font-medium transition-colors"
            >
              {T('Cancelar')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-lg bg-gradient-to-r from-[#0a3fbf] to-[#0a3fbf] hover:from-[#0a3fbf] hover:to-[#0a3fbf] text-white font-semibold text-xs flex items-center gap-2 shadow-[0_8px_20px_-14px_rgba(11,31,77,0.3)] transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                    <path d="M12 2a10 10 0 0 1 10 10" />
                  </svg>
                  <span>{T('Enviando...')}</span>
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                  <span>{T('Enviar a mi agente')}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
