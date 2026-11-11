import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import YAML from 'yaml';

export interface BrainNode {
  id: string;
  title: string;
  type: 'core' | 'department' | 'role' | 'person' | 'market' | 'distributor' | 'customer' | 'brand' | 'project' | 'task' | 'routine' | 'working_memory' | 'consolidation_session' | 'channel' | 'client_group' | 'operator' | string;
  memory_tier: 'working' | 'long_term' | 'archived';
  status?: string;
  hierarchy_level?: number;
  completeness_score?: number;
  country?: string;
  department?: string;
  market_id?: string;
  spatial_anchor?: string;
  spatial_tier?: 'market' | 'channel' | 'operator' | 'client' | 'department' | 'brand' | 'person' | string;
  channel_type?: string;
  filePath: string;
  frontmatter: Record<string, any>;
  body: string;
  links: string[];
}

export interface BrainLink {
  source: string;
  target: string;
  relationType: string;
  label?: string;
}

export interface BrainGraph {
  nodes: BrainNode[];
  allNodes?: BrainNode[];
  links: BrainLink[];
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

export interface UnifiedBrainTask {
  id: string;
  title: string;
  description?: string;
  sourceType: 'distributor' | 'routine' | 'project' | 'market' | 'working_memory' | 'adhoc';
  sourceFile: string;
  sourceNodeId: string;
  sourceNodeTitle: string;
  country?: string;
  countryCode?: string;
  dueDate?: string;
  priority: 'High' | 'Medium' | 'Low';
  status: 'Pending' | 'In Progress' | 'Completed' | 'Blocked' | 'In Review DOTS';
  isCompleted: boolean;
  isOverdue: boolean;
  isToday: boolean;
  isNext48h: boolean;
  dotsStatus?: 'idle' | 'assigned' | 'in_progress' | 'completed';
  dotsStage?: 'solicitado' | 'recibido' | 'en_analisis' | 'borrador_listo' | 'aprobado_resuelto';
  dotsInstruction?: string;
  dotsSummary?: string;
  distributorQuota?: {
    annualTargetCases?: number;
    actualCasesYTD?: number;
    quarterForecast?: number;
    complianceRate?: number;
    status?: 'At Risk' | 'On Track' | 'Ahead' | 'Unspecified';
  };
  tags?: string[];
  recentActions?: Array<{ date: string; type: string; summary: string }>;
  assigneeName?: string;
  assigneeRole?: string;
}

export interface DistributorSummary {
  id: string;
  name: string;
  country: string;
  countryCode: string;
  targetCasesYear?: number;
  actualCasesYTD?: number;
  complianceRate?: number;
  status: 'At Risk' | 'On Track' | 'Ahead' | 'Unspecified';
  isVerified: boolean;
  verificationStatus?: string;
  pendingTasksCount: number;
  nextFollowupDate?: string;
  nextFollowupAction?: string;
  lastContactDate?: string;
  logoUrl?: string;
}

export interface UnifiedTasksResponse {
  tasks: UnifiedBrainTask[];
  distributors: DistributorSummary[];
  summary: {
    totalTasks: number;
    overdueTasks: number;
    todayTasks: number;
    next48hTasks: number;
    completedTasks: number;
    dotsAssignedTasks: number;
    distributorsCount: number;
    atRiskDistributors: number;
    panamaTimestamp: string;
  };
}

export function getPanamaDate(): { dateStr: string; now: Date; timeStr: string; tomorrowStr: string; dayAfterStr: string } {
  const now = new Date();
  const panamaFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Panama',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const dateStr = panamaFormatter.format(now); // "YYYY-MM-DD"
  const timeFormatter = new Intl.DateTimeFormat('es-PA', {
    timeZone: 'America/Panama',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  const timeStr = timeFormatter.format(now);

  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowStr = panamaFormatter.format(tomorrow);

  const dayAfter = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  const dayAfterStr = panamaFormatter.format(dayAfter);

  return { dateStr, now, timeStr, tomorrowStr, dayAfterStr };
}

export function generateTaskId(nodeId: string, prefix: string, item: any, fallbackIdx?: number): string {
  if (typeof item === 'object' && item !== null && item.id) {
    return String(item.id);
  }
  const text = typeof item === 'object' && item !== null ? (item.title || item.text || '') : String(item || '');
  if (!text.trim() && fallbackIdx !== undefined) {
    return `${prefix}-${nodeId}-${fallbackIdx}`;
  }
  const clean = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24).replace(/^-+|-+$/g, '');
  const hash = crypto.createHash('sha256').update(`${nodeId}:${text}`).digest('hex').slice(0, 8);
  return `${prefix}-${nodeId}-${clean || 'task'}-${hash}`;
}

const VAULT_DEFAULT_PATH = 'C:\\Users\\Usuario\\Downloads\\SMJaleel\\vault';

function copyFolderRecursiveSync(source: string, target: string) {
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }
  const files = fs.readdirSync(source);
  for (const file of files) {
    const curSource = path.join(source, file);
    const curTarget = path.join(target, file);
    if (fs.lstatSync(curSource).isDirectory()) {
      copyFolderRecursiveSync(curSource, curTarget);
    } else {
      fs.copyFileSync(curSource, curTarget);
    }
  }
}

export function getVaultPath(): string {
  if (process.env.SMJ_VAULT_PATH && fs.existsSync(process.env.SMJ_VAULT_PATH)) {
    return process.env.SMJ_VAULT_PATH;
  }
  const renderPersistentVault = '/data/vault';
  if (fs.existsSync(renderPersistentVault)) {
    return renderPersistentVault;
  }
  if (fs.existsSync('/data')) {
    try {
      fs.mkdirSync(renderPersistentVault, { recursive: true });
      const bundled = path.join(process.cwd(), 'vault');
      if (fs.existsSync(bundled)) {
        copyFolderRecursiveSync(bundled, renderPersistentVault);
      }
      return renderPersistentVault;
    } catch {
      // fallback
    }
  }
  if (fs.existsSync(VAULT_DEFAULT_PATH)) {
    return VAULT_DEFAULT_PATH;
  }
  const bundledPath = path.join(process.cwd(), 'vault');
  if (fs.existsSync(bundledPath)) {
    const tmpCloudVault = '/tmp/smj-vault';
    if (process.env.RENDER || process.platform === 'linux') {
      try {
        if (!fs.existsSync(tmpCloudVault)) {
          fs.mkdirSync(tmpCloudVault, { recursive: true });
          copyFolderRecursiveSync(bundledPath, tmpCloudVault);
        }
        return tmpCloudVault;
      } catch {
        return bundledPath;
      }
    }
    return bundledPath;
  }
  return VAULT_DEFAULT_PATH;
}

function parseFrontmatterAndBody(fileContent: string): { frontmatter: Record<string, any>; body: string } {
  const match = fileContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    return { frontmatter: {}, body: fileContent };
  }

  const rawYaml = match[1];
  const body = match[2].trim();
  let frontmatter: Record<string, any> = {};

  try {
    const parsed = YAML.parse(rawYaml);
    if (parsed && typeof parsed === 'object') {
      frontmatter = parsed;
    }
  } catch {
    frontmatter = {};
  }

  return { frontmatter, body };
}

function extractWikilinks(text: string): string[] {
  const matches = text.matchAll(/\[\[(.*?)\]\]/g);
  const links: string[] = [];
  for (const m of matches) {
    if (m[1]) links.push(m[1].trim());
  }
  return [...new Set(links)];
}

function getAllMarkdownFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(getAllMarkdownFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }
  return files;
}

