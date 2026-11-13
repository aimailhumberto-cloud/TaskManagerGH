// Burbujas del Cerebro con la imagen de la empresa: color por familia, icono de línea por tipo,
// foto o logo dentro cuando existe, anillo de tipo, punto de estado y menos detalle al alejar.
import type { NodeData } from './types';
import { getNodeCustomPhoto } from './nodeArt';

/** Familias de color sobre el fondo azul marino. Cada tipo de ficha pertenece a una. */
export const FAMILY = {
  org: { fill: '#1d4fd8', ring: '#6f9bff' },        // empresa, departamentos, sitios
  people: { fill: '#0086c8', ring: '#4cc9ff' },     // personas y roles
  market: { fill: '#0d9488', ring: '#4fe0d0' },     // mercados y canales
  commercial: { fill: '#6d4fe0', ring: '#b3a2ff' }, // distribuidores y clientes
  portfolio: { fill: '#e8741a', ring: '#ffb066' },  // marcas y productos
  work: { fill: '#d6307a', ring: '#ff8cc0' },       // proyectos y rutinas
  memory: { fill: '#d99a00', ring: '#ffd75e' },     // memoria de trabajo
  neutral: { fill: '#475a85', ring: '#9db0d8' },
} as const;
type FamilyKey = keyof typeof FAMILY;
const TYPE_FAMILY: Record<string, FamilyKey> = {
  core: 'org', organization: 'org', department: 'org', site: 'org',
  person: 'people', role: 'people',
  market: 'market', channel: 'market',
  distributor: 'commercial', operator: 'commercial', customer: 'commercial', outlet: 'commercial', client: 'commercial', client_group: 'commercial',
  brand: 'portfolio', product_line: 'portfolio', flavor: 'portfolio', packaging: 'portfolio', product_variant: 'portfolio', catalog_listing: 'portfolio',
  project: 'work', routine: 'work',
  working_memory: 'memory',
  consolidation_session: 'neutral', community: 'market',
};
export const familyOf = (type: string) => FAMILY[TYPE_FAMILY[type] || 'neutral'];
/** Familias ocultas por el filtro de capas (lo mantiene CerebroLayers; lo lee el dibujo del fondo). */
export const hiddenFamilies = new Set<string>();
export const familyKeyOf = (type: string): keyof typeof FAMILY => TYPE_FAMILY[type] || 'neutral';

/** Iconos de línea (lienzo de 24×24, trazo redondeado). Uno por tipo; «file» para lo desconocido. */
export const ICON_PATHS: Record<string, string> = {
  person: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  building: 'M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18ZM6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2M10 6h4M10 10h4M10 14h4M10 18h4',
  briefcase: 'M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16M4 6h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z',
  globe: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z',
  truck: 'M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2M15 18H9M19 18h2a1 1 0 0 0 1-1v-3.6a1 1 0 0 0-.2-.6l-3.5-4.4a1 1 0 0 0-.8-.4H14M17 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM7 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  box: 'M21 8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7ZM3.3 7 12 12l8.7-5M12 22V12',
  cart: 'M2 2h2l2.7 12.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L22 6H6M9 22a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM19 22a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  tag: 'M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4zM7.5 8a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1z',
  landmark: 'M3 22h18M6 18v-7M10 18v-7M14 18v-7M18 18v-7M12 2l8 5H4z',
  bottle: 'M10 2h4v3l2 3v12a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V8l2-3zM8 12h8',
  repeat: 'M17 2l4 4-4 4M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v1a4 4 0 0 1-4 4H3',
  flag: 'M4 22V4M4 4s1-1 4-1 5 2 8 2 4-1 4-1v11s-1 1-4 1-5-2-8-2-4 1-4 1',
  bolt: 'M13 2 4 14h7l-1 8 9-12h-7z',
  layers: 'M12 2l10 5-10 5L2 7zM2 12l10 5 10-5M2 17l10 5 10-5',
  drop: 'M12 2.7s6 6 6 11a6 6 0 0 1-12 0c0-5 6-11 6-11z',
  pin: 'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0zM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  dot: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  route: 'M6 19a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM9 16h4a5 5 0 0 0 5-5',
  store: 'M3 9l1-5h16l1 5M4 9v11h16V9M9 20v-6h6v6M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0',
  file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h6',
};
export const TYPE_ICON: Record<string, string> = {
  core: 'landmark', organization: 'landmark', department: 'building', site: 'pin', person: 'person', role: 'briefcase',
  market: 'globe', channel: 'route', distributor: 'truck', operator: 'box', customer: 'cart', outlet: 'cart', client: 'cart', client_group: 'store',
  brand: 'bottle', product_line: 'bottle', flavor: 'drop', packaging: 'box', product_variant: 'tag', catalog_listing: 'tag',
  project: 'flag', routine: 'repeat', working_memory: 'bolt', consolidation_session: 'layers', community: 'dot',
};
const pathCache: Record<string, Path2D> = {};
function iconPath(name: string): Path2D { return (pathCache[name] ||= new Path2D(ICON_PATHS[name] || ICON_PATHS.file)); }

