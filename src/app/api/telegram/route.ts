import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/services/dbService';
import { resolveOrCreateCompany, resolveOrCreateAssignee } from '@/lib/resolveEntities';

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8477601066:AAEX3ekhVWmApJJAk4QaFA0ykTIPa0sJTaY';

// Helper to send messages back to Telegram
async function sendTelegramMessage(chatId: number, text: string) {
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown',
      }),
    });
    if (!res.ok) {
      console.error(`Telegram sendMessage failed: ${res.statusText}`);
    }
  } catch (err) {
    console.error("Error sending Telegram message:", err);
  }
}

// Clean markdown helper for safe text formatting
function cleanMarkdown(text: string): string {
  if (!text) return '';
  return text
    .replace(/[_*`[\]()]/g, '\\$&') // Escape Telegram markdown special characters
    .trim();
}

export async function GET() {
  return NextResponse.json({ active: true, bot: "@Ambarleebot" });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Check if it's a valid message update
    if (!body.message || !body.message.chat || !body.message.text) {
      return NextResponse.json({ ok: true });
    }

    const chatId = body.message.chat.id;
    const text = body.message.text.trim();
    const lowerText = text.toLowerCase();

    // 1. WELCOME COMMAND (/start or /ayuda)
    if (lowerText.startsWith('/start') || lowerText === 'ayuda' || lowerText.startsWith('/help')) {
      const welcome = `*👋 ¡Hola Humberto! Bienvenido a Lumen AI / Ambarlee Bot*
      
Soy tu asistente operativo inteligente para *Golden Hour*, conectado en tiempo real a tu panel en la nube. 

Puedes hablar conmigo usando comandos naturales en español. Aquí tienes lo que puedo hacer por ti:

*📋 COMANDOS:*
• *Listar tareas:* Escribe \`tareas\` o \`listar\` para ver tus tareas pendientes.
• *Crear una tarea:* Escribe \`crear tarea: [Título]\`
  _Ejemplo:_ \`crear tarea: Coordinar ventanas con Carlos para Surf Shack\`
  _(El bot automáticamente asociará la empresa si escribes "para [Empresa]")_
• *Completar una tarea:* Escribe \`completar [ID]\` o \`hecho [ID]\`
  _Ejemplo:_ \`completar t2\` o \`hecho t3\`
• *Ayuda:* Escribe \`ayuda\` en cualquier momento.

_¡Estoy listo! ¿Qué operación deseas realizar hoy?_`;
      await sendTelegramMessage(chatId, welcome);
      return NextResponse.json({ ok: true });
    }

    // 2. LIST COMMAND (tareas or listar or /list)
    if (lowerText === 'tareas' || lowerText === 'listar' || lowerText.startsWith('/list')) {
      const tasks = await dbService.getTasks();
      const activeTasks = tasks.filter(t => t.status !== 'Completed');

      if (activeTasks.length === 0) {
        await sendTelegramMessage(chatId, "*🎉 ¡Al día!* No tienes tareas pendientes registradas en este momento.");
        return NextResponse.json({ ok: true });
      }

      let reply = `*📋 Tareas Pendientes en Golden Hour (${activeTasks.length}):*\n\n`;
      activeTasks.slice(0, 15).forEach((task) => {
        const priorityEmoji = task.priority === 'High' ? '🔴' : task.priority === 'Medium' ? '🟡' : '🟢';
        const typeBadge = task.type === 'Project' ? '🏆' : task.type === 'Repetitive' ? '🔄' : '📄';
        reply += `${priorityEmoji} *[${task.id}]* ${cleanMarkdown(task.title)} ${typeBadge}\n`;
      });

      if (activeTasks.length > 15) {
        reply += `\n_...y ${activeTasks.length - 15} tareas más en tu tablero live._`;
      }
      
      await sendTelegramMessage(chatId, reply);
      return NextResponse.json({ ok: true });
    }

    // 3. CREATE COMMAND (crear tarea: or nueva tarea: or crear:)
    const createRegex = /^(crear tarea|nueva tarea|crear|nueva|agregar|\/create)\s*:\s*(.+)/i;
    const createMatch = text.match(createRegex);
    if (createMatch) {
      let title = createMatch[2].trim();
      let companyName = '';
      
      // Smart parsing of company name: " para [Company] "
      const companyMatch = title.match(/\s+para\s+([a-zA-Z0-9\sÁÉÍÓÚáéíóúÑñ]+)$/i);
      if (companyMatch) {
        companyName = companyMatch[1].trim();
        title = title.replace(/\s+para\s+[a-zA-Z0-9\sÁÉÍÓÚáéíóúÑñ]+$/i, '').trim();
      }

      // Default variables
      const companyId = await resolveOrCreateCompany(companyName || 'Golden Hour');
      const assigneeId = 'usr-12'; // Default assignee: Daniel
      const companies = await dbService.getCompanies();
      const targetCompany = companies.find(c => c.id === companyId);
      
      const payload = {
        title: title,
        description: `Creada remotamente desde el celular vía Telegram @Ambarleebot.`,
        type: 'One-shot' as const,
        steps: [],
        companyId: companyId,
        assigneeId: assigneeId,
        assigneeIds: [assigneeId],
        status: 'Pending' as const,
        priority: 'Medium' as const,
        origin: 'Manual' as const,
        dueDate: new Date().toISOString(),
        attachments: [],
      };

      const newTask = await dbService.createTask(payload);

      const successMsg = `*✅ ¡Tarea Creada con Éxito!*
      
• *ID:* \`${newTask.id}\`
• *Título:* ${cleanMarkdown(newTask.title)}
• *Empresa:* ${cleanMarkdown(targetCompany?.name || 'Golden Hour')}
• *Estado:* \`Pendiente\`
• *Creado por:* Telegram Bot

_Ya está reflejada en tiempo real en tu dashboard live._`;
      
      await sendTelegramMessage(chatId, successMsg);
      return NextResponse.json({ ok: true });
    }

    // 4. COMPLETE COMMAND (completar or hecho or check or /complete)
    const completeRegex = /^(completar tarea|completar|hecho|check|\/complete)\s+(.+)/i;
    const completeMatch = text.match(completeRegex);
    if (completeMatch) {
      const taskIdOrTitle = completeMatch[2].trim();
      const tasks = await dbService.getTasks();
      
      // Try to find by ID first
      let targetTask = tasks.find(t => t.id.toLowerCase() === taskIdOrTitle.toLowerCase());
      
      // If not found, try to search by title
      if (!targetTask) {
        targetTask = tasks.find(t => t.title.toLowerCase().includes(taskIdOrTitle.toLowerCase()));
      }

      if (!targetTask) {
        await sendTelegramMessage(chatId, `*❌ Tarea no encontrada:* No logré ubicar una tarea con el ID o título \`${taskIdOrTitle}\`.`);
        return NextResponse.json({ ok: true });
      }

      // Update task to Completed
      await dbService.updateTask(targetTask.id, { status: 'Completed' });

      const doneMsg = `*🏆 ¡Felicidades! Tarea Completada:*
      
• *ID:* \`${targetTask.id}\`
• *Título:* ${cleanMarkdown(targetTask.title)}
• *Estado:* \`Completada ✓\`

_Se ha enviado al fondo de tu panel live de forma segura._`;

      await sendTelegramMessage(chatId, doneMsg);
      return NextResponse.json({ ok: true });
    }

    // 5. UNRECOGNIZED INPUT CHAT (Fallback assistant)
    const unrecognized = `*🤔 Comando no reconocido*
    
Hola Humberto, recibí tu mensaje: _"${cleanMarkdown(text)}"_

Pero no coincide con mis formatos operativos. Escribe *ayuda* para ver las instrucciones o prueba con alguno de estos comandos:
• Escribe \`tareas\` para listar lo que hay pendiente.
• Escribe \`crear tarea: Mi nueva tarea para Surf Shack\` para agregarla.`;

    await sendTelegramMessage(chatId, unrecognized);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Error inside Telegram Bot handler:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