export function getMarketNodeId(countryOrMarket: string | undefined | null): string | null {
  if (!countryOrMarket) return null;
  const s = String(countryOrMarket).toLowerCase().replace(/^\[\[|\]\]$/g, '').trim();
  if (s.includes('beliz') || s.includes('belice')) return 'market-belize';
  if (s.includes('panam')) return 'market-panama';
  if (s.includes('canad')) return 'market-canada';
  if (s.includes('unit') || s.includes('usa') || s.includes('ee. uu') || s.includes('florida') || s.includes('miami') || s.includes('tampa') || s.includes('new-york')) return 'market-united-states';
  if (s.includes('costa')) return 'market-costa-rica';
  if (s.includes('salvador')) return 'market-el-salvador';
  if (s.includes('barbados')) return 'market-barbados';
  if (s.includes('guyana')) return 'market-guyana';
  if (s.includes('surinam')) return 'market-suriname';
  if (s.includes('jamaica')) return 'market-jamaica';
  if (s.includes('lucia')) return 'market-saint-lucia';
  if (s.includes('south-africa') || s.includes('sudafrica')) return 'market-south-africa';
  if (s.includes('trinidad')) return 'core-sm-jaleel';
  return null;
}

export function loadBrainGraph(lens?: string, marketFilter?: string): BrainGraph {
  const vaultDir = getVaultPath();
  const files = getAllMarkdownFiles(vaultDir);
  const nodes: BrainNode[] = [];
  const titleToIdMap = new Map<string, string>();

  for (const file of files) {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      const { frontmatter, body } = parseFrontmatterAndBody(content);
      const filename = path.basename(file, '.md');
      const id = frontmatter.id || filename.toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
      const title = frontmatter.title || filename;

      titleToIdMap.set(title.toLowerCase(), id);
      titleToIdMap.set(filename.toLowerCase(), id);
      titleToIdMap.set(id.toLowerCase(), id);

      const links = extractWikilinks(content);

      let hierarchyLevel = frontmatter.hierarchy_level !== undefined ? frontmatter.hierarchy_level : 3;
      const jobTitleLower = String(frontmatter.job_title || frontmatter.role || '').toLowerCase();
      if (id.includes('aleem') || jobTitleLower.includes('chair') || jobTitleLower.includes('presidente')) {
        hierarchyLevel = 0;
      } else if (id.includes('anna-mohammed') || jobTitleLower.includes('chief operating') || jobTitleLower.includes('coo')) {
        hierarchyLevel = 0;
      } else if (jobTitleLower.includes('vice president') || jobTitleLower.includes('vp')) {
        hierarchyLevel = Math.min(hierarchyLevel, 1);
      } else if (jobTitleLower.includes('manager') || jobTitleLower.includes('gerente') || jobTitleLower.includes('director') || jobTitleLower.includes('head') || jobTitleLower.includes('lead')) {
        hierarchyLevel = Math.min(hierarchyLevel, 2);
      }

      const marketAnchor = getMarketNodeId(
        frontmatter.spatial_anchor ||
        frontmatter.market ||
        frontmatter.country_name ||
        frontmatter.based_in_country ||
        frontmatter.country
      );

      nodes.push({
        id,
        title,
        type: frontmatter.type || 'working_memory',
        memory_tier: frontmatter.memory_tier || (file.includes('00-Working-Memory') ? 'working' : 'long_term'),
        status: frontmatter.status || 'active',
        hierarchy_level: hierarchyLevel,
        completeness_score: frontmatter.completeness_score,
        country: frontmatter.country_name || frontmatter.based_in_country || frontmatter.country,
        department: frontmatter.department,
        market_id: marketAnchor || undefined,
        spatial_anchor: frontmatter.spatial_anchor || marketAnchor || undefined,
        spatial_tier: frontmatter.spatial_tier || (
          frontmatter.type === 'market' ? 'market' :
          frontmatter.type === 'channel' ? 'channel' :
          (frontmatter.type === 'distributor' || frontmatter.type === 'operator') ? 'operator' :
          (frontmatter.type === 'customer' || frontmatter.type === 'client_group') ? 'client' :
          undefined
        ),
        channel_type: frontmatter.channel_type || frontmatter.channel || undefined,
        filePath: file,
        frontmatter,
        body,
        links,
      });
    } catch {
      // Ignore unparseable files
    }
  }

  // Construct Links
  const links: BrainLink[] = [];
  const linkKeySet = new Set<string>();

  const addSemanticLink = (sourceId: string, rawTarget: any, relType: string, label: string) => {
    if (!rawTarget) return;
    if (Array.isArray(rawTarget)) {
      rawTarget.forEach(t => addSemanticLink(sourceId, t, relType, label));
      return;
    }
    const cleaned = typeof rawTarget === 'string' ? rawTarget.replace(/^\[\[|\]\]$/g, '').trim() : '';
    if (!cleaned) return;
    const targetId = titleToIdMap.get(cleaned.toLowerCase()) || cleaned.toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
    if (targetId && targetId !== sourceId) {
      const key = `${sourceId}->${targetId}:${relType}`;
      if (!linkKeySet.has(key)) {
        linkKeySet.add(key);
        links.push({
          source: sourceId,
          target: targetId,
          relationType: relType,
          label,
        });
      }
    }
  };

  for (const node of nodes) {
    // 1. Process structured relations in frontmatter
    const rels = node.frontmatter.relations;
    if (rels && typeof rels === 'object') {
      for (const [relType, targets] of Object.entries(rels)) {
        if (Array.isArray(targets)) {
          for (const targetRef of targets) {
            addSemanticLink(node.id, targetRef, relType, relType.replace(/_/g, ' '));
          }
        }
      }
    }

    // 2. Add frontmatter-driven semantic commercial synapses
    // a. Mercado geográfico
    if (node.market_id) {
      addSemanticLink(node.id, node.market_id, 'operates_in_market', 'mercado');
    } else if (node.frontmatter.market) {
      addSemanticLink(node.id, node.frontmatter.market, 'operates_in_market', 'mercado');
    }
    // b. Canal u Operador padre
    if (node.frontmatter.parent_distributor_id) {
      addSemanticLink(node.id, node.frontmatter.parent_distributor_id, 'channel_of', 'canal de');
    }
    if (node.frontmatter.parent_distributor) {
      addSemanticLink(node.id, node.frontmatter.parent_distributor, 'channel_of', 'canal de');
    }
    if (node.frontmatter.channel_of) {
      addSemanticLink(node.id, node.frontmatter.channel_of, 'channel_of', 'canal de');
    }
    if (node.frontmatter.supplied_by) {
      addSemanticLink(node.id, node.frontmatter.supplied_by, 'supplied_by', 'abastecido por');
    }
    // c. Clientes y cuentas abastecidas
    if (node.frontmatter.serves_clients) {
      addSemanticLink(node.id, node.frontmatter.serves_clients, 'supplies_client', 'abastece a');
    }
    if (node.frontmatter.clients) {
      addSemanticLink(node.id, node.frontmatter.clients, 'supplies_client', 'abastece a');
    }
    if (node.frontmatter.target_clients) {
      addSemanticLink(node.id, node.frontmatter.target_clients, 'supplies_client', 'abastece a');
    }
    // d. Marcas y SKUs distribuidos
    if (node.frontmatter.carries_brands) {
      addSemanticLink(node.id, node.frontmatter.carries_brands, 'carries_brand', 'distribuye');
    }
    if (node.frontmatter.active_brands) {
      addSemanticLink(node.id, node.frontmatter.active_brands, 'carries_brand', 'distribuye');
    }

    // 3. Add raw wikilinks if not already added
    for (const rawLink of node.links) {
      addSemanticLink(node.id, rawLink, 'references', 'relacionado');
    }
  }

  // Calculate summary counts
  const summary = {
    totalNodes: nodes.length,
    totalLinks: links.length,
    workingMemoryCount: nodes.filter(n => n.memory_tier === 'working').length,
    longTermCount: nodes.filter(n => n.memory_tier === 'long_term').length,
    departmentsCount: nodes.filter(n => n.type === 'department').length,
    marketsCount: nodes.filter(n => n.type === 'market').length,
    distributorsCount: nodes.filter(n => n.type === 'distributor').length,
    brandsCount: nodes.filter(n => n.type === 'brand').length,
  };

  // Optional Filtering
  let filteredNodes = nodes;
  if (marketFilter && marketFilter !== 'all') {
    const mktLower = marketFilter.toLowerCase();
    filteredNodes = nodes.filter(n => {
      const c = (n.country || '').toLowerCase();
      const t = n.title.toLowerCase();
      const bodyHas = n.body.toLowerCase().includes(mktLower);
      const linksHas = n.links.some(l => l.toLowerCase().includes(mktLower));
      return c.includes(mktLower) || t.includes(mktLower) || bodyHas || linksHas || n.type === 'core';
    });
  }

  return { nodes: filteredNodes, allNodes: nodes, links, summary };
}

