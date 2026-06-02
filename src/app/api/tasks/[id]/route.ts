import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/services/dbService';
import { validateApiKey } from '@/lib/auth';
import { mapApiToDb, mapDbToApi } from '@/lib/mappings';
import { resolveOrCreateCompany, resolveOrCreateAssignee } from '@/lib/resolveEntities';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = validateApiKey(request);
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const task = await dbService.getTaskById(params.id);
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    return NextResponse.json(mapDbToApi(task));
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = validateApiKey(request);
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const taskExists = await dbService.getTaskById(params.id);
    if (!taskExists) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    if (body.title !== undefined) {
      if (typeof body.title === 'string' && body.title.trim() === '') {
        return NextResponse.json({ error: 'Title cannot be empty or whitespace-only' }, { status: 400 });
      }
    }

    if (body.status !== undefined && mapApiToDb.status(body.status) === undefined) {
      return NextResponse.json({ error: `Invalid status: ${body.status}` }, { status: 400 });
    }

    if (body.priority !== undefined && mapApiToDb.priority(body.priority) === undefined) {
      return NextResponse.json({ error: `Invalid priority: ${body.priority}` }, { status: 400 });
    }

    if (body.type !== undefined && mapApiToDb.type(body.type) === undefined) {
      return NextResponse.json({ error: `Invalid type: ${body.type}` }, { status: 400 });
    }

    if (body.repeatPattern !== undefined && body.repeatPattern !== null && body.repeatPattern !== '' && mapApiToDb.repeatPattern(body.repeatPattern) === undefined) {
      return NextResponse.json({ error: `Invalid repeatPattern: ${body.repeatPattern}` }, { status: 400 });
    }

    if (body.origin !== undefined && mapApiToDb.origin(body.origin) === undefined) {
      return NextResponse.json({ error: `Invalid origin: ${body.origin}` }, { status: 400 });
    }

    const updates: any = {};
    if (body.title !== undefined) updates.title = body.title;
    if (body.description !== undefined) updates.description = body.description;
    if (body.type !== undefined) updates.type = mapApiToDb.type(body.type);
    if (body.repeatPattern !== undefined) updates.repeatPattern = body.repeatPattern ? mapApiToDb.repeatPattern(body.repeatPattern) as any : null;
    if (body.steps !== undefined) updates.steps = body.steps;
    if (body.companyId !== undefined || body.companyName !== undefined) {
      updates.companyId = await resolveOrCreateCompany(body.companyId || body.companyName || '');
    }
    if (body.assigneeId !== undefined || body.assigneeName !== undefined) {
      const pId = await resolveOrCreateAssignee(body.assigneeId || body.assigneeName || '');
      updates.assigneeId = pId;
      if (body.assigneeIds === undefined) {
        updates.assigneeIds = pId ? [pId] : [];
      }
    }
    if (body.assigneeIds !== undefined) {
      updates.assigneeIds = Array.isArray(body.assigneeIds) ? body.assigneeIds : [];
      if (updates.assigneeIds.length > 0) {
        updates.assigneeId = updates.assigneeIds[0];
      } else {
        updates.assigneeId = '';
      }
    }
    if (body.status !== undefined) updates.status = mapApiToDb.status(body.status);
    if (body.priority !== undefined) updates.priority = mapApiToDb.priority(body.priority);
    if (body.origin !== undefined) updates.origin = mapApiToDb.origin(body.origin);
    if (body.dueDate !== undefined) updates.dueDate = body.dueDate;
    if (body.attachments !== undefined) updates.attachments = body.attachments;

    const task = await dbService.updateTask(params.id, updates);
    return NextResponse.json(mapDbToApi(task));
  } catch (error: any) {
    if (error.message.includes('Foreign key constraint failed')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error.message.includes('not found')) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = validateApiKey(request);
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const success = await dbService.deleteTask(params.id);
    if (!success) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, deletedId: params.id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
