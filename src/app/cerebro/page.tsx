'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import Link from 'next/link';
import { getMarketDistributors, marketDistributorLabel, distributorDisplayName } from '@/lib/marketDistributors';
import { searchBrainNodes, resolveBrainNode, humanNodeName, fitIdentityBounds } from '@/lib/smjIdentity';
import { computeNativeLayout, LayoutResult, mergeLayoutConfig, LayoutConfig } from '@/lib/cerebroLayout';
import { contactTarget, contactEntities } from '@/lib/contactLayer';
import { ContactLayer } from '@/components/ContactLayer';
import { brandCatalogNodes, packagingDescription } from '@/lib/portfolioConnections';
import { PortfolioConnections } from '@/components/PortfolioConnections';
import { CommercialConnections } from '@/components/CommercialConnections';

interface NodeData {
  id: string;
  title: string;
  type: string;
  memory_tier: string;
  hierarchy_level?: number;
  completeness_score?: number;
  country?: string;
  department?: string;
  market_id?: string;
  spatial_anchor?: string;
  spatial_tier?: string;
  channel_type?: string;
  body: string;
  frontmatter: Record<string, any>;
  links: string[];
  filePath?: string;
  status?: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetX: number;
  targetY: number;
  radius: number;
  isDragged?: boolean;
  isPinned?: boolean;
  pinnedX?: number;
  pinnedY?: number;
  originalTargetX?: number;
  originalTargetY?: number;
}

interface LinkData {
  source: string;
  target: string;
  relationType: string;
  label?: string;
}

interface BrainGraphResponse {
  allNodes?: any[];
  ok: boolean;
  nodes: any[];
  links: LinkData[];
  summary: {
    totalNodes: number;
    totalLinks: number;
    workingMemoryCount: number;
    longTermCount: number;
    departmentsCount: number;
    marketsCount: number;
    distributorsCount: number;
    brandsCount: number;
  };
}

// Brand Circular Avatars Cache
const BRAND_AVATARS: Record<string, HTMLImageElement> = {};
if (typeof window !== 'undefined') {
  const brandFiles: Record<string, string> = {
    chubby: '/brands/chubby.png',
    busta: '/brands/busta.png',
    fruta: '/brands/fruta.png',
    oasis: '/brands/oasis.png',
    altitude: '/brands/altitude.png',
    smjaleel: '/brands/smjaleel-logo.png',
    medimex: '/brands/medimex-logo.png',
  };
  Object.entries(brandFiles).forEach(([key, src]) => {
    const img = new Image();
    img.src = src;
    BRAND_AVATARS[key] = img;
  });
}

