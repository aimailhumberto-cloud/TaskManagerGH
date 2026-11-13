"use client";

import React, { useState } from 'react';
import { useTasksT } from '@/lib/tasksI18n';
import type { DistributorSummary } from '@/lib/smjBrainService';

interface NewBrainTaskModalProps {
  distributors: DistributorSummary[];
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export default function NewBrainTaskModal({ distributors, isOpen, onClose, onCreated }: NewBrainTaskModalProps) {
  const T = useTasksT();
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Panama', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()));
  const [priority, setPriority] = useState<'High' | 'Medium' | 'Low'>('High');
  const [targetNodeId, setTargetNodeId] = useState('');
  const [country, setCountry] = useState('Panamá');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError(T('El título de la tarea es obligatorio.'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/agent/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          title: title.trim(),
          dueDate,
          priority,
          targetNodeId: targetNodeId || undefined,
          country,
          description,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || T('No se pudo registrar la tarea.'));
      }

      onCreated();
      onClose();
      setTitle('');
      setDescription('');
    } catch (err: any) {
      setError(err.message || T('Error de conexión'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0b1f4d]/45 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-lg bg-white border border-[#dbe4f3] rounded-xl shadow-[0_24px_60px_-24px_rgba(11,31,77,0.35)] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#dbe4f3] flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#e8f1ff] border border-[#bcd0f5] flex items-center justify-center text-[#0a3fbf]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-semibold text-[#0b1f4d]">{T('Nueva Tarea en el Cerebro')}</h3>
              <p className="text-xs text-slate-500">{T('Se guarda en tu Segundo Cerebro')}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-[#0b1f4d] p-1.5 rounded-lg hover:bg-[#eef3fb]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              {T('Título de la Tarea / Compromiso')}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={T('Ej.: validar la llegada del contenedor al puerto...')}
              className="w-full px-3.5 py-2.5 bg-[#f2f6fd] border border-[#dbe4f3] rounded-lg text-[#0b1f4d] text-sm placeholder-slate-500 focus:outline-none focus:border-[#0a3fbf]"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                {T('Vencimiento')}
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 bg-[#f2f6fd] border border-[#dbe4f3] rounded-lg text-[#0b1f4d] text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                {T('Prioridad')}
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full px-3 py-2 bg-[#f2f6fd] border border-[#dbe4f3] rounded-lg text-[#0b1f4d] text-xs"
              >
                <option value="High">{T('Alta')}</option>
                <option value="Medium">{T('Media')}</option>
                <option value="Low">{T('Baja')}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                {T('Vincular a Distribuidor (Opcional)')}
              </label>
              <select
                value={targetNodeId}
                onChange={(e) => {
                  setTargetNodeId(e.target.value);
                  const dist = distributors.find(d => d.id === e.target.value);
                  if (dist) setCountry(dist.country);
                }}
                className="w-full px-3 py-2 bg-[#f2f6fd] border border-[#dbe4f3] rounded-lg text-[#0b1f4d] text-xs"
              >
                <option value="">{T('(Tarea Global / Sin Distribuidor)')}</option>
                {distributors.map(d => (
                  <option key={d.id} value={d.id}>
                    [{d.countryCode}] {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                {T('Mercado / País')}
              </label>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full px-3 py-2 bg-[#f2f6fd] border border-[#dbe4f3] rounded-lg text-[#0b1f4d] text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              {T('Observaciones / Contexto')}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={T('Instrucciones adicionales o antecedentes operativos...')}
              rows={3}
              className="w-full px-3.5 py-2 bg-[#f2f6fd] border border-[#dbe4f3] rounded-lg text-[#0b1f4d] text-xs placeholder-slate-500 focus:outline-none focus:border-[#0a3fbf]"
            />
          </div>

          {error && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded text-rose-700 text-xs">
              {error}
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-3 border-t border-[#dbe4f3]">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-lg border border-[#dbe4f3] text-slate-700 hover:bg-[#eef3fb] text-xs font-medium"
            >
              {T('Cancelar')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-lg bg-[#0a3fbf] hover:bg-[#08318f] text-white font-semibold text-xs flex items-center gap-2 shadow"
            >
              {loading ? 'Guardando...' : T('Guardar en Cerebro')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
