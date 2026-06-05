import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/services/dbService';
import { validateApiKey } from '@/lib/auth';
import { mapApiToDb, mapDbToApi } from '@/lib/mappings';
import { resolveOrCreateCompany, resolveOrCreateAssignee } from '@/lib/resolveEntities';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = validateApiKey(request);
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const tasks = await dbService.getTasks();
    return NextResponse.json(tasks.map(mapDbToApi));
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = validateApiKey(request);
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();

    if (!body.title || typeof body.title !== 'string' || body.title.trim() === '') {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    if (body.origin && !['golden-hour', 'manual'].includes(body.origin.toLowerCase())) {
      return NextResponse.json(
        { error: `Invalid origin value: "${body.origin}". Must be either "golden-hour" or "manual".` },
        { status: 400 }
      );
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

    const companyId = await resolveOrCreateCompany(body.companyId || body.companyName || '');
    const assigneeId = await resolveOrCreateAssignee(body.assigneeId || body.assigneeName || '');

    const payload = {
      title: body.title,
      description: body.description || '',
      type: mapApiToDb.type(body.type) || 'One-shot',
      repeatPattern: body.repeatPattern ? mapApiToDb.repeatPattern(body.repeatPattern) as any : null,
      steps: Array.isArray(body.steps) ? body.steps : [],
      companyId: companyId,
      assigneeId: assigneeId,
      assigneeIds: Array.isArray(body.assigneeIds) ? body.assigneeIds : (assigneeId ? [assigneeId] : []),
      status: mapApiToDb.status(body.status) || 'Pending',
      priority: mapApiToDb.priority(body.priority) || 'Medium',
      origin: mapApiToDb.origin(body.origin) || 'Manual',
      dueDate: body.dueDate || new Date().toISOString(),
      attachments: Array.isArray(body.attachments) ? body.attachments : [],
    };

    const task = await dbService.createTask(payload);
    return NextResponse.json(mapDbToApi(task), { status: 201 });
  } catch (error: any) {
    if (error.message.includes('Foreign key constraint failed')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = validateApiKey(request);
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    await dbService.clearAllTasks();
    return NextResponse.json({ success: true, message: 'All tasks cleared successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
