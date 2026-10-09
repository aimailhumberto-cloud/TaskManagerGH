import { attachmentFile } from '@/lib/attachmentStorage';
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { validateApiKey } from '@/lib/auth';
import {dbService} from '@/services/dbService';
import {canReadTask} from '@/lib/publicWorkspace';

export async function GET(req: NextRequest, { params }: { params: Promise<{ filename: string }> }) {
  const auth = await validateApiKey(req);
  if (!auth.valid) {
    return new NextResponse(auth.error || 'Unauthorized', { status: auth.status });
  }

  try {
    const { filename } = await params;
    const data=await dbService.readData();
    const accessible=data.tasks.some(task=>canReadTask(data,auth.session!,task)&&[...(task.attachments||[]),...task.activityLog.flatMap(log=>log.snapshot?.attachments||[])].some(a=>
      typeof a.filepath==='string'&&path.posix.basename(a.filepath.replace(/\\/g,'/'))===filename));
    if(!accessible)return new NextResponse('File not found',{status:404,headers:{'Cache-Control':'private, no-store'}});
    const sanitizedFilename = filename;
    const filePath = attachmentFile(sanitizedFilename);

    if (!fs.existsSync(filePath)) {
      return new NextResponse('File not found', { status: 404 });
    }

    const fileBuffer = await fs.promises.readFile(filePath);

    let contentType = 'application/octet-stream';
    const ext = path.extname(sanitizedFilename).toLowerCase();
    switch (ext) {
      case '.pdf': contentType = 'application/pdf'; break;
      case '.png': contentType = 'image/png'; break;
      case '.jpg':
      case '.jpeg': contentType = 'image/jpeg'; break;
      case '.gif': contentType = 'image/gif'; break;
      case '.txt': contentType = 'text/plain'; break;
      case '.csv': contentType = 'text/csv'; break;
    }

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${sanitizedFilename}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': 'sandbox',
      },
    });
  } catch (error: any) {
    return new NextResponse('Adjunto no disponible.', { status: 500 });
  }
}
