// Dibujo de nodos en el lienzo: fotos, banderas, insignias y fondo.
import { autoAssetFor } from '@/lib/assetCatalog';
// Extraído de page.tsx sin cambios de comportamiento.
import type { NodeData } from './types';

// Brand Circular Avatars Cache
export const BRAND_AVATARS: Record<string, HTMLImageElement> = {};
if (typeof window !== 'undefined') {
  const brandFiles: Record<string, string> = {
    chubby: '/brands/chubby.png',
    busta: '/brands/busta.png',
    fruta: '/brands/fruta.png',
    oasis: '/brands/oasis.png',
    altitude: '/brands/altitude.png',
    smjaleel: '/brands/smjaleel_white.png',
    medimex: '/brands/medimex-logo.png',
  };
  Object.entries(brandFiles).forEach(([key, src]) => {
    const img = new Image();
    img.src = src;
    BRAND_AVATARS[key] = img;
  });
}

// Dynamic Node Photo Cache-Busting Helper (Deterministic & Cache-Safe)
export function getPhotoUrlWithBust(url?: string | null, updatedAt?: string | number): string | null {
  if (!url || typeof url !== 'string') return null;
  if (!updatedAt) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}v=${encodeURIComponent(updatedAt)}`;
}

// Universal Dynamic Node Photos Cache (Soporta fotos en CUALQUIER nodo con refresco reactivo)
export const DYNAMIC_NODE_PHOTOS: Record<string, HTMLImageElement> = {};
export function getNodeCustomPhoto(node: NodeData): HTMLImageElement | null {
  const fm = node.frontmatter || {};
  const photoSrc = fm.avatar_image || fm.photo_url || fm.visual_photo_url || fm.visual_logo_url || autoAssetFor(node)?.thumb;
  if (!photoSrc || typeof photoSrc !== 'string') return null;
  if (typeof window === 'undefined') return null;

  const bustKey = `${photoSrc}__${fm.updated_at || fm.updatedAt || ''}`;
  if (!DYNAMIC_NODE_PHOTOS[bustKey]) {
    const img = new Image();
    img.src = getPhotoUrlWithBust(photoSrc, fm.updated_at || fm.updatedAt) || photoSrc;
    DYNAMIC_NODE_PHOTOS[bustKey] = img;
  }
  const cached = DYNAMIC_NODE_PHOTOS[bustKey];
  if (cached && cached.complete && cached.naturalWidth > 0) return cached;
  return null;
}

// Vector graphics helper functions
export function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, spikes: number, outerRadius: number, innerRadius: number, color: string) {
  let rot = (Math.PI / 2) * 3;
  let x = cx;
  let y = cy;
  const step = Math.PI / spikes;
  ctx.beginPath();
  ctx.moveTo(cx, cy - outerRadius);
  for (let i = 0; i < spikes; i++) {
    x = cx + Math.cos(rot) * outerRadius;
    y = cy + Math.sin(rot) * outerRadius;
    ctx.lineTo(x, y);
    rot += step;
    x = cx + Math.cos(rot) * innerRadius;
    y = cy + Math.sin(rot) * innerRadius;
    ctx.lineTo(x, y);
    rot += step;
  }
  ctx.lineTo(cx, cy - outerRadius);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

export function drawMapleLeaf(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#D80621';
  ctx.beginPath();
  ctx.moveTo(0, -s);
  ctx.lineTo(s * 0.16, -s * 0.5);
  ctx.lineTo(s * 0.42, -s * 0.6);
  ctx.lineTo(s * 0.32, -s * 0.25);
  ctx.lineTo(s * 0.72, -s * 0.15);
  ctx.lineTo(s * 0.52, s * 0.15);
  ctx.lineTo(s * 0.66, s * 0.4);
  ctx.lineTo(s * 0.25, s * 0.35);
  ctx.lineTo(s * 0.08, s * 0.65);
  ctx.lineTo(s * 0.04, s * 0.88);
  ctx.lineTo(-s * 0.04, s * 0.88);
  ctx.lineTo(-s * 0.08, s * 0.65);
  ctx.lineTo(-s * 0.25, s * 0.35);
  ctx.lineTo(-s * 0.66, s * 0.4);
  ctx.lineTo(-s * 0.52, s * 0.15);
  ctx.lineTo(-s * 0.72, -s * 0.15);
  ctx.lineTo(-s * 0.32, -s * 0.25);
  ctx.lineTo(-s * 0.42, -s * 0.6);
  ctx.lineTo(-s * 0.16, -s * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawPanamaFlag(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(x - r, y - r, r, r);
  drawStar(ctx, x - r * 0.5, y - r * 0.5, 5, r * 0.24, r * 0.1, '#005293');

  ctx.fillStyle = '#DA121A';
  ctx.fillRect(x, y - r, r, r);

  ctx.fillStyle = '#005293';
  ctx.fillRect(x - r, y, r, r);

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(x, y, r, r);
  drawStar(ctx, x + r * 0.5, y + r * 0.5, 5, r * 0.24, r * 0.1, '#DA121A');

  ctx.restore();
}

export function drawCanadaFlag(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(x - r, y - r, r * 2, r * 2);

  ctx.fillStyle = '#D80621';
  ctx.fillRect(x - r, y - r, r * 0.55, r * 2);
  ctx.fillRect(x + r * 0.45, y - r, r * 0.55, r * 2);

  drawMapleLeaf(ctx, x, y, r * 0.52);

  ctx.restore();
}

export function drawUSAFlag(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();

  const stripeH = (r * 2) / 9;
  for (let i = 0; i < 9; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#B22234' : '#FFFFFF';
    ctx.fillRect(x - r, y - r + i * stripeH, r * 2, stripeH);
  }

  ctx.fillStyle = '#3C3B6E';
  ctx.fillRect(x - r, y - r, r * 1.05, stripeH * 5);

  ctx.fillStyle = '#FFFFFF';
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      ctx.beginPath();
      ctx.arc(x - r * 0.8 + col * r * 0.32, y - r * 0.75 + row * stripeH * 1.5, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

export function drawBelizeFlag(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();

  ctx.fillStyle = '#003F87';
  ctx.fillRect(x - r, y - r, r * 2, r * 2);

  ctx.fillStyle = '#CE1126';
  ctx.fillRect(x - r, y - r, r * 2, r * 0.35);
  ctx.fillRect(x - r, y + r * 0.65, r * 2, r * 0.35);

  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(x, y, r * 0.48, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#15803D';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.34, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#D97706';
  ctx.beginPath();
  ctx.arc(x, y, r * 0.16, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

export function drawTrinidadFlag(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();

  ctx.fillStyle = '#DA121A';
  ctx.fillRect(x - r, y - r, r * 2, r * 2);

  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = r * 0.58;
  ctx.beginPath();
  ctx.moveTo(x - r * 1.5, y - r * 1.5);
  ctx.lineTo(x + r * 1.5, y + r * 1.5);
  ctx.stroke();

  ctx.strokeStyle = '#000000';
  ctx.lineWidth = r * 0.40;
  ctx.beginPath();
  ctx.moveTo(x - r * 1.5, y - r * 1.5);
  ctx.lineTo(x + r * 1.5, y + r * 1.5);
  ctx.stroke();

  ctx.restore();
}

export function drawSMJCorporateCrest(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();

  // Royal Deep Navy Gradient
  const grad = ctx.createRadialGradient(x, y, r * 0.2, x, y, r);
  grad.addColorStop(0, '#1E293B');
  grad.addColorStop(0.7, '#0F172A');
  grad.addColorStop(1, '#020617');
  ctx.fillStyle = grad;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);

  // Gold Outer Border Ring
  ctx.strokeStyle = '#F59E0B';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(x, y, r - 3, 0, Math.PI * 2);
  ctx.stroke();

  // Monogram & Star
  ctx.fillStyle = '#FBBF24';
  ctx.font = `bold ${Math.round(r * 0.42)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SMJ', x, y - r * 0.08);

  ctx.font = `bold ${Math.round(r * 0.2)}px monospace`;
  ctx.fillStyle = '#94A3B8';
  ctx.fillText('1924', x, y + r * 0.4);

  ctx.restore();
}