/** Icono blanco centrado en (x, y); `size` es el lado del cuadro en unidades del mapa. */
export function drawTypeIcon(ctx: CanvasRenderingContext2D, type: string, x: number, y: number, size: number, color = '#ffffff') {
  const k = size / 24;
  ctx.save();
  ctx.translate(x - size / 2, y - size / 2); ctx.scale(k, k);
  ctx.lineWidth = 1.9; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = color;
  ctx.stroke(iconPath(TYPE_ICON[type] || 'file'));
  ctx.restore();
}

/** Estado del dato de una ficha, con la misma regla que usa el tablero de Inicio. */
export function nodeStatus(n: NodeData): 'verified' | 'pending' | null {
  const fm = n.frontmatter || {};
  const v = String(fm.verification_status || '').toLowerCase(), st = String(fm.status || '').toLowerCase();
  if (v.includes('confirm') || v === 'verified' || st === 'verified') return 'verified';
  if (v.includes('pending') || v.includes('unverif') || st.includes('pending')) return 'pending';
  return null;
}
const STATUS_COLOR = { verified: '#2fd28a', pending: '#ffc233' };

function initials(n: NodeData): string {
  const name = String(n.title || '').replace(/^[A-Za-z ]+:\s+/, '').replace(/\(.*?\)/g, '').trim();
  const parts = name.split(/\s+/).filter(p => /^[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(p));
  return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '·';
}

/** Factor de tamaño por importancia: una ficha con muchas conexiones crece hasta un 35 %. */
export function importanceFactor(degree: number): number { return 1 + Math.min(0.35, Math.sqrt(Math.max(0, degree)) / 14); }

export interface BubbleState { r: number; scale: number; selected: boolean; hovered: boolean; open: boolean; working: boolean;
  /** Dibujo propio del interior (p. ej. una bandera) cuando la ficha no tiene foto. Devuelve true si dibujó. */
  inner?: () => boolean }

/**
 * Dibuja una burbuja. `scale` es el zoom de la cámara: con él se decide cuánto detalle vale la pena.
 * Devuelve false si solo se dibujó un punto (tan lejos que no cabe nada más) para que quien llama se salte la etiqueta.
 */
export function drawBubble(ctx: CanvasRenderingContext2D, n: NodeData, s: BubbleState): boolean {
  const fam = familyOf(n.type), { r } = s, px = r * s.scale, emphasized = s.selected || s.hovered;

  // Muy lejos: un punto del color de su familia. Miles de fichas caben así sin costo.
  if (px < 3 && !emphasized) {
    ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2); ctx.fillStyle = fam.ring; ctx.fill();
    return false;
  }

  // Halo: solo para lo que pide atención (seleccionada, bajo el cursor o memoria de trabajo).
  if (emphasized || s.working) {
    const halo = r + (s.selected ? 16 : s.hovered ? 12 : 7);
    const g = ctx.createRadialGradient(n.x, n.y, r * 0.6, n.x, n.y, halo);
    g.addColorStop(0, emphasized ? 'rgba(0, 168, 240, 0.55)' : 'rgba(255, 194, 51, 0.45)'); g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.beginPath(); ctx.arc(n.x, n.y, halo, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
  }

  // Disco base
  ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2); ctx.fillStyle = fam.fill; ctx.fill();

  // Interior: foto o logo si hay; si no, iniciales (personas) o icono del tipo. De lejos se omite.
  const detail = px >= 5.5 || emphasized;
  const photo = detail ? getNodeCustomPhoto(n) : null;
  if (photo) {
    ctx.save(); ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = '#ffffff'; ctx.fillRect(n.x - r, n.y - r, r * 2, r * 2);
    const aspect = photo.naturalWidth / (photo.naturalHeight || 1);
    // Un logo apaisado o muy alto se muestra entero sobre blanco; una foto llena el círculo.
    const whole = aspect > 1.3 || aspect < 0.77;
    const w = whole ? (aspect > 1 ? r * 1.62 : r * 1.62 * aspect) : aspect >= 1 ? r * 2 * aspect : r * 2;
    const h = whole ? (aspect > 1 ? (r * 1.62) / aspect : r * 1.62) : aspect >= 1 ? r * 2 : (r * 2) / aspect;
    ctx.drawImage(photo, n.x - w / 2, n.y - h / 2, w, h);
    ctx.restore();
  } else if (detail && !(s.inner && s.inner())) {
    if (n.type === 'person') {
      ctx.font = `600 ${Math.round(r * 0.78)}px Poppins, system-ui, -apple-system, "Segoe UI", sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffffff';
      ctx.fillText(initials(n), n.x, n.y + r * 0.04);
    } else drawTypeIcon(ctx, n.type, n.x, n.y, r * 1.1);
  }

  // Anillo: color de la familia; celeste cuando está seleccionada o bajo el cursor.
  ctx.lineWidth = s.selected ? 3 : s.hovered ? 2.6 : photo ? 2.2 : 1.6;
  ctx.strokeStyle = emphasized ? '#00a8f0' : fam.ring;
  ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2); ctx.stroke();

  // Nivel abierto: anillo fino exterior.
  if (s.open) { ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(159, 220, 255, 0.9)'; ctx.beginPath(); ctx.arc(n.x, n.y, r + 6, 0, Math.PI * 2); ctx.stroke(); }

  // Fijada: aro punteado y chincheta arriba a la derecha.
  if (n.isPinned) {
    ctx.save(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(159, 220, 255, 0.75)'; ctx.setLineDash([2, 4]);
    ctx.beginPath(); ctx.arc(n.x, n.y, r + 5, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    ctx.beginPath(); ctx.arc(n.x + r * 0.72, n.y - r * 0.72, 4, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill();
    ctx.beginPath(); ctx.arc(n.x + r * 0.72, n.y - r * 0.72, 2.2, 0, Math.PI * 2); ctx.fillStyle = '#0a3fbf'; ctx.fill();
  }

  // Punto de estado abajo a la derecha: verde = verificado, ámbar = pendiente.
  const st = px >= 9 ? nodeStatus(n) : null;
  if (st) {
    const sx = n.x + r * 0.72, sy = n.y + r * 0.72, sr = Math.max(3.2, r * 0.2);
    ctx.beginPath(); ctx.arc(sx, sy, sr + 1.6, 0, Math.PI * 2); ctx.fillStyle = '#071230'; ctx.fill();
    ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fillStyle = STATUS_COLOR[st]; ctx.fill();
  }
  return true;
}
