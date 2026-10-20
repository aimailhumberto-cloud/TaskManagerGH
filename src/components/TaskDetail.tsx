'use client';
import { useEffect, useRef, useState } from 'react';
import type { Task, Company, Person, Step } from '@/services/mockData';
import { taskState } from '@/lib/workspaceDisplay';
import { getCompanyMeta } from '@/lib/hbCompanies';
import type { WorkspaceCommand } from './TaskMaster';
import WorkspaceIcon from './WorkspaceIcon';
import QuickWorkActions from './QuickWorkActions';

function buildSmartStepsForTask(task: Task): string[] {
  const text = `${task.title} ${task.description || ''} ${task.category || ''} ${task.contextNotes || ''}`.toLowerCase();
  if (/armando|ia para todos/i.test(text)) {
    return [
      'Confirmar requerimiento técnico y audiovisual con Armando Pinzón',
      'Validar presupuesto final y cronograma de IA para Todos',
      'Definir entregables de comunicación y flyers con equipo Bee Smart',
      'Enviar correo de acuerdos y siguientes pasos post-reunión',
    ];
  }
  if (/ingredienta/i.test(text)) {
    return [
      'Revisar estatus de propuestas y condiciones comerciales con Ingredienta',
      'Validar precios, márgenes y tiempos de entrega',
      'Confirmar próximo hito de cierre con cliente',
    ];
  }
  if (/surf\s*shack|playa caracol/i.test(text)) {
    return [
      'Verificar operación y flujo de caja de Surf Shack en Playa Caracol',
      'Revisar pagos pendientes y estructura legal/operativa',
      'Confirmar reporte semanal con encargado en sitio',
    ];
  }
  if (/academia|surf\s*101|florencia/i.test(text)) {
    return [
      'Revisar programación de clases e instructores de Academia Nacional de Surf',
      'Validar entregables de Surf 101 y seguimiento con Florencia',
      'Confirmar calendario de reservas de la semana',
    ];
  }
  if (/jaleel|smj|cases/i.test(text)) {
    return [
      'Revisar avance de volumen trimestral frente a meta de 301,430 cases',
      'Validar estado de clientes activos y propuestas en negociación',
      'Actualizar evidencia en el Scorecard de 14 criterios contractuales',
    ];
  }
  return [
    `Definir alcance y criterio de cierre para: ${task.title}`,
    'Ejecutar acción principal y validar con responsables',
    'Documentar acuerdos y confirmar fecha de entrega final',
  ];
}

function extractStepsFromTranscript(rawText: string, fallbackTask: Task): string[] {
  const sentences = rawText
    .split(/(?:[\r\n]+|;|\.(?:\s+|$))/)
    .map(s => s.trim())
    .filter(s => s.length > 6);
  const actionSentences = sentences.filter(s =>
    /\b(acordamos|enviar|confirmar|revisar|aprobar|cerrar|llamar|cotizar|preparar|validar|entregar|pendiente|paso)\b/i.test(
      s
    )
  );
  if (actionSentences.length > 0) {
    return actionSentences.slice(0, 6).map(s => s.charAt(0).toUpperCase() + s.slice(1));
  }
  if (sentences.length >= 2) {
    return sentences.slice(0, 4).map(s => s.charAt(0).toUpperCase() + s.slice(1));
  }
  return buildSmartStepsForTask(fallbackTask).slice(0, 3);
}

