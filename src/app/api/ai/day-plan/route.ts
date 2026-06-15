import { NextRequest, NextResponse } from 'next/server';
import { dbService, extractDayPlan, injectDayPlan, DayPlanBlock } from '@/services/dbService';
import { validateApiKey } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');
  const date = searchParams.get('date'); // YYYY-MM-DD

  if (!userId || !date) {
    return NextResponse.json({ error: 'Missing userId or date query parameters' }, { status: 400 });
  }

  try {
    const tasks = await dbService.getTasks();
    const planTitle = `Plan de Trabajo -`;
    
    // Find task for the user on this date
    const foundTask = tasks.find(t => 
      t.assigneeId === userId && 
      t.title.startsWith(planTitle) &&
      t.title.endsWith(date)
    );

    if (foundTask) {
      const plan = extractDayPlan(foundTask.description);
      return NextResponse.json({ plan });
    }

    return NextResponse.json({ plan: [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, date, blocks } = body;

    if (!userId || !date || !Array.isArray(blocks)) {
      return NextResponse.json({ error: 'Missing userId, date, or blocks array in body' }, { status: 400 });
    }

    const tasks = await dbService.getTasks();
    const planTitle = `Plan de Trabajo -`;

    // Find if a plan task already exists
    const foundTask = tasks.find(t => 
      t.assigneeId === userId && 
      t.title.startsWith(planTitle) &&
      t.title.endsWith(date)
    );

    const people = await dbService.getPeople();
    const person = people.find(p => p.id === userId);
    
    const serializedDesc = injectDayPlan(
      foundTask?.description || `Plan de Trabajo para ${person?.name || 'Usuario'} el ${date}`,
      blocks
    );

    if (foundTask) {
      // Update existing
      await dbService.updateTask(foundTask.id, {
        description: serializedDesc
      });
    } else {
      // Create new plan task
      const fullTitle = `Plan de Trabajo - ${person?.name || ''} - ${date}`;
      await dbService.createTask({
        title: fullTitle,
        description: serializedDesc,
        type: 'One-shot',
        assigneeId: userId,
        status: 'Pending',
        priority: 'Medium',
        origin: 'Manual',
        dueDate: `${date}T23:59:59Z`,
        companyId: person?.companyId || '',
        steps: [],
        attachments: []
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
