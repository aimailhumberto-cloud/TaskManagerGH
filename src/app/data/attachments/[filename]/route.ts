import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { validateApiKey } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: { filename: string } }) {
  const auth = validateApiKey(req);
  if (!auth.valid) {
    return new NextResponse(auth.error || 'Unauthorized', { status: 401 });
  }

  try {
    const { filename } = params;
    const sanitizedFilename = path.basename(filename);
    const filePath = path.join(process.cwd(), 'data', 'attachments', sanitizedFilename);

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
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error: any) {
    return new NextResponse(`Internal Server Error: ${error.message}`, { status: 500 });
  }
}
