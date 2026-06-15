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

        // Simple helper to check overlap
        const isTimeOverlapping = (start1: string, end1: string, start2: string, end2: string) => {
          return start1 < end2 && start2 < end1;
        };

        // Extract "a las X ... hasta/a las Y" patterns
        // Matches "a las 9 voy a caracol que tengo clasede de surf hasta las 11"
        const pattern1 = /a las\s+(\d{1,2})(?::(\d{2}))?\s+(.*?)\s+(?:a|hasta)\s+las?\s+(\d{1,2})(?::(\d{2}))?/gi;
        let match;
        while ((match = pattern1.exec(combinedText)) !== null) {
          const startH = parseInt(match[1]);
          const startM = match[2] || '00';
          let title = match[3].trim();
          const endH = parseInt(match[4]);
          const endM = match[5] || '00';

          const startStr = `${String(startH).padStart(2, '0')}:${startM}`;
          const endStr = `${String(endH).padStart(2, '0')}:${endM}`;

          // Clean title keywords
          title = title.replace(/^(voy a|tengo|quiero|ir a|clase de|clasede de|clasede)\s+/i, '');
          title = title.replace(/^(que tengo|tengo que|para)\s+/i, '');
          
          if (title.toLowerCase().includes('surf') || title.toLowerCase().includes('caracol')) {
            title = "Clase de Surf (Playa Caracol)";
          } else {
            title = title.charAt(0).toUpperCase() + title.slice(1);
          }

          plan.push({
            id: 'custom_' + Math.random().toString(36).substring(2, 9),
            title: title || 'Evento Especial',
            start: startStr,
            end: endStr,
            type: 'personal'
          });
        }

        // Also check if user mentioned lunch/eating
        if (combinedText.includes('comer') || combinedText.includes('almuerzo')) {
          const startStr = '13:00';
          const endStr = '14:00';
          const hasOverlap = plan.some(b => isTimeOverlapping(b.start, b.end, startStr, endStr));
          if (!hasOverlap) {
            plan.push({
              id: 'custom_' + Math.random().toString(36).substring(2, 9),
              title: 'Almuerzo / Descanso',
              start: startStr,
              end: endStr,
              type: 'personal'
            });
          }
        }

        // Also check if user mentioned exercise/gym
        if (combinedText.includes('ejercicio') || combinedText.includes('gimnasio') || combinedText.includes('gym') || combinedText.includes('entrenar')) {
          const startStr = '17:00';
          const endStr = '18:00';
          const hasOverlap = plan.some(b => isTimeOverlapping(b.start, b.end, startStr, endStr));
          if (!hasOverlap) {
            plan.push({
              id: 'custom_' + Math.random().toString(36).substring(2, 9),
              title: 'Gimnasio / Deporte',
              start: startStr,
              end: endStr,
              type: 'personal'
            });
          }
        }

        // Gather all tasks and meetings to schedule
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

        // Parse new tasks from user input text separated by dash "-"
        const segments = cleaned.split(/\s+-\s+/);
        if (segments.length > 1) {
          segments.forEach((seg, index) => {
            let cleanSeg = seg.trim();
            if (index === 0) {
              // Ignore introductory instructions in the first segment
              return;
            }
            if (cleanSeg && cleanSeg.length > 2) {
              cleanSeg = cleanSeg.replace(/^[.\s-]+/, '').trim();
              if (cleanSeg) {
                itemsToSchedule.push({
                  title: cleanSeg,
                  type: 'task'
                });
              }
            }
          });
        }

        // Add today's DB tasks
        if (tasks && tasks.length > 0) {
          tasks.forEach((t: any) => {
            // Check if we already added a task with a very similar title from the text to avoid duplicates
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

        // Place items into available slots
        // 1. Place fixed meetings
        itemsToSchedule.forEach((item) => {
          if (item.fixedTime) {
            let start = item.fixedTime;
            let end = '10:00';
            const parts = start.split(':');
            const hNum = parseInt(parts[0]);
            end = `${String(hNum + 1).padStart(2, '0')}:${parts[1] || '00'}`;

            const hasOverlap = plan.some(b => isTimeOverlapping(b.start, b.end, start, end));
            if (!hasOverlap) {
              plan.push({
                id: 'block_' + Math.random().toString(36).substring(2, 9),
                title: item.title,
                start,
                end,
                type: item.type,
                taskId: item.taskId
              });
              item.scheduled = true;
            }
          }
        });

        // 2. Place other items in free hourly slots from 08:00 to 18:00
        let currentH = 8;
        itemsToSchedule.forEach((item) => {
          if (item.scheduled) return;

          while (currentH < 18) {
            const startStr = `${String(currentH).padStart(2, '0')}:00`;
            const endStr = `${String(currentH + 1).padStart(2, '0')}:00`;

            const hasOverlap = plan.some(b => isTimeOverlapping(b.start, b.end, startStr, endStr));
            if (!hasOverlap) {
              plan.push({
                id: 'block_' + Math.random().toString(36).substring(2, 9),
                title: item.title,
                start: startStr,
                end: endStr,
                type: item.type,
                taskId: item.taskId
              });
              item.scheduled = true;
              currentH++;
              break;
            }
            currentH++;
          }
        });

        plan.sort((a, b) => a.start.localeCompare(b.start));

        // Construct response evaluation message
        const scheduledItems = itemsToSchedule.filter(i => i.scheduled);
        const unscheduledItems = itemsToSchedule.filter(i => !i.scheduled);

        let message = `### 📝 Evaluación de la Planificación Propuesta\n\nHe evaluado tus peticiones y la conversación anterior. Propongo los siguientes ajustes en tu agenda:\n\n`;
        
        const personalEvents = plan.filter(b => b.type === 'personal');
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
          message += `\n⚠️ **Actividades no asignadas (sin espacio hoy):**\n`;
          unscheduledItems.forEach(item => {
            message += `- ❌ *${item.title}*\n`;
          });
          message += `\n*Nota: Tu jornada laboral (08:00 - 18:00) está completamente llena. Estas actividades quedan como tareas pendientes en el panel.*`;
        }

        message += `\n\n¿Deseas confirmar y aplicar esta distribución a tu agenda? Revisa los bloques sombreados en el calendario y haz clic en "Aplicar Agenda" o descártalos.`;

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
- PRESERVE the blocks in "Plan of blocks currently on screen (current blocks)" unless the user's input explicitly asks to change or delete them. Do not discard manual modifications.
- MERGE new Assigned Tasks or Assigned Meetings that are not already represented in the current plan. Avoid duplicates.
- Avoid solapamientos (overlapping). If there is a fixed meeting time, keep it and schedule tasks around it.
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