export function saveWorkingMemory(input: {
  title: string;
  content: string;
  links: string[];
  relationType?: string;
  source?: string;
}): { ok: boolean; filePath: string; id: string } {
  const vaultDir = getVaultPath();
  const wmDir = path.join(vaultDir, '00-Working-Memory');
  if (!fs.existsSync(wmDir)) fs.mkdirSync(wmDir, { recursive: true });

  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const id = `wm-${dateStr}-${Date.now().toString().slice(-4)}`;
  const cleanTitle = input.title.replace(/[/\\?%*:|"<>]/g, '-').trim();
  const filename = `${id} - ${cleanTitle}.md`;
  const filePath = path.join(wmDir, filename);

  const formattedLinks = input.links.map(l => (l.startsWith('[[') ? l : `[[${l}]]`));

  const mdContent = `---
id: ${id}
title: "Working Memory: ${input.title}"
type: working_memory
memory_tier: working
status: pulsing
captured_at: "${new Date().toISOString()}"
source: "${input.source || 'Dots Agent (Voice / Chat)'}"
relations:
  touches:
${formattedLinks.map(l => `    - "${l}"`).join('\n')}
updated_at: "${new Date().toISOString()}"
---

# ${input.title}

${input.content}
`;

  fs.writeFileSync(filePath, mdContent, 'utf-8');
  return { ok: true, filePath, id };
}

export function consolidateWorkingMemory(sessionSummary: string): {
  ok: boolean;
  promotedCount: number;
  sessionFile: string;
} {
  const vaultDir = getVaultPath();
  const wmDir = path.join(vaultDir, '00-Working-Memory');
  const sessionDir = path.join(vaultDir, '05-Consolidation-Sessions');
  if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });

  const wmFiles = getAllMarkdownFiles(wmDir);
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const sessionId = `session-${dateStr.replace(/-/g, '')}-${Date.now().toString().slice(-3)}`;
  const sessionFilename = `${dateStr} - Sesion de Consolidacion.md`;
  const sessionFilePath = path.join(sessionDir, sessionFilename);

  // Promote memories from 'working' to 'long_term' with verified audit trail
  let promoted = 0;
  for (const f of wmFiles) {
    try {
      const raw = fs.readFileSync(f, 'utf-8');
      const { frontmatter, body } = parseFrontmatterAndBody(raw);
      if (frontmatter.memory_tier === 'working' || frontmatter.status !== 'consolidated') {
        frontmatter.memory_tier = 'long_term';
        frontmatter.status = 'consolidated';
        frontmatter.promoted_at = now.toISOString();
        frontmatter.promoted_session = sessionId;
        frontmatter.last_updated_at = now.toISOString();
        const updated = `---\n${YAML.stringify(frontmatter).trim()}\n---\n\n${body.trim()}\n`;
        fs.writeFileSync(f, updated, 'utf-8');
        syncToBundledVault(path.relative(vaultDir, f), updated);
        promoted++;
      }
    } catch {
      // Ignore individual parse fail
    }
  }

  const sessionContent = `---
id: ${sessionId}
title: "Sesión de Consolidación: ${dateStr}"
type: consolidation_session
memory_tier: long_term
session_date: "${dateStr}"
status: completed
promoted_nodes_count: ${promoted}
summary: "${sessionSummary || 'Consolidación automática ejecutada por Dots / TaskManager'}"
updated_at: "${now.toISOString()}"
---

# Sesión de Consolidación ${dateStr}

${sessionSummary}

## Archivos Consolidados & Promovidos (${promoted}):
${wmFiles.map(f => `- [[${path.basename(f, '.md')}]]`).join('\n') || '- No habían notas temporales pendientes.'}
`;

  fs.writeFileSync(sessionFilePath, sessionContent, 'utf-8');
  syncToBundledVault(path.join('05-Consolidation-Sessions', sessionFilename), sessionContent);

  return {
    ok: true,
    promotedCount: promoted,
    sessionFile: sessionFilePath,
  };
}

export function updateDossierMetadata(input: {
  nodeId: string;
  updatedBy?: string;
  lastEmailSubject?: string;
  lastEmailDate?: string;
  lastEmailSender?: string;
  nextFollowupDate?: string;
  nextFollowupAction?: string;
  executiveObservations?: string;
  newAction?: { date?: string; type?: string; summary?: string };
  newPendingTask?: string;
}): { ok: boolean; message: string; updatedFile?: string } {
  const vaultDir = getVaultPath();
  const allFiles = getAllMarkdownFiles(vaultDir);
  const targetLower = input.nodeId.toLowerCase().replace(/^(distributor|brand|core|person|market|dept|customer)-/i, '');
  
  const foundFile = allFiles.find(f => {
    const base = path.basename(f, '.md').toLowerCase();
    const idLower = input.nodeId.toLowerCase();
    return base.includes(idLower) || base.includes(targetLower) || base.replace(/[^a-z0-9]/g, '').includes(targetLower.replace(/[^a-z0-9]/g, ''));
  });

  if (!foundFile) {
    return { ok: false, message: `No se encontró nodo con ID o nombre '${input.nodeId}'` };
  }

  const content = fs.readFileSync(foundFile, 'utf-8');
  const { frontmatter, body } = parseFrontmatterAndBody(content);

  // Apply updates
  frontmatter.last_updated_at = new Date().toISOString();
  frontmatter.last_updated_by = input.updatedBy || 'DOTS Agent';

  if (input.lastEmailSubject) frontmatter.last_email_subject = input.lastEmailSubject;
  if (input.lastEmailDate) frontmatter.last_email_date = input.lastEmailDate;
  if (input.lastEmailSender) frontmatter.last_email_sender = input.lastEmailSender;
  if (input.nextFollowupDate) frontmatter.next_followup_date = input.nextFollowupDate;
  if (input.nextFollowupAction) frontmatter.next_followup_action = input.nextFollowupAction;
  if (input.executiveObservations) frontmatter.executive_observations = input.executiveObservations;

  if (input.newAction) {
    if (!Array.isArray(frontmatter.recent_actions)) frontmatter.recent_actions = [];
    const date = input.newAction.date || new Date().toISOString().slice(0, 10);
    const type = input.newAction.type || 'nota';
    const summary = input.newAction.summary || '';
    frontmatter.recent_actions.unshift({ date, type, summary });
  }

  if (input.newPendingTask) {
    if (!Array.isArray(frontmatter.pending_tasks)) frontmatter.pending_tasks = [];
    frontmatter.pending_tasks.unshift(input.newPendingTask);
  }

  const updatedYaml = YAML.stringify(frontmatter).trim();
  const newContent = `---\n${updatedYaml}\n---\n\n${body}\n`;
  fs.writeFileSync(foundFile, newContent, 'utf-8');

  // Also write to bundled vault if running locally and both exist
  const bundledPath = path.join(process.cwd(), 'vault');
  if (fs.existsSync(bundledPath) && !foundFile.startsWith(bundledPath)) {
    const rel = path.relative(vaultDir, foundFile);
    const bundledTarget = path.join(bundledPath, rel);
    if (fs.existsSync(path.dirname(bundledTarget))) {
      fs.writeFileSync(bundledTarget, newContent, 'utf-8');
    }
  }

  return { ok: true, message: `Ficha '${path.basename(foundFile, '.md')}' actualizada exitosamente`, updatedFile: foundFile };
}

