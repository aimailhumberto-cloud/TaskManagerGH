'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import Link from 'next/link';
import { getMarketDistributors, marketDistributorLabel, distributorDisplayName } from '@/lib/marketDistributors';
import { searchBrainNodes, resolveBrainNode, humanNodeName, fitIdentityBounds } from '@/lib/smjIdentity';
import { computeNativeLayout, mergeLayoutConfig } from '@/lib/cerebroLayout';
import { contactTarget, contactEntities } from '@/lib/contactLayer';
import { ContactLayer } from '@/components/ContactLayer';
import { brandCatalogNodes, packagingDescription } from '@/lib/portfolioConnections';
import { PortfolioConnections } from '@/components/PortfolioConnections';
import { CommercialConnections } from '@/components/CommercialConnections';
import { resolveCollisions } from './collision';
import { stepPhysics, LabelBoard } from './physics';
import { drawLinks } from './linkArt';
import type { RenderLoopProps } from './props';
import type { NodeData, LinkData, BrainGraphResponse } from './types';
import { BRAND_AVATARS, getPhotoUrlWithBust, getNodeCustomPhoto, drawPanamaFlag, drawCanadaFlag, drawUSAFlag, drawBelizeFlag, drawTrinidadFlag, drawSMJCorporateCrest, drawPersonAvatar, drawDistributorBadge, drawOrganizationBadge, drawBrandBadge, drawGlassDomeOverlay, drawAmericasMapBackdrop } from './nodeArt';
import { drawBubble, hiddenFamilies } from './bubbleArt';
import { formatDisplayValue, renderFormattedBody } from './bodyFormat';
import { TYPE_CONFIG, nodeLevel, MAX_NODES_PER_OPEN, isNodeLeader, getPersonDeptCategory, CLUSTER_CENTERS, ORGANIGRAM_STRATA, assignQuadrantTarget, assignClusterTarget, assignOrganigramTarget } from './layoutTargets';
import { CerebroHeader } from './CerebroHeader';
import { CerebroSettingsMenu } from './CerebroSettingsMenu';
import { CerebroSideCard } from './CerebroSideCard';
import { useCanvasGestures } from './useCanvasGestures';
import { CerebroHud } from './CerebroHud';

