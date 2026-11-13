// Tipos de datos del mapa del Cerebro.
// Extraído de page.tsx sin cambios de comportamiento.

export interface NodeData {
  /** Oculta por el filtro de capas: no se dibuja ni responde al clic. */
  hiddenByFilter?: boolean;
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

export interface LinkData {
  source: string;
  target: string;
  relationType: string;
  label?: string;
}

export interface BrainGraphResponse {
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
