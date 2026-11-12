// Tipos de lo que page.tsx entrega a sus componentes y hooks.
// Una sola lista compartida; cada pieza declara cuáles usa con Pick<>.
// Si page.tsx deja de pasar algo (o lo pasa con otro tipo), el compilador lo marca.
import type React from 'react';
import type { NodeData, LinkData, BrainGraphResponse } from './types';

export type ViewMode = 'brujula' | 'version-1-ajustada' | 'quadrants' | 'constellations' | 'organigram';
export type OrgScope = 'collapsed' | 'all' | 'exports' | 'manufacturing' | 'supply_chain' | 'finance' | 'organizations';
type Ref<T> = React.MutableRefObject<T>;
type Setter<T> = React.Dispatch<React.SetStateAction<T>>;

export interface CerebroShared {
  // estado
  mounted: boolean;
  graphData: BrainGraphResponse | null;
  stackedDeck: NodeData[];
  setStackedDeck: Setter<NodeData[]>;
  nodeBodies: Record<string, string>;
  setStatusMessage: Setter<string | null>;
  gravityActive: boolean;
  setGravityActive: Setter<boolean>;
  viewMode: ViewMode;
  catalogScope: string;
  orgScope: OrgScope;
  expandedBrandInDossier: string | null;
  setExpandedBrandInDossier: Setter<string | null>;
  expandedDeptInDossier: string | null;
  setExpandedDeptInDossier: Setter<string | null>;
  expandedLeaderInDossier: string | null;
  setExpandedLeaderInDossier: Setter<string | null>;
  isHudOpen: boolean;
  setIsHudOpen: Setter<boolean>;
  isSettingsMenuOpen: boolean;
  setIsSettingsMenuOpen: Setter<boolean>;
  isSubmitting: boolean;
  searchQuery: string;
  setSearchQuery: Setter<string>;
  searchResults: any[];
  pinnedCount: number;
  setPinnedCount: Setter<number>;
  lastSyncTime: string | null;
  setHoveredNode: Setter<NodeData | null>;
  setTooltipPos: Setter<{ x: number; y: number }>;
  // cifras derivadas
  summary: BrainGraphResponse['summary'];
  linkHealthAudit: { brokenCount: number; brokenSample: string[] };
  contactStats: { leaders: number; operational: number; activeWhatsapps: number; verifiedEmails: number };
  workingMemoryStats: { activeCount: number; avgCompleteness: number; scoredCount: number };
  // referencias
  canvasRef: Ref<HTMLCanvasElement | null>;
  inspectorRef: Ref<HTMLDivElement | null>;
  nodesRef: Ref<NodeData[]>;
  linksRef: Ref<LinkData[]>;
  transformRef: Ref<{ x: number; y: number; scale: number }>;
  selectedNodeIdRef: Ref<string | null>;
  hoveredNodeRef: Ref<NodeData | null>;
  draggedNodeRef: Ref<NodeData | null>;
  animFrameRef: Ref<number | null>;
  expansionsRef: Ref<Map<string, string[]>>;
  cappedInfoRef: Ref<Map<string, number>>;
  drilldownStackRef: Ref<{ id: string; title: string; type: string; category?: string }[]>;
  nativeLayoutDecorRef: Ref<any[]>;
  isDraggingCanvasRef: Ref<boolean>;
  lastMousePosRef: Ref<{ x: number; y: number }>;
  dragStartMousePosRef: Ref<{ x: number; y: number }>;
  lastTapTimeRef: Ref<number>;
  touchStartPosRef: Ref<{ x: number; y: number; time: number }>;
  lastTouchPosRef: Ref<{ x: number; y: number }>;
  touchMovedRef: Ref<boolean>;
  initialPinchDistRef: Ref<number | null>;
  initialPinchScaleRef: Ref<number>;
  pinchCenterRef: Ref<{ x: number; y: number } | null>;
  // acciones
  fetchGraph: () => Promise<void>;
  handleCenterAndFit: (targetNode?: NodeData) => void;
  handleConsolidate: () => Promise<void>;
  handleSetViewMode: (mode: ViewMode) => void;
  handleSetCatalogScope: (scope: string) => void;
  handleSetOrgScope: (scope: OrgScope) => void;
  handleUnpinAll: () => void;
  handleWikilinkClick: (linkName: string, sourceNodeId?: string) => void;
  getWikilinkLabel: (linkName: string) => string;
  pushToStackedDeck: (node: NodeData, bloomLayer?: boolean, sourceNodeId?: string) => void;
  removeFromDeck: (nodeId: string) => void;
  resetToDefaultView: () => void;
  toggleNodeOpen: (node: NodeData) => void;
  showMoreOfNode: (node: NodeData) => void;
  unpinNode: (node: NodeData) => void;
  clampCameraBounds: () => void;
  findNodeAtClientPoint: (clientX: number, clientY: number) => NodeData | undefined;
  findPillAtClientPoint: (clientX: number, clientY: number) => NodeData | undefined;
}

