// Tipos de nodo, niveles y posiciones objetivo de cada vista.
// Extraído de page.tsx sin cambios de comportamiento.

export const TYPE_CONFIG: Record<
  string,
  { label: string; icon: string; bg: string; border: string; glow: string }
> = {
  community: { label: 'Grupo', icon: '◉', bg: '#0d9488', border: '#4fe0d0', glow: 'rgba(13, 148, 136, 0.7)' },
  core: { label: 'HQ Core', icon: '🏛️', bg: '#1d4fd8', border: '#6f9bff', glow: 'rgba(29, 79, 216, 0.7)' },
  site: { label: 'Sitio', icon: '📍', bg: '#1d4fd8', border: '#6f9bff', glow: 'rgba(29, 79, 216, 0.7)' },
  department: { label: 'Departamento', icon: '🏢', bg: '#1d4fd8', border: '#6f9bff', glow: 'rgba(29, 79, 216, 0.7)' },
  role: { label: 'Rol Agnóstico', icon: '👔', bg: '#0086c8', border: '#4cc9ff', glow: 'rgba(0, 134, 200, 0.7)' },
  person: { label: 'Persona', icon: '👤', bg: '#0086c8', border: '#4cc9ff', glow: 'rgba(0, 134, 200, 0.7)' },
  market: { label: 'Mercado', icon: '🌎', bg: '#0d9488', border: '#4fe0d0', glow: 'rgba(13, 148, 136, 0.7)' },
  channel: { label: 'Canal Comercial', icon: '🛣️', bg: '#0d9488', border: '#4fe0d0', glow: 'rgba(13, 148, 136, 0.7)' },
  operator: { label: 'Operador / Mayorista', icon: '📦', bg: '#6d4fe0', border: '#b3a2ff', glow: 'rgba(109, 79, 224, 0.7)' },
  distributor: { label: 'Distribuidor', icon: '🤝', bg: '#6d4fe0', border: '#b3a2ff', glow: 'rgba(109, 79, 224, 0.7)' },
  customer: { label: 'Customer Retail', icon: '🛒', bg: '#6d4fe0', border: '#b3a2ff', glow: 'rgba(109, 79, 224, 0.7)' },
  outlet: { label: 'Outlet / Punto de atención', icon: '🛒', bg: '#6d4fe0', border: '#b3a2ff', glow: 'rgba(109, 79, 224, 0.7)' },
  catalog_listing: { label: 'Referencia de catálogo', icon: '🏷️', bg: '#e8741a', border: '#ffb066', glow: 'rgba(232, 116, 26, 0.7)' },
  client_group: { label: 'Grupo de Clientes', icon: '🏬', bg: '#6d4fe0', border: '#b3a2ff', glow: 'rgba(109, 79, 224, 0.7)' },
  client: { label: 'Cliente / Cuenta Clave', icon: '🛒', bg: '#6d4fe0', border: '#b3a2ff', glow: 'rgba(109, 79, 224, 0.7)' },
  organization: { label: 'Filial Corporativa', icon: '🏛️', bg: '#1d4fd8', border: '#6f9bff', glow: 'rgba(29, 79, 216, 0.7)' },
  brand: { label: 'Marca / SKU', icon: '🧃', bg: '#e8741a', border: '#ffb066', glow: 'rgba(232, 116, 26, 0.7)' },
  routine: { label: 'Rutina', icon: '🔄', bg: '#d6307a', border: '#ff8cc0', glow: 'rgba(214, 48, 122, 0.7)' },
  project: { label: 'Proyecto', icon: '🚀', bg: '#d6307a', border: '#ff8cc0', glow: 'rgba(214, 48, 122, 0.7)' },
  working_memory: { label: 'Memoria Temporal', icon: '⚡', bg: '#d99a00', border: '#ffd75e', glow: 'rgba(217, 154, 0, 0.7)' },
  consolidation_session: { label: 'Consolidación', icon: '🧠', bg: '#475a85', border: '#9db0d8', glow: 'rgba(71, 90, 133, 0.7)' },
  flavor: { label: 'Sabor', icon: '🍇', bg: '#e8741a', border: '#ffb066', glow: 'rgba(232, 116, 26, 0.7)' },
  packaging: { label: 'Empaque', icon: '📦', bg: '#e8741a', border: '#ffb066', glow: 'rgba(232, 116, 26, 0.7)' },
  product_line: { label: 'Línea Producto', icon: '🥤', bg: '#e8741a', border: '#ffb066', glow: 'rgba(232, 116, 26, 0.7)' },
  product_variant: { label: 'Variante SKU', icon: '🏷️', bg: '#e8741a', border: '#ffb066', glow: 'rgba(232, 116, 26, 0.7)' },
};