export function drawPersonAvatar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, node: NodeData) {
  const fm = node.frontmatter || {};
  const isFemale = (fm.gender || '').toLowerCase() === 'female';

  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();

  const bgGrad = ctx.createLinearGradient(x, y - r, x, y + r);
  if (isFemale) {
    bgGrad.addColorStop(0, '#6D28D9');
    bgGrad.addColorStop(1, '#BE185D');
  } else {
    bgGrad.addColorStop(0, '#1E3A8A');
    bgGrad.addColorStop(1, '#0F172A');
  }
  ctx.fillStyle = bgGrad;
  ctx.fill();

  ctx.fillStyle = '#E2E8F0';
  ctx.beginPath();
  ctx.arc(x, y - r * 0.18, r * 0.32, 0, Math.PI * 2);
  ctx.fill();

  if (isFemale) {
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.arc(x, y - r * 0.28, r * 0.36, Math.PI, 0, false);
    ctx.lineTo(x + r * 0.38, y + r * 0.12);
    ctx.lineTo(x - r * 0.38, y + r * 0.12);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillStyle = '#1E293B';
    ctx.beginPath();
    ctx.arc(x, y - r * 0.26, r * 0.33, Math.PI * 0.85, Math.PI * 2.15, false);
    ctx.fill();
  }

  ctx.fillStyle = isFemale ? '#4C1D95' : '#0F172A';
  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.85, r * 0.68, r * 0.48, 0, 0, Math.PI * 2);
  ctx.fill();

  if (!isFemale) {
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(x - r * 0.16, y + r * 0.18);
    ctx.lineTo(x, y + r * 0.52);
    ctx.lineTo(x + r * 0.16, y + r * 0.18);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#EF4444';
    ctx.beginPath();
    ctx.moveTo(x - r * 0.07, y + r * 0.22);
    ctx.lineTo(x + r * 0.07, y + r * 0.22);
    ctx.lineTo(x + r * 0.09, y + r * 0.65);
    ctx.lineTo(x, y + r * 0.8);
    ctx.lineTo(x - r * 0.09, y + r * 0.65);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.strokeStyle = '#FDE047';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y + r * 0.2, r * 0.18, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();
  }

  ctx.restore();

  const first = fm.first_name || (node.title.replace('Person: ', '').split(' ')[0] || 'U');
  const last = fm.last_name || (node.title.replace('Person: ', '').split(' ')[1] || '');
  const initials = ((first[0] || '') + (last[0] || '')).toUpperCase();
  if (initials) {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
    ctx.beginPath();
    ctx.arc(x + r * 0.65, y + r * 0.55, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.font = 'bold 8px \"Inter\", system-ui, -apple-system, \"Segoe UI\", sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initials, x + r * 0.65, y + r * 0.55);
  }
}