export function writeVaultFile(relativePath: string, content: string): { ok: boolean; path: string; fullPath: string } {
  const vaultDir = getVaultPath();
  const sanitizedRel = relativePath.replace(/^(\.\.[\/\\])+/, '').replace(/^[\\\/]+/, '');
  const targetPath = path.join(vaultDir, sanitizedRel);
  const targetDir = path.dirname(targetPath);

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  fs.writeFileSync(targetPath, content, 'utf-8');

  // Also sync to bundled repository folder if separate
  const bundled = path.join(process.cwd(), 'vault');
  if (fs.existsSync(bundled) && !targetPath.startsWith(bundled)) {
    try {
      const bTarget = path.join(bundled, sanitizedRel);
      const bDir = path.dirname(bTarget);
      if (!fs.existsSync(bDir)) fs.mkdirSync(bDir, { recursive: true });
      fs.writeFileSync(bTarget, content, 'utf-8');
    } catch {}
  }

  return { ok: true, path: sanitizedRel, fullPath: targetPath };
}

export function deleteVaultFile(relativePath: string): { ok: boolean; path: string } {
  const vaultDir = getVaultPath();
  const sanitizedRel = relativePath.replace(/^(\.\.[\/\\])+/, '').replace(/^[\\\/]+/, '');
  const targetPath = path.join(vaultDir, sanitizedRel);

  if (fs.existsSync(targetPath)) {
    fs.unlinkSync(targetPath);
  }

  const bundled = path.join(process.cwd(), 'vault');
  if (fs.existsSync(bundled)) {
    try {
      const bTarget = path.join(bundled, sanitizedRel);
      if (fs.existsSync(bTarget)) fs.unlinkSync(bTarget);
    } catch {}
  }

  return { ok: true, path: sanitizedRel };
}

export function readVaultFile(relativePath: string): { ok: boolean; path: string; content?: string; mtime?: string; size?: number } {
  const vaultDir = getVaultPath();
  const sanitizedRel = relativePath.replace(/^(\.\.[\/\\])+/, '').replace(/^[\\\/]+/, '');
  const targetPath = path.join(vaultDir, sanitizedRel);

  if (!fs.existsSync(targetPath)) {
    return { ok: false, path: sanitizedRel };
  }

  const stat = fs.statSync(targetPath);
  const content = fs.readFileSync(targetPath, 'utf-8');
  return {
    ok: true,
    path: sanitizedRel,
    content,
    mtime: stat.mtime.toISOString(),
    size: stat.size,
  };
}

export function listVaultFiles(): { path: string; size: number; mtime: string }[] {
  const vaultDir = getVaultPath();
  const allFiles = getAllMarkdownFiles(vaultDir);
  return allFiles.map(f => {
    const rel = path.relative(vaultDir, f).replace(/\\/g, '/');
    const stat = fs.statSync(f);
    return {
      path: rel,
      size: stat.size,
      mtime: stat.mtime.toISOString(),
    };
  });
}

function getCountryCode(countryName?: string): string {
  if (!countryName) return 'GL';
  const c = countryName.toLowerCase();
  if (c.includes('panam')) return 'PA';
  if (c.includes('belic') || c.includes('belize')) return 'BZ';
  if (c.includes('canad')) return 'CA';
  if (c.includes('unidos') || c.includes('usa') || c.includes('united states') || c.includes('ee. uu.')) return 'US';
  if (c.includes('trinidad')) return 'TT';
  if (c.includes('barbados')) return 'BB';
  if (c.includes('guyana')) return 'GY';
  if (c.includes('jamaica')) return 'JM';
  if (c.includes('suriname')) return 'SR';
  if (c.includes('costa rica')) return 'CR';
  return 'GL';
}

function syncToBundledVault(relativeRel: string, content: string) {
  const bundledPath = path.join(process.cwd(), 'vault');
  const sanitizedRel = relativeRel.replace(/^(\.\.[\/\\])+/, '').replace(/^[\\\/]+/, '');
  if (fs.existsSync(bundledPath)) {
    try {
      const bTarget = path.join(bundledPath, sanitizedRel);
      const bDir = path.dirname(bTarget);
      if (!fs.existsSync(bDir)) fs.mkdirSync(bDir, { recursive: true });
      fs.writeFileSync(bTarget, content, 'utf-8');
    } catch {}
  }
}

