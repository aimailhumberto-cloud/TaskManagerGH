import { NextRequest, NextResponse } from 'next/server';
import {
  getUnifiedBrainTasks,
  completeBrainTask,
  rescheduleBrainTask,
  askDotsTask,
  createBrainTask,
} from '@/lib/smjBrainService';

export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-agent-key',
  'Cache-Control': 'no-store',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const lens = searchParams.get('lens') || undefined;
    const market = searchParams.get('market') || undefined;

    const data = getUnifiedBrainTasks({ lens, market });

    return NextResponse.json(
      {
        ok: true,
        scope: 'S.M. Jaleel Executive Unified Second Brain Tasks',
        marketFilter: market || 'all',
        ...data,
      },
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message || 'Error loading unified brain tasks' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action;

    if (action === 'complete') {
      const { taskId, completedBy } = body;
      if (!taskId) {
        return NextResponse.json(
          { ok: false, error: 'taskId es requerido para completar' },
          { status: 400, headers: CORS_HEADERS }
        );
      }
      const result = completeBrainTask(taskId, completedBy);
      return NextResponse.json(result, { status: result.ok ? 200 : 404, headers: CORS_HEADERS });
    }

    if (action === 'reschedule') {
      const { taskId, newDueDate } = body;
      if (!taskId || !newDueDate) {
        return NextResponse.json(
          { ok: false, error: 'taskId y newDueDate son requeridos para reagendar' },
          { status: 400, headers: CORS_HEADERS }
        );
      }
      const result = rescheduleBrainTask(taskId, newDueDate);
      return NextResponse.json(result, { status: result.ok ? 200 : 404, headers: CORS_HEADERS });
    }

    if (action === 'ask_dots') {
      const { taskId, instruction, requestedBy } = body;
      if (!taskId || !instruction) {
        return NextResponse.json(
          { ok: false, error: 'taskId e instrucción son requeridos para pedir a DOTS' },
          { status: 400, headers: CORS_HEADERS }
        );
      }
      const result = askDotsTask(taskId, instruction, requestedBy);
      return NextResponse.json(result, { status: result.ok ? 200 : 404, headers: CORS_HEADERS });
    }

    if (action === 'create') {
      const { title, dueDate, priority, country, targetNodeId, description } = body;
      if (!title) {
        return NextResponse.json(
          { ok: false, error: 'title es requerido para crear una tarea' },
          { status: 400, headers: CORS_HEADERS }
        );
      }
      const result = createBrainTask({ title, dueDate, priority, country, targetNodeId, description });
      return NextResponse.json(result, { status: result.ok ? 201 : 400, headers: CORS_HEADERS });
    }

    return NextResponse.json(
      { ok: false, error: `Acción '${action}' no reconocida. Usa 'complete', 'reschedule', 'ask_dots' o 'create'.` },
      { status: 400, headers: CORS_HEADERS }
    );
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message || 'Error processing brain task action' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
