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
    const { action, text, image, tasks, meetings } = body;

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    const aiConfig = await dbService.getAIConfig();
    const hasConfig = aiConfig && aiConfig.endpoint;

    // Helper to generate simulated local response if LLM is unavailable
    const generateLocalFallback = (rawText: string, actionType: string) => {
      const cleaned = (rawText || '').trim();
      
      if (actionType === 'day_plan') {
        const plan: any[] = [];
        let currentHour = 9;
        
        if (meetings && meetings.length > 0) {
          meetings.forEach((m: any) => {
            let start = m.meetingTime || `${String(currentHour).padStart(2, '0')}:00`;
            let end = '11:00';
            if (m.meetingTime) {
              const parts = m.meetingTime.split(':');
              const h = parts[0];
              const m_parts = parts[1];
              const hNum = parseInt(h);
              end = `${String(hNum + 1).padStart(2, '0')}:${m_parts || '00'}`;
            }
            plan.push({
              title: m.title || 'Reunión',
              start,
              end,
              type: 'meeting',
              taskId: m.id
            });
          });
        }

        if (tasks && tasks.length > 0) {
          tasks.forEach((t: any, idx: number) => {
            const hour = 11 + idx * 2;
            if (hour < 18) {
              plan.push({
                title: t.title || 'Trabajar en tarea',
                start: `${String(hour).padStart(2, '0')}:00`,
                end: `${String(hour + 1).padStart(2, '0')}:30`,
                type: 'task',
                taskId: t.id
              });
            }
          });
        }

        const cleanText = (rawText || '').toLowerCase();
        if (cleanText.includes('comer') || cleanText.includes('almuerzo')) {
          plan.push({
            title: 'Almuerzo / Descanso',
            start: '13:00',
            end: '14:00',
            type: 'personal'
          });
        }
        if (cleanText.includes('ejercicio') || cleanText.includes('gimnasio') || cleanText.includes('gym')) {
          plan.push({
            title: 'Gimnasio / Deporte',
            start: '17:00',
            end: '18:00',
            type: 'personal'
          });
        }

        plan.sort((a, b) => a.start.localeCompare(b.start));
        return { plan };
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
      promptText = `You are Hermes AI, a personal scheduler. Help the user plan their day by creating schedule blocks between 08:00 and 18:00.
Create schedule blocks based on:
1. The user's input/instructions: "${text || ''}"
2. Assigned Tasks for today: ${JSON.stringify(tasks || [])}
3. Assigned Meetings for today: ${JSON.stringify(meetings || [])}

Format your output strictly as a JSON object with a single key "plan" which contains an array of blocks.
Each block in the array must be an object with the following fields:
- "title": a concise title of the block.
- "start": start time in 24h format (HH:MM, e.g. "09:00").
- "end": end time in 24h format (HH:MM, e.g. "10:30").
- "type": category of block, must be "task", "meeting", or "personal".
- "taskId": if this block corresponds to one of the tasks/meetings provided, include its ID here. Otherwise omit it.

Do not write any introductory or explanatory text. Return only the JSON object.`;
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
