import { NextRequest, NextResponse } from 'next/server';
import { withBrain } from '@/lib/brains';
import { canWriteFully, currentBrain, runInBrain } from '@/lib/brainContext';
import {
  loadBrainGraph,
  getVaultVersion,
  toLiteBrainNode,
  getBrainNodeDetail,
  saveWorkingMemory,
  consolidateWorkingMemory,
  updateDossierMetadata,
  upsertNode,
  reconfigureNodeTopology,
  assignNodeParent,
  getLayoutConfig,
  updateLayoutConfig,
  resetLayoutConfig,
} from '@/lib/smjBrainService';
import { getVaultPath as getVaultPathForBackup } from '@/lib/smjBrainService';
import { ensureDailySnapshot } from '@/lib/vaultBackup';
import { recordUpdate } from '@/lib/recordUpdate';
import { nodeContext } from '@/lib/brainLens';
import { withChange } from '@/lib/journal';
import { tr } from '@/lib/reqLang';

export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-agent-key',
  'Cache-Control': 'no-store',
};

/** Jev sugiere a qué ficha pertenece la captura; en modo automático la conecta y lo deja en el registro. No retrasa la respuesta. */
function classifyInBackground(noteId: string, title: string, content: string) {
  const ctx = currentBrain();
  if (!ctx?.primary || process.env.JEV_CAPTURE_DISABLED === '1') return;
  (async () => {
    const { configuredProvider, classifyCapture, saveCapture, captureProposalId, logCall } = await import('@/lib/decisionEngine');
    const provider = configuredProvider(); if (!provider) return;
    const { getSleepDir, recordDecision } = await import('@/lib/dotsSleep');
    const { loadAutonomy, AUTO_ACTOR } = await import('@/lib/autonomy');
    const { applyProposal } = await import('@/lib/sleepApply');
    await runInBrain(ctx, async () => {
      const sleepDir = getSleepDir(ctx.vaultPath);
      try {
        const g = loadBrainGraph(); const nodes = (g.allNodes || g.nodes) as any[];
        const sug = await classifyCapture(provider, { id: noteId, title, content }, nodes);
        saveCapture(sleepDir, sug);
        const a = loadAutonomy(ctx.vaultPath);
        let applied = false;
        if (a.mode === 'auto' && sug.parentId && (sug.parentScore || 0) >= a.threshold) {
          const fresh = loadBrainGraph(); const all = (fresh.allNodes || fresh.nodes) as any[];
          const { result: r } = await withChange(ctx.vaultPath, { actor: AUTO_ACTOR, via: 'jev', action: 'clasificar_captura' }, () => applyProposal(ctx.vaultPath, { id: captureProposalId(noteId), kind: 'clasificar_captura', title: `Ubicar captura: ${title}`, nodeIds: [noteId, sug.parentId as string] }, all, AUTO_ACTOR));
          if (r.ok) { applied = true; recordDecision(ctx.vaultPath, captureProposalId(noteId), 'aprobada', AUTO_ACTOR, `Conectada sola a «${sug.parentTitle}» con confianza ${Math.round((sug.parentScore || 0) * 100)} %`); }
        }
        logCall(sleepDir, { action: applied ? 'captura-conectada' : 'captura-sugerida', ok: true, model: sug.model });
      } catch (e: any) { logCall(sleepDir, { action: 'captura', ok: false, error: e?.message || 'error' }); }
    });
  })().catch(() => {});
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

async function _GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const lens = searchParams.get('lens') || undefined;
    const market = searchParams.get('market') || undefined;
    const layout = searchParams.get('layout') || undefined;

    if (layout) {
      const res = getLayoutConfig(layout);
      return NextResponse.json(res, { status: res.ok ? 200 : 404, headers: CORS_HEADERS });
    }

    // Versión del vault (muy barata): el navegador la consulta para saber si hace falta volver a pedir el mapa.
    if (searchParams.get('version')) {
      return NextResponse.json({ ok: true, version: getVaultVersion() }, { status: 200, headers: CORS_HEADERS });
    }

    // Detalle completo de un nodo (cuerpo + encabezado íntegros), pedido al abrir su ficha.
    const nodeId = searchParams.get('node');
    if (nodeId && searchParams.get('context') === '1') {
      const ctx = nodeContext(nodeId);
      if (!ctx) return NextResponse.json({ ok: false, error: tr(`Nodo '${nodeId}' no encontrado`, `Node '${nodeId}' not found`) }, { status: 404, headers: CORS_HEADERS });
      return NextResponse.json({ ok: true, ...ctx }, { status: 200, headers: CORS_HEADERS });
    }
    if (nodeId) {
      const detail = getBrainNodeDetail(nodeId);
      if (!detail) {
        return NextResponse.json({ ok: false, error: tr(`Nodo '${nodeId}' no encontrado`, `Node '${nodeId}' not found`) }, { status: 404, headers: CORS_HEADERS });
      }
      return NextResponse.json({ ok: true, node: detail }, { status: 200, headers: CORS_HEADERS });
    }

    const graph = loadBrainGraph(lens, market);

    // view=lite: lo mínimo para dibujar el mapa (sin cuerpos, sin procedencia, sin duplicar la lista de nodos).
    if (searchParams.get('view') === 'lite') {
      const unfiltered = graph.nodes.length === (graph.allNodes || graph.nodes).length;
      const liteNodes = graph.nodes.map(toLiteBrainNode);
      return NextResponse.json(
        {
          ok: true,
          view: 'lite',
          version: graph.version,
          lens: lens || 'global-core',
          marketFilter: market || 'all',
          layouts: {
            brujula: getLayoutConfig('brujula').config,
            'version-1-ajustada': getLayoutConfig('version-1-ajustada').config,
          },
          nodes: liteNodes,
          ...(unfiltered ? {} : { allNodes: (graph.allNodes || []).map(toLiteBrainNode) }),
          links: graph.links,
          summary: graph.summary,
        },
        { status: 200, headers: CORS_HEADERS }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        scope: 'S.M. Jaleel Agnostic Multi-Level Second Brain',
        lens: lens || 'global-core',
        marketFilter: market || 'all',
        capabilities: [
          'record',
          'remember_working',
          'consolidate_session',
          'update_dossier',
          'upsert_node',
          'reconfigure_node_topology',
          'assign_parent',
          'update_layout_config',
          'reset_layout_config',
        ],
        layouts: {
          brujula: getLayoutConfig('brujula').config,
          'version-1-ajustada': getLayoutConfig('version-1-ajustada').config,
        },
        ...graph,
      },
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message || 'Error loading brain graph' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

async function _POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action;

    // Foto diaria del vault antes de la primera escritura del día
    const backup = ensureDailySnapshot(getVaultPathForBackup());
    if (backup.error) console.error('[vault-backup] no se pudo crear la foto diaria:', backup.error);

    if (action !== 'remember_working' && !canWriteFully()) return NextResponse.json({ ok: false, error: tr('Esta llave solo puede capturar notas en memoria de trabajo; no puede cambiar fichas ni consolidar.', 'This key can only capture notes into working memory; it cannot change notes or consolidate.') }, { status: 403 });

    if (action === 'remember_working') {
      const { title, content, links, relationType, source } = body;
      if (!title || !content) {
        return NextResponse.json(
          { ok: false, error: 'title and content are required for remember_working' },
          { status: 400, headers: CORS_HEADERS }
        );
      }
      const result = saveWorkingMemory({
        title,
        content,
        links: Array.isArray(links) ? links : [],
        relationType,
        source,
      });
      if (!result.ok) {
        return NextResponse.json({ ok: false, error: tr('No se pudo guardar la memoria de trabajo', 'Could not save the working memory') }, { status: 500, headers: CORS_HEADERS });
      }
      if (!result.duplicate) classifyInBackground(result.id, String(title), String(content));
      return NextResponse.json({ ok: true, result, ...(result.duplicate ? { note: tr('Esa misma captura ya se había guardado hace menos de 15 minutos; no se repitió.', 'That same capture was already saved less than 15 minutes ago; it was not repeated.') } : {}) }, { status: result.duplicate ? 200 : 201, headers: CORS_HEADERS });
    }

    if (action === 'consolidate_session') {
      const summary = body.sessionSummary || body.summary || 'Consolidación ejecutada';
      const result = consolidateWorkingMemory(summary);
      return NextResponse.json({ ok: true, result }, { status: 200, headers: CORS_HEADERS });
    }

    if (action === 'update_dossier') {
      const { nodeId, updatedBy, lastEmailSubject, lastEmailDate, lastEmailSender, nextFollowupDate, nextFollowupAction, executiveObservations, newAction, newPendingTask } = body;
      if (!nodeId) {
        return NextResponse.json(
          { ok: false, error: tr('nodeId es requerido para update_dossier (ej. "medimex", "chubby")', 'nodeId is required for update_dossier (e.g. "medimex", "chubby")') },
          { status: 400, headers: CORS_HEADERS }
        );
      }
      const result = updateDossierMetadata({
        nodeId,
        updatedBy,
        lastEmailSubject,
        lastEmailDate,
        lastEmailSender,
        nextFollowupDate,
        nextFollowupAction,
        executiveObservations,
        newAction,
        newPendingTask,
      });
      return NextResponse.json(result, { status: result.ok ? 200 : 404, headers: CORS_HEADERS });
    }

    if (action === 'record') {
      const result = recordUpdate(body);
      return NextResponse.json(result, { status: result.ok ? 200 : result.status, headers: CORS_HEADERS });
    }

    if (action === 'upsert_node') {
      const { relativePath, frontmatter, body: nodeBody, replace, ifMatch } = body;
      if (!relativePath || !frontmatter) {
        return NextResponse.json(
          { ok: false, error: tr('relativePath and frontmatter son requeridos para upsert_node', 'relativePath and frontmatter are required for upsert_node') },
          { status: 400, headers: CORS_HEADERS }
        );
      }
      const result = upsertNode({
        relativePath,
        frontmatter,
        body: nodeBody || '',
        replace: replace === true,
        ifMatch: typeof ifMatch === 'string' ? ifMatch : undefined,
      });
      return NextResponse.json(result, { status: result.ok ? 200 : result.status || 500, headers: CORS_HEADERS });
    }

    if (action === 'reconfigure_node_topology') {
      const { nodeId, updates } = body;
      if (!nodeId) {
        return NextResponse.json(
          { ok: false, error: tr("Campo requerido 'nodeId' faltante.", 'Required field \'nodeId\' is missing.') },
          { status: 400, headers: CORS_HEADERS }
        );
      }
      const result = reconfigureNodeTopology({
        nodeId,
        ...(updates || {}),
      });
      return NextResponse.json(result, { status: result.ok ? 200 : 400, headers: CORS_HEADERS });
    }

    if (action === 'assign_parent') {
      const { nodeId, parentId, field } = body;
      if (!nodeId || !parentId) {
        return NextResponse.json(
          { ok: false, error: tr("Campos requeridos 'nodeId' y 'parentId' faltantes.", 'Required fields \'nodeId\' and \'parentId\' are missing.') },
          { status: 400, headers: CORS_HEADERS }
        );
      }
      const result = assignNodeParent({ nodeId, parentId, field });
      return NextResponse.json(result, { status: result.ok ? 200 : 400, headers: CORS_HEADERS });
    }

    if (action === 'update_layout_config') {
      const { view, updates } = body;
      if (!view || !updates) {
        return NextResponse.json(
          { ok: false, error: tr("Campos requeridos 'view' y 'updates' faltantes.", 'Required fields \'view\' and \'updates\' are missing.') },
          { status: 400, headers: CORS_HEADERS }
        );
      }
      const result = updateLayoutConfig(view, updates);
      return NextResponse.json(result, { status: result.ok ? 200 : 400, headers: CORS_HEADERS });
    }

    if (action === 'reset_layout_config') {
      const { view } = body;
      if (!view) {
        return NextResponse.json(
          { ok: false, error: tr("Campo requerido 'view' faltante.", 'Required field \'view\' is missing.') },
          { status: 400, headers: CORS_HEADERS }
        );
      }
      const result = resetLayoutConfig(view);
      return NextResponse.json(result, { status: result.ok ? 200 : 400, headers: CORS_HEADERS });
    }

    return NextResponse.json(
      { ok: false, error: tr(`Acción '${action}' no reconocida. Usa 'record', 'remember_working', 'consolidate_session', 'update_dossier', 'upsert_node', 'reconfigure_node_topology', 'assign_parent', 'update_layout_config' o 'reset_layout_config'.`, `Action '${action}' not recognized. Use 'record', 'remember_working', 'consolidate_session', 'update_dossier', 'upsert_node', 'reconfigure_node_topology', 'assign_parent', 'update_layout_config' or 'reset_layout_config'.`) },
      { status: 400, headers: CORS_HEADERS }
    );
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message || 'Error processing brain action' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

// Cada verbo corre dentro del cerebro de quien hace la petición (ver src/lib/brains.ts).
export const GET = withBrain(_GET);
export const POST = withBrain(_POST);