export function drawDistributorBadge(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, node: NodeData) {
  const nid = node.id.toLowerCase();
  const medimexImg = BRAND_AVATARS['medimex'];
  if (nid.includes('medimex') && medimexImg && medimexImg.complete && medimexImg.naturalWidth > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    const aspect = medimexImg.naturalWidth / (medimexImg.naturalHeight || 1);
    const drawW = r * 1.75;
    const drawH = drawW / aspect;
    ctx.drawImage(medimexImg, x - drawW / 2, y - drawH / 2, drawW, drawH);
    ctx.restore();

    ctx.font = 'bold 8px \"Inter\", system-ui, -apple-system, \"Segoe UI\", sans-serif';
    ctx.fillStyle = '#5EEAD4';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('MEDIMEX', x, y + r * 0.55);
    return;
  }

  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();

  const grad = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
  grad.addColorStop(0, '#0F766E');
  grad.addColorStop(0.5, '#115E59');
  grad.addColorStop(1, '#042F2E');
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.strokeStyle = '#2DD4BF';
  ctx.lineWidth = 1.8;

  ctx.beginPath();
  ctx.moveTo(x, y - r * 0.45);
  ctx.lineTo(x + r * 0.42, y - r * 0.2);
  ctx.lineTo(x, y + r * 0.05);
  ctx.lineTo(x - r * 0.42, y - r * 0.2);
  ctx.closePath();
  ctx.fillStyle = 'rgba(45, 212, 191, 0.35)';
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x - r * 0.42, y - r * 0.2);
  ctx.lineTo(x, y + r * 0.05);
  ctx.lineTo(x, y + r * 0.52);
  ctx.lineTo(x - r * 0.42, y + r * 0.27);
  ctx.closePath();
  ctx.fillStyle = 'rgba(15, 118, 110, 0.7)';
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x, y + r * 0.05);
  ctx.lineTo(x + r * 0.42, y - r * 0.2);
  ctx.lineTo(x + r * 0.42, y + r * 0.27);
  ctx.lineTo(x, y + r * 0.52);
  ctx.closePath();
  ctx.fillStyle = 'rgba(20, 184, 166, 0.45)';
  ctx.fill();
  ctx.stroke();

  ctx.restore();

  ctx.font = 'bold 8px \"Inter\", system-ui, -apple-system, \"Segoe UI\", sans-serif';
  ctx.fillStyle = '#5EEAD4';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  let label = 'DIST';
  const fm = node.frontmatter || {};
  if (fm.short_name) label = String(fm.short_name).slice(0, 8);
  else if (fm.company_name) label = String(fm.company_name).split(' ')[0].slice(0, 8);
  else if (node.id.includes('medimex')) label = 'MEDIMEX';
  else if (node.id.includes('sancas')) label = 'SANCAS';
  else if (node.id.includes('morgan')) label = 'MW';
  else if (node.id.includes('walton')) label = 'W&P';
  else if (node.id.includes('panama')) label = 'MEDIMEX';
  else {
    const clean = node.title.replace(/^Distributor:\s*/i, '').replace(/^Distributor\s*-\s*/i, '').trim();
    label = clean.split(' ')[0].slice(0, 8).toUpperCase();
  }
  ctx.fillText(label, x, y + r * 0.55);
}