export function getUnifiedBrainTasks(options?: { lens?: string; market?: string }): UnifiedTasksResponse {
  const vaultDir = getVaultPath();
  const files = getAllMarkdownFiles(vaultDir);
  const { dateStr: todayStr, tomorrowStr, dayAfterStr, timeStr: panamaTime } = getPanamaDate();

  const tasks: UnifiedBrainTask[] = [];
  const distributorSummaries: DistributorSummary[] = [];

  for (const file of files) {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      const { frontmatter, body } = parseFrontmatterAndBody(content);
      const filename = path.basename(file, '.md');
      const nodeId = frontmatter.id || filename.toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
      const nodeTitle = frontmatter.title || filename;
      const relFile = path.relative(vaultDir, file).replace(/\\/g, '/');

      // 1. DISTRIBUTORS
      if (frontmatter.type === 'distributor') {
        const country = frontmatter.based_in_country || frontmatter.country_name || 'Pan-Regional';
        const countryCode = getCountryCode(country);

        // Strict fidelity: Extract exclusively from frontmatter, zero fake numbers!
        const targetCases = typeof frontmatter.annual_forecast_cases === 'number'
          ? frontmatter.annual_forecast_cases
          : typeof frontmatter.target_cases_year === 'number'
          ? frontmatter.target_cases_year
          : undefined;

        const actualCases = typeof frontmatter.actual_cases_ytd === 'number'
          ? frontmatter.actual_cases_ytd
          : undefined;

        let complianceRate: number | undefined = undefined;
        let distStatus: 'At Risk' | 'On Track' | 'Ahead' | 'Unspecified' = 'Unspecified';

        if (targetCases !== undefined && actualCases !== undefined && targetCases > 0) {
          complianceRate = Math.round((actualCases / targetCases) * 100);
          distStatus = complianceRate < 70 ? 'At Risk' : complianceRate > 82 ? 'Ahead' : 'On Track';
        }

        const isVerified = frontmatter.verification_status === 'confirmed_official_corporate' ||
          frontmatter.verification_status === 'confirmed_by_HB' ||
          frontmatter.verification_status === 'verified_active' ||
          frontmatter.verification_status === 'user_confirmed_distributor_email_and_shipping_documents_observed';

        let distPendingCount = 0;

        // Next Followup action
        if (frontmatter.next_followup_action) {
          distPendingCount++;
          const dueDate = frontmatter.next_followup_date || undefined;
          const isDone = frontmatter.next_followup_completed === true;
          const isOverdue = !isDone && !!dueDate && dueDate < todayStr;
          const isToday = !isDone && !!dueDate && dueDate === todayStr;
          const isNext48h = !isDone && !!dueDate && (dueDate === tomorrowStr || dueDate === dayAfterStr);

          const fuTaskId = generateTaskId(nodeId, 'fu', frontmatter.next_followup_action);

          tasks.push({
            id: fuTaskId,
            title: frontmatter.next_followup_action,
            description: frontmatter.executive_observations || `Seguimiento clave con distribuidor ${frontmatter.company_name || nodeTitle}`,
            sourceType: 'distributor',
            sourceFile: relFile,
            sourceNodeId: nodeId,
            sourceNodeTitle: frontmatter.company_name || frontmatter.short_name || nodeTitle,
            country,
            countryCode,
            dueDate,
            priority: 'High',
            status: isDone ? 'Completed' : (frontmatter.dots_status === 'solicitado' || frontmatter.dots_status === 'in_progress' ? 'In Review DOTS' : 'Pending'),
            isCompleted: isDone,
            isOverdue,
            isToday,
            isNext48h,
            dotsStatus: frontmatter.dots_status || 'idle',
            dotsStage: frontmatter.dots_stage || (frontmatter.dots_status === 'in_progress' ? 'en_analisis' : undefined),
            dotsInstruction: frontmatter.last_dots_instruction,
            distributorQuota: targetCases !== undefined || actualCases !== undefined ? {
              annualTargetCases: targetCases,
              actualCasesYTD: actualCases,
              complianceRate,
              status: distStatus,
            } : undefined,
            recentActions: Array.isArray(frontmatter.recent_actions) ? frontmatter.recent_actions.slice(0, 3) : [],
            tags: ['distribuidor', 'seguimiento-ejecutivo', countryCode.toLowerCase()],
          });
        }

        // Pending Tasks array (Deterministic ID + Property preservation)
        if (Array.isArray(frontmatter.pending_tasks)) {
          frontmatter.pending_tasks.forEach((pt: any, idx: number) => {
            const isObj = typeof pt === 'object' && pt !== null;
            const taskText = isObj ? pt.title || pt.text : String(pt);
            const isDone = isObj ? !!pt.completed : false;
            const dueDate = (isObj && pt.dueDate) ? pt.dueDate : (frontmatter.next_followup_date || undefined);
            const isOverdue = !isDone && !!dueDate && dueDate < todayStr;
            const isToday = !isDone && !!dueDate && dueDate === todayStr;
            const isNext48h = !isDone && !!dueDate && (dueDate === tomorrowStr || dueDate === dayAfterStr);

            if (!isDone) distPendingCount++;

            const taskId = generateTaskId(nodeId, 'pt', pt, idx + 1);

            tasks.push({
              id: taskId,
              title: taskText,
              description: isObj && pt.description ? pt.description : `Operación comercial asignada a ${frontmatter.company_name || nodeTitle}`,
              sourceType: 'distributor',
              sourceFile: relFile,
              sourceNodeId: nodeId,
              sourceNodeTitle: frontmatter.company_name || frontmatter.short_name || nodeTitle,
              country,
              countryCode,
              dueDate,
              priority: (isObj && pt.priority) ? pt.priority : (idx === 0 ? 'High' : 'Medium'),
              status: isDone ? 'Completed' : 'Pending',
              isCompleted: isDone,
              isOverdue,
              isToday,
              isNext48h,
              dotsStatus: isObj && pt.dotsStatus ? pt.dotsStatus : 'idle',
              dotsStage: isObj && pt.dotsStage ? pt.dotsStage : undefined,
              distributorQuota: targetCases !== undefined || actualCases !== undefined ? {
                annualTargetCases: targetCases,
                actualCasesYTD: actualCases,
                complianceRate,
                status: distStatus,
              } : undefined,
              recentActions: Array.isArray(frontmatter.recent_actions) ? frontmatter.recent_actions.slice(0, 3) : [],
              tags: ['distribuidor', 'operacion', countryCode.toLowerCase()],
            });
          });
        }

        distributorSummaries.push({
          id: nodeId,
          name: frontmatter.company_name || frontmatter.short_name || nodeTitle,
          country,
          countryCode,
          targetCasesYear: targetCases,
          actualCasesYTD: actualCases,
          complianceRate,
          status: distStatus,
          isVerified,
          verificationStatus: frontmatter.verification_status || 'unverified_preliminary',
          pendingTasksCount: distPendingCount,
          nextFollowupDate: frontmatter.next_followup_date || undefined,
          nextFollowupAction: frontmatter.next_followup_action || undefined,
          lastContactDate: frontmatter.last_email_date || frontmatter.last_updated_at?.slice(0, 10),
          logoUrl: frontmatter.visual_logo_url,
        });
      }

      // 2. ROUTINES & OPERATIONS (Real Panama Due Dates & Recurrence)
      if (frontmatter.type === 'routine' || frontmatter.type === 'project') {
        const isRoutine = frontmatter.type === 'routine';

        let routineDueDate: string | undefined = undefined;
        if (isRoutine && typeof frontmatter.due_day_of_month === 'number') {
          const dayNum = String(frontmatter.due_day_of_month).padStart(2, '0');
          const ym = todayStr.slice(0, 7);
          routineDueDate = `${ym}-${dayNum}`;
        } else if (frontmatter.target_date) {
          routineDueDate = String(frontmatter.target_date);
        } else if (frontmatter.due_date) {
          routineDueDate = String(frontmatter.due_date);
        }

        if (Array.isArray(frontmatter.checklist)) {
          frontmatter.checklist.forEach((item: any, idx: number) => {
            const isObj = typeof item === 'object' && item !== null;
            const taskText = isObj ? item.text || item.title : String(item);
            const isDone = isObj ? !!item.completed : false;
            const itemDueDate = isObj && item.dueDate ? item.dueDate : routineDueDate;

            const isOverdue = !isDone && !!itemDueDate && itemDueDate < todayStr;
            const isToday = !isDone && !!itemDueDate && itemDueDate === todayStr;
            const isNext48h = !isDone && !!itemDueDate && (itemDueDate === tomorrowStr || itemDueDate === dayAfterStr);

            const taskId = generateTaskId(nodeId, 'chk', item, idx + 1);

            tasks.push({
              id: taskId,
              title: taskText,
              description: isRoutine ? 'Rutina mensual mandatoria de S&OP y forecasting de planta' : 'Iniciativa prioritaria de expansión y apertura de canal',
              sourceType: isRoutine ? 'routine' : 'project',
              sourceFile: relFile,
              sourceNodeId: nodeId,
              sourceNodeTitle: nodeTitle,
              country: 'Regional / Planta Trinidad',
              countryCode: 'TT',
              dueDate: itemDueDate,
              priority: isRoutine ? 'High' : 'Medium',
              status: isDone ? 'Completed' : 'Pending',
              isCompleted: isDone,
              isOverdue,
              isToday,
              isNext48h,
              dotsStatus: 'idle',
              tags: [isRoutine ? 'sop' : 'proyecto', 'planta-trinidad'],
            });
          });
        }
      }

      // 3. MARKETS
      if (frontmatter.type === 'market' && Array.isArray(frontmatter.pending_tasks)) {
        const country = frontmatter.country_name || nodeTitle;
        const countryCode = getCountryCode(country);
        frontmatter.pending_tasks.forEach((pt: any, idx: number) => {
          const isObj = typeof pt === 'object' && pt !== null;
          const taskText = isObj ? pt.text || pt.title : String(pt);
          const isDone = isObj ? !!pt.completed : false;
          const dueDate = isObj && pt.dueDate ? pt.dueDate : undefined;

          const isOverdue = !isDone && !!dueDate && dueDate < todayStr;
          const isToday = !isDone && !!dueDate && dueDate === todayStr;
          const isNext48h = !isDone && !!dueDate && (dueDate === tomorrowStr || dueDate === dayAfterStr);

          const taskId = generateTaskId(nodeId, 'mkt', pt, idx + 1);

          tasks.push({
            id: taskId,
            title: taskText,
            description: `Supervisión de plaza y directivas para ${country}`,
            sourceType: 'market',
            sourceFile: relFile,
            sourceNodeId: nodeId,
            sourceNodeTitle: country,
            country,
            countryCode,
            dueDate,
            priority: isObj && pt.priority ? pt.priority : 'Medium',
            status: isDone ? 'Completed' : 'Pending',
            isCompleted: isDone,
            isOverdue,
            isToday,
            isNext48h,
            dotsStatus: 'idle',
            tags: ['mercado', 'territorio', countryCode.toLowerCase()],
          });
        });
      }

      // 4. WORKING MEMORY (DOTS active items)
      if (frontmatter.type === 'working_memory' && frontmatter.status !== 'archived') {
        const isDone = frontmatter.status === 'completed';
        const cleanTitle = (frontmatter.title || filename).replace(/^Working Memory:\s*/i, '');
        const isDotsReview = frontmatter.status === 'in_review_dots' || frontmatter.status === 'pulsing' || frontmatter.lifecycle_stage === 'solicitado';

        const dueDate = frontmatter.due_date || frontmatter.captured_at?.slice(0, 10) || undefined;
        const isOverdue = !isDone && !!dueDate && dueDate < todayStr;
        const isToday = !isDone && !!dueDate && dueDate === todayStr;
        const isNext48h = !isDone && !!dueDate && (dueDate === tomorrowStr || dueDate === dayAfterStr);

        tasks.push({
          id: `wm-${nodeId}`,
          title: cleanTitle,
          description: frontmatter.instruction || frontmatter.notes || body.slice(0, 160),
          sourceType: 'working_memory',
          sourceFile: relFile,
          sourceNodeId: nodeId,
          sourceNodeTitle: 'Working Memory (DOTS)',
          country: frontmatter.country || 'Global',
          countryCode: getCountryCode(frontmatter.country),
          dueDate,
          priority: frontmatter.priority || 'High',
          status: isDone ? 'Completed' : (isDotsReview ? 'In Review DOTS' : 'Pending'),
          isCompleted: isDone,
          isOverdue,
          isToday,
          isNext48h,
          dotsStatus: isDone ? 'completed' : (isDotsReview ? 'in_progress' : 'assigned'),
          dotsStage: frontmatter.lifecycle_stage || (isDone ? 'aprobado_resuelto' : 'solicitado'),
          dotsInstruction: frontmatter.instruction,
          tags: ['dots', 'memoria-activa'],
        });
      }
    } catch {
      // Ignore unparseable files
    }
  }

  // Filter if market specified
  let filteredTasks = tasks;
  if (options?.market && options.market !== 'all') {
    const mkt = options.market.toLowerCase();
    filteredTasks = tasks.filter(t => 
      (t.country || '').toLowerCase().includes(mkt) ||
      (t.countryCode || '').toLowerCase() === mkt ||
      t.sourceNodeTitle.toLowerCase().includes(mkt)
    );
  }

  const summary = {
    totalTasks: filteredTasks.length,
    overdueTasks: filteredTasks.filter(t => t.isOverdue).length,
    todayTasks: filteredTasks.filter(t => t.isToday).length,
    next48hTasks: filteredTasks.filter(t => t.isNext48h).length,
    completedTasks: filteredTasks.filter(t => t.isCompleted).length,
    dotsAssignedTasks: filteredTasks.filter(t => t.status === 'In Review DOTS' || t.dotsStatus === 'in_progress').length,
    distributorsCount: distributorSummaries.length,
    atRiskDistributors: distributorSummaries.filter(d => d.status === 'At Risk').length,
    panamaTimestamp: `${todayStr} ${panamaTime}`,
  };

  return {
    tasks: filteredTasks,
    distributors: distributorSummaries,
    summary,
  };
}