export type HeaderProps = Pick<CerebroShared, 'graphData' | 'handleCenterAndFit' | 'handleSetViewMode' | 'isSettingsMenuOpen' | 'lastSyncTime' | 'nodesRef' | 'pushToStackedDeck' | 'searchQuery' | 'searchResults' | 'setIsSettingsMenuOpen' | 'setSearchQuery' | 'setStackedDeck' | 'stackedDeck' | 'summary' | 'viewMode'>;
export type SettingsMenuProps = Pick<CerebroShared, 'catalogScope' | 'fetchGraph' | 'graphData' | 'gravityActive' | 'handleCenterAndFit' | 'handleConsolidate' | 'handleSetCatalogScope' | 'handleSetOrgScope' | 'handleSetViewMode' | 'handleUnpinAll' | 'isHudOpen' | 'isSettingsMenuOpen' | 'isSubmitting' | 'nodesRef' | 'orgScope' | 'pinnedCount' | 'pushToStackedDeck' | 'setGravityActive' | 'setIsHudOpen' | 'setIsSettingsMenuOpen' | 'viewMode'>;
export type HudProps = Pick<CerebroShared, 'contactStats' | 'graphData' | 'handleConsolidate' | 'isHudOpen' | 'isSubmitting' | 'linkHealthAudit' | 'summary' | 'workingMemoryStats'>;
export type SideCardProps = Pick<CerebroShared, 'catalogScope' | 'expandedBrandInDossier' | 'expandedDeptInDossier' | 'expandedLeaderInDossier' | 'getWikilinkLabel' | 'graphData' | 'handleSetCatalogScope' | 'handleSetOrgScope' | 'handleWikilinkClick' | 'inspectorRef' | 'linksRef' | 'nodeBodies' | 'nodesRef' | 'pushToStackedDeck' | 'removeFromDeck' | 'setExpandedBrandInDossier' | 'setExpandedDeptInDossier' | 'setExpandedLeaderInDossier' | 'setStackedDeck' | 'setStatusMessage' | 'stackedDeck'>;
export type GesturesProps = Pick<CerebroShared, 'canvasRef' | 'clampCameraBounds' | 'dragStartMousePosRef' | 'draggedNodeRef' | 'findNodeAtClientPoint' | 'findPillAtClientPoint' | 'hoveredNodeRef' | 'initialPinchDistRef' | 'initialPinchScaleRef' | 'isDraggingCanvasRef' | 'lastMousePosRef' | 'lastTapTimeRef' | 'lastTouchPosRef' | 'linksRef' | 'nodesRef' | 'pinchCenterRef' | 'pushToStackedDeck' | 'resetToDefaultView' | 'selectedNodeIdRef' | 'setHoveredNode' | 'setPinnedCount' | 'setTooltipPos' | 'showMoreOfNode' | 'toggleNodeOpen' | 'touchMovedRef' | 'touchStartPosRef' | 'transformRef' | 'unpinNode'>;
export type RenderLoopProps = Pick<CerebroShared, 'animFrameRef' | 'canvasRef' | 'cappedInfoRef' | 'drilldownStackRef' | 'expansionsRef' | 'gravityActive' | 'hoveredNodeRef' | 'linksRef' | 'mounted' | 'nativeLayoutDecorRef' | 'nodesRef' | 'selectedNodeIdRef' | 'stackedDeck' | 'transformRef' | 'viewMode'>;
