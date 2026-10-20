'use client';
import { useState } from 'react';
import type { Task } from '@/services/mockData';
import type { WorkItem } from '@/lib/stepWork';
import { shiftDay, todayInPanama } from '@/lib/workspaceDisplay';
import type { WorkspaceCommand } from './TaskMaster';
import WorkspaceIcon from './WorkspaceIcon';

export default function QuickWorkActions({
  task,
  tasks,
  canEdit,
  busy,
  command,
}: {
  task: WorkItem;
  tasks: Task[];
  canEdit: boolean;
  busy: boolean;
  command: WorkspaceCommand;
}) {
  const [date, setDate] = useState(task.workDate || '');
  const [scheduling, setScheduling] = useState(false);
  const parent = task.parentTaskId ? tasks.find(t => t.id === task.parentTaskId) : task;
  if (!canEdit || !parent || task.cancelledAt || task.validationStatus === 'NeedsConfirmation') return null;
  const done = task.status === 'Completed';
  const today = todayInPanama();
  const tomorrow = shiftDay(today, 1);

  async function update(fields: Record<string, unknown>, reason: string) {
    if (!parent) return false;
    const payload = task.stepId
      ? {
          steps: parent.steps.map(s =>
            s.id === task.stepId
              ? { ...s, ...fields, ...(fields.status ? { completed: fields.status === 'Completed' } : {}) }
              : s
          ),
        }
      : fields;
    return command('updateTask', payload, reason, parent.id, parent.revision || 0);
  }

  return (
    <div className="tm-quick-actions" aria-label={`Acciones de ${task.title}`}>
      <button
        className="tm-soft-button"
        disabled={busy}
        aria-label={`${done ? 'Reabrir' : 'Hecho'}: ${task.title}`}
        onClick={() =>
          update(
            { status: done ? 'Pending' : 'Completed' },
            done ? 'Trabajo reabierto desde la acción directa.' : 'Trabajo marcado como hecho desde la acción directa.'
          )
        }
      >
        <WorkspaceIcon name="check" size={16} />
        {done ? 'Reabrir' : 'Hecho'}
      </button>
      {!done && task.workDate !== today && (
        <button
          type="button"
          className="tm-soft-button"
          disabled={busy}
          onClick={() => update({ workDate: today }, 'Movida a operación de hoy.')}
        >
          ⚡ Traer a Hoy
        </button>
      )}
      {!done && (
        <button
          type="button"
          className="tm-soft-button"
          disabled={busy}
          onClick={() => update({ workDate: tomorrow }, 'Reprogramada +1 día.')}
        >
          📅 +1 día
        </button>
      )}
      {!done && (
        <button
          className="tm-soft-button"
          disabled={busy}
          onClick={() => {
            setDate(task.workDate || today);
            setScheduling(v => !v);
          }}
        >
          Reprogramar
        </button>
      )}
      {scheduling && (
        <form
          className="tm-quick-schedule"
          onSubmit={async e => {
            e.preventDefault();
            if (await update({ workDate: date }, 'Fecha de trabajo reprogramada; vencimiento conservado.'))
              setScheduling(false);
          }}
        >
          <label>
            Fecha de trabajo
            <input
              aria-label={`Nueva fecha de trabajo de ${task.title}`}
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              disabled={busy}
            />
          </label>
          <button className="tm-gold-button" disabled={busy}>
            Guardar fecha
          </button>
          <button type="button" className="tm-soft-button" disabled={busy} onClick={() => setScheduling(false)}>
            Cancelar
          </button>
        </form>
      )}
    </div>
  );
}
