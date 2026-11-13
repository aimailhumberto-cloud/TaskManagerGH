'use client';
import React, { useEffect, useRef, useState } from 'react';
import type { NodeData } from './types';
import { FAMILY, familyKeyOf, hiddenFamilies } from './bubbleArt';
import { useLang } from './i18n';

type Fam = keyof typeof FAMILY;
const LAYERS: { key: Fam; es: string; en: string }[] = [
  { key: 'org', es: 'Empresa', en: 'Company' }, { key: 'people', es: 'Personas', en: 'People' }, { key: 'market', es: 'Mercados', en: 'Markets' },
  { key: 'commercial', es: 'Comercial', en: 'Commercial' }, { key: 'portfolio', es: 'Portafolio', en: 'Portfolio' }, { key: 'work', es: 'Trabajo', en: 'Work' }, { key: 'memory', es: 'Memoria', en: 'Memory' },
];
const STORE = 'cerebro_capas_ocultas';

interface Props {
  nodesRef: React.MutableRefObject<NodeData[]>;
  transformRef: React.MutableRefObject<{ x: number; y: number; scale: number }>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

/** Filtro por capas (qué familias de fichas se ven) y minimapa con el recuadro de lo que hay en pantalla. */
export function CerebroLayers({ nodesRef, transformRef, canvasRef }: Props) {
  const { lang } = useLang();
  const [hidden, setHidden] = useState<Set<Fam>>(new Set());
  const [counts, setCounts] = useState<Record<string, number>>({});
  const hiddenRef = useRef(hidden); hiddenRef.current = hidden;
  const mini = useRef<HTMLCanvasElement>(null);
  const box = useRef<{ minX: number; minY: number; k: number; ox: number; oy: number } | null>(null);

  useEffect(() => { try { const x = JSON.parse(localStorage.getItem(STORE) || '[]'); if (Array.isArray(x)) setHidden(new Set(x)); } catch {} }, []);

  // Cada 200 ms: marca las fichas ocultas (también las recién llegadas) y repinta el minimapa.
  useEffect(() => {
    const W = 168, H = 116, dpr = Math.min(2, window.devicePixelRatio || 1);
    const tick = () => {
      const nodes = nodesRef.current, hid = hiddenRef.current, c: Record<string, number> = {};
      hiddenFamilies.clear(); hid.forEach(f => hiddenFamilies.add(f));
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const n of nodes) {
        const f = familyKeyOf(n.type); c[f] = (c[f] || 0) + 1;
        n.hiddenByFilter = hid.has(f);
        if (!Number.isFinite(n.x) || !Number.isFinite(n.y)) continue;
        if (n.x < minX) minX = n.x; if (n.x > maxX) maxX = n.x; if (n.y < minY) minY = n.y; if (n.y > maxY) maxY = n.y;
      }
      setCounts(prev => (LAYERS.every(l => (prev[l.key] || 0) === (c[l.key] || 0)) ? prev : c));
      const cv = mini.current, main = canvasRef.current; if (!cv || !main || !nodes.length || cv.offsetParent === null) return;
      if (cv.width !== W * dpr) { cv.width = W * dpr; cv.height = H * dpr; }
      const ctx = cv.getContext('2d'); if (!ctx) return;
      const pad = 8, k = Math.min((W - pad * 2) / Math.max(1, maxX - minX), (H - pad * 2) / Math.max(1, maxY - minY));
      const ox = (W - (maxX - minX) * k) / 2, oy = (H - (maxY - minY) * k) / 2;
      box.current = { minX, minY, k, ox, oy };
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      for (const n of nodes) { if (n.hiddenByFilter) continue; ctx.fillStyle = FAMILY[familyKeyOf(n.type)].ring; ctx.fillRect(ox + (n.x - minX) * k - 1, oy + (n.y - minY) * k - 1, 2, 2); }
      // Recuadro de lo que se ve en pantalla.
      const t = transformRef.current, vx = -t.x / t.scale, vy = -t.y / t.scale, vw = main.clientWidth / t.scale, vh = main.clientHeight / t.scale;
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.2; ctx.fillStyle = 'rgba(0, 168, 240, 0.16)';
      const rx = Math.max(1, ox + (vx - minX) * k), ry = Math.max(1, oy + (vy - minY) * k), rw = Math.min(W - 1 - rx, vw * k), rh = Math.min(H - 1 - ry, vh * k);
      if (rw > 2 && rh > 2) { ctx.fillRect(rx, ry, rw, rh); ctx.strokeRect(rx, ry, rw, rh); }
    };
    tick(); const id = setInterval(tick, 200); return () => clearInterval(id);
  }, [nodesRef, transformRef, canvasRef]);

  const toggle = (f: Fam) => setHidden(prev => { const n = new Set(prev); if (n.has(f)) n.delete(f); else n.add(f); try { localStorage.setItem(STORE, JSON.stringify([...n])); } catch {} return n; });
  // Clic en el minimapa: lleva la vista a ese punto.
  const jump = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const b = box.current, main = canvasRef.current; if (!b || !main) return;
    const r = e.currentTarget.getBoundingClientRect(), wx = b.minX + (e.clientX - r.left - b.ox) / b.k, wy = b.minY + (e.clientY - r.top - b.oy) / b.k, t = transformRef.current;
    t.x = main.clientWidth / 2 - wx * t.scale; t.y = main.clientHeight / 2 - wy * t.scale;
  };

  return (
    <>
      <div className="absolute left-3 right-3 top-3 z-20 flex gap-1.5 overflow-x-auto pb-1 md:left-auto md:right-4 md:top-4 md:max-w-[58%] md:flex-wrap md:justify-end" role="group" aria-label={lang === 'en' ? 'Layers' : 'Capas'}>
        {LAYERS.map(l => {
          const off = hidden.has(l.key);
          return (
            <button key={l.key} type="button" onClick={() => toggle(l.key)} aria-pressed={!off} title={lang === 'en' ? (off ? 'Show layer' : 'Hide layer') : off ? 'Mostrar capa' : 'Ocultar capa'}
              style={{ background: off ? 'rgba(7, 18, 48, 0.82)' : 'rgba(11, 31, 77, 0.92)', borderColor: off ? 'rgba(159, 220, 255, 0.18)' : FAMILY[l.key].ring, color: off ? '#7f93bd' : '#ffffff', opacity: off ? 0.75 : 1 }}
              className="flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium backdrop-blur">
              <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: off ? 'transparent' : FAMILY[l.key].ring, border: `1.5px solid ${FAMILY[l.key].ring}` }} />
              <span style={{ textDecoration: off ? 'line-through' : 'none' }}>{lang === 'en' ? l.en : l.es}</span>
              {(counts[l.key] || 0) > 0 && <span style={{ color: off ? '#7f93bd' : '#9fdcff' }}>{counts[l.key]}</span>}
            </button>
          );
        })}
      </div>
      <canvas ref={mini} onClick={jump} aria-label={lang === 'en' ? 'Minimap: click to move the view' : 'Minimapa: haz clic para mover la vista'} role="img"
        className="absolute bottom-16 right-4 z-20 hidden cursor-pointer rounded-xl border md:block" style={{ width: 168, height: 116, background: 'rgba(7, 18, 48, 0.88)', borderColor: 'rgba(159, 220, 255, 0.28)' }} />
    </>
  );
}