export function drawOrganizationBadge(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, node: NodeData) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();

  const grad = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
  grad.addColorStop(0, '#064E3B');
  grad.addColorStop(0.5, '#047857');
  grad.addColorStop(1, '#022C22');
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.strokeStyle = '#34D399';
  ctx.lineWidth = 1.8;

  // Draw corporate building / pillars icon
  ctx.beginPath();
  // Pediment triangle
  ctx.moveTo(x - r * 0.45, y - r * 0.1);
  ctx.lineTo(x, y - r * 0.45);
  ctx.lineTo(x + r * 0.45, y - r * 0.1);
  ctx.closePath();
  ctx.fillStyle = 'rgba(52, 211, 153, 0.45)';
  ctx.fill();
  ctx.stroke();

  // Columns
  [-0.3, -0.1, 0.1, 0.3].forEach(off => {
    ctx.fillRect(x + r * off - 1.5, y - r * 0.05, 3, r * 0.35);
  });

  // Base
  ctx.fillRect(x - r * 0.45, y + r * 0.32, r * 0.9, 3);

  ctx.restore();

  ctx.font = 'bold 8px \"Inter\", system-ui, -apple-system, \"Segoe UI\", sans-serif';
  ctx.fillStyle = '#6EE7B7';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  let label = 'FILIAL';
  const id = node.id.toLowerCase();
  if (id.includes('usa')) label = 'USA';
  else if (id.includes('guyana')) label = 'GUYANA';
  else if (id.includes('barbados')) label = 'BARBADOS';
  else if (id.includes('st-lucia')) label = 'ST.LUCIA';
  else if (id.includes('suriname')) label = 'SURINAME';
  else if (id.includes('sa-pty') || id.includes('south-africa')) label = 'SO.AFRICA';
  else if (id.includes('procurement')) label = 'PROCURE';
  ctx.fillText(label, x, y + r * 0.55);
}