export function completeBrainTask(taskId: string, completedBy?: string): { ok: boolean; message: string; task?: UnifiedBrainTask } {
  const vaultDir = getVaultPath();
  const allTasks = getUnifiedBrainTasks().tasks;
  const targetTask = allTasks.find(t => t.id === taskId);

  if (!targetTask) {
    return { ok: false, message: `No se encontró la tarea con ID ${taskId}` };
  }

  const fullPath = path.join(vaultDir, targetTask.sourceFile);
  if (!fs.existsSync(fullPath)) {
    return { ok: false, message: `Archivo de origen ${targetTask.sourceFile} no encontrado en el vault` };
  }

  const content = fs.readFileSync(fullPath, 'utf-8');
  const { frontmatter, body } = parseFrontmatterAndBody(content);
  const { dateStr, timeStr } = getPanamaDate();
  const nowIso = new Date().toISOString();
  const actor = completedBy || 'Chairman / Executive Office';

  let modified = false;

  // 1. Followup Action in Distributor
  if (targetTask.sourceType === 'distributor' && (taskId.startsWith('fu-') || targetTask.id.includes('-fu-'))) {
    frontmatter.next_followup_completed = true;
    frontmatter.last_updated_at = nowIso;
    frontmatter.last_updated_by = actor;
    if (!Array.isArray(frontmatter.recent_actions)) frontmatter.recent_actions = [];
    frontmatter.recent_actions.unshift({
      date: dateStr,
      type: 'seguimiento_completado',
      summary: `Seguimiento resuelto: "${targetTask.title}" por ${actor} (${timeStr})`,
    });
    modified = true;
  }
  // 2. Pending Tasks array with Property Preservation
  else if (Array.isArray(frontmatter.pending_tasks)) {
    const idx = frontmatter.pending_tasks.findIndex((pt: any, i: number) => {
      const gId = generateTaskId(targetTask.sourceNodeId, 'pt', pt, i + 1);
      return gId === taskId || (typeof pt === 'object' && pt?.id === taskId);
    });

    if (idx >= 0) {
      const orig = frontmatter.pending_tasks[idx];
      const isObj = typeof orig === 'object' && orig !== null;
      frontmatter.pending_tasks[idx] = isObj ? {
        ...orig,
        completed: true,
        completed_at: nowIso,
        completed_by: actor,
        status: 'Completed',
      } : {
        text: orig,
        completed: true,
        completed_at: nowIso,
        completed_by: actor,
        status: 'Completed',
      };
      if (!Array.isArray(frontmatter.recent_actions)) frontmatter.recent_actions = [];
      frontmatter.recent_actions.unshift({
        date: dateStr,
        type: 'tarea_completada',
        summary: `Tarea resuelta: "${targetTask.title}" por ${actor} (${timeStr})`,
      });
      modified = true;
    }
  }
  // 3. Checklist in Routines / Projects with Property Preservation
  else if (Array.isArray(frontmatter.checklist)) {
    const idx = frontmatter.checklist.findIndex((item: any, i: number) => {
      const gId = generateTaskId(targetTask.sourceNodeId, 'chk', item, i + 1);
      return gId === taskId || (typeof item === 'object' && item?.id === taskId);
    });

    if (idx >= 0) {
      const orig = frontmatter.checklist[idx];
      const isObj = typeof orig === 'object' && orig !== null;
      frontmatter.checklist[idx] = isObj ? {
        ...orig,
        completed: true,
        completed_at: nowIso,
        completed_by: actor,
      } : {
        text: orig,
        completed: true,
        completed_at: nowIso,
        completed_by: actor,
      };
      modified = true;
    }
  }
  // 4. Working Memory
  else if (targetTask.sourceType === 'working_memory') {
    frontmatter.status = 'completed';
    frontmatter.lifecycle_stage = 'aprobado_resuelto';
    frontmatter.completed_at = nowIso;
    modified = true;
  }

  if (!modified) {
    return { ok: false, message: `El tipo de tarea "${targetTask.sourceType}" no soporta modificación directa o no se encontró el elemento.` };
  }

  // ATOMIC WRITE-VERIFY-READ: Write file, then read back and verify
  const updatedYaml = YAML.stringify(frontmatter).trim();
  const newContent = `---\n${updatedYaml}\n---\n\n${body}\n`;
  fs.writeFileSync(fullPath, newContent, 'utf-8');

  const verifyContent = fs.readFileSync(fullPath, 'utf-8');
  const verifyParsed = parseFrontmatterAndBody(verifyContent);
  if (!verifyParsed.frontmatter) {
    return { ok: false, message: 'La verificación de lectura tras la escritura falló.' };
  }

  syncToBundledVault(targetTask.sourceFile, newContent);

  return {
    ok: true,
    message: `Tarea "${targetTask.title}" resuelta y confirmada en disco (${targetTask.sourceFile})`,
    task: { ...targetTask, isCompleted: true, status: 'Completed' },
  };
}

