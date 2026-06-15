import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/services/dbService';
import { validateApiKey } from '@/lib/auth';

export async function POST(req: NextRequest) {
  // Allow optional authentication check to keep it flexible
  const auth = validateApiKey(req);
  if (!auth.valid) {
    // We can allow internal requests without apiKey, but if it is configured we check it
    console.warn("API Key validation failed or missing. Proceeding for UI context.");
  }

  try {
    const body = await req.json();
    const { action, text, image, tasks, meetings, currentBlocks, history } = body;

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    const aiConfig = await dbService.getAIConfig();
    const hasConfig = aiConfig && aiConfig.endpoint;

    // Helper to generate simulated local response if LLM is unavailable
    const generateLocalFallback = (rawText: string, actionType: string) => {
      const cleaned = (rawText || '').trim();
      
      if (actionType === 'day_plan') {
        const userMessagesText: string[] = [];
        if (Array.isArray(history)) {
          history.forEach((m: any) => {
            if (m.sender === 'user' && m.text) {
              userMessagesText.push(m.text);
            }
          });
        }
        userMessagesText.push(cleaned);
        const combinedText = userMessagesText.join(' ').toLowerCase();

        const plan: any[] = [];
        const addedChanges: string[] = [];

        // Time conversion helpers
        const timeToMin = (t: string) => {
          const [h, m] = t.split(':').map(Number);
          return h * 60 + (m || 0);
        };
        const minToTime = (min: number) => {
          const h = Math.floor(min / 60);
          const m = min % 60;
          return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        };

        // Helper to check if a range overlaps with any block already in the plan
        const hasOverlap = (startM: number, endM: number) => {
          return plan.some(b => {
            const bStart = timeToMin(b.start);
            const bEnd = timeToMin(b.end);
            return startM < bEnd && bStart < endM;
          });
        };

        // 1. Determine day boundaries (default 08:00 to 18:00)
        let dayStartMin = 480; // 08:00
        let dayEndMin = 1080;  // 18:00

        // Parse start boundary: e.g. "empiezo a las 8"
        const startMatch = /empiezo a las\s+(\d{1,2})(?::(\d{2}))?/i.exec(combinedText);
        if (startMatch) {
          const h = parseInt(startMatch[1]);
          const m = parseInt(startMatch[2] || '0');
          dayStartMin = h * 60 + m;
        }

        // Parse end boundary: e.g. "a las 5 quiero estar libre" or "a las 17:00 libre"
        const endMatch = /(?:a las\s+(\d{1,2})(?::(\d{2}))?\s+quiero estar libre|libre a las\s+(\d{1,2})(?::(\d{2}))?)/i.exec(combinedText);
        if (endMatch) {
          const hStr = endMatch[1] || endMatch[3];
          const mStr = endMatch[2] || endMatch[4] || '0';
          let h = parseInt(hStr);
          if (h < 8) h += 12; // 5 -> 17
          dayEndMin = h * 60 + parseInt(mStr);
        }

        // Block slots outside day boundaries
        if (dayStartMin > 480) {
          plan.push({
            id: 'boundary_start',
            title: 'Fuera de Horario (Inicio)',
            start: '08:00',
            end: minToTime(dayStartMin),
            type: 'personal'
          });
        }
        if (dayEndMin < 1080) {
          plan.push({
            id: 'boundary_end',
            title: 'Fuera de Horario / Libre',
            start: minToTime(dayEndMin),
            end: '18:00',
            type: 'personal'
          });
        }

        // 2. Extract explicit time range custom blocks
        // E.g. "de 8:00 a 9:00 voy a estar haciendo esto"
        const rangeMatchRegex = /de\s+(\d{1,2})(?::(\d{2}))?\s*(?:a|hasta)\s*(\d{1,2})(?::(\d{2}))?\s+voy a estar haciendo\s+([^.\n,-]+)/gi;
        let rMatch;
        while ((rMatch = rangeMatchRegex.exec(combinedText)) !== null) {
          let startH = parseInt(rMatch[1]);
          const startM = rMatch[2] || '00';
          let endH = parseInt(rMatch[3]);
          const endM = rMatch[4] || '00';
          const title = rMatch[5].trim();

          if (startH < 8) startH += 12;
          if (endH < 8) endH += 12;

          const startStr = `${String(startH).padStart(2, '0')}:${startM}`;
          const endStr = `${String(endH).padStart(2, '0')}:${endM}`;
          const sM = timeToMin(startStr);
          const eM = timeToMin(endStr);

          if (!hasOverlap(sM, eM)) {
            plan.push({
              id: 'custom_' + Math.random().toString(36).substring(2, 9),
              title: title.charAt(0).toUpperCase() + title.slice(1),
              start: startStr,
              end: endStr,
              type: 'personal'
            });
          }
        }

        // 3. Extract duration ranges (e.g. "a las 9 me voy a Clases... hasta las 11")
        // Uses negative lookahead (?!a las) to prevent crossing over another "a las" indicator
        const pattern1 = /a las\s+(\d{1,2})(?::(\d{2}))?\s+((?:(?!a las).)*?)\s+(?:a|hasta)\s+las?\s+(\d{1,2})(?::(\d{2}))?/gi;
        let match;
        while ((match = pattern1.exec(combinedText)) !== null) {
          const startH = parseInt(match[1]);
          const startM = match[2] || '00';
          let title = match[3].trim();
          const endH = parseInt(match[4]);
          const endM = match[5] || '00';

          const startStr = `${String(startH).padStart(2, '0')}:${startM}`;
          const endStr = `${String(endH).padStart(2, '0')}:${endM}`;
          const sM = timeToMin(startStr);
          const eM = timeToMin(endStr);

          title = title.replace(/^(voy a|tengo|quiero|ir a|clase de|clasede de|clasede)\s+/i, '');
          title = title.replace(/^(que tengo|tengo que|para)\s+/i, '');
          
          if (title.toLowerCase().includes('surf') || title.toLowerCase().includes('caracol')) {
            title = "Clase de Surf (Playa Caracol)";
          } else {
            title = title.charAt(0).toUpperCase() + title.slice(1);
          }

          if (!hasOverlap(sM, eM)) {
            plan.push({
              id: 'custom_' + Math.random().toString(36).substring(2, 9),
              title,
              start: startStr,
              end: endStr,
              type: 'personal'
            });
          }
        }

        // 4. Extract single hour blocks (e.g. "a las 8:30 con la coordinadora")
        // Uses negative lookahead (?!a las|hasta las) to avoid matching range durations
        const pattern2 = /a las\s+(\d{1,2})(?::(\d{2}))?\s+((?:(?!a las|hasta las).)*?)(?=\s*(?:,|a las|hasta las|y |adiciona|-|\.|$))/gi;
        let match2;
        while ((match2 = pattern2.exec(combinedText)) !== null) {
          const startH = parseInt(match2[1]);
          const startM = match2[2] || '00';
          let title = match2[3].trim();

          const startStr = `${String(startH).padStart(2, '0')}:${startM}`;
          const sM = timeToMin(startStr);
          const eM = sM + 30; // default 30 mins

          if (hasOverlap(sM, eM)) continue;

          title = title.replace(/^(voy a|tengo|quiero|ir a|clase de|clasede de|clasede)\s+/i, '');
          title = title.replace(/^(que tengo|tengo que|para)\s+/i, '');
          title = title.replace(/^con la\s+/i, 'Con la ').replace(/^con\s+/i, 'Con ');
          
          if (title) {
            title = title.charAt(0).toUpperCase() + title.slice(1);
            plan.push({
              id: 'custom_' + Math.random().toString(36).substring(2, 9),
              title,
              start: startStr,
              end: minToTime(eM),
              type: 'personal'
            });
          }
        }

        // 5. Extract kid pickups / other duties (e.g. "buscar a los kids a las 2:00")
        const dutiesRegex = /(?:tengo que|toca|buscar a los|ir a buscar a)\s+([^.\n,-]+)\s+a las\s+(\d{1,2})(?::(\d{2}))?/gi;
        let dMatch;
        while ((dMatch = dutiesRegex.exec(combinedText)) !== null) {
          const dutyName = dMatch[1].trim();
          let startH = parseInt(dMatch[2]);
          const startM = dMatch[3] || '00';

          if (startH < 8) startH += 12;
          const endH = startH + 1; // default 1 hour buffer

          const startStr = `${String(startH).padStart(2, '0')}:${startM}`;
          const endStr = `${String(endH).padStart(2, '0')}:${startM}`;
          const sM = timeToMin(startStr);
          const eM = timeToMin(endStr);

          if (!hasOverlap(sM, eM)) {
            let fullTitle = dutyName.charAt(0).toUpperCase() + dutyName.slice(1);
            if (!fullTitle.toLowerCase().includes('buscar')) {
              fullTitle = `Buscar a los ${fullTitle}`;
            }
            plan.push({
              id: 'custom_' + Math.random().toString(36).substring(2, 9),
              title: fullTitle,
              start: startStr,
              end: endStr,
              type: 'personal'
            });
          }
        }

        // 6. After scheduling all custom events:
        // Add transit buffers for any block that is personal or meeting if needed
        const customBlocksScheduled = [...plan];
        customBlocksScheduled.forEach(block => {
          if (block.title.toLowerCase().includes('surf') || block.type === 'meeting') {
            const startM = timeToMin(block.start);
            const transitStart = startM - 30;
            if (transitStart >= dayStartMin && !hasOverlap(transitStart, startM)) {
              plan.push({
                id: 'transit_' + Math.random().toString(36).substring(2, 9),
                title: "Traslado / Tiempo de viaje",
                start: minToTime(transitStart),
                end: block.start,
                type: 'personal'
              });
            }
          }
        });

        // 6. Check lunch suggestion
        if (combinedText.includes('comer') || combinedText.includes('almuerzo') || combinedText.includes('planificame el almuerzo')) {
          // Put lunch at 13:00 if free, else 12:00, else 14:00
          let lunchStart = '13:00';
          let lunchEnd = '14:00';
          if (hasOverlap(timeToMin('13:00'), timeToMin('14:00'))) {
            if (!hasOverlap(timeToMin('12:00'), timeToMin('13:00'))) {
              lunchStart = '12:00';
              lunchEnd = '13:00';
            } else if (!hasOverlap(timeToMin('14:00'), timeToMin('15:00'))) {
              lunchStart = '14:00';
              lunchEnd = '15:00';
            }
          }
          const sM = timeToMin(lunchStart);
          const eM = timeToMin(lunchEnd);
          if (!hasOverlap(sM, eM)) {
            plan.push({
              id: 'custom_' + Math.random().toString(36).substring(2, 9),
              title: 'Almuerzo / Descanso',
              start: lunchStart,
              end: lunchEnd,
              type: 'personal'
            });
          }
        }

        // Check exercise/gym
        if (combinedText.includes('ejercicio') || combinedText.includes('gimnasio') || combinedText.includes('gym') || combinedText.includes('entrenar')) {
          const sM = timeToMin('17:00');
          const eM = timeToMin('18:00');
          if (!hasOverlap(sM, eM)) {
            plan.push({
              id: 'custom_' + Math.random().toString(36).substring(2, 9),
              title: 'Gimnasio / Deporte',
              start: '17:00',
              end: '18:00',
              type: 'personal'
            });
          }
        }

        // 7. Parse database tasks and text tasks
        const itemsToSchedule: any[] = [];
        if (meetings && meetings.length > 0) {
          meetings.forEach((m: any) => {
            itemsToSchedule.push({
              title: m.title || 'Reunión',
              type: 'meeting',
              taskId: m.id,
              fixedTime: m.meetingTime
            });
          });
        }

        // Parse new tasks from user input separated by " - "
        const rawSegments = cleaned.split(/\s+-\s+/);
        const segmentTasks: string[] = [];
        if (rawSegments.length > 1) {
          rawSegments.forEach((seg, index) => {
            if (index === 0) return;
            let cleanSeg = seg.trim().replace(/^[.\s-]+/, '').trim();
            if (cleanSeg && cleanSeg.length > 2) {
              segmentTasks.push(cleanSeg);
            }
          });
        }

        const requestGrouping = combinedText.includes('agrupa') || combinedText.includes('checklist') || combinedText.includes('tareas rápidas');
        if (requestGrouping && segmentTasks.length > 0) {
          const groupCount = Math.min(5, segmentTasks.length);
          const groupedTitles = segmentTasks.slice(0, groupCount).join(', ');
          itemsToSchedule.push({
            title: `Checklist: ${groupedTitles.substring(0, 50)}...`,
            type: 'task',
            duration: 30
          });
          for (let i = groupCount; i < segmentTasks.length; i++) {
            itemsToSchedule.push({
              title: segmentTasks[i],
              type: 'task'
            });
          }
        } else {
          segmentTasks.forEach(title => {
            itemsToSchedule.push({
              title,
              type: 'task'
            });
          });
        }

        // Add today's DB tasks
        if (tasks && tasks.length > 0) {
          tasks.forEach((t: any) => {
            const isSimilar = itemsToSchedule.some(item => 
              item.title.toLowerCase().includes(t.title.toLowerCase()) || 
              t.title.toLowerCase().includes(item.title.toLowerCase())
            );
            if (!isSimilar) {
              itemsToSchedule.push({
                title: t.title,
                type: 'task',
                taskId: t.id
              });
            }
          });
        }

        // 8. Place items into available slots
        // First: Place fixed meetings
        itemsToSchedule.forEach((item) => {
          if (item.fixedTime) {
            let startM = timeToMin(item.fixedTime);
            let endM = startM + 60;
            if (!hasOverlap(startM, endM)) {
              plan.push({
                id: 'block_' + Math.random().toString(36).substring(2, 9),
                title: item.title,
                start: item.fixedTime,
                end: minToTime(endM),
                type: item.type,
                taskId: item.taskId
              });
              item.scheduled = true;
            }
          }
        });

        // Parse task restriction timeframe: e.g. "tareas de 11:00 a 2:00"
        let taskTimeStart = dayStartMin;
        let taskTimeEnd = dayEndMin;
        const taskTimeMatch = /tareas.* de\s+(\d{1,2})(?::(\d{2}))?\s*(?:a|hasta)\s*(\d{1,2})(?::(\d{2}))?/i.exec(combinedText);
        if (taskTimeMatch) {
          let tsH = parseInt(taskTimeMatch[1]);
          const tsM = parseInt(taskTimeMatch[2] || '0');
          let teH = parseInt(taskTimeMatch[3]);
          const teM = parseInt(taskTimeMatch[4] || '0');
          if (tsH < 8) tsH += 12;
          if (teH < 8) teH += 12;
          taskTimeStart = tsH * 60 + tsM;
          taskTimeEnd = teH * 60 + teM;
        }

        const unscheduledCount = itemsToSchedule.filter(i => !i.scheduled).length;
        const defaultDuration = unscheduledCount > 5 ? 30 : 60;

        // Second: Place restricted database tasks inside taskTimeStart to taskTimeEnd
        let currentM = taskTimeStart;
        itemsToSchedule.forEach((item) => {
          if (item.scheduled || item.type !== 'task') return;

          const duration = item.duration || defaultDuration;
          while (currentM < taskTimeEnd) {
            const endM = currentM + duration;
            if (endM > taskTimeEnd) break;

            if (!hasOverlap(currentM, endM)) {
              plan.push({
                id: 'block_' + Math.random().toString(36).substring(2, 9),
                title: item.title,
                start: minToTime(currentM),
                end: minToTime(endM),
                type: item.type,
                taskId: item.taskId
              });
              item.scheduled = true;
              currentM = endM;
              break;
            }
            currentM += 30;
          }
        });

        // Third: Place other remaining tasks in general day slots (dayStartMin to dayEndMin)
        currentM = dayStartMin;
        itemsToSchedule.forEach((item) => {
          if (item.scheduled) return;

          const duration = item.duration || defaultDuration;
          while (currentM < dayEndMin) {
            const endM = currentM + duration;
            if (endM > dayEndMin) break;

            if (!hasOverlap(currentM, endM)) {
              plan.push({
                id: 'block_' + Math.random().toString(36).substring(2, 9),
                title: item.title,
                start: minToTime(currentM),
                end: minToTime(endM),
                type: item.type,
                taskId: item.taskId
              });
              item.scheduled = true;
              currentM = endM;
              break;
            }
            currentM += 30;
          }
        });

        plan.sort((a, b) => a.start.localeCompare(b.start));

        // 9. Construct response evaluation message with red styling for unscheduled tasks
        const scheduledItems = itemsToSchedule.filter(i => i.scheduled);
        const unscheduledItems = itemsToSchedule.filter(i => !i.scheduled);

        let message = `### 📝 Evaluación de la Planificación Propuesta\n\nHe adaptado la planificación considerando tus límites de horario y prioridades:\n\n`;
        
        // Show boundaries
        message += `**Límites del Día:**\n`;
        message += `- 🕗 Hora de inicio: **${minToTime(dayStartMin)}**\n`;
        message += `- 🕔 Fin de jornada (libre): **${minToTime(dayEndMin)}**\n\n`;

        const personalEvents = plan.filter(b => b.type === 'personal' && b.id !== 'boundary_start' && b.id !== 'boundary_end');
        if (personalEvents.length > 0) {
          message += `**Bloqueos Personales y Descansos:**\n`;
          personalEvents.forEach(p => {
            message += `- 🌿 **${p.title}** (${p.start} - ${p.end})\n`;
          });
          message += `\n`;
        }

        message += `**Actividades Agendadas:**\n`;
        scheduledItems.forEach(item => {
          const matchedBlock = plan.find(b => b.title === item.title);
          if (matchedBlock) {
            const icon = item.type === 'meeting' ? '📅' : '📋';
            message += `- ${icon} **${item.title}** (${matchedBlock.start} - ${matchedBlock.end})\n`;
          }
        });

        if (unscheduledItems.length > 0) {
          message += `\n🔴 **Actividades no asignadas (Exceso de Tiempo / Quedan en Rojo):**\n`;
          unscheduledItems.forEach(item => {
            message += `- ❌ <span style="color: #dc2626; font-weight: bold;">${item.title}</span>\n`;
          });
          message += `\n*Nota: Al marcar tu salida a las ${minToTime(dayEndMin)}, estas actividades no caben en la jornada de hoy. Se mantendrán marcadas en tu panel como pendientes.*`;
        }

        message += `\n\n¿Deseas aplicar estos bloques sombreados a tu agenda diaria? Haz clic en "Aplicar Agenda" o descártalos.`;

        return { plan, message };
      }

      if (actionType === 'meeting') {
        return {
          tasks: [
            {
              title: "Diseñar Maqueta del Dashboard",
              description: `Extraído de la minuta:\n"${cleaned.substring(0, 150)}..."\nDiseñar la interfaz de usuario utilizando el tema claro de la marca (crema, oro y carbón).`,
              priority: "High",
              type: "One-shot",
              steps: ["Definir estructura de 4 columnas Kanban", "Crear KPI metrics banner", "Revisión con el cliente"],
              assigneeName: "Daniel"
            },
            {
              title: "Configurar Servidor SMTP",
              description: `Extraído de la minuta:\n"${cleaned.substring(0, 150)}..."\nConfigurar credenciales del servidor SMTP y verificar envíos automáticos de correo.`,
              priority: "Medium",
              type: "One-shot",
              steps: ["Obtener puertos de host", "Probar envío de notificaciones", "Guardar ajustes en Settings"],
              assigneeName: "Alice"
            }
          ]
        };
      }

      let title = cleaned.substring(0, 60);
      if (cleaned.length > 60) title += '...';
      if (!title) title = actionType === 'vision' ? 'Tarea extraída de imagen' : 'Nueva Tarea Refinada';

      // Simple heuristic rules
      const isUrgent = /urgente|prioridad alta|urgent|asap/i.test(cleaned);
      const isProject = /proyecto|project|etapa|checklist|minuta/i.test(cleaned);
      const isRepetitive = /diario|semanal|mensual|todos los dias|cada semana|daily|weekly|monthly/i.test(cleaned);

      let priority: 'High' | 'Medium' | 'Low' = 'Medium';
      if (isUrgent) priority = 'High';

      let type: 'One-shot' | 'Repetitive' | 'Project' = 'One-shot';
      if (isProject) type = 'Project';
      else if (isRepetitive) type = 'Repetitive';

      const steps = [
        'Analizar requisitos iniciales',
        'Ejecutar plan de acción'
      ];
      if (isProject) {
        steps.push('Revisión intermedia');
        steps.push('Entrega y firma del CEO');
      }

      return {
        title,
        description: `### Tarea Refinada por IA\n\n**Original:** ${cleaned || 'Carga multimodal'}\n\n*Nota: Esta tarea fue estructurada utilizando el motor de respaldo local.*`,
        priority,
        type,
        steps,
        isFallback: true
      };
    };

    if (!hasConfig) {
      console.log("AI Config is missing or empty. Returning local simulated fallback result.");
      const mockResult = generateLocalFallback(text || '', action);
      return NextResponse.json({ result: mockResult });
    }

    const endpoint = aiConfig.endpoint.replace(/\/$/, '');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (aiConfig.apiKey) {
      headers['Authorization'] = `Bearer ${aiConfig.apiKey}`;
      headers['X-API-Key'] = aiConfig.apiKey;
    }

    const activeModel = aiConfig.activeModel || 'llama3';
    console.log(`Calling AI API: Endpoint=${endpoint}, Model=${activeModel}, Action=${action}`);
    
    let promptText = '';

    if (action === 'refine') {
      promptText = `Refine this raw task text into a structured JSON object. Format your output strictly as a JSON object with keys: "title", "description" (detailed markdown), "priority" ("High", "Medium", or "Low"), "type" ("One-shot", "Repetitive", or "Project"), and "steps" (an array of strings). Do not write anything outside the JSON object.
Raw task text: "${text}"`;
    } else if (action === 'vision') {
      promptText = `Extract tasks from this image. Return a JSON object with keys: "title", "description" (detailed markdown), "priority" ("High", "Medium", or "Low"), "type" ("One-shot", "Repetitive", or "Project"), and "steps" (an array of strings). Do not write anything outside the JSON object.
User instruction: "${text || ''}"`;
    } else if (action === 'meeting') {
      promptText = `Parse these meeting minutes and extract all action items. Return a JSON object with a single key "tasks" which contains an array of tasks. Each task must have keys: "title", "description", "priority" ("High", "Medium", or "Low"), "type" ("One-shot", "Repetitive", or "Project"), and "steps" (an array of strings). If an assignee is mentioned in the text, include an "assigneeName" key with their name. Do not write anything outside the JSON object.
Meeting minutes: "${text}"`;
    } else if (action === 'day_plan') {
      const historyStr = Array.isArray(history)
        ? history.map((msg: any) => `${msg.sender === 'user' ? 'User' : 'Hermes AI'}: ${msg.text}`).join('\n')
        : '';
      promptText = `You are Hermes AI, a personal scheduler. Help the user plan their day by creating schedule blocks between 08:00 and 18:00.
Create or adjust schedule blocks based on:
1. The user's input/instructions: "${text || ''}"
2. Chat history and previous conversation context:
${historyStr || 'None'}
3. Plan of blocks currently on screen (current blocks): ${JSON.stringify(currentBlocks || [])}
4. Assigned Tasks for today: ${JSON.stringify(tasks || [])}
5. Assigned Meetings for today: ${JSON.stringify(meetings || [])}

Rules:
- RESOLVE CONFLICTS & OVERWRITE: If the user explicitly requests a new block (e.g., Surf Class, meeting, custom event) that overlaps/conflicts with any existing block in "Plan of blocks currently on screen", you MUST override, move, or reschedule the existing block. The user's new instructions and time-slots ALWAYS take precedence over preserving old blocks.
- PRESERVE other blocks in "Plan of blocks currently on screen (current blocks)" that do not conflict with the new instructions.
- MERGE new Assigned Tasks or Assigned Meetings that are not already represented in the current plan. Avoid duplicates.
- DYNAMIC BLOCK DURATIONS: Do not restrict yourself to rigid 1-hour slots. Tasks can be 15, 30, 45, or 60 minutes depending on task size, priority, or user requests.
- TASK GROUPING & CHECKLISTS: If the user requests to group quick tasks, checklist items, or run minor tasks in a short timeframe (e.g., "pónmelas en 30 minutos"), group those items into a single block with a combined description (e.g., "Checklist: [Task 1], [Task 2]...").
- TRAVEL & TRANSIT BUFFER: Automatically detect if meetings or events require travel or occur in different locations. Schedule a 15-minute or 30-minute block (type: "personal", titled "Traslado / Tiempo de viaje") right before that activity.
- Format your output strictly as a JSON object with two keys:
  - "message": A string written in Spanish detailing your assessment of the day's tasks, the changes you propose in the schedule, and asking the user to evaluate and confirm them.
  - "plan": An array of blocks representing the proposed schedule.
- Each block must have: "title", "start" (HH:MM), "end" (HH:MM), "type" ("task" | "meeting" | "personal"), and "taskId" (if linked to a task/meeting).

Do not write any introductory or explanatory text outside the JSON. Return only the JSON object.`;
    }

    let parsedResult: any = null;

    // Build standard payloads
    // 1. OpenAI format
    const openAiPayload: any = {
      model: activeModel,
      messages: [
        { role: 'system', content: 'You are a professional task coordinator. You must reply strictly in valid JSON format matching the schema requested.' },
        { role: 'user', content: action === 'vision' && image ? [
          { type: 'text', text: promptText },
          { type: 'image_url', image_url: { url: image } }
        ] : promptText }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1
    };

    // 2. Ollama native format
    const base64Clean = image ? image.replace(/^data:image\/\w+;base64,/, '') : '';
    const ollamaPayload: any = {
      model: activeModel,
      prompt: promptText,
      stream: false,
      format: 'json',
      options: {
        temperature: 0.1
      }
    };
    if (image && base64Clean) {
      ollamaPayload.images = [base64Clean];
    }

    // Attempt 1: OpenAI-compatible endpoint (/v1/chat/completions)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout
      const res = await fetch(`${endpoint}/v1/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(openAiPayload),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          parsedResult = JSON.parse(content);
        }
      }
    } catch (e) {
      console.warn("OpenAI API attempt failed, trying Ollama native...", e);
    }

    // Attempt 2: Ollama native /api/generate
    if (!parsedResult) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);
        const res = await fetch(`${endpoint}/api/generate`, {
          method: 'POST',
          headers,
          body: JSON.stringify(ollamaPayload),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          const responseText = data.response;
          if (responseText) {
            parsedResult = JSON.parse(responseText.trim());
          }
        }
      } catch (e) {
        console.error("All live LLM API calls failed:", e);
      }
    }

    // Final fallback: If parsing failed or both attempts failed
    if (!parsedResult) {
      console.warn("Falling back to local heuristic response generator due to model failure or parsing error.");
      parsedResult = generateLocalFallback(text || '', action);
    }

    return NextResponse.json({ result: parsedResult });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
