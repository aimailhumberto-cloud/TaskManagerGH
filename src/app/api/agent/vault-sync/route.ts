import { NextRequest, NextResponse } from 'next/server';
import { withBrain } from '@/lib/brains';
import { canWriteFully } from '@/lib/brainContext';
import { parseNoteStrict } from '@/lib/vaultFiles';
import { ensureDailySnapshot, createVaultSnapshot, listVaultSnapshots, MAX_SNAPSHOTS } from '@/lib/vaultBackup';
import { tr, tw } from '@/lib/reqLang';
import {
  getVaultPath,
  writeVaultFile,
  deleteVaultFile,
  readVaultFile,
  listVaultFiles,
  loadBrainGraph,
  VaultWriteError,
} from '@/lib/smjBrainService';

/**
 * Regla de la fase 1: reescribir un archivo que ya existe exige `ifMatch` = la huella que dio la lectura
 * (GET ?path= o GET /api/agent/brain?node=). Así nadie pisa sin saber lo que otro guardó entre medio.
 * Se puede apagar con VAULT_REQUIRE_MATCH=0 (no recomendado).
 */
function staleCheck(relPath: string, ifMatch: unknown): { status: number; error: string; currentHash?: string } | null {
  const cur = readVaultFile(relPath);
  if (!cur.ok) return null; // archivo nuevo
  if (typeof ifMatch === 'string' && ifMatch) {
    return ifMatch === cur.hash ? null : { status: 409, error: tr(`${relPath} cambió desde que lo leíste. Vuelve a leerlo (GET /api/agent/vault-sync?path=...) y aplica tu cambio sobre la versión actual.`, `${relPath} changed since you read it. Read it again (GET /api/agent/vault-sync?path=...) and apply your change on top of the current version.`), currentHash: cur.hash };
  }
  if (process.env.VAULT_REQUIRE_MATCH === '0') return null;
  return { status: 428, error: tr(`${relPath} ya existe. Para reescribirlo envía ifMatch con la huella (hash) que te dio la lectura. Para registrar una novedad usa POST /api/agent/brain {action:'record'}.`, `${relPath} already exists. To overwrite it, send ifMatch with the fingerprint (hash) you got when reading it. To log news, use POST /api/agent/brain {action:'record'}.`), currentHash: cur.hash };
}

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

