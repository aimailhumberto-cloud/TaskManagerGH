import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/services/dbService';
import { validateApiKey } from '@/lib/auth';
import { mapApiToDb, mapDbToApi } from '@/lib/mappings';
import { resolveOrCreateCompany, resolveOrCreateAssignee } from '@/lib/resolveEntities';

export async function POST(request: NextRequest) {
  const auth = validateApiKey(request);
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const tasksArray = Array.isArray(body) ? body : [body];

    const createdTasks = [];

    for (const taskItem of tasksArray) {
      if (!taskItem.title || typeof taskItem.title !== 'string' || taskItem.title.trim() === '') {
        continue; // Skip invalid tasks or empty titles silently in bulk ingest
      }

      const companyId = await resolveOrCreateCompany(taskItem.companyId || taskItem.companyName || '');
      const assigneeId = await resolveOrCreateAssignee(taskItem.assigneeId || taskItem.assigneeName || '');

      const payload = {
        title: taskItem.title,
        description: taskItem.description || '',
        type: mapApiToDb.type(taskItem.type) || 'One-shot',
        repeatPattern: taskItem.repeatPattern ? mapApiToDb.repeatPattern(taskItem.repeatPattern) as any : null,
        steps: Array.isArray(taskItem.steps) ? taskItem.steps : [],
        companyId: companyId,
        assigneeId: assigneeId,
        status: mapApiToDb.status(taskItem.status) || 'Pending',
        priority: mapApiToDb.priority(taskItem.priority) || 'Medium',
        origin: mapApiToDb.origin(taskItem.origin) || 'Manual',
        dueDate: taskItem.dueDate || new Date().toISOString(),
        attachments: Array.isArray(taskItem.attachments) ? taskItem.attachments : [],
      };

      const created = await dbService.createTask(payload);
      createdTasks.push(mapDbToApi(created));
    }

    return NextResponse.json(createdTasks, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
