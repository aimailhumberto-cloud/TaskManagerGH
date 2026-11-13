'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useUiLang } from '@/lib/uiLang';
import type { BrandAsset } from '@/lib/assetCatalog';

/** Botón «Imagen» de una ficha: abre la biblioteca para elegir, subir o quitar la imagen de la burbuja. */
export function AssetPicker({ nodeId, currentAssetId }: { nodeId: string; currentAssetId?: string }) {
  const { L } = useUiLang();
  const [open, setOpen] = useState(false);
  const [assets, setAssets] = useState<BrandAsset[]>([]);
  const [brands, setBrands] = useState<{ name: string; n: number }[]>([]);
  const [q, setQ] = useState(''); const [brand, setBrand] = useState('');
  const [picked, setPicked] = useState(currentAssetId || '');
  const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => fetch('/api/agent/assets').then(r => r.json()).then(d => { if (d?.ok) { setAssets(d.assets); setBrands(d.brands); } else setMsg(d?.error || L('No se pudo abrir la biblioteca.', 'Could not open the library.')); }).catch(() => setMsg(L('Sin conexión.', 'No connection.')));
  useEffect(() => { if (open && !assets.length) load(); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = useMemo(() => { const s = q.toLowerCase().trim(); return assets.filter(a => (!brand || a.brand === brand) && (!s || `${a.id} ${a.brand} ${a.kind} ${a.label || ''}`.toLowerCase().includes(s))).slice(0, 120); }, [assets, q, brand]);

  const post = async (body: Record<string, unknown>) => {
    setBusy(true); setMsg('');
    try { const r = await fetch('/api/agent/assets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const d = await r.json().catch(() => ({})); if (!r.ok || !d.ok) { setMsg(d?.error || L('No se pudo guardar.', 'Could not save.')); return null; } return d; }
    catch { setMsg(L('Sin conexión.', 'No connection.')); return null; } finally { setBusy(false); }
  };
  const assign = async (a: BrandAsset) => { const d = await post({ action: 'assign', nodeId, assetId: a.id }); if (d) { setPicked(a.id); setMsg(L('Imagen puesta. El mapa se actualiza en unos segundos.', 'Image set. The map updates in a few seconds.')); } };
  const unassign = async () => { const d = await post({ action: 'unassign', nodeId }); if (d) { setPicked(''); setMsg(L('Imagen quitada.', 'Image removed.')); } };
  // Fotos que hoy dependen de enlaces a la tienda en línea: se copian a la biblioteca por tandas.
  const [linked, setLinked] = useState<number | null>(null);
  useEffect(() => { if (!open) return; fetch('/api/agent/assets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'localize', dryRun: true }) }).then(r => (r.ok ? r.json() : null)).then(d => setLinked(d?.ok ? d.pending : null)).catch(() => {}); }, [open]);
  const localize = async () => {
    let left = linked || 0, copied = 0;
    while (left > 0) {
      const d = await post({ action: 'localize', limit: 20 }); if (!d) return;
      copied += d.copied; left = d.remaining; setLinked(left);
      setMsg(`${L('Copiadas', 'Copied')}: ${copied} · ${L('faltan', 'left')}: ${left}`);
      if (!d.copied) { setMsg(`${L('Copiadas', 'Copied')}: ${copied}. ${L('No se pudieron copiar', 'Could not copy')}: ${left}${d.failed?.[0]?.error ? ` (${d.failed[0].error})` : ''}`); return; }
    }
    setMsg(`${L('Listo. Fotos copiadas a la biblioteca', 'Done. Photos copied to the library')}: ${copied}`); load();
  };
  const upload = (file: File) => {
    if (file.size > 2 * 1024 * 1024) { setMsg(L('La imagen pasa de 2 MB.', 'The image is over 2 MB.')); return; }
    const fr = new FileReader();
    fr.onload = async () => { const d = await post({ action: 'upload', name: file.name.replace(/\.[^.]+$/, ''), brand: brand || undefined, dataBase64: String(fr.result) }); if (d?.asset) { setAssets(x => [d.asset, ...x.filter(y => y.id !== d.asset.id)]); await assign(d.asset); } };
    fr.readAsDataURL(file);
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="shrink-0 rounded-full border border-[#bcd0f5] bg-[#e8f1ff] px-2.5 py-1 text-[11px] font-semibold text-[#0a3fbf] hover:bg-white">{L('Imagen', 'Image')}</button>
      {open && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-[#0b1f4d]/55 p-0 sm:items-center sm:p-4" onClick={() => setOpen(false)}>
          <div role="dialog" aria-label={L('Biblioteca de imágenes', 'Image library')} onClick={e => e.stopPropagation()} className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-white text-[#0b1f4d] shadow-2xl sm:rounded-3xl" style={{ fontFamily: 'Poppins, system-ui, sans-serif' }}>
            <div className="flex items-center justify-between gap-3 bg-[#0a3fbf] px-5 py-4 text-white">
              <div><p className="text-base font-bold">{L('Biblioteca de imágenes', 'Image library')}</p><p className="text-xs text-[#dbeafe]">{assets.length ? `${assets.length} ${L('imágenes de marca', 'brand images')}` : L('Cargando…', 'Loading…')}</p></div>
              <button type="button" onClick={() => setOpen(false)} aria-label={L('Cerrar', 'Close')} className="rounded-full bg-white/15 px-3 py-1 text-sm hover:bg-white/25">✕</button>
            </div>
            <div className="space-y-2.5 border-b border-[#dbe4f3] px-5 py-3">
              <div className="flex gap-2">
                <input value={q} onChange={e => setQ(e.target.value)} placeholder={L('Buscar: chubby, logo, botella…', 'Search: chubby, logo, bottle…')} className="min-w-0 flex-1 rounded-xl border border-[#dbe4f3] bg-[#f2f6fd] px-3 py-2 text-sm outline-none focus:border-[#0a3fbf]" />
                <button type="button" disabled={busy} onClick={() => fileRef.current?.click()} className="shrink-0 rounded-xl bg-[#0a3fbf] px-3 py-2 text-sm font-semibold text-white hover:bg-[#08318f] disabled:opacity-60">{L('Subir', 'Upload')}</button>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} />
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {[{ name: '', n: assets.length }, ...brands].map(b => (
                  <button key={b.name || 'todas'} type="button" onClick={() => setBrand(b.name)} className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium capitalize ${brand === b.name ? 'bg-[#0b1f4d] text-white' : 'bg-[#eef3fb] text-[#0b1f4d] hover:bg-[#dbe4f3]'}`}>{b.name ? b.name.replace(/-/g, ' ') : L('Todas', 'All')} <span className="opacity-60">{b.n}</span></button>
                ))}
              </div>
              {msg && <p className="text-xs font-medium text-[#0a3fbf]" role="status">{msg}</p>}
            </div>
            <div className="grid min-h-0 flex-1 auto-rows-max grid-cols-3 content-start gap-2.5 overflow-y-auto p-5 sm:grid-cols-5">
              {shown.map(a => (
                <button key={a.id} type="button" disabled={busy} onClick={() => assign(a)} title={`${a.brand} · ${a.kind}`} className={`group overflow-hidden rounded-2xl border-2 bg-[#f2f6fd] text-left transition ${picked === a.id ? 'border-[#00a8f0] ring-2 ring-[#00a8f0]/40' : 'border-transparent hover:border-[#bcd0f5]'}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.thumb} alt={`${a.brand} ${a.kind}`} loading="lazy" className="block aspect-square h-auto w-full object-cover" />
                  <span className="block truncate px-2 py-1 text-[10px] capitalize text-slate-600">{a.brand.replace(/-/g, ' ')} · {a.kind}</span>
                </button>
              ))}
              {!shown.length && assets.length > 0 && <p className="col-span-full py-8 text-center text-sm text-slate-500">{L('Nada con ese filtro.', 'Nothing matches.')}</p>}
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-[#dbe4f3] px-5 py-3">
              {!!linked && <button type="button" disabled={busy} onClick={localize} title={L('Hoy dependen de enlaces a la tienda en línea; al copiarlas quedan guardadas aquí.', 'They depend on links to the online store today; copying keeps them here.')} className="text-xs font-medium text-[#0a3fbf] underline-offset-2 hover:underline disabled:opacity-40">{L('Copiar fotos de la tienda', 'Copy store photos')} ({linked})</button>}
              <button type="button" disabled={busy || !picked} onClick={unassign} className="text-xs font-medium text-rose-700 underline-offset-2 hover:underline disabled:opacity-40">{L('Quitar imagen', 'Remove image')}</button>
              <button type="button" onClick={() => setOpen(false)} className="rounded-xl bg-[#0b1f4d] px-4 py-2 text-sm font-semibold text-white">{L('Listo', 'Done')}</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