async function _GET(req: NextRequest) {
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
          // Versión desplegada: sirve para confirmar que un cambio ya llegó a producción
          build: { commit: (process.env.RENDER_GIT_COMMIT || '').slice(0, 7) || null },
        },
        { status: 200, headers: CORS_HEADERS }
      );
    }

    if (searchParams.get('backups') === '1') {
      const snapshots = listVaultSnapshots(vaultPath);
      return NextResponse.json(
        { ok: true, total: snapshots.length, keep: MAX_SNAPSHOTS, latest: snapshots[0] || null, snapshots },
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
          { ok: false, error: tr(`Archivo '${filePath}' no encontrado`, `File '${filePath}' not found`) },
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
        message: tw('Endpoint de Sincronización en la Nube para Obsidian Vault (SM Jaleel Cerebro)', 'Cloud Sync endpoint for the Obsidian Vault (SM Jaleel Brain)'),
        activeVaultPath: vaultPath,
        isRender: !!process.env.RENDER,
        totalFiles: files.length,
        usage: {
          readStatus: 'GET /api/agent/vault-sync?status=1',
          listFiles: 'GET /api/agent/vault-sync?list=1',
          readFile: 'GET /api/agent/vault-sync?path=01-Internal-Clients/Person - Aleem Mohammed.md',
          exportAll: 'GET /api/agent/vault-sync?export=json',
          listBackups: 'GET /api/agent/vault-sync?backups=1',
          createBackup: 'POST /api/agent/vault-sync { "action": "snapshot" }',
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

async function _POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action || (body.path && body.content ? 'write_file' : 'unknown');

    if (action !== 'snapshot' && !canWriteFully()) return NextResponse.json({ ok: false, error: tr('Esta llave no puede escribir ni borrar archivos de la bóveda.', 'This key cannot write or delete vault files.') }, { status: 403 });

    if (action === 'snapshot') {
      const res = createVaultSnapshot(getVaultPath(), 'manual');
      return NextResponse.json(
        res.ok ? { ok: true, message: 'Respaldo creado', snapshot: res.snapshot } : { ok: false, error: res.error },
        { status: res.ok ? 200 : 500, headers: CORS_HEADERS }
      );
    }

    // Foto diaria del vault antes de la primera escritura del día
    const backup = ensureDailySnapshot(getVaultPath());
    if (backup.error) console.error('[vault-backup] no se pudo crear la foto diaria:', backup.error);

    if (action === 'write_file') {
      const { path: relPath, content } = body;
      if (!relPath || typeof content !== 'string') {
        return NextResponse.json(
          { ok: false, error: tr('path y content son requeridos', 'path and content are required') },
          { status: 400, headers: CORS_HEADERS }
        );
      }
      const stale = staleCheck(relPath, body.ifMatch);
      if (stale) return NextResponse.json({ ok: false, ...stale }, { status: stale.status, headers: CORS_HEADERS });
      let res;
      try { res = writeVaultFile(relPath, content); }
      catch (e: any) { if (e instanceof VaultWriteError) return NextResponse.json({ ok: false, error: e.message }, { status: e.status, headers: CORS_HEADERS }); throw e; }
      return NextResponse.json(
        {
          message: tr(`Archivo '${relPath}' guardado instantáneamente en la nube`, `File '${relPath}' saved instantly to the cloud`),
          ...res,
          timestamp: new Date().toISOString(),
        },
        { status: 200, headers: CORS_HEADERS }
      );
    }

    if (action === 'batch_sync') {
      const files: { path: string; content: string; ifMatch?: string }[] = body.files;
      if (!Array.isArray(files)) {
        return NextResponse.json(
          { ok: false, error: tr('files array es requerido para batch_sync', 'files array is required for batch_sync') },
          { status: 400, headers: CORS_HEADERS }
        );
      }
      const results: any[] = [];
      const rejected: { path: string; error: string }[] = [];
      for (const item of files) {
        if (item.path && typeof item.content === 'string') {
          if (String(item.path).endsWith('.md')) {
            const check = parseNoteStrict(item.content);
            if (!check.ok) {
              rejected.push({ path: item.path, error: check.error });
              continue;
            }
          }
          const stale = staleCheck(item.path, item.ifMatch);
          if (stale) { rejected.push({ path: item.path, error: stale.error }); continue; }
          try { results.push(writeVaultFile(item.path, item.content)); }
          catch (e: any) { rejected.push({ path: item.path, error: e?.message || 'error' }); }
        }
      }
      return NextResponse.json(
        {
          ok: rejected.length === 0,
          syncedCount: results.length,
          rejected,
          message: `${results.length} archivos guardados${rejected.length ? `; ${rejected.length} rechazados (ver rejected)` : ''}`,
          timestamp: new Date().toISOString(),
        },
        { status: 200, headers: CORS_HEADERS }
      );
    }

    if (action === 'delete_file') {
      const { path: relPath } = body;
      if (!relPath) {
        return NextResponse.json(
          { ok: false, error: tr('path es requerido para delete_file', 'path is required for delete_file') },
          { status: 400, headers: CORS_HEADERS }
        );
      }
      const res = deleteVaultFile(relPath);
      return NextResponse.json(
        { message: tr(`Archivo '${relPath}' eliminado del vault en la nube`, `File '${relPath}' deleted from the cloud vault`), ...res },
        { status: 200, headers: CORS_HEADERS }
      );
    }

    return NextResponse.json(
      { ok: false, error: tr(`Acción '${action}' no reconocida`, `Action '${action}' not recognized`) },
      { status: 400, headers: CORS_HEADERS }
    );
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message || tr('Error procesando sincronización en vault-sync', 'Error processing the vault-sync') },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

// Cada verbo corre dentro del cerebro de quien hace la petición (ver src/lib/brains.ts).
export const GET = withBrain(_GET);
export const POST = withBrain(_POST);
