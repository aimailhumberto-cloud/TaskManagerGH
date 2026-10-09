import { attachmentDirectory, attachmentFile } from '@/lib/attachmentStorage';
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { dbService } from '@/services/dbService';
import { validateApiKey } from '@/lib/auth';
import {canWriteTask} from '@/lib/publicWorkspace';
import {WorkspaceError} from '@/lib/projects';

export async function POST(req: NextRequest) {
  const auth = await validateApiKey(req);
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
    if(!canWriteTask(await dbService.readData(),auth.session!,task))return NextResponse.json({error:'Adjunto no disponible para esta identidad.'},{status:403});

    const targetDir = attachmentDirectory();
    if (!fs.existsSync(targetDir)) {
      await fs.promises.mkdir(targetDir, { recursive: true });
    }

    const sanitizedFilename = file.name;
    const filePath = attachmentFile(sanitizedFilename);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await fs.promises.writeFile(filePath, buffer, { flag: 'wx' });

    const attachmentId = `att-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const newAttachment = {
      id: attachmentId,
      filename: sanitizedFilename,
      filepath: `data/attachments/${sanitizedFilename}`,
      uploadedAt: new Date().toISOString(),
    };

    await dbService.transaction(data => {
      const current = data.tasks.find(t => t.id === taskId);
      if (!current || !canWriteTask(data,auth.session!,current)) throw new WorkspaceError('El acceso cambió antes de vincular el adjunto.',403);
      if ((current.revision || 0) !== (task.revision || 0)) throw new WorkspaceError('La tarea cambió antes de vincular el adjunto; revisa la versión guardada.',409);
      current.attachments = [...current.attachments,newAttachment];
      current.revision = (current.revision || 0) + 1;
      const {activityLog: _log,...snapshot} = current;
      current.activityLog.push({ timestamp: new Date().toISOString(), user: auth.session!.personId, action: `Archivo adjunto añadido: ${sanitizedFilename}`, type: 'User', revision: current.revision, snapshot: structuredClone(snapshot) });
    });

    return NextResponse.json({
      success: true,
      message: 'Attachment uploaded and linked successfully',
      filePath: newAttachment.filepath,
      fileName: newAttachment.filename,
      attachment: newAttachment,
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.code === 'EEXIST' ? 'Ya existe un adjunto con ese nombre; no se sobrescribió.' : error instanceof WorkspaceError ? error.message : 'No se completó el guardado del adjunto.' }, { status: error?.code === 'EEXIST' ? 409 : error instanceof WorkspaceError ? error.status : 500 });
  }
}
