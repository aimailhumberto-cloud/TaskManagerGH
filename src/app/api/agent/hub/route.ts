import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/services/dbService';
import { readPublicHbWorkspace } from '@/services/publicHbWorkspace';
import { applyPublicTaskCommand } from '@/services/workspaceService';
import { publicTaskActor } from '@/lib/publicTaskScope';
import { HB_CANONICAL_COMPANIES, getCompanyMeta } from '@/lib/hbCompanies';
import { localDay, validDate } from '@/lib/personalTasks';
import { WorkspaceError } from '@/lib/projects';
import type { Task } from '@/services/mockData';

export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-agent-key',
  'Cache-Control': 'no-store',
};

function checkAgentAuth(req: NextRequest): { ok: boolean; error?: string } {
  const configuredKey = process.env.AGENT_API_KEY?.trim();
  if (!configuredKey) return { ok: true };
  const authHeader = req.headers.get('authorization') || '';
  const bearer = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';
  const headerKey = req.headers.get('x-agent-key')?.trim() || '';
  if (bearer === configuredKey || headerKey === configuredKey) return { ok: true };
  return { ok: false, error: 'Invalid or missing AGENT_API_KEY (use Authorization: Bearer <key> or x-agent-key).' };
}

export function inferCompanyAndCategory(rawText: string, explicitCompanyId?: string, explicitCategory?: string): {
  companyId: string;
  category: string;
  subcategories: string[];
} {
  const text = (rawText || '').toLowerCase();
  if (explicitCompanyId) {
    const cat = explicitCategory || '';
    return {
      companyId: explicitCompanyId,
      category: cat,
      subcategories: cat ? [cat] : [],
    };
  }
  if (/ia para todos|armando/i.test(text)) {
    return { companyId: 'business-bee-smart', category: 'IA para Todos', subcategories: ['IA para Todos'] };
  }
  if (/ingredienta/i.test(text)) {
    return { companyId: 'business-bee-smart', category: 'Ingredienta', subcategories: ['Ingredienta'] };
  }
  if (/rollup|flyer|hotel panam[aá] canal|bee\s*smart|bsmart/i.test(text)) {
    const cat = /rollup|flyer/i.test(text) ? 'Rollup y Flyers' : explicitCategory || 'Comercial';
    return { companyId: 'business-bee-smart', category: cat, subcategories: [cat] };
  }
  if (/academia|surf\s*101|florencia|instructor/i.test(text)) {
    return { companyId: 'business-academia-surf', category: 'Surf 101', subcategories: ['Surf 101'] };
  }
  if (/surf\s*shack|sorchak|playa caracol/i.test(text)) {
    return { companyId: 'business-surf-shack', category: 'Playa Caracol', subcategories: ['Playa Caracol'] };
  }
  if (/casa\s*mahana|casa\s*majana|hu[eé]sped|reserva/i.test(text)) {
    return { companyId: 'business-casa-mahana', category: 'Reservas', subcategories: ['Reservas'] };
  }
  if (/soluciones\s*express/i.test(text)) {
    return { companyId: 'business-soluciones-express', category: 'Operaciones', subcategories: ['Operaciones'] };
  }
  if (/mahana\s*tours|majana\s*tours|tour/i.test(text)) {
    return { companyId: 'business-mahana-tours', category: 'Tours', subcategories: ['Tours'] };
  }
  if (/jaleel|smj|sm\s*jalil|chubby|cases|trinidad/i.test(text)) {
    return { companyId: 'business-sm-jaleel', category: 'Contrato Año 1', subcategories: ['Contrato Año 1'] };
  }
  if (/pasaporte|visa|eta|esta|m[eé]dico|salud|personal/i.test(text)) {
    return { companyId: 'local-personal', category: 'Personal', subcategories: ['Personal'] };
  }
  return {
    companyId: 'business-bee-smart',
    category: explicitCategory || 'General',
    subcategories: explicitCategory ? [explicitCategory] : [],
  };
}

function addDays(dayStr: string, offset: number): string {
  const [y, m, d] = dayStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + offset));
  return dt.toISOString().slice(0, 10);
}

