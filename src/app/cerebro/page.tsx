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

export default function CerebroPage() {
  const [mounted, setMounted] = useState(false);
  const [graphData, setGraphData] = useState<BrainGraphResponse | null>(null);
  const [selectedMarket, setSelectedMarket] = useState<string>('all');
  const [activeLens, setActiveLens] = useState<string>('global-core');
  const [stackedDeck, setStackedDeck] = useState<NodeData[]>([]);
  const stackedDeckRef = useRef(stackedDeck);
  stackedDeckRef.current = stackedDeck;
  // El mapa llega liviano (sin el texto de cada ficha). El cuerpo se pide solo al abrir la ficha de un nodo.
  const [nodeBodies, setNodeBodies] = useState<Record<string, string>>({});
  const bodyRequestedRef = useRef<Set<string>>(new Set());
  const graphVersionRef = useRef<{ key: string; version: string } | null>(null);
  useEffect(() => {
    stackedDeck.forEach(n => {
      if (n.body || bodyRequestedRef.current.has(n.id)) return;
      bodyRequestedRef.current.add(n.id);
      fetch(`/api/agent/brain?node=${encodeURIComponent(n.id)}`, { cache: 'no-store' })
        .then(r => r.json())
        .then(j => {
          if (j && j.ok && j.node) setNodeBodies(prev => ({ ...prev, [n.id]: j.node.body || '' }));
          else bodyRequestedRef.current.delete(n.id);
        })
        .catch(() => { bodyRequestedRef.current.delete(n.id); });
    });
  }, [stackedDeck]);
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
  const [isHudOpen, setIsHudOpen] = useState(() => typeof window === 'undefined' ? true : window.innerWidth >= 1100);

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
  // Capas abiertas: nodo -> ids que ese nodo trajo al lienzo. Lo visible se deriva de aqui,
  // asi que cerrar un nodo retira su nivel (antes la lista solo crecia).
  const expansionsRef = useRef(new Map<string, string[]>());
  const selectedNodeIdRef = useRef<string | null>(null);
  const lastGraphTextRef = useRef('');
  const capLimitRef = useRef(new Map<string, number>());
  const cappedInfoRef = useRef(new Map<string, number>());
  const lastPillClickRef = useRef(0);
  const lastToggleRef = useRef(0);
  const fetchInFlightRef = useRef(false);
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
    if (typeof document !== 'undefined' && document.hidden && lastGraphTextRef.current) return;
    if (fetchInFlightRef.current) return;
    fetchInFlightRef.current = true;
    try {
      // Sondeo barato: si la versión del vault no cambió, no se vuelve a pedir ni a procesar el mapa.
      const verKey = `${selectedMarket}|${activeLens}`;
      if (lastGraphTextRef.current && graphVersionRef.current?.key === verKey) {
        try {
          const vr = await fetch(`/api/agent/brain?version=1&_t=${Date.now()}`, { cache: 'no-store' });
          if (vr.ok) {
            const vj = await vr.json();
            if (vj && vj.ok && vj.version === graphVersionRef.current.version) {
              setSyncError(null);
              return;
            }
          }
        } catch {
          // Si falla la consulta de versión se pide el mapa completo.
        }
      }
      const res = await fetch(
        `/api/agent/brain?view=lite&market=${encodeURIComponent(selectedMarket)}&lens=${encodeURIComponent(activeLens)}&_t=${Date.now()}`,
        { cache: 'no-store' }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      if (text === lastGraphTextRef.current) {
        // Nada cambio en el vault: no se reacomoda el lienzo.
        setSyncError(null);
        return;
      }
      const json: BrainGraphResponse = JSON.parse(text);
      if (json.ok) {
        lastGraphTextRef.current = text;
        graphVersionRef.current = (json as any).version ? { key: verKey, version: (json as any).version } : null;
        bodyRequestedRef.current.clear();
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
            // La vista por defecto arranca limpia y encuadrada: sin ficha abierta hasta el primer doble clic.
            void isDesktop;
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
    } finally {
      fetchInFlightRef.current = false;
    }
  };

  useEffect(() => {
    if (!mounted) return;
    lastGraphTextRef.current = '';
    fetchGraph();
    // Live synchronization with Dots agent and vault modifications every 3.5s
    const interval = setInterval(fetchGraph, 3500);
    return () => clearInterval(interval);
  }, [mounted, selectedMarket, activeLens]);

  // Encuadre inicial: cuando llega el primer grafo y el lienzo ya tiene tamano, se ajusta la camara una vez.
  const initialFitDoneRef = useRef(false);
  useEffect(() => {
    if (!graphData || initialFitDoneRef.current) return;
    initialFitDoneRef.current = true;
    setTimeout(() => {
      updateCanvasDimensions();
      handleCenterAndFit();
    }, 450);
  }, [graphData]);

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
      // Vista por defecto: nucleo y primer anillo. Lo demas aparece al abrir un nodo (doble clic).
      if (nodeLevel(n.type) <= 1) return true;

      // Catalogo: el menu de Ajustes puede desplegar una marca o todo.
      const isCatalogSub = n.type === 'flavor' || n.type === 'packaging' || n.type === 'product_line' || n.type === 'product_variant';
      if (isCatalogSub) {
        if (cScope === 'collapsed') return false;
        if (cScope === 'all') return true;
        const id = (n.id || '').toLowerCase();
        const title = (n.title || '').toLowerCase();
        return id.includes(cScope) || title.includes(cScope);
      }

      // Organizacion: el menu de Ajustes puede desplegar un departamento o todo.
      if (oScope === 'collapsed') return false;
      if (oScope === 'all') return true;
      if (n.type === 'person') {
        if (oScope === 'organizations') return isNodeLeader(n);
        return getPersonDeptCategory(n) === oScope;
      }
      return oScope === 'organizations' && n.type === 'organization';
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

      const bloomOrigin = selectedNodeIdRef.current ? existingMap.get(selectedNodeIdRef.current) : undefined;
      return {
        ...n,
        x: saved ? saved.x : (bloomOrigin ? bloomOrigin.x : target.x) + (Math.random() - 0.5) * 15,
        y: saved ? saved.y : (bloomOrigin ? bloomOrigin.y : target.y) + (Math.random() - 0.5) * 15,
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
      ctx.fillStyle = '#05070C';
      ctx.fillRect(0, 0, cssWidth, cssHeight);
      const vignette = ctx.createRadialGradient(cssWidth / 2, cssHeight / 2, 0, cssWidth / 2, cssHeight / 2, Math.max(cssWidth, cssHeight) * 0.75);
      vignette.addColorStop(0, 'rgba(30, 41, 66, 0.55)');
      vignette.addColorStop(0.55, 'rgba(12, 16, 28, 0.35)');
      vignette.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, cssWidth, cssHeight);

      // 3. Camera Transform
      ctx.save();
      const { x: tx, y: ty, scale } = transformRef.current;
      ctx.translate(tx, ty);
      ctx.scale(scale, scale);

      // Starfield grid
      ctx.fillStyle = 'rgba(217, 185, 106, 0.05)';
      for (let gx = -1600; gx <= 1600; gx += 80) {
        for (let gy = -1600; gy <= 1600; gy += 80) {
          ctx.beginPath();
          ctx.arc(gx, gy, 0.9, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 4. Mode-Specific Backdrop Graphics
      if (viewMode === 'brujula' || viewMode === 'version-1-ajustada') {
        // Dibujar decoraciones nativas (ejes, anillos, carriles, etiquetas de país [BZ], bandejas)
        const decorList = nativeLayoutDecorRef.current || [];
        for (const d of decorList) {
          if (d.kind === 'ring' && typeof d.r === 'number') {
            ctx.strokeStyle = 'rgba(233, 188, 110, 0.08)';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 6]);
            ctx.beginPath();
            ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
          } else if (d.kind === 'axis-label' && d.text) {
            ctx.font = 'bold 11px \"Inter\", system-ui, -apple-system, \"Segoe UI\", sans-serif';
            ctx.fillStyle = 'rgba(233, 188, 110, 0.85)';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(d.text, d.x, d.y);
          } else if (d.kind === 'lane') {
            if (d.w && d.h) {
              ctx.fillStyle = d.dim ? 'rgba(255, 255, 255, 0.015)' : 'rgba(233, 188, 110, 0.025)';
              ctx.fillRect(d.x, d.y, d.w, d.h);
              ctx.strokeStyle = d.dim ? 'rgba(255, 255, 255, 0.05)' : 'rgba(233, 188, 110, 0.12)';
              ctx.lineWidth = 0.8;
              ctx.strokeRect(d.x, d.y, d.w, d.h);
            }
            if (d.tag) {
              ctx.font = 'bold 10px \"Inter\", system-ui, -apple-system, \"Segoe UI\", sans-serif';
              ctx.fillStyle = 'rgba(233, 188, 110, 0.9)';
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

      // 5. Draw Synaptic Links with High-Energy Photons
      // Modo Enfoque Dinámico: Si hay una entidad activa (por clic en ficha o hover), NADA MÁS se ven las líneas vivas conectadas a ella!
      const activeEntityId = selectedNodeIdRef.current || (stackedDeck.length > 0 ? stackedDeck[0].id : activeHover?.id);
      const isFocusActive = !!activeEntityId;

      // Cuantos nodos estan conectados al foco: con muchos, las etiquetas solo salen al acercar (evita el amontonamiento).
      let focusConnectedCount = 0;
      if (isFocusActive) {
        for (const l of links) {
          if (l.source === activeEntityId || l.target === activeEntityId) focusConnectedCount++;
        }
      }
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
          ctx.strokeStyle = 'rgba(217, 185, 106, 0.85)';
          ctx.lineWidth = 1.5;
          ctx.shadowColor = 'rgba(217, 185, 106, 0.6)';
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
          ctx.fillStyle = '#FFF4D6';
          ctx.beginPath();
          ctx.arc(px, py, 2.2, 0, Math.PI * 2);
          ctx.fill();

          const pOffset2 = (time * 0.16 + 0.5) % 1;
          const px2 = s.x + (t.x - s.x) * pOffset2;
          const py2 = s.y + (t.y - s.y) * pOffset2;
          ctx.fillStyle = '#D9B96A';
          ctx.beginPath();
          ctx.arc(px2, py2, 1.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 6. Draw Celestial Nodes
      for (const n of nodes) {
        const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.department;
        const isSelected = n.id === selectedNodeIdRef.current || stackedDeck.some(d => d.id === n.id);
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
        grad.addColorStop(0, isSelected || isHovered ? 'rgba(217, 185, 106, 0.55)' : cfg.glow);
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
        ctx.lineWidth = isSelected ? 2.5 : isHovered ? 2.2 : 1.5;
        ctx.strokeStyle = isSelected ? '#F3DFA6' : isHovered ? '#D9B96A' : cfg.border;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.stroke();

        // Anillo fino dorado: este nodo tiene su nivel abierto (doble clic lo cierra)
        if (isOpen) {
          ctx.lineWidth = 1;
          ctx.strokeStyle = 'rgba(217, 185, 106, 0.9)';
          ctx.beginPath();
          ctx.arc(n.x, n.y, r + 6, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Physical Pin Halo & Indicator if Pinned
        if (n.isPinned) {
          ctx.save();
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = 'rgba(217, 185, 106, 0.7)';
          ctx.setLineDash([2, 4]);
          ctx.beginPath();
          ctx.arc(n.x, n.y, r + 5, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();

          ctx.save();
          ctx.fillStyle = '#D9B96A';
          ctx.beginPath();
          ctx.arc(n.x + r * 0.72, n.y - r * 0.72, 3.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // Node Title Label
        // Etiquetas segun zoom: de lejos solo se nombran los nodos principales; al acercar aparecen las demas.
        const emphasized = isSelected || isHovered || isOpen;
        const isMinorNode = (n.radius || 24) < 22;
        const showTitle = emphasized || (isFocusActive && isConnectedToFocus && (focusConnectedCount <= 10 || scale >= 1.8)) || scale >= (isMinorNode ? 1.4 : 0.5);
        if (showTitle) {
          ctx.font = emphasized ? '600 13px Georgia, "Times New Roman", serif' : '12px system-ui, -apple-system, "Segoe UI", sans-serif';
          ctx.fillStyle = emphasized ? '#F7EFD9' : 'rgba(229, 231, 235, 0.88)';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          // El tipo ya se lee debajo: se quita el prefijo "Brand: ", "Department: ", etc.
          const humanTitle = humanNodeName(n).replace(/^[A-Za-z][A-Za-z &]{2,22}(?::\s+|\s+-\s+)/, '');
          const displayTitle = humanTitle.length > 25 ? humanTitle.slice(0, 23) + '…' : humanTitle;
          ctx.fillText(displayTitle, n.x, n.y + r + 7);

          // Tipo de nodo: solo al acercar o al enfocar
          if (emphasized || scale >= 0.95) {
            ctx.font = '500 9px system-ui, -apple-system, "Segoe UI", sans-serif';
            ctx.fillStyle = emphasized ? '#D9B96A' : 'rgba(148, 163, 184, 0.8)';
            ctx.fillText(cfg.label.toUpperCase().split('').join('\u200A'), n.x, n.y + r + 24);
          }
        }
        // Burbuja "+N mas": hay mas nodos en este nivel; un clic en ella trae los siguientes
        const hiddenCount = cappedInfoRef.current.get(n.id);
        if (hiddenCount && isOpen) {
          const py = n.y + (n.radius || 24) + 46;
          ctx.beginPath();
          ctx.roundRect(n.x - 38, py - 11, 76, 22, 11);
          ctx.fillStyle = 'rgba(233, 188, 110, 0.16)';
          ctx.fill();
          ctx.lineWidth = 1;
          ctx.strokeStyle = 'rgba(233, 188, 110, 0.75)';
          ctx.stroke();
          ctx.font = '600 11px system-ui, -apple-system, "Segoe UI", sans-serif';
          ctx.fillStyle = '#F3DFA6';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`+${hiddenCount} más`, n.x, py);
        }
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
    // En escritorio la ficha va al lado del lienzo (no encima), asi que solo en movil resta espacio.
    const panelOverlaysCanvas = stackedDeckRef.current.length > 0 && mobile;
    // Se encuadra por destino (donde van a quedar los nodos), no por donde estan mientras brotan.
    const fitted = fitIdentityBounds(context.map(n => ({ x: Number.isFinite(n.targetX) ? n.targetX : n.x, y: Number.isFinite(n.targetY) ? n.targetY : n.y })), w, h, panelOverlaysCanvas, mobile);
    if (!fitted) return;
    let targetX = fitted.x;
    let targetY = fitted.y;
    let targetScale = fitted.scale;
    // Al enfocar un nodo nunca se aleja tanto que deje de leerse: se centra en el nodo.
    if (targetNode && targetScale < 0.3) {
      targetScale = 0.3;
      const fx = Number.isFinite(targetNode.targetX) ? targetNode.targetX : targetNode.x;
      const fy = Number.isFinite(targetNode.targetY) ? targetNode.targetY : targetNode.y;
      targetX = fitted.visibleW / 2 - fx * targetScale;
      targetY = fitted.visibleH / 2 - fy * targetScale;
    }
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

  const rebuildRevealed = () => {
    const next = new Set<string>();
    for (const [id, brought] of expansionsRef.current) {
      next.add(id);
      for (const b of brought) next.add(b);
    }
    revealedNodeIdsRef.current = next;
  };

  const findNodeAtClientPoint = (clientX: number, clientY: number): NodeData | undefined => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const rect = canvas.getBoundingClientRect();
    const { x: tx, y: ty, scale } = transformRef.current;
    const worldX = (clientX - rect.left - tx) / scale;
    const worldY = (clientY - rect.top - ty) / scale;
    return nodesRef.current.find(n => {
      const dx = n.x - worldX;
      const dy = n.y - worldY;
      return Math.sqrt(dx * dx + dy * dy) <= Math.max(n.radius + 24, 44);
    });
  };

  // Burbuja "+N mas" bajo un nodo abierto con nivel recortado: devuelve el nodo si el punto cae en ella.
  const findPillAtClientPoint = (clientX: number, clientY: number): NodeData | undefined => {
    const canvas = canvasRef.current;
    if (!canvas || cappedInfoRef.current.size === 0) return undefined;
    const rect = canvas.getBoundingClientRect();
    const { x: tx, y: ty, scale } = transformRef.current;
    const worldX = (clientX - rect.left - tx) / scale;
    const worldY = (clientY - rect.top - ty) / scale;
    return nodesRef.current.find(n => {
      if (!cappedInfoRef.current.has(n.id)) return false;
      const cy = n.y + (n.radius || 24) + 46;
      return Math.abs(worldX - n.x) <= 40 && Math.abs(worldY - cy) <= 12;
    });
  };

  const showMoreOfNode = (node: NodeData) => {
    const now = Date.now();
    if (now - lastPillClickRef.current < 500) return;
    lastPillClickRef.current = now;
    capLimitRef.current.set(node.id, (capLimitRef.current.get(node.id) || MAX_NODES_PER_OPEN) + MAX_NODES_PER_OPEN);
    pushToStackedDeck(node);
  };

  const unpinNode = (node: NodeData) => {
    node.isPinned = false;
    node.pinnedX = undefined;
    node.pinnedY = undefined;
    if (node.originalTargetX !== undefined && node.originalTargetY !== undefined) {
      node.targetX = node.originalTargetX;
      node.targetY = node.originalTargetY;
    }
    try {
      const stored = localStorage.getItem('cerebro_pinned_positions');
      if (stored) {
        const map = JSON.parse(stored);
        delete map[node.id];
        localStorage.setItem('cerebro_pinned_positions', JSON.stringify(map));
      }
    } catch {}
    setPinnedCount(nodesRef.current.filter(n => n.isPinned).length);
  };

  // Cierra un nodo abierto: retira su nivel, todo lo que se abrio despues colgando de el, y sus fichas.
  const collapseNode = (node: NodeData) => {
    const order = [...expansionsRef.current.keys()];
    const closed = new Set<string>();
    const queue = [node.id];
    while (queue.length) {
      const id = queue.pop() as string;
      if (closed.has(id) || !expansionsRef.current.has(id)) continue;
      closed.add(id);
      const openedAt = order.indexOf(id);
      for (const child of expansionsRef.current.get(id) || []) {
        // Solo cascada hacia lo abierto despues: un vecino abierto antes es el padre, no un hijo.
        if (child !== id && order.indexOf(child) > openedAt) queue.push(child);
      }
    }
    for (const id of closed) {
      expansionsRef.current.delete(id);
      capLimitRef.current.delete(id);
      cappedInfoRef.current.delete(id);
    }
    rebuildRevealed();

    const full = fullGraphRef.current;
    const closedTypes = new Set(full.nodes.filter(n => closed.has(n.id)).map(n => n.type));
    if (closedTypes.has('brand')) {
      setCatalogScope('collapsed');
      catalogScopeRef.current = 'collapsed';
    }
    if (closedTypes.has('department')) {
      setOrgScope('collapsed');
      orgScopeRef.current = 'collapsed';
      try { localStorage.setItem('cerebro_org_scope', 'collapsed'); } catch {}
    }
    const nextStack = drilldownStackRef.current.filter(d => !closed.has(d.id));
    drilldownStackRef.current = nextStack;
    setDrilldownStack(nextStack);

    const nextDeck = stackedDeckRef.current.filter(d => !closed.has(d.id));
    stackedDeckRef.current = nextDeck;
    setStackedDeck(nextDeck);

    selectedNodeIdRef.current = node.id;
    setupNodesWithMode(graphData?.nodes || full.nodes, full.links);
  };

  // Doble clic / doble toque: abre el siguiente nivel y la ficha lateral; repetido, los cierra.
  const toggleNodeOpen = (node: NodeData) => {
    // Un triple clic o un doble evento no debe abrir y cerrar (ni abrir otro nodo que quedo bajo el cursor).
    const now = Date.now();
    if (now - lastToggleRef.current < 600) return;
    lastToggleRef.current = now;
    if (expansionsRef.current.has(node.id)) {
      collapseNode(node);
      return;
    }
    pushToStackedDeck(node);
  };

  // Vista por defecto: todo cerrado, sin fichas, camara encuadrada.
  const resetToDefaultView = () => {
    expansionsRef.current.clear();
    capLimitRef.current.clear();
    cappedInfoRef.current.clear();
    rebuildRevealed();
    selectedNodeIdRef.current = null;
    stackedDeckRef.current = [];
    setStackedDeck([]);
    setDrilldownStack([]);
    drilldownStackRef.current = [];
    setCatalogScope('collapsed');
    catalogScopeRef.current = 'collapsed';
    setOrgScope('collapsed');
    orgScopeRef.current = 'collapsed';
    try { localStorage.setItem('cerebro_org_scope', 'collapsed'); } catch {}
    setupNodesWithMode(graphData?.nodes || fullGraphRef.current.nodes, fullGraphRef.current.links, 'collapsed', 'collapsed');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      updateCanvasDimensions();
      handleCenterAndFit();
    }));
  };

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
    const broughtIds = new Set<string>([node.id]);
    if (sourceNodeId) {
      broughtIds.add(sourceNodeId);
    } else {
      // Solo el siguiente nivel: vecinos mas profundos que este nodo. Si son muchos, la capa mas cercana y con tope.
      const typeById = new Map<string, any>(full.nodes.map((n: any) => [n.id, n]));
      const myLevel = nodeLevel(node.type);
      const candidates = new Map<string, any>();
      for (const id of focusIds) {
        const other = typeById.get(id);
        if (other && id !== node.id && nodeLevel(other.type) > myLevel) candidates.set(id, other);
      }
      if (node.type === 'brand') {
        for (const child of brandCatalogNodes(node.id, full.nodes, full.links)) {
          if (nodeLevel(child.type) > myLevel) candidates.set(child.id, child);
        }
      }
      let deeper = [...candidates.values()];
      const totalDeeper = deeper.length;
      if (deeper.length > 14) {
        const nearest = Math.min(...deeper.map(d => nodeLevel(d.type)));
        deeper = deeper.filter(d => nodeLevel(d.type) === nearest);
      }
      deeper.sort((x, y) => String(x.title || x.id).localeCompare(String(y.title || y.id)));
      void totalDeeper;
      const limit = capLimitRef.current.get(node.id) || MAX_NODES_PER_OPEN;
      const shown = deeper.slice(0, limit);
      for (const d of shown) broughtIds.add(d.id);
      if (shown.length < deeper.length) cappedInfoRef.current.set(node.id, deeper.length - shown.length);
      else cappedInfoRef.current.delete(node.id);
      focusIds.clear();
      for (const id of broughtIds) focusIds.add(id);
    }
    // Reabrir un nodo ya abierto conserva su orden de apertura y suma lo nuevo.
    for (const id of expansionsRef.current.get(node.id) || []) broughtIds.add(id);
    expansionsRef.current.set(node.id, [...broughtIds]);
    rebuildRevealed();
    selectedNodeIdRef.current = node.id;
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
          links: ['[[Person - Humberto Bouche]]', '[[Core - S.M. Jaleel & Co. Ltd.]]'],
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
      const tag = (e.target as HTMLElement | null)?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      if (e.key === 'Enter' && !typing && selectedNodeIdRef.current) {
        const sel = nodesRef.current.find(n => n.id === selectedNodeIdRef.current);
        if (sel) {
          e.preventDefault();
          toggleNodeOpen(sel);
        }
        return;
      }
      if (e.key === 'Escape') {
        if (searchQuery) {
          setSearchQuery('');
        } else if (isSettingsMenuOpen) {
          setIsSettingsMenuOpen(false);
        } else if (stackedDeck.length > 0) {
          setStackedDeck([]);
        } else if (expansionsRef.current.size > 0) {
          // Cierra la ultima capa abierta
          const lastId = [...expansionsRef.current.keys()].pop() as string;
          const last = nodesRef.current.find(n => n.id === lastId);
          if (last) collapseNode(last);
          else resetToDefaultView();
        } else if (drilldownStackRef.current.length > 0) {
          handlePopDrilldown();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [searchQuery, isSettingsMenuOpen, stackedDeck, graphData]);

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
    if (!graphData) return { leaders: 0, operational: 0, activeWhatsapps: 0, verifiedEmails: 0 };
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
    // Cifras reales del vault, sin minimos.
    return {
      leaders,
      operational: people.length - leaders,
      activeWhatsapps: whatsapps,
      verifiedEmails: emails,
    };
  }, [graphData]);

  // Telemetría de Memoria Viva y Cierre S&OP
  const workingMemoryStats = useMemo(() => {
    if (!graphData) return { activeCount: 0, avgCompleteness: 0, scoredCount: 0 };
    const wmNodes = graphData.nodes.filter(n => n.memory_tier === 'working');
    // Promedio solo sobre los nodos que traen puntaje; los que no lo traen no se inventan.
    const scored = graphData.nodes.filter(n => typeof n.completeness_score === 'number');
    const avg = scored.length ? Math.round(scored.reduce((acc, n) => acc + (n.completeness_score as number), 0) / scored.length) : 0;
    return {
      activeCount: Math.max(wmNodes.length, summary.workingMemoryCount || 0),
      avgCompleteness: avg,
      scoredCount: scored.length,
    };
  }, [graphData, summary]);

  if (!mounted) {
    return <div className="fixed inset-0 z-[60] bg-[#060A12] flex items-center justify-center text-gray-400 font-sans">Iniciando Universo SMJ...</div>;
  }

  return (
    <div className="cerebro-lux fixed inset-0 z-[60] flex flex-col w-screen h-screen bg-[#060A12] text-gray-100 overflow-hidden font-sans">
      {/* Top Header Navigation & Executive HUD */}
      {/* Top Header Navigation & Executive HUD */}
      <CerebroHeader graphData={graphData} handleCenterAndFit={handleCenterAndFit} handleSetViewMode={handleSetViewMode} isSettingsMenuOpen={isSettingsMenuOpen} lastSyncTime={lastSyncTime} nodesRef={nodesRef} pushToStackedDeck={pushToStackedDeck} searchQuery={searchQuery} searchResults={searchResults} setIsSettingsMenuOpen={setIsSettingsMenuOpen} setSearchQuery={setSearchQuery} setStackedDeck={setStackedDeck} stackedDeck={stackedDeck} summary={summary} viewMode={viewMode} />

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
      <CerebroSettingsMenu catalogScope={catalogScope} fetchGraph={fetchGraph} graphData={graphData} gravityActive={gravityActive} handleCenterAndFit={handleCenterAndFit} handleConsolidate={handleConsolidate} handleSetCatalogScope={handleSetCatalogScope} handleSetOrgScope={handleSetOrgScope} handleSetViewMode={handleSetViewMode} handleUnpinAll={handleUnpinAll} isHudOpen={isHudOpen} isSettingsMenuOpen={isSettingsMenuOpen} isSubmitting={isSubmitting} nodesRef={nodesRef} orgScope={orgScope} pinnedCount={pinnedCount} pushToStackedDeck={pushToStackedDeck} setGravityActive={setGravityActive} setIsHudOpen={setIsHudOpen} setIsSettingsMenuOpen={setIsSettingsMenuOpen} viewMode={viewMode} />

      <CerebroHud contactStats={contactStats} graphData={graphData} handleConsolidate={handleConsolidate} isHudOpen={isHudOpen} isSubmitting={isSubmitting} linkHealthAudit={linkHealthAudit} summary={summary} workingMemoryStats={workingMemoryStats} />

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
                <span>←</span>
                <span>Atrás</span>
              </button>
              <div className="h-4 w-px bg-gray-700" />
              <button
                onClick={handleResetToUniverse}
                className="text-gray-400 hover:text-white transition flex items-center gap-1"
                title="Volver al Universo Completo"
              >
                <span className="hidden sm:inline">Universo SMJ</span>
              </button>
              {drilldownStack.map((item) => (
                <span key={item.id} className="flex items-center gap-1 text-white">
                  <span className="text-gray-500">›</span>
                  <span className="text-amber-300 font-bold bg-amber-950/80 px-2 py-0.5 rounded border border-amber-800 flex items-center gap-1">
                    
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
                <span>Restaurar {pinnedCount} Anclados</span>
              </button>
            )}
            <button
              onClick={() => handleCenterAndFit()}
              className="px-3 py-1.5 rounded-xl bg-gray-900/95 hover:bg-gray-800 border border-sky-500/80 text-sky-300 text-xs font-mono font-semibold shadow-2xl flex items-center gap-1.5 backdrop-blur transition active:scale-95"
              title="Centrar y reencuadrar el grafo en pantalla"
            >
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
                              Anclado
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
                      <span className="text-amber-400 font-bold block text-[10px] uppercase">Siguiente Capa (Catálogo):</span>
                      <span className="text-gray-300">Formato: 250ml / Packs · 6 Sabores · Estiba 2,800 cajas/cont</span>
                    </div>
                  )}
                  {hoveredNode.type === 'market' && (
                    <div>
                      <span className="text-teal-400 font-bold block text-[10px] uppercase">Siguiente Capa (Distribuidor):</span>
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
                      <span className="text-emerald-400 font-bold block text-[10px] uppercase">Siguiente Capa (Territorio):</span>
                      <span className="text-gray-200">
                        {hoveredNode.id.includes('medimex') || hoveredNode.id.includes('panama') ? 'Panamá · Chubby, Fruta & Busta' :
                         hoveredNode.id.includes('sancas') ? 'Belice (CARICOM) · Chubby & Fruta' :
                         hoveredNode.id.includes('morgan') ? 'Canadá · Retail Moderno' : 'EE. UU. · Costa Este'}
                      </span>
                    </div>
                  )}
                  {hoveredNode.type === 'person' && (
                    <div>
                      <span className="text-sky-400 font-bold block text-[10px] uppercase">Siguiente Capa (Equipo):</span>
                      <span className="text-gray-200">
                        {hoveredNode.frontmatter?.job_title || 'Cargo Ejecutivo'} · {hoveredNode.frontmatter?.based_in_city || 'HQ'}
                      </span>
                    </div>
                  )}
                  {hoveredNode.type === 'department' && (
                    <div>
                      <span className="text-purple-400 font-bold block text-[10px] uppercase">Siguiente Capa (Estructura):</span>
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
                    <span>Ficha 360°</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      pushToStackedDeck(hoveredNode, true);
                    }}
                    className="py-1.5 px-2 bg-amber-600 hover:bg-amber-500 active:scale-95 text-white rounded-lg text-xs font-bold shadow flex items-center justify-center gap-1 transition"
                    title="Desplegar siguiente capa directamente en el lienzo"
                  >
                    <span>Ver Capa ▼</span>
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
              Clic para seleccionar · Doble clic para abrir nivel y ficha · Doble clic otra vez para cerrar · Doble clic en el fondo para volver al inicio
            </div>
          </div>
        </div>

        <CerebroSideCard catalogScope={catalogScope} expandedBrandInDossier={expandedBrandInDossier} expandedDeptInDossier={expandedDeptInDossier} expandedLeaderInDossier={expandedLeaderInDossier} getWikilinkLabel={getWikilinkLabel} graphData={graphData} handleSetCatalogScope={handleSetCatalogScope} handleSetOrgScope={handleSetOrgScope} handleWikilinkClick={handleWikilinkClick} inspectorRef={inspectorRef} linksRef={linksRef} nodeBodies={nodeBodies} nodesRef={nodesRef} pushToStackedDeck={pushToStackedDeck} removeFromDeck={removeFromDeck} setExpandedBrandInDossier={setExpandedBrandInDossier} setExpandedDeptInDossier={setExpandedDeptInDossier} setExpandedLeaderInDossier={setExpandedLeaderInDossier} setStackedDeck={setStackedDeck} setStatusMessage={setStatusMessage} stackedDeck={stackedDeck} />

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
          <span>Abrir Ficha Lateral</span>
        </button>
      )}
      </div>
    </div>
  );
}
