import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { withBrain } from '@/lib/brains';
import { canWriteFully, currentBrain } from '@/lib/brainContext';
import { getAccount } from '@/lib/localAccounts';
import { loadBrainGraph } from '@/lib/smjBrainService';
import { updateNoteFile } from '@/lib/vaultFiles';
import { ensureDailySnapshot } from '@/lib/vaultBackup';
import { AssetError, findAsset, listAssets, saveAsset } from '@/lib/assetStore';
export const dynamic = 'force-dynamic';

/**
 * Biblioteca de imágenes del cerebro.
 * GET ?q=&brand=&kind= → lista de imágenes (de fábrica y subidas).
 * POST {action:'assign', nodeId, assetId} → pone esa imagen en la ficha.
 * POST {action:'unassign', nodeId} → quita la imagen puesta desde la biblioteca.
 * POST {action:'upload', name, brand?, kind?, dataBase64} → agrega una imagen PNG/JPG/WEBP de hasta 2 MB.
 */
async function _GET(req: NextRequest) {
  const ctx = currentBrain(); if (!ctx) return NextResponse.json({ ok: false, error: 'Sin cerebro.' }, { status: 401 });
  const u = new URL(req.url); const q = (u.searchParams.get('q') || '').toLowerCase().trim(), brand = u.searchParams.get('brand'), kind = u.searchParams.get('kind');
  const all = listAssets();
  const assets = all.filter(a => (!brand || a.brand === brand) && (!kind || a.kind === kind) && (!q || `${a.id} ${a.brand} ${a.kind} ${a.label || ''}`.toLowerCase().includes(q)));
  const count = (k: 'brand' | 'kind') => Object.entries(all.reduce((m: Record<string, number>, a) => { m[a[k]] = (m[a[k]] || 0) + 1; return m; }, {})).sort((a, b) => b[1] - a[1]).map(([name, n]) => ({ name, n }));
  return NextResponse.json({ ok: true, total: all.length, assets, brands: count('brand'), kinds: count('kind') });
}
async function _POST(req: NextRequest) {
  const ctx = currentBrain(); if (!ctx) return NextResponse.json({ ok: false, error: 'Sin cerebro.' }, { status: 401 });
  if (ctx.readOnly || !canWriteFully()) return NextResponse.json({ ok: false, error: 'No tienes permiso para cambiar imágenes.' }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const who = ctx.actor?.startsWith('local-') ? getAccount(ctx.actor)?.name || ctx.actor : ctx.actor ? 'Agente' : 'Persona';
  try {
    if (b?.action === 'upload') return NextResponse.json({ ok: true, asset: saveAsset(b, who) });
    if (b?.action === 'assign' || b?.action === 'unassign') {
      const g = loadBrainGraph(); const id = String(b.nodeId || '').toLowerCase();
      const node = (g.allNodes || g.nodes).find(n => n.id.toLowerCase() === id);
      if (!node) return NextResponse.json({ ok: false, error: 'No se encontró esa ficha.' }, { status: 404 });
      const abs = path.resolve(node.filePath);
      if (!abs.startsWith(path.resolve(ctx.vaultPath) + path.sep)) return NextResponse.json({ ok: false, error: 'Ficha fuera de la bóveda.' }, { status: 400 });
      const asset = b.action === 'assign' ? findAsset(String(b.assetId || '')) : null;
      if (b.action === 'assign' && !asset) return NextResponse.json({ ok: false, error: 'Esa imagen no está en la biblioteca.' }, { status: 404 });
      ensureDailySnapshot(ctx.vaultPath);
      const upd = updateNoteFile(abs, (fm) => {
        if (asset) { fm.asset_id = asset.id; fm.avatar_image = asset.url; fm.asset_assigned_by = who; }
        else { if (fm.asset_id) delete fm.avatar_image; delete fm.asset_id; delete fm.asset_assigned_by; }
        fm.updated_at = new Date().toISOString();
      });
      if (!upd.ok) return NextResponse.json({ ok: false, error: upd.error }, { status: 409 });
      return NextResponse.json({ ok: true, nodeId: node.id, asset });
    }
    return NextResponse.json({ ok: false, error: "action debe ser 'assign', 'unassign' o 'upload'." }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof AssetError ? e.message : 'No se pudo guardar la imagen.' }, { status: e instanceof AssetError ? e.status : 500 });
  }
}
export const GET = withBrain(_GET);
export const POST = withBrain(_POST);