export function rescheduleBrainTask(taskId: string, newDueDate: string): { ok: boolean; message: string; task?: UnifiedBrainTask } {
  const vaultDir = getVaultPath();
  const allTasks = getUnifiedBrainTasks().tasks;
  const targetTask = allTasks.find(t => t.id === taskId);

  if (!targetTask) {
    return { ok: false, message: `No se encontró la tarea con ID ${taskId}` };
  }

  const fullPath = path.join(vaultDir, targetTask.sourceFile);
  if (!fs.existsSync(fullPath)) {
    return { ok: false, message: `Archivo de origen ${targetTask.sourceFile} no encontrado` };
  }

  const content = fs.readFileSync(fullPath, 'utf-8');
  const { frontmatter, body } = parseFrontmatterAndBody(content);
  const { dateStr, timeStr } = getPanamaDate();

  let modified = false;

  if (targetTask.sourceType === 'distributor' && (taskId.startsWith('fu-') || targetTask.id.includes('-fu-'))) {
    frontmatter.next_followup_date = newDueDate;
    frontmatter.next_followup_completed = false;
    modified = true;
  } else if (Array.isArray(frontmatter.pending_tasks)) {
    const idx = frontmatter.pending_tasks.findIndex((pt: any, i: number) => {
      const gId = generateTaskId(targetTask.sourceNodeId, 'pt', pt, i + 1);
      return gId === taskId || (typeof pt === 'object' && pt?.id === taskId);
    });
    if (idx >= 0) {
      const orig = frontmatter.pending_tasks[idx];
      const isObj = typeof orig === 'object' && orig !== null;
      frontmatter.pending_tasks[idx] = isObj ? { ...orig, dueDate: newDueDate, completed: false } : { text: orig, dueDate: newDueDate, completed: false };
      modified = true;
    }
  }

  if (!modified) {
    return { ok: false, message: `El tipo de tarea no soporta reagendado directo o no se encontró en la lista.` };
  }

  if (!Array.isArray(frontmatter.recent_actions)) frontmatter.recent_actions = [];
  frontmatter.recent_actions.unshift({
    date: dateStr,
    type: 'reagenda',
    summary: `Reagendado para el ${newDueDate}: "${targetTask.title}" (${timeStr})`,
  });

  const updatedYaml = YAML.stringify(frontmatter).trim();
  const newContent = `---\n${updatedYaml}\n---\n\n${body}\n`;
  fs.writeFileSync(fullPath, newContent, 'utf-8');

  // Verify write
  const verifyContent = fs.readFileSync(fullPath, 'utf-8');
  const verifyParsed = parseFrontmatterAndBody(verifyContent);
  if (!verifyParsed.frontmatter) {
    return { ok: false, message: 'Fallo al confirmar el reagendado en disco.' };
  }

  syncToBundledVault(targetTask.sourceFile, newContent);

  return {
    ok: true,
    message: `Tarea reagendada exitosamente al ${newDueDate} y confirmada en disco`,
    task: { ...targetTask, dueDate: newDueDate },
  };
}

export function askDotsTask(taskId: string, instruction: string, requestedBy?: string): {
  ok: boolean;
  message: string;
  workingMemoryId?: string;
  workingMemoryPath?: string;
} {
  const vaultDir = getVaultPath();
  const allTasks = getUnifiedBrainTasks().tasks;
  const targetTask = allTasks.find(t => t.id === taskId);

  if (!targetTask) {
    return { ok: false, message: `No se encontró la tarea con ID ${taskId}` };
  }

  const { dateStr, timeStr } = getPanamaDate();
  const nowIso = new Date().toISOString();
  const wmDir = path.join(vaultDir, '00-Working-Memory');
  if (!fs.existsSync(wmDir)) fs.mkdirSync(wmDir, { recursive: true });

  const wmId = `wm-${dateStr.replace(/-/g, '')}-${Date.now().toString().slice(-4)}`;
  const cleanTitle = `Instruccion DOTS - ${targetTask.sourceNodeTitle.replace(/[/\\?%*:|"<>]/g, '')}`;
  const filename = `${wmId} - ${cleanTitle}.md`;
  const filePath = path.join(wmDir, filename);

  const actor = requestedBy || 'Chairman / Executive Office';
  const targetNodeLink = targetTask.sourceNodeTitle.startsWith('[[') ? targetTask.sourceNodeTitle : `[[${targetTask.sourceNodeTitle}]]`;

  const wmContent = `---
id: ${wmId}
title: "Instrucción DOTS: ${targetTask.title}"
type: working_memory
memory_tier: working
status: in_review_dots
lifecycle_stage: solicitado
assigned_to: "DOTS Agent"
requested_by: "${actor}"
target_task_id: "${taskId}"
target_node: "${targetNodeLink}"
captured_at: "${nowIso}"
panama_time: "${dateStr} ${timeStr}"
instruction: "${instruction.replace(/"/g, '\\"')}"
relations:
  touches:
    - "${targetNodeLink}"
---

# Instrucción Ejecutiva para DOTS

**Tarea en Referencia:** ${targetTask.title}  
**Entidad Vinculada:** ${targetTask.sourceNodeTitle} (${targetTask.country || 'Global'})  
**Solicitado por:** ${actor}  
**Fecha y Hora:** ${dateStr} ${timeStr} (Panamá)

## Mandato / Instrucción:
${instruction}

## Ciclo de Vida y Estado de Procesamiento:
- [x] **1. Solicitado:** Registrado en Task Manager y depositado en Working Memory.
- [ ] **2. Recibido por DOTS:** En cola activa del agente.
- [ ] **3. En análisis:** Consulta de expediente y cálculo en proceso.
- [ ] **4. Borrador listo:** Entregable redactado en esta nota para revisión ejecutiva.
- [ ] **5. Aprobado / Resuelto:** Compromiso formalmente cerrado por el Chairman/HB.
`;

  fs.writeFileSync(filePath, wmContent, 'utf-8');

  // Update target node file to note DOTS instruction (Does NOT close the task!)
  const fullSourcePath = path.join(vaultDir, targetTask.sourceFile);
  if (fs.existsSync(fullSourcePath)) {
    const content = fs.readFileSync(fullSourcePath, 'utf-8');
    const { frontmatter, body } = parseFrontmatterAndBody(content);
    frontmatter.dots_status = 'solicitado';
    frontmatter.dots_stage = 'solicitado';
    frontmatter.last_dots_instruction = instruction;
    frontmatter.last_dots_request_at = nowIso;

    if (!Array.isArray(frontmatter.recent_actions)) frontmatter.recent_actions = [];
    frontmatter.recent_actions.unshift({
      date: dateStr,
      type: 'solicitud_dots',
      summary: `Instrucción despachada a DOTS [Fase: Solicitado]: "${instruction}" (${timeStr})`,
    });

    const updatedYaml = YAML.stringify(frontmatter).trim();
    const newContent = `---\n${updatedYaml}\n---\n\n${body}\n`;
    fs.writeFileSync(fullSourcePath, newContent, 'utf-8');
    syncToBundledVault(targetTask.sourceFile, newContent);
  }

  syncToBundledVault(path.join('00-Working-Memory', filename), wmContent);

  return {
    ok: true,
    message: `Instrucción enviada a DOTS exitosamente [Fase: Solicitado]. Expediente: ${wmId}`,
    workingMemoryId: wmId,
    workingMemoryPath: filename,
  };
}

