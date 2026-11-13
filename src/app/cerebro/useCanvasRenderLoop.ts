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
import type { RenderLoopProps } from './props';
import type { NodeData, LinkData, BrainGraphResponse } from './types';
import { BRAND_AVATARS, getPhotoUrlWithBust, getNodeCustomPhoto, drawPanamaFlag, drawCanadaFlag, drawUSAFlag, drawBelizeFlag, drawTrinidadFlag, drawSMJCorporateCrest, drawPersonAvatar, drawDistributorBadge, drawOrganizationBadge, drawBrandBadge, drawGlassDomeOverlay, drawAmericasMapBackdrop } from './nodeArt';
import { drawBubble } from './bubbleArt';
import { formatDisplayValue, renderFormattedBody } from './bodyFormat';
import { TYPE_CONFIG, nodeLevel, MAX_NODES_PER_OPEN, isNodeLeader, getPersonDeptCategory, CLUSTER_CENTERS, ORGANIGRAM_STRATA, assignQuadrantTarget, assignClusterTarget, assignOrganigramTarget } from './layoutTargets';
import { CerebroHeader } from './CerebroHeader';
import { CerebroSettingsMenu } from './CerebroSettingsMenu';
import { CerebroSideCard } from './CerebroSideCard';
import { useCanvasGestures } from './useCanvasGestures';
import { CerebroHud } from './CerebroHud';

