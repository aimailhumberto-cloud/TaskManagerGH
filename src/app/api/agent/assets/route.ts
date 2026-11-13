import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { withBrain } from '@/lib/brains';
import { canWriteFully, currentBrain } from '@/lib/brainContext';
import { getAccount } from '@/lib/localAccounts';
import { loadBrainGraph } from '@/lib/smjBrainService';
import { updateNoteFile } from '@/lib/vaultFiles';
import { ensureDailySnapshot } from '@/lib/vaultBackup';
import { AssetError, fetchRemoteImage, findAsset, isImportableUrl, listAssets, saveAsset } from '@/lib/assetStore';
import { brandOf } from '@/lib/assetCatalog';
import { tr } from '@/lib/reqLang';
export const dynamic = 'force-dynamic';

/**
 * Biblioteca de imágenes del cerebro.
 * GET ?q=&brand=&kind= → lista de imágenes (de fábrica y subidas).
 * POST {action:'assign', nodeId, assetId} → pone esa imagen en la ficha.
 * POST {action:'unassign', nodeId} → quita la imagen puesta desde la biblioteca.
 * POST {action:'upload', name, brand?, kind?, dataBase64} → agrega una imagen PNG/JPG/WEBP de hasta 2 MB.
 * POST {action:'localize', limit?, dryRun?} → copia a la biblioteca las fotos que hoy dependen de enlaces a la tienda en línea
 *   (por tandas; la ficha conserva su enlace original y se puede deshacer con 'unassign').
 */
async function _GET(req: NextRequest) {
  const ctx = currentBrain(); if (!ctx) return NextResponse.json({ ok: false, error: tr('Sin cerebro.', 'No brain.') }, { status: 401 });
  const u = new URL(req.url); const q = (u.searchParams.get('q') || '').toLowerCase().trim(), brand = u.searchParams.get('brand'), kind = u.searchParams.get('kind');
  const all = listAssets();
  const assets = all.filter(a => (!brand || a.brand === brand) && (!kind || a.kind === kind) && (!q || `${a.id} ${a.brand} ${a.kind} ${a.label || ''}`.toLowerCase().includes(q)));
  const count = (k: 'brand' | 'kind') => Object.entries(all.reduce((m: Record<string, number>, a) => { m[a[k]] = (m[a[k]] || 0) + 1; return m; }, {})).sort((a, b) => b[1] - a[1]).map(([name, n]) => ({ name, n }));
  return NextResponse.json({ ok: true, total: all.length, assets, brands: count('brand'), kinds: count('kind') });
}
async function _POST(req: NextRequest) {
  const ctx = currentBrain(); if (!ctx) return NextResponse.json({ ok: false, error: tr('Sin cerebro.', 'No brain.') }, { status: 401 });
  if (ctx.readOnly || !canWriteFully()) return NextResponse.json({ ok: false, error: tr('No tienes permiso para cambiar imágenes.', 'You do not have permission to change images.') }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const who = ctx.actor?.startsWith('local-') ? getAccount(ctx.actor)?.name || ctx.actor : ctx.actor ? 'Agente' : 'Persona';
  try {
    if (b?.action === 'upload') return NextResponse.json({ ok: true, asset: saveAsset(b, who) });
    if (b?.action === 'assign' || b?.action === 'unassign') {
      const g = loadBrainGraph(); const id = String(b.nodeId || '').toLowerCase();
      const node = (g.allNodes || g.nodes).find(n => n.id.toLowerCase() === id);
      if (!node) return NextResponse.json({ ok: false, error: tr('No se encontró esa ficha.', 'That note was not found.') }, { status: 404 });
      const abs = path.resolve(node.filePath);
      if (!abs.startsWith(path.resolve(ctx.vaultPath) + path.sep)) return NextResponse.json({ ok: false, error: tr('Ficha fuera de la bóveda.', 'Note outside the vault.') }, { status: 400 });
      const asset = b.action === 'assign' ? findAsset(String(b.assetId || '')) : null;
      if (b.action === 'assign' && !asset) return NextResponse.json({ ok: false, error: tr('Esa imagen no está en la biblioteca.', 'That image is not in the library.') }, { status: 404 });
      ensureDailySnapshot(ctx.vaultPath);
      const upd = updateNoteFile(abs, (fm) => {
        if (asset) { fm.asset_id = asset.id; fm.avatar_image = asset.url; fm.asset_assigned_by = who; }
        else { if (fm.asset_id) delete fm.avatar_image; delete fm.asset_id; delete fm.asset_assigned_by; }
        fm.updated_at = new Date().toISOString();
      });
      if (!upd.ok) return NextResponse.json({ ok: false, error: upd.error }, { status: 409 });
      return NextResponse.json({ ok: true, nodeId: node.id, asset });
    }
    if (b?.action === 'localize') {
      const g = loadBrainGraph(); const root = path.resolve(ctx.vaultPath) + path.sep;
      const pending = (g.allNodes || g.nodes).filter(n => { const fm = n.frontmatter || {}; return !fm.avatar_image && isImportableUrl(fm.visual_photo_url || fm.visual_logo_url) && path.resolve(n.filePath).startsWith(root); });
      const limit = Math.max(1, Math.min(60, Number(b.limit) || 25));
      if (b.dryRun) return NextResponse.json({ ok: true, dryRun: true, pending: pending.length, sample: pending.slice(0, 5).map(n => ({ id: n.id, url: n.frontmatter.visual_photo_url || n.frontmatter.visual_logo_url })) });
      ensureDailySnapshot(ctx.vaultPath);
      const done: string[] = [], failed: { id: string; error: string }[] = [];
      for (const n of pending.slice(0, limit)) {
        const url = String(n.frontmatter.visual_photo_url || n.frontmatter.visual_logo_url);
        try {
          const buf = await fetchRemoteImage(url);
          const asset = saveAsset({ name: n.title, brand: brandOf(`${n.id} ${n.title}`) || 'otros', kind: n.frontmatter.visual_photo_url ? 'product' : 'logo', dataBase64: buf.toString('base64') }, who);
          const upd = updateNoteFile(path.resolve(n.filePath), (fm) => { fm.asset_id = asset.id; fm.avatar_image = asset.url; fm.asset_source_url = url; fm.asset_assigned_by = who; fm.updated_at = new Date().toISOString(); });
          if (upd.ok) done.push(n.id); else failed.push({ id: n.id, error: upd.error || tr('No se pudo escribir la ficha.', 'Could not write the note.') });
        } catch (e) { failed.push({ id: n.id, error: e instanceof AssetError ? e.message : 'Error inesperado.' }); }
      }
      return NextResponse.json({ ok: true, copied: done.length, failed, remaining: Math.max(0, pending.length - done.length) });
    }
    return NextResponse.json({ ok: false, error: tr("action debe ser 'assign', 'unassign', 'upload' o 'localize'.", 'action must be \'assign\', \'unassign\', \'upload\' or \'localize\'.') }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof AssetError ? e.message : tr('No se pudo guardar la imagen.', 'Could not save the image.') }, { status: e instanceof AssetError ? e.status : 500 });
  }
}
export const GET = withBrain(_GET);
export const POST = withBrain(_POST);
