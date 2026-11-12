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
import type { NodeData, LinkData, BrainGraphResponse } from './types';
import { BRAND_AVATARS, getPhotoUrlWithBust, getNodeCustomPhoto, drawPanamaFlag, drawCanadaFlag, drawUSAFlag, drawBelizeFlag, drawTrinidadFlag, drawSMJCorporateCrest, drawPersonAvatar, drawDistributorBadge, drawOrganizationBadge, drawBrandBadge, drawGlassDomeOverlay, drawAmericasMapBackdrop } from './nodeArt';
import { formatDisplayValue, renderFormattedBody } from './bodyFormat';
import { TYPE_CONFIG, nodeLevel, MAX_NODES_PER_OPEN, isNodeLeader, getPersonDeptCategory, CLUSTER_CENTERS, ORGANIGRAM_STRATA, assignQuadrantTarget, assignClusterTarget, assignOrganigramTarget } from './layoutTargets';
import { CerebroHeader } from './CerebroHeader';
import { CerebroSettingsMenu } from './CerebroSettingsMenu';
import { CerebroSideCard } from './CerebroSideCard';
import { CerebroHud } from './CerebroHud';

// Gestos del lienzo (clic, doble clic, arrastre, rueda, toque). Extraído de page.tsx sin cambios de comportamiento.
export function useCanvasGestures(props: Record<string, any>) {
  const { canvasRef, clampCameraBounds, dragStartMousePosRef, draggedNodeRef, findNodeAtClientPoint, findPillAtClientPoint, hoveredNodeRef, initialPinchDistRef, initialPinchScaleRef, isDraggingCanvasRef, lastMousePosRef, lastTapTimeRef, lastTouchPosRef, linksRef, nodesRef, pinchCenterRef, pushToStackedDeck, resetToDefaultView, selectedNodeIdRef, setHoveredNode, setPinnedCount, setTooltipPos, showMoreOfNode, toggleNodeOpen, touchMovedRef, touchStartPosRef, transformRef, unpinNode } = props;
    // Un clic: solo selecciona y resalta conexiones. No agrega nada al lienzo.
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const moved = Math.hypot(
      e.clientX - rect.left - dragStartMousePosRef.current.x,
      e.clientY - rect.top - dragStartMousePosRef.current.y
    );
    if (moved > 6) return; // fue un arrastre, no un clic
    const pillNode = findPillAtClientPoint(e.clientX, e.clientY);
    if (pillNode) {
      showMoreOfNode(pillNode);
      return;
    }
    const clickedNode = findNodeAtClientPoint(e.clientX, e.clientY) || hoveredNodeRef.current;
    selectedNodeIdRef.current = clickedNode ? clickedNode.id : null;
  };

  // Doble clic: abre o cierra el nodo. Mayus + doble clic desfija. En el fondo: vista por defecto.
  const handleCanvasDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (findPillAtClientPoint(e.clientX, e.clientY)) return;
    const clickedNode = findNodeAtClientPoint(e.clientX, e.clientY);
    if (!clickedNode) {
      resetToDefaultView();
      return;
    }
    if (e.shiftKey && clickedNode.isPinned) {
      unpinNode(clickedNode);
      return;
    }
    toggleNodeOpen(clickedNode);
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

    const clickedNode = nodesRef.current.find((n: any) => {
      const dx = n.x - worldX;
      const dy = n.y - worldY;
      return Math.sqrt(dx * dx + dy * dy) <= Math.max(n.radius + 24, 44);
    }) || hoveredNodeRef.current;

    if (clickedNode) {
      draggedNodeRef.current = clickedNode;
      clickedNode.isDragged = true;
      pushToStackedDeck(clickedNode);

      if (clickedNode.type === 'market') {
        const distNode = nodesRef.current.find((n: any) => {
          if (n.type !== 'distributor') return false;
          const fm = n.frontmatter || {};
          if (fm.status === 'historical_inactive' || fm.is_active === false) return false;
          const isLinked = linksRef.current.some((l: any) => {
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
        const mktNode = nodesRef.current.find((n: any) => {
          if (n.type !== 'market') return false;
          const fm = n.frontmatter || {};
          if (fm.status === 'historical_inactive' || fm.is_active === false) return false;
          const isLinked = linksRef.current.some((l: any) => {
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

      const hovered = nodesRef.current.find((n: any) => {
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
          setPinnedCount(nodesRef.current.filter((n: any) => n.isPinned).length);
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

      const touchedNode = nodesRef.current.find((n: any) => {
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

      const tappedNode = nodesRef.current.find((n: any) => {
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
            toggleNodeOpen(tappedNode);
          } else {
            resetToDefaultView();
          }
          lastTapTimeRef.current = 0;
        } else {
          lastTapTimeRef.current = now;
          // Un toque: solo selecciona.
          selectedNodeIdRef.current = tappedNode ? tappedNode.id : null;
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
          setPinnedCount(nodesRef.current.filter((n: any) => n.isPinned).length);
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

  return { handleCanvasClick, handleCanvasDoubleClick, handleMouseDown, handleMouseMove, handleMouseUp, handleWheel, handleTouchStart, handleTouchMove, handleTouchEnd };
}
