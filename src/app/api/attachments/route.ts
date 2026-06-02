import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { dbService } from '@/services/dbService';
import { validateApiKey } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const auth = validateApiKey(req);
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const formData = await req.formData();
    const taskId = formData.get('taskId') as string;
    const file = formData.get('file') as File | null;

    if (!taskId) return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
    if (!file) return NextResponse.json({ error: 'file is required' }, { status: 400 });

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size exceeds 10MB limit' }, { status: 400 });
    }

    const dangerousExtensions = ['.exe', '.bat', '.cmd', '.sh', '.js', '.vbs', '.scr', '.msi'];
    const ext = path.extname(file.name).toLowerCase();
    if (dangerousExtensions.includes(ext)) {
      return NextResponse.json({ error: 'Dangerous file extension is not allowed' }, { status: 400 });
    }

    const task = await dbService.getTaskById(taskId);
    if (!task) return NextResponse.json({ error: `Task with ID "${taskId}" not found` }, { status: 404 });

    const targetDir = path.join(process.cwd(), 'data', 'attachments');
    if (!fs.existsSync(targetDir)) {
      await fs.promises.mkdir(targetDir, { recursive: true });
    }

    const sanitizedFilename = path.basename(file.name);
    const filePath = path.join(targetDir, sanitizedFilename);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await fs.promises.writeFile(filePath, buffer);

    const attachmentId = `att-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const newAttachment = {
      id: attachmentId,
      filename: sanitizedFilename,
      filepath: `data/attachments/${sanitizedFilename}`,
      uploadedAt: new Date().toISOString(),
    };

    const updatedTask = await dbService.updateTask(taskId, {
      attachments: [...(task.attachments || []), newAttachment],
    });

    const activityLog = updatedTask.activityLog || [];
    activityLog.push({
      timestamp: new Date().toISOString(),
      user: 'System',
      action: `Archivo adjunto añadido: ${sanitizedFilename}`,
      type: 'User',
    });
    await dbService.updateTask(taskId, { activityLog });

    return NextResponse.json({
      success: true,
      message: 'Attachment uploaded and linked successfully',
      filePath: newAttachment.filepath,
      fileName: newAttachment.filename,
      attachment: newAttachment,
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