// Canonical Executive Leaders Set (Always visible in clean executive collapsed view)
export const LEADER_IDS = new Set([
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
// Niveles del Cerebro: 0 nucleo, 1 primer anillo (vista por defecto), luego cada capa mas profunda.
export const NODE_LEVEL: Record<string, number> = {
  core: 0,
  market: 1, brand: 1, department: 1, working_memory: 1, project: 1, routine: 1,
  organization: 2, distributor: 2, operator: 2, product_line: 2, site: 2, country: 2, group: 2, consolidation_session: 2,
  channel: 3, customer: 3, client_group: 3, client: 3, outlet: 3, flavor: 3, person: 3, role: 3,
  packaging: 4, catalog_listing: 4,
  product_variant: 5,
};
export const nodeLevel = (type?: string) => NODE_LEVEL[type || ''] ?? 3;
export const MAX_NODES_PER_OPEN = 24;

export function isNodeLeader(node: any): boolean {
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
export function getPersonDeptCategory(node: any): 'exports' | 'manufacturing' | 'supply_chain' | 'finance' | 'marketing' | 'legal' | 'business_intelligence' | 'information_technology' | 'internal_audit' | 'general' {
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
export const CLUSTER_CENTERS: Record<string, { x: number; y: number; label: string; color: string }> = {
  core: { x: 0, y: -20, label: 'Nebulosa Central · Sede Central Trinidad', color: 'rgba(245, 158, 11, 0.12)' },
  exportCentral: { x: -360, y: 130, label: 'Nebulosa Centroamérica & Caribe (Panamá & Belice)', color: 'rgba(16, 185, 129, 0.12)' },
  exportNorth: { x: -360, y: -160, label: 'Nebulosa Norteamérica (Canadá & EE. UU.)', color: 'rgba(14, 165, 233, 0.12)' },
  executiveRight: { x: 360, y: -160, label: 'Nebulosa Dirección Ejecutiva & Comercial', color: 'rgba(99, 102, 241, 0.12)' },
  manufacturing: { x: 360, y: 130, label: 'Nebulosa Marcas & Supply Chain', color: 'rgba(234, 88, 12, 0.12)' },
  workingMemory: { x: 0, y: 200, label: 'Bandeja Memoria Temporal', color: 'rgba(251, 191, 36, 0.10)' },
};

// Organigram Hierarchical Strata (Levels L-Apex to L4)
export const ORGANIGRAM_STRATA = [
  { level: -1, y: -380, label: 'L-APEX · CHAIRMAN DE LA JUNTA DIRECTIVA (DR. ALEEM MOHAMMED)', color: 'rgba(234, 179, 8, 0.15)', border: 'rgba(234, 179, 8, 0.5)' },
  { level: 0, y: -260, label: 'L0 · DIRECCIÓN EJECUTIVA & COO (ANNA MOHAMMED · HQ TRINIDAD)', color: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.4)' },
  { level: 1, y: -120, label: 'L1 · VICEPRESIDENCIAS Y DIRECCIONES GENERALES', color: 'rgba(59, 130, 246, 0.10)', border: 'rgba(59, 130, 246, 0.35)' },
  { level: 2, y: 20, label: 'L2 · GERENCIAS DE EXPORTACIÓN, OPERACIONES & PLANTA', color: 'rgba(139, 92, 246, 0.10)', border: 'rgba(139, 92, 246, 0.35)' },
  { level: 3, y: 140, label: 'L3 · MERCADOS EXTERNOS, CANALES, OPERADORES & CLIENTES', color: 'rgba(16, 185, 129, 0.10)', border: 'rgba(16, 185, 129, 0.35)' },
  { level: 4, y: 340, label: 'L4 · PORTAFOLIO DE MARCAS & OPERACIONES S&OP', color: 'rgba(234, 88, 12, 0.10)', border: 'rgba(234, 88, 12, 0.35)' },
];

// Resolutor universal de polo de mercado para cualquier entidad
export function resolveNodeMarketAnchor(node: any): { key: string; name: string } | null {
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

export const MARKET_POLES_QUADRANTS: Record<string, { x: number; y: number }> = {
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

export const MARKET_POLES_CONSTELLATIONS: Record<string, { x: number; y: number; clusterKey: string }> = {
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

export const MARKET_POLES_ORGANIGRAM: Record<string, { x: number; y: number }> = {
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
export function assignQuadrantTarget(node: any): { x: number; y: number } {
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
export function assignClusterTarget(node: any): { x: number; y: number; clusterKey: string } {
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
export function assignOrganigramTarget(node: any): { x: number; y: number } {
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
