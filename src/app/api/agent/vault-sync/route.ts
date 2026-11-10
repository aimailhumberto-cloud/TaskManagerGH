import { NextRequest, NextResponse } from 'next/server';
import {
  getVaultPath,
  writeVaultFile,
  deleteVaultFile,
  readVaultFile,
  listVaultFiles,
  loadBrainGraph,
} from '@/lib/smjBrainService';

export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-agent-key, x-vault-token',
  'Cache-Control': 'no-store',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const vaultPath = getVaultPath();

    if (searchParams.get('status') === '1') {
      const files = listVaultFiles();
      return NextResponse.json(
        {
          ok: true,
          storage: {
            activeVaultPath: vaultPath,
            isRender: !!process.env.RENDER,
            isPersistentDisk: vaultPath.startsWith('/data'),
            totalFiles: files.length,
          },
        },
        { status: 200, headers: CORS_HEADERS }
      );
    }

    if (searchParams.get('list') === '1') {
      const files = listVaultFiles();
      return NextResponse.json(
        { ok: true, total: files.length, files },
        { status: 200, headers: CORS_HEADERS }
      );
    }

    const filePath = searchParams.get('path');
    if (filePath) {
      const res = readVaultFile(filePath);
      if (!res.ok) {
        return NextResponse.json(
          { ok: false, error: `Archivo '${filePath}' no encontrado` },
          { status: 404, headers: CORS_HEADERS }
        );
      }
      return NextResponse.json(res, { status: 200, headers: CORS_HEADERS });
    }

    if (searchParams.get('export') === 'json') {
      const filesList = listVaultFiles();
      const filesWithContent = filesList.map(f => {
        const read = readVaultFile(f.path);
        return {
          path: f.path,
          content: read.content || '',
          mtime: f.mtime,
          size: f.size,
        };
      });
      return NextResponse.json(
        {
          ok: true,
          exportedAt: new Date().toISOString(),
          totalFiles: filesWithContent.length,
          files: filesWithContent,
        },
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // Default overview
    const files = listVaultFiles();
    return NextResponse.json(
      {
        ok: true,
        message: 'Endpoint de Sincronización en la Nube para Obsidian Vault (SM Jaleel Cerebro)',
        activeVaultPath: vaultPath,
        isRender: !!process.env.RENDER,
        totalFiles: files.length,
        usage: {
          readStatus: 'GET /api/agent/vault-sync?status=1',
          listFiles: 'GET /api/agent/vault-sync?list=1',
          readFile: 'GET /api/agent/vault-sync?path=01-Internal-Clients/Person - Aleem Mohammed.md',
          exportAll: 'GET /api/agent/vault-sync?export=json',
          writeFile: 'POST /api/agent/vault-sync { "action": "write_file", "path": "...", "content": "..." }',
          batchSync: 'POST /api/agent/vault-sync { "action": "batch_sync", "files": [{ "path": "...", "content": "..." }] }',
          deleteFile: 'POST /api/agent/vault-sync { "action": "delete_file", "path": "..." }',
        },
      },
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message || 'Error en vault-sync' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action || (body.path && body.content ? 'write_file' : 'unknown');

    if (action === 'write_file') {
      const { path: relPath, content } = body;
      if (!relPath || typeof content !== 'string') {
        return NextResponse.json(
          { ok: false, error: 'path y content son requeridos' },
          { status: 400, headers: CORS_HEADERS }
        );
      }
      const res = writeVaultFile(relPath, content);
      return NextResponse.json(
        {
          message: `Archivo '${relPath}' guardado instantáneamente en la nube`,
          ...res,
          timestamp: new Date().toISOString(),
        },
        { status: 200, headers: CORS_HEADERS }
      );
    }

    if (action === 'batch_sync') {
      const files: { path: string; content: string }[] = body.files;
      if (!Array.isArray(files)) {
        return NextResponse.json(
          { ok: false, error: 'files array es requerido para batch_sync' },
          { status: 400, headers: CORS_HEADERS }
        );
      }
      const results: any[] = [];
      for (const item of files) {
        if (item.path && typeof item.content === 'string') {
          results.push(writeVaultFile(item.path, item.content));
        }
      }
      return NextResponse.json(
        {
          ok: true,
          syncedCount: results.length,
          message: `${results.length} archivos sincronizados en la nube exitosamente`,
          timestamp: new Date().toISOString(),
        },
        { status: 200, headers: CORS_HEADERS }
      );
    }

    if (action === 'delete_file') {
      const { path: relPath } = body;
      if (!relPath) {
        return NextResponse.json(
          { ok: false, error: 'path es requerido para delete_file' },
          { status: 400, headers: CORS_HEADERS }
        );
      }
      const res = deleteVaultFile(relPath);
      return NextResponse.json(
        { message: `Archivo '${relPath}' eliminado del vault en la nube`, ...res },
        { status: 200, headers: CORS_HEADERS }
      );
    }

    return NextResponse.json(
      { ok: false, error: `Acción '${action}' no reconocida` },
      { status: 400, headers: CORS_HEADERS }
    );
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message || 'Error procesando sincronización en vault-sync' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