export default function TaskDetail({
  task,
  tasks,
  companies,
  people,
  canEdit,
  busy,
  command,
}: {
  task: Task;
  tasks: Task[];
  companies: Company[];
  people: Person[];
  canEdit: boolean;
  busy: boolean;
  command: WorkspaceCommand;
}) {
  const [tab, setTab] = useState(task.type === 'Project' ? 'steps' : 'detail');
  const [steps, setSteps] = useState<Step[]>(structuredClone(task.steps));
  const [stepTitle, setStepTitle] = useState('');
  const [quickStepText, setQuickStepText] = useState('');
  const [reason, setReason] = useState('');

  // Audio & Mobile Notes Sync State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [audioBlobUrl, setAudioBlobUrl] = useState<string>('');
  const [notesDrawerOpen, setNotesDrawerOpen] = useState(false);
  const [manualNoteText, setManualNoteText] = useState('');
  const [noteSourceLabel, setNoteSourceLabel] = useState('Apple Notes (iPhone)');
  const [aiOutputTitle, setAiOutputTitle] = useState('');
  const [aiOutputBody, setAiOutputBody] = useState('');
  const [emailDraft, setEmailDraft] = useState<{ subject: string; body: string } | null>(null);
  const [syncBanner, setSyncBanner] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    setSteps(structuredClone(task.steps));
  }, [task.id, task.revision, task.steps]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      try {
        recognitionRef.current?.stop();
      } catch {
        /* ignore */
      }
      try {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
      } catch {
        /* ignore */
      }
    };
  }, []);

  const save = (fields: Record<string, unknown>, why: string) =>
    command('updateTask', fields, why, task.id, task.revision || 0);

  const setStep = (id: string, field: string, value: unknown) =>
    setSteps(current =>
      current.map(s =>
        s.id === id
          ? {
              ...s,
              [field]: value,
              ...(field === 'completed'
                ? { status: value ? 'Completed' : 'Pending' }
                : field === 'status'
                  ? { completed: value === 'Completed' }
                  : {}),
            }
          : s
      )
    );

  const activeSteps = task.steps.filter(s => !s.cancelled);
  const completed = activeSteps.filter(s => s.completed).length;
  const companyObj = companies.find(c => c.id === task.companyId);
  const companyMeta = getCompanyMeta(task.companyId, companyObj?.name);

  const formatDuration = (sec: number) => {
    const m = String(Math.floor(sec / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return `${m}:${s}`;
  };

  // Start or stop live microphone recording on mobile/desktop
  const handleToggleRecording = async () => {
    if (isRecording) {
      // Stop recording and save
      if (timerRef.current) clearInterval(timerRef.current);
      try {
        recognitionRef.current?.stop();
      } catch {
        /* ignore */
      }
      try {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
      } catch {
        /* ignore */
      }
      setIsRecording(false);

      const finalTranscript =
        liveTranscript.trim() ||
        `Grabación de audio capturada (${formatDuration(recordingSeconds)}) en "${task.title}".`;
      const extracted = extractStepsFromTranscript(finalTranscript, task);
      const summaryText = `Grabación (${formatDuration(recordingSeconds)}): ${finalTranscript.slice(0, 260)}`;
      const existingSteps = task.steps || [];
      const mergedSteps: Step[] = [
        ...existingSteps,
        ...extracted
          .filter(txt => !existingSteps.some(es => es.text.toLowerCase() === txt.toLowerCase()))
          .map(txt => ({
            id: crypto.randomUUID(),
            text: txt.slice(0, 240),
            completed: false,
            status: 'Pending' as const,
            assigneeId: task.assigneeId,
          })),
      ];
      const stamp = new Date().toLocaleString('es-PA', { timeZone: 'America/Panama' });
      const nextContext = [
        task.contextNotes,
        `[🎙️ Audio Grabado en TaskManager HB · ${stamp} (${formatDuration(recordingSeconds)})]\n${finalTranscript}`,
      ]
        .filter(Boolean)
        .join('\n\n')
        .slice(0, 1900);

      await save(
        {
          contextNotes: nextContext,
          description: task.description ? `${task.description}\n\n💡 ${summaryText}` : `💡 ${summaryText}`,
          steps: mergedSteps,
          nextAction: extracted[0] || task.nextAction || 'Revisar acuerdos de la grabación',
        },
        'Grabación de audio y extracción automática de acuerdos'
      );
      setSyncBanner('✓ Grabación guardada y acuerdos convertidos en pasos automáticamente.');
      return;
    }

    // Request standard HTTPS microphone permission
    setSyncBanner('');
    setLiveTranscript('');
    setRecordingSeconds(0);
    try {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        chunksRef.current = [];
        const recorder = new MediaRecorder(stream);
        recorder.ondataavailable = e => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };
        recorder.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
          const url = URL.createObjectURL(blob);
          setAudioBlobUrl(url);
          stream.getTracks().forEach(t => t.stop());
        };
        mediaRecorderRef.current = recorder;
        recorder.start();
      }

      const SpeechRecognition =
        typeof window !== 'undefined'
          ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
          : null;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.lang = 'es-PA';
        rec.continuous = true;
        rec.interimResults = true;
        rec.onresult = (event: any) => {
          const text = Array.from(event.results)
            .map((r: any) => r[0]?.transcript || '')
            .join(' ')
            .trim();
          if (text) setLiveTranscript(text);
        };
        recognitionRef.current = rec;
        rec.start();
      }

      setIsRecording(true);
      timerRef.current = setInterval(() => {
        setRecordingSeconds(s => s + 1);
      }, 1000);
      setSyncBanner('🔴 Grabando desde tu micrófono... habla con normalidad y toca "Detener y Guardar" al finalizar.');
    } catch {
      setSyncBanner(
        '⚠️ Permite el acceso al micrófono cuando tu navegador (Safari/Chrome) te lo pida arriba, o usa "📲 Sincronizar de Notes / Audio" para adjuntar una nota.'
      );
    }
  };

  // Import audio file or Apple Notes text
  const handleImportNoteOrAudio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualNoteText.trim()) return;
    const extracted = extractStepsFromTranscript(manualNoteText, task);
    const existingSteps = task.steps || [];
    const mergedSteps: Step[] = [
      ...existingSteps,
      ...extracted
        .filter(txt => !existingSteps.some(es => es.text.toLowerCase() === txt.toLowerCase()))
        .map(txt => ({
          id: crypto.randomUUID(),
          text: txt.slice(0, 240),
          completed: false,
          status: 'Pending' as const,
          assigneeId: task.assigneeId,
        })),
    ];
    const stamp = new Date().toLocaleString('es-PA', { timeZone: 'America/Panama' });
    const formatted = `[📱 Sincronizado de ${noteSourceLabel} · ${stamp}]\n${manualNoteText.trim()}`;
    const nextContext = [task.contextNotes, formatted].filter(Boolean).join('\n\n').slice(0, 1900);

    const ok = await save(
      {
        contextNotes: nextContext,
        steps: mergedSteps,
        nextAction: extracted[0] || task.nextAction || 'Ejecutar acuerdos de la nota',
      },
      `Sincronizado desde ${noteSourceLabel}`
    );
    if (ok) {
      setManualNoteText('');
      setNotesDrawerOpen(false);
      setSyncBanner(`✓ Nota de ${noteSourceLabel} vinculada y desglosada en ${extracted.length} pasos.`);
    }
  };

  // 4 AI Internal Generation Actions (Notion-style)
  const handleAiGenerateMinutes = async () => {
    const raw = `${task.description || ''} ${task.contextNotes || ''} ${liveTranscript || ''}`.trim();
    const extracted = extractStepsFromTranscript(raw || task.title, task);
    const summary = raw
      ? `Acuerdos clave sobre "${task.title}" (${companyObj?.name || 'Empresa'}): ${raw.slice(0, 280)}`
      : `Minuta ejecutiva para "${task.title}" (${companyObj?.name || 'Empresa'} · ${
          task.category || 'Operación'
        }): alinear entregables, validar presupuesto/fechas y confirmar responsable de ejecución.`;

    setAiOutputTitle('✨ Minuta y Acuerdos Generados');
    setAiOutputBody(summary);

    if (canEdit) {
      const existingSteps = task.steps || [];
      const mergedSteps: Step[] = [
        ...existingSteps,
        ...extracted
          .filter(txt => !existingSteps.some(es => es.text.toLowerCase() === txt.toLowerCase()))
          .map(txt => ({
            id: crypto.randomUUID(),
            text: txt.slice(0, 240),
            completed: false,
            status: 'Pending' as const,
            assigneeId: task.assigneeId,
          })),
      ];
      await save(
        {
          description: summary.slice(0, 1800),
          steps: mergedSteps,
          nextAction: extracted[0] || task.nextAction || 'Validar acuerdos de la reunión',
        },
        'Minuta y acuerdos generados con IA interna'
      );
    }
  };

  const handleAiBreakdownSteps = async () => {
    const suggested = buildSmartStepsForTask(task);
    const existingSteps = task.steps || [];
    const newSteps: Step[] = [
      ...existingSteps,
      ...suggested
        .filter(txt => !existingSteps.some(es => es.text.toLowerCase() === txt.toLowerCase()))
        .map(txt => ({
          id: crypto.randomUUID(),
          text: txt,
          completed: false,
          status: 'Pending' as const,
          assigneeId: task.assigneeId,
        })),
    ];
    setSteps(newSteps);
    setAiOutputTitle('📋 Desglose Operativo Generado');
    setAiOutputBody(`Se estructuraron ${newSteps.length} pasos ejecutables para "${task.title}".`);
    if (canEdit) {
      await save(
        {
          steps: newSteps,
          nextAction: suggested[0] || task.nextAction,
        },
        'Desglose automático en pasos estilo Notion'
      );
    }
  };

  const handleAiPreMeetingBrief = () => {
    const relatedTasks = tasks.filter(
      t => t.companyId === task.companyId && t.id !== task.id && !t.cancelledAt && t.status !== 'Completed'
    );
    const briefLines = [
      `• Unidad de Negocio: ${companyMeta.icon} ${companyObj?.name || 'Empresa'}${
        task.category ? ` · Sub-marca: ${task.category}` : ''
      }`,
      `• Objetivo de la sesión: Cerrar acuerdos concretos sobre "${task.title}" y definir fechas de entrega.`,
      relatedTasks.length
        ? `• Otros pendientes abiertos en ${companyObj?.name}: ${relatedTasks
            .slice(0, 3)
            .map(t => t.title)
            .join(' | ')}`
        : '• Sin cuellos de botella adicionales en esta empresa.',
      '• 3 Preguntas Clave para hoy: (1) ¿Qué bloquea el cierre esta semana? (2) ¿Quién queda como responsable directo? (3) ¿Cuál es la fecha compromiso final?',
    ];
    setAiOutputTitle('📊 Brief Ejecutivo Pre-Reunión');
    setAiOutputBody(briefLines.join('\n'));
  };

  const handleAiDraftFollowUpEmail = () => {
    const activeChecklist = (steps.length ? steps : buildSmartStepsForTask(task).map(t => ({ text: t })))
      .slice(0, 5)
      .map((s, i) => `${i + 1}. ${s.text}`)
      .join('\n');
    const subject = `Acuerdos y Seguimiento: ${task.title} (${companyObj?.name || 'TaskManager HB'})`;
    const body = `Hola equipo,\n\nGracias por el tiempo en nuestra sesión sobre "${task.title}". Comparto el resumen de acuerdos y siguientes pasos:\n\n${
      task.description ? `Resumen:\n${task.description}\n\n` : ''
    }Próximos pasos acordados:\n${activeChecklist}\n\nQuedo atento a su confirmación.\n\nSaludos,\nHumberto`;
    setEmailDraft({ subject, body });
  };

  return (
    <div className="tm-task-detail tm-notion-page">
      {/* NOTION-STYLE HEADER & PROPERTIES TABLE */}
      <div className="tm-detail-hero tm-notion-hero">
        <div className="tm-notion-breadcrumbs">
          <span className="tm-notion-company-pill">
            {companyMeta.icon} {companyObj?.name || 'Sin empresa'}
          </span>
          {task.category && <span className="tm-notion-subbrand-pill">📂 {task.category}</span>}
          <span className="tm-status">{taskState(task)}</span>
        </div>

        <h2>{task.title}</h2>
        <p>{task.description || task.nextAction || 'Define la siguiente acción o graba la nota de reunión abajo.'}</p>

        <div className="tm-notion-props-grid" aria-label="Propiedades estilo Notion">
          <div className="tm-notion-prop-row">
            <span className="tm-notion-prop-key">📅 Fecha & Hora</span>
            <span className="tm-notion-prop-val">
              {task.workDate || task.dueDate?.slice(0, 10) || 'Hoy'}{' '}
              {task.meetingTime ? `· ⏰ ${task.meetingTime} (Panamá)` : ''}
            </span>
          </div>
          <div className="tm-notion-prop-row">
            <span className="tm-notion-prop-key">🔗 Conectividad</span>
            <div className="tm-notion-source-pills">
              <span className="tm-source-badge">✉️ Gmail: hebouche@gmail.com</span>
              <span className="tm-source-badge">📅 Google Calendar Sync</span>
              <span className="tm-source-badge tm-source-badge-gold">📱 Audio / Notes Auto-Sync</span>
            </div>
          </div>
        </div>

        {task.type === 'Project' && (
          <div className="tm-step-progress">
            <span>
              {completed} / {activeSteps.length} pasos completados
              {!activeSteps.length && ' · Proyecto por estructurar'}
            </span>
            <progress aria-label="Avance por pasos" max={activeSteps.length || 1} value={completed} />
          </div>
        )}
      </div>

      {/* LIVE AUDIO RECORDER & MOBILE NOTES SYNC WIDGET */}
      <section className="tm-notion-audio-box" aria-label="Grabación y sincronización de notas de reunión">
        <div className="tm-notion-audio-header">
          <div>
            <span className="tm-eyebrow">🎙️ GRABADORA EN VIVO & AUTO-SYNC CON NOTES DEL CELULAR</span>
            <h3>Audio, Transcripción y Notas de Reunión</h3>
          </div>
          <div className="tm-notion-audio-actions">
            <button
              type="button"
              className={`tm-gold-button ${isRecording ? 'is-recording-pulse' : ''}`}
              disabled={busy}
              onClick={handleToggleRecording}
            >
              {isRecording
                ? `⏹️ Detener y Guardar (${formatDuration(recordingSeconds)})`
                : '🎙️ Grabar Audio Aquí'}
            </button>
            <button
              type="button"
              className="tm-soft-button"
              disabled={busy}
              onClick={() => setNotesDrawerOpen(v => !v)}
            >
              📲 {notesDrawerOpen ? 'Cerrar' : 'Sincronizar de Notes / Audio'}
            </button>
          </div>
        </div>

        {syncBanner && <p className="tm-notion-sync-banner">{syncBanner}</p>}

        {isRecording && (
          <div className="tm-live-recording-box">
            <div className="tm-waveform-bars" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
            <div>
              <strong>Grabando reunión en tiempo real ({formatDuration(recordingSeconds)})</strong>
              <p className="tm-small">
                {liveTranscript || 'Escuchando... todo lo que digas se convertirá en minuta y pasos al detener.'}
              </p>
            </div>
          </div>
        )}

        {audioBlobUrl && !isRecording && (
          <div className="tm-recorded-player">
            <span>🎧 Grabación capturada en esta sesión:</span>
            <audio controls src={audioBlobUrl} />
          </div>
        )}

        {notesDrawerOpen && (
          <form className="tm-notes-import-drawer" onSubmit={handleImportNoteOrAudio}>
            <div className="tm-notes-import-top">
              <label>
                Origen en tu celular:
                <select value={noteSourceLabel} onChange={e => setNoteSourceLabel(e.target.value)}>
                  <option value="Apple Notes (iPhone)">📱 Apple Notes (iPhone)</option>
                  <option value="Notas de Voz (Voice Memos)">🎙️ Notas de Voz (Voice Memos)</option>
                  <option value="Google Recorder / Drive">☁️ Google Recorder / Drive</option>
                  <option value="WhatsApp / Correo">💬 WhatsApp / Correo</option>
                </select>
              </label>
              <label className="tm-file-upload-label">
                📎 Subir archivo de audio/texto del celular
                <input
                  type="file"
                  accept="audio/*,text/*,.m4a,.mp3,.wav,.txt"
                  onChange={async e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.type.startsWith('audio/')) {
                      const url = URL.createObjectURL(file);
                      setAudioBlobUrl(url);
                      setManualNoteText(
                        prev =>
                          prev ||
                          `Archivo de audio adjunto desde el celular: "${file.name}". Extraer acuerdos y seguimiento de "${task.title}".`
                      );
                    } else {
                      const txt = await file.text();
                      setManualNoteText(txt);
                    }
                  }}
                />
              </label>
            </div>
            <textarea
               rows={3}
              placeholder="Pega o dicta aquí la nota de Apple Notes o el resumen de voz (o deja que tu Agente IA lo envíe en automático a POST /api/agent/hub con action='ingest_voice_note')…"
              value={manualNoteText}
              onChange={e => setManualNoteText(e.target.value)}
              required
            />
            <button type="submit" className="tm-gold-button" disabled={busy}>
              ✨ Procesar Nota y Extraer Pasos en Automático
            </button>
          </form>
        )}
      </section>

      {/* AI INTERNAL GENERATION TOOLBAR (NOTION AI STYLE) */}
      <section className="tm-notion-ai-toolbar" aria-label="Generación interna con IA">
        <span className="tm-eyebrow">✨ GENERACIÓN INTERNA ESTILO NOTION</span>
        <div className="tm-notion-ai-buttons">
          <button type="button" className="tm-ai-pill-btn" disabled={busy} onClick={handleAiGenerateMinutes}>
            ✨ Generar Minuta y Acuerdos
          </button>
          <button type="button" className="tm-ai-pill-btn" disabled={busy} onClick={handleAiBreakdownSteps}>
            📋 Desglosar en Pasos
          </button>
          <button type="button" className="tm-ai-pill-btn" disabled={busy} onClick={handleAiPreMeetingBrief}>
            📊 Brief Pre-Reunión
          </button>
          <button type="button" className="tm-ai-pill-btn" disabled={busy} onClick={handleAiDraftFollowUpEmail}>
            ✉️ Redactar Correo de Seguimiento
          </button>
        </div>

        {aiOutputBody && (
          <div className="tm-notion-callout">
            <div className="tm-notion-callout-head">
              <strong>{aiOutputTitle}</strong>
              <button type="button" className="tm-soft-button tm-btn-xs" onClick={() => setAiOutputBody('')}>
                Cerrar
              </button>
            </div>
            <pre className="tm-notion-callout-pre">{aiOutputBody}</pre>
          </div>
        )}

        {emailDraft && (
          <div className="tm-notion-callout tm-notion-email-draft">
            <div className="tm-notion-callout-head">
              <strong>✉️ Borrador de Correo Listo (`hebouche@gmail.com`)</strong>
              <div className="tm-inline-actions">
                <button
                  type="button"
                  className="tm-gold-button tm-btn-xs"
                  onClick={() => {
                    navigator.clipboard?.writeText(`Asunto: ${emailDraft.subject}\n\n${emailDraft.body}`);
                    setSyncBanner('✓ Borrador copiado al portapapeles.');
                  }}
                >
                  📋 Copiar
                </button>
                <a
                  className="tm-soft-button tm-btn-xs"
                  href={`https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(
                    emailDraft.subject
                  )}&body=${encodeURIComponent(emailDraft.body)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  ✉️ Abrir en Gmail ↗
                </a>
                <button type="button" className="tm-soft-button tm-btn-xs" onClick={() => setEmailDraft(null)}>
                  ✕
                </button>
              </div>
            </div>
            <p className="tm-small">
              <strong>Asunto:</strong> {emailDraft.subject}
            </p>
            <pre className="tm-notion-callout-pre">{emailDraft.body}</pre>
          </div>
        )}
      </section>

      {/* NOTION CALLOUT: RESUMEN & NOTAS SINCRONIZADAS + CHECKLIST INTERACTIVO */}
      <section className="tm-notion-canvas-blocks" aria-label="Bloques de notas y compromisos">
        {task.contextNotes && (
          <div className="tm-notion-callout">
            <strong>💡 Notas de Reunión / Contexto Sincronizado</strong>
            <pre className="tm-notion-callout-pre">{task.contextNotes}</pre>
          </div>
        )}

        <div className="tm-notion-checklist-block">
          <div className="tm-notion-checklist-head">
            <strong>
              ☑️ Pasos y Compromisos Extraídos ({completed}/{activeSteps.length})
            </strong>
            {!activeSteps.length && canEdit && (
              <button type="button" className="tm-soft-button tm-btn-xs" onClick={handleAiBreakdownSteps}>
                ✨ Sugerir pasos con IA
              </button>
            )}
          </div>

          <div className="tm-notion-checklist-items">
            {steps
              .filter(s => !s.cancelled)
              .map(step => (
                <label key={step.id} className={`tm-notion-check-row ${step.completed ? 'is-done' : ''}`}>
                  <input
                    type="checkbox"
                    checked={step.completed}
                    disabled={!canEdit || busy}
                    onChange={async e => {
                      const checked = e.target.checked;
                      const updatedSteps = steps.map(s =>
                        s.id === step.id
                          ? { ...s, completed: checked, status: (checked ? 'Completed' : 'Pending') as Step['status'] }
                          : s
                      );
                      setSteps(updatedSteps);
                      await save({ steps: updatedSteps }, `Paso ${checked ? 'completado' : 'reabierto'}: ${step.text}`);
                    }}
                  />
                  <span>{step.text}</span>
                </label>
              ))}
          </div>

          {canEdit && (
            <form
              className="tm-notion-quick-step"
              onSubmit={async e => {
                e.preventDefault();
                if (!quickStepText.trim()) return;
                const updatedSteps: Step[] = [
                  ...steps,
                  {
                    id: crypto.randomUUID(),
                    text: quickStepText.trim(),
                    completed: false,
                    status: 'Pending',
                    assigneeId: task.assigneeId,
                  },
                ];
                setSteps(updatedSteps);
                setQuickStepText('');
                await save({ steps: updatedSteps }, 'Nuevo compromiso añadido en bloque Notion');
              }}
            >
              <input
                placeholder="+ Escribe un nuevo acuerdo o paso y presiona Enter…"
                value={quickStepText}
                onChange={e => setQuickStepText(e.target.value)}
                disabled={busy}
              />
              <button type="submit" className="tm-soft-button tm-btn-xs" disabled={busy || !quickStepText.trim()}>
                Añadir
              </button>
            </form>
          )}
        </div>
      </section>

      <QuickWorkActions task={task} tasks={tasks} {...{ canEdit, busy, command }} />

      <nav className="tm-tabs" aria-label="Detalle de tarea">
        {[
          ['detail', 'Información'],
          ['steps', 'Pasos'],
          ['history', 'Historial'],
        ].map(([key, label]) => (
          <button key={key} aria-pressed={tab === key} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </nav>

      {tab === 'detail' && (
        <form
          key={`${task.id}:${task.revision}`}
          aria-label="Editar trabajo"
          className="tm-form-grid"
          onSubmit={async e => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const values = Object.fromEntries(formData);
            const { reason: why, taskDependencies: _taskDependencies, ...fields } = values;
            await save(
              {
                ...fields,
                isMeeting: formData.has('isMeeting'),
                dependencyIds: formData.getAll('taskDependencies'),
                subcategories: String(values.subcategories)
                  .split(',')
                  .map(v => v.trim())
                  .filter(Boolean),
              },
              String(why || '').trim() || 'Actualización desde el detalle de trabajo.'
            );
          }}
        >
          <label className="tm-wide">
            Tarea / nombre del proyecto
            <input name="title" defaultValue={task.title} required maxLength={240} disabled={!canEdit} />
          </label>
          <label>
            Empresa
            <select name="companyId" defaultValue={task.companyId} disabled={!canEdit}>
              {!task.companyId && <option value="">Sin empresa asignada</option>}
              {companies.map(c => (
                <option value={c.id} key={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tipo de trabajo
            <select name="type" defaultValue={task.type} disabled={!canEdit}>
              <option value="One-shot">Tarea</option>
              <option value="Project">Proyecto con pasos</option>
              <option value="Repetitive">Tarea recurrente</option>
            </select>
          </label>
          <label>
            Categoría
            <input name="category" defaultValue={task.category || ''} maxLength={120} disabled={!canEdit} />
          </label>
          <label>
            Subcategorías (separadas por comas)
            <input name="subcategories" defaultValue={task.subcategories?.join(', ') || ''} disabled={!canEdit} />
          </label>
          <label className="tm-wide">
            Objetivo / contexto
            <textarea name="description" defaultValue={task.description} disabled={!canEdit} />
          </label>
          <label className="tm-wide">
            Siguiente acción
            <input name="nextAction" defaultValue={task.nextAction || ''} disabled={!canEdit} />
          </label>
          <label>
            Responsable de ejecutar
            <select name="assigneeId" defaultValue={task.assigneeId} disabled={!canEdit}>
              {!task.assigneeId && <option value="">Sin responsable asignado</option>}
              {people.map(p => (
                <option value={p.id} key={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Estado
            <select name="status" defaultValue={task.status} disabled={!canEdit}>
              {[
                ['Pending', 'Pendiente'],
                ['In Progress', 'En curso'],
                ['Blocked', 'Bloqueada'],
                ['Completed', 'Completada'],
              ].map(([v, label]) => (
                <option value={v} key={v}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Fecha de trabajo
            <input type="date" name="workDate" defaultValue={task.workDate || ''} disabled={!canEdit} />
          </label>
          <label>
            Vencimiento
            <input type="date" name="dueDate" defaultValue={task.dueDate?.slice(0, 10) || ''} disabled={!canEdit} />
          </label>
          <label>
            Horario de trabajo
            <select name="workSlot" defaultValue={task.workSlot || ''} disabled={!canEdit}>
              <option value="">Sin hora</option>
              <option value="Morning">Mañana</option>
              <option value="Afternoon">Tarde</option>
              <option value="Evening">Noche</option>
              <option value="Exact">Hora exacta</option>
            </select>
          </label>
          <label>
            Hora exacta (Panamá)
            <input type="time" name="workTime" defaultValue={task.workTime || ''} disabled={!canEdit} />
          </label>
          <label>
            Esperando a
            <input name="waitingOn" defaultValue={task.waitingOn || ''} disabled={!canEdit} />
          </label>
          <label>
            Próximo seguimiento
            <input type="date" name="followUpDate" defaultValue={task.followUpDate || ''} disabled={!canEdit} />
          </label>
          <label className="tm-wide">
            Fuente original
            <input type="url" name="sourceUrl" defaultValue={task.sourceUrl || ''} disabled={!canEdit} />
          </label>
          {task.sourceUrl && (
            <a className="tm-source-link" href={task.sourceUrl} target="_blank" rel="noopener noreferrer">
              <WorkspaceIcon name="source" size={16} />
              Abrir fuente
            </a>
          )}
          <details className="tm-wide tm-detail-more">
            <summary>Notas, compromisos y validación</summary>
            <div className="tm-form-grid">
              <label className="tm-wide">
                Notas respaldadas
                <textarea name="contextNotes" defaultValue={task.contextNotes || ''} disabled={!canEdit} />
              </label>
              <label>
                Repetición
                <select name="repeatPattern" defaultValue={task.repeatPattern || ''} disabled={!canEdit}>
                  <option value="">Sin repetición</option>
                  <option value="Daily">Diaria</option>
                  <option value="Weekly">Semanal</option>
                  <option value="Monthly">Mensual</option>
                </select>
              </label>
              <label className="tm-check">
                <input type="checkbox" name="isMeeting" defaultChecked={task.isMeeting} disabled={!canEdit} />
                Es una reunión
              </label>
              <label>
                Hora de reunión (Panamá)
                <input type="time" name="meetingTime" defaultValue={task.meetingTime || ''} disabled={!canEdit} />
              </label>
              <label>
                Compromiso esperado
                <input name="commitment" defaultValue={task.commitment || ''} disabled={!canEdit} />
              </label>
              <label>
                Validación
                <select
                  name="validationStatus"
                  defaultValue={task.validationStatus || 'Confirmed'}
                  disabled={!canEdit}
                >
                  <option value="Confirmed">Confirmada</option>
                  <option value="NeedsConfirmation">Por confirmar</option>
                </select>
              </label>
              <label>
                Aprobación
                <select
                  name="approvalStatus"
                  defaultValue={task.approvalStatus || 'NotRequired'}
                  disabled={!canEdit}
                >
                  <option value="NotRequired">No requerida</option>
                  <option value="Pending">Por aprobar</option>
                  <option value="Approved">Aprobada</option>
                  <option value="Rejected">Rechazada</option>
                </select>
              </label>
              <label>
                Depende de tareas
                <select
                  multiple
                  name="taskDependencies"
                  defaultValue={task.dependencyIds || []}
                  disabled={!canEdit}
                >
                  {tasks
                    .filter(t => t.companyId === task.companyId && t.id !== task.id)
                    .map(t => (
                      <option value={t.id} key={t.id}>
                        {t.title}
                      </option>
                    ))}
                </select>
                <small>Selecciona los pendientes que deben completarse antes.</small>
              </label>
            </div>
          </details>
          {canEdit && (
            <>
              <label className="tm-wide">
                Motivo del cambio (opcional)
                <input name="reason" placeholder="Qué cambió y por qué" />
              </label>
              <button className="tm-gold-button" disabled={busy}>
                Guardar trabajo
              </button>
            </>
          )}
        </form>
      )}

      {tab === 'steps' && (
        <section aria-label="Pasos del proyecto">
          <div className="tm-step-road">
            {steps
              .filter(s => !s.cancelled)
              .map((s, i) => (
                <span className={s.completed ? 'is-completed' : ''} key={s.id}>
                  <b>{s.completed ? '✓' : i + 1}</b>
                  {s.text}
                </span>
              ))}
          </div>
          <div className="tm-step-list">
            {steps.map(step => (
              <details key={step.id} className={`tm-step-card ${step.cancelled ? 'is-cancelled' : ''}`}>
                <summary>
                  <span className="tm-step-symbol">
                    <WorkspaceIcon
                      name={step.completed ? 'check' : step.status === 'Blocked' || step.waitingOn ? 'clock' : 'task'}
                    />
                  </span>
                  <span>
                    <strong>{step.text}</strong>
                    <small>
                      {step.cancelled
                        ? 'Cancelado'
                        : step.completed
                          ? 'Completado'
                          : step.waitingOn
                            ? `Esperando a ${step.waitingOn}`
                            : step.status === 'Blocked'
                              ? 'Bloqueado'
                              : step.status === 'In Progress'
                                ? 'En curso'
                                : 'Pendiente'}
                      {step.dueDate && ` · Vence ${step.dueDate}`}
                    </small>
                  </span>
                  <span className="tm-step-chevron">⌄</span>
                </summary>
                <div className="tm-form-grid">
                  <label className="tm-wide">
                    Nombre del paso
                    <input
                      value={step.text}
                      disabled={!canEdit || busy}
                      onChange={e => setStep(step.id, 'text', e.target.value)}
                    />
                  </label>
                  <label>
                    Responsable del paso
                    <select
                      value={step.assigneeId || task.assigneeId}
                      disabled={!canEdit || busy}
                      onChange={e => setStep(step.id, 'assigneeId', e.target.value)}
                    >
                      {people.map(p => (
                        <option value={p.id} key={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Estado del paso
                    <select
                      value={step.completed ? 'Completed' : step.status || 'Pending'}
                      disabled={!canEdit || busy || step.cancelled}
                      onChange={e => setStep(step.id, 'status', e.target.value)}
                    >
                      {[
                        ['Pending', 'Pendiente'],
                        ['In Progress', 'En curso'],
                        ['Blocked', 'Bloqueado'],
                        ['Completed', 'Completado'],
                      ].map(([v, label]) => (
                        <option value={v} key={v}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Trabajo del paso
                    <input
                      type="date"
                      value={step.workDate || ''}
                      disabled={!canEdit || busy}
                      onChange={e => setStep(step.id, 'workDate', e.target.value)}
                    />
                  </label>
                  <label>
                    Vencimiento del paso
                    <input
                      type="date"
                      value={(step.dueDate || '').slice(0, 10)}
                      disabled={!canEdit || busy}
                      onChange={e => setStep(step.id, 'dueDate', e.target.value)}
                    />
                  </label>
                  <label className="tm-wide">
                    Siguiente acción del paso
                    <input
                      value={step.nextAction || ''}
                      disabled={!canEdit || busy}
                      onChange={e => setStep(step.id, 'nextAction', e.target.value)}
                    />
                  </label>
                  <label>
                    Esperando respuesta de
                    <input
                      value={step.waitingOn || ''}
                      disabled={!canEdit || busy}
                      onChange={e => setStep(step.id, 'waitingOn', e.target.value)}
                    />
                  </label>
                  <label>
                    Depende de pasos
                    <select
                      multiple
                      value={step.dependencyIds || []}
                      disabled={!canEdit || busy}
                      onChange={e =>
                        setStep(
                          step.id,
                          'dependencyIds',
                          Array.from(e.target.selectedOptions, o => o.value)
                        )
                      }
                    >
                      {steps
                        .filter(s => s.id !== step.id)
                        .map(s => (
                          <option key={s.id} value={s.id}>
                            {s.text}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="tm-wide">
                    Evidencia del paso
                    <textarea
                      value={step.evidence || ''}
                      disabled={!canEdit || busy}
                      onChange={e => setStep(step.id, 'evidence', e.target.value)}
                    />
                  </label>
                  <label className="tm-wide">
                    Fuente del paso
                    <input
                      type="url"
                      value={step.sourceUrl || ''}
                      disabled={!canEdit || busy}
                      onChange={e => setStep(step.id, 'sourceUrl', e.target.value)}
                    />
                  </label>
                  {step.sourceUrl && (
                    <a className="tm-source-link" href={step.sourceUrl} target="_blank" rel="noopener noreferrer">
                      Abrir fuente del paso
                    </a>
                  )}
                  <label className="tm-check">
                    <input
                      type="checkbox"
                      checked={!!step.cancelled}
                      disabled={!canEdit || busy}
                      onChange={e => setStep(step.id, 'cancelled', e.target.checked)}
                    />
                    Paso cancelado (conserva historial)
                  </label>
                </div>
              </details>
            ))}
          </div>
          {!steps.length && <p className="tm-empty">Añade los pasos que necesita este trabajo.</p>}
          {canEdit && (
            <>
              <form
                className="tm-step-add"
                onSubmit={e => {
                  e.preventDefault();
                  if (stepTitle.trim()) {
                    setSteps(v => [
                      ...v,
                      { id: crypto.randomUUID(), text: stepTitle.trim(), completed: false, assigneeId: task.assigneeId },
                    ]);
                    setStepTitle('');
                  }
                }}
              >
                <input
                  aria-label="Nuevo paso"
                  value={stepTitle}
                  onChange={e => setStepTitle(e.target.value)}
                  required
                  maxLength={240}
                  placeholder="Añadir un paso…"
                />
                <button className="tm-soft-button" disabled={busy}>
                  Añadir paso
                </button>
              </form>
              <label className="tm-form-label">
                Motivo de cambios en pasos
                <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Qué cambió y por qué" />
              </label>
              <button
                className="tm-gold-button"
                disabled={busy}
                onClick={() => {
                  const cancelled = steps.some(s => !!s.cancelled !== !!task.steps.find(p => p.id === s.id)?.cancelled);
                  if (cancelled && !reason.trim()) {
                    window.alert('Explica la cancelación o reactivación del paso.');
                    return;
                  }
                  save({ steps }, reason.trim() || 'Actualización de pasos desde el detalle.');
                }}
              >
                Guardar pasos
              </button>
              <p className="tm-small">
                Añadir o editar un paso se conserva cuando guardas. Las dependencias y esperas se validan antes de
                completar.
              </p>
            </>
          )}
        </section>
      )}

      {tab === 'history' && (
        <section aria-label="Historial de trabajo">
          <h3>Cambios y procedencia</h3>
          {task.activityLog
            .slice()
            .reverse()
            .map((log, i) => (
              <article className="tm-history-item" key={i}>
                <span className="tm-eyebrow">
                  {new Date(log.timestamp).toLocaleString('es', { timeZone: 'America/Panama' })} · {log.user} · Revisión{' '}
                  {log.revision ?? 'anterior'}
                </span>
                <p>{log.action}</p>
                {log.provenance && (
                  <div className="tm-small">
                    Solicitud por {log.provenance.channel === 'voice' ? 'voz' : 'chat'}: {log.provenance.instruction}
                    <br />
                    Procedencia: {log.provenance.sourceKind}
                    {log.provenance.observedAt && ' · Leída ' + log.provenance.observedAt}
                    {log.provenance.sourceUrl && (
                      <a
                        href={log.provenance.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        {' '}
                        Abrir fuente de instrucción
                      </a>
                    )}
                  </div>
                )}
                {canEdit && log.snapshot && log.revision !== task.revision && (
                  <button
                    className="tm-soft-button"
                    disabled={busy}
                    onClick={() => {
                      const why = window.prompt('Motivo para restaurar esta revisión');
                      if (why?.trim())
                        command('restoreTask', { revision: log.revision }, why, task.id, task.revision || 0);
                    }}
                  >
                    Restaurar revisión {log.revision}
                  </button>
                )}
              </article>
            ))}
          {!task.activityLog.length && <p className="tm-empty">Sin cambios registrados.</p>}
          {canEdit && (
            <button
              className="tm-soft-button tm-danger"
              disabled={busy}
              onClick={() => {
                const why = window.prompt(task.cancelledAt ? 'Motivo de reactivar' : 'Motivo de cancelar');
                if (why?.trim()) save({ cancelled: !task.cancelledAt }, why);
              }}
            >
              {task.cancelledAt ? 'Reactivar trabajo' : 'Cancelar trabajo'}
            </button>
          )}
        </section>
      )}
    </div>
  );
}