// Bucle de dibujo y física del lienzo (60 FPS). Extraído de page.tsx sin cambios de comportamiento.
export function useCanvasRenderLoop(props: RenderLoopProps) {
  const { animFrameRef, canvasRef, cappedInfoRef, drilldownStackRef, expansionsRef, gravityActive, hoveredNodeRef, linksRef, mounted, nativeLayoutDecorRef, nodesRef, selectedNodeIdRef, stackedDeck, transformRef, viewMode } = props;
    // 60FPS High-Precision Kinetic Loop with Collision Repulsion (Zero Overlap)
  useEffect(() => {
    if (!mounted) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let time = 0;

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
        // A. Resorte amortiguado hacia el destino: los nodos grandes pesan mas y llegan con calma,
        //    los pequenos llegan rapido con un rebote corto. Sin vaiven permanente: al llegar, reposan.
        for (const n of nodes) {
          if (n.isPinned) {
            n.vx = 0;
            n.vy = 0;
            n.x = n.pinnedX ?? n.x;
            n.y = n.pinnedY ?? n.y;
            continue;
          }
          if (n.isDragged) {
            n.vx = 0;
            n.vy = 0;
            continue;
          }
          const mass = Math.max(0.7, (n.radius || 24) / 24);
          const stiffness = 0.085 / mass;
          const damping = 0.78;
          const dx = n.targetX - n.x;
          const dy = n.targetY - n.y;
          n.vx = ((n.vx || 0) + dx * stiffness) * damping;
          n.vy = ((n.vy || 0) + dy * stiffness) * damping;
          if (Math.abs(dx) < 0.05 && Math.abs(dy) < 0.05 && Math.abs(n.vx) < 0.02 && Math.abs(n.vy) < 0.02) {
            n.vx = 0;
            n.vy = 0;
            continue;
          }
          n.x += n.vx;
          n.y += n.vy;
        }

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
        const decorList = nativeLayoutDecorRef.current || [];
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
            ctx.font = 'bold 11px \"Inter\", system-ui, -apple-system, \"Segoe UI\", sans-serif';
            ctx.fillStyle = 'rgba(0, 168, 240, 0.85)';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(d.text, d.x, d.y);
          } else if (d.kind === 'lane') {
            if (d.w && d.h) {
              ctx.fillStyle = d.dim ? 'rgba(255, 255, 255, 0.015)' : 'rgba(0, 168, 240, 0.025)';
              ctx.fillRect(d.x, d.y, d.w, d.h);
              ctx.strokeStyle = d.dim ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 168, 240, 0.12)';
              ctx.lineWidth = 0.8;
              ctx.strokeRect(d.x, d.y, d.w, d.h);
            }
            if (d.tag) {
              ctx.font = 'bold 10px \"Inter\", system-ui, -apple-system, \"Segoe UI\", sans-serif';
              ctx.fillStyle = 'rgba(0, 168, 240, 0.9)';
              ctx.textAlign = 'right';
              ctx.fillText(`${d.tag} ${d.text || ''}`, d.x - 12, (d.y || 0) + (d.h ? d.h / 2 : 0));
            }
          } else if (d.kind === 'column-label' && d.text) {
            ctx.font = 'bold 9px \"Inter\", system-ui, -apple-system, \"Segoe UI\", sans-serif';
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
              ctx.font = 'bold 9px \"Inter\", system-ui, -apple-system, \"Segoe UI\", sans-serif';
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
      for (const link of links) {
        const s = nodeMap.get(link.source);
        const t = nodeMap.get(link.target);
        if (s && t) {
          // Enlace totalmente fuera de la zona visible: no se dibuja.
          if ((s.x < viewLeft && t.x < viewLeft) || (s.x > viewRight && t.x > viewRight) ||
              (s.y < viewTop && t.y < viewTop) || (s.y > viewBottom && t.y > viewBottom)) continue;
          const isConnectedToActive = isFocusActive
            ? (link.source === activeEntityId || link.target === activeEntityId || (deckIds.has(s.id) && deckIds.has(t.id)))
            : false;

          // Si el usuario hizo clic o tiene una ficha abierta, APAGAR todas las líneas ajenas!
          if (isFocusActive && !isConnectedToActive) {
            continue; // Se omiten completamente: cero ruido visual
          }

          // Si no hay nada seleccionado (vista panorámica idle), trazar enlaces tenues
          if (!isFocusActive) {
            if (viewMode === 'organigram') continue; // En organigrama idle se mantiene limpio
            ctx.strokeStyle = 'rgba(159, 220, 255, 0.09)';
            ctx.lineWidth = 0.7;
            ctx.beginPath();
            ctx.moveTo(s.x, s.y);
            ctx.lineTo(t.x, t.y);
            ctx.stroke();
            continue;
          }

          // LÍNEAS VIVAS ENERGIZADAS (Conexiones Directas de la Entidad Activa)
          ctx.save();
          ctx.strokeStyle = 'rgba(0, 168, 240, 0.85)';
          ctx.lineWidth = 1.5;
          ctx.shadowColor = 'rgba(0, 168, 240, 0.6)';
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(t.x, t.y);
          ctx.stroke();
          ctx.restore();

          // Fotones cinéticos gemelos viajando en la corriente viva
          const pOffset = (time * 0.16) % 1;
          const px = s.x + (t.x - s.x) * pOffset;
          const py = s.y + (t.y - s.y) * pOffset;
          ctx.fillStyle = '#e6f6ff';
          ctx.beginPath();
          ctx.arc(px, py, 2.2, 0, Math.PI * 2);
          ctx.fill();

          const pOffset2 = (time * 0.16 + 0.5) % 1;
          const px2 = s.x + (t.x - s.x) * pOffset2;
          const py2 = s.y + (t.y - s.y) * pOffset2;
          ctx.fillStyle = '#00a8f0';
          ctx.beginPath();
          ctx.arc(px2, py2, 1.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      mark('enlaces');
      // 6. Draw Celestial Nodes
      for (const n of nodes) {
        // Nodo fuera de la zona visible: no se dibuja (ni se piden sus imágenes).
        if (n.x < viewLeft || n.x > viewRight || n.y < viewTop || n.y > viewBottom) continue;
        const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.department;
        const isSelected = n.id === selectedNodeIdRef.current || deckIds.has(n.id);
        const isHovered = activeHover?.id === n.id;
        const isWorking = n.memory_tier === 'working';
        const isOpen = expansionsRef.current.has(n.id);
        const pulse = isWorking ? Math.sin(time * 4) * 3 : 0;
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

        const isConnectedToFocus = !isFocusActive || n.id === activeEntityId || focusNeighborIds.has(n.id);

        if (!isPartOfDrill) {
          ctx.globalAlpha = 0.15; // Suave atenuación de capas ajenas al drill-down activo
        } else if (isFocusActive && !isConnectedToFocus) {
          ctx.globalAlpha = 0.30;
        } else {
          ctx.globalAlpha = 1.0;
        }

        mark('n_prep');
        // Burbuja on-brand: color por familia, foto o icono, anillo, chincheta y punto de estado.
        const nid = n.id.toLowerCase();
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
        // Node Title Label
        // Etiquetas segun zoom: de lejos solo se nombran los nodos principales; al acercar aparecen las demas.
        const emphasized = isSelected || isHovered || isOpen;
        const isMinorNode = (n.radius || 24) < 22;
        const showTitle = emphasized || (isFocusActive && isConnectedToFocus && (focusConnectedCount <= 10 || scale >= 1.8)) || scale >= (isMinorNode ? 1.4 : 0.5);
        if (showTitle) {
          ctx.font = emphasized ? '600 13px Poppins, system-ui, -apple-system, "Segoe UI", sans-serif' : '12px Poppins, system-ui, -apple-system, "Segoe UI", sans-serif';
          ctx.fillStyle = emphasized ? '#ffffff' : 'rgba(229, 231, 235, 0.88)';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          // El tipo ya se lee debajo: se quita el prefijo "Brand: ", "Department: ", etc.
          const humanTitle = humanNodeName(n).replace(/^[A-Za-z][A-Za-z &]{2,22}(?::\s+|\s+-\s+)/, '');
          const displayTitle = humanTitle.length > 25 ? humanTitle.slice(0, 23) + '…' : humanTitle;
          ctx.fillText(displayTitle, n.x, n.y + r + 7);

          // Tipo de nodo: solo al acercar o al enfocar
          if (emphasized || scale >= 0.95) {
            ctx.font = '500 9px system-ui, -apple-system, "Segoe UI", sans-serif';
            ctx.fillStyle = emphasized ? '#00a8f0' : 'rgba(148, 163, 184, 0.8)';
            ctx.fillText(cfg.label.toUpperCase().split('').join('\u200A'), n.x, n.y + r + 24);
          }
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