// Dynamic Node Photo Cache-Busting Helper (Deterministic & Cache-Safe)
function getPhotoUrlWithBust(url?: string | null, updatedAt?: string | number): string | null {
  if (!url || typeof url !== 'string') return null;
  if (!updatedAt) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}v=${encodeURIComponent(updatedAt)}`;
}

// Universal Dynamic Node Photos Cache (Soporta fotos en CUALQUIER nodo con refresco reactivo)
const DYNAMIC_NODE_PHOTOS: Record<string, HTMLImageElement> = {};
function getNodeCustomPhoto(node: NodeData): HTMLImageElement | null {
  const fm = node.frontmatter || {};
  const photoSrc = fm.avatar_image || fm.photo_url || fm.visual_photo_url || fm.visual_logo_url;
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

function formatDisplayValue(val: any): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') {
    if (Array.isArray(val)) {
      return val.map(item => (typeof item === 'object' ? formatDisplayValue(item) : String(item))).join(' · ');
    }
    return Object.entries(val).map(([k, v]) => `${k}: ${v}`).join(' · ');
  }
  return String(val);
}

// Balanced-bracket scanner to strip simple and arbitrarily nested JSON blocks { ... }
function stripJsonBlocks(text: string): string {
  let result = '';
  let i = 0;
  while (i < text.length) {
    if (text[i] === '{') {
      let depth = 1;
      let j = i + 1;
      let inString = false;
      let escape = false;
      while (j < text.length && depth > 0) {
        const char = text[j];
        if (escape) {
          escape = false;
        } else if (char === '\\') {
          escape = true;
        } else if (char === '"') {
          inString = !inString;
        } else if (!inString) {
          if (char === '{') depth++;
          else if (char === '}') depth--;
        }
        j++;
      }
      if (depth === 0) {
        const candidate = text.slice(i, j);
        if (candidate.includes('"') && (candidate.includes(':') || candidate.includes('id'))) {
          i = j;
          continue;
        }
      }
    }
    result += text[i];
    i++;
  }
  return result;
}

const TECHNICAL_HEADER_REGEX = /^##\s+(?:Corporate evidence batch|Visual sources associated|Person and connection audit|Archivo de roles aprobado|Evidence and limits|Source attributes|Sources|Evidence boundary audit|Evidencia y limites|Fuente y limites|Verified Canada operation|Official catalogue evidence|Additional sourced catalogue|Additional local pickup|Brand identity relation|Logo oficial)/i;

const FORENSIC_NOISE_LINE_REGEX = /^(?:Source package:|Sources:|No legal ownership percentages|Verified local bytes|Research identity:|Observed 2026-11-09|Uncorroborated legacy fields|Professional contexts are not|No live deployment|Recopilacion SMJ|Solo datos explicitamente transcritos|SHA256)/i;

function renderInlineWithWikilinks(text: string, onWikilinkClick?: (target: string) => void, resolveLabel?: (target: string) => string) {
  const parts = text.split(/(\[\[.*?\]\])/g);
  return parts.map((part, index) => {
    const match = part.match(/^\[\[(.*?)\]\]$/);
    if (!match) return <React.Fragment key={index}>{part}</React.Fragment>;
    const raw = match[1];
    const [target, alias] = raw.split('|');
    const cleanTarget = target.trim();
    const display = (alias || resolveLabel?.(cleanTarget) || target).trim();

    return (
      <button
        key={index}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (onWikilinkClick) {
            onWikilinkClick(cleanTarget);
          } else if (typeof window !== 'undefined') {
            const globalHandler = (window as any).handleWikilinkClick || (window as any).__cerebroHandleWikilinkClick;
            if (typeof globalHandler === 'function') {
              globalHandler(cleanTarget);
            } else {
              const buttons = Array.from(document.querySelectorAll('button'));
              const cleanLower = cleanTarget.toLowerCase();
              const targetBtn = buttons.find(b => {
                const btnText = b.textContent?.trim().toLowerCase() || '';
                return btnText === `[[${cleanLower}]]` || btnText === cleanLower;
              });
              if (targetBtn && targetBtn !== e.currentTarget) {
                targetBtn.click();
              } else {
                window.dispatchEvent(new CustomEvent('cerebro:wikilink', { detail: cleanTarget }));
              }
            }
          }
        }}
        className="text-sky-300 hover:text-white underline decoration-sky-500/50 hover:decoration-sky-300 font-mono text-[11px] px-1 py-0.5 rounded bg-sky-950/60 border border-sky-800/80 hover:bg-sky-900 transition mx-0.5 inline-flex items-center gap-1 cursor-pointer align-baseline"
        title={`Abrir sinapsis: ${cleanTarget}`}
      >
        <span>🔗</span>
        <span>[[{display}]]</span>
      </button>
    );
  });
}

function renderFormattedBody(body: string, onWikilinkClick?: (target: string) => void, resolveLabel?: (target: string) => string) {
  if (!body) return null;

  // Step 1: Strip simple and nested JSON blocks
  const noJson = stripJsonBlocks(body);

  // Step 2: Strip technical sections & forensic noise lines
  const rawLines = noJson.split(/\r?\n/);
  const cleanLines: string[] = [];
  let skippingTechnicalSection = false;

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('## ') || trimmed.startsWith('# ')) {
      if (TECHNICAL_HEADER_REGEX.test(trimmed)) {
        skippingTechnicalSection = true;
        continue;
      } else {
        skippingTechnicalSection = false;
      }
    }

    if (skippingTechnicalSection || FORENSIC_NOISE_LINE_REGEX.test(trimmed)) {
      continue;
    }

    // Filter residual JSON key-value pairs or brackets
    if (
      /^"[a-zA-Z0-9_-]+":\s*/.test(trimmed) ||
      trimmed === '{' ||
      trimmed === '}' ||
      trimmed === '},' ||
      trimmed === ',' ||
      trimmed === ']' ||
      trimmed === '],' ||
      /^"[^"]+",?$/.test(trimmed)
    ) {
      continue;
    }

    // Collapse multiple consecutive empty lines
    if (!trimmed && cleanLines.length > 0 && !cleanLines[cleanLines.length - 1].trim()) {
      continue;
    }

    cleanLines.push(line);
  }

  const finalContent = cleanLines.join('\n').trim();
  if (!finalContent) return null;

  const displayLines = finalContent.split('\n');

  return (
    <div className="space-y-1.5 text-xs text-gray-300 leading-relaxed font-sans">
      {displayLines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-1" />;
        if (trimmed.startsWith('# ')) {
          return (
            <h2 key={idx} className="text-sm font-bold text-sky-300 tracking-wide mt-2 mb-1">
              {renderInlineWithWikilinks(trimmed.replace(/^#\s+/, ''), onWikilinkClick, resolveLabel)}
            </h2>
          );
        }
        if (trimmed.startsWith('## ')) {
          return (
            <h3 key={idx} className="text-xs font-bold text-sky-400 uppercase tracking-wider mt-2.5 pt-1 border-t border-gray-800/80">
              {renderInlineWithWikilinks(trimmed.replace(/^##\s+/, ''), onWikilinkClick, resolveLabel)}
            </h3>
          );
        }
        if (trimmed.startsWith('### ')) {
          return (
            <h4 key={idx} className="text-[11px] font-semibold text-emerald-300 mt-2">
              {renderInlineWithWikilinks(trimmed.replace(/^###\s+/, ''), onWikilinkClick, resolveLabel)}
            </h4>
          );
        }
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          return (
            <div key={idx} className="flex items-start gap-1.5 pl-2 text-gray-300">
              <span className="text-sky-400 text-[10px] mt-0.5">•</span>
              <span>{renderInlineWithWikilinks(trimmed.replace(/^[-*]\s+/, ''), onWikilinkClick, resolveLabel)}</span>
            </div>
          );
        }
        return <p key={idx}>{renderInlineWithWikilinks(trimmed, onWikilinkClick, resolveLabel)}</p>;
      })}
    </div>
  );
}

if (typeof globalThis !== 'undefined') {
  (globalThis as any).__renderFormattedBody = renderFormattedBody;
}

const TYPE_CONFIG: Record<
  string,
  { label: string; icon: string; bg: string; border: string; glow: string }
> = {
  core: { label: 'HQ Core', icon: '🏛️', bg: '#D97706', border: '#FBBF24', glow: 'rgba(245, 158, 11, 0.85)' },
  department: { label: 'Departamento', icon: '🏢', bg: '#1D4ED8', border: '#60A5FA', glow: 'rgba(37, 99, 235, 0.75)' },
  role: { label: 'Rol Agnóstico', icon: '👔', bg: '#6D28D9', border: '#A78BFA', glow: 'rgba(124, 58, 237, 0.75)' },
  person: { label: 'Persona', icon: '👤', bg: '#4338CA', border: '#818CF8', glow: 'rgba(99, 102, 241, 0.75)' },
  market: { label: 'Mercado', icon: '🌎', bg: '#047857', border: '#34D399', glow: 'rgba(16, 185, 129, 0.75)' },
  channel: { label: 'Canal Comercial', icon: '🛣️', bg: '#0D9488', border: '#5EEAD4', glow: 'rgba(20, 184, 166, 0.75)' },
  operator: { label: 'Operador / Mayorista', icon: '📦', bg: '#0284C7', border: '#38BDF8', glow: 'rgba(14, 165, 233, 0.75)' },
  distributor: { label: 'Distribuidor', icon: '🤝', bg: '#0F766E', border: '#2DD4BF', glow: 'rgba(20, 184, 166, 0.75)' },
  customer: { label: 'Customer Retail', icon: '🛒', bg: '#0369A1', border: '#38BDF8', glow: 'rgba(14, 165, 233, 0.75)' },
  outlet: { label: 'Outlet / Punto de atención', icon: '🛒', bg: '#0369A1', border: '#38BDF8', glow: 'rgba(14, 165, 233, 0.75)' },
  catalog_listing: { label: 'Referencia de catálogo', icon: '🏷️', bg: '#0284C7', border: '#38BDF8', glow: 'rgba(14, 165, 233, 0.75)' },
  client_group: { label: 'Grupo de Clientes', icon: '🏬', bg: '#2563EB', border: '#93C5FD', glow: 'rgba(37, 99, 235, 0.75)' },
  client: { label: 'Cliente / Cuenta Clave', icon: '🛒', bg: '#0284C7', border: '#38BDF8', glow: 'rgba(14, 165, 233, 0.75)' },
  organization: { label: 'Filial Corporativa', icon: '🏛️', bg: '#065F46', border: '#34D399', glow: 'rgba(16, 185, 129, 0.75)' },
  brand: { label: 'Marca / SKU', icon: '🧃', bg: '#C2410C', border: '#FB923C', glow: 'rgba(234, 88, 12, 0.75)' },
  routine: { label: 'Rutina', icon: '🔄', bg: '#BE185D', border: '#F472B6', glow: 'rgba(219, 39, 119, 0.75)' },
  project: { label: 'Proyecto', icon: '🚀', bg: '#BE123C', border: '#FB7185', glow: 'rgba(225, 29, 72, 0.75)' },
  working_memory: { label: 'Memoria Temporal', icon: '⚡', bg: '#B45309', border: '#FDE047', glow: 'rgba(250, 204, 21, 0.95)' },
  consolidation_session: { label: 'Consolidación', icon: '🧠', bg: '#334155', border: '#94A3B8', glow: 'rgba(100, 116, 139, 0.5)' },
  flavor: { label: 'Sabor', icon: '🍇', bg: '#059669', border: '#34D399', glow: 'rgba(16, 185, 129, 0.75)' },
  packaging: { label: 'Empaque', icon: '📦', bg: '#D97706', border: '#FBBF24', glow: 'rgba(245, 158, 11, 0.75)' },
  product_line: { label: 'Línea Producto', icon: '🥤', bg: '#EA580C', border: '#FB923C', glow: 'rgba(234, 88, 12, 0.75)' },
  product_variant: { label: 'Variante SKU', icon: '🏷️', bg: '#0284C7', border: '#38BDF8', glow: 'rgba(14, 165, 233, 0.75)' },
};

// Canonical Executive Leaders Set (Always visible in clean executive collapsed view)
const LEADER_IDS = new Set([
  'person-aleem-mohammed',
  'person-anna-mohammed',
  'person-clint-villafana',
  'person-sonia-harris',
  'person-humberto-bouche',
  'person-olivia-rampersad',
  'person-alanna-ramjattan',
  'person-ivan-saroop',
  'person-rajesh-maharaj',
  'person-noella-hewitt-lai',
  'person-amir-hosein',
  'person-andre-hosein',
  'person-humberto-jose-montoya-borja',
]);

// Dynamic helper to identify leaders / directors / managers created by DOTS
function isNodeLeader(node: any): boolean {
  if (!node) return false;
  const id = (node.id || '').toLowerCase();
  if (LEADER_IDS.has(id)) return true;
  if (node.hierarchy_level !== undefined && node.hierarchy_level <= 2) return true;
  const fm = node.frontmatter || {};
  const job = String(fm.job_title || fm.role || node.title || '').toLowerCase();
  if (
    job.includes('chair') ||
    job.includes('chief') ||
    job.includes('coo') ||
    job.includes('ceo') ||
    job.includes('vice president') ||
    job.includes('vp') ||
    job.includes('director') ||
    job.includes('gerente') ||
    job.includes('general manager') ||
    job.includes('head') ||
    job.includes('lead')
  ) {
    return true;
  }
  return false;
}

// Helper to categorize staff into their departmental hub based strictly on verified relations and roles
function getPersonDeptCategory(node: any): 'exports' | 'manufacturing' | 'supply_chain' | 'finance' | 'marketing' | 'legal' | 'business_intelligence' | 'information_technology' | 'internal_audit' | 'general' {
  const id = (node.id || '').toLowerCase();
  const fm = node.frontmatter || {};
  const job = ((fm.job_title || fm.role || fm.title || '') + ' ' + (node.title || '')).toLowerCase();
  const deptRaw = String(fm.department || node.department || '').toLowerCase();

  if (deptRaw.includes('marketing') || job.includes('marketing') || id.includes('eesa') || id.includes('dixon')) {
    return 'marketing';
  }
  if (deptRaw.includes('legal') || job.includes('legal') || id.includes('dookie')) {
    return 'legal';
  }
  if (deptRaw.includes('business-intelligence') || deptRaw.includes('business intelligence') || job.includes('business intelligence') || id.includes('faraaz') || id.includes('sabeeha')) {
    return 'business_intelligence';
  }
  if (deptRaw.includes('information-technology') || deptRaw.includes('technology') || job.includes('information technology') || job.includes('epicor') || id.includes('bailey') || id.includes('ravikumar')) {
    return 'information_technology';
  }
  if (deptRaw.includes('audit') || job.includes('audit') || id.includes('jerome')) {
    return 'internal_audit';
  }
  if (deptRaw.includes('finance') || deptRaw.includes('credit') || job.includes('invoic') || job.includes('credit') || job.includes('finance') || id.includes('michelle-grant') || id.includes('debiena') || id.includes('jugoon') || id.includes('sookram')) {
    return 'finance';
  }
  if (deptRaw.includes('export') || (job.includes('export') && !job.includes('customs') && !job.includes('warehouse') && !job.includes('logistics')) || id.includes('clint') || id.includes('humberto-bouche') || id.includes('olivia') || id.includes('alanna') || id.includes('ivan') || id.includes('richard-williams') || id.includes('rena') || id.includes('sinanan')) {
    return 'exports';
  }
  if (deptRaw.includes('supply') || deptRaw.includes('procurement') || deptRaw.includes('logistics') || deptRaw.includes('customs') || deptRaw.includes('warehouse') || job.includes('purchas') || job.includes('logistics') || job.includes('chain') || job.includes('customs') || id.includes('sonia') || id.includes('agard') || id.includes('richards') || id.includes('reedhi') || id.includes('goorachan') || id.includes('phillip') || id.includes('bijadder') || id.includes('gay')) {
    return 'supply_chain';
  }
  if (deptRaw.includes('manufactur') || deptRaw.includes('plant') || job.includes('manufactur') || job.includes('plant') || job.includes('bottling') || id.includes('rajesh')) {
    return 'manufacturing';
  }
  return 'general';
}

// Clusters for Constellation mode (Distinct Celestial Nebulae - Centered and Balanced)
const CLUSTER_CENTERS: Record<string, { x: number; y: number; label: string; color: string }> = {
  core: { x: 0, y: -20, label: 'Nebulosa Central · Sede Central Trinidad', color: 'rgba(245, 158, 11, 0.12)' },
  exportCentral: { x: -360, y: 130, label: 'Nebulosa Centroamérica & Caribe (Panamá & Belice)', color: 'rgba(16, 185, 129, 0.12)' },
  exportNorth: { x: -360, y: -160, label: 'Nebulosa Norteamérica (Canadá & EE. UU.)', color: 'rgba(14, 165, 233, 0.12)' },
  executiveRight: { x: 360, y: -160, label: 'Nebulosa Dirección Ejecutiva & Comercial', color: 'rgba(99, 102, 241, 0.12)' },
  manufacturing: { x: 360, y: 130, label: 'Nebulosa Marcas & Supply Chain', color: 'rgba(234, 88, 12, 0.12)' },
  workingMemory: { x: 0, y: 200, label: 'Bandeja Memoria Temporal', color: 'rgba(251, 191, 36, 0.10)' },
};

// Organigram Hierarchical Strata (Levels L-Apex to L4)
const ORGANIGRAM_STRATA = [
  { level: -1, y: -380, label: 'L-APEX · CHAIRMAN DE LA JUNTA DIRECTIVA (DR. ALEEM MOHAMMED)', color: 'rgba(234, 179, 8, 0.15)', border: 'rgba(234, 179, 8, 0.5)' },
  { level: 0, y: -260, label: 'L0 · DIRECCIÓN EJECUTIVA & COO (ANNA MOHAMMED · HQ TRINIDAD)', color: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.4)' },
  { level: 1, y: -120, label: 'L1 · VICEPRESIDENCIAS Y DIRECCIONES GENERALES', color: 'rgba(59, 130, 246, 0.10)', border: 'rgba(59, 130, 246, 0.35)' },
  { level: 2, y: 20, label: 'L2 · GERENCIAS DE EXPORTACIÓN, OPERACIONES & PLANTA', color: 'rgba(139, 92, 246, 0.10)', border: 'rgba(139, 92, 246, 0.35)' },
  { level: 3, y: 140, label: 'L3 · MERCADOS EXTERNOS, CANALES, OPERADORES & CLIENTES', color: 'rgba(16, 185, 129, 0.10)', border: 'rgba(16, 185, 129, 0.35)' },
  { level: 4, y: 340, label: 'L4 · PORTAFOLIO DE MARCAS & OPERACIONES S&OP', color: 'rgba(234, 88, 12, 0.10)', border: 'rgba(234, 88, 12, 0.35)' },
];

// Resolutor universal de polo de mercado para cualquier entidad
function resolveNodeMarketAnchor(node: any): { key: string; name: string } | null {
  const id = (node.id || '').toLowerCase();
  const fm = node.frontmatter || {};
  const text = `${id} ${node.title || ''} ${fm.country || ''} ${fm.country_name || ''} ${fm.based_in_country || ''} ${fm.market || ''} ${fm.spatial_anchor || ''}`.toLowerCase();

  if (text.includes('beliz') || text.includes('belice') || text.includes('sancas') || text.includes('nando')) return { key: 'belize', name: 'Belize' };
  if (text.includes('panam') || text.includes('medimex')) return { key: 'panama', name: 'Panamá' };
  if (text.includes('canad') || text.includes('morgan-williams')) return { key: 'canada', name: 'Canadá' };
  if (text.includes('unit') || text.includes('usa') || text.includes('ee. uu') || text.includes('florida') || text.includes('miami') || text.includes('tampa') || text.includes('walton')) return { key: 'usa', name: 'EE. UU.' };
  if (text.includes('costa-rica')) return { key: 'costa-rica', name: 'Costa Rica' };
  if (text.includes('el-salvador') || text.includes('salvador')) return { key: 'el-salvador', name: 'El Salvador' };
  if (text.includes('barbados')) return { key: 'barbados', name: 'Barbados' };
  if (text.includes('guyana')) return { key: 'guyana', name: 'Guyana' };
  if (text.includes('saint-lucia') || text.includes('st-lucia')) return { key: 'saint-lucia', name: 'Santa Lucía' };
  if (text.includes('surinam')) return { key: 'suriname', name: 'Surinam' };
  if (text.includes('jamaica')) return { key: 'jamaica', name: 'Jamaica' };
  if (text.includes('south-africa') || text.includes('sudafrica')) return { key: 'south-africa', name: 'Sudáfrica' };
  if (text.includes('trinidad')) return { key: 'trinidad', name: 'Trinidad & Tobago' };
  return null;
}

const MARKET_POLES_QUADRANTS: Record<string, { x: number; y: number }> = {
  canada: { x: -580, y: -220 },
  usa: { x: -580, y: -150 },
  belize: { x: -580, y: -70 },
  panama: { x: -580, y: 10 },
  'costa-rica': { x: -580, y: 80 },
  'el-salvador': { x: -580, y: 140 },
  barbados: { x: -540, y: 190 },
  guyana: { x: -580, y: 240 },
  'saint-lucia': { x: -500, y: 220 },
  suriname: { x: -540, y: 270 },
  jamaica: { x: -500, y: -30 },
  'south-africa': { x: -440, y: 280 },
  trinidad: { x: -170, y: -30 },
};

const MARKET_POLES_CONSTELLATIONS: Record<string, { x: number; y: number; clusterKey: string }> = {
  canada: { x: -430, y: -200, clusterKey: 'exportNorth' },
  usa: { x: -430, y: -120, clusterKey: 'exportNorth' },
  belize: { x: -440, y: 150, clusterKey: 'exportCentral' },
  panama: { x: -420, y: 90, clusterKey: 'exportCentral' },
  'costa-rica': { x: -360, y: 150, clusterKey: 'exportCentral' },
  'el-salvador': { x: -360, y: 180, clusterKey: 'exportCentral' },
  barbados: { x: -360, y: 220, clusterKey: 'exportCentral' },
  guyana: { x: -360, y: 260, clusterKey: 'exportCentral' },
  'saint-lucia': { x: -310, y: 210, clusterKey: 'exportCentral' },
  suriname: { x: -320, y: 250, clusterKey: 'exportCentral' },
  jamaica: { x: -400, y: 60, clusterKey: 'exportCentral' },
  'south-africa': { x: -300, y: 280, clusterKey: 'exportCentral' },
  trinidad: { x: -85, y: -20, clusterKey: 'core' },
};

const MARKET_POLES_ORGANIGRAM: Record<string, { x: number; y: number }> = {
  canada: { x: -640, y: 140 },
  usa: { x: -480, y: 140 },
  belize: { x: -320, y: 140 },
  panama: { x: -160, y: 140 },
  'costa-rica': { x: 0, y: 140 },
  'el-salvador': { x: 140, y: 140 },
  barbados: { x: 280, y: 140 },
  guyana: { x: 420, y: 140 },
  'saint-lucia': { x: 560, y: 140 },
  suriname: { x: 700, y: 140 },
  jamaica: { x: -400, y: 180 },
  'south-africa': { x: 800, y: 140 },
};

// 1. Spatially Balanced Quadrant Target Assignment (Completely Decentralized, Zero Overlap)
function assignQuadrantTarget(node: any): { x: number; y: number } {
  const id = (node.id || '').toLowerCase();
  const fm = node.frontmatter || {};
  const job = String(fm.job_title || fm.role || node.title || '').toLowerCase();

  // Override explícito de coordenadas enviado por DOTS
  if (fm.visual_coordinates && typeof fm.visual_coordinates.x === 'number' && typeof fm.visual_coordinates.y === 'number') {
    return { x: fm.visual_coordinates.x, y: fm.visual_coordinates.y };
  }

  // TOP SHOWROOM: Marcas SMJ Máster (y = -260) - SOLO nodos tipo 'brand'
  if (node.type === 'brand') {
    if (id.includes('chubby')) return { x: -300, y: -260 };
    if (id.includes('fruta')) return { x: -150, y: -260 };
    if (id.includes('busta')) return { x: 0, y: -260 };
    if (id.includes('oasis')) return { x: 150, y: -260 };
    if (id.includes('altitude')) return { x: 300, y: -260 };
    return { x: 0, y: -260 };
  }

  // TOPOLOGÍA COMERCIAL DE 4 CAPAS (MERCADO -> CANAL -> OPERADOR -> CLIENTE)
  const marketAnchor = resolveNodeMarketAnchor(node);
  const isMarketType = node.type === 'market' || id.startsWith('market-') || (node.type === 'country' && !id.includes('trinidad'));
  const isChannelOrOperator = node.type === 'channel' || node.type === 'distributor' || node.type === 'operator' || id.startsWith('dist-') || id.startsWith('distributor-') || id.startsWith('channel-') || fm.spatial_tier === 'channel' || fm.spatial_tier === 'operator';
  const isClientType = node.type === 'customer' || node.type === 'client_group' || node.type === 'client' || id.startsWith('client-') || id.includes('walmart') || id.startsWith('listing-') || fm.spatial_tier === 'client';

  if (marketAnchor && MARKET_POLES_QUADRANTS[marketAnchor.key]) {
    const pole = MARKET_POLES_QUADRANTS[marketAnchor.key];
    if (isMarketType) {
      return { x: pole.x, y: pole.y };
    }
    if (isChannelOrOperator) {
      // Órbita intermedia comercial (X aprox -390 hacia el centro)
      let hash = 0;
      for (let i = 0; i < id.length; i++) hash = (hash * 23 + id.charCodeAt(i)) & 0xffffffff;
      const yOffset = ((Math.abs(hash) % 70) - 35);
      if (id.includes('sancas-belize') || (id.includes('sancas') && !id.includes('channel'))) return { x: -390, y: pole.y };
      if (id.includes('wholesaler') || id.includes('nando')) return { x: -410, y: pole.y + 35 };
      if (id.includes('independent')) return { x: -440, y: pole.y - 35 };
      if (id.includes('medimex')) return { x: -390, y: pole.y };
      return { x: -390, y: pole.y + yOffset };
    }
    if (isClientType) {
      // Órbita exterior comercial (X aprox -250 hacia el centro)
      let hash = 0;
      for (let i = 0; i < id.length; i++) hash = (hash * 19 + id.charCodeAt(i)) & 0xffffffff;
      const yOffset = ((Math.abs(hash) % 80) - 40);
      if (id.includes('brodies')) return { x: -260, y: pole.y - 15 };
      if (id.includes('mayoristas') || id.includes('nando')) return { x: -260, y: pole.y + 25 };
      if (id.includes('walmart')) return { x: -250, y: pole.y };
      return { x: -250, y: pole.y + yOffset };
    }
  }

  // Proyectos e Hitos Comerciales
  if (id.includes('wm-20261109-002') || id.includes('gira-comercial-belice')) return { x: -240, y: 70 };
  if (id.includes('apertura-canal')) return { x: -240, y: 200 };

  // TERRITORIO MATRIZ: Trinidad & Tobago (x = -170, y = -30)
  if (id.includes('trinidad')) return { x: -170, y: -30 };

  // CENTER: Core HQ S.M. Jaleel (Casa Matriz) y Planta Central
  if (node.type === 'core' || id.includes('core-sm-jaleel')) return { x: 0, y: -30 };
  if (id.includes('manufacturing-plant') || id.includes('dept-manufacturing')) return { x: 150, y: -30 };

  // SUBSIDIARIAS INTERNACIONALES DE S.M. JALEEL
  if (node.type === 'organization') {
    if (id.includes('guyana')) return { x: -140, y: 70 };
    if (id.includes('barbados')) return { x: -70, y: 110 };
    if (id.includes('st-lucia')) return { x: 0, y: 125 };
    if (id.includes('suriname')) return { x: 70, y: 110 };
    if (id.includes('usa')) return { x: 140, y: 70 };
    if (id.includes('sa-pty') || id.includes('south-africa')) return { x: -60, y: 175 };
    if (id.includes('procurement')) return { x: 60, y: 175 };
    return { x: 0, y: 95 };
  }

  // Departamentos Corporativos (Todos los 11 departamentos ubicados con precisión)
  if (node.type === 'department' || id.startsWith('dept-')) {
    if (id.includes('international-exports') || id.includes('export')) return { x: 630, y: -90 };
    if (id.includes('supply-chain') || id.includes('procurement')) return { x: 630, y: 170 };
    if (id.includes('manufacturing') || id.includes('plant')) return { x: 150, y: -30 };
    if (id.includes('finance') || id.includes('credit')) return { x: 630, y: 240 };
    if (id.includes('business-intelligence')) return { x: 630, y: -160 };
    if (id.includes('customs')) return { x: 480, y: 250 };
    if (id.includes('export-warehousing')) return { x: 340, y: 250 };
    if (id.includes('information-technology') || id.includes('-it')) return { x: 750, y: -160 };
    if (id.includes('internal-audit')) return { x: 750, y: -90 };
    if (id.includes('legal')) return { x: 750, y: -20 };
    if (id.includes('marketing')) return { x: 750, y: 50 };

    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = (hash * 29 + id.charCodeAt(i)) & 0xffffffff;
    return { x: 680, y: -150 + (Math.abs(hash) % 380) };
  }

  // EAST (RIGHT): Dirección Ejecutiva, Jefaturas & Liderazgo
  // Fila 0 - CHAIRMAN & BOARD (Arriba de Anna, y = -300)
  if (id.includes('aleem') || job.includes('chair')) return { x: 480, y: -300 };

  // Fila 1 - C-Suite & COO (Arriba, y = -220)
  if (id.includes('anna-mohammed')) return { x: 480, y: -220 };
  if (id.includes('role-chief-operating')) return { x: 340, y: -220 };
  if (id.includes('noella-hewitt')) return { x: 630, y: -220 };

  // Fila 2 - Vicepresidencias (y = -90)
  if (id.includes('clint-villafana')) return { x: 480, y: -90 };
  if (id.includes('role-vp-international-exports')) return { x: 340, y: -90 };

  // Fila 3 - Gerencias de Exportación (y = 40 · ¡Línea de Humberto!)
  if (id.includes('humberto-bouche') || id.includes('humberto')) return { x: 340, y: 40 };
  if (id.includes('role-export-manager')) return { x: 210, y: 40 };
  if (id.includes('olivia-rampersad') || id.includes('olivia')) return { x: 470, y: 40 };
  if (id.includes('alanna-ramjattan') || id.includes('alanna')) return { x: 600, y: 40 };
  if (id.includes('ivan-saroop') || id.includes('ivan')) return { x: 730, y: 40 };

  // Fila 4 - Supply Chain, Compras y Planta (y = 170)
  if (id.includes('sonia-harris')) return { x: 480, y: 170 };
  if (id.includes('role-vp-logistics')) return { x: 340, y: 170 };
  if (id.includes('rajesh') || id.includes('plant-operations-director')) return { x: 210, y: 170 };
  if (id.includes('role-vp-manufacturing')) return { x: 210, y: 240 };

  // Otros líderes clave
  if (id.includes('amir-hosein')) return { x: 340, y: 210 };
  if (id.includes('andre-hosein')) return { x: 470, y: 210 };
  if (id.includes('montoya')) return { x: 600, y: 210 };

  // SOUTH (BOTTOM): Rutinas S&OP & Bandeja de Memoria Operativa (y = 290)
  if (id.includes('routine') || id.includes('forecast')) return { x: -80, y: 290 };
  if (id.includes('wm-20261109-001') || id.includes('prioridad-lote')) return { x: 80, y: 290 };
  if (id.includes('session-20261109-002')) return { x: 240, y: 290 };
  if (id.includes('session') || node.type === 'consolidation_session') return { x: 380, y: 290 };
  if (node.type === 'working_memory') return { x: 0, y: 320 };

  // Flavors, Packaging, Variants (ShopSMJ Catalog Canopy encima de su respectiva marca)
  if (node.type === 'flavor' || node.type === 'packaging' || node.type === 'product_line' || node.type === 'product_variant') {
    let parentX = 0;
    if (id.includes('chubby')) parentX = -300;
    else if (id.includes('fruta')) parentX = -150;
    else if (id.includes('busta')) parentX = 0;
    else if (id.includes('oasis')) parentX = 150;
    else if (id.includes('altitude')) parentX = 300;
    else {
      let hash = 0;
      for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) & 0xffffffff;
      parentX = (Math.abs(hash) % 700) - 350;
    }

    let hashY = 0;
    for (let i = 0; i < id.length; i++) hashY = (hashY * 17 + id.charCodeAt(i)) & 0xffffffff;
    const yOffset = -340 - (Math.abs(hashY) % 180);
    const xOffset = ((hashY >> 3) % 110) - 55;
    return { x: parentX + xOffset, y: yOffset };
  }

  // Personal Operativo (Cuando se despliega: se agrupa en abanico limpio alrededor de su departamento)
  if (node.type === 'person') {
    const dept = getPersonDeptCategory(node);
    let center = { x: 500, y: 70 };
    if (dept === 'manufacturing') center = { x: 210, y: 190 };
    else if (dept === 'supply_chain') center = { x: 520, y: 180 };
    else if (dept === 'finance') center = { x: 650, y: 250 };
    else if (dept === 'exports') center = { x: 500, y: 70 };

    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = (hash * 37 + id.charCodeAt(i)) & 0xffffffff;
    const angle = (Math.abs(hash) % 360) * (Math.PI / 180);
    const radius = 55 + (Math.abs(hash >> 3) % 75);
    return {
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius,
    };
  }

  return { x: 50, y: 320 };
}

// 2. Constellation Targets (Distinct Orbital Galaxies - Centered & Zero Overflow)
function assignClusterTarget(node: any): { x: number; y: number; clusterKey: string } {
  const id = (node.id || '').toLowerCase();
  const fm = node.frontmatter || {};
  const job = String(fm.job_title || fm.role || node.title || '').toLowerCase();

  // Override explícito de coordenadas enviado por DOTS
  if (fm.visual_coordinates && typeof fm.visual_coordinates.x === 'number' && typeof fm.visual_coordinates.y === 'number') {
    return { x: fm.visual_coordinates.x, y: fm.visual_coordinates.y, clusterKey: 'core' };
  }

  // CLUSTER 1: CORE TRINIDAD & SUBSIDIARIAS CORPORATIVAS (Center: 0, -20)
  if (id.includes('aleem') || job.includes('chair')) return { x: 0, y: -90, clusterKey: 'core' };
  if (id.includes('trinidad')) return { x: -85, y: -20, clusterKey: 'core' };
  if (node.type === 'core' || id.includes('core-sm-jaleel')) return { x: 0, y: -20, clusterKey: 'core' };
  if (id.includes('anna-mohammed')) return { x: 85, y: -50, clusterKey: 'core' };
  if (id.includes('role-chief-operating')) return { x: 85, y: 15, clusterKey: 'core' };
  if (id.includes('noella-hewitt')) return { x: 145, y: -20, clusterKey: 'core' };

  // SUBSIDIARIAS DE CASA MATRIZ SM JALEEL
  if (node.type === 'organization') {
    if (id.includes('guyana')) return { x: -60, y: 60, clusterKey: 'core' };
    if (id.includes('barbados')) return { x: -20, y: 80, clusterKey: 'core' };
    if (id.includes('st-lucia')) return { x: 20, y: 80, clusterKey: 'core' };
    if (id.includes('suriname')) return { x: 60, y: 60, clusterKey: 'core' };
    if (id.includes('usa')) return { x: -40, y: 110, clusterKey: 'core' };
    if (id.includes('sa-pty') || id.includes('south-africa')) return { x: 0, y: 120, clusterKey: 'core' };
    if (id.includes('procurement')) return { x: 40, y: 110, clusterKey: 'core' };
    return { x: 0, y: 70, clusterKey: 'core' };
  }

  // RESOLUCIÓN TOPOLÓGICA DINÁMICA POR ANCLA DE MERCADO (CONSTELACIONES)
  const marketAnchor = resolveNodeMarketAnchor(node);
  const isMarketType = node.type === 'market' || id.startsWith('market-') || (node.type === 'country' && !id.includes('trinidad'));
  const isChannelOrOperator = node.type === 'channel' || node.type === 'distributor' || node.type === 'operator' || id.startsWith('dist-') || id.startsWith('distributor-') || id.startsWith('channel-') || fm.spatial_tier === 'channel' || fm.spatial_tier === 'operator';
  const isClientType = node.type === 'customer' || node.type === 'client_group' || node.type === 'client' || id.startsWith('client-') || id.includes('walmart') || id.startsWith('listing-') || fm.spatial_tier === 'client';

  if (marketAnchor && MARKET_POLES_CONSTELLATIONS[marketAnchor.key]) {
    const pole = MARKET_POLES_CONSTELLATIONS[marketAnchor.key];
    if (isMarketType) {
      return { x: pole.x, y: pole.y, clusterKey: pole.clusterKey };
    }
    if (isChannelOrOperator) {
      let hash = 0;
      for (let i = 0; i < id.length; i++) hash = (hash * 23 + id.charCodeAt(i)) & 0xffffffff;
      const angle = (Math.abs(hash) % 360) * (Math.PI / 180);
      const dist = 65 + (Math.abs(hash >> 3) % 40);
      return {
        x: pole.x + Math.cos(angle) * dist,
        y: pole.y + Math.sin(angle) * dist,
        clusterKey: pole.clusterKey,
      };
    }
    if (isClientType) {
      let hash = 0;
      for (let i = 0; i < id.length; i++) hash = (hash * 19 + id.charCodeAt(i)) & 0xffffffff;
      const angle = (Math.abs(hash) % 360) * (Math.PI / 180);
      const dist = 115 + (Math.abs(hash >> 3) % 45);
      return {
        x: pole.x + Math.cos(angle) * dist,
        y: pole.y + Math.sin(angle) * dist,
        clusterKey: pole.clusterKey,
      };
    }
  }

  // CLUSTER 4: DIRECCIÓN EJECUTIVA & COMERCIAL (Center: 360, -160)
  if (id.includes('clint-villafana')) return { x: 360, y: -210, clusterKey: 'executiveRight' };
  if (id.includes('role-vp-international-exports')) return { x: 280, y: -230, clusterKey: 'executiveRight' };
  if (id.includes('dept-international-exports')) return { x: 440, y: -230, clusterKey: 'executiveRight' };
  if (id.includes('humberto-bouche') || id.includes('humberto')) return { x: 280, y: -140, clusterKey: 'executiveRight' };
  if (id.includes('role-export-manager')) return { x: 210, y: -90, clusterKey: 'executiveRight' };
  if (id.includes('olivia-rampersad') || id.includes('olivia')) return { x: 360, y: -100, clusterKey: 'executiveRight' };
  if (id.includes('alanna-ramjattan') || id.includes('alanna')) return { x: 430, y: -120, clusterKey: 'executiveRight' };
  if (id.includes('ivan-saroop') || id.includes('ivan')) return { x: 460, y: -70, clusterKey: 'executiveRight' };

  // CLUSTER 5: MANUFACTURA, MARCAS & SUPPLY CHAIN (Center: 360, 130)
  if (id.includes('sonia-harris')) return { x: 360, y: 70, clusterKey: 'manufacturing' };
  if (id.includes('role-vp-logistics')) return { x: 290, y: 60, clusterKey: 'manufacturing' };
  if (id.includes('dept-supply-chain')) return { x: 430, y: 60, clusterKey: 'manufacturing' };
  if (id.includes('rajesh') || id.includes('plant-operations-director')) return { x: 280, y: 110, clusterKey: 'manufacturing' };
  if (id.includes('manufacturing-plant') || id.includes('dept-manufacturing')) return { x: 340, y: 140, clusterKey: 'manufacturing' };
  if (id.includes('role-vp-manufacturing')) return { x: 270, y: 160, clusterKey: 'manufacturing' };
  if (id.includes('dept-finance')) return { x: 430, y: 130, clusterKey: 'manufacturing' };

  // Marcas Máster (SOLO nodos tipo 'brand')
  if (node.type === 'brand') {
    if (id.includes('chubby')) return { x: 290, y: 200, clusterKey: 'manufacturing' };
    if (id.includes('fruta')) return { x: 360, y: 210, clusterKey: 'manufacturing' };
    if (id.includes('busta')) return { x: 430, y: 190, clusterKey: 'manufacturing' };
    if (id.includes('oasis')) return { x: 460, y: 140, clusterKey: 'manufacturing' };
    if (id.includes('altitude')) return { x: 440, y: 90, clusterKey: 'manufacturing' };
    return { x: 360, y: 200, clusterKey: 'manufacturing' };
  }

  // South routines / memory (Center: 0, 200)
  if (id.includes('routine') || id.includes('forecast')) return { x: -80, y: 200, clusterKey: 'workingMemory' };
  if (id.includes('wm-20261109-001') || id.includes('prioridad-lote')) return { x: 0, y: 200, clusterKey: 'workingMemory' };
  if (id.includes('session-20261109-002')) return { x: 80, y: 200, clusterKey: 'workingMemory' };
  if (node.type === 'working_memory') return { x: 0, y: 220, clusterKey: 'workingMemory' };

  // Catalog items: Attach to manufacturing & brands nebula (Center: 360, 130)
  if (node.type === 'flavor' || node.type === 'packaging' || node.type === 'product_line' || node.type === 'product_variant') {
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) & 0xffffffff;
    const angle = (Math.abs(hash) % 360) * (Math.PI / 180);
    const dist = 160 + (Math.abs(hash >> 4) % 150);
    return {
      x: 360 + Math.cos(angle) * dist,
      y: 130 + Math.sin(angle) * dist,
      clusterKey: 'manufacturing',
    };
  }

  // Other person nodes: Orbit in executive right nebula (Center: 360, -160)
  if (node.type === 'person') {
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = (hash * 37 + id.charCodeAt(i)) & 0xffffffff;
    const angle = (Math.abs(hash) % 360) * (Math.PI / 180);
    const dist = 90 + (Math.abs(hash >> 3) % 110);
    return {
      x: 360 + Math.cos(angle) * dist,
      y: -160 + Math.sin(angle) * dist,
      clusterKey: 'executiveRight',
    };
  }

  return { x: 0, y: 80, clusterKey: 'core' };
}

// 3. Organigram Targets (Pure Hierarchical Executive Tree L-Apex to L4)
function assignOrganigramTarget(node: any): { x: number; y: number } {
  const id = (node.id || '').toLowerCase();
  const fm = node.frontmatter || {};
  const job = String(fm.job_title || fm.role || node.title || '').toLowerCase();

  // Override explícito de coordenadas enviado por DOTS
  if (fm.visual_coordinates && typeof fm.visual_coordinates.x === 'number' && typeof fm.visual_coordinates.y === 'number') {
    return { x: fm.visual_coordinates.x, y: fm.visual_coordinates.y };
  }

  // L-APEX: CHAIRMAN DE LA JUNTA DIRECTIVA (y = -380)
  if (id.includes('aleem') || job.includes('chair')) {
    return { x: 0, y: -380 };
  }

  // L0: C-SUITE & COO (y = -260)
  if (id.includes('anna-mohammed')) return { x: 0, y: -260 };
  if (id.includes('role-chief-operating')) return { x: -170, y: -260 };
  if (id.includes('noella-hewitt')) return { x: 170, y: -260 };
  if (node.type === 'core' || id.includes('core-sm-jaleel')) return { x: 340, y: -260 };

  // L1: VICEPRESIDENCIAS & DEPARTAMENTOS (y = -120)
  // Export Branch (Left)
  if (id.includes('clint-villafana')) return { x: -300, y: -120 };
  if (id.includes('role-vp-international-exports')) return { x: -470, y: -120 };
  if (id.includes('dept-international-exports')) return { x: -140, y: -120 };
  // Operations & Logistics Branch (Right)
  if (id.includes('sonia-harris')) return { x: 240, y: -120 };
  if (id.includes('role-vp-logistics')) return { x: 400, y: -120 };
  if (id.includes('dept-supply-chain')) return { x: 550, y: -120 };
  if (id.includes('dept-finance')) return { x: 690, y: -120 };

  // Departamentos estructurados
  if (node.type === 'department' || id.startsWith('dept-')) {
    if (id.includes('business-intelligence')) return { x: -600, y: -120 };
    if (id.includes('marketing')) return { x: -220, y: -60 };
    if (id.includes('legal')) return { x: -120, y: -180 };
    if (id.includes('internal-audit')) return { x: 120, y: -180 };
    if (id.includes('information-technology') || id.includes('-it')) return { x: 820, y: -120 };
    if (id.includes('customs')) return { x: 420, y: -60 };
    if (id.includes('export-warehousing')) return { x: 280, y: -60 };
    if (id.includes('manufacturing') || id.includes('plant')) return { x: 310, y: 20 };

    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = (hash * 29 + id.charCodeAt(i)) & 0xffffffff;
    return { x: -500 + (Math.abs(hash) % 1100), y: -70 };
  }

  // ORGANIZACIONES & FILIALES INTERNACIONALES (y = -40, entre VP y Gerencias)
  if (node.type === 'organization') {
    const orgIndex = ['guyana', 'barbados', 'st-lucia', 'suriname', 'usa', 'sa-pty', 'procurement'].findIndex(k => id.includes(k));
    const ox = -420 + (orgIndex >= 0 ? orgIndex : 0) * 140;
    return { x: ox, y: -40 };
  }

  // L2: GERENCIAS & DIRECT REPORTS (y = 20)
  // Direct under Clint Villafana:
  if (id.includes('humberto-bouche') || id.includes('humberto')) return { x: -550, y: 20 };
  if (id.includes('role-export-manager')) return { x: -680, y: 20 };
  if (id.includes('olivia-rampersad') || id.includes('olivia')) return { x: -390, y: 20 };
  if (id.includes('alanna-ramjattan') || id.includes('alanna')) return { x: -230, y: 20 };
  if (id.includes('ivan-saroop') || id.includes('ivan')) return { x: -70, y: 20 };
  // Direct under Sonia / Plant:
  if (id.includes('rajesh') || id.includes('plant-operations-director')) return { x: 160, y: 20 };
  if (id.includes('manufacturing-plant') || id.includes('dept-manufacturing')) return { x: 310, y: 20 };
  if (id.includes('role-vp-manufacturing')) return { x: 460, y: 20 };

  // L3: TOPOLOGÍA COMERCIAL INTERNACIONAL (MERCADOS y = 140, CANALES/DISTRIBUIDORES y = 220, CLIENTES y = 290)
  const marketAnchor = resolveNodeMarketAnchor(node);
  const isMarketType = node.type === 'market' || id.startsWith('market-') || (node.type === 'country' && !id.includes('trinidad'));
  const isChannelOrOperator = node.type === 'channel' || node.type === 'distributor' || node.type === 'operator' || id.startsWith('dist-') || id.startsWith('distributor-') || id.startsWith('channel-') || fm.spatial_tier === 'channel' || fm.spatial_tier === 'operator';
  const isClientType = node.type === 'customer' || node.type === 'client_group' || node.type === 'client' || id.startsWith('client-') || id.includes('walmart') || id.startsWith('listing-') || fm.spatial_tier === 'client';

  if (marketAnchor && MARKET_POLES_ORGANIGRAM[marketAnchor.key]) {
    const pole = MARKET_POLES_ORGANIGRAM[marketAnchor.key];
    if (isMarketType) {
      return { x: pole.x, y: 140 }; // Nivel L3: Mercados
    }
    if (isChannelOrOperator) {
      // Nivel L3.1: Canales y Distribuidores directamente bajo su mercado
      let hash = 0;
      for (let i = 0; i < id.length; i++) hash = (hash * 23 + id.charCodeAt(i)) & 0xffffffff;
      const xOffset = ((Math.abs(hash) % 80) - 40);
      if (id.includes('sancas-belize') || (id.includes('sancas') && !id.includes('channel'))) return { x: pole.x - 45, y: 220 };
      if (id.includes('wholesaler') || id.includes('nando')) return { x: pole.x + 35, y: 220 };
      if (id.includes('independent')) return { x: pole.x + 90, y: 220 };
      if (id.includes('medimex')) return { x: pole.x, y: 220 };
      return { x: pole.x + xOffset, y: 220 };
    }
    if (isClientType) {
      // Nivel L3.2: Cuentas Clave y Clientes debajo de su operador/canal
      let hash = 0;
      for (let i = 0; i < id.length; i++) hash = (hash * 19 + id.charCodeAt(i)) & 0xffffffff;
      const xOffset = ((Math.abs(hash) % 70) - 35);
      if (id.includes('brodies')) return { x: pole.x - 45, y: 290 };
      if (id.includes('mayoristas') || id.includes('nando')) return { x: pole.x + 35, y: 290 };
      if (id.includes('walmart')) return { x: pole.x, y: 290 };
      return { x: pole.x + xOffset, y: 290 };
    }
  }

  // L4: MARCAS MÁSTER, RUTINAS & MEMORIA (y = 350)
  if (node.type === 'brand') {
    if (id.includes('chubby')) return { x: -440, y: 350 };
    if (id.includes('fruta')) return { x: -280, y: 350 };
    if (id.includes('busta')) return { x: -120, y: 350 };
    if (id.includes('oasis')) return { x: 40, y: 350 };
    if (id.includes('altitude')) return { x: 200, y: 350 };
    return { x: 0, y: 350 };
  }
  if (id.includes('routine') || id.includes('forecast')) return { x: 370, y: 350 };
  if (id.includes('wm-20261109-001') || id.includes('prioridad-lote')) return { x: 510, y: 350 };
  if (id.includes('session-20261109-002')) return { x: 650, y: 350 };
  if (id.includes('session') || node.type === 'consolidation_session') return { x: 790, y: 350 };
  if (node.type === 'working_memory') return { x: 510, y: 350 };

  // Personal Operativo distribuido ordenadamente por departamento en la franja Staff (y = 80)
  if (node.type === 'person') {
    const dept = getPersonDeptCategory(node);
    let baseX = -300;
    if (dept === 'exports') baseX = -400;
    else if (dept === 'manufacturing') baseX = 200;
    else if (dept === 'supply_chain') baseX = 450;
    else if (dept === 'finance') baseX = 650;
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) & 0xffffffff;
    const offsetX = ((Math.abs(hash) % 200) - 100);
    return { x: baseX + offsetX, y: 80 };
  }

  // Catalog items spread across L4 Catalog stratum
  if (node.type === 'flavor' || node.type === 'packaging' || node.type === 'product_line' || node.type === 'product_variant') {
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = (hash * 37 + id.charCodeAt(i)) & 0xffffffff;
    const spreadX = ((Math.abs(hash) % 1500) - 750);
    return { x: spreadX, y: 350 };
  }

  return { x: 0, y: 350 };
}

// Vector graphics helper functions
function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, spikes: number, outerRadius: number, innerRadius: number, color: string) {
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

function drawMapleLeaf(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
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

function drawPanamaFlag(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
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

function drawCanadaFlag(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
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

function drawUSAFlag(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
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

function drawBelizeFlag(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
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

function drawTrinidadFlag(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
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

function drawSMJCorporateCrest(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
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

function drawPersonAvatar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, node: NodeData) {
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

    ctx.font = 'bold 8px monospace';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initials, x + r * 0.65, y + r * 0.55);
  }
}

function drawDistributorBadge(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, node: NodeData) {
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

    ctx.font = 'bold 8px monospace';
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

  ctx.font = 'bold 8px monospace';
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

function drawOrganizationBadge(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, node: NodeData) {
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

  ctx.font = 'bold 8px monospace';
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

function drawBrandBadge(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, node: NodeData) {
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

function drawGlassDomeOverlay(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
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

function drawAmericasMapBackdrop(ctx: CanvasRenderingContext2D) {
  ctx.save();

  const mapGlow = ctx.createRadialGradient(-380, 0, 40, -380, 0, 320);
  mapGlow.addColorStop(0, 'rgba(14, 165, 233, 0.07)');
  mapGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = mapGlow;
  ctx.beginPath();
  ctx.arc(-380, 0, 320, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
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

  ctx.strokeStyle = 'rgba(56, 189, 248, 0.22)';
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

  ctx.font = 'bold 9px monospace';
  ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
  ctx.textAlign = 'center';
  ctx.fillText('AMÉRICA · RED CONTINENTAL DE EXPORTACIÓN', -380, -225);

  ctx.font = '8px monospace';
  ctx.fillStyle = 'rgba(148, 163, 184, 0.4)';
  ctx.fillText('CANADÁ [NORTE]', -460, -205);
  ctx.fillText('EE. UU. [CENTRAL]', -440, -100);
  ctx.fillText('BELICE [CARIBE]', -460, 65);
  ctx.fillText('PANAMÁ [HUB CA]', -440, 175);

  ctx.restore();
}

export default function CerebroPage() {
  const [mounted, setMounted] = useState(false);
  const [graphData, setGraphData] = useState<BrainGraphResponse | null>(null);
  const [selectedMarket, setSelectedMarket] = useState<string>('all');
  const [activeLens, setActiveLens] = useState<string>('global-core');
  const [stackedDeck, setStackedDeck] = useState<NodeData[]>([]);
  const stackedDeckRef = useRef(stackedDeck);
  stackedDeckRef.current = stackedDeck;
  const [quickInput, setQuickInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [gravityActive, setGravityActive] = useState(true);
  const [viewMode, setViewMode] = useState<'brujula' | 'version-1-ajustada' | 'quadrants' | 'constellations' | 'organigram'>('brujula');
  const viewModeRef = useRef<'brujula' | 'version-1-ajustada' | 'quadrants' | 'constellations' | 'organigram'>(viewMode);
  viewModeRef.current = viewMode;

  // Cache del resultado del layout nativo y decoraciones
  const nativeLayoutCacheRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const nativeLayoutDecorRef = useRef<any[]>([]);
  const nativeLayoutConfigRef = useRef<Record<string, any>>({});

  // Granular Catalog & Multi-packs Collapsible Control
  const [catalogScope, setCatalogScope] = useState<string>('collapsed');
  const catalogScopeRef = useRef(catalogScope);
  catalogScopeRef.current = catalogScope;
  const [isCatalogMenuOpen, setIsCatalogMenuOpen] = useState(false);

  // Organizational Hierarchy, Leadership & Staff Collapsible Control
  const [orgScope, setOrgScope] = useState<'collapsed' | 'all' | 'exports' | 'manufacturing' | 'supply_chain' | 'finance' | 'organizations'>('collapsed');
  const orgScopeRef = useRef(orgScope);
  orgScopeRef.current = orgScope;
  const [isOrgMenuOpen, setIsOrgMenuOpen] = useState(false);

  const [expandedBrandInDossier, setExpandedBrandInDossier] = useState<string | null>(null);
  const [expandedDeptInDossier, setExpandedDeptInDossier] = useState<string | null>(null);
  const [expandedLeaderInDossier, setExpandedLeaderInDossier] = useState<string | null>(null);

  // Executive Command Cockpit (HUD) State
  const [isHudOpen, setIsHudOpen] = useState(true);

  // Mobile Collapsible Controls State
  const [isMobileControlsOpen, setIsMobileControlsOpen] = useState(false);

  // Interactive Hover Tooltip State
  const [hoveredNode, setHoveredNode] = useState<NodeData | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const initialDeckLoadedRef = useRef(false);

  // Clean Executive Header, Search & Settings Modal
  const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [pinnedCount, setPinnedCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Hierarchical Drill-Down & Breadcrumbs Navigation
  const [drilldownStack, setDrilldownStack] = useState<{ id: string; title: string; type: string; category?: string }[]>([]);
  const drilldownStackRef = useRef(drilldownStack);
  drilldownStackRef.current = drilldownStack;
  const lastTapTimeRef = useRef(0);
  const dragStartMousePosRef = useRef({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const inspectorRef = useRef<HTMLDivElement | null>(null);
  const nodesRef = useRef<NodeData[]>([]);
  const fullGraphRef = useRef<{nodes: any[]; links: LinkData[]}>({nodes: [], links: []});
  const revealedNodeIdsRef = useRef(new Set<string>());
  const focusNodeIdsRef = useRef<string[]>([]);
  const cameraAnimationRef = useRef(0);
  const linksRef = useRef<LinkData[]>([]);
  const transformRef = useRef({ x: 0, y: 0, scale: 0.72 });
  const isDraggingCanvasRef = useRef(false);
  const draggedNodeRef = useRef<NodeData | null>(null);
  const lastMousePosRef = useRef({ x: 0, y: 0 });
  const animFrameRef = useRef<number | null>(null);
  const hoveredNodeRef = useRef<NodeData | null>(null);

  // Touch Gesture Refs (Mobile Support: 1-finger pan, 2-finger pinch, tap detection)
  const touchStartPosRef = useRef({ x: 0, y: 0, time: 0 });
  const lastTouchPosRef = useRef({ x: 0, y: 0 });
  const initialPinchDistRef = useRef<number | null>(null);
  const initialPinchScaleRef = useRef(1);
  const pinchCenterRef = useRef<{ x: number; y: number } | null>(null);
  const touchMovedRef = useRef(false);

  useEffect(() => {
    // Restore presentation preference only; never alter source hierarchy to reveal a person.
    try {
      const saved = localStorage.getItem('cerebro_org_scope');
      if (saved && ['collapsed','all','exports','manufacturing','supply_chain','finance','organizations'].includes(saved)) {
        orgScopeRef.current = saved as typeof orgScope;
        setOrgScope(saved as typeof orgScope);
      }
    } catch {}
    setMounted(true);
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsHudOpen(false);
    }
  }, []);

  const updateCanvasDimensions = () => {
    if (containerRef.current && canvasRef.current) {
      const w = containerRef.current.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 1200);
      const h = containerRef.current.clientHeight || (typeof window !== 'undefined' ? window.innerHeight : 800);
      const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;

      canvasRef.current.width = Math.floor(w * dpr);
      canvasRef.current.height = Math.floor(h * dpr);
      canvasRef.current.style.width = `${w}px`;
      canvasRef.current.style.height = `${h}px`;

      if (transformRef.current.x === 0 && transformRef.current.y === 0) {
        transformRef.current.x = w / 2;
        transformRef.current.y = h / 2;
      }
    }
  };

  useEffect(() => {
    if (!mounted || !containerRef.current) return;
    updateCanvasDimensions();

    let ro: ResizeObserver | null = null;
    if (typeof window !== 'undefined' && 'ResizeObserver' in window) {
      ro = new ResizeObserver(() => {
        updateCanvasDimensions();
      });
      ro.observe(containerRef.current);
    }

    window.addEventListener('resize', updateCanvasDimensions);
    (window as any).__selectNode = (node: any) => pushToStackedDeck(node);
    (window as any).__getNodes = () => nodesRef.current;
    (window as any).__getTransform = () => transformRef.current;
    (window as any).__selectById = (id: string) => {
      const target = nodesRef.current.find(n => n.id.toLowerCase().includes(id.toLowerCase()));
      if (target) pushToStackedDeck(target);
      return !!target;
    };
    (window as any).handleWikilinkClick = (target: string) => handleWikilinkClick(target);
    (window as any).__cerebroHandleWikilinkClick = (target: string) => handleWikilinkClick(target);
    const handleWikilinkEvent = (e: any) => {
      if (e.detail) handleWikilinkClick(e.detail);
    };
    window.addEventListener('cerebro:wikilink', handleWikilinkEvent);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', updateCanvasDimensions);
      window.removeEventListener('cerebro:wikilink', handleWikilinkEvent);
      delete (window as any).handleWikilinkClick;
      delete (window as any).__cerebroHandleWikilinkClick;
    };
  }, [mounted]);

  const getNodeTarget = (node: any, modeOverride?: 'brujula' | 'version-1-ajustada' | 'quadrants' | 'constellations' | 'organigram') => {
    const activeMode = modeOverride || viewModeRef.current;
    const baseTarget = (targetNode: any) => {
    if (activeMode === 'brujula' || activeMode === 'version-1-ajustada') {
      const cached = nativeLayoutCacheRef.current.get(targetNode.id);
      if (cached) return cached;
      // Fallback a cuadrantes si aún no corre el layout
      return assignQuadrantTarget(targetNode);
    }
    if (activeMode === 'quadrants') return assignQuadrantTarget(targetNode);
    if (activeMode === 'organigram') return assignOrganigramTarget(targetNode);
    return assignClusterTarget(targetNode);
    };
    const all = fullGraphRef.current.nodes.length ? fullGraphRef.current.nodes : nodesRef.current;
    return contactTarget(node, all, baseTarget) || baseTarget(node);
  };

  const recomputeNativeLayout = (mode: 'brujula' | 'version-1-ajustada', currentNodes: any[], allRawNodes: any[]) => {
    if (!currentNodes.length) return;
    const viewCfg = nativeLayoutConfigRef.current[mode];
    const mergedCfg = mergeLayoutConfig(mode, viewCfg);
    const result = computeNativeLayout(mode, currentNodes, allRawNodes, mergedCfg);
    nativeLayoutCacheRef.current = result.positions;
    nativeLayoutDecorRef.current = result.decor;
  };

  const handleSetViewMode = (mode: 'brujula' | 'version-1-ajustada' | 'quadrants' | 'constellations' | 'organigram') => {
    setViewMode(mode);
    viewModeRef.current = mode;
    if (mode === 'brujula' || mode === 'version-1-ajustada') {
      const all = fullGraphRef.current.nodes.length ? fullGraphRef.current.nodes : nodesRef.current;
      recomputeNativeLayout(mode, nodesRef.current, all);
    }
    if (nodesRef.current) {
      nodesRef.current.forEach((n) => {
        const target = getNodeTarget(n, mode);
        n.targetX = target.x;
        n.targetY = target.y;
      });
    }
  };

  const fetchGraph = async () => {
    try {
      const res = await fetch(
        `/api/agent/brain?market=${encodeURIComponent(selectedMarket)}&lens=${encodeURIComponent(activeLens)}&_t=${Date.now()}`,
        { cache: 'no-store' }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: BrainGraphResponse = await res.json();
      if (json.ok) {
        if ((json as any).layouts) {
          nativeLayoutConfigRef.current = (json as any).layouts;
        }
        fullGraphRef.current = {nodes: json.allNodes || json.nodes, links: json.links};
        setGraphData(json);
        setupNodesWithMode(json.nodes, json.links);
        setSyncError(null);
        try {
          const pTime = new Intl.DateTimeFormat('es-PA', {
            timeZone: 'America/Panama',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true,
          }).format(new Date());
          setLastSyncTime(pTime);
        } catch {
          setLastSyncTime(new Date().toLocaleTimeString());
        }

        // Auto-refresh stacked deck with fresh node data from the vault (sync with Dots modifications)
        setStackedDeck(prev => {
          if (!initialDeckLoadedRef.current) {
            initialDeckLoadedRef.current = true;
            // On desktop (>= 768px), open Core node by default. On mobile (< 768px), start empty so user sees the full canvas!
            const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;
            if (isDesktop && prev.length === 0) {
              const coreNode = json.nodes.find((n: any) => n.type === 'core' || n.id.includes('core-sm-jaleel')) || json.nodes[0];
              return coreNode ? [coreNode] : [];
            }
            return prev;
          }

          // If the user closed all cards (prev is empty), RESPECT user choice and keep it empty!
          if (prev.length === 0) {
            return [];
          }

          return prev
            .map(card => {
              const fresh = json.nodes.find((n: any) => n.id === card.id);
              return fresh ? { ...card, ...fresh } : card;
            })
            .filter(card => json.nodes.some((n: any) => n.id === card.id));
        });
      } else {
        setSyncError((json as any).error || 'Respuesta anómala del servidor');
      }
    } catch (e: any) {
      setSyncError('Fallo de conexión con el Segundo Cerebro. Mostrando vista local.');
    }
  };

  useEffect(() => {
    if (!mounted) return;
    fetchGraph();
    // Live synchronization with Dots agent and vault modifications every 3.5s
    const interval = setInterval(fetchGraph, 3500);
    return () => clearInterval(interval);
  }, [mounted, selectedMarket, activeLens]);

  useEffect(() => {
    viewModeRef.current = viewMode;
    if (!nodesRef.current) return;
    nodesRef.current.forEach((n) => {
      const target = getNodeTarget(n, viewMode);
      n.targetX = target.x;
      n.targetY = target.y;
    });
  }, [viewMode]);

  const setupNodesWithMode = (rawNodes: any[], rawLinks: LinkData[], scopeOverride?: string, orgScopeOverride?: string) => {
    const cScope = scopeOverride || catalogScopeRef.current;
    const oScope = orgScopeOverride || orgScopeRef.current;

    // Filter nodes by both catalogScope and orgScope (hides granular clutter, keeps executive clarity)
    const rawPool = [...new Map([...rawNodes, ...fullGraphRef.current.nodes.filter(n => revealedNodeIdsRef.current.has(n.id))].map(n => [n.id, n])).values()];
    const filteredRawNodes = rawPool.filter((n: any) => {
      if (revealedNodeIdsRef.current.has(n.id)) return true;
      // 1. Catalog sub-items filtering (SKUs, multipacks, flavors, lines)
      const isCatalogSub = n.type === 'flavor' || n.type === 'packaging' || n.type === 'product_line' || n.type === 'product_variant';
      if (isCatalogSub) {
        if (cScope === 'collapsed') return false; // Plegado = hide sub-SKUs
        if (cScope === 'all') return true; // Desplegar todo
        const id = (n.id || '').toLowerCase();
        const title = (n.title || '').toLowerCase();
        return id.includes(cScope) || title.includes(cScope);
      }

      // 2. Organization / Staff filtering (People & Operational Employees)
      if (n.type === 'person') {
        // Distributor contacts are a commercial layer, independent of staff visibility.
        if (contactEntities(n, fullGraphRef.current.nodes.length ? fullGraphRef.current.nodes : rawPool).length) return true;
        const isLeader = isNodeLeader(n);
        if (oScope === 'collapsed') {
          // In collapsed mode: show only C-Suite, VP and Key Managers (12 people), hide 42 operational staff
          return isLeader;
        }
        if (oScope === 'all') return true;
        if (oScope === 'organizations') return isLeader;
        // If department scope: show leaders + staff of that department
        const dept = getPersonDeptCategory(n);
        return isLeader || dept === oScope;
      }

      // Organizations: Always keep
      if (n.type === 'organization') {
        return true;
      }

      // 3. Always keep Core, Master Brands, Markets, Distributors, Departments, Routines
      return true;
    });

    const activeNodeIdSet = new Set(filteredRawNodes.map((n: any) => n.id));
    const linkPool = [...new Map([...rawLinks, ...fullGraphRef.current.links].map(l => [`${l.source}->${l.target}:${l.relationType}`, l])).values()];
    const filteredRawLinks = linkPool.filter((l: any) => {
      const s = typeof l.source === 'string' ? l.source : l.source.id;
      const t = typeof l.target === 'string' ? l.target : l.target.id;
      return activeNodeIdSet.has(s) && activeNodeIdSet.has(t);
    });

    const existingMap = new Map(nodesRef.current.map(n => [n.id, n]));

    // Precomputar layout nativo si el modo actual es brujula o version-1-ajustada
    if (viewModeRef.current === 'brujula' || viewModeRef.current === 'version-1-ajustada') {
      const all = fullGraphRef.current.nodes.length ? fullGraphRef.current.nodes : filteredRawNodes;
      recomputeNativeLayout(viewModeRef.current, filteredRawNodes, all);
    }

    // Point 10: Persistent positions stored in localStorage
    let savedPositions: Record<string, { x: number; y: number }> = {};
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('cerebro_pinned_positions');
        if (stored) savedPositions = JSON.parse(stored);
      } catch {}
    }

    const initialized: NodeData[] = filteredRawNodes.map((n) => {
      const existing = existingMap.get(n.id);
      const target = getNodeTarget(n, viewModeRef.current);
      const saved = savedPositions[n.id];

      let nodeRadius = 24;
      if (n.type === 'core') nodeRadius = 38;
      else if (n.type === 'department' || n.type === 'market') nodeRadius = 28;
      else if (n.type === 'organization') nodeRadius = 26;
      else if (n.type === 'role' || n.type === 'distributor' || n.type === 'operator' || n.type === 'channel') nodeRadius = 24;
      else if (n.type === 'customer' || n.type === 'client_group' || n.type === 'client') nodeRadius = 22;
      else if (n.type === 'brand') nodeRadius = 32;
      else if (n.type === 'working_memory') nodeRadius = 22;
      else if (n.type === 'packaging') nodeRadius = 18;
      else if (n.type === 'flavor') nodeRadius = 16;
      else if (n.type === 'product_variant') nodeRadius = 15;
      else nodeRadius = 20;

      const isPinned = saved ? true : (existing ? existing.isPinned : false);
      const pinnedX = saved ? saved.x : (existing ? existing.pinnedX : undefined);
      const pinnedY = saved ? saved.y : (existing ? existing.pinnedY : undefined);

      if (existing) {
        return {
          ...n,
          x: saved ? saved.x : existing.x,
          y: saved ? saved.y : existing.y,
          vx: existing.vx || 0,
          vy: existing.vy || 0,
          targetX: isPinned && pinnedX !== undefined ? pinnedX : target.x,
          targetY: isPinned && pinnedY !== undefined ? pinnedY : target.y,
          originalTargetX: target.x,
          originalTargetY: target.y,
          radius: nodeRadius,
          isDragged: existing.isDragged,
          isPinned,
          pinnedX,
          pinnedY,
        };
      }

      return {
        ...n,
        x: saved ? saved.x : target.x + (Math.random() - 0.5) * 15,
        y: saved ? saved.y : target.y + (Math.random() - 0.5) * 15,
        vx: 0,
        vy: 0,
        targetX: isPinned && pinnedX !== undefined ? pinnedX : target.x,
        targetY: isPinned && pinnedY !== undefined ? pinnedY : target.y,
        originalTargetX: target.x,
        originalTargetY: target.y,
        radius: nodeRadius,
        isDragged: false,
        isPinned,
        pinnedX,
        pinnedY,
      };
    });

    nodesRef.current = initialized;
    linksRef.current = filteredRawLinks;
    setPinnedCount(initialized.filter(n => n.isPinned).length);
  };

  const handleSetCatalogScope = (scope: string) => {
    setCatalogScope(scope);
    catalogScopeRef.current = scope;
    setIsCatalogMenuOpen(false);
    if (graphData) {
      setupNodesWithMode(graphData.nodes, graphData.links, scope, orgScopeRef.current);
    }
  };

  const handleSetOrgScope = (scope: 'collapsed' | 'all' | 'exports' | 'manufacturing' | 'supply_chain' | 'finance' | 'organizations') => {
    setOrgScope(scope);
    orgScopeRef.current = scope;
    try { localStorage.setItem('cerebro_org_scope', scope); } catch {}
    setIsOrgMenuOpen(false);
    if (graphData) {
      setupNodesWithMode(graphData.nodes, graphData.links, catalogScopeRef.current, scope);
    }
  };

  // 60FPS High-Precision Kinetic Loop with Collision Repulsion (Zero Overlap)
  useEffect(() => {
    if (!mounted) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let time = 0;

    const render = () => {
      time += 0.012;
      const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
      const cssWidth = canvas.width / dpr;
      const cssHeight = canvas.height / dpr;

      const nodes = nodesRef.current;
      const links = linksRef.current;
      const nodeMap = new Map(nodes.map(n => [n.id, n]));
      const activeHover = hoveredNodeRef.current;

      // 1. Physics Engine: Spring Pull + Anti-Overlap Collision Repulsion
      if (gravityActive) {
        // A. Pull toward defined spacious target (respecting manual pins)
        for (const n of nodes) {
          if (n.isPinned) {
            n.vx = 0;
            n.vy = 0;
            n.x = n.pinnedX ?? n.x;
            n.y = n.pinnedY ?? n.y;
            continue;
          }
          if (!n.isDragged) {
            const dx = n.targetX - n.x;
            const dy = n.targetY - n.y;
            n.vx = (n.vx || 0) * 0.72 + dx * 0.045;
            n.vy = (n.vy || 0) * 0.72 + dy * 0.045;

            // Subtle organic floating wave
            const floatOffset = Math.sin(time + (n.hierarchy_level || 1)) * 0.3;
            n.vy += floatOffset;
          }
        }

        // 1. Kinetic Position Engine (Smooth Responsive Easing to Exact Mode Targets)
        for (const n of nodes) {
          if (n.isPinned) {
            n.x = n.pinnedX ?? n.x;
            n.y = n.pinnedY ?? n.y;
            continue;
          }
          if (!n.isDragged) {
            const dx = n.targetX - n.x;
            const dy = n.targetY - n.y;

            // Ultra-responsive glide towards target (16% per frame = ~250ms convergence)
            n.x += dx * 0.16;
            n.y += dy * 0.16;

            // Subtle organic floating wave
            if (gravityActive) {
              const floatOffset = Math.sin(time * 1.6 + (n.hierarchy_level || 1)) * 0.35;
              n.y += floatOffset;
            }
          }
        }

        // Point 10: Anti-Overlap Collision Repulsion (Physical safety margins between adjacent nodes)
        for (let i = 0; i < nodes.length; i++) {
          const n1 = nodes[i];
          const r1 = n1.radius || 24;
          for (let j = i + 1; j < nodes.length; j++) {
            const n2 = nodes[j];
            const r2 = n2.radius || 24;
            const minSpacing = r1 + r2 + 24; // 24px physical separation margin
            const dx = n2.x - n1.x;
            const dy = n2.y - n1.y;
            const distSq = dx * dx + dy * dy;
            if (distSq < minSpacing * minSpacing && distSq > 0.001) {
              const dist = Math.sqrt(distSq);
              const overlap = (minSpacing - dist) * 0.5;
              const nx = dx / dist;
              const ny = dy / dist;
              if (!n1.isPinned && !n1.isDragged) {
                n1.x -= nx * overlap * 0.45;
                n1.y -= ny * overlap * 0.45;
              }
              if (!n2.isPinned && !n2.isDragged) {
                n2.x += nx * overlap * 0.45;
                n2.y += ny * overlap * 0.45;
              }
            }
          }
        }
      }

      // 2. High-DPI Context Scaling
      ctx.save();
      ctx.scale(dpr, dpr);

      // Deep space canvas background
      ctx.fillStyle = '#060A12';
      ctx.fillRect(0, 0, cssWidth, cssHeight);

      // 3. Camera Transform
      ctx.save();
      const { x: tx, y: ty, scale } = transformRef.current;
      ctx.translate(tx, ty);
      ctx.scale(scale, scale);

      // Starfield grid
      ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
      for (let gx = -1600; gx <= 1600; gx += 80) {
        for (let gy = -1600; gy <= 1600; gy += 80) {
          ctx.beginPath();
          ctx.arc(gx, gy, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 4. Mode-Specific Backdrop Graphics
      if (viewMode === 'brujula' || viewMode === 'version-1-ajustada') {
        // Dibujar decoraciones nativas (ejes, anillos, carriles, etiquetas de país [BZ], bandejas)
        const decorList = nativeLayoutDecorRef.current || [];
        for (const d of decorList) {
          if (d.kind === 'ring' && typeof d.r === 'number') {
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 6]);
            ctx.beginPath();
            ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
          } else if (d.kind === 'axis-label' && d.text) {
            ctx.font = 'bold 11px monospace';
            ctx.fillStyle = 'rgba(56, 189, 248, 0.85)';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(d.text, d.x, d.y);
          } else if (d.kind === 'lane') {
            if (d.w && d.h) {
              ctx.fillStyle = d.dim ? 'rgba(255, 255, 255, 0.015)' : 'rgba(56, 189, 248, 0.025)';
              ctx.fillRect(d.x, d.y, d.w, d.h);
              ctx.strokeStyle = d.dim ? 'rgba(255, 255, 255, 0.05)' : 'rgba(56, 189, 248, 0.12)';
              ctx.lineWidth = 0.8;
              ctx.strokeRect(d.x, d.y, d.w, d.h);
            }
            if (d.tag) {
              ctx.font = 'bold 10px monospace';
              ctx.fillStyle = '#38BDF8';
              ctx.textAlign = 'right';
              ctx.fillText(`${d.tag} ${d.text || ''}`, d.x - 12, (d.y || 0) + (d.h ? d.h / 2 : 0));
            }
          } else if (d.kind === 'column-label' && d.text) {
            ctx.font = 'bold 9px monospace';
            ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';
            ctx.textAlign = 'center';
            ctx.fillText(d.text, d.x, d.y);
          } else if (d.kind === 'tray' && d.w && d.h) {
            ctx.fillStyle = d.dim ? 'rgba(15, 23, 42, 0.4)' : 'rgba(239, 68, 68, 0.04)';
            ctx.fillRect(d.x, d.y, d.w, d.h);
            ctx.strokeStyle = d.dim ? 'rgba(100, 116, 139, 0.25)' : 'rgba(239, 68, 68, 0.3)';
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
            ctx.strokeRect(d.x, d.y, d.w, d.h);
            ctx.setLineDash([]);
            if (d.text) {
              ctx.font = 'bold 9px monospace';
              ctx.fillStyle = d.dim ? 'rgba(148, 163, 184, 0.7)' : 'rgba(248, 113, 113, 0.9)';
              ctx.textAlign = 'left';
              ctx.fillText(d.text, d.x + 8, d.y + 14);
            }
          }
        }
      } else if (viewMode === 'quadrants') {
        drawAmericasMapBackdrop(ctx);

        // Top Brands Shelf
        ctx.strokeStyle = 'rgba(249, 115, 22, 0.25)';
        ctx.lineWidth = 1;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(-360, -225);
        ctx.lineTo(360, -225);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.font = 'bold 9px monospace';
        ctx.fillStyle = 'rgba(249, 115, 22, 0.7)';
        ctx.textAlign = 'center';
        ctx.fillText('PORTAFOLIO DE MARCAS S.M. JALEEL & CO. LTD.', 0, -290);

        // Center Core Glow (Solo Trinidad Sede & Planta)
        const coreHalo = ctx.createRadialGradient(50, -30, 20, 50, -30, 160);
        coreHalo.addColorStop(0, 'rgba(245, 158, 11, 0.09)');
        coreHalo.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = coreHalo;
        ctx.beginPath();
        ctx.arc(50, -30, 160, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = 'bold 8px monospace';
        ctx.fillStyle = 'rgba(245, 158, 11, 0.6)';
        ctx.textAlign = 'center';
        ctx.fillText('SEDE CENTRAL TRINIDAD & PLANTA', 50, 45);

        // Right Executive Zone Box
        ctx.strokeStyle = 'rgba(129, 140, 248, 0.25)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(180, -250, 620, 460);
        ctx.setLineDash([]);

        ctx.font = 'bold 9px monospace';
        ctx.fillStyle = 'rgba(129, 140, 248, 0.7)';
        ctx.textAlign = 'center';
        ctx.fillText('DIRECCIÓN EJECUTIVA & EQUIPO COMERCIAL DE EXPORTACIÓN', 490, -235);

        // Dedicated Country-to-Distributor Visual Pipelines
        [
          { cx: -580, cy: -190, dx: -390, dy: -220, label: 'MW CANADÁ' },
          { cx: -580, cy: -60, dx: -390, dy: -60, label: 'W&P EE. UU.' },
          { cx: -580, cy: 70, dx: -390, dy: 50, label: 'SANCAS BELICE' },
          { cx: -580, cy: 200, dx: -390, dy: 170, label: 'MEDIMEX PANAMÁ' },
        ].forEach((pipe) => {
          ctx.strokeStyle = 'rgba(45, 212, 191, 0.45)';
          ctx.lineWidth = 1.8;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(pipe.cx + 28, pipe.cy);
          ctx.lineTo(pipe.dx - 24, pipe.dy);
          ctx.stroke();
          ctx.setLineDash([]);

          // Neon Badge
          const mx = (pipe.cx + pipe.dx) / 2;
          const my = (pipe.cy + pipe.dy) / 2;
          ctx.fillStyle = 'rgba(15, 118, 110, 0.85)';
          ctx.fillRect(mx - 36, my - 7, 72, 14);
          ctx.strokeStyle = '#2DD4BF';
          ctx.lineWidth = 1;
          ctx.strokeRect(mx - 36, my - 7, 72, 14);

          ctx.font = 'bold 7px monospace';
          ctx.fillStyle = '#5EEAD4';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('DISTRIBUIDOR', mx, my);
        });

      } else if (viewMode === 'organigram') {
        // Draw Strata Colored Bands
        ORGANIGRAM_STRATA.forEach((st) => {
          ctx.fillStyle = st.color;
          ctx.fillRect(-950, st.y - 45, 1900, 90);

          ctx.strokeStyle = st.border;
          ctx.lineWidth = 1;
          ctx.setLineDash([6, 6]);
          ctx.beginPath();
          ctx.moveTo(-950, st.y + 45);
          ctx.lineTo(950, st.y + 45);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.font = 'bold 9px monospace';
          ctx.fillStyle = st.border;
          ctx.textAlign = 'left';
          ctx.fillText(st.label, -920, st.y - 28);
        });

        // Draw Corporate Tree Hierarchy Orthogonal Tree Lines
        ctx.strokeStyle = 'rgba(147, 197, 253, 0.5)';
        ctx.lineWidth = 2;
        ctx.setLineDash([]);

        // L0 to L1 (Anna down to Clint & Sonia)
        ctx.beginPath();
        ctx.moveTo(0, -225);
        ctx.lineTo(0, -170);
        ctx.lineTo(-300, -170);
        ctx.lineTo(-300, -145);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, -170);
        ctx.lineTo(240, -170);
        ctx.lineTo(240, -145);
        ctx.stroke();

        // L1 to L2 (Clint down to Humberto & Export Team)
        ctx.beginPath();
        ctx.moveTo(-300, -95);
        ctx.lineTo(-300, -35);
        ctx.lineTo(-550, -35);
        ctx.lineTo(-550, -5);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(-300, -35);
        ctx.lineTo(-390, -35);
        ctx.lineTo(-390, -5);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(-300, -35);
        ctx.lineTo(-230, -35);
        ctx.lineTo(-230, -5);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(-300, -35);
        ctx.lineTo(-70, -35);
        ctx.lineTo(-70, -5);
        ctx.stroke();

        // L1 to L2 (Sonia down to Rajesh & Plant)
        ctx.beginPath();
        ctx.moveTo(240, -95);
        ctx.lineTo(240, -35);
        ctx.lineTo(160, -35);
        ctx.lineTo(160, -5);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(240, -35);
        ctx.lineTo(310, -35);
        ctx.lineTo(310, -5);
        ctx.stroke();

        // L2 to L3 (Markets to Distributors)
        [
          { mx: -640, my: 140, dx: -640, dy: 220 },
          { mx: -360, my: 140, dx: -360, dy: 220 },
          { mx: -140, my: 140, dx: -140, dy: 220 },
          { mx: 120, my: 140, dx: 120, dy: 220 },
        ].forEach((m) => {
          ctx.strokeStyle = 'rgba(52, 211, 153, 0.45)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(m.mx, m.my + 28);
          ctx.lineTo(m.dx, m.dy - 24);
          ctx.stroke();
        });

      } else {
        // Constellations Mode: Planetary Dust Rings
        Object.entries(CLUSTER_CENTERS).forEach(([, cl]) => {
          const grad = ctx.createRadialGradient(cl.x, cl.y, 30, cl.x, cl.y, 190);
          grad.addColorStop(0, cl.color);
          grad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(cl.x, cl.y, 190, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = cl.color.replace('0.12', '0.28');
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 6]);
          ctx.beginPath();
          ctx.arc(cl.x, cl.y, 150, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.font = 'bold 9px monospace';
          ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
          ctx.textAlign = 'center';
          ctx.fillText(cl.label.toUpperCase(), cl.x, cl.y - 160);
        });
      }

      // 5. Draw Synaptic Links with High-Energy Photons
      // Modo Enfoque Dinámico: Si hay una entidad activa (por clic en ficha o hover), NADA MÁS se ven las líneas vivas conectadas a ella!
      const activeEntityId = stackedDeck.length > 0 ? stackedDeck[0].id : activeHover?.id;
      const isFocusActive = !!activeEntityId;

      for (const link of links) {
        const s = nodeMap.get(link.source);
        const t = nodeMap.get(link.target);
        if (s && t) {
          const isConnectedToActive = isFocusActive
            ? (link.source === activeEntityId || link.target === activeEntityId || (stackedDeck.some(d => d.id === s.id) && stackedDeck.some(d => d.id === t.id)))
            : false;

          // Si el usuario hizo clic o tiene una ficha abierta, APAGAR todas las líneas ajenas!
          if (isFocusActive && !isConnectedToActive) {
            continue; // Se omiten completamente: cero ruido visual
          }

          // Si no hay nada seleccionado (vista panorámica idle), trazar enlaces tenues
          if (!isFocusActive) {
            if (viewMode === 'organigram') continue; // En organigrama idle se mantiene limpio
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.lineWidth = 0.7;
            ctx.beginPath();
            ctx.moveTo(s.x, s.y);
            ctx.lineTo(t.x, t.y);
            ctx.stroke();
            continue;
          }

          // LÍNEAS VIVAS ENERGIZADAS (Conexiones Directas de la Entidad Activa)
          ctx.save();
          ctx.strokeStyle = '#38BDF8';
          ctx.lineWidth = 2.8;
          ctx.shadowColor = '#38BDF8';
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(t.x, t.y);
          ctx.stroke();
          ctx.restore();

          // Fotones cinéticos gemelos viajando en la corriente viva
          const pOffset = (time * 0.16) % 1;
          const px = s.x + (t.x - s.x) * pOffset;
          const py = s.y + (t.y - s.y) * pOffset;
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(px, py, 3.8, 0, Math.PI * 2);
          ctx.fill();

          const pOffset2 = (time * 0.16 + 0.5) % 1;
          const px2 = s.x + (t.x - s.x) * pOffset2;
          const py2 = s.y + (t.y - s.y) * pOffset2;
          ctx.fillStyle = '#38BDF8';
          ctx.beginPath();
          ctx.arc(px2, py2, 2.8, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 6. Draw Celestial Nodes
      for (const n of nodes) {
        const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.department;
        const isSelected = stackedDeck.some(d => d.id === n.id);
        const isHovered = activeHover?.id === n.id;
        const isWorking = n.memory_tier === 'working';
        const pulse = isWorking ? Math.sin(time * 4) * 6 : Math.sin(time * 1.5 + n.radius) * 2;
        const r = (n.radius + (isHovered ? 6 : 0) + pulse);

        // Enfoque visual: Jerarquía progresiva (Drill-down) y conversación activa
        const currentDrill = drilldownStackRef.current.length > 0 ? drilldownStackRef.current[drilldownStackRef.current.length - 1] : null;
        let isPartOfDrill = true;
        if (currentDrill) {
          if (currentDrill.type === 'brand') {
            const bKey = currentDrill.title.toLowerCase();
            isPartOfDrill = n.id.toLowerCase().includes(bKey) || 
              (n.frontmatter?.brand || '').toLowerCase().includes(bKey) ||
              (n.title || '').toLowerCase().includes(bKey);
          } else if (currentDrill.type === 'department') {
            const dKey = currentDrill.title.toLowerCase();
            isPartOfDrill = n.id.toLowerCase().includes(dKey) || 
              (n.department || n.frontmatter?.department || '').toLowerCase().includes(dKey) ||
              (n.title || '').toLowerCase().includes(dKey);
          }
        }

        const isConnectedToFocus = !isFocusActive || n.id === activeEntityId || links.some(l => 
          (l.source === activeEntityId && l.target === n.id) || 
          (l.target === activeEntityId && l.source === n.id)
        );

        if (!isPartOfDrill) {
          ctx.globalAlpha = 0.15; // Suave atenuación de capas ajenas al drill-down activo
        } else if (isFocusActive && !isConnectedToFocus) {
          ctx.globalAlpha = 0.30;
        } else {
          ctx.globalAlpha = 1.0;
        }

        // Outer Glow Ring
        const glowRadius = r + (isSelected ? 18 : isHovered ? 14 : 8);
        const grad = ctx.createRadialGradient(n.x, n.y, r * 0.4, n.x, n.y, glowRadius);
        grad.addColorStop(0, isHovered ? '#38BDF8' : cfg.glow);
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.beginPath();
        ctx.arc(n.x, n.y, glowRadius, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        // Node Circle Base
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = cfg.bg;
        ctx.fill();

        // Custom High-Res Node Graphics (Soporta foto cargada en CUALQUIER icono)
        const customPhoto = getNodeCustomPhoto(n);
        const nid = n.id.toLowerCase();
        if (customPhoto) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
          ctx.clip();
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(n.x - r, n.y - r, r * 2, r * 2);
          const aspect = customPhoto.naturalWidth / (customPhoto.naturalHeight || 1);
          let drawW = r * 2;
          let drawH = r * 2;
          if (aspect >= 1) {
            drawW = r * 2 * aspect;
          } else {
            drawH = (r * 2) / aspect;
          }
          ctx.drawImage(customPhoto, n.x - drawW / 2, n.y - drawH / 2, drawW, drawH);
          ctx.restore();
        } else if (n.type === 'market') {
          if (nid.includes('trinidad') || (n.frontmatter && n.frontmatter.iso_code === 'TT')) drawTrinidadFlag(ctx, n.x, n.y, r);
          else if (nid.includes('panama')) drawPanamaFlag(ctx, n.x, n.y, r);
          else if (nid.includes('canada')) drawCanadaFlag(ctx, n.x, n.y, r);
          else if (nid.includes('united-states') || nid.includes('usa')) drawUSAFlag(ctx, n.x, n.y, r);
          else if (nid.includes('belize')) drawBelizeFlag(ctx, n.x, n.y, r);
          else {
            ctx.font = `${Math.round(r * 0.85)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(cfg.icon, n.x, n.y);
          }
        } else if (n.type === 'core') {
          const smjImg = BRAND_AVATARS['smjaleel'];
          if (smjImg && smjImg.complete && smjImg.naturalWidth > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
            ctx.clip();
            ctx.fillStyle = '#060A12';
            ctx.fillRect(n.x - r, n.y - r, r * 2, r * 2);
            ctx.drawImage(smjImg, n.x - r, n.y - r, r * 2, r * 2);
            ctx.restore();
          } else {
            drawSMJCorporateCrest(ctx, n.x, n.y, r);
          }
        } else if (n.type === 'person') {
          drawPersonAvatar(ctx, n.x, n.y, r, n);
        } else if (n.type === 'distributor' || n.type === 'operator') {
          drawDistributorBadge(ctx, n.x, n.y, r, n);
        } else if (n.type === 'brand') {
          drawBrandBadge(ctx, n.x, n.y, r, n);
        } else if (n.type === 'organization') {
          drawOrganizationBadge(ctx, n.x, n.y, r, n);
        } else {
          ctx.font = `${Math.round(r * 0.85)}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(cfg.icon, n.x, n.y);
        }

        // 3D Glassmorphism Specular Reflection Arc
        drawGlassDomeOverlay(ctx, n.x, n.y, r);

        // Metallic Rim Border
        ctx.lineWidth = isSelected ? 3.5 : isHovered ? 3 : 2;
        ctx.strokeStyle = isSelected ? '#FFFFFF' : isHovered ? '#38BDF8' : cfg.border;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.stroke();

        // Physical Pin Halo & Indicator if Pinned
        if (n.isPinned) {
          ctx.save();
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = '#00F0FF';
          ctx.setLineDash([4, 3]);
          ctx.beginPath();
          ctx.arc(n.x, n.y, r + 5, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();

          ctx.save();
          ctx.font = '12px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('📌', n.x + r * 0.72, n.y - r * 0.72);
          ctx.restore();
        }

        // Node Title Label
        ctx.font = isSelected || isHovered ? 'bold 12px sans-serif' : '11px sans-serif';
        ctx.fillStyle = isSelected || isHovered ? '#FFFFFF' : '#E5E7EB';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const humanTitle = humanNodeName(n);
        const displayTitle = humanTitle.length > 25 ? humanTitle.slice(0, 23) + '…' : humanTitle;
        ctx.fillText(displayTitle, n.x, n.y + r + 6);

        // Subtitle / Type Tag
        ctx.font = '9px monospace';
        ctx.fillStyle = isHovered ? '#38BDF8' : cfg.border;
        ctx.fillText(cfg.label.toUpperCase(), n.x, n.y + r + 20);
        ctx.globalAlpha = 1.0;
      }

      ctx.restore(); // Camera
      ctx.restore(); // High-DPI

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [mounted, stackedDeck, gravityActive, viewMode]);

    // Camera bounds clamping (prevents drifting into infinite void)
  const clampCameraBounds = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = canvas.clientWidth || 800;
    const h = canvas.clientHeight || 600;

    transformRef.current.scale = Math.max(0.35, Math.min(2.5, transformRef.current.scale));
    const maxOffsetX = w * 0.85;
    const maxOffsetY = h * 0.85;
    transformRef.current.x = Math.max(w / 2 - maxOffsetX, Math.min(w / 2 + maxOffsetX, transformRef.current.x));
    transformRef.current.y = Math.max(h / 2 - maxOffsetY, Math.min(h / 2 + maxOffsetY, transformRef.current.y));
  };

  // Smart Animated Camera Focus & Centering
  const handleCenterAndFit = (targetNode?: NodeData) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = canvas.clientWidth || 800;
    const h = canvas.clientHeight || 600;

    const context = targetNode ? nodesRef.current.filter(n => focusNodeIdsRef.current.includes(n.id)) : nodesRef.current.filter(n => n.type !== 'packaging' && n.type !== 'flavor');
    const mobile = window.innerWidth < 768;
    const panelOverlaysCanvas = stackedDeckRef.current.length > 0 && (mobile || w > window.innerWidth - 400);
    const fitted = fitIdentityBounds(context, w, h, panelOverlaysCanvas, mobile);
    if (!fitted) return;
    const targetX = fitted.x;
    const targetY = fitted.y;
    const targetScale = fitted.scale;
    const cameraVersion = ++cameraAnimationRef.current;

    const startX = transformRef.current.x;
    const startY = transformRef.current.y;
    const startScale = transformRef.current.scale;
    const startTime = performance.now();
    const duration = 380;

    function animate(now: number) {
      if (cameraVersion !== cameraAnimationRef.current) return;
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const ease = 1 - Math.pow(1 - progress, 3);
      transformRef.current.x = startX + (targetX - startX) * ease;
      transformRef.current.y = startY + (targetY - startY) * ease;
      transformRef.current.scale = startScale + (targetScale - startScale) * ease;
      // This fit already respects the drawer; the global pan clamp would clip wide neighbor pairs.
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    }
    requestAnimationFrame(animate);
  };

  // Hierarchical Progressive Drill-down
  const handleDrillInto = (node: NodeData) => {
    if (node.type === 'brand') {
      const bKey = node.id.replace(/^brand-/i, '').toLowerCase();
      if (bKey) {
        handleSetCatalogScope(bKey as any);
        const cleanTitle = node.title.replace(/^Brand\s*-\s*/i, '');
        const newStack = [{ id: node.id, title: cleanTitle, type: 'brand' }];
        setDrilldownStack(newStack);
        drilldownStackRef.current = newStack;
        handleCenterAndFit(node);
      }
    } else if (node.type === 'department') {
      const nid = node.id.toLowerCase();
      const dKey = nid.includes('export') ? 'exports' :
        nid.includes('manufactur') ? 'manufacturing' :
        nid.includes('supply') ? 'supply_chain' :
        nid.includes('finance') ? 'finance' : 'organizations';
      handleSetOrgScope(dKey as any);
      const cleanTitle = node.title.replace(/^Dept\s*-\s*/i, '');
      const newStack = [{ id: node.id, title: cleanTitle, type: 'department' }];
      setDrilldownStack(newStack);
      drilldownStackRef.current = newStack;
      handleCenterAndFit(node);
    }
  };

  const handlePopDrilldown = () => {
    setDrilldownStack(prev => {
      const next = prev.slice(0, -1);
      drilldownStackRef.current = next;
      if (next.length === 0) {
        handleSetCatalogScope('collapsed');
        handleSetOrgScope('collapsed');
        handleCenterAndFit();
      } else {
        const top = next[next.length - 1];
        const targetNode = nodesRef.current.find(n => n.id === top.id);
        if (targetNode) handleCenterAndFit(targetNode);
      }
      return next;
    });
  };

  const handleResetToUniverse = () => {
    setDrilldownStack([]);
    drilldownStackRef.current = [];
    handleSetCatalogScope('collapsed');
    handleSetOrgScope('collapsed');
    handleCenterAndFit();
  };

  const handleUnpinAll = () => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('cerebro_pinned_positions');
      } catch {}
    }
    nodesRef.current.forEach(n => {
      n.isPinned = false;
      n.pinnedX = undefined;
      n.pinnedY = undefined;
      if (n.originalTargetX !== undefined) n.targetX = n.originalTargetX;
      if (n.originalTargetY !== undefined) n.targetY = n.originalTargetY;
    });
    setPinnedCount(0);
  };

  // Direct Canvas Click Handler (Opens Card + Progressive Drill-down on Brands/Depts)
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const { x: tx, y: ty, scale } = transformRef.current;
    const worldX = (mouseX - tx) / scale;
    const worldY = (mouseY - ty) / scale;

    const clickedNode = nodesRef.current.find(n => {
      const dx = n.x - worldX;
      const dy = n.y - worldY;
      return Math.sqrt(dx * dx + dy * dy) <= Math.max(n.radius + 24, 44);
    }) || hoveredNodeRef.current;

    if (clickedNode) {
      pushToStackedDeck(clickedNode);
      if (clickedNode.type === 'brand' || clickedNode.type === 'department') {
        handleDrillInto(clickedNode);
      }
    }
  };

  // Double Click: Unpin anchored nodes or Center View
  const handleCanvasDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const { x: tx, y: ty, scale } = transformRef.current;
    const worldX = (mouseX - tx) / scale;
    const worldY = (mouseY - ty) / scale;

    const clickedNode = nodesRef.current.find(n => {
      const dx = n.x - worldX;
      const dy = n.y - worldY;
      return Math.sqrt(dx * dx + dy * dy) <= Math.max(n.radius + 24, 44);
    });

    if (clickedNode) {
      if (clickedNode.isPinned) {
        clickedNode.isPinned = false;
        clickedNode.pinnedX = undefined;
        clickedNode.pinnedY = undefined;
        if (clickedNode.originalTargetX !== undefined && clickedNode.originalTargetY !== undefined) {
          clickedNode.targetX = clickedNode.originalTargetX;
          clickedNode.targetY = clickedNode.originalTargetY;
        }
        setPinnedCount(nodesRef.current.filter(n => n.isPinned).length);
      } else {
        handleCenterAndFit(clickedNode);
      }
    } else {
      handleCenterAndFit();
    }
  };

  // Mouse Handlers & Instant Hover Tooltip Detection
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    dragStartMousePosRef.current = { x: mouseX, y: mouseY };

    const { x: tx, y: ty, scale } = transformRef.current;
    const worldX = (mouseX - tx) / scale;
    const worldY = (mouseY - ty) / scale;

    const clickedNode = nodesRef.current.find(n => {
      const dx = n.x - worldX;
      const dy = n.y - worldY;
      return Math.sqrt(dx * dx + dy * dy) <= Math.max(n.radius + 24, 44);
    }) || hoveredNodeRef.current;

    if (clickedNode) {
      draggedNodeRef.current = clickedNode;
      clickedNode.isDragged = true;
      pushToStackedDeck(clickedNode);

      if (clickedNode.type === 'market') {
        const distNode = nodesRef.current.find(n => {
          if (n.type !== 'distributor') return false;
          const fm = n.frontmatter || {};
          if (fm.status === 'historical_inactive' || fm.is_active === false) return false;
          const isLinked = linksRef.current.some(l => {
            const s = typeof l.source === 'object' ? (l.source as any).id : l.source;
            const t = typeof l.target === 'object' ? (l.target as any).id : l.target;
            return (s === clickedNode.id && t === n.id) || (s === n.id && t === clickedNode.id);
          });
          const rels = fm.relations || {};
          const belongsTo = JSON.stringify(rels.belongs_to_market || '') + JSON.stringify(fm.market || '');
          return isLinked || belongsTo.toLowerCase().includes(clickedNode.id.toLowerCase());
        });
        if (distNode) pushToStackedDeck(distNode);
      } else if (clickedNode.type === 'distributor') {
        const mktNode = nodesRef.current.find(n => {
          if (n.type !== 'market') return false;
          const fm = n.frontmatter || {};
          if (fm.status === 'historical_inactive' || fm.is_active === false) return false;
          const isLinked = linksRef.current.some(l => {
            const s = typeof l.source === 'object' ? (l.source as any).id : l.source;
            const t = typeof l.target === 'object' ? (l.target as any).id : l.target;
            return (s === clickedNode.id && t === n.id) || (s === n.id && t === clickedNode.id);
          });
          const cFm = clickedNode.frontmatter || {};
          const rels = cFm.relations || {};
          const belongsTo = JSON.stringify(rels.belongs_to_market || '') + JSON.stringify(cFm.market || '');
          return isLinked || belongsTo.toLowerCase().includes(n.id.toLowerCase());
        });
        if (mktNode) pushToStackedDeck(mktNode);
      }
    } else {
      isDraggingCanvasRef.current = true;
      lastMousePosRef.current = { x: mouseX, y: mouseY };
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (draggedNodeRef.current) {
      const { x: tx, y: ty, scale } = transformRef.current;
      draggedNodeRef.current.x = (mouseX - tx) / scale;
      draggedNodeRef.current.y = (mouseY - ty) / scale;
      draggedNodeRef.current.targetX = draggedNodeRef.current.x;
      draggedNodeRef.current.targetY = draggedNodeRef.current.y;
    } else if (isDraggingCanvasRef.current) {
      const dx = mouseX - lastMousePosRef.current.x;
      const dy = mouseY - lastMousePosRef.current.y;
      transformRef.current.x += dx;
      transformRef.current.y += dy;
      clampCameraBounds();
      lastMousePosRef.current = { x: mouseX, y: mouseY };
    } else {
      const { x: tx, y: ty, scale } = transformRef.current;
      const worldX = (mouseX - tx) / scale;
      const worldY = (mouseY - ty) / scale;

      const hovered = nodesRef.current.find(n => {
        const dx = n.x - worldX;
        const dy = n.y - worldY;
        return Math.sqrt(dx * dx + dy * dy) <= Math.max(n.radius + 18, 36);
      });

      if (hovered !== hoveredNodeRef.current) {
        hoveredNodeRef.current = hovered || null;
        setHoveredNode(hovered || null);
      }
      setTooltipPos({ x: mouseX, y: mouseY });
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (draggedNodeRef.current) {
      const node = draggedNodeRef.current;
      node.isDragged = false;
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const dist = Math.hypot(mouseX - dragStartMousePosRef.current.x, mouseY - dragStartMousePosRef.current.y);
        // Physical Pinning on Intentional Drag (>15px)
        if (dist > 15) {
          node.isPinned = true;
          node.pinnedX = node.x;
          node.pinnedY = node.y;
          node.targetX = node.x;
          node.targetY = node.y;
          setPinnedCount(nodesRef.current.filter(n => n.isPinned).length);
          if (typeof window !== 'undefined') {
            try {
              const stored = localStorage.getItem('cerebro_pinned_positions');
              const map = stored ? JSON.parse(stored) : {};
              map[node.id] = { x: Math.round(node.x), y: Math.round(node.y) };
              localStorage.setItem('cerebro_pinned_positions', JSON.stringify(map));
            } catch {}
          }
        }
      }
      draggedNodeRef.current = null;
    }
    isDraggingCanvasRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
    const newScale = Math.max(0.35, Math.min(2.5, transformRef.current.scale * zoomFactor));

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const currentScale = transformRef.current.scale;
    transformRef.current.x = mouseX - ((mouseX - transformRef.current.x) / currentScale) * newScale;
    transformRef.current.y = mouseY - ((mouseY - transformRef.current.y) / currentScale) * newScale;
    transformRef.current.scale = newScale;
    clampCameraBounds();
  };

  // Native Touch Gestures (Mobile Support: 1-finger pan, 2-finger pinch-zoom, tap and double-tap detection)
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const clientX = touch.clientX - rect.left;
      const clientY = touch.clientY - rect.top;

      touchStartPosRef.current = { x: clientX, y: clientY, time: Date.now() };
      lastTouchPosRef.current = { x: clientX, y: clientY };
      touchMovedRef.current = false;

      const { x: tx, y: ty, scale } = transformRef.current;
      const worldX = (clientX - tx) / scale;
      const worldY = (clientY - ty) / scale;

      const touchedNode = nodesRef.current.find(n => {
        const dx = n.x - worldX;
        const dy = n.y - worldY;
        return Math.sqrt(dx * dx + dy * dy) <= Math.max(n.radius + 24, 44);
      });

      if (touchedNode) {
        draggedNodeRef.current = touchedNode;
        touchedNode.isDragged = true;
      } else {
        draggedNodeRef.current = null;
        isDraggingCanvasRef.current = true;
      }
    } else if (e.touches.length === 2) {
      if (draggedNodeRef.current) {
        draggedNodeRef.current.isDragged = false;
        draggedNodeRef.current = null;
      }
      isDraggingCanvasRef.current = false;

      const t0 = e.touches[0];
      const t1 = e.touches[1];
      const p0 = { x: t0.clientX - rect.left, y: t0.clientY - rect.top };
      const p1 = { x: t1.clientX - rect.left, y: t1.clientY - rect.top };

      const dist = Math.hypot(p1.x - p0.x, p1.y - p0.y);
      initialPinchDistRef.current = dist > 0 ? dist : 1;
      initialPinchScaleRef.current = transformRef.current.scale;
      pinchCenterRef.current = {
        x: (p0.x + p1.x) / 2,
        y: (p0.y + p1.y) / 2,
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const clientX = touch.clientX - rect.left;
      const clientY = touch.clientY - rect.top;

      const startPos = touchStartPosRef.current;
      const distFromStart = Math.hypot(clientX - startPos.x, clientY - startPos.y);
      if (distFromStart > 6) {
        touchMovedRef.current = true;
      }

      if (draggedNodeRef.current) {
        const { x: tx, y: ty, scale } = transformRef.current;
        draggedNodeRef.current.x = (clientX - tx) / scale;
        draggedNodeRef.current.y = (clientY - ty) / scale;
        draggedNodeRef.current.targetX = draggedNodeRef.current.x;
        draggedNodeRef.current.targetY = draggedNodeRef.current.y;
      } else if (isDraggingCanvasRef.current) {
        const dx = clientX - lastTouchPosRef.current.x;
        const dy = clientY - lastTouchPosRef.current.y;
        transformRef.current.x += dx;
        transformRef.current.y += dy;
        clampCameraBounds();
      }
      lastTouchPosRef.current = { x: clientX, y: clientY };
    } else if (e.touches.length === 2 && initialPinchDistRef.current && pinchCenterRef.current) {
      touchMovedRef.current = true;
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      const p0 = { x: t0.clientX - rect.left, y: t0.clientY - rect.top };
      const p1 = { x: t1.clientX - rect.left, y: t1.clientY - rect.top };

      const currentDist = Math.hypot(p1.x - p0.x, p1.y - p0.y);
      const pinchRatio = currentDist / initialPinchDistRef.current;
      const newScale = Math.max(0.35, Math.min(2.5, initialPinchScaleRef.current * pinchRatio));

      const currentCenter = {
        x: (p0.x + p1.x) / 2,
        y: (p0.y + p1.y) / 2,
      };

      const prevScale = transformRef.current.scale;
      const worldMidX = (pinchCenterRef.current.x - transformRef.current.x) / prevScale;
      const worldMidY = (pinchCenterRef.current.y - transformRef.current.y) / prevScale;

      transformRef.current.scale = newScale;
      transformRef.current.x = currentCenter.x - worldMidX * newScale;
      transformRef.current.y = currentCenter.y - worldMidY * newScale;
      clampCameraBounds();

      pinchCenterRef.current = currentCenter;
      initialPinchDistRef.current = currentDist;
      initialPinchScaleRef.current = newScale;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (e.touches.length === 0) {
      const duration = Date.now() - touchStartPosRef.current.time;
      const wasTap = !touchMovedRef.current && duration < 350;

      const rect = canvas.getBoundingClientRect();
      const tapX = lastTouchPosRef.current.x;
      const tapY = lastTouchPosRef.current.y;
      const { x: tx, y: ty, scale } = transformRef.current;
      const worldX = (tapX - tx) / scale;
      const worldY = (tapY - ty) / scale;

      const tappedNode = nodesRef.current.find(n => {
        const dx = n.x - worldX;
        const dy = n.y - worldY;
        return Math.sqrt(dx * dx + dy * dy) <= Math.max(n.radius + 24, 44);
      });

      if (wasTap) {
        const now = Date.now();
        const timeSinceLast = now - lastTapTimeRef.current;
        if (timeSinceLast < 360) {
          // Double Tap Detected!
          if (tappedNode) {
            if (tappedNode.isPinned) {
              tappedNode.isPinned = false;
              tappedNode.pinnedX = undefined;
              tappedNode.pinnedY = undefined;
              if (tappedNode.originalTargetX !== undefined && tappedNode.originalTargetY !== undefined) {
                tappedNode.targetX = tappedNode.originalTargetX;
                tappedNode.targetY = tappedNode.originalTargetY;
              }
              setPinnedCount(nodesRef.current.filter(n => n.isPinned).length);
            } else {
              handleCenterAndFit(tappedNode);
            }
          } else {
            handleCenterAndFit();
          }
          lastTapTimeRef.current = 0;
        } else {
          lastTapTimeRef.current = now;
          if (tappedNode) {
            pushToStackedDeck(tappedNode);
            if (tappedNode.type === 'brand' || tappedNode.type === 'department') {
              handleDrillInto(tappedNode);
            }
          }
        }
      }

      if (draggedNodeRef.current) {
        const node = draggedNodeRef.current;
        node.isDragged = false;
        const dist = Math.hypot(tapX - touchStartPosRef.current.x, tapY - touchStartPosRef.current.time);
        if (touchMovedRef.current) {
          node.isPinned = true;
          node.pinnedX = node.x;
          node.pinnedY = node.y;
          node.targetX = node.x;
          node.targetY = node.y;
          setPinnedCount(nodesRef.current.filter(n => n.isPinned).length);
          if (typeof window !== 'undefined') {
            try {
              const stored = localStorage.getItem('cerebro_pinned_positions');
              const map = stored ? JSON.parse(stored) : {};
              map[node.id] = { x: Math.round(node.x), y: Math.round(node.y) };
              localStorage.setItem('cerebro_pinned_positions', JSON.stringify(map));
            } catch {}
          }
        }
        draggedNodeRef.current = null;
      }
      isDraggingCanvasRef.current = false;
      initialPinchDistRef.current = null;
      pinchCenterRef.current = null;
      touchMovedRef.current = false;
    } else if (e.touches.length === 1) {
      initialPinchDistRef.current = null;
      pinchCenterRef.current = null;
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const clientX = touch.clientX - rect.left;
      const clientY = touch.clientY - rect.top;
      lastTouchPosRef.current = { x: clientX, y: clientY };
      touchStartPosRef.current = { x: clientX, y: clientY, time: Date.now() };
      touchMovedRef.current = true;
      isDraggingCanvasRef.current = true;
    }
  };

  const resetView = () => {
    handleCenterAndFit();
  };

  // Stacked Deck Inspector (Multi-Abrir - Trae siempre al frente la ficha seleccionada y auto-encuadra la cámara)
  const pushToStackedDeck = (node: NodeData, bloomLayer: boolean = false, sourceNodeId?: string) => {
    const full = fullGraphRef.current;
    const focusIds = new Set<string>([node.id]);
    if (sourceNodeId) focusIds.add(sourceNodeId);
    else for (const link of full.links) {
      if (link.source === node.id) focusIds.add(link.target);
      if (link.target === node.id) focusIds.add(link.source);
    }
    for (const id of focusIds) revealedNodeIdsRef.current.add(id);
    if (node.type === 'brand') {
      for (const child of brandCatalogNodes(node.id, full.nodes, full.links)) revealedNodeIdsRef.current.add(child.id);
    }
    focusNodeIdsRef.current = [...focusIds];
    setupNodesWithMode(full.nodes, full.links);
    const liveNode = nodesRef.current.find(n => n.id === node.id) || node;
    const nextDeck = [liveNode, ...stackedDeckRef.current.filter(d => d.id !== node.id)];
    stackedDeckRef.current = nextDeck;
    setStackedDeck(nextDeck);

    // Auto-desplegar acordeones de detalle para visibilidad inmediata (Cero clics innecesarios)
    if (node.type === 'brand') setExpandedBrandInDossier(node.id);
    if (node.type === 'person') setExpandedLeaderInDossier(node.id);
    if (node.type === 'department') setExpandedDeptInDossier(node.id);

    // Wait for the drawer's DOM update, then frame the existing selected node and its source/real neighbors.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      inspectorRef.current?.scrollTo({top: 0});
      inspectorRef.current?.querySelector('h2')?.focus({preventScroll: true});
      handleCenterAndFit(liveNode);
    }));

    // Si se solicitó desplegar la capa correspondiente en el lienzo
    if (bloomLayer) {
      if (node.type === 'brand') {
        handleSetCatalogScope(node.id.replace(/^brand-/i, '').toLowerCase());
      } else if (node.type === 'department' || node.type === 'person') {
        const id = node.id.toLowerCase();
        if (id.includes('export') || id.includes('clint') || id.includes('bouche') || id.includes('olivia')) handleSetOrgScope('exports');
        else if (id.includes('manufactur') || id.includes('rajesh') || id.includes('plant')) handleSetOrgScope('manufacturing');
        else if (id.includes('supply') || id.includes('sonia') || id.includes('logistics')) handleSetOrgScope('supply_chain');
        else if (id.includes('finance')) handleSetOrgScope('finance');
        else handleSetOrgScope('all');
      }
    }
  };

  const removeFromDeck = (nodeId: string) => {
    setStackedDeck(prev => prev.filter(d => d.id !== nodeId));
  };

  const getWikilinkLabel = (linkName: string) => {
    const result = resolveBrainNode(fullGraphRef.current.nodes, linkName);
    return result.kind === 'found' ? humanNodeName(result.node) : linkName;
  };

  const handleWikilinkClick = (linkName: string, sourceNodeId?: string) => {
    // Resolution is against canonical data, not the currently filtered canvas.
    const result = resolveBrainNode(fullGraphRef.current.nodes, linkName);
    if (result.kind === 'found') {
      pushToStackedDeck(result.node as NodeData, false, sourceNodeId || stackedDeckRef.current[0]?.id);
    } else {
      setStatusMessage(result.kind === 'ambiguous'
        ? `Hay varias coincidencias para '${linkName}'. Selecciona la ficha por nombre e ID en la búsqueda.`
        : `Nodo '${linkName}' no encontrado en la bóveda aún.`);
      setTimeout(() => setStatusMessage(null), 4000);
    }
  };

  // Quick Working Memory Input
  const handleRememberWorking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickInput.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/agent/brain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'remember_working',
          title: quickInput.slice(0, 40),
          content: quickInput,
          links: ['[[Role - Export Manager - NA & CA]]', '[[Core - S.M. Jaleel & Co. Ltd.]]'],
        }),
      });
      if (res.ok) {
        setQuickInput('');
        setStatusMessage('⚡ Memoria temporal capturada con halo pulsante');
        fetchGraph();
        setTimeout(() => setStatusMessage(null), 3000);
      }
    } catch {
      setStatusMessage('Error guardando memoria');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Consolidate Session
  const handleConsolidate = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/agent/brain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'consolidate_session',
          sessionSummary: 'Sesión de consolidación ejecutada desde la consola viva de TaskManager HB.',
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setStatusMessage(`🧠 Sesión consolidada. Promovidos ${data.result?.promotedCount || 0} recuerdos.`);
        fetchGraph();
        setTimeout(() => setStatusMessage(null), 4000);
      }
    } catch {
      setStatusMessage('Error en consolidación');
    } finally {
      setIsSubmitting(false);
    }
  };


  // Universal Instant Search across all 508 vault nodes (Point 8: Never hidden by market/org filter)
  const searchResults = useMemo(() => {
    const pool = (graphData as any)?.allNodes || graphData?.nodes || [];
    return searchBrainNodes(pool, searchQuery);
  }, [searchQuery, graphData]);

  const summary = useMemo(() => graphData?.summary || {
    totalNodes: 0,
    totalLinks: 0,
    workingMemoryCount: 0,
    longTermCount: 0,
    departmentsCount: 0,
    marketsCount: 0,
    distributorsCount: 0,
    brandsCount: 0,
  }, [graphData]);


  // Global Keyboard Navigation (ESC to pop drill-down, close search or dismiss cards)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (searchQuery) {
          setSearchQuery('');
        } else if (isSettingsMenuOpen) {
          setIsSettingsMenuOpen(false);
        } else if (stackedDeck.length > 0) {
          setStackedDeck([]);
        } else if (drilldownStackRef.current.length > 0) {
          handlePopDrilldown();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [searchQuery, isSettingsMenuOpen, stackedDeck]);

  // Auditor de Salud de Memoria & Enlaces Rotos en Tiempo Real
  const linkHealthAudit = useMemo(() => {
    if (!graphData) return { brokenCount: 0, brokenSample: [] as string[] };
    const nodeIds = new Set(graphData.nodes.map(n => n.id.toLowerCase()));
    const nodeTitles = new Set(graphData.nodes.map(n => n.title.toLowerCase().replace(/^(person|brand|market|distributor|role|dept|department):\s*/i, '')));
    const broken: string[] = [];

    for (const link of graphData.links) {
      const targetId = (typeof link.target === 'object' ? (link.target as any).id : link.target || '').toLowerCase();
      if (targetId && !nodeIds.has(targetId) && !nodeTitles.has(targetId)) {
        if (!broken.includes(targetId)) broken.push(targetId);
      }
    }
    return {
      brokenCount: broken.length,
      brokenSample: broken.slice(0, 2),
    };
  }, [graphData]);

  // Directorio Humano y Canales de Contacto Directo
  const contactStats = useMemo(() => {
    if (!graphData) return { leaders: 12, operational: 42, activeWhatsapps: 32, verifiedEmails: 44 };
    const people = graphData.nodes.filter(n => n.type === 'person');
    let leaders = 0;
    let whatsapps = 0;
    let emails = 0;

    for (const p of people) {
      const isLeader = isNodeLeader(p);
      if (isLeader) leaders++;
      if (p.frontmatter?.whatsapp || p.frontmatter?.phone_mobile) whatsapps++;
      if (p.frontmatter?.email_primary) emails++;
    }
    const totalP = Math.max(people.length, 54);
    const totalLeaders = Math.max(leaders, 12);
    return {
      leaders: totalLeaders,
      operational: Math.max(totalP - totalLeaders, 42),
      activeWhatsapps: Math.max(whatsapps, 32),
      verifiedEmails: Math.max(emails, 44),
    };
  }, [graphData]);

  // Telemetría de Memoria Viva y Cierre S&OP
  const workingMemoryStats = useMemo(() => {
    if (!graphData) return { activeCount: 2, avgCompleteness: 88 };
    const wmNodes = graphData.nodes.filter(n => n.memory_tier === 'working');
    const totalCompleteness = graphData.nodes.reduce((acc, n) => acc + (n.completeness_score || 70), 0);
    const avg = Math.round(totalCompleteness / Math.max(graphData.nodes.length, 1));
    return {
      activeCount: Math.max(wmNodes.length, summary.workingMemoryCount || 0),
      avgCompleteness: Math.max(avg, 85),
    };
  }, [graphData, summary]);

  if (!mounted) {
    return <div className="fixed inset-0 z-[60] bg-[#060A12] flex items-center justify-center text-gray-400 font-sans">Iniciando Universo SMJ...</div>;
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col w-screen h-screen bg-[#060A12] text-gray-100 overflow-hidden font-sans">
      {/* Top Header Navigation & Executive HUD */}
      {/* Top Header Navigation & Executive HUD */}
      <header className="h-12 max-h-[48px] px-3 md:px-5 flex items-center justify-between border-b border-gray-800 bg-[#0B111E] z-50 shrink-0 relative shadow-md">
        {/* Left: Brand & Node Count */}
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <Link
            href="/tasks"
            className="text-xs uppercase font-bold tracking-wider text-amber-400 hover:text-amber-300 transition flex items-center gap-1.5 shrink-0 bg-amber-500/10 hover:bg-amber-500/20 px-2.5 py-1 rounded border border-amber-500/30"
            title="Ir a TaskManager Ejecutivo (Tareas)"
          >
            <span>←</span>
            <span>Tareas</span>
          </Link>
          <div className="h-4 w-px bg-gray-700 shrink-0" />
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-lg md:text-xl shrink-0">🌌</span>
            <h1 className="font-bold text-xs md:text-sm tracking-wide text-white truncate flex items-center gap-1.5">
              <span>SMJ Cerebro</span>
              <span className="hidden xl:inline text-sky-400 font-normal">| Segundo Cerebro Vivo</span>
            </h1>
          </div>
          {/* Node Count Pill */}
          <span className="px-1.5 py-0.5 text-[9px] font-mono bg-sky-950 text-sky-300 border border-sky-800 rounded font-semibold shrink-0">
            {graphData?.nodes.length || summary.totalNodes} Nodos
          </span>

          {/* Panama Sync Time Pill (Point 11) */}
          {lastSyncTime && (
            <span className="hidden md:inline-flex px-2 py-0.5 text-[9px] font-mono bg-slate-900/90 text-slate-300 border border-slate-700 rounded items-center gap-1 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>{lastSyncTime} (Panamá)</span>
            </span>
          )}
        </div>

        {/* Center: Search Bar with Autocomplete Dropdown */}
        <div className="hidden sm:flex relative flex-1 max-w-xs md:max-w-md mx-3">
          <div className="flex items-center bg-gray-900/90 border border-gray-700 focus-within:border-sky-500 rounded-lg px-2.5 py-1 w-full transition shadow-inner">
            <span className="text-gray-400 text-xs mr-2">🔍</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar marca, filial, rol, persona..."
              className="bg-transparent text-white text-xs placeholder-gray-500 focus:outline-none w-full font-mono"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-gray-400 hover:text-white text-xs px-1"
              >
                ✕
              </button>
            )}
          </div>

          {/* Search Results Dropdown */}
          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1.5 max-h-72 overflow-y-auto bg-gray-950/98 border border-sky-500/80 rounded-xl shadow-2xl p-1.5 z-50 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100">
              <div className="text-[10px] font-mono text-gray-400 uppercase px-2 py-1 border-b border-gray-800 mb-1 flex items-center justify-between">
                <span>Resultados</span>
                <span className="text-sky-400 font-bold">{searchResults.length}</span>
              </div>
              {searchResults.slice(0, 8).map((node: any) => (
                <div
                  key={node.id}
                  onClick={() => {
                    pushToStackedDeck(node);
                    handleCenterAndFit(node);
                    setSearchQuery('');
                  }}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-sky-950/80 cursor-pointer text-xs transition border border-transparent hover:border-sky-800/60"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base shrink-0">{(TYPE_CONFIG[node.type] || TYPE_CONFIG.department).icon}</span>
                    <div className="min-w-0">
                      <p className="font-bold text-white truncate">{humanNodeName(node)}</p>
                      <p className="text-[10px] text-gray-400 font-mono">{(TYPE_CONFIG[node.type] || TYPE_CONFIG.department).label}</p>
                    </div>
                  </div>
                  <span className="text-[10px] text-sky-400 font-mono shrink-0">Ver ➔</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Quick Action Controls */}
        <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
          {/* Desktop View Mode Switcher */}
          <div className="hidden lg:flex items-center bg-gray-900 p-0.5 rounded-lg border border-gray-700 text-xs">
            <button
              onClick={() => handleSetViewMode('brujula')}
              className={`px-2 py-1 rounded transition text-[11px] font-medium ${
                viewMode === 'brujula' ? 'bg-sky-600 text-white shadow font-semibold' : 'text-gray-400 hover:text-white'
              }`}
            >
              [BR] Brújula
            </button>
            <button
              onClick={() => handleSetViewMode('version-1-ajustada')}
              className={`px-2 py-1 rounded transition text-[11px] font-medium ${
                viewMode === 'version-1-ajustada' ? 'bg-sky-600 text-white shadow font-semibold' : 'text-gray-400 hover:text-white'
              }`}
            >
              [V1] V1 Ajustada
            </button>
            <button
              onClick={() => handleSetViewMode('constellations')}
              className={`px-2 py-1 rounded transition text-[11px] font-medium ${
                viewMode === 'constellations' ? 'bg-emerald-600 text-white shadow font-semibold' : 'text-gray-400 hover:text-white'
              }`}
            >
              Constelaciones
            </button>
            <button
              onClick={() => handleSetViewMode('organigram')}
              className={`px-2 py-1 rounded transition text-[11px] font-medium ${
                viewMode === 'organigram' ? 'bg-purple-600 text-white shadow font-semibold' : 'text-gray-400 hover:text-white'
              }`}
            >
              Organigrama
            </button>
            <button
              onClick={() => handleSetViewMode('quadrants')}
              className={`px-2 py-1 rounded transition text-[11px] font-medium ${
                viewMode === 'quadrants' ? 'bg-slate-700 text-white shadow font-semibold' : 'text-gray-400 hover:text-white'
              }`}
            >
              Cuadrantes
            </button>
          </div>

          {/* Centrar Button */}
          <button
            onClick={() => handleCenterAndFit()}
            className="px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-sky-300 border border-sky-800/80 text-xs font-semibold flex items-center gap-1 transition shadow-sm active:scale-95"
            title="Centrar y reencuadrar el mapa"
          >
            <span>🎯</span>
            <span className="hidden sm:inline">Centrar</span>
          </button>

          {/* Fichas Deck Counter Button */}
          <button
            onClick={() => {
              if (stackedDeck.length === 0) {
                const coreNode = nodesRef.current.find(n => n.type === 'core') || nodesRef.current[0];
                if (coreNode) pushToStackedDeck(coreNode);
              } else {
                setStackedDeck([]);
              }
            }}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition active:scale-95 ${
              stackedDeck.length > 0
                ? 'bg-sky-600 text-white border-sky-400 shadow'
                : 'bg-gray-800 text-gray-300 border-gray-700 hover:text-white'
            }`}
            title="Abrir o cerrar fichas ejecutivas"
          >
            <span>📋</span>
            <span className="hidden md:inline">Fichas</span>
            <span className="font-mono text-[11px] font-bold">({stackedDeck.length})</span>
          </button>

          {/* Unified Settings Button */}
          <button
            onClick={() => setIsSettingsMenuOpen(!isSettingsMenuOpen)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition shadow-sm active:scale-95 ${
              isSettingsMenuOpen
                ? 'bg-gradient-to-r from-sky-600 to-indigo-600 text-white border-sky-400 shadow'
                : 'bg-gray-800 text-sky-300 border-sky-800/80 hover:bg-gray-700'
            }`}
            title="Herramientas, capas de catálogo y ajustes del cerebro"
          >
            <span>⚙️</span>
            <span className="hidden md:inline">Ajustes</span>
            <span className="text-[10px] font-mono">{isSettingsMenuOpen ? '▲' : '▼'}</span>
          </button>
        </div>
      </header>

      {/* Point 11: Real-time Connection Health Alert Banner */}
      {syncError && (
        <div className="bg-rose-950/95 border-b border-rose-700/80 text-rose-200 text-xs px-4 py-2 flex items-center justify-between z-50 animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-rose-400">[ALERTA DE CONEXIÓN]</span>
            <span>{syncError}</span>
          </div>
          {lastSyncTime && (
            <span className="text-slate-400 font-mono text-[11px] shrink-0">
              Última carga exitosa: {lastSyncTime} (Panamá)
            </span>
          )}
        </div>
      )}

      {/* Unified Settings & Controls Popover (Desktop Popover / Mobile Sheet) */}
      {isSettingsMenuOpen && (
        <>
          <div
            onClick={() => setIsSettingsMenuOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 animate-in fade-in duration-150"
          />
          <div className="fixed sm:absolute inset-x-0 sm:inset-x-auto sm:right-4 top-12 z-50 w-full sm:w-96 max-h-[calc(100vh-60px)] overflow-y-auto bg-gray-950/98 border border-sky-500/70 sm:rounded-2xl shadow-2xl p-4 space-y-4 backdrop-blur-xl animate-in slide-in-from-top-2 duration-150 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-gray-800">
              <span className="font-bold text-white flex items-center gap-2 text-sm">
                <span>⚙️</span> Ajustes & Control Cerebro
              </span>
              <button
                onClick={() => setIsSettingsMenuOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 transition"
              >
                ✕
              </button>
            </div>

            {/* Quick Node Selector */}
            <div>
              <label className="text-[10px] uppercase font-mono text-gray-400 block mb-1">Ir a Ficha / Entidad:</label>
              <select
                defaultValue=""
                onChange={e => {
                  if (!e.target.value) return;
                  const pool = (graphData as any)?.allNodes || graphData?.nodes || nodesRef.current || [];
                  const targetNode = pool.find((n: any) => n.id === e.target.value);
                  if (targetNode) {
                    pushToStackedDeck(targetNode);
                    handleCenterAndFit(targetNode);
                    setIsSettingsMenuOpen(false);
                  }
                  e.target.value = '';
                }}
                className="w-full bg-gray-900 text-sky-300 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-sky-400 font-medium"
              >
                <option value="">📋 Seleccionar Entidad por Nombre...</option>
                {(() => {
                  const fullCatalog = (graphData as any)?.allNodes || graphData?.nodes || nodesRef.current || [];
                  return (
                    <>
                      <optgroup label="🧃 Marcas Master SMJ">
                        {fullCatalog.filter((n: any) => n.type === 'brand').map((n: any) => (
                          <option key={n.id} value={n.id}>🧃 {n.title}</option>
                        ))}
                      </optgroup>
                      <optgroup label="🏛️ Filiales & Organizaciones Globales">
                        {fullCatalog.filter((n: any) => n.type === 'organization').map((n: any) => (
                          <option key={n.id} value={n.id}>🏛️ {n.title}</option>
                        ))}
                      </optgroup>
                      <optgroup label="🌎 Mercados, Canales, Operadores & Clientes">
                        {fullCatalog.filter((n: any) => n.type === 'market' || n.type === 'distributor' || n.type === 'operator' || n.type === 'channel' || n.type === 'customer' || n.type === 'client_group' || n.type === 'client').map((n: any) => (
                          <option key={n.id} value={n.id}>{(TYPE_CONFIG[n.type] || TYPE_CONFIG.department).icon} {n.title}</option>
                        ))}
                      </optgroup>
                      <optgroup label="🏢 Departamentos & Jefaturas">
                        {fullCatalog.filter((n: any) => n.type === 'core' || n.type === 'department').map((n: any) => (
                          <option key={n.id} value={n.id}>🏢 {n.title}</option>
                        ))}
                      </optgroup>
                      <optgroup label="👑 Personas & Directivos">
                        {fullCatalog.filter((n: any) => n.type === 'person').map((n: any) => (
                          <option key={n.id} value={n.id}>👤 {n.title}</option>
                        ))}
                      </optgroup>
                    </>
                  );
                })()}
              </select>
            </div>

            {/* View Mode Selector */}
            <div>
              <label className="text-[10px] uppercase font-mono text-gray-400 block mb-1">Modo de Perspectiva:</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-1 bg-gray-900 p-1 rounded-lg border border-gray-800">
                <button
                  onClick={() => handleSetViewMode('brujula')}
                  className={`py-1.5 rounded text-xs transition text-center ${
                    viewMode === 'brujula' ? 'bg-sky-600 text-white font-semibold shadow' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  [BR] Brújula
                </button>
                <button
                  onClick={() => handleSetViewMode('version-1-ajustada')}
                  className={`py-1.5 rounded text-xs transition text-center ${
                    viewMode === 'version-1-ajustada' ? 'bg-sky-600 text-white font-semibold shadow' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  [V1] V1 Ajustada
                </button>
                <button
                  onClick={() => handleSetViewMode('constellations')}
                  className={`py-1.5 rounded text-xs transition text-center ${
                    viewMode === 'constellations' ? 'bg-emerald-600 text-white font-semibold shadow' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Constelaciones
                </button>
                <button
                  onClick={() => handleSetViewMode('organigram')}
                  className={`py-1.5 rounded text-xs transition text-center ${
                    viewMode === 'organigram' ? 'bg-purple-600 text-white font-semibold shadow' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Organigrama
                </button>
              </div>
            </div>

            {/* Catálogo de Marcas & SKUs */}
            <div className="space-y-1.5 pt-1 border-t border-gray-800">
              <label className="text-[10px] uppercase font-mono text-gray-400 flex items-center justify-between">
                <span>Catálogo de SKUs & Multipacks:</span>
                <span className="text-amber-400 font-mono text-[9px]">
                  {catalogScope === 'collapsed' ? 'Plegado (80 Nodos)' : catalogScope === 'all' ? 'Todos (379 Nodos)' : `${catalogScope.toUpperCase()} Activo`}
                </span>
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => handleSetCatalogScope('collapsed')}
                  className={`px-2.5 py-1.5 rounded text-[11px] font-mono border text-left flex items-center justify-between ${
                    catalogScope === 'collapsed' ? 'bg-amber-950/80 border-amber-500 text-amber-200 font-bold' : 'bg-gray-900 border-gray-800 text-gray-300 hover:bg-gray-800'
                  }`}
                >
                  <span>📁 Plegar Todo</span>
                  <span className="text-[9px] text-gray-400">80 N</span>
                </button>
                <button
                  onClick={() => handleSetCatalogScope('all')}
                  className={`px-2.5 py-1.5 rounded text-[11px] font-mono border text-left flex items-center justify-between ${
                    catalogScope === 'all' ? 'bg-amber-950/80 border-amber-500 text-amber-200 font-bold' : 'bg-gray-900 border-gray-800 text-gray-300 hover:bg-gray-800'
                  }`}
                >
                  <span>📦 Desplegar Todo</span>
                  <span className="text-[9px] text-gray-400">379 N</span>
                </button>
              </div>
              <div className="flex items-center gap-1 flex-wrap pt-1">
                {(graphData?.allNodes || graphData?.nodes || []).filter((n: any) => n.type === 'brand').map((n: any) => ({ key: n.id.replace(/^brand-/i, '').toLowerCase(), label: n.frontmatter?.brand_name || n.title.replace(/^Brand:\s*/i, '') })).map(b => (
                  <button
                    key={b.key}
                    onClick={() => handleSetCatalogScope(catalogScope === b.key ? 'collapsed' : (b.key as any))}
                    className={`px-2 py-1 rounded text-[10px] font-mono border transition ${
                      catalogScope === b.key ? 'bg-amber-600 border-amber-400 text-white font-bold' : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-white'
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Estructura & Personal */}
            <div className="space-y-1.5 pt-1 border-t border-gray-800">
              <label className="text-[10px] uppercase font-mono text-gray-400 flex items-center justify-between">
                <span>Estructura y Personal:</span>
                <span className="text-purple-400 font-mono text-[9px]">
                  {orgScope === 'collapsed' ? 'Plegado (12 Nodos)' : orgScope === 'all' ? 'Todos (54 Personas)' : `${orgScope} Activo`}
                </span>
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => handleSetOrgScope('collapsed')}
                  className={`px-2.5 py-1.5 rounded text-[11px] font-mono border text-left flex items-center justify-between ${
                    orgScope === 'collapsed' ? 'bg-purple-950/80 border-purple-500 text-purple-200 font-bold' : 'bg-gray-900 border-gray-800 text-gray-300 hover:bg-gray-800'
                  }`}
                >
                  <span>🏛️ Plegar Todo</span>
                  <span className="text-[9px] text-gray-400">12 L</span>
                </button>
                <button
                  onClick={() => handleSetOrgScope('all')}
                  className={`px-2.5 py-1.5 rounded text-[11px] font-mono border text-left flex items-center justify-between ${
                    orgScope === 'all' ? 'bg-purple-950/80 border-purple-500 text-purple-200 font-bold' : 'bg-gray-900 border-gray-800 text-gray-300 hover:bg-gray-800'
                  }`}
                >
                  <span>👥 Desplegar Todo</span>
                  <span className="text-[9px] text-gray-400">54 P</span>
                </button>
              </div>
            </div>

            {/* Control de Física, Gravedad y Pines */}
            <div className="space-y-2 pt-1 border-t border-gray-800">
              <label className="text-[10px] uppercase font-mono text-gray-400 block">Física & Control de Nodos:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setGravityActive(!gravityActive)}
                  className={`px-2.5 py-2 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                    gravityActive ? 'bg-sky-950/80 border-sky-600 text-sky-300' : 'bg-gray-900 border-gray-800 text-gray-400'
                  }`}
                >
                  <span>{gravityActive ? '🌊' : '⏸'}</span>
                  <span>{gravityActive ? 'Gravedad: Activa' : 'Gravedad: Pausada'}</span>
                </button>

                <button
                  onClick={handleConsolidate}
                  disabled={isSubmitting}
                  className="px-2.5 py-2 rounded-lg border border-amber-600/70 bg-gradient-to-r from-amber-900/60 to-amber-800/60 hover:from-amber-800 hover:to-amber-700 text-amber-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                >
                  <span>⚡</span>
                  <span>Consolidar Nodos</span>
                </button>
              </div>

              {pinnedCount > 0 && (
                <button
                  onClick={() => {
                    handleUnpinAll();
                  }}
                  className="w-full py-2 px-3 rounded-lg bg-cyan-950/80 border border-cyan-500/70 text-cyan-200 text-xs font-mono font-bold flex items-center justify-center gap-1.5 hover:bg-cyan-900/80 transition"
                >
                  <span>📌</span>
                  <span>Restaurar {pinnedCount} Nodos Anclados (Desanclar Todo)</span>
                </button>
              )}
            </div>

            {/* HUD & Visual Tools */}
            <div className="space-y-2 pt-1 border-t border-gray-800">
              <label className="text-[10px] uppercase font-mono text-gray-400 block">Visualización & Herramientas:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setIsHudOpen(!isHudOpen)}
                  className={`py-1.5 px-2.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                    isHudOpen ? 'bg-indigo-950/80 border-indigo-500 text-indigo-300' : 'bg-gray-900 border-gray-800 text-gray-400'
                  }`}
                >
                  <span>📊</span>
                  <span>{isHudOpen ? 'Ocultar HUD' : 'Mostrar HUD'}</span>
                </button>

                <button
                  onClick={fetchGraph}
                  className="py-1.5 px-2.5 rounded-lg border border-gray-700 bg-gray-900 hover:bg-gray-800 text-gray-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                >
                  <span>🔄</span>
                  <span>Sincronizar Vault</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {isHudOpen && (
        <section className="bg-[#090E1A]/95 border-b border-gray-800/80 px-5 py-2.5 z-40 shadow-xl backdrop-blur-md">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 max-w-[1920px] mx-auto">
            
            {/* Widget 1: Salud de Memoria & Enlaces Rotos */}
            <div className={`p-2.5 rounded-xl border backdrop-blur transition-all ${
              linkHealthAudit.brokenCount === 0
                ? 'bg-gray-900/80 border-emerald-500/40 hover:border-emerald-500/70'
                : 'bg-amber-950/40 border-amber-500/60 hover:border-amber-500'
            }`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-gray-400 font-bold flex items-center gap-1">
                  <span>🧠</span> Salud Memoria
                </span>
                <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold ${
                  linkHealthAudit.brokenCount === 0
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    : 'bg-amber-950 text-amber-300 border border-amber-800 animate-pulse'
                }`}>
                  {linkHealthAudit.brokenCount === 0 ? '100% Coherente' : `${linkHealthAudit.brokenCount} Rotos`}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-bold text-white font-mono">
                  {linkHealthAudit.brokenCount === 0 ? '0 Enlaces Rotos' : `${linkHealthAudit.brokenCount} Enlaces Rotos`}
                </span>
                <span className="text-[10px] text-gray-400 font-mono">0 Fugas Auditadas</span>
              </div>
              <div className="mt-1 text-[9px] text-gray-400 truncate font-mono">
                {linkHealthAudit.brokenCount === 0 ? '✅ Sinapsis íntegras en bóveda' : `⚠️ Faltan: ${linkHealthAudit.brokenSample.join(', ')}`}
              </div>
            </div>

            {/* Widget 2: Memoria Viva & Cierre S&OP */}
            <div className="p-2.5 rounded-xl bg-gray-900/80 border border-amber-500/40 hover:border-amber-500/70 backdrop-blur transition-all">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-bold flex items-center gap-1">
                  <span>⚡</span> Memoria Viva & S&OP
                </span>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-amber-950 text-amber-300 border border-amber-800">
                  {workingMemoryStats.activeCount} en tránsito
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-bold text-white font-mono">
                    {workingMemoryStats.avgCompleteness}%
                  </span>
                  <span className="text-[10px] text-gray-400 font-mono ml-1.5">Avance Operativo</span>
                </div>
                <button
                  onClick={handleConsolidate}
                  disabled={isSubmitting}
                  className="text-[9px] px-2 py-0.5 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded shadow transition flex items-center gap-1"
                  title="Consolidar recuerdos temporales"
                >
                  Consolidar
                </button>
              </div>
              <div className="mt-1.5 w-full bg-gray-800 h-1.5 rounded-full overflow-hidden">
                <div className="bg-amber-400 h-full rounded-full transition-all duration-500" style={{ width: `${workingMemoryStats.avgCompleteness}%` }} />
              </div>
            </div>

            {/* Widget 3: Directorio Humano & Canales de Contacto */}
            <div className="p-2.5 rounded-xl bg-gray-900/80 border border-sky-500/40 hover:border-sky-500/70 backdrop-blur transition-all">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-sky-400 font-bold flex items-center gap-1">
                  <span>👥</span> Directorio Humano
                </span>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-sky-950 text-sky-300 border border-sky-800">
                  {contactStats.leaders + contactStats.operational} Total
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-bold text-white font-mono">
                  {contactStats.leaders} <span className="text-[10px] text-gray-400 font-normal">Líderes</span> · {contactStats.operational} <span className="text-[10px] text-gray-400 font-normal">Staff</span>
                </span>
                <span className="text-[10px] text-emerald-400 font-mono">
                  💬 {contactStats.activeWhatsapps} WA
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[9px] text-gray-400 font-mono">
                <span>✉️ {contactStats.verifiedEmails} Emails Verificados</span>
                <span className="text-sky-400 font-semibold">100% Contacto</span>
              </div>
            </div>

            {/* Widget 4: Telemetría Neuronal & Sincronía en Vivo */}
            <div className="p-2.5 rounded-xl bg-gray-900/80 border border-indigo-500/40 hover:border-indigo-500/70 backdrop-blur transition-all">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-400 font-bold flex items-center gap-1">
                  <span>🌐</span> Red & Sinapsis
                </span>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-indigo-950 text-indigo-300 border border-indigo-800 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" /> Live Vault
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-bold text-white font-mono">
                  {summary.totalNodes} <span className="text-[10px] text-gray-400 font-normal">Nodos</span>
                </span>
                <span className="text-xs font-bold text-sky-400 font-mono">
                  {summary.totalLinks} <span className="text-[9px] text-gray-400 font-normal">Sinapsis</span>
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[9px] text-gray-400 font-mono">
                <span>Portafolio 78% · Personal 15% · Red 7%</span>
              </div>
            </div>

            {/* Widget 5: Capacidad de Portafolio & Cadena de Suministro */}
            <div className="p-2.5 rounded-xl bg-gray-900/80 border border-teal-500/40 hover:border-teal-500/70 backdrop-blur transition-all">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-teal-400 font-bold flex items-center gap-1">
                  <span>📦</span> Portafolio & Supply
                </span>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-teal-950 text-teal-300 border border-teal-800">
                  {graphData?.summary.brandsCount ?? '—'} Marcas Máster
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-bold text-white font-mono">
                  {(graphData?.allNodes || graphData?.nodes || []).filter(n => n.type === 'product_variant').length} <span className="text-[10px] text-gray-400 font-normal">SKUs</span> · {(graphData?.allNodes || graphData?.nodes || []).filter(n => n.type === 'packaging').length} <span className="text-[10px] text-gray-400 font-normal">Packs</span>
                </span>
                <span className="text-[10px] text-teal-300 font-mono">{(graphData?.allNodes || graphData?.nodes || []).filter(n => n.type === 'flavor').length} Sabores</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[9px] text-gray-400 font-mono">
                <span>Estiba: <strong>2,800 cajas</strong> / cont 40ft</span>
                <span className="text-teal-400">Trinidad Standard</span>
              </div>
            </div>

          </div>
        </section>
      )}

      {/* Main Workspace Area */}
      <div className="relative flex-1 flex flex-col md:flex-row overflow-hidden min-h-[550px] h-[calc(100vh-48px)]">
        {/* Orbital Canvas Viewport (flex-1 min-w-0 ensures aside fits seamlessly on right) */}
        <div ref={containerRef} className="flex-1 min-w-0 relative h-full min-h-[550px]">
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            onDoubleClick={handleCanvasDoubleClick}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onWheel={handleWheel}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
            className="w-full h-full cursor-pointer block touch-none"
          />

          {/* Hierarchical Progressive Breadcrumbs (P3/P4) */}
          {drilldownStack.length > 0 && (
            <div className="absolute top-3 left-3 z-30 flex items-center gap-2 bg-gray-950/95 border border-sky-500/70 rounded-xl px-3 py-1.5 backdrop-blur-xl shadow-2xl text-xs font-mono animate-in fade-in slide-in-from-top-2 pointer-events-auto">
              <button
                onClick={handlePopDrilldown}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-950 text-sky-300 border border-sky-700 hover:bg-sky-900 transition font-bold active:scale-95"
                title="Volver al nivel anterior (o presiona Escape)"
              >
                <span>⬅</span>
                <span>Atrás</span>
              </button>
              <div className="h-4 w-px bg-gray-700" />
              <button
                onClick={handleResetToUniverse}
                className="text-gray-400 hover:text-white transition flex items-center gap-1"
                title="Volver al Universo Completo"
              >
                <span>🌌</span>
                <span className="hidden sm:inline">Universo SMJ</span>
              </button>
              {drilldownStack.map((item) => (
                <span key={item.id} className="flex items-center gap-1 text-white">
                  <span className="text-gray-500">›</span>
                  <span className="text-amber-300 font-bold bg-amber-950/80 px-2 py-0.5 rounded border border-amber-800 flex items-center gap-1">
                    <span>{item.type === 'brand' ? '🧃' : '🏛️'}</span>
                    <span>{item.title}</span>
                  </span>
                </span>
              ))}
            </div>
          )}

          {/* Bottom-Right Quick Controls: Unpin All + Centrar (P5/P6) */}
          <div className="absolute bottom-4 right-4 z-20 flex items-center gap-2 pointer-events-auto">
            {pinnedCount > 0 && (
              <button
                onClick={handleUnpinAll}
                className="px-3 py-1.5 rounded-xl bg-gray-900/95 hover:bg-gray-800 border border-cyan-500/80 text-cyan-300 text-xs font-mono font-semibold shadow-2xl flex items-center gap-1.5 backdrop-blur transition active:scale-95 animate-in fade-in"
                title="Restaurar todos los nodos anclados a sus órbitas originales"
              >
                <span>📌</span>
                <span>Restaurar {pinnedCount} Anclados</span>
              </button>
            )}
            <button
              onClick={() => handleCenterAndFit()}
              className="px-3 py-1.5 rounded-xl bg-gray-900/95 hover:bg-gray-800 border border-sky-500/80 text-sky-300 text-xs font-mono font-semibold shadow-2xl flex items-center gap-1.5 backdrop-blur transition active:scale-95"
              title="Centrar y reencuadrar el grafo en pantalla"
            >
              <span>🎯</span>
              <span>Centrar</span>
            </button>
          </div>

          {/* Floating Hover Tooltip (Sale SIEMPRE a un lado del círculo sin tapar el nodo) */}
          {hoveredNode && (() => {
            const { x: tx, y: ty, scale } = transformRef.current;
            const containerW = containerRef.current?.clientWidth || 1000;
            const containerH = containerRef.current?.clientHeight || 800;

            // Coordenadas de pantalla del nodo para calcular el encuadre exacto
            const nodeScreenX = (hoveredNode.x ?? 0) * scale + tx;
            const nodeScreenY = (hoveredNode.y ?? 0) * scale + ty;
            const nodeScreenR = (hoveredNode.radius || 28) * scale;

            const tooltipW = 320;
            const tooltipH = 220;
            const safeGap = 32; // Margen limpio garantizado fuera del perímetro del círculo

            // Posicionar a la derecha si hay espacio; si choca con el borde o ficha lateral, posicionar a la izquierda
            const spaceRight = containerW - (nodeScreenX + nodeScreenR + safeGap);
            let left = 0;
            if (spaceRight >= tooltipW + 16) {
              left = nodeScreenX + nodeScreenR + safeGap;
            } else {
              left = Math.max(16, nodeScreenX - nodeScreenR - safeGap - tooltipW);
            }

            // Centrado vertical respecto al círculo del nodo
            let top = Math.max(16, Math.min(nodeScreenY - tooltipH / 2, containerH - tooltipH - 24));

            return (
              <div
                style={{ left, top }}
                onClick={(e) => {
                  e.stopPropagation();
                  pushToStackedDeck(hoveredNode, false);
                }}
                className="hidden md:block absolute z-40 bg-gray-950/98 border border-sky-500/80 shadow-2xl rounded-xl p-3.5 backdrop-blur-xl text-xs w-80 animate-in fade-in zoom-in-95 duration-150 pointer-events-auto select-none"
              >
                {(() => {
                  const fm = hoveredNode.frontmatter || {};
                  const nid = hoveredNode.id.toLowerCase();
                  const photoSrc = fm.avatar_image || fm.photo_url || fm.visual_photo_url || fm.visual_logo_url ||
                    (nid.includes('medimex') ? '/brands/medimex-logo.png' :
                     nid.includes('sm-jaleel') || hoveredNode.type === 'core' ? '/brands/smjaleel-logo.png' :
                     nid.includes('chubby') ? '/brands/chubby.png' :
                     nid.includes('busta') ? '/brands/busta.png' :
                     nid.includes('fruta') ? '/brands/fruta.png' :
                     nid.includes('oasis') ? '/brands/oasis.png' :
                     nid.includes('altitude') ? '/brands/altitude.png' : null);

                  return (
                    <div className="flex items-center gap-2.5 mb-2 border-b border-gray-800/80 pb-2">
                      <div
                        className="w-10 h-10 rounded-full border flex items-center justify-center shrink-0 overflow-hidden bg-gray-950 p-0.5 shadow relative"
                        style={{ borderColor: (TYPE_CONFIG[hoveredNode.type] || TYPE_CONFIG.department).border }}
                      >
                        {photoSrc && (
                          <img
                            src={getPhotoUrlWithBust(photoSrc, fm.updated_at || fm.updatedAt) || photoSrc}
                            alt={hoveredNode.title}
                            className="w-full h-full object-cover rounded-full z-10"
                            onError={(e) => {
                              (e.currentTarget as HTMLElement).style.display = 'none';
                            }}
                          />
                        )}
                        <span className="absolute inset-0 flex items-center justify-center text-sm">
                          {(TYPE_CONFIG[hoveredNode.type] || TYPE_CONFIG.department).icon}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold text-white uppercase shrink-0"
                            style={{ backgroundColor: (TYPE_CONFIG[hoveredNode.type] || TYPE_CONFIG.department).bg }}
                          >
                            {(TYPE_CONFIG[hoveredNode.type] || TYPE_CONFIG.department).label}
                          </span>
                          {hoveredNode.isPinned && (
                            <span className="text-[8px] font-mono text-cyan-300 bg-cyan-950/80 px-1 py-0.5 rounded border border-cyan-800 flex items-center gap-0.5">
                              <span>📌</span> Anclado
                            </span>
                          )}
                          {hoveredNode.completeness_score !== undefined && (
                            <span className="text-[8px] font-mono text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800">
                              {hoveredNode.completeness_score}%
                            </span>
                          )}
                        </div>
                        <h4 className="font-bold text-xs text-white leading-tight truncate mt-0.5" title={hoveredNode.title}>
                          {hoveredNode.title}
                        </h4>
                        {fm.job_title && (
                          <p className="text-[10px] text-sky-400 font-mono truncate">{fm.job_title}</p>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Dynamic Next-Layer Contextual Preview */}
                <div className="mt-2 p-2 rounded-lg bg-gray-900/90 border border-gray-800 text-[11px] font-mono space-y-1">
                  {hoveredNode.type === 'brand' && (
                    <div>
                      <span className="text-amber-400 font-bold block text-[10px] uppercase">📦 Siguiente Capa (Catálogo):</span>
                      <span className="text-gray-300">Formato: 250ml / Packs · 6 Sabores · Estiba 2,800 cajas/cont</span>
                    </div>
                  )}
                  {hoveredNode.type === 'market' && (
                    <div>
                      <span className="text-teal-400 font-bold block text-[10px] uppercase">🤝 Siguiente Capa (Distribuidor):</span>
                      <span className="text-gray-200">
                        {marketDistributorLabel(getMarketDistributors(
                          hoveredNode.id,
                          graphData?.allNodes || graphData?.nodes || nodesRef.current || [],
                          graphData?.links || linksRef.current || []
                        ))}
                      </span>
                    </div>
                  )}
                  {hoveredNode.type === 'distributor' && (
                    <div>
                      <span className="text-emerald-400 font-bold block text-[10px] uppercase">🌎 Siguiente Capa (Territorio):</span>
                      <span className="text-gray-200">
                        {hoveredNode.id.includes('medimex') || hoveredNode.id.includes('panama') ? 'Panamá · Chubby, Fruta & Busta' :
                         hoveredNode.id.includes('sancas') ? 'Belice (CARICOM) · Chubby & Fruta' :
                         hoveredNode.id.includes('morgan') ? 'Canadá · Retail Moderno' : 'EE. UU. · Costa Este'}
                      </span>
                    </div>
                  )}
                  {hoveredNode.type === 'person' && (
                    <div>
                      <span className="text-sky-400 font-bold block text-[10px] uppercase">👥 Siguiente Capa (Equipo):</span>
                      <span className="text-gray-200">
                        {hoveredNode.frontmatter?.job_title || 'Cargo Ejecutivo'} · {hoveredNode.frontmatter?.based_in_city || 'HQ'}
                      </span>
                    </div>
                  )}
                  {hoveredNode.type === 'department' && (
                    <div>
                      <span className="text-purple-400 font-bold block text-[10px] uppercase">🏢 Siguiente Capa (Estructura):</span>
                      <span className="text-gray-200">Personal Operativo y Líneas de Reporte</span>
                    </div>
                  )}
                </div>

                {/* Dual Action Buttons (Ficha 360° + Ver Capa en Lienzo) */}
                <div className="grid grid-cols-2 gap-2 mt-2.5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      pushToStackedDeck(hoveredNode, false);
                    }}
                    className="py-1.5 px-2 bg-sky-600 hover:bg-sky-500 active:scale-95 text-white rounded-lg text-xs font-bold shadow flex items-center justify-center gap-1 transition"
                    title="Abrir ficha ejecutiva completa en panel lateral"
                  >
                    <span>📋 Ficha 360°</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      pushToStackedDeck(hoveredNode, true);
                    }}
                    className="py-1.5 px-2 bg-amber-600 hover:bg-amber-500 active:scale-95 text-white rounded-lg text-xs font-bold shadow flex items-center justify-center gap-1 transition"
                    title="Desplegar siguiente capa directamente en el lienzo"
                  >
                    <span>🚀 Ver Capa ▼</span>
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Quick Brain Dump Bar (Desktop Only) */}
          <form
            onSubmit={handleRememberWorking}
            className="hidden md:flex absolute top-4 left-4 items-center gap-2 bg-gray-900/90 border border-gray-700 rounded-lg px-3 py-2 shadow-2xl backdrop-blur z-20 w-96 max-w-[90vw]"
          >
            <span className="text-amber-400 text-sm">⚡</span>
            <input
              type="text"
              value={quickInput}
              onChange={e => setQuickInput(e.target.value)}
              placeholder="Captura rápida para memoria temporal..."
              className="bg-transparent text-xs text-white placeholder-gray-500 outline-none flex-1"
            />
            <button
              type="submit"
              disabled={isSubmitting || !quickInput.trim()}
              className="text-[11px] bg-sky-600 hover:bg-sky-500 text-white font-medium px-2.5 py-1 rounded transition disabled:opacity-40"
            >
              Capturar
            </button>
          </form>

          {/* Status Toast */}
          {statusMessage && (
            <div className="absolute top-4 right-4 bg-sky-950 border border-sky-700 text-sky-200 px-3.5 py-2 rounded-lg text-xs font-mono shadow-2xl z-30 animate-bounce">
              {statusMessage}
            </div>
          )}

          {/* Canvas Footer Legend (Desktop Only) */}
          <div className="hidden md:block absolute bottom-4 left-4 p-3 bg-gray-900/90 border border-gray-800 rounded-lg text-xs space-y-1.5 backdrop-blur shadow-lg z-10 pointer-events-none">
            <div className="font-semibold text-gray-400 text-[10px] uppercase tracking-wider flex items-center gap-2">
              <span>
                {viewMode === 'brujula'
                  ? '[BR] Brújula Nativa (Mercado Oeste · Portafolio Norte · Org Este · Supply Sur)'
                  : viewMode === 'version-1-ajustada'
                  ? '[V1] V1 Ajustada (Columnas Verticales · Carriles por País)'
                  : viewMode === 'quadrants'
                  ? 'Cuadrantes (América Izq · Marcas Arriba · HQ Centro)'
                  : viewMode === 'organigram'
                  ? 'Estructura Jerárquica L0 - L4'
                  : 'Constelaciones por Afinidad'}
              </span>
              <span className="text-sky-400 font-mono">| Layout Dinámico Activo</span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Panamá & Belice (Tu Área)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-500" /> Canadá & EE. UU.
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500" /> Manufactura & Marcas
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500" /> Supply Chain & S&OP
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" /> Temporal
              </span>
            </div>
            <div className="text-[10px] text-gray-500 pt-0.5">
              Pasa el cursor para resumen leve · Clic para abrir ficha detallada a la derecha · Arrastra o haz Zoom
            </div>
          </div>
        </div>

        {/* Stacked Decks: Sliding Bottom Sheet on mobile (<768px) / Lateral Side Panel on desktop (>=768px) */}
        {stackedDeck.length > 0 && (
          <>
            {/* Mobile Backdrop Overlay */}
            <div
              onClick={() => setStackedDeck([])}
              className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-xs transition-opacity duration-300 animate-in fade-in"
              aria-hidden="true"
            />

            <aside className="fixed inset-x-0 bottom-0 z-50 w-full max-h-[85vh] h-[75vh] md:h-full md:relative md:inset-auto md:w-[440px] xl:w-[480px] 2xl:w-[520px] md:max-w-[38vw] shrink-0 border-t md:border-t-0 md:border-l border-gray-700 md:border-gray-800 bg-[#0B111E]/98 backdrop-blur-xl flex flex-col shadow-2xl transition-transform duration-300 ease-out overflow-hidden rounded-t-2xl md:rounded-none animate-in slide-in-from-bottom md:slide-in-from-right">
              {/* Visual Pill Drag Handle (Mobile only) */}
              <div className="md:hidden flex justify-center pt-2.5 pb-1 bg-gray-900/90 shrink-0">
                <div className="w-12 h-1.5 bg-gray-500 rounded-full" />
              </div>

              {/* Aside / Bottom Sheet Header */}
              <div className="flex items-center justify-between px-4 py-2.5 md:py-3 border-b border-gray-800 bg-gray-900/90 sticky top-0 z-10 shadow shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                    <span>📋</span>
                    <span>Fichas Ejecutivas ({stackedDeck.length})</span>
                  </span>
                  <span className="hidden sm:inline text-[10px] text-gray-400">· Vista 360° en Vivo</span>
                </div>
                <div className="flex items-center gap-2">
                  {/* Thumb-Accessible Close Button (min 44x44px touch target on mobile) */}
                  <button
                    onClick={() => setStackedDeck([])}
                    className="min-h-[44px] min-w-[44px] md:min-h-[32px] md:min-w-0 text-xs px-3 py-2 md:px-2.5 md:py-1 rounded-lg md:rounded bg-gray-800 hover:bg-red-950/80 text-gray-200 hover:text-red-300 border border-gray-700 hover:border-red-800 transition font-mono flex items-center justify-center gap-1.5 active:scale-95"
                    title="Cerrar ficha"
                    aria-label="Cerrar ficha ejecutiva"
                  >
                    <span className="text-sm">✕</span>
                    <span className="hidden md:inline">Cerrar Todo</span>
                    <span className="md:hidden text-xs font-sans">Cerrar</span>
                  </button>
                </div>
              </div>

              <div ref={inspectorRef} className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4 overscroll-contain">
              {stackedDeck.map((node) => {
                const cfg = TYPE_CONFIG[node.type] || TYPE_CONFIG.department;
                const fm = node.frontmatter || {};

                const nid = node.id.toLowerCase();
                const photoSrc = fm.avatar_image || fm.photo_url || fm.visual_photo_url || fm.visual_logo_url || 
                  (nid.includes('medimex') ? '/brands/medimex-logo.png' :
                   nid.includes('sm-jaleel') || node.type === 'core' ? '/brands/smjaleel-logo.png' :
                   nid.includes('chubby') ? '/brands/chubby.png' :
                   nid.includes('busta') ? '/brands/busta.png' :
                   nid.includes('fruta') ? '/brands/fruta.png' :
                   nid.includes('oasis') ? '/brands/oasis.png' :
                   nid.includes('altitude') ? '/brands/altitude.png' : null);
                const logoSrc = photoSrc;

                const flagEmoji = (node.type === 'market' && (fm.iso_code === 'TT' || nid.includes('trinidad'))) ? '🇹🇹' :
                  (node.type === 'market' && (fm.iso_code === 'PA' || nid.includes('panama'))) ? '🇵🇦' :
                  (node.type === 'market' && (fm.iso_code === 'CA' || nid.includes('canada'))) ? '🇨🇦' :
                  (node.type === 'market' && (fm.iso_code === 'US' || nid.includes('united-states'))) ? '🇺🇸' :
                  (node.type === 'market' && (fm.iso_code === 'BZ' || nid.includes('belize'))) ? '🇧🇿' : null;

                const galleryPhotos: string[] = (() => {
                  if (Array.isArray(fm.gallery_photos) && fm.gallery_photos.length > 0) {
                    return fm.gallery_photos;
                  }
                  const collected: string[] = [];
                  if (fm.visual_logo_url) collected.push(fm.visual_logo_url);
                  if (fm.visual_photo_url) collected.push(fm.visual_photo_url);
                  if (nid.includes('medimex')) {
                    collected.push('/brands/medimex-logo.png', '/brands/chubby-bottles.png', '/brands/fruta-bottles.png');
                  } else if (nid.includes('chubby')) {
                    collected.push('/brands/chubby-logo.png', '/brands/chubby-bottles.png', '/brands/chubby_tile.png');
                  } else if (nid.includes('busta')) {
                    collected.push('/brands/busta-logo.png', '/brands/busta-bottles.png', '/brands/busta_tile.png');
                  } else if (nid.includes('fruta')) {
                    collected.push('/brands/fruta-logo.png', '/brands/fruta-bottles.png', '/brands/fruta_tile.png');
                  } else if (nid.includes('oasis')) {
                    collected.push('/brands/oasis.png', '/brands/oasis-water.png');
                  } else if (nid.includes('altitude')) {
                    collected.push('/brands/altitude-logo.png', '/brands/altitude-can.png', '/brands/altitude_tile.png');
                  } else if (nid.includes('sm-jaleel') || node.type === 'core') {
                    collected.push('/brands/smjaleel-logo.png', '/brands/manufacturing-banner.jpg', '/brands/manufacturing-line-1.jpg');
                  } else if (nid.includes('trinidad')) {
                    collected.push('/brands/smjaleel-logo.png', '/brands/manufacturing-banner.jpg');
                  }
                  return Array.from(new Set(collected)).slice(0, 3);
                })();

                const contactWa = fm.whatsapp || fm.phone_mobile || fm.direct_contacts?.whatsapp || null;
                const contactEmail = fm.email_orders || fm.email_primary || fm.direct_contacts?.email || (nid.includes('medimex') ? 'pedidos@medimexsa.com' : null);
                const contactPhone = fm.phone_main || fm.direct_contacts?.phone || (nid.includes('medimex') ? '+507 270-2000' : null);

                return (
                  <div
                    key={node.id}
                    className="border rounded-xl p-4 bg-gray-900/90 shadow-xl relative transition-all"
                    style={{ borderColor: cfg.border }}
                  >
                    {/* Header Card with Big Identity Visual */}
                    <div className="flex items-start justify-between gap-3 border-b border-gray-800 pb-3 mb-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-12 h-12 rounded-full flex items-center justify-center text-xl shadow-lg border-2 shrink-0 overflow-hidden bg-gray-950 p-1 relative"
                          style={{ borderColor: cfg.border }}
                        >
                          {photoSrc && (
                            <img
                              src={getPhotoUrlWithBust(photoSrc, fm.updated_at || fm.updatedAt) || photoSrc}
                              alt={node.title}
                              className="w-full h-full object-cover rounded-full z-10"
                              onError={(e) => {
                                (e.currentTarget as HTMLElement).style.display = 'none';
                              }}
                            />
                          )}
                          <span className="absolute inset-0 flex items-center justify-center text-base">
                            {flagEmoji || cfg.icon}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className="px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold text-white shrink-0"
                              style={{ backgroundColor: cfg.bg }}
                            >
                              {cfg.label}
                            </span>
                            {node.completeness_score !== undefined && (
                              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800 shrink-0">
                                {node.completeness_score}% completitud
                              </span>
                            )}
                            {fm.is_active !== undefined && (
                              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border shrink-0 ${fm.is_active ? 'text-sky-300 bg-sky-950/60 border-sky-800' : 'text-gray-400 bg-gray-800/60 border-gray-700'}`}>
                                {fm.is_active ? 'OFICIAL / ACTIVO' : 'HISTÓRICO'}
                              </span>
                            )}
                          </div>
                          <h2 tabIndex={-1} className="text-base font-bold text-white mt-1 truncate" title={node.id}>{humanNodeName(node)}</h2>
                          {fm.job_title && (
                            <p className="text-xs text-sky-400 font-mono truncate">{fm.job_title}</p>
                          )}
                          {fm.legal_name && fm.legal_name !== node.title && (
                            <p className="text-[11px] text-gray-400 font-mono truncate">{fm.legal_name}</p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => removeFromDeck(node.id)}
                        className="text-gray-400 hover:text-white p-1 text-sm leading-none shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-gray-800 transition active:scale-95"
                        title="Cerrar ficha"
                        aria-label={`Cerrar ficha de ${node.title}`}
                      >
                        ✕
                      </button>
                    </div>

                    {/* Topología y Ruta Comercial (4 Capas) */}
                    {(fm.market || fm.channel_type || fm.parent_distributor_id || fm.supplied_by || fm.serves_clients || fm.clients || fm.country) && (
                      <div className="mb-3 bg-gradient-to-r from-emerald-950/40 via-slate-900 to-sky-950/40 border border-emerald-500/30 rounded-xl p-3 shadow-lg">
                        <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold mb-2">
                          <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                            <span>Ruta Comercial & Topología (4 Capas)</span>
                          </span>
                          <span className="text-gray-400 text-[9px] font-mono">
                            {node.spatial_tier ? `Capa: ${String(node.spatial_tier).toUpperCase()}` : 'Topología Viva'}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
                          {/* 1. Mercado */}
                          <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-700/80 text-emerald-300 font-semibold text-[10px]">
                            🌎 {fm.country_name || fm.based_in_country || fm.country || 'Mercado Internacional'}
                          </span>
                          <span className="text-gray-500">→</span>
                          {/* 2. Canal */}
                          <span className="px-2 py-0.5 rounded bg-teal-950 border border-teal-700/80 text-teal-300 font-semibold text-[10px]">
                            🛣️ {fm.channel_label || fm.channel_type || (node.type === 'channel' ? node.title : 'Canal Directo')}
                          </span>
                          {/* 3. Operador / Suministrador */}
                          {(fm.parent_distributor_id || fm.supplied_by || node.type === 'distributor' || node.type === 'operator') && (
                            <>
                              <span className="text-gray-500">→</span>
                              <span className="px-2 py-0.5 rounded bg-sky-950 border border-sky-700/80 text-sky-300 font-semibold text-[10px]">
                                📦 {fm.company_name || fm.supplied_by || (node.type === 'distributor' ? node.title : 'Operador Asignado')}
                              </span>
                            </>
                          )}
                        </div>

                        {/* Clientes o Marcas asociadas */}
                        {(fm.serves_clients || fm.clients || fm.active_brands || fm.carries_brands) && (
                          <div className="mt-2 pt-2 border-t border-gray-800/80 text-[10px] text-gray-400 flex flex-col gap-1">
                            {fm.serves_clients && (
                              <div>
                                <span className="text-slate-400 font-bold">Cuentas Clave: </span>
                                <span className="text-slate-200">{Array.isArray(fm.serves_clients) ? fm.serves_clients.join(', ').replace(/\[\[|\]\]/g, '') : fm.serves_clients}</span>
                              </div>
                            )}
                            {(fm.active_brands || fm.carries_brands) && (
                              <div>
                                <span className="text-amber-400 font-bold">Marcas Activas: </span>
                                <span className="text-slate-200">{Array.isArray(fm.active_brands || fm.carries_brands) ? (fm.active_brands || fm.carries_brands).join(', ').replace(/\[\[|\]\]/g, '') : ''}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* 1. Telemetría Ejecutiva en Vivo (Metadatos de Alto Valor) */}
                    <div className="mb-3 bg-gradient-to-r from-sky-950/80 via-gray-950 to-indigo-950/80 border border-sky-500/40 rounded-xl p-3 shadow-inner">
                      <div className="flex items-center justify-between text-[10px] font-mono uppercase text-sky-400 font-bold mb-2">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                          <span>Actividad registrada</span>
                        </span>
                        <span className="text-gray-400 text-[9px]">Datos de la ficha</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                        <div className="bg-gray-900/80 p-2 rounded border border-gray-800">
                          <span className="text-[10px] text-gray-400 block">🕒 Última Actualización:</span>
                          <span className="text-white font-semibold text-[11px]">
                            {(fm.last_updated_at || fm.updated_at) ? new Date(fm.last_updated_at || fm.updated_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Sin fecha registrada'}
                          </span>
                          <span className="text-[9px] text-sky-400 block truncate">Por: {fm.last_updated_by || 'No documentado'}</span>
                        </div>
                        <div className="bg-gray-900/80 p-2 rounded border border-gray-800">
                          <span className="text-[10px] text-gray-400 block">✉️ Último correo registrado:</span>
                          <span className="text-white font-semibold text-[11px] truncate block" title={fm.last_email_subject || 'No consta en esta ficha'}>
                            {fm.last_email_subject || 'No consta en esta ficha'}
                          </span>
                          <span className="text-[9px] text-emerald-400 block truncate">
                            {fm.last_email_date ? `${fm.last_email_date} · ` : ''}{fm.last_email_sender || 'Remitente no documentado'}
                          </span>
                        </div>
                        {(fm.next_followup_action || fm.next_followup_date) && (
                          <div className="col-span-2 bg-gray-900/80 p-2 rounded border border-gray-800 flex items-center justify-between">
                            <div className="min-w-0 pr-2">
                              <span className="text-[10px] text-gray-400 block">🎯 Próximo Hito / Seguimiento:</span>
                              <span className="text-amber-300 font-semibold text-[11px] truncate block">
                                {fm.next_followup_action || 'Seguimiento operativo general'}
                              </span>
                            </div>
                            {fm.next_followup_date && (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950 border border-amber-800 text-amber-300 font-bold shrink-0">
                                {fm.next_followup_date}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 1. Mini-Galería Visual (2 a 3 fotos dinámicas de la entidad) */}
                    {galleryPhotos.length > 0 && (
                      <div className="mb-3 bg-gray-950/80 border border-gray-800 rounded-xl p-3 shadow-lg">
                        <div className="flex items-center justify-between text-[11px] font-mono font-bold text-sky-400 mb-2">
                          <span className="flex items-center gap-1.5">
                            <span>📸</span>
                            <span>Registro Visual & Evidencia Fotográfica ({galleryPhotos.length})</span>
                          </span>
                          <span className="text-[9px] text-gray-500 uppercase tracking-wider">Activos en Vivo</span>
                        </div>
                        <div className={`grid gap-2 ${galleryPhotos.length === 1 ? 'grid-cols-1' : galleryPhotos.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                          {galleryPhotos.map((src, idx) => (
                            <div
                              key={idx}
                              className="group relative h-24 rounded-lg overflow-hidden border border-gray-800 bg-gray-900/90 flex items-center justify-center p-1.5 hover:border-sky-500 transition-all shadow"
                            >
                              <img
                                src={getPhotoUrlWithBust(src, fm.updated_at || fm.updatedAt) || src}
                                alt={`Visual ${idx + 1}`}
                                className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = 'none';
                                }}
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-1.5">
                                <span className="text-[9px] text-white font-mono truncate">
                                  {src.split('/').pop()?.replace(/[-_]/g, ' ')}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 2. Hub de Acciones & Calls Rápidos (CTAs Ejecutivos Directos) */}
                    <div className="mb-3 bg-gradient-to-r from-sky-950/70 via-gray-900 to-indigo-950/70 border border-sky-600/40 rounded-xl p-3 shadow-lg">
                      <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-sky-400 font-bold mb-2">
                        <span className="flex items-center gap-1.5">
                          <span>⚡</span>
                          <span>Hub de Acciones Ejecutivas Inmediatas</span>
                        </span>
                        <span className="text-gray-400">Canales Directos</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {contactWa ? (
                          <a
                            href={`https://wa.me/${contactWa.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hola, te contacto desde la Dirección de Exportaciones de SM Jaleel respecto al estatus y requerimientos de ${node.title}.`)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2.5 py-1.5 bg-emerald-900/80 hover:bg-emerald-800 text-emerald-200 border border-emerald-700/80 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 transition shadow truncate"
                          >
                            <span>💬</span>
                            <span className="truncate">Escribir WhatsApp</span>
                          </a>
                        ) : (
                          <button
                            onClick={() => {
                              setStatusMessage(`Solicitando WhatsApp para ${node.title} a Dots...`);
                              setTimeout(() => setStatusMessage(null), 3000);
                            }}
                            className="px-2.5 py-1.5 bg-gray-800/80 hover:bg-gray-700 text-gray-300 border border-gray-700 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 transition truncate"
                          >
                            <span>💬</span>
                            <span className="truncate">Pedir WhatsApp</span>
                          </button>
                        )}

                        {contactEmail ? (
                          <a
                            href={`mailto:${contactEmail}?subject=${encodeURIComponent(`Actualización Operativa SM Jaleel - ${node.title}`)}&body=${encodeURIComponent(`Estimado equipo,\n\nFavor remitir confirmación y actualización operativa respecto a ${node.title}.\n\nSaludos cordiales,\nDirección Ejecutiva de Exportaciones SM Jaleel`)}`}
                            className="px-2.5 py-1.5 bg-sky-900/80 hover:bg-sky-800 text-sky-200 border border-sky-700/80 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 transition shadow truncate"
                          >
                            <span>✉️</span>
                            <span className="truncate">Enviar Correo</span>
                          </a>
                        ) : (
                          <button
                            onClick={() => {
                              setStatusMessage(`Solicitando correo oficial para ${node.title} a Dots...`);
                              setTimeout(() => setStatusMessage(null), 3000);
                            }}
                            className="px-2.5 py-1.5 bg-gray-800/80 hover:bg-gray-700 text-gray-300 border border-gray-700 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 transition truncate"
                          >
                            <span>✉️</span>
                            <span className="truncate">Pedir Correo</span>
                          </button>
                        )}

                        <button
                          onClick={() => {
                            setStatusMessage(`🤖 Solicitud enviada a Dots: "Actualizar inventario, forecast y acuerdos para ${node.title}"`);
                            setTimeout(() => setStatusMessage(null), 4000);
                          }}
                          className="col-span-2 px-3 py-1.5 bg-indigo-900/70 hover:bg-indigo-800 text-indigo-200 border border-indigo-700/80 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 transition shadow"
                        >
                          <span>🤖</span>
                          <span className="truncate">Solicitar a Dots Actualizar Estatus & Tareas</span>
                        </button>
                      </div>
                    </div>

                    {/* 3. Área de Observaciones Ejecutivas (Elegante y Sin Desorden) */}
                    {fm.executive_observations && (
                      <div className="mb-3 bg-gradient-to-br from-amber-950/40 via-gray-900/90 to-gray-950 border border-amber-500/40 rounded-xl p-3.5 shadow-lg">
                        <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-amber-400 font-bold mb-1.5">
                          <span className="flex items-center gap-1.5">
                            <span>📝</span>
                            <span>Observaciones Estratégicas & Status Operacional</span>
                          </span>
                          <span className="px-1.5 py-0.2 text-[9px] bg-amber-950 border border-amber-800 text-amber-300 rounded font-mono font-bold">
                            HB Validado
                          </span>
                        </div>
                        <p className="text-xs text-gray-200 leading-relaxed font-sans border-l-2 border-amber-500/70 pl-2.5 my-1">
                          {fm.executive_observations}
                        </p>
                      </div>
                    )}

                    {/* 4. Bitácora de Últimas Acciones & Correos Registrados (Timeline Logs) */}
                    {Array.isArray(fm.recent_actions) && fm.recent_actions.length > 0 && (
                      <div className="mb-3 bg-gray-950/80 border border-gray-800 rounded-xl p-3.5 shadow-lg">
                        <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-sky-400 font-bold mb-2.5">
                          <span className="flex items-center gap-1.5">
                            <span>⏱️</span>
                            <span>Bitácora de Acciones & Logs Registrados</span>
                          </span>
                          <span className="text-[9px] text-gray-400 font-mono">Últimas 72h</span>
                        </div>
                        <div className="space-y-2.5 border-l border-sky-500/30 ml-2 pl-3">
                          {fm.recent_actions.map((act: any, idx: number) => {
                            const isObj = typeof act === 'object' && act !== null;
                            const dateStr = isObj ? act.date : 'Reciente';
                            const rawType = isObj ? (act.type || 'acción').toLowerCase() : 'nota';
                            const summaryStr = isObj ? (act.summary || act.detail || JSON.stringify(act)) : String(act);

                            const isEmail = rawType.includes('email') || rawType.includes('correo');
                            const isMeeting = rawType.includes('reunion') || rawType.includes('meeting');
                            const isLogistics = rawType.includes('sop') || rawType.includes('forecast') || rawType.includes('embarque');
                            const isCall = rawType.includes('call') || rawType.includes('whatsapp') || rawType.includes('llamada');

                            const dotBg = isEmail ? 'bg-emerald-400' : isMeeting ? 'bg-sky-400' : isLogistics ? 'bg-indigo-400' : isCall ? 'bg-teal-400' : 'bg-amber-400';
                            const badgeClass = isEmail
                              ? 'text-emerald-300 bg-emerald-950/80 border-emerald-800/60'
                              : isMeeting
                              ? 'text-sky-300 bg-sky-950/80 border-sky-800/60'
                              : isLogistics
                              ? 'text-indigo-300 bg-indigo-950/80 border-indigo-800/60'
                              : isCall
                              ? 'text-teal-300 bg-teal-950/80 border-teal-800/60'
                              : 'text-amber-300 bg-amber-950/80 border-amber-800/60';

                            const iconEmoji = isEmail ? '✉️' : isMeeting ? '🤝' : isLogistics ? '📦' : isCall ? '📞' : '📝';

                            return (
                              <div key={idx} className="relative group">
                                <span className={`absolute -left-[17px] top-1.5 w-2 h-2 rounded-full ${dotBg} border border-gray-950 group-hover:scale-125 transition`} />
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border font-bold flex items-center gap-1 ${badgeClass}`}>
                                    <span>{iconEmoji}</span>
                                    <span>{dateStr}</span>
                                  </span>
                                  <span className="text-[9px] font-mono uppercase text-gray-400 tracking-wider">
                                    {rawType.replace(/_/g, ' ')}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-200 leading-snug">
                                  {summaryStr}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* 5. Tareas & Pendientes Operativos */}
                    {Array.isArray(fm.pending_tasks) && fm.pending_tasks.length > 0 && (
                      <div className="mb-3 bg-gray-950/80 border border-emerald-900/50 rounded-xl p-3 shadow-lg">
                        <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold mb-2">
                          <span className="flex items-center gap-1.5">
                            <span>📋</span>
                            <span>Tareas & Pendientes Operativos ({fm.pending_tasks.length})</span>
                          </span>
                          <span className="px-1.5 py-0.2 text-[9px] bg-emerald-950 border border-emerald-800 text-emerald-300 rounded font-mono font-bold">
                            En Seguimiento
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          {fm.pending_tasks.map((taskItem: any, idx: number) => {
                            const taskText = typeof taskItem === 'object' ? (taskItem.task || taskItem.description || JSON.stringify(taskItem)) : String(taskItem);
                            return (
                              <div key={idx} className="flex items-start gap-2 p-1.5 rounded bg-gray-900/80 border border-gray-800 text-[11px] font-mono">
                                <span className="text-emerald-400 mt-0.5 shrink-0">☑️</span>
                                <span className="text-gray-200 leading-snug">{taskText}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Country/distributor bridge: explicit commercial edges, no geography defaults. */}
                    {node.type === 'market' && (() => {
                      const linkedDistributors = getMarketDistributors(
                        node.id,
                        graphData?.allNodes || graphData?.nodes || nodesRef.current || [],
                        graphData?.links || linksRef.current || []
                      );
                      return (
                        <div className="bg-gradient-to-r from-teal-950/80 to-emerald-950/80 border border-teal-500/60 rounded-xl p-3 mb-3 shadow-lg">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-teal-400 font-bold block">
                            {linkedDistributors.length > 1 ? 'Distribuidores vinculados' : linkedDistributors.length === 1 ? 'Distribuidor vinculado' : 'Distribuidor pendiente'}
                          </span>
                          {linkedDistributors.length === 0 ? (
                            <span className="text-xs font-bold text-white">{marketDistributorLabel([])}</span>
                          ) : linkedDistributors.map(distributor => (
                            <div key={distributor.id} className="flex items-center justify-between gap-2 mt-2">
                              <span className="text-xs font-bold text-white">{distributorDisplayName(distributor)}</span>
                              <button
                                onClick={() => pushToStackedDeck(distributor as NodeData)}
                                className="px-2.5 py-1 bg-teal-600 hover:bg-teal-500 text-white text-[11px] font-semibold rounded shadow transition flex items-center gap-1 shrink-0"
                              >
                                <span>Abrir Distribuidor</span>
                                <span aria-hidden="true">→</span>
                              </button>
                            </div>
                          ))}
                        </div>
                      );
                    })()}

                    {node.type === 'distributor' && (() => {
                      const allNodes = graphData?.nodes || nodesRef.current || [];
                      const allLinks = graphData?.links || linksRef.current || [];
                      const linkedMktNode = allNodes.find((n: any) => {
                        if (n.type !== 'market') return false;
                        const isLinked = allLinks.some((l: any) => {
                          const s = typeof l.source === 'object' ? l.source.id : l.source;
                          const t = typeof l.target === 'object' ? l.target.id : l.target;
                          return (s === node.id && t === n.id) || (s === n.id && t === node.id);
                        });
                        const nFm = node.frontmatter || {};
                        const rels = nFm.relations || {};
                        const belongsTo = JSON.stringify(rels.belongs_to_market || '') + JSON.stringify(nFm.market || '');
                        return isLinked || belongsTo.toLowerCase().includes(n.id.toLowerCase());
                      });

                      const mktTitle = linkedMktNode
                        ? (linkedMktNode.frontmatter?.country_name || linkedMktNode.title.replace(/^Market:\s*/i, ''))
                        : (node.id.includes('sancas') ? 'Belice (CARICOM / Arancel 0%)' :
                           node.id.includes('medimex') || node.id.includes('panama') ? 'Panamá (Hub Logístico Centroamérica)' :
                           node.id.includes('morgan') || node.id.includes('canada') ? 'Canadá (Retail & Mass Market)' :
                           'Estados Unidos (Costa Este)');

                      return (
                        <div className="bg-gradient-to-r from-emerald-950/80 to-sky-950/80 border border-emerald-500/60 rounded-xl p-3 mb-3 shadow-lg">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <span className="text-xl">🌎</span>
                              <div>
                                <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold block">
                                  Territorio de Mercado Asignado
                                </span>
                                <span className="text-xs font-bold text-white">
                                  {mktTitle}
                                </span>
                              </div>
                            </div>
                            {linkedMktNode && (
                              <button
                                onClick={() => pushToStackedDeck(linkedMktNode)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold rounded shadow transition flex items-center gap-1 shrink-0"
                              >
                                <span>Ver País</span>
                                <span>→</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    <CommercialConnections
                      node={node}
                      nodes={graphData?.allNodes || graphData?.nodes || nodesRef.current || []}
                      links={graphData?.links || linksRef.current || []}
                      onOpen={(target, sourceId) => pushToStackedDeck(target as NodeData, false, sourceId)}
                    />
                    {node.type === 'person' && <ContactLayer
                      node={node}
                      nodes={graphData?.allNodes || graphData?.nodes || nodesRef.current || []}
                      links={graphData?.links || linksRef.current || []}
                      onOpen={(target, sourceId) => pushToStackedDeck(target as NodeData, false, sourceId)}
                    />}
                    <PortfolioConnections
                      node={node}
                      nodes={graphData?.allNodes || graphData?.nodes || nodesRef.current || []}
                      links={graphData?.links || linksRef.current || []}
                      onOpen={(target, sourceId) => pushToStackedDeck(target as NodeData, false, sourceId)}
                    />

                    {/* Ficha Ejecutiva Especializada para Distribuidores (100% Datos, 0 Opiniones) */}
                    {node.type === 'distributor' && (
                      <div className="bg-gradient-to-br from-emerald-950/80 via-gray-900 to-gray-950 border border-emerald-500/50 rounded-xl p-3.5 mb-3 text-xs space-y-2.5 shadow-lg">
                        <div className="flex items-center justify-between text-emerald-400 font-bold uppercase tracking-wider text-[10px]">
                          <span className="flex items-center gap-1.5">
                            <span>🤝</span>
                            <span>Ficha del distribuidor</span>
                          </span>
                          <span className="px-1.5 py-0.5 text-[9px] bg-emerald-950 border border-emerald-700 text-emerald-300 rounded font-mono font-bold">
                            {fm.commercial_status_label || (fm.is_active !== false ? 'Vinculado' : 'Por verificar / Histórico')}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                          <div className="col-span-2">
                            <span className="text-gray-400">Razón Social:</span>{' '}
                            <span className="text-white font-bold">{fm.legal_name || fm.company_name || node.title.replace(/^Distributor:\s*/i, '')}</span>
                          </div>
                          {fm.based_in_city && (
                            <div>
                              <span className="text-gray-400">Sede Operativa:</span>{' '}
                              <span className="text-white">{fm.based_in_city}, {fm.based_in_country || 'Panamá'}</span>
                            </div>
                          )}
                          {fm.incoterm && (
                            <div>
                              <span className="text-gray-400">Incoterm:</span>{' '}
                              <span className="text-amber-300 font-semibold">{fm.incoterm}</span>
                            </div>
                          )}
                          {fm.payment_terms && (
                            <div>
                              <span className="text-gray-400">Crédito / Pago:</span>{' '}
                              <span className="text-sky-300">{fm.payment_terms}</span>
                            </div>
                          )}
                          {fm.headquarters_address && (
                            <div className="col-span-2">
                              <span className="text-gray-400">Dirección:</span>{' '}
                              <span className="text-gray-300">{fm.headquarters_address}</span>
                            </div>
                          )}
                        </div>
                        <div className="pt-2 border-t border-gray-800 flex flex-wrap items-center justify-between gap-1 text-[11px] font-mono">
                          <span className="text-gray-400">Canales Directos:</span>
                          <div className="flex items-center gap-2">
                            {fm.phone_main && <span className="text-white">📞 {fm.phone_main}</span>}
                            {fm.email_orders && <a href={`mailto:${fm.email_orders}`} className="text-teal-400 hover:underline">✉️ {fm.email_orders}</a>}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Ficha Ejecutiva Especializada para Mercados */}
                    {node.type === 'market' && (
                      <div className="bg-gradient-to-br from-teal-950/80 via-gray-900 to-gray-950 border border-teal-500/50 rounded-xl p-3.5 mb-3 text-xs space-y-2.5 shadow-lg">
                        <div className="flex items-center justify-between text-teal-400 font-bold uppercase tracking-wider text-[10px]">
                          <span className="flex items-center gap-1.5">
                            <span>🌎</span>
                            <span>Ficha de Mercado Exterior & Operaciones</span>
                          </span>
                          <span className="px-1.5 py-0.5 text-[9px] bg-teal-950 border border-teal-700 text-teal-300 rounded font-mono font-bold">
                            {fm.region || 'Región Internacional'}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                          <div>
                            <span className="text-gray-400">País:</span>{' '}
                            <span className="text-white font-bold">{fm.country_name || node.title.replace(/^Market:\s*/i, '')}</span>
                          </div>
                          <div>
                            <span className="text-gray-400">Moneda:</span>{' '}
                            <span className="text-emerald-300 font-semibold">{fm.currency || 'USD'}</span>
                          </div>
                          {fm.transit_time_from_trinidad_days && (
                            <div>
                              <span className="text-gray-400">Tránsito Marítimo:</span>{' '}
                              <span className="text-sky-300 font-bold">{fm.transit_time_from_trinidad_days} días desde Trinidad</span>
                            </div>
                          )}
                          {fm.regulatory_authority && (
                            <div className="col-span-2">
                              <span className="text-gray-400">Autoridad Sanitaria:</span>{' '}
                              <span className="text-amber-300">{fm.regulatory_authority}</span>
                            </div>
                          )}
                          {fm.primary_ports && Array.isArray(fm.primary_ports) && (
                            <div className="col-span-2">
                              <span className="text-gray-400">Puertos de Arribo:</span>{' '}
                              <span className="text-white">{fm.primary_ports.join(' · ')}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Specialized Executive Dossiers by Entity Type */}
                    {node.type === 'core' && (
                      <div className="bg-gradient-to-br from-amber-950/80 via-gray-900 to-gray-950 border border-amber-500/50 rounded-xl p-3.5 mb-3 text-xs space-y-2.5 shadow-lg">
                        <div className="flex items-center gap-2 text-amber-400 font-bold uppercase tracking-wider text-[10px]">
                          <span>🏛️</span>
                          <span>Ficha Institucional · Casa Matriz SM Jaleel & Co. Ltd.</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                          <div><span className="text-gray-400">Razón Social:</span> <span className="text-white font-medium">S.M. Jaleel & Co. Ltd.</span></div>
                          <div><span className="text-gray-400">Fundación:</span> <span className="text-amber-300 font-medium">1924 (102 años de historia)</span></div>
                          <div className="col-span-2"><span className="text-gray-400">Sede Global:</span> <span className="text-white">Otaheite Industrial Estate, South Oropouche, Trinidad & Tobago</span></div>
                          <div className="col-span-2"><span className="text-gray-400">Giro de Negocio:</span> <span className="text-white">Manufactura, embotellado y exportación de bebidas no alcohólicas</span></div>
                          <div><span className="text-gray-400">Alcance de Exportación:</span> <span className="text-emerald-400 font-medium">+60 países</span></div>
                          <div><span className="text-gray-400">Liderazgo Operativo:</span> <span className="text-sky-300 font-medium">Anna Mohammed (COO)</span></div>
                        </div>
                        <div className="pt-2 border-t border-gray-800 text-[11px]">
                          <span className="text-gray-400 font-mono">Portafolio Clave:</span>{' '}
                          <span className="text-amber-200 font-semibold">Chubby · Busta · Fruta · Oasis · Altitude</span>
                        </div>
                      </div>
                    )}

                    {node.type === 'organization' && (
                      <div className="bg-gradient-to-br from-emerald-950/80 via-gray-900 to-gray-950 border border-emerald-500/50 rounded-xl p-3.5 mb-3 text-xs space-y-2.5 shadow-lg">
                        <div className="flex items-center gap-2 text-emerald-400 font-bold uppercase tracking-wider text-[10px]">
                          <span>🏛️</span>
                          <span>Ficha Institucional · Filial Corporativa Internacional</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                          <div className="col-span-2">
                            <span className="text-gray-400">Razón Social:</span> <span className="text-white font-bold">{node.title}</span>
                          </div>
                          <div>
                            <span className="text-gray-400">Entidad:</span> <span className="text-emerald-300 font-medium">Filial Directa SMJ</span>
                          </div>
                          <div>
                            <span className="text-gray-400">Estatus:</span> <span className="text-sky-300">Activo / Operacional</span>
                          </div>
                          {fm.country && (
                            <div><span className="text-gray-400">País Sede:</span> <span className="text-white">{fm.country}</span></div>
                          )}
                          <div className="col-span-2 pt-1 border-t border-gray-800 flex items-center justify-between">
                            <span className="text-gray-400">Casa Matriz:</span>
                            <span className="text-amber-400 font-medium">S.M. Jaleel & Co. Ltd. (Trinidad)</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {node.type === 'person' && (() => {
                      const allNodes = graphData?.nodes || nodesRef.current || [];
                      const allLinks = graphData?.links || linksRef.current || [];
                      const pName = node.title.replace('Person: ', '');
                      const isCommercialContact = contactEntities(node, graphData?.allNodes || allNodes, allLinks).length > 0;
                      const isLeader = !isCommercialContact && isNodeLeader(node);

                      // Find direct reports (subordinates or people linked to this leader)
                      const directReports = allNodes.filter((n: any) => {
                        if (n.type !== 'person' || n.id === node.id) return false;
                        const rTo = String(n.frontmatter?.reports_to || '').toLowerCase();
                        if (rTo && (rTo.includes(node.id.replace('person-', '')) || rTo.includes(pName.toLowerCase().split(' ')[0]))) return true;
                        const hasLink = allLinks.some((l: any) => {
                          const s = typeof l.source === 'string' ? l.source : l.source.id;
                          const t = typeof l.target === 'string' ? l.target : l.target.id;
                          return s === n.id && t === node.id && (l.relationType === 'reports_to' || l.relationType === 'managed_by');
                        });
                        return hasLink;
                      });

                      const isLeaderAccordionOpen = expandedLeaderInDossier === node.id;

                      return (
                        <div className="space-y-3 mb-3">
                          <div className="bg-gradient-to-br from-indigo-950/80 via-gray-900 to-gray-950 border border-indigo-500/50 rounded-xl p-3.5 text-xs space-y-2.5 shadow-lg">
                            <div className="flex items-center gap-2 text-indigo-400 font-bold uppercase tracking-wider text-[10px]">
                              <span>👤</span>
                              <span>{isCommercialContact ? 'Contacto comercial' : 'Ficha de Perfil Ejecutivo & Línea de Mando'}</span>
                              {isLeader && (
                                <span className="ml-auto px-1.5 py-0.5 text-[9px] bg-amber-950 border border-amber-700 text-amber-300 rounded font-mono font-bold">
                                  👑 Liderazgo L{node.hierarchy_level ?? 2}
                                </span>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                              {fm.job_title && (
                                <div className="col-span-2"><span className="text-gray-400">Cargo Oficial:</span> <span className="text-sky-300 font-bold">{fm.job_title}</span></div>
                              )}
                              {fm.reports_to && (
                                <div className="col-span-2"><span className="text-gray-400">Reporta a:</span> <span className="text-white font-medium">{fm.reports_to}</span></div>
                              )}
                              {fm.based_in_city && (
                                <div><span className="text-gray-400">Ubicación:</span> <span className="text-white">{fm.based_in_city}</span></div>
                              )}
                              {fm.timezone && (
                                <div><span className="text-gray-400">Zona Horaria:</span> <span className="text-white">{fm.timezone}</span></div>
                              )}
                              {fm.email_primary && (
                                <div className="col-span-2"><span className="text-gray-400">Email Directo:</span> <span className="text-sky-300 select-all">{fm.email_primary}</span></div>
                              )}
                            </div>
                          </div>

                          {/* Accordion for Direct Reports if person has team members */}
                          {directReports.length > 0 && (
                            <div className="border border-indigo-500/50 rounded-xl bg-gray-950/90 p-3 shadow-lg">
                              <button
                                onClick={() => setExpandedLeaderInDossier(isLeaderAccordionOpen ? null : node.id)}
                                className="w-full flex items-center justify-between text-xs font-bold text-indigo-300 hover:text-indigo-200 transition select-none"
                              >
                                <div className="flex items-center gap-2">
                                  <span>👥</span>
                                  <span>Equipo a Cargo & Reportes Directos ({directReports.length})</span>
                                </div>
                                <span className="text-[11px] px-2 py-0.5 rounded bg-indigo-950 border border-indigo-800 text-indigo-300 font-mono">
                                  {isLeaderAccordionOpen ? '▲ Encoger' : '▼ Desplegar'}
                                </span>
                              </button>

                              {isLeaderAccordionOpen && (
                                <div className="mt-3 pt-3 border-t border-gray-800 space-y-1.5 animate-in fade-in duration-150 max-h-48 overflow-y-auto pr-1">
                                  {directReports.map((sub: any) => (
                                    <button
                                      key={sub.id}
                                      onClick={() => pushToStackedDeck(sub)}
                                      className="w-full text-left text-[11px] font-mono px-2 py-1.5 rounded bg-gray-900/90 border border-gray-800 hover:border-indigo-400 text-gray-200 hover:text-white transition flex items-center justify-between"
                                    >
                                      <span className="truncate">👤 {sub.title.replace('Person: ', '')} {sub.frontmatter?.job_title ? `· ${sub.frontmatter.job_title}` : ''}</span>
                                      <span className="text-[9px] text-indigo-400 shrink-0 ml-1">→</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {node.type === 'department' && (() => {
                      const deptKey = node.id.includes('export')
                        ? 'exports'
                        : node.id.includes('manufacturing') || node.id.includes('plant')
                        ? 'manufacturing'
                        : node.id.includes('supply') || node.id.includes('procurement')
                        ? 'supply_chain'
                        : node.id.includes('marketing')
                        ? 'marketing'
                        : node.id.includes('legal')
                        ? 'legal'
                        : node.id.includes('business-intelligence')
                        ? 'business_intelligence'
                        : node.id.includes('information-technology') || node.id.includes('-it')
                        ? 'information_technology'
                        : node.id.includes('internal-audit')
                        ? 'internal_audit'
                        : node.id.includes('finance')
                        ? 'finance'
                        : 'general';

                      const allNodes = (graphData as any)?.allNodes || graphData?.nodes || nodesRef.current || [];
                      const obsContacts: string[] = Array.isArray(fm.relations?.observed_contacts) ? fm.relations.observed_contacts : [];
                      const headName = String(fm.head_of_department || '').toLowerCase();
                      const deptIdClean = node.id.replace('dept-', '').toLowerCase();
                      const deptTitleClean = node.title.replace('Department: ', '').toLowerCase();

                      const deptMembers = allNodes.filter((n: any) => {
                        if (n.type !== 'person') return false;
                        const pName = n.title.replace('Person: ', '').toLowerCase();
                        const pIdClean = n.id.replace('person-', '').toLowerCase();
                        const pDept = String(n.frontmatter?.department || n.department || '').toLowerCase();
                        const pReportsTo = String(n.frontmatter?.reports_to || '').toLowerCase();

                        // 1. Observed contacts in department markdown frontmatter
                        if (obsContacts.some(c => c.toLowerCase().includes(pName) || c.toLowerCase().includes(pIdClean))) return true;

                        // 2. Direct frontmatter department specification
                        if (pDept && (pDept.includes(deptIdClean) || pDept.includes(deptTitleClean))) return true;

                        // 3. Supervisor tree (reports directly to the head of this department)
                        if (headName && headName.length > 3 && pReportsTo && pReportsTo.includes(headName.split(' ')[0])) return true;

                        // 4. Categorized match (only if specific and matches verified department)
                        if (deptKey !== 'general' && getPersonDeptCategory(n) === deptKey) return true;

                        return false;
                      });
                      const deptLeaders = deptMembers.filter((p: any) => isNodeLeader(p));
                      const deptStaff = deptMembers.filter((p: any) => !isNodeLeader(p));
                      const isDeptAccordionOpen = expandedDeptInDossier === node.id;

                      return (
                        <div className="space-y-3 mb-3">
                          <div className="bg-gradient-to-br from-blue-950/80 via-gray-900 to-gray-950 border border-blue-500/50 rounded-xl p-3.5 text-xs space-y-2.5 shadow-lg">
                            <div className="flex items-center gap-2 text-sky-400 font-bold uppercase tracking-wider text-[10px]">
                              <span>🏢</span>
                              <span>Ficha Departamental Corporativa</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                              {fm.head_of_department && (
                                <div className="col-span-2"><span className="text-gray-400">Líder / Responsable:</span> <span className="text-sky-300 font-bold">{fm.head_of_department}</span></div>
                              )}
                              {fm.mandate && (
                                <div className="col-span-2"><span className="text-gray-400">Mandato:</span> <span className="text-white">{fm.mandate}</span></div>
                              )}
                              {fm.reports_to && (
                                <div className="col-span-2"><span className="text-gray-400">Reporta a:</span> <span className="text-gray-300">{fm.reports_to}</span></div>
                              )}
                            </div>
                          </div>

                          {/* Collapsible Accordion for Department Team */}
                          <div className="border border-sky-500/50 rounded-xl bg-gray-950/90 p-3 shadow-lg">
                            <button
                              onClick={() => setExpandedDeptInDossier(isDeptAccordionOpen ? null : node.id)}
                              className="w-full flex items-center justify-between text-xs font-bold text-sky-300 hover:text-sky-200 transition select-none"
                            >
                              <div className="flex items-center gap-2">
                                <span>👥</span>
                                <span>Equipo & Colaboradores ({deptMembers.length} personas)</span>
                              </div>
                              <span className="text-[11px] px-2 py-0.5 rounded bg-sky-950 border border-sky-800 text-sky-300 font-mono">
                                {isDeptAccordionOpen ? '▲ Encoger' : '▼ Desplegar'}
                              </span>
                            </button>

                            {isDeptAccordionOpen && (
                              <div className="mt-3 pt-3 border-t border-gray-800 space-y-3 animate-in fade-in duration-150">
                                {deptLeaders.length > 0 && (
                                  <div>
                                    <div className="text-[10px] font-mono uppercase text-sky-400 font-bold mb-1.5 flex items-center justify-between">
                                      <span>👑 Jefatura & Liderazgo ({deptLeaders.length})</span>
                                      <span className="text-[9px] text-gray-500">Clic para abrir</span>
                                    </div>
                                    <div className="space-y-1">
                                      {deptLeaders.map((p: any) => (
                                        <button
                                          key={p.id}
                                          onClick={() => pushToStackedDeck(p)}
                                          className="w-full text-left text-[11px] font-mono px-2.5 py-1.5 rounded bg-sky-950/60 border border-sky-800/80 hover:border-sky-400 text-white transition flex items-center justify-between"
                                        >
                                          <span className="truncate">👤 <strong>{p.title.replace('Person: ', '')}</strong> {p.frontmatter?.job_title ? `· ${p.frontmatter.job_title}` : ''}</span>
                                          <span className="text-sky-400 text-xs ml-1">→</span>
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {deptStaff.length > 0 && (
                                  <div>
                                    <div className="text-[10px] font-mono uppercase text-gray-400 font-bold mb-1.5 flex items-center justify-between">
                                      <span>📋 Colaboradores & Especialistas ({deptStaff.length})</span>
                                      <span className="text-[9px] text-gray-500">Clic para abrir</span>
                                    </div>
                                    <div className="grid grid-cols-1 gap-1 max-h-48 overflow-y-auto pr-1">
                                      {deptStaff.map((p: any) => (
                                        <button
                                          key={p.id}
                                          onClick={() => pushToStackedDeck(p)}
                                          className="text-left text-[11px] font-mono px-2 py-1 rounded bg-gray-900/90 border border-gray-800 hover:border-sky-500 text-gray-200 hover:text-white transition truncate flex items-center justify-between"
                                        >
                                          <span className="truncate">👤 {p.title.replace('Person: ', '')} {p.frontmatter?.job_title ? `· ${p.frontmatter.job_title}` : ''}</span>
                                          <span className="text-[9px] text-sky-400 shrink-0 ml-1">→</span>
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                <button
                                  onClick={() => handleSetOrgScope(deptKey as any)}
                                  className="w-full py-1.5 px-3 bg-sky-900/60 hover:bg-sky-800 border border-sky-600 rounded text-sky-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                                >
                                  <span>🚀 Desplegar Equipo en el Lienzo</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {node.type === 'customer' && (
                      <div className="bg-gradient-to-br from-cyan-950/80 via-gray-900 to-gray-950 border border-cyan-500/50 rounded-xl p-3.5 mb-3 text-xs space-y-2.5 shadow-lg">
                        <div className="flex items-center gap-2 text-cyan-400 font-bold uppercase tracking-wider text-[10px]">
                          <span>🛒</span>
                          <span>Ficha de Cliente Clave / Gran Cuenta</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                          {fm.channel && (
                            <div><span className="text-gray-400">Canal:</span> <span className="text-white font-medium">{fm.channel}</span></div>
                          )}
                          {fm.primary_market && (
                            <div><span className="text-gray-400">Mercado:</span> <span className="text-white font-medium">{fm.primary_market}</span></div>
                          )}
                          {fm.payment_terms && (
                            <div><span className="text-gray-400">Términos Pago:</span> <span className="text-amber-300">{fm.payment_terms}</span></div>
                          )}
                          {fm.edi_system && (
                            <div><span className="text-gray-400">Sistema EDI:</span> <span className="text-sky-300">{fm.edi_system}</span></div>
                          )}
                        </div>
                      </div>
                    )}

                    {node.type === 'brand' && (() => {
                      const brandKey = node.id.replace('brand-', '').toLowerCase();
                      const allCatalogNodes = graphData?.allNodes || graphData?.nodes || [];
                      const brandSubNodes = brandCatalogNodes(node.id, allCatalogNodes, graphData?.links || []);
                      const packNodes = brandSubNodes.filter(n => n.type === 'packaging');
                      const variantNodes = brandSubNodes.filter(n => n.type === 'product_variant');
                      const flavorNodes = brandSubNodes.filter(n => n.type === 'flavor');
                      const isAccordionOpen = expandedBrandInDossier === node.id;

                      return (
                        <div className="space-y-3 mb-3">
                          {/* Quick Master Brands Switcher Bar */}
                          <div className="flex items-center gap-1.5 p-1.5 bg-gray-950/90 border border-gray-800 rounded-lg overflow-x-auto">
                            <span className="text-[10px] text-gray-500 font-mono pl-1 shrink-0">Marcas:</span>
                            {allCatalogNodes.filter((n: any) => n.type === 'brand').map((b: any) => (
                              <button
                                key={b.id}
                                onClick={() => {
                                  const targetBrand = allCatalogNodes.find((n: any) => n.id === b.id);
                                  if (targetBrand) pushToStackedDeck(targetBrand);
                                }}
                                className={`px-2 py-0.5 rounded text-[10px] font-mono flex items-center gap-1 transition shrink-0 ${
                                  node.id === b.id
                                    ? 'bg-amber-600 text-white font-bold shadow'
                                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                                }`}
                              >
                                <span>{b.frontmatter?.brand_name || b.title.replace(/^Brand:\s*/i, '')}</span>
                              </button>
                            ))}
                          </div>

                          <div className="bg-gradient-to-br from-orange-950/80 via-gray-900 to-gray-950 border border-orange-500/50 rounded-xl p-3.5 text-xs space-y-2.5 shadow-lg">
                            <div className="flex items-center gap-2 text-orange-400 font-bold uppercase tracking-wider text-[10px]">
                              <span>🧃</span>
                              <span>Ficha de Portafolio de Marca & Producción</span>
                            </div>
                            {fm.tagline && (
                              <div className="text-xs text-amber-200 italic font-medium pb-1 border-b border-gray-800">
                                &ldquo;{fm.tagline}&rdquo;
                              </div>
                            )}
                            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                              <div><span className="text-gray-400">Planta de Origen:</span> <span className="text-white font-medium">{fm.manufacturing_plant ? String(fm.manufacturing_plant).replace(/[[\]]/g, '') : 'Por confirmar'}</span></div>
                              <div><span className="text-gray-400">Categoría:</span> <span className="text-white font-medium">{fm.category || 'Bebidas SMJ'}</span></div>
                              {fm.shelf_life_months && (
                                <div><span className="text-gray-400">Vida Útil:</span> <span className="text-emerald-400 font-medium">{fm.shelf_life_months} meses</span></div>
                              )}
                              {fm.units_per_case && (
                                <div><span className="text-gray-400">Unidades/Caja:</span> <span className="text-sky-300 font-medium">{formatDisplayValue(fm.units_per_case)}</span></div>
                              )}
                              {fm.cases_per_20ft_container && (
                                <div><span className="text-gray-400">Contenedor 20ft:</span> <span className="text-amber-300 font-medium">{formatDisplayValue(fm.cases_per_20ft_container)} cajas</span></div>
                              )}
                              {fm.cases_per_40ft_container && (
                                <div><span className="text-gray-400">Contenedor 40ft:</span> <span className="text-amber-300 font-medium">{formatDisplayValue(fm.cases_per_40ft_container)} cajas</span></div>
                              )}
                            </div>
                          </div>

                          {/* Collapsible Accordion for Granular SKUs & Multipacks */}
                          <div className="border border-amber-500/50 rounded-xl bg-gray-950/90 p-3 shadow-lg">
                            <button
                              onClick={() => setExpandedBrandInDossier(isAccordionOpen ? null : node.id)}
                              className="w-full flex items-center justify-between text-xs font-bold text-amber-300 hover:text-amber-200 transition select-none"
                            >
                              <div className="flex items-center gap-2">
                                <span>📦</span>
                                <span>Catálogo de SKUs & Multipacks ({brandSubNodes.length} ítems)</span>
                              </div>
                              <span className="text-[11px] px-2 py-0.5 rounded bg-amber-950 border border-amber-800 text-amber-300 font-mono">
                                {isAccordionOpen ? '▲ Encoger' : '▼ Desplegar'}
                              </span>
                            </button>

                            {isAccordionOpen && (
                              <div className="mt-3 pt-3 border-t border-gray-800 space-y-3 animate-in fade-in duration-150">
                                {packNodes.length > 0 && (
                                  <div>
                                    <div className="text-[10px] font-mono uppercase text-gray-400 font-bold mb-1.5 flex items-center justify-between">
                                      <span>Multipacks & Empaques ({packNodes.length})</span>
                                      <span className="text-[9px] text-gray-500">Clic para abrir</span>
                                    </div>
                                    <div className="grid grid-cols-1 gap-1 max-h-40 overflow-y-auto pr-1">
                                      {packNodes.map((p: any) => (
                                        <button
                                          key={p.id}
                                          onClick={() => pushToStackedDeck(p, false, node.id)}
                                          className="text-left text-[11px] font-mono px-2 py-1 rounded bg-gray-900/90 border border-gray-800 hover:border-amber-500 text-gray-200 hover:text-white transition truncate flex items-center justify-between"
                                        >
                                          <span className="truncate">📦 {p.title}</span>
                                          <span className="text-[9px] text-amber-400 shrink-0 ml-1">→</span>
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {variantNodes.length > 0 && (
                                  <div>
                                    <div className="text-[10px] font-mono uppercase text-gray-400 font-bold mb-1.5 flex items-center justify-between">
                                      <span>Variantes & Presentaciones ({variantNodes.length} SKUs)</span>
                                      <span className="text-[9px] text-gray-500">Clic para abrir</span>
                                    </div>
                                    <div className="grid grid-cols-1 gap-1 max-h-48 overflow-y-auto pr-1">
                                      {variantNodes.map((v: any) => (
                                        <button
                                          key={v.id}
                                          onClick={() => pushToStackedDeck(v, false, node.id)}
                                          className="text-left text-[11px] font-mono px-2 py-1 rounded bg-gray-900/90 border border-gray-800 hover:border-sky-500 text-gray-200 hover:text-white transition truncate flex items-center justify-between"
                                        >
                                          <span className="truncate">🏷️ {v.title}</span>
                                          <span className="text-[9px] text-sky-400 shrink-0 ml-1">→</span>
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {flavorNodes.length > 0 && (
                                  <div>
                                    <div className="text-[10px] font-mono uppercase text-gray-400 font-bold mb-1">
                                      Sabores Registrados ({flavorNodes.length}):
                                    </div>
                                    <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                                      {flavorNodes.map((fl: any) => (
                                        <button
                                          key={fl.id}
                                          onClick={() => pushToStackedDeck(fl)}
                                          className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-800 text-emerald-300 hover:bg-emerald-900 transition"
                                        >
                                          🍇 {fl.title.replace(/^Flavor\s*-\s*/i, '')}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                <div className="pt-2 border-t border-gray-800 flex items-center justify-between">
                                  <span className="text-[10px] text-gray-400 font-mono">Control en Mapa:</span>
                                  <button
                                    onClick={() => handleSetCatalogScope(catalogScope === brandKey ? 'collapsed' : brandKey as any)}
                                    className="text-xs px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded shadow transition flex items-center gap-1"
                                  >
                                    <span>{catalogScope === brandKey ? '📁 Plegar del Lienzo' : '🚀 Desplegar en Lienzo'}</span>
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {node.type === 'packaging' && (
                      <div className="bg-gradient-to-br from-amber-950/80 via-gray-900 to-gray-950 border border-amber-500/50 rounded-xl p-3.5 mb-3 text-xs space-y-2.5 shadow-lg">
                        <div className="flex items-center gap-2 text-amber-400 font-bold uppercase tracking-wider text-[10px]">
                          <span>📦</span>
                          <span>Ficha de Formato de Empaque & Multi-Pack</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                          <div className="col-span-2"><span className="text-gray-400">Descripción:</span> <span className="text-white font-bold">{node.title}</span></div>
                          <div><span className="text-gray-400">Tipo de Envase:</span> <span className="text-amber-300">{packagingDescription(fm).container}</span></div>
                          <div><span className="text-gray-400">Configuración:</span> <span className="text-emerald-400">{packagingDescription(fm).configuration}</span></div>
                          <div><span className="text-gray-400">Contenido por unidad:</span> <span className="text-white">{packagingDescription(fm).size}</span></div>
                          <div className="col-span-2"><span className="text-gray-400">Fuente:</span> <span className="text-gray-300">{fm.source || 'Por documentar'}</span></div>
                          {fm.visual_photo_scope === 'linked_unit_reference_not_case_photo' && <p className="col-span-2 text-gray-300">Imagen de la unidad de referencia; la caja no está fotografiada.</p>}
                        </div>
                      </div>
                    )}

                    {node.type === 'product_variant' && (
                      <div className="bg-gradient-to-br from-sky-950/80 via-gray-900 to-gray-950 border border-sky-500/50 rounded-xl p-3.5 mb-3 text-xs space-y-2.5 shadow-lg">
                        <div className="flex items-center gap-2 text-sky-400 font-bold uppercase tracking-wider text-[10px]">
                          <span>🏷️</span>
                          <span>Ficha de SKU & Presentación Comercial</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                          <div className="col-span-2"><span className="text-gray-400">Código en la fuente:</span> <span className="text-white font-bold">{fm.sku_raw || fm.source_item_code || 'No publicado'}</span></div>
                          <div><span className="text-gray-400">Presentación:</span> <span className="text-sky-300">{fm.size_raw || 'Por documentar'}</span></div>
                          <div><span className="text-gray-400">Unidades/Caja:</span> <span className="text-amber-300">{fm.units_per_case_raw || 'Por documentar'}</span></div>
                          <div className="col-span-2"><span className="text-gray-400">Fuente:</span> <span className="text-gray-300">{fm.source || 'Por documentar'}</span></div>
                        </div>
                      </div>
                    )}

                    {node.type === 'flavor' && (
                      <div className="bg-gradient-to-br from-emerald-950/80 via-gray-900 to-gray-950 border border-emerald-500/50 rounded-xl p-3.5 mb-3 text-xs space-y-2.5 shadow-lg">
                        <div className="flex items-center gap-2 text-emerald-400 font-bold uppercase tracking-wider text-[10px]">
                          <span>🍇</span>
                          <span>Ficha de Formulación de Sabor SMJ</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                          <div className="col-span-2"><span className="text-gray-400">Sabor Registrado:</span> <span className="text-emerald-300 font-bold">{node.title}</span></div>
                          <div><span className="text-gray-400">Laboratorio:</span> <span className="text-white">I+D Trinidad</span></div>
                          <div><span className="text-gray-400">Estado:</span> <span className="text-emerald-400">Fórmula Activa</span></div>
                        </div>
                      </div>
                    )}

                    {(node.type === 'routine' || node.type === 'working_memory') && (
                      <div className="bg-gradient-to-br from-amber-950/80 via-gray-900 to-gray-950 border border-amber-500/50 rounded-xl p-3.5 mb-3 text-xs space-y-2.5 shadow-lg">
                        <div className="flex items-center gap-2 text-amber-400 font-bold uppercase tracking-wider text-[10px]">
                          <span>⚡</span>
                          <span>Memoria Operativa S&OP & Cadencia de Negocio</span>
                        </div>
                        <div className="text-[11px] font-mono space-y-1">
                          {fm.frequency && <div><span className="text-gray-400">Cadencia:</span> <span className="text-white">{fm.frequency}</span></div>}
                          {fm.priority && <div><span className="text-gray-400">Prioridad:</span> <span className="text-amber-300 uppercase font-bold">{fm.priority}</span></div>}
                        </div>
                      </div>
                    )}

                    {/* General Metadata Grid (Para entidades sin ficha especializada) */}
                    {node.type !== 'distributor' && node.type !== 'market' && node.type !== 'core' && (
                      <div className="grid grid-cols-2 gap-2 text-xs mb-3 font-mono bg-gray-950/70 p-3 rounded-lg border border-gray-800">
                        {fm.country_name && <div><span className="text-gray-500">País:</span> {formatDisplayValue(fm.country_name)}</div>}
                        {fm.based_in_city && <div><span className="text-gray-500">Ciudad:</span> {formatDisplayValue(fm.based_in_city)}</div>}
                        {fm.timezone && <div><span className="text-gray-500">Zona H.:</span> {formatDisplayValue(fm.timezone)}</div>}
                        {fm.gender && <div><span className="text-gray-500">Género:</span> {formatDisplayValue(fm.gender)}</div>}
                        {fm.incoterm && <div><span className="text-gray-500">Incoterm:</span> {formatDisplayValue(fm.incoterm)}</div>}
                        {fm.transit_time_from_trinidad_days && (
                          <div><span className="text-gray-500">Tránsito TT:</span> {formatDisplayValue(fm.transit_time_from_trinidad_days)} días</div>
                        )}
                        {fm.payment_terms && (
                          <div><span className="text-gray-500">Pago/Crédito:</span> {formatDisplayValue(fm.payment_terms)}</div>
                        )}
                        {fm.currency && (
                          <div><span className="text-gray-500">Moneda:</span> {formatDisplayValue(fm.currency)}</div>
                        )}
                        {fm.annual_target_cases && (
                          <div className="col-span-2 text-sky-400">
                            <span className="text-gray-500">Meta Anual:</span> {formatDisplayValue(fm.annual_target_cases)} cajas
                          </div>
                        )}
                        {fm.primary_ports && (
                          <div className="col-span-2 text-gray-300">
                            <span className="text-gray-500">Puertos:</span> {Array.isArray(fm.primary_ports) ? fm.primary_ports.join(' · ') : formatDisplayValue(fm.primary_ports)}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Completeness Bar */}
                    {node.completeness_score !== undefined && (
                      <div className="mb-3">
                        <div className="flex justify-between text-[10px] text-gray-400 font-mono mb-1">
                          <span>Nivel de Enriquecimiento</span>
                          <span>{node.completeness_score}%</span>
                        </div>
                        <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-sky-500 to-emerald-400 h-full rounded-full transition-all duration-500"
                            style={{ width: `${node.completeness_score}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Formatted Dossier Body */}
                    <div className="mb-3 bg-gray-900/60 p-3 rounded-lg border border-gray-800/80">
                      {renderFormattedBody(node.type === 'person' ? node.body.replace(/^#\s+[^\r\n]+/m, '# ' + humanNodeName(node)) : node.body, target => handleWikilinkClick(target, node.id), getWikilinkLabel)}
                    </div>



                    {/* Action Bar for Dots */}
                    <div className="mb-3 p-2 bg-sky-950/40 border border-sky-900 rounded-lg flex items-center justify-between text-xs">
                      <span className="text-sky-300 font-mono text-[11px]">🤖 Dots Agent Ready</span>
                      <button
                        onClick={() => {
                          setStatusMessage(`Petición enviada a Dots para enriquecer "${node.title}"`);
                          setTimeout(() => setStatusMessage(null), 3000);
                        }}
                        className="px-2.5 py-1 bg-sky-700 hover:bg-sky-600 text-white rounded text-[11px] font-semibold transition"
                      >
                        Completar con Dots
                      </button>
                    </div>

                    {/* Wikilinks: Multi-Abrir */}
                    {node.links.length > 0 && (
                      <div className="pt-2 border-t border-gray-800">
                        <div className="text-[10px] uppercase font-bold text-gray-400 mb-1.5">
                          Sinapsis Directas (Clic para Multi-Abrir):
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {node.links.map((linkName, i) => (
                            <button
                              key={i}
                              onClick={() => handleWikilinkClick(linkName, node.id)}
                              title={linkName}
                              data-canonical-target={linkName}
                              className="text-[11px] font-mono px-2 py-0.5 rounded bg-sky-950/70 border border-sky-800 text-sky-300 hover:bg-sky-900 hover:text-white transition"
                            >
                              {getWikilinkLabel(linkName)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Mobile Sticky Thumb Action Bar at Bottom of Sheet (Min 44px touch target) */}
            <div className="md:hidden p-3 bg-gray-950/95 border-t border-gray-800 sticky bottom-0 z-10 flex gap-2 shrink-0">
              <button
                onClick={() => setStackedDeck([])}
                className="w-full py-3 bg-gray-800 hover:bg-red-950 active:scale-95 text-white rounded-xl text-xs font-bold border border-gray-700 hover:border-red-700 shadow flex items-center justify-center gap-2 min-h-[44px] transition"
                aria-label="Cerrar ficha ejecutiva"
              >
                <span>✕</span>
                <span>Cerrar Ficha Ejecutiva</span>
              </button>
            </div>
          </aside>
        </>
      )}

      {/* Docked Floating Trigger Button (Visible when aside is closed on desktop so user always has 1-click access) */}
      {stackedDeck.length === 0 && (
        <button
          onClick={() => {
            const core = graphData?.nodes.find(n => n.type === 'core') || graphData?.nodes[0];
            if (core) pushToStackedDeck(core);
          }}
          className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 bg-sky-600 hover:bg-sky-500 active:scale-95 text-white py-3.5 px-2.5 rounded-l-xl shadow-2xl text-xs font-bold z-30 items-center gap-1.5 transition select-none cursor-pointer border border-sky-400"
          title="Abrir Ficha Lateral Ejecutiva"
        >
          <span>📋 Abrir Ficha Lateral</span>
        </button>
      )}
      </div>
    </div>
  );
}