export function drawBrandBadge(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, node: NodeData) {
  const id = node.id.toLowerCase();
  let imgKey = '';
  if (id.includes('chubby')) imgKey = 'chubby';
  else if (id.includes('busta')) imgKey = 'busta';
  else if (id.includes('fruta')) imgKey = 'fruta';
  else if (id.includes('oasis')) imgKey = 'oasis';
  else if (id.includes('altitude')) imgKey = 'altitude';

  const img = imgKey ? BRAND_AVATARS[imgKey] : null;
  if (img && img.complete && img.naturalWidth > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, x - r, y - r, r * 2, r * 2);
    ctx.restore();
    return;
  }

  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();

  if (id.includes('chubby')) {
    const grad = ctx.createRadialGradient(x, y, 2, x, y, r);
    grad.addColorStop(0, '#F59E0B');
    grad.addColorStop(1, '#DC2626');
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x - r * 0.16, y - r * 0.55, r * 0.32, r * 0.14);

    ctx.beginPath();
    ctx.moveTo(x - r * 0.16, y - r * 0.41);
    ctx.quadraticCurveTo(x - r * 0.44, y - r * 0.1, x - r * 0.38, y + r * 0.25);
    ctx.quadraticCurveTo(x - r * 0.35, y + r * 0.5, x, y + r * 0.52);
    ctx.quadraticCurveTo(x + r * 0.35, y + r * 0.5, x + r * 0.38, y + r * 0.25);
    ctx.quadraticCurveTo(x + r * 0.44, y - r * 0.1, x + r * 0.16, y - r * 0.41);
    ctx.closePath();
    ctx.fillStyle = '#FEF08A';
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.font = 'bold 7px sans-serif';
    ctx.fillStyle = '#DC2626';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('CHUBBY', x, y);
  } else if (id.includes('fruta')) {
    const grad = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
    grad.addColorStop(0, '#16A34A');
    grad.addColorStop(1, '#EA580C');
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.fillStyle = '#FEF08A';
    ctx.beginPath();
    ctx.arc(x, y + r * 0.05, r * 0.4, 0, Math.PI, false);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#22C55E';
    ctx.beginPath();
    ctx.ellipse(x + r * 0.12, y - r * 0.25, r * 0.22, r * 0.1, Math.PI / 4, 0, Math.PI * 2);
    ctx.fill();
  } else if (id.includes('busta')) {
    const grad = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
    grad.addColorStop(0, '#991B1B');
    grad.addColorStop(1, '#1E3A8A');
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.fillStyle = '#E2E8F0';
    ctx.fillRect(x - r * 0.28, y - r * 0.45, r * 0.56, r * 0.9);
    ctx.fillStyle = '#DC2626';
    ctx.fillRect(x - r * 0.28, y - r * 0.28, r * 0.56, r * 0.56);

    ctx.font = 'bold 8px sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('BUSTA', x, y);
  } else if (id.includes('oasis')) {
    const grad = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
    grad.addColorStop(0, '#0284C7');
    grad.addColorStop(1, '#0369A1');
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.fillStyle = '#E0F2FE';
    ctx.beginPath();
    ctx.moveTo(x, y - r * 0.48);
    ctx.quadraticCurveTo(x + r * 0.38, y + r * 0.1, x, y + r * 0.46);
    ctx.quadraticCurveTo(x - r * 0.38, y + r * 0.1, x, y - r * 0.48);
    ctx.fill();
  } else if (id.includes('altitude')) {
    const grad = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
    grad.addColorStop(0, '#0F172A');
    grad.addColorStop(1, '#06B6D4');
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.fillStyle = '#FDE047';
    ctx.beginPath();
    ctx.moveTo(x + r * 0.1, y - r * 0.5);
    ctx.lineTo(x - r * 0.25, y);
    ctx.lineTo(x + r * 0.05, y);
    ctx.lineTo(x - r * 0.1, y + r * 0.5);
    ctx.lineTo(x + r * 0.3, y - r * 0.05);
    ctx.lineTo(x, y - r * 0.05);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillStyle = '#C2410C';
    ctx.fill();
    ctx.font = `${Math.round(r * 0.8)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🧃', x, y);
  }

  ctx.restore();
}

export function drawGlassDomeOverlay(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  const glassGrad = ctx.createLinearGradient(x, y - r, x, y + r * 0.2);
  glassGrad.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
  glassGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.08)');
  glassGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');

  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();

  ctx.fillStyle = glassGrad;
  ctx.beginPath();
  ctx.ellipse(x, y - r * 0.35, r * 0.75, r * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

export function drawAmericasMapBackdrop(ctx: CanvasRenderingContext2D) {
  ctx.save();

  const mapGlow = ctx.createRadialGradient(-380, 0, 40, -380, 0, 320);
  mapGlow.addColorStop(0, 'rgba(14, 165, 233, 0.07)');
  mapGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = mapGlow;
  ctx.beginPath();
  ctx.arc(-380, 0, 320, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(233, 188, 110, 0.08)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);

  [-180, -75, 35, 145].forEach((latY) => {
    ctx.beginPath();
    ctx.moveTo(-560, latY);
    ctx.lineTo(-180, latY);
    ctx.stroke();
  });

  ctx.beginPath();
  ctx.moveTo(-440, -220);
  ctx.quadraticCurveTo(-420, 0, -400, 220);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle = 'rgba(233, 188, 110, 0.22)';
  ctx.fillStyle = 'rgba(14, 165, 233, 0.03)';
  ctx.lineWidth = 1.5;

  ctx.beginPath();
  ctx.moveTo(-520, -220);
  ctx.lineTo(-460, -230);
  ctx.quadraticCurveTo(-380, -240, -340, -180);
  ctx.lineTo(-320, -110);
  ctx.quadraticCurveTo(-310, -50, -330, -20);
  ctx.lineTo(-370, -10);
  ctx.lineTo(-440, 20);
  ctx.lineTo(-450, 40);
  ctx.quadraticCurveTo(-430, 90, -400, 125);
  ctx.quadraticCurveTo(-360, 145, -310, 140);
  ctx.arc(-300, 138, 3, 0, Math.PI * 2);
  ctx.quadraticCurveTo(-380, 165, -420, 130);
  ctx.lineTo(-470, 45);
  ctx.quadraticCurveTo(-490, -20, -460, -80);
  ctx.lineTo(-480, -150);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.font = 'bold 9px \"Inter\", system-ui, -apple-system, \"Segoe UI\", sans-serif';
  ctx.fillStyle = 'rgba(233, 188, 110, 0.35)';
  ctx.textAlign = 'center';
  ctx.fillText('AMÉRICA · RED CONTINENTAL DE EXPORTACIÓN', -380, -225);

  ctx.font = '8px \"Inter\", system-ui, -apple-system, \"Segoe UI\", sans-serif';
  ctx.fillStyle = 'rgba(148, 163, 184, 0.4)';
  ctx.fillText('CANADÁ [NORTE]', -460, -205);
  ctx.fillText('EE. UU. [CENTRAL]', -440, -100);
  ctx.fillText('BELICE [CARIBE]', -460, 65);
  ctx.fillText('PANAMÁ [HUB CA]', -440, 175);

  ctx.restore();
}