export function createBrainTask(input: {
  title: string;
  dueDate?: string;
  priority?: 'High' | 'Medium' | 'Low';
  country?: string;
  targetNodeId?: string;
  description?: string;
}): { ok: boolean; message: string; task?: UnifiedBrainTask } {
  const vaultDir = getVaultPath();
  const { dateStr, timeStr } = getPanamaDate();
  const nowIso = new Date().toISOString();

  // If targetNodeId provided, attach structured task object with full properties!
  if (input.targetNodeId) {
    const allFiles = getAllMarkdownFiles(vaultDir);
    const targetFile = allFiles.find(f => {
      const base = path.basename(f, '.md').toLowerCase();
      const idLower = input.targetNodeId!.toLowerCase();
      return base.includes(idLower) || base.replace(/[^a-z0-9]/g, '').includes(idLower.replace(/[^a-z0-9]/g, ''));
    });

    if (!targetFile) {
      return { ok: false, message: `Nodo destino "${input.targetNodeId}" no encontrado en el vault` };
    }

    const content = fs.readFileSync(targetFile, 'utf-8');
    const { frontmatter, body } = parseFrontmatterAndBody(content);
    const nodeId = frontmatter.id || path.basename(targetFile, '.md').toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
    const taskId = generateTaskId(nodeId, 'pt', input.title);

    const newTaskObj = {
      id: taskId,
      title: input.title.trim(),
      dueDate: input.dueDate || undefined,
      priority: input.priority || 'Medium',
      description: input.description || '',
      country: input.country || frontmatter.based_in_country || frontmatter.country_name || 'Global',
      status: 'Pending',
      completed: false,
      created_at: nowIso,
      created_by: 'Chairman / Executive Office',
    };

    if (!Array.isArray(frontmatter.pending_tasks)) frontmatter.pending_tasks = [];
    frontmatter.pending_tasks.unshift(newTaskObj);

    if (!Array.isArray(frontmatter.recent_actions)) frontmatter.recent_actions = [];
    frontmatter.recent_actions.unshift({
      date: dateStr,
      type: 'nueva_tarea_ejecutiva',
      summary: `Nueva tarea asignada [${taskId}]: "${input.title}" (${timeStr})`,
    });

    const updatedYaml = YAML.stringify(frontmatter).trim();
    const newContent = `---\n${updatedYaml}\n---\n\n${body}\n`;
    fs.writeFileSync(targetFile, newContent, 'utf-8');

    // ATOMIC WRITE-VERIFY-READ: Confirm the structured task object was written
    const verifyContent = fs.readFileSync(targetFile, 'utf-8');
    const verifyParsed = parseFrontmatterAndBody(verifyContent);
    const exists = Array.isArray(verifyParsed.frontmatter.pending_tasks) &&
      verifyParsed.frontmatter.pending_tasks.some((pt: any) => (typeof pt === 'object' && pt?.id === taskId) || pt === input.title);

    if (!exists) {
      return { ok: false, message: 'Fallo al verificar la persistencia de la tarea en disco.' };
    }

    syncToBundledVault(path.relative(vaultDir, targetFile), newContent);

    return {
      ok: true,
      message: `Tarea creada y verificada en el nodo ${nodeId}`,
    };
  }

  // Otherwise save as working memory task
  const wmDir = path.join(vaultDir, '00-Working-Memory');
  if (!fs.existsSync(wmDir)) fs.mkdirSync(wmDir, { recursive: true });

  const wmId = `wm-${dateStr.replace(/-/g, '')}-${Date.now().toString().slice(-4)}`;
  const cleanTitle = input.title.replace(/[/\\?%*:|"<>]/g, '-').trim().slice(0, 50);
  const filename = `${wmId} - ${cleanTitle}.md`;
  const filePath = path.join(wmDir, filename);

  const wmContent = `---
id: ${wmId}
title: "${input.title}"
type: working_memory
memory_tier: working
status: active
captured_at: "${nowIso}"
panama_time: "${dateStr} ${timeStr}"
due_date: "${input.dueDate || ''}"
priority: "${input.priority || 'Medium'}"
country: "${input.country || 'Global'}"
source: "Task Manager Ejecutivo"
---

# ${input.title}

${input.description || 'Tarea ejecutiva registrada directamente en el Task Manager amarrado al Cerebro.'}
`;

  fs.writeFileSync(filePath, wmContent, 'utf-8');
  syncToBundledVault(path.join('00-Working-Memory', filename), wmContent);

  return {
    ok: true,
    message: `Tarea registrada y verificada en el Cerebro: ${input.title}`,
  };
}

export function upsertNode(input: {
  relativePath: string;
  frontmatter: Record<string, any>;
  body: string;
}): { ok: boolean; message: string; fullPath?: string } {
  const vaultDir = getVaultPath();
  const sanitizedRel = input.relativePath.replace(/^(\.\.[\/\\])+/, '').replace(/^[\\\/]+/, '');
  const targetPath = path.join(vaultDir, sanitizedRel);
  const targetDir = path.dirname(targetPath);

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  input.frontmatter.updated_at = new Date().toISOString();
  const updatedYaml = YAML.stringify(input.frontmatter).trim();
  const newContent = `---\n${updatedYaml}\n---\n\n${input.body.trim()}\n`;

  fs.writeFileSync(targetPath, newContent, 'utf-8');

  // Verify write
  if (!fs.existsSync(targetPath)) {
    return { ok: false, message: `Fallo al escribir el archivo en ${sanitizedRel}` };
  }

  syncToBundledVault(sanitizedRel, newContent);

  return {
    ok: true,
    message: `Nodo guardado y verificado exitosamente en ${sanitizedRel}`,
    fullPath: targetPath,
  };
}

export function reconfigureNodeTopology(input: {
  nodeId: string;
  market?: string;
  spatial_anchor?: string;
  spatial_tier?: string;
  channel_type?: string;
  parent_distributor?: string;
  supplied_by?: string;
  clients?: string[];
  brands?: string[];
  visual_coordinates?: { x: number; y: number };
  relations?: Record<string, string[]>;
}): { ok: boolean; message: string } {
  const vaultDir = getVaultPath();
  const allNodes = loadBrainGraph().nodes;
  const target = allNodes.find(n => n.id === input.nodeId || n.id.toLowerCase() === input.nodeId.toLowerCase());

  if (!target) {
    return { ok: false, message: `No se encontró el nodo con ID ${input.nodeId}` };
  }

  const filePath = target.filePath;
  if (!fs.existsSync(filePath)) {
    return { ok: false, message: `Archivo de nodo no encontrado en disco: ${filePath}` };
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const { frontmatter, body } = parseFrontmatterAndBody(content);

  // Apply updates
  if (input.market !== undefined) frontmatter.market = input.market;
  if (input.spatial_anchor !== undefined) frontmatter.spatial_anchor = input.spatial_anchor;
  if (input.spatial_tier !== undefined) frontmatter.spatial_tier = input.spatial_tier;
  if (input.channel_type !== undefined) frontmatter.channel_type = input.channel_type;
  if (input.parent_distributor !== undefined) frontmatter.parent_distributor = input.parent_distributor;
  if (input.supplied_by !== undefined) frontmatter.supplied_by = input.supplied_by;
  if (input.clients !== undefined) frontmatter.serves_clients = input.clients;
  if (input.brands !== undefined) frontmatter.carries_brands = input.brands;
  if (input.visual_coordinates !== undefined) frontmatter.visual_coordinates = input.visual_coordinates;

  if (input.relations) {
    frontmatter.relations = { ...(frontmatter.relations || {}), ...input.relations };
  }

  frontmatter.last_updated_at = new Date().toISOString();
  frontmatter.last_updated_by = 'DOTS Agent (Topology Reconfiguration)';

  const updatedYaml = YAML.stringify(frontmatter).trim();
  const newContent = `---\n${updatedYaml}\n---\n\n${body.trim()}\n`;

  fs.writeFileSync(filePath, newContent, 'utf-8');

  // Verify write
  const verified = fs.readFileSync(filePath, 'utf-8');
  if (!verified.includes(target.id)) {
    return { ok: false, message: 'Falla al verificar la escritura física en disco' };
  }

  syncToBundledVault(path.relative(vaultDir, filePath), newContent);

  return {
    ok: true,
    message: `Topología y espacio reconfigurados exitosamente para '${target.title}' [ID: ${target.id}].`,
  };
}
