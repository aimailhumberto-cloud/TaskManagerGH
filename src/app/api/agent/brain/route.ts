import { NextRequest, NextResponse } from 'next/server';
import { loadBrainGraph, saveWorkingMemory, consolidateWorkingMemory, updateDossierMetadata, upsertNode, reconfigureNodeTopology } from '@/lib/smjBrainService';

export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-agent-key',
  'Cache-Control': 'no-store',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const lens = searchParams.get('lens') || undefined;
    const market = searchParams.get('market') || undefined;

    const graph = loadBrainGraph(lens, market);

    return NextResponse.json(
      {
        ok: true,
        scope: 'S.M. Jaleel Agnostic Multi-Level Second Brain',
        lens: lens || 'global-core',
        marketFilter: market || 'all',
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action;

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
      return NextResponse.json({ ok: true, result }, { status: 201, headers: CORS_HEADERS });
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
          { ok: false, error: 'nodeId es requerido para update_dossier (ej. "medimex", "chubby")' },
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

    if (action === 'upsert_node') {
      const { relativePath, frontmatter, body: nodeBody } = body;
      if (!relativePath || !frontmatter) {
        return NextResponse.json(
          { ok: false, error: 'relativePath and frontmatter son requeridos para upsert_node' },
          { status: 400, headers: CORS_HEADERS }
        );
      }
      const result = upsertNode({
        relativePath,
        frontmatter,
        body: nodeBody || '',
      });
      return NextResponse.json(result, { status: result.ok ? 200 : 500, headers: CORS_HEADERS });
    }

    if (action === 'reconfigure_node_topology') {
      const { nodeId, updates } = body;
      if (!nodeId) {
        return NextResponse.json(
          { ok: false, error: "Campo requerido 'nodeId' faltante." },
          { status: 400, headers: CORS_HEADERS }
        );
      }
      const result = reconfigureNodeTopology({
        nodeId,
        ...(updates || {}),
      });
      return NextResponse.json(result, { status: result.ok ? 200 : 400, headers: CORS_HEADERS });
    }

    return NextResponse.json(
      { ok: false, error: `Acción '${action}' no reconocida. Usa 'remember_working', 'consolidate_session', 'update_dossier', 'upsert_node' o 'reconfigure_node_topology'.` },
      { status: 400, headers: CORS_HEADERS }
    );
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message || 'Error processing brain action' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