function inferScheduleFromText(rawText: string, today: string): {
  workDate: string;
  isMeeting: boolean;
  meetingTime: string;
} {
  const lower = (rawText || '').toLowerCase();
  let workDate = today;

  const isoMatch = lower.match(/\b(202\d-\d{2}-\d{2})\b/);
  if (isoMatch && validDate(isoMatch[1])) {
    workDate = isoMatch[1];
  } else if (/\bpasado\s+ma[ñn]ana\b/.test(lower)) {
    workDate = addDays(today, 2);
  } else if (/\bma[ñn]ana\b/.test(lower)) {
    workDate = addDays(today, 1);
  } else {
    const weekdays: Record<string, number> = {
      domingo: 0,
      lunes: 1,
      martes: 2,
      miercoles: 3,
      miércoles: 3,
      jueves: 4,
      viernes: 5,
      sabado: 6,
      sábado: 6,
    };
    const [y, m, d] = today.split('-').map(Number);
    const currentDow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    for (const [name, targetDow] of Object.entries(weekdays)) {
      if (new RegExp(`\\b${name}\\b`, 'i').test(lower)) {
        let diff = (targetDow - currentDow + 7) % 7;
        if (diff === 0) diff = 7;
        workDate = addDays(today, diff);
        break;
      }
    }
  }

  const isMeeting = /\b(reuni[oó]n|cita|call|llamada|zoom|meet|entrevista|almuerzo|sesi[oó]n)\b/i.test(lower);
  let meetingTime = '';
  const timeMatch12 = lower.match(/\b(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(am|pm|a\.m\.|p\.m\.)\b/i);
  const timeMatch24 = lower.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (timeMatch12) {
    let hr = parseInt(timeMatch12[1], 10);
    const min = timeMatch12[2] || '00';
    const mer = timeMatch12[3].toLowerCase();
    if (mer.startsWith('p') && hr < 12) hr += 12;
    if (mer.startsWith('a') && hr === 12) hr = 0;
    meetingTime = `${String(hr).padStart(2, '0')}:${min}`;
  } else if (timeMatch24) {
    meetingTime = `${String(parseInt(timeMatch24[1], 10)).padStart(2, '0')}:${timeMatch24[2]}`;
  } else if (isMeeting) {
    meetingTime = '10:00';
  }

  return { workDate, isMeeting, meetingTime };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(req: NextRequest) {
  const auth = checkAgentAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: 401, headers: CORS_HEADERS });
  }

  try {
    const view = await readPublicHbWorkspace();
    const today = localDay(new Date(), 'America/Panama');
    const activeTasks = view.tasks.filter(t => !t.cancelledAt && t.status !== 'Completed');

    const todayTasks = activeTasks.filter(
      t => t.workDate === today || t.dueDate?.slice(0, 10) === today || t.status === 'In Progress'
    );
    const overdueTasks = activeTasks.filter(t => {
      const d = t.dueDate?.slice(0, 10) || t.workDate || '';
      return (d && d <= addDays(today, 2)) || t.status === 'Blocked';
    });
    const deliverableTasks = activeTasks.filter(
      t => t.type === 'Project' || Boolean(t.projectId) || Boolean(t.deliverableId) || t.steps.length > 0
    );
    const upcomingMeetings = activeTasks
      .filter(t => t.isMeeting || Boolean(t.meetingTime))
      .sort((a, b) =>
        `${a.workDate || a.dueDate || '9999-99-99'}T${a.meetingTime || '23:59'}`.localeCompare(
          `${b.workDate || b.dueDate || '9999-99-99'}T${b.meetingTime || '23:59'}`
        )
      );
    const inboxToValidate = activeTasks.filter(t => t.validationStatus === 'NeedsConfirmation');

    const companiesWithMeta = view.companies.map(c => {
      const meta = getCompanyMeta(c.id, c.name);
      const count = activeTasks.filter(t => t.companyId === c.id).length;
      return {
        id: c.id,
        name: c.name,
        icon: meta.icon,
        subtitle: meta.subtitle,
        subBrands: meta.subBrands,
        activeTasksCount: count,
      };
    });

    return NextResponse.json(
      {
        ok: true,
        agentHubVersion: '2.0.0',
        today,
        timezone: 'America/Panama',
        googleEnvironment: {
          account: 'hebouche@gmail.com',
          calendarSyncSupported: true,
          gmailIngestionSupported: true,
          voiceAndNotesSyncSupported: true,
          lastCalendarSyncedAt: view.calendarSnapshot?.verifiedAt || null,
        },
        summary: {
          todayPendingCount: todayTasks.length,
          overdueOrAlertCount: overdueTasks.length,
          deliverablesActiveCount: deliverableTasks.length,
          upcomingMeetingsCount: upcomingMeetings.length,
          inboxToValidateCount: inboxToValidate.length,
          totalActiveTasks: activeTasks.length,
        },
        companies: companiesWithMeta,
        todayTasks,
        overdueTasks,
        deliverableTasks,
        upcomingMeetings,
        inboxToValidate,
        calendarSnapshot: view.calendarSnapshot,
        capabilities: {
          endpoint: '/api/agent/hub',
          methods: ['GET', 'POST'],
          actions: {
            ingest_email: {
              description:
                'Crea una tarea o reunión desde un correo de Gmail (hebouche@gmail.com) o WhatsApp. Usa mode="ask_first" para enviarla a la Bandeja por Validar o mode="auto_confirm" para agendarla directo.',
              samplePayload: {
                action: 'ingest_email',
                mode: 'ask_first',
                title: 'Confirmar requerimiento audiovisual con Armando',
                from: 'Armando Pinzón <armando@ejemplo.com>',
                subject: 'Avances IA para Todos',
                snippet: 'Humberto, te envío la propuesta actualizada para revisarla mañana a las 10am.',
                sourceUrl: 'https://mail.google.com/mail/u/0/#inbox/1965abc123',
                companyId: 'business-bee-smart',
                category: 'IA para Todos',
                workDate: '2026-10-21',
                isMeeting: true,
                meetingTime: '10:00',
                steps: ['Revisar propuesta adjunta', 'Confirmar presupuesto audiovisual'],
              },
            },
            ingest_voice_note: {
              description:
                'Conecta grabaciones de audio o notas de Apple Notes / Grabadora del celular y las adjunta automáticamente a la reunión o tarea correspondiente (buscándola por taskId o por nombre/fecha, ej. "Reunión con Armando").',
              samplePayload: {
                action: 'ingest_voice_note',
                meetingQuery: 'Armando',
                noteSource: 'Apple Notes',
                transcript:
                  'Acordamos con Armando cerrar el proveedor de pantallas LED el viernes y enviar artes de IA para Todos.',
                summary: 'Acuerdo de proveedor LED y entrega de artes el viernes.',
                audioUrl: 'https://drive.google.com/file/d/ejemplo-audio',
                extractedSteps: [
                  'Cerrar proveedor de pantallas LED (viernes)',
                  'Enviar artes finales de IA para Todos',
                ],
                nextAction: 'Enviar correo de confirmación a Armando',
              },
            },
            brain_dump: {
              description:
                'Volcado rápido en lenguaje natural: recibe un texto con varias ideas/citas/pendientes y los clasifica automáticamente por empresa, fecha y hora.',
              samplePayload: {
                action: 'brain_dump',
                text: 'Mañana 10am reunión con Armando sobre IA para Todos; pedir cotización a Ingredienta; revisar pagos de Surf Shack el viernes',
                defaultMode: 'auto_confirm',
              },
            },
            calendar_sync: {
              description:
                'Sincronización bidireccional con Google Calendar (hebouche@gmail.com): actualiza el snapshot de eventos en Render y devuelve todas las reuniones agendadas en TaskManager HB.',
              samplePayload: {
                action: 'calendar_sync',
                accountEmail: 'hebouche@gmail.com',
                createTasksForNewEvents: true,
                events: [
                  {
                    id: 'gcal-armando-10am',
                    title: 'Reunión con Armando Pinzón · IA para Todos',
                    startIso: '2026-10-21T10:00:00-05:00',
                    endIso: '2026-10-21T11:00:00-05:00',
                    htmlLink: 'https://calendar.google.com/calendar/event?eid=ejemplo',
                  },
                ],
              },
            },
            completeTask: {
              description: 'Marca una tarea como completada por su taskId.',
              samplePayload: { action: 'completeTask', taskId: 'uuid-de-tarea' },
            },
            rescheduleTask: {
              description: 'Reprograma la fecha (workDate/dueDate) y hora (meetingTime) de una tarea o reunión.',
              samplePayload: {
                action: 'rescheduleTask',
                taskId: 'uuid-de-tarea',
                workDate: '2026-10-22',
                meetingTime: '14:30',
              },
            },
            validateTask: {
              description: 'Aprueba (confirm) o descarta (dismiss) un ítem de la Bandeja por Validar.',
              samplePayload: { action: 'validateTask', taskId: 'uuid-de-tarea', decision: 'confirm' },
            },
          },
        },
      },
      { headers: CORS_HEADERS }
    );
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || 'Error al leer el Hub del Agente.' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = checkAgentAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: 401, headers: CORS_HEADERS });
  }

  try {
    const body = await req.json();
    const action = String(body?.action || '').trim();
    const today = localDay(new Date(), 'America/Panama');

    if (action === 'ingest_email' || action === 'ingest_message') {
      const rawTitle = String(body.title || body.subject || '').trim();
      if (!rawTitle) {
        return NextResponse.json(
          { ok: false, error: 'Se requiere title o subject para ingest_email.' },
          { status: 400, headers: CORS_HEADERS }
        );
      }
      const combinedText = `${rawTitle} ${body.snippet || ''} ${body.description || ''} ${body.from || ''}`;
      const inferred = inferCompanyAndCategory(combinedText, body.companyId, body.category);
      const schedule = inferScheduleFromText(combinedText, today);

      const workDate = validDate(body.workDate || '') ? body.workDate : schedule.workDate;
      const dueDate = validDate(body.dueDate || '') ? body.dueDate : workDate;
      const isMeeting = typeof body.isMeeting === 'boolean' ? body.isMeeting : schedule.isMeeting;
      const meetingTime = body.meetingTime !== undefined ? String(body.meetingTime) : schedule.meetingTime;
      const mode = body.mode === 'ask_first' ? 'NeedsConfirmation' : 'Confirmed';

      const notesParts: string[] = [];
      if (body.from) notesParts.push(`De: ${body.from}`);
      if (body.subject && body.subject !== rawTitle) notesParts.push(`Asunto: ${body.subject}`);
      if (body.snippet) notesParts.push(`Extracto: ${body.snippet}`);
      if (body.contextNotes) notesParts.push(String(body.contextNotes));

      const rawSteps: string[] = Array.isArray(body.steps) ? body.steps.map(String).filter(Boolean) : [];
      const steps = rawSteps.map(s => ({
        id: randomUUID(),
        text: s.trim().slice(0, 240),
        completed: false,
      }));

      const created = (await applyPublicTaskCommand({
        requestId: body.requestId || `agent-email-${randomUUID()}`,
        action: 'createTask',
        reason: `Ingesta automática de ${action === 'ingest_email' ? 'Gmail' : 'mensaje'} por Agente IA`,
        fields: {
          title: rawTitle.slice(0, 240),
          description: String(body.description || body.snippet || '').slice(0, 1800),
          companyId: inferred.companyId,
          category: inferred.category,
          subcategories: inferred.subcategories,
          priority: body.priority || 'High',
          workDate,
          dueDate,
          isMeeting,
          meetingTime,
          validationStatus: mode,
          sourceUrl: typeof body.sourceUrl === 'string' && /^https?:\/\//i.test(body.sourceUrl) ? body.sourceUrl : '',
          contextNotes: notesParts.join(' · ').slice(0, 1800),
          nextAction: String(body.nextAction || (rawSteps[0] ?? 'Revisar y ejecutar seguimiento')).slice(0, 300),
          steps,
        },
      })) as Task;

      return NextResponse.json(
        {
          ok: true,
          action,
          validationStatus: mode,
          message:
            mode === 'NeedsConfirmation'
              ? 'Tarea enviada a la Bandeja por Validar para confirmación de Humberto.'
              : 'Tarea agendada directamente en el flujo operativo de Humberto.',
          task: created,
        },
        { status: 201, headers: CORS_HEADERS }
      );
    }

    if (action === 'ingest_voice_note' || action === 'sync_meeting_notes') {
      const transcript = String(body.transcript || body.notes || body.text || '').trim();
      if (!transcript) {
        return NextResponse.json(
          { ok: false, error: 'Se requiere transcript o notes con el contenido grabado.' },
          { status: 400, headers: CORS_HEADERS }
        );
      }
      const noteSource = String(body.noteSource || 'Apple Notes / Móvil').trim();
      const summary = String(body.summary || '').trim();
      const audioUrl = typeof body.audioUrl === 'string' && /^https?:\/\//i.test(body.audioUrl) ? body.audioUrl : '';
      const extractedSteps: string[] = Array.isArray(body.extractedSteps)
        ? body.extractedSteps.map(String).filter(Boolean)
        : [];

      const view = await readPublicHbWorkspace();
      const query = String(body.meetingQuery || body.title || '').trim().toLowerCase();
      let matchedTask: Task | undefined;

      if (body.taskId) {
        matchedTask = view.tasks.find(t => t.id === body.taskId);
      }
      if (!matchedTask && query) {
        matchedTask = view.tasks.find(
          t =>
            !t.cancelledAt &&
            (t.title.toLowerCase().includes(query) ||
              (t.category && t.category.toLowerCase().includes(query)) ||
              (t.description && t.description.toLowerCase().includes(query)))
        );
      }
      if (!matchedTask && body.workDate) {
        matchedTask = view.tasks.find(
          t => !t.cancelledAt && t.isMeeting && (t.workDate === body.workDate || t.dueDate?.startsWith(body.workDate))
        );
      }

      const timestampLabel = new Date().toLocaleString('es-PA', { timeZone: 'America/Panama' });
      const noteHeader = `[🎙️ ${noteSource} · ${timestampLabel}]`;
      const formattedNote = `${noteHeader}${summary ? ` Resumen: ${summary} —` : ''} Nota/Transcripción: ${transcript}`;

      if (matchedTask) {
        const existingSteps = matchedTask.steps || [];
        const newSteps = [
          ...existingSteps,
          ...extractedSteps
            .filter(text => !existingSteps.some(es => es.text.toLowerCase() === text.trim().toLowerCase()))
            .map(text => ({
              id: randomUUID(),
              text: text.trim().slice(0, 240),
              completed: false,
            })),
        ];

        const updatedContext = [matchedTask.contextNotes, formattedNote].filter(Boolean).join('\n\n').slice(0, 1900);
        const updatedDescription = [matchedTask.description, summary ? `Minuta IA: ${summary}` : '']
          .filter(Boolean)
          .join('\n\n')
          .slice(0, 1900);

        const updated = (await applyPublicTaskCommand({
          requestId: body.requestId || `agent-voice-${randomUUID()}`,
          action: 'updateTask',
          id: matchedTask.id,
          expectedRevision: matchedTask.revision || 1,
          reason: `Sincronización automática de audio/nota (${noteSource})`,
          fields: {
            description: updatedDescription,
            contextNotes: updatedContext,
            ...(audioUrl ? { sourceUrl: audioUrl } : {}),
            ...(body.nextAction ? { nextAction: String(body.nextAction).slice(0, 300) } : {}),
            steps: newSteps,
            validationStatus: 'Confirmed',
          },
        })) as Task;

        return NextResponse.json(
          {
            ok: true,
            action,
            matchedExistingTask: true,
            matchedTaskTitle: matchedTask.title,
            message: `Grabación/nota de ${noteSource} vinculada automáticamente a "${matchedTask.title}".`,
            task: updated,
          },
          { headers: CORS_HEADERS }
        );
      }

      // Otherwise create a new meeting/task with the voice note
      const inferred = inferCompanyAndCategory(`${query} ${transcript}`, body.companyId, body.category);
      const schedule = inferScheduleFromText(`${query} ${transcript}`, today);
      const created = (await applyPublicTaskCommand({
        requestId: body.requestId || `agent-voice-new-${randomUUID()}`,
        action: 'createTask',
        reason: `Nueva nota de voz / reunión capturada desde ${noteSource}`,
        fields: {
          title: (body.title || body.meetingQuery || `Nota de reunión · ${inferred.category}`).slice(0, 240),
          description: (summary || transcript).slice(0, 1800),
          companyId: inferred.companyId,
          category: inferred.category,
          subcategories: inferred.subcategories,
          priority: 'High',
          workDate: body.workDate || schedule.workDate,
          dueDate: body.workDate || schedule.workDate,
          isMeeting: true,
          meetingTime: body.meetingTime || schedule.meetingTime || '10:00',
          contextNotes: formattedNote.slice(0, 1900),
          sourceUrl: audioUrl,
          nextAction: String(body.nextAction || extractedSteps[0] || 'Revisar acuerdos de la nota de voz').slice(
            0,
            300
          ),
          validationStatus: 'Confirmed',
          steps: extractedSteps.map(s => ({
            id: randomUUID(),
            text: s.trim().slice(0, 240),
            completed: false,
          })),
        },
      })) as Task;

      return NextResponse.json(
        {
          ok: true,
          action,
          matchedExistingTask: false,
          message: `Se creó un nuevo registro de reunión con la nota de ${noteSource}.`,
          task: created,
        },
        { status: 201, headers: CORS_HEADERS }
      );
    }

    if (action === 'brain_dump') {
      const rawText = String(body.text || '').trim();
      const rawItems: Array<any> = Array.isArray(body.items)
        ? body.items
        : rawText
            .split(/(?:\r?\n|;|\.(?=\s+[A-ZÁÉÍÓÚÑ]))+/)
            .map(s => s.trim())
            .filter(Boolean);

      if (rawItems.length === 0) {
        return NextResponse.json(
          { ok: false, error: 'Envía text o items[] para procesar el volcado rápido.' },
          { status: 400, headers: CORS_HEADERS }
        );
      }

      const validationStatus = body.defaultMode === 'ask_first' ? 'NeedsConfirmation' : 'Confirmed';
      const createdTasks: Task[] = [];

      for (const item of rawItems) {
        const itemTitle = typeof item === 'string' ? item : String(item.title || item.text || '').trim();
        if (!itemTitle) continue;
        const inferred = inferCompanyAndCategory(
          itemTitle,
          typeof item === 'object' ? item.companyId : undefined,
          typeof item === 'object' ? item.category : undefined
        );
        const schedule = inferScheduleFromText(itemTitle, today);
        const workDate =
          typeof item === 'object' && validDate(item.workDate || '') ? item.workDate : schedule.workDate;

        const created = (await applyPublicTaskCommand({
          requestId: `brain-dump-${randomUUID()}`,
          action: 'createTask',
          reason: 'Volcado rápido (Brain Dump)',
          fields: {
            title: itemTitle.slice(0, 240),
            description: typeof item === 'object' && item.description ? String(item.description) : '',
            companyId: inferred.companyId,
            category: inferred.category,
            subcategories: inferred.subcategories,
            priority: (typeof item === 'object' && item.priority) || 'High',
            workDate,
            dueDate: workDate,
            isMeeting: typeof item === 'object' && typeof item.isMeeting === 'boolean' ? item.isMeeting : schedule.isMeeting,
            meetingTime:
              typeof item === 'object' && item.meetingTime !== undefined ? String(item.meetingTime) : schedule.meetingTime,
            validationStatus,
          },
        })) as Task;
        createdTasks.push(created);
      }

      return NextResponse.json(
        {
          ok: true,
          action: 'brain_dump',
          count: createdTasks.length,
          tasks: createdTasks,
        },
        { status: 201, headers: CORS_HEADERS }
      );
    }

    if (action === 'calendar_sync') {
      const incomingEvents = Array.isArray(body.events) ? body.events : [];
      const accountEmail = String(body.accountEmail || 'hebouche@gmail.com').trim();
      const createTasksForNewEvents = body.createTasksForNewEvents !== false;

      const syncResult = await dbService.transaction(data => {
        const actor = publicTaskActor(data);
        for (const canonical of HB_CANONICAL_COMPANIES) {
          if (!data.companies.some(c => c.id === canonical.id)) {
            data.companies.push({ id: canonical.id, name: canonical.name });
          }
        }

        const nowIso = new Date().toISOString();
        const normalizedEvents = incomingEvents
          .filter(
            (ev: any) =>
              ev &&
              typeof ev.title === 'string' &&
              ev.title.trim() &&
              (typeof ev.startIso === 'string' || typeof ev.start === 'string')
          )
          .map((ev: any) => {
            const start = String(ev.startIso || ev.start);
            const end = String(ev.endIso || ev.end || start);
            const url = typeof ev.htmlLink === 'string' ? ev.htmlLink : typeof ev.url === 'string' ? ev.url : '';
            return {
              id: String(ev.id || `gcal-${randomUUID()}`),
              calendarId: accountEmail,
              title: String(ev.title).trim(),
              start,
              end,
              status: 'confirmed' as const,
              url,
              allDay: Boolean(ev.allDay),
              observedAt: nowIso,
              ...(typeof ev.location === 'string' ? { location: ev.location } : {}),
            };
          });

        data.calendarSnapshot = {
          ownerId: actor.personId,
          provider: 'google',
          calendarId: accountEmail,
          verifiedAt: nowIso,
          windowStart: body.rangeStartIso || new Date(Date.now() - 86400000).toISOString(),
          windowEnd: body.rangeEndIso || new Date(Date.now() + 14 * 86400000).toISOString(),
          connection: 'snapshot-only',
          events: normalizedEvents,
        };

        const createdFromCalendar: Task[] = [];
        if (createTasksForNewEvents) {
          for (const ev of normalizedEvents) {
            const eventDay = ev.start.slice(0, 10);
            const eventTimeMatch = ev.start.match(/T(\d{2}:\d{2})/);
            const eventTime = eventTimeMatch ? eventTimeMatch[1] : '10:00';
            const exists = data.tasks.some(
              t =>
                !t.cancelledAt &&
                ((ev.url && t.sourceUrl === ev.url) ||
                  (t.title.toLowerCase() === ev.title.toLowerCase() &&
                    (t.workDate === eventDay || t.dueDate?.slice(0, 10) === eventDay)))
            );
            if (!exists && validDate(eventDay)) {
              const inferred = inferCompanyAndCategory(ev.title);
              const newTask: Task = {
                id: randomUUID(),
                title: ev.title.slice(0, 240),
                description: `Sincronizado desde Google Calendar (${accountEmail})`,
                type: 'One-shot',
                steps: [],
                companyId: inferred.companyId,
                category: inferred.category,
                subcategories: inferred.subcategories,
                assigneeId: actor.personId,
                assigneeIds: [actor.personId],
                ownerId: actor.personId,
                status: 'Pending',
                priority: 'High',
                origin: 'Manual',
                workDate: eventDay,
                dueDate: eventDay,
                isMeeting: true,
                meetingTime: ev.allDay ? '' : eventTime,
                sourceUrl: ev.url || '',
                validationStatus: 'Confirmed',
                attachments: [],
                activityLog: [],
                revision: 1,
              };
              data.tasks.push(newTask);
              createdFromCalendar.push(newTask);
            }
          }
        }

        const taskManagerMeetings = data.tasks.filter(
          t => !t.cancelledAt && t.status !== 'Completed' && (t.isMeeting || Boolean(t.meetingTime))
        );

        return {
          calendarSnapshot: data.calendarSnapshot,
          createdFromCalendarCount: createdFromCalendar.length,
          taskManagerMeetings,
        };
      });

      return NextResponse.json(
        {
          ok: true,
          action: 'calendar_sync',
          ...syncResult,
        },
        { headers: CORS_HEADERS }
      );
    }

    if (action === 'completeTask') {
      const view = await readPublicHbWorkspace();
      const target = view.tasks.find(t => t.id === body.taskId || t.id === body.id);
      if (!target) {
        return NextResponse.json({ ok: false, error: 'Tarea no encontrada.' }, { status: 404, headers: CORS_HEADERS });
      }
      const completedSteps = (target.steps || []).map(s => ({ ...s, completed: true, status: 'Completed' as const }));
      const updated = await applyPublicTaskCommand({
        requestId: body.requestId || `agent-complete-${randomUUID()}`,
        action: 'updateTask',
        id: target.id,
        expectedRevision: target.revision || 1,
        reason: body.reason || 'Completada por Agente IA',
        fields: {
          steps: completedSteps,
          status: 'Completed',
          waitingOn: '',
        },
      });
      return NextResponse.json({ ok: true, action, task: updated }, { headers: CORS_HEADERS });
    }

    if (action === 'rescheduleTask') {
      const view = await readPublicHbWorkspace();
      const target = view.tasks.find(t => t.id === body.taskId || t.id === body.id);
      if (!target) {
        return NextResponse.json({ ok: false, error: 'Tarea no encontrada.' }, { status: 404, headers: CORS_HEADERS });
      }
      const nextDate = body.workDate || body.dueDate || addDays(today, 1);
      const updated = await applyPublicTaskCommand({
        requestId: body.requestId || `agent-resched-${randomUUID()}`,
        action: 'updateTask',
        id: target.id,
        expectedRevision: target.revision || 1,
        reason: body.reason || 'Reprogramada por Agente IA',
        fields: {
          workDate: nextDate,
          dueDate: nextDate,
          ...(body.meetingTime !== undefined ? { meetingTime: String(body.meetingTime), isMeeting: true } : {}),
        },
      });
      return NextResponse.json({ ok: true, action, task: updated }, { headers: CORS_HEADERS });
    }

    if (action === 'validateTask') {
      const view = await readPublicHbWorkspace();
      const target = view.tasks.find(t => t.id === body.taskId || t.id === body.id);
      if (!target) {
        return NextResponse.json({ ok: false, error: 'Tarea no encontrada.' }, { status: 404, headers: CORS_HEADERS });
      }
      const dismiss = body.decision === 'dismiss';
      const updated = await applyPublicTaskCommand({
        requestId: body.requestId || `agent-validate-${randomUUID()}`,
        action: 'updateTask',
        id: target.id,
        expectedRevision: target.revision || 1,
        reason: dismiss ? 'Descartado por Agente IA' : 'Confirmado por Agente IA',
        fields: dismiss
          ? { cancelled: true }
          : { validationStatus: 'Confirmed', workDate: body.workDate || target.workDate || today },
      });
      return NextResponse.json({ ok: true, action, task: updated }, { headers: CORS_HEADERS });
    }

    if (['createTask', 'updateTask', 'createCompany', 'updateCompany', 'deleteCompany'].includes(action)) {
      const result = await applyPublicTaskCommand({
        ...body,
        requestId: body.requestId || `agent-cmd-${randomUUID()}`,
      });
      return NextResponse.json({ ok: true, action, result }, { headers: CORS_HEADERS });
    }

    return NextResponse.json(
      {
        ok: false,
        error: `Acción "${action}" no reconocida. Consulta GET /api/agent/hub para ver las acciones soportadas.`,
      },
      { status: 400, headers: CORS_HEADERS }
    );
  } catch (error: any) {
    const status = error instanceof WorkspaceError ? error.status : 500;
    return NextResponse.json(
      { ok: false, error: error?.message || 'Error al ejecutar operación en el Hub del Agente.' },
      { status, headers: CORS_HEADERS }
    );
  }
}
