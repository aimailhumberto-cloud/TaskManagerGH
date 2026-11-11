"use client";

import React, { useState } from 'react';
import type { DistributorSummary } from '@/lib/smjBrainService';

interface NewBrainTaskModalProps {
  distributors: DistributorSummary[];
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export default function NewBrainTaskModal({ distributors, isOpen, onClose, onCreated }: NewBrainTaskModalProps) {
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
      setError('El título de la tarea es obligatorio.');
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
        throw new Error(data.error || 'Error al registrar tarea');
      }

      onCreated();
      onClose();
      setTitle('');
      setDescription('');
    } catch (err: any) {
      setError(err.message || 'Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-lg bg-[#0f172a] border border-[#334155] rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#1e293b] flex items-center justify-between bg-[#131d31]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-100">Nueva Tarea en el Cerebro</h3>
              <p className="text-xs text-slate-400">Persiste en los expedientes markdown del Second Brain</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Título de la Tarea / Compromiso
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej. Validar llegada de contenedor 40ft a Puerto Manzanillo..."
              className="w-full px-3.5 py-2.5 bg-[#0b1324] border border-[#2b3a4f] rounded-lg text-slate-100 text-sm placeholder-slate-500 focus:outline-none focus:border-amber-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Vencimiento
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 bg-[#0b1324] border border-[#2b3a4f] rounded-lg text-slate-100 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Prioridad
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full px-3 py-2 bg-[#0b1324] border border-[#2b3a4f] rounded-lg text-slate-100 text-xs"
              >
                <option value="High">Alta</option>
                <option value="Medium">Media</option>
                <option value="Low">Baja</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Vincular a Distribuidor (Opcional)
              </label>
              <select
                value={targetNodeId}
                onChange={(e) => {
                  setTargetNodeId(e.target.value);
                  const dist = distributors.find(d => d.id === e.target.value);
                  if (dist) setCountry(dist.country);
                }}
                className="w-full px-3 py-2 bg-[#0b1324] border border-[#2b3a4f] rounded-lg text-slate-100 text-xs"
              >
                <option value="">(Tarea Global / Sin Distribuidor)</option>
                {distributors.map(d => (
                  <option key={d.id} value={d.id}>
                    [{d.countryCode}] {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Mercado / País
              </label>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full px-3 py-2 bg-[#0b1324] border border-[#2b3a4f] rounded-lg text-slate-100 text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Observaciones / Contexto
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Instrucciones adicionales o antecedentes operativos..."
              rows={3}
              className="w-full px-3.5 py-2 bg-[#0b1324] border border-[#2b3a4f] rounded-lg text-slate-100 text-xs placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          {error && (
            <div className="p-2.5 bg-rose-950/40 border border-rose-800/60 rounded text-rose-300 text-xs">
              {error}
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-3 border-t border-[#1e293b]">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-lg border border-[#334155] text-slate-300 hover:bg-slate-800 text-xs font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs flex items-center gap-2 shadow"
            >
              {loading ? 'Guardando...' : 'Guardar en Cerebro'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
