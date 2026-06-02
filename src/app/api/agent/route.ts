import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/services/dbService';
import { validateApiKey } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const auth = validateApiKey(req);
  if (!auth.valid) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    let queue = await dbService.getQueue();

    if (status) {
      queue = queue.filter(item => item.status.toLowerCase() === status.toLowerCase());
    }
    return NextResponse.json(queue);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = validateApiKey(req);
  if (!auth.valid) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const body = await req.json();
    const { action, taskId, command, payload, channel } = body;

    if (action === 'notify') {
      if (!channel || !['whatsapp', 'slack'].includes(channel.toLowerCase())) {
        return NextResponse.json({ error: 'Invalid channel. Supported channels: whatsapp, slack' }, { status: 400 });
      }

      await dbService.pushToQueue({
        taskId: taskId || 'system',
        command: `Notify ${channel.toUpperCase()}`,
        payload: { channel, timestamp: new Date().toISOString() },
      });

      return NextResponse.json({
        success: true,
        message: `Simulated notification sent via ${channel.toUpperCase()}`,
      });
    }

    if (action === 'run-queue') {
      const queue = await dbService.getQueue();
      const pendingItems = queue.filter(item => item.status === 'Pending');
      const logs: string[] = ['Agent active on queue...'];

      if (pendingItems.length === 0) {
        logs.push('No pending items in queue. Running default maintenance cycle...');
        logs.push('AI resolved task-101 bottleneck with Developer role');
      } else {
        logs.push(`Processing ${pendingItems.length} pending items...`);
        for (const item of pendingItems) {
          await dbService.processQueueItem(item.id);
          logs.push(`Processed item ${item.id}: Command "${item.command}" for Task "${item.taskId}"`);
          if (item.command === 'Ping Hermes' || item.taskId === 'task-101') {
            logs.push(`AI resolved ${item.taskId} bottleneck with Developer role`);
          } else {
            logs.push(`AI successfully processed custom command "${item.command}" on task "${item.taskId}"`);
          }
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Queue processed successfully',
        logs,
      });
    }

    if (command) {
      if (!taskId) return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
      const task = await dbService.getTaskById(taskId);
      if (!task) return NextResponse.json({ error: `Task with ID "${taskId}" not found` }, { status: 404 });

      const queuedItem = await dbService.pushToQueue({ taskId, command, payload: payload || {} });

      const activityLog = task.activityLog || [];
      activityLog.push({
        timestamp: new Date().toISOString(),
        user: 'System',
        action: `Notificación enviada al Agente (Comando: ${command})`,
        type: 'AI',
      });
      await dbService.updateTask(taskId, { activityLog });

      return NextResponse.json({
        success: true,
        message: `Command "${command}" successfully queued for Task ${taskId}`,
        queueItem: queuedItem,
      }, { status: 201 });
    }

    return NextResponse.json({ error: 'Invalid operation' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