// Bucle de dibujo y física del lienzo (60 FPS). Extraído de page.tsx sin cambios de comportamiento.
export function useCanvasRenderLoop(props: RenderLoopProps) {
  const { animFrameRef, canvasRef, cappedInfoRef, drilldownStackRef, expansionsRef, gravityActive, hoveredNodeRef, linksRef, mounted, nativeLayoutDecorRef, nodesRef, selectedNodeIdRef, stackedDeck, transformRef, viewMode, hoodRef } = props;
    // 60FPS High-Precision Kinetic Loop with Collision Repulsion (Zero Overlap)
  useEffect(() => {
    if (!mounted) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let time = 0;
    // Quien pide menos movimiento en su sistema no ve el vaivén en reposo.
    const reducedMotion = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    // Medición opcional por sección (apagada por defecto): en la consola, window.__cerebroPerf = {}
    const render = () => {
      const perf = typeof window !== 'undefined' ? (window as any).__cerebroPerf : undefined;
      let perfT = perf ? performance.now() : 0;
      const mark = (k: string) => {
        if (!perf) return;
        const now = performance.now();
        perf[k] = (perf[k] || 0) + (now - perfT);
        perfT = now;
      };
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
        // A. Resorte con inercia hacia el destino, vaivén en reposo y tirón de las conexiones al arrastrar.
        stepPhysics(nodes as any, links as any, { time, breathe: !reducedMotion });

        mark('resortes');
        // Point 10: separación anti-solapamiento (con rejilla espacial si hay muchos nodos)
        resolveCollisions(nodes, perf?.gridFrom);
      }

      mark('fisica');
      // 2. High-DPI Context Scaling
      ctx.save();
      ctx.scale(dpr, dpr);

      // Deep space canvas background
      ctx.fillStyle = '#071230';
      ctx.fillRect(0, 0, cssWidth, cssHeight);
      const vignette = ctx.createRadialGradient(cssWidth / 2, cssHeight / 2, 0, cssWidth / 2, cssHeight / 2, Math.max(cssWidth, cssHeight) * 0.75);
      vignette.addColorStop(0, 'rgba(10, 63, 191, 0.38)');
      vignette.addColorStop(0.55, 'rgba(11, 31, 77, 0.30)');
      vignette.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, cssWidth, cssHeight);

      // 3. Camera Transform
      ctx.save();
      const { x: tx, y: ty, scale } = transformRef.current;
      ctx.translate(tx, ty);
      ctx.scale(scale, scale);

      // Zona visible en coordenadas del mundo, con margen para brillos y etiquetas.
      // Lo que cae fuera no se dibuja: con miles de nodos solo se pinta lo que se ve.
      const viewMargin = Math.max(220, 140 / Math.max(scale, 0.05));
      const viewLeft = -tx / scale - viewMargin;
      const viewTop = -ty / scale - viewMargin;
      const viewRight = (cssWidth - tx) / scale + viewMargin;
      const viewBottom = (cssHeight - ty) / scale + viewMargin;

      // Starfield grid (un solo trazo en vez de 1.681)
      ctx.fillStyle = 'rgba(0, 168, 240, 0.05)';
      ctx.beginPath();
      for (let gx = -1600; gx <= 1600; gx += 80) {
        if (gx < viewLeft || gx > viewRight) continue;
        for (let gy = -1600; gy <= 1600; gy += 80) {
          if (gy < viewTop || gy > viewBottom) continue;
          ctx.moveTo(gx + 0.9, gy);
          ctx.arc(gx, gy, 0.9, 0, Math.PI * 2);
        }
      }
      ctx.fill();

      // 4. Mode-Specific Backdrop Graphics
      if (viewMode === 'brujula' || viewMode === 'version-1-ajustada') {
        // Dibujar decoraciones nativas (ejes, anillos, carriles, etiquetas de país [BZ], bandejas)
        // En un vecindario no hay regiones a la vista: sin sus rótulos ni carriles.
        const decorList = hoodRef.current ? [] : (nativeLayoutDecorRef.current || []);
        for (const d of decorList) {
          if (d.kind === 'ring' && typeof d.r === 'number') {
            ctx.strokeStyle = 'rgba(0, 168, 240, 0.08)';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 6]);
            ctx.beginPath();
            ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
          } else if (d.kind === 'axis-label' && d.text) {
            // Nombre de la región: siempre legible, sin importar qué tan lejos esté la cámara.
            ctx.font = `600 ${11 * Math.max(1, 0.95 / scale)}px Poppins, system-ui, -apple-system, "Segoe UI", sans-serif`;
            ctx.fillStyle = 'rgba(0, 168, 240, 0.85)';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            // Hacia adentro del arco: afuera van los nombres de las burbujas.
            ctx.fillText(String(d.text).split('').join('\u200A'), d.x * 0.55, d.y * 0.55);
          } else if (d.kind === 'lane') {
            if (d.w && d.h) {
              ctx.fillStyle = d.dim ? 'rgba(255, 255, 255, 0.015)' : 'rgba(0, 168, 240, 0.025)';
              ctx.fillRect(d.x, d.y, d.w, d.h);
              ctx.strokeStyle = d.dim ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 168, 240, 0.12)';
              ctx.lineWidth = 0.8;
              ctx.strokeRect(d.x, d.y, d.w, d.h);
            }
            // La etiqueta técnica del carril ("[ZA] Market: ...") ya no se pinta: en ese lugar va el nombre de la burbuja.
          } else if (d.kind === 'column-label' && d.text) {
            ctx.font = 'bold 9px \"Inter\", system-ui, -apple-system, \"Segoe UI\", sans-serif';
            ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';
            ctx.textAlign = 'center';
            ctx.fillText(d.text, d.x, d.y);
          } else if (d.kind === 'tray' && d.w && d.h && !/\(0\)\s*$/.test(String(d.text || ''))) {
            ctx.fillStyle = d.dim ? 'rgba(15, 23, 42, 0.4)' : 'rgba(239, 68, 68, 0.04)';
            ctx.fillRect(d.x, d.y, d.w, d.h);
            ctx.strokeStyle = d.dim ? 'rgba(100, 116, 139, 0.25)' : 'rgba(239, 68, 68, 0.3)';
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
            ctx.strokeRect(d.x, d.y, d.w, d.h);
            ctx.setLineDash([]);
            if (d.text) {
              ctx.font = `600 ${9 * Math.max(1, 0.95 / scale)}px Poppins, system-ui, -apple-system, "Segoe UI", sans-serif`;
              ctx.fillStyle = d.dim ? 'rgba(148, 163, 184, 0.8)' : 'rgba(248, 113, 113, 0.9)';
              ctx.textAlign = 'left';
              ctx.textBaseline = 'bottom';
              ctx.fillText(d.text, d.x, d.y - 4);
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

        ctx.font = 'bold 9px \"Inter\", system-ui, -apple-system, \"Segoe UI\", sans-serif';
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

        ctx.font = 'bold 8px \"Inter\", system-ui, -apple-system, \"Segoe UI\", sans-serif';
        ctx.fillStyle = 'rgba(245, 158, 11, 0.6)';
        ctx.textAlign = 'center';
        ctx.fillText('SEDE CENTRAL TRINIDAD & PLANTA', 50, 45);

        // Right Executive Zone Box
        ctx.strokeStyle = 'rgba(129, 140, 248, 0.25)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(180, -250, 620, 460);
        ctx.setLineDash([]);

        ctx.font = 'bold 9px \"Inter\", system-ui, -apple-system, \"Segoe UI\", sans-serif';
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

          ctx.font = 'bold 7px \"Inter\", system-ui, -apple-system, \"Segoe UI\", sans-serif';
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

          ctx.font = 'bold 9px \"Inter\", system-ui, -apple-system, \"Segoe UI\", sans-serif';
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

          ctx.font = 'bold 9px \"Inter\", system-ui, -apple-system, \"Segoe UI\", sans-serif';
          ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
          ctx.textAlign = 'center';
          ctx.fillText(cl.label.toUpperCase(), cl.x, cl.y - 160);
        });
      }

      mark('fondo');
      // 5. Draw Synaptic Links with High-Energy Photons
      // Modo Enfoque Dinámico: Si hay una entidad activa (por clic en ficha o hover), NADA MÁS se ven las líneas vivas conectadas a ella!
      const activeEntityId = selectedNodeIdRef.current || (stackedDeck.length > 0 ? stackedDeck[0].id : activeHover?.id);
      const isFocusActive = !!activeEntityId;

      // Cuantos nodos estan conectados al foco: con muchos, las etiquetas solo salen al acercar (evita el amontonamiento).
      let focusConnectedCount = 0;
      const deckIds = new Set<string>(stackedDeck.map((d: any) => d.id));
      const focusNeighborIds = new Set<string>();
      if (isFocusActive) {
        for (const l of links) {
          if (l.source === activeEntityId || l.target === activeEntityId) focusConnectedCount++;
          if (l.source === activeEntityId) focusNeighborIds.add(l.target);
          if (l.target === activeEntityId) focusNeighborIds.add(l.source);
        }
      }
      // En el vecindario de una región, todas sus fichas cuentan como conectadas al centro (no se atenúan).
      if (hoodRef.current?.id.startsWith('region::')) for (const id of hoodRef.current.ids) focusNeighborIds.add(id);
      drawLinks(ctx, { links, nodes, nodeMap, view: { left: viewLeft, right: viewRight, top: viewTop, bottom: viewBottom }, scale, time, focusId: activeEntityId, deckIds, focusCount: focusConnectedCount, hideIdle: viewMode === 'organigram' });

      // Rayos de región: del centro a cada región cerrada (la entrada) o de una región a sus fichas (vecindario de región).
      {
        const hoodId = hoodRef.current?.id;
        const hub = hoodId && hoodId.startsWith('region::') ? nodeMap.get(hoodId) : nodes.find(n => n.type === 'core' && !n.hiddenByFilter);
        if (hub) {
          const lw = Math.max(1, Math.min(1.8, 0.85 / scale));
          for (const n of nodes) {
            if (n === hub || n.hiddenByFilter) continue;
            if (hub.type === 'region' ? false : n.type !== 'region') continue;
            const rgb = (hub.type === 'region' ? hub : n).frontmatter?.region_color || '0, 168, 240';
            // Región abierta: su rayo queda como un hilo fino hasta el botón de cerrar.
            if (n.frontmatter?.region_open) { ctx.beginPath(); ctx.moveTo(hub.x, hub.y); ctx.lineTo(n.x, n.y); ctx.strokeStyle = `rgba(${rgb}, 0.3)`; ctx.lineWidth = 1 * lw; ctx.stroke(); continue; }
            const dim = isFocusActive && activeEntityId !== hub.id && activeEntityId !== n.id ? 0.35 : 1;
            ctx.beginPath(); ctx.moveTo(hub.x, hub.y); ctx.lineTo(n.x, n.y);
            ctx.strokeStyle = `rgba(${rgb}, ${0.16 * dim})`; ctx.lineWidth = 7 * lw; ctx.stroke();
            ctx.strokeStyle = `rgba(${rgb}, ${0.85 * dim})`; ctx.lineWidth = 1.8 * lw; ctx.stroke();
            // Dos pulsos que viajan del centro hacia afuera.
            for (const off of [0, 0.5]) {
              const u = (time * 0.25 + off + (n.x + n.y) * 0.0007) % 1, uu = u < 0 ? u + 1 : u;
              ctx.beginPath(); ctx.arc(hub.x + (n.x - hub.x) * uu, hub.y + (n.y - hub.y) * uu, 2.6 * lw, 0, Math.PI * 2);
              ctx.fillStyle = `rgba(255, 255, 255, ${0.9 * dim})`; ctx.fill();
            }
          }
        }
      }
      // Segunda capa del vecindario (PC): un hilo fino de cada burbuja a su rama, y "+N" si la rama tiene más.
      {
        const hd = hoodRef.current;
        if (hd?.parents) {
          const lw = Math.max(1, Math.min(1.8, 0.85 / scale)), c = nodeMap.get(hd.id);
          ctx.beginPath();
          for (const id in hd.parents) { const k = nodeMap.get(id), p = nodeMap.get(hd.parents[id]); if (k && p) { ctx.moveTo(p.x, p.y); ctx.lineTo(k.x, k.y); } }
          ctx.strokeStyle = 'rgba(159, 220, 255, 0.28)'; ctx.lineWidth = 1 * lw; ctx.stroke();
          if (c && hd.more) {
            ctx.font = `600 ${10.5 * Math.max(1, 0.92 / scale)}px Poppins, system-ui, -apple-system, "Segoe UI", sans-serif`;
            ctx.fillStyle = 'rgba(159, 220, 255, 0.85)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            for (const id in hd.more) {
              const p = nodeMap.get(id); if (!p) continue;
              const d = Math.hypot(p.x - c.x, p.y - c.y) || 1, ux = (p.x - c.x) / d, uy = (p.y - c.y) / d;
              ctx.fillText(`+${hd.more[id]}`, c.x + ux * (d + 188), c.y + uy * (d + 188));
            }
          }
        }
      }
      mark('enlaces');
      // 6. Draw Celestial Nodes
      const labelBoard = new LabelBoard();
      const labelJobs: { n: NodeData; r: number; emphasized: boolean; alpha: number; typeLabel: string }[] = [];
      const sideLabels = (viewMode === 'brujula' || viewMode === 'version-1-ajustada') && !hoodRef.current;
      for (const n of nodes) {
        // Nodo fuera de la zona visible: no se dibuja (ni se piden sus imágenes).
        if (n.x < viewLeft || n.x > viewRight || n.y < viewTop || n.y > viewBottom) continue;
        if (n.hiddenByFilter) continue;
        const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.department;
        const isSelected = n.id === selectedNodeIdRef.current || deckIds.has(n.id);
        const isHovered = activeHover?.id === n.id;
        const isWorking = n.memory_tier === 'working';
        const isOpen = expansionsRef.current.has(n.id);
        const pulse = isWorking ? Math.sin(time * 4) * 3 : 0;
        // Tamaño mínimo en pantalla: de lejos las burbujas no se encogen hasta perderse.
        // Las regiones cerradas se mantienen grandes aunque la cámara se aleje: su número siempre se lee.
        const baseR = n.type === 'region' ? Math.max(n.radius, Math.min(30 / scale, n.radius * 1.9)) : Math.max(n.radius, Math.min(14 / scale, n.radius * 1.35));
        const r = (baseR + (isHovered ? 6 : 0) + pulse);

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

        const isConnectedToFocus = !isFocusActive || n.id === activeEntityId || focusNeighborIds.has(n.id);

        if (!isPartOfDrill) {
          ctx.globalAlpha = 0.15; // Suave atenuación de capas ajenas al drill-down activo
        } else if (isFocusActive && !isConnectedToFocus) {
          ctx.globalAlpha = 0.30;
        } else {
          ctx.globalAlpha = 1.0;
        }

        // Segunda capa del vecindario: presente pero discreta.
        const isOuter = !!hoodRef.current?.parents?.[n.id];
        if (isOuter) ctx.globalAlpha = isHovered ? 1 : 0.72;
        mark('n_prep');
        // Burbuja on-brand: color por familia, foto o icono, anillo, chincheta y punto de estado.
        const nid = n.id.toLowerCase();
        if (n.type === 'region') {
          // Región cerrada: burbuja grande con su color y el número de fichas adentro.
          const rgb = n.frontmatter?.region_color || '0, 168, 240';
          if (n.frontmatter?.region_open) {
            // Región abierta: un botón pequeño con un "menos" para volver a cerrarla.
            const rr = Math.max(n.radius, Math.min(13 / scale, n.radius * 2.4)) + (isHovered ? 3 : 0);
            ctx.beginPath(); ctx.arc(n.x, n.y, rr, 0, Math.PI * 2);
            ctx.fillStyle = '#0b1f4d'; ctx.fill(); ctx.fillStyle = `rgba(${rgb}, ${isHovered ? 0.4 : 0.18})`; ctx.fill();
            ctx.lineWidth = 1.6 * Math.max(1, 0.8 / scale); ctx.strokeStyle = `rgba(${rgb}, 0.9)`; ctx.stroke();
            ctx.beginPath(); ctx.moveTo(n.x - rr * 0.45, n.y); ctx.lineTo(n.x + rr * 0.45, n.y);
            ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2 * Math.max(1, 0.8 / scale); ctx.stroke();
            labelBoard.claim(n.x - rr, n.y - rr, rr * 2, rr * 2, true);
            if (isHovered) labelJobs.push({ n, r: rr, emphasized: true, alpha: 1, typeLabel: '' });
            ctx.globalAlpha = 1.0;
            continue;
          }
          const g = ctx.createRadialGradient(n.x, n.y - r * 0.3, r * 0.15, n.x, n.y, r);
          g.addColorStop(0, `rgba(${rgb}, 0.42)`); g.addColorStop(1, `rgba(${rgb}, 0.14)`);
          if (isHovered || isSelected) { ctx.beginPath(); ctx.arc(n.x, n.y, r + 9, 0, Math.PI * 2); ctx.fillStyle = `rgba(${rgb}, 0.16)`; ctx.fill(); }
          ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
          ctx.fillStyle = '#0b1f4d'; ctx.fill(); ctx.fillStyle = g; ctx.fill();
          ctx.lineWidth = 2.5; ctx.strokeStyle = `rgba(${rgb}, 0.95)`; ctx.stroke();
          ctx.font = `600 ${Math.round(r * 0.62)}px Poppins, system-ui, -apple-system, "Segoe UI", sans-serif`;
          ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(String(n.frontmatter?.member_count ?? ''), n.x, n.y + 1);
          labelBoard.claim(n.x - r, n.y - r, r * 2, r * 2, true);
          labelJobs.push({ n, r, emphasized: true, alpha: ctx.globalAlpha, typeLabel: '' });
          ctx.globalAlpha = 1.0;
          continue;
        }
        const drewFull = drawBubble(ctx, n, {
          r, scale, selected: isSelected, hovered: isHovered, open: isOpen, working: isWorking,
          inner: n.type !== 'market' ? undefined : () => {
            if (nid.includes('trinidad') || (n.frontmatter && n.frontmatter.iso_code === 'TT')) drawTrinidadFlag(ctx, n.x, n.y, r);
            else if (nid.includes('panama')) drawPanamaFlag(ctx, n.x, n.y, r);
            else if (nid.includes('canada')) drawCanadaFlag(ctx, n.x, n.y, r);
            else if (nid.includes('united-states') || nid.includes('usa')) drawUSAFlag(ctx, n.x, n.y, r);
            else if (nid.includes('belize')) drawBelizeFlag(ctx, n.x, n.y, r);
            else return false;
            return true;
          },
        });
        mark('n_arte');
        if (!drewFull) { ctx.globalAlpha = 1.0; continue; }

        mark('n_borde');
        // Nombre de la burbuja: se anota aquí y se pinta al final, encima de todas las burbujas y sin taparlas.
        const emphasized = isSelected || isHovered || isOpen;
        const isMinorNode = (n.radius || 24) < 22;
        labelBoard.claim(n.x - r, n.y - r, r * 2, r * 2, true);
        if (isOuter ? isHovered : hoodRef.current ? true : (emphasized || (isFocusActive && isConnectedToFocus && (focusConnectedCount <= 10 || scale >= 1.8)) || !isMinorNode || scale >= 1.1)) {
          labelJobs.push({ n, r, emphasized, alpha: ctx.globalAlpha, typeLabel: cfg.label });
        }
        mark('n_etiqueta');
        // Burbuja "+N mas": hay mas nodos en este nivel; un clic en ella trae los siguientes
        const hiddenCount = cappedInfoRef.current.get(n.id);
        if (hiddenCount && isOpen) {
          const py = n.y + (n.radius || 24) + 46;
          ctx.beginPath();
          ctx.roundRect(n.x - 38, py - 11, 76, 22, 11);
          ctx.fillStyle = 'rgba(0, 168, 240, 0.16)';
          ctx.fill();
          ctx.lineWidth = 1;
          ctx.strokeStyle = 'rgba(0, 168, 240, 0.75)';
          ctx.stroke();
          ctx.font = '600 11px system-ui, -apple-system, "Segoe UI", sans-serif';
          ctx.fillStyle = '#9fdcff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`+${hiddenCount} más`, n.x, py);
        }
        ctx.globalAlpha = 1.0;
      }

      // Nombres: primero los destacados; cada uno busca un sitio libre (afuera a los lados, debajo o arriba).
      // Se leen igual de lejos que de cerca: el texto crece cuando la cámara se aleja.
      const ls = Math.max(1, 0.92 / scale);
      labelJobs.sort((a, b) => Number(b.emphasized) - Number(a.emphasized) || (b.n.radius || 0) - (a.n.radius || 0));
      for (const job of labelJobs) {
        const { n, r, emphasized } = job;
        // El tipo ya se lee debajo: se quita el prefijo "Brand: ", "Department: ", etc.
        const humanTitle = humanNodeName(n).replace(/^[A-Za-z][A-Za-z &]{2,22}(?::\s+|\s+-\s+)/, '');
        // En el vecindario los nombres de alrededor van más cortos para no encimarse con la burbuja vecina.
        const cap = hoodRef.current && hoodRef.current.id !== n.id ? (hoodRef.current.parents ? 22 : 16) : 25;
        const displayTitle = humanTitle.length > cap ? humanTitle.slice(0, cap - 2) + '…' : humanTitle;
        const w = (displayTitle.length * 6.6 + 8) * ls, gap = 7 * ls;
        const below = { x: n.x - w / 2, y: n.y + r + 4 * ls, h: (emphasized ? 32 : 18) * ls, align: 'center' as CanvasTextAlign, tx: n.x, ty: n.y + r + gap + 7 * ls };
        const above = { x: n.x - w / 2, y: n.y - r - 22 * ls, h: 18 * ls, align: 'center' as CanvasTextAlign, tx: n.x, ty: n.y - r - gap - 6 * ls };
        const left = { x: n.x - r - gap - w, y: n.y - 9 * ls, h: 18 * ls, align: 'right' as CanvasTextAlign, tx: n.x - r - gap, ty: n.y };
        const right = { x: n.x + r + gap, y: n.y - 9 * ls, h: 18 * ls, align: 'left' as CanvasTextAlign, tx: n.x + r + gap, ty: n.y };
        // En la brújula, lo que está a los lados lleva el nombre hacia afuera; lo de arriba y abajo, debajo.
        const outward = sideLabels && Math.abs(n.x) > 140 && Math.abs(n.y) < Math.abs(n.x) * 1.25;
        const order = emphasized ? [below] : outward ? (n.x < 0 ? [left, below, above, right] : [right, below, above, left]) : [below, above, n.x < 0 ? left : right, n.x < 0 ? right : left];
        const spot = order.find(o => labelBoard.claim(o.x, o.y, w, o.h, emphasized));
        if (!spot) continue;
        ctx.globalAlpha = job.alpha;
        ctx.font = emphasized ? `600 ${13 * ls}px Poppins, system-ui, -apple-system, "Segoe UI", sans-serif` : `${12 * ls}px Poppins, system-ui, -apple-system, "Segoe UI", sans-serif`;
        ctx.fillStyle = emphasized ? '#ffffff' : 'rgba(229, 231, 235, 0.88)';
        ctx.textAlign = spot.align;
        ctx.textBaseline = 'middle';
        ctx.fillText(displayTitle, spot.tx, spot.ty);
        // Tipo de nodo: solo en lo destacado, o al acercar.
        if (spot === below && job.typeLabel && (emphasized || scale >= 0.95)) {
          ctx.font = `500 ${9 * ls}px system-ui, -apple-system, "Segoe UI", sans-serif`;
          ctx.fillStyle = emphasized ? '#00a8f0' : 'rgba(148, 163, 184, 0.8)';
          ctx.textAlign = 'center';
          ctx.fillText(job.typeLabel.toUpperCase().split('').join('\u200A'), n.x, n.y + r + gap + 23 * ls);
        }
      }
      ctx.globalAlpha = 1.0;

      mark('nodos');
      if (perf) perf.frames = (perf.frames || 0) + 1;
      ctx.restore(); // Camera
      ctx.restore(); // High-DPI

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [mounted, stackedDeck, gravityActive, viewMode]);
}
