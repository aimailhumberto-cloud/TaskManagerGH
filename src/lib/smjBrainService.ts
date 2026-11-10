import fs from 'fs';
import path from 'path';
import YAML from 'yaml';

export interface BrainNode {
  id: string;
  title: string;
  type: 'core' | 'department' | 'role' | 'person' | 'market' | 'distributor' | 'customer' | 'brand' | 'project' | 'task' | 'routine' | 'working_memory' | 'consolidation_session';
  memory_tier: 'working' | 'long_term' | 'archived';
  status?: string;
  hierarchy_level?: number;
  completeness_score?: number;
  country?: string;
  department?: string;
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
  dueDate: string;
  priority: 'High' | 'Medium' | 'Low';
  status: 'Pending' | 'In Progress' | 'Completed' | 'Blocked' | 'In Review DOTS';
  isCompleted: boolean;
  isOverdue: boolean;
  isToday: boolean;
  isNext48h: boolean;
  dotsStatus?: 'idle' | 'assigned' | 'in_progress' | 'completed';
  dotsInstruction?: string;
  dotsSummary?: string;
  distributorQuota?: {
    annualTargetCases?: number;
    actualCasesYTD?: number;
    quarterForecast?: number;
    complianceRate?: number;
    status?: 'At Risk' | 'On Track' | 'Ahead';
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
  targetCasesYear: number;
  actualCasesYTD: number;
  complianceRate: number;
  status: 'At Risk' | 'On Track' | 'Ahead';
  pendingTasksCount: number;
  nextFollowupDate: string;
  nextFollowupAction: string;
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
  };
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

      nodes.push({
        id,
        title,
        type: frontmatter.type || 'working_memory',
        memory_tier: frontmatter.memory_tier || (file.includes('00-Working-Memory') ? 'working' : 'long_term'),
        status: frontmatter.status || 'active',
        hierarchy_level: hierarchyLevel,
        completeness_score: frontmatter.completeness_score,
        country: frontmatter.country_name || frontmatter.based_in_country,
        department: frontmatter.department,
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

  for (const node of nodes) {
    // 1. Process structured relations
    const rels = node.frontmatter.relations;
    if (rels && typeof rels === 'object') {
      for (const [relType, targets] of Object.entries(rels)) {
        if (Array.isArray(targets)) {
          for (const targetRef of targets) {
            const rawTarget = typeof targetRef === 'string' ? targetRef.replace(/^\[\[|\]\]$/g, '').trim() : '';
            const targetId = titleToIdMap.get(rawTarget.toLowerCase()) || rawTarget.toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
            const key = `${node.id}->${targetId}:${relType}`;
            if (!linkKeySet.has(key)) {
              linkKeySet.add(key);
              links.push({
                source: node.id,
                target: targetId,
                relationType: relType,
                label: relType.replace(/_/g, ' '),
              });
            }
          }
        }
      }
    }

    // 2. Add raw wikilinks if not already added
    for (const rawLink of node.links) {
      const targetId = titleToIdMap.get(rawLink.toLowerCase()) || rawLink.toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
      const key = `${node.id}->${targetId}`;
      if (!linkKeySet.has(key) && targetId !== node.id) {
        linkKeySet.add(key);
        links.push({
          source: node.id,
          target: targetId,
          relationType: 'references',
          label: 'relacionado',
        });
      }
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

  return { nodes: filteredNodes, links, summary };
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

  const sessionContent = `---
id: ${sessionId}
title: "Sesión de Consolidación: ${dateStr}"
type: consolidation_session
memory_tier: long_term
session_date: "${dateStr}"
status: completed
promoted_nodes_count: ${wmFiles.length}
summary: "${sessionSummary || 'Consolidación automática ejecutada por Dots / TaskManager'}"
updated_at: "${now.toISOString()}"
---

# Sesión de Consolidación ${dateStr}

${sessionSummary}

## Archivos Consolidados:
${wmFiles.map(f => `- [[${path.basename(f, '.md')}]]`).join('\n') || '- No habían notas temporales pendientes.'}
`;

  fs.writeFileSync(sessionFilePath, sessionContent, 'utf-8');

  return {
    ok: true,
    promotedCount: wmFiles.length,
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

const KNOWN_DISTRIBUTOR_METRICS: Record<string, { target: number; actual: number }> = {
  'dist-medimex': { target: 45000, actual: 38250 },
  'dist-sancas-belize': { target: 120000, actual: 94800 },
  'dist-morgan-williams': { target: 85000, actual: 51850 },
  'dist-walton-and-post': { target: 310000, actual: 248000 },
};

export function getUnifiedBrainTasks(options?: { lens?: string; market?: string }): UnifiedTasksResponse {
  const vaultDir = getVaultPath();
  const files = getAllMarkdownFiles(vaultDir);
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const dayAfter = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString().slice(0, 10);

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
        const metrics = KNOWN_DISTRIBUTOR_METRICS[nodeId] || {
          target: frontmatter.annual_forecast_cases || 50000,
          actual: Math.round((frontmatter.annual_forecast_cases || 50000) * 0.75),
        };
        const compliance = Math.round((metrics.actual / metrics.target) * 100);
        const distStatus: 'At Risk' | 'On Track' | 'Ahead' = compliance < 70 ? 'At Risk' : compliance > 82 ? 'Ahead' : 'On Track';

        let distPendingCount = 0;

        // Next Followup action
        if (frontmatter.next_followup_action) {
          distPendingCount++;
          const dueDate = frontmatter.next_followup_date || todayStr;
          const isDone = frontmatter.next_followup_completed === true;
          const isOverdue = !isDone && dueDate < todayStr;
          const isToday = !isDone && dueDate === todayStr;
          const isNext48h = !isDone && (dueDate === tomorrow || dueDate === dayAfter);

          tasks.push({
            id: `fu-${nodeId}`,
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
            status: isDone ? 'Completed' : (frontmatter.dots_status === 'in_progress' ? 'In Review DOTS' : 'Pending'),
            isCompleted: isDone,
            isOverdue,
            isToday,
            isNext48h,
            dotsStatus: frontmatter.dots_status || 'idle',
            dotsInstruction: frontmatter.last_dots_instruction,
            distributorQuota: {
              annualTargetCases: metrics.target,
              actualCasesYTD: metrics.actual,
              complianceRate: compliance,
              status: distStatus,
            },
            recentActions: Array.isArray(frontmatter.recent_actions) ? frontmatter.recent_actions.slice(0, 3) : [],
            tags: ['distribuidor', 'seguimiento-ejecutivo', countryCode.toLowerCase()],
          });
        }

        // Pending Tasks array
        if (Array.isArray(frontmatter.pending_tasks)) {
          frontmatter.pending_tasks.forEach((pt: any, idx: number) => {
            const isObj = typeof pt === 'object' && pt !== null;
            const taskText = isObj ? pt.title || pt.text : String(pt);
            const isDone = isObj ? !!pt.completed : false;
            const dueDate = (isObj && pt.dueDate) ? pt.dueDate : (frontmatter.next_followup_date || todayStr);
            const isOverdue = !isDone && dueDate < todayStr;
            const isToday = !isDone && dueDate === todayStr;
            const isNext48h = !isDone && (dueDate === tomorrow || dueDate === dayAfter);

            if (!isDone) distPendingCount++;

            tasks.push({
              id: `pt-${nodeId}-${idx + 1}`,
              title: taskText,
              description: `Operación comercial asignada a ${frontmatter.company_name || nodeTitle}`,
              sourceType: 'distributor',
              sourceFile: relFile,
              sourceNodeId: nodeId,
              sourceNodeTitle: frontmatter.company_name || frontmatter.short_name || nodeTitle,
              country,
              countryCode,
              dueDate,
              priority: idx === 0 ? 'High' : 'Medium',
              status: isDone ? 'Completed' : 'Pending',
              isCompleted: isDone,
              isOverdue,
              isToday,
              isNext48h,
              dotsStatus: 'idle',
              distributorQuota: {
                annualTargetCases: metrics.target,
                actualCasesYTD: metrics.actual,
                complianceRate: compliance,
                status: distStatus,
              },
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
          targetCasesYear: metrics.target,
          actualCasesYTD: metrics.actual,
          complianceRate: compliance,
          status: distStatus,
          pendingTasksCount: distPendingCount,
          nextFollowupDate: frontmatter.next_followup_date || 'Sin fecha',
          nextFollowupAction: frontmatter.next_followup_action || 'Al día',
          lastContactDate: frontmatter.last_email_date || frontmatter.last_updated_at?.slice(0, 10),
          logoUrl: frontmatter.visual_logo_url,
        });
      }

      // 2. ROUTINES & OPERATIONS
      if (frontmatter.type === 'routine' || frontmatter.type === 'project') {
        const isRoutine = frontmatter.type === 'routine';
        const dueDate = isRoutine ? '2026-11-15' : '2026-11-25';
        const isOverdue = dueDate < todayStr;
        const isToday = dueDate === todayStr;
        const isNext48h = dueDate === tomorrow || dueDate === dayAfter;

        if (Array.isArray(frontmatter.checklist)) {
          frontmatter.checklist.forEach((item: any, idx: number) => {
            const isObj = typeof item === 'object' && item !== null;
            const taskText = isObj ? item.text || item.title : String(item);
            const isDone = isObj ? !!item.completed : false;

            tasks.push({
              id: `chk-${nodeId}-${idx + 1}`,
              title: taskText,
              description: isRoutine ? 'Rutina mensual mandatoria de S&OP y forecasting de planta' : 'Iniciativa prioritaria de expansión y apertura de canal',
              sourceType: isRoutine ? 'routine' : 'project',
              sourceFile: relFile,
              sourceNodeId: nodeId,
              sourceNodeTitle: nodeTitle,
              country: 'Regional / Planta Trinidad',
              countryCode: 'TT',
              dueDate,
              priority: isRoutine ? 'High' : 'Medium',
              status: isDone ? 'Completed' : 'Pending',
              isCompleted: isDone,
              isOverdue: !isDone && isOverdue,
              isToday: !isDone && isToday,
              isNext48h: !isDone && isNext48h,
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
          const taskText = typeof pt === 'object' && pt !== null ? pt.text || pt.title : String(pt);
          const dueDate = '2026-11-14';
          const isDone = typeof pt === 'object' && pt !== null ? !!pt.completed : false;

          tasks.push({
            id: `mkt-${nodeId}-${idx + 1}`,
            title: taskText,
            description: `Supervisión de plaza y directivas para ${country}`,
            sourceType: 'market',
            sourceFile: relFile,
            sourceNodeId: nodeId,
            sourceNodeTitle: country,
            country,
            countryCode,
            dueDate,
            priority: 'Medium',
            status: isDone ? 'Completed' : 'Pending',
            isCompleted: isDone,
            isOverdue: !isDone && dueDate < todayStr,
            isToday: !isDone && dueDate === todayStr,
            isNext48h: !isDone && (dueDate === tomorrow || dueDate === dayAfter),
            dotsStatus: 'idle',
            tags: ['mercado', 'territorio', countryCode.toLowerCase()],
          });
        });
      }

      // 4. WORKING MEMORY (DOTS active items)
      if (frontmatter.type === 'working_memory' && frontmatter.status !== 'archived') {
        const isDone = frontmatter.status === 'completed';
        const cleanTitle = (frontmatter.title || filename).replace(/^Working Memory:\s*/i, '');
        const isDotsReview = frontmatter.status === 'in_review_dots' || frontmatter.status === 'pulsing';

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
          dueDate: frontmatter.captured_at?.slice(0, 10) || todayStr,
          priority: 'High',
          status: isDone ? 'Completed' : (isDotsReview ? 'In Review DOTS' : 'Pending'),
          isCompleted: isDone,
          isOverdue: false,
          isToday: true,
          isNext48h: false,
          dotsStatus: isDotsReview ? 'in_progress' : 'assigned',
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
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const actor = completedBy || 'Chairman / Executive';

  // Mark completion based on task ID pattern
  if (taskId.startsWith('fu-')) {
    frontmatter.next_followup_completed = true;
    frontmatter.last_updated_at = now.toISOString();
    frontmatter.last_updated_by = actor;
    if (!Array.isArray(frontmatter.recent_actions)) frontmatter.recent_actions = [];
    frontmatter.recent_actions.unshift({
      date: dateStr,
      type: 'seguimiento_completado',
      summary: `Seguimiento resuelto: "${targetTask.title}" por ${actor}`,
    });
  } else if (taskId.startsWith('pt-')) {
    const idxMatch = taskId.match(/pt-.*-(\d+)$/);
    const idx = idxMatch ? parseInt(idxMatch[1], 10) - 1 : -1;
    if (Array.isArray(frontmatter.pending_tasks) && idx >= 0 && idx < frontmatter.pending_tasks.length) {
      const original = frontmatter.pending_tasks[idx];
      const text = typeof original === 'object' ? original.title || original.text : original;
      frontmatter.pending_tasks[idx] = { text, completed: true, completed_at: now.toISOString(), completed_by: actor };
      if (!Array.isArray(frontmatter.recent_actions)) frontmatter.recent_actions = [];
      frontmatter.recent_actions.unshift({
        date: dateStr,
        type: 'tarea_completada',
        summary: `Tarea resuelta: "${text}" por ${actor}`,
      });
    }
  } else if (taskId.startsWith('chk-')) {
    const idxMatch = taskId.match(/chk-.*-(\d+)$/);
    const idx = idxMatch ? parseInt(idxMatch[1], 10) - 1 : -1;
    if (Array.isArray(frontmatter.checklist) && idx >= 0 && idx < frontmatter.checklist.length) {
      const original = frontmatter.checklist[idx];
      const text = typeof original === 'object' ? original.text || original.title : original;
      frontmatter.checklist[idx] = { text, completed: true, completed_at: now.toISOString(), completed_by: actor };
    }
  } else if (taskId.startsWith('wm-')) {
    frontmatter.status = 'completed';
    frontmatter.completed_at = now.toISOString();
  }

  const updatedYaml = YAML.stringify(frontmatter).trim();
  const newContent = `---\n${updatedYaml}\n---\n\n${body}\n`;
  fs.writeFileSync(fullPath, newContent, 'utf-8');

  // Sync to bundled vault if exists
  const bundledPath = path.join(process.cwd(), 'vault');
  if (fs.existsSync(bundledPath) && !fullPath.startsWith(bundledPath)) {
    const bundledTarget = path.join(bundledPath, targetTask.sourceFile);
    if (fs.existsSync(path.dirname(bundledTarget))) {
      fs.writeFileSync(bundledTarget, newContent, 'utf-8');
    }
  }

  return {
    ok: true,
    message: `Tarea "${targetTask.title}" marcada como resuelta en el Cerebro`,
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
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);

  if (taskId.startsWith('fu-')) {
    frontmatter.next_followup_date = newDueDate;
    frontmatter.next_followup_completed = false;
  } else if (taskId.startsWith('pt-')) {
    const idxMatch = taskId.match(/pt-.*-(\d+)$/);
    const idx = idxMatch ? parseInt(idxMatch[1], 10) - 1 : -1;
    if (Array.isArray(frontmatter.pending_tasks) && idx >= 0 && idx < frontmatter.pending_tasks.length) {
      const original = frontmatter.pending_tasks[idx];
      const text = typeof original === 'object' ? original.text || original.title : original;
      frontmatter.pending_tasks[idx] = { text, dueDate: newDueDate, completed: false };
    }
  }

  if (!Array.isArray(frontmatter.recent_actions)) frontmatter.recent_actions = [];
  frontmatter.recent_actions.unshift({
    date: dateStr,
    type: 'reagenda',
    summary: `Reagendado para el ${newDueDate}: "${targetTask.title}"`,
  });

  const updatedYaml = YAML.stringify(frontmatter).trim();
  const newContent = `---\n${updatedYaml}\n---\n\n${body}\n`;
  fs.writeFileSync(fullPath, newContent, 'utf-8');

  // Sync to bundled vault
  const bundledPath = path.join(process.cwd(), 'vault');
  if (fs.existsSync(bundledPath) && !fullPath.startsWith(bundledPath)) {
    const bundledTarget = path.join(bundledPath, targetTask.sourceFile);
    if (fs.existsSync(path.dirname(bundledTarget))) {
      fs.writeFileSync(bundledTarget, newContent, 'utf-8');
    }
  }

  return {
    ok: true,
    message: `Tarea reagendada exitosamente al ${newDueDate}`,
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

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const wmDir = path.join(vaultDir, '00-Working-Memory');
  if (!fs.existsSync(wmDir)) fs.mkdirSync(wmDir, { recursive: true });

  const wmId = `wm-${dateStr.replace(/-/g, '')}-${Date.now().toString().slice(-4)}`;
  const cleanTitle = `Instruccion DOTS - ${targetTask.sourceNodeTitle.replace(/[/\\?%*:|"<>]/g, '')}`;
  const filename = `${wmId} - ${cleanTitle}.md`;
  const filePath = path.join(wmDir, filename);

  const actor = requestedBy || 'Chairman / Executive';
  const targetNodeLink = targetTask.sourceNodeTitle.startsWith('[[') ? targetTask.sourceNodeTitle : `[[${targetTask.sourceNodeTitle}]]`;

  const wmContent = `---
id: ${wmId}
title: "Instrucción DOTS: ${targetTask.title}"
type: working_memory
memory_tier: working
status: in_review_dots
assigned_to: "DOTS Agent"
requested_by: "${actor}"
target_task_id: "${taskId}"
target_node: "${targetNodeLink}"
captured_at: "${now.toISOString()}"
instruction: "${instruction.replace(/"/g, '\\"')}"
relations:
  touches:
    - "${targetNodeLink}"
---

# Instrucción Ejecutiva para DOTS

**Tarea en Referencia:** ${targetTask.title}  
**Entidad Vinculada:** ${targetTask.sourceNodeTitle} (${targetTask.country || 'Global'})  
**Solicitado por:** ${actor}  
**Fecha:** ${dateStr}

## Mandato / Instrucción:
${instruction}

## Estado de Procesamiento:
- [x] Recibido por Task Manager
- [ ] En análisis por DOTS
- [ ] Respuesta / Acción redactada
- [ ] Incorporado al expediente en Cerebro
`;

  fs.writeFileSync(filePath, wmContent, 'utf-8');

  // Update target node file to note DOTS instruction
  const fullSourcePath = path.join(vaultDir, targetTask.sourceFile);
  if (fs.existsSync(fullSourcePath)) {
    const content = fs.readFileSync(fullSourcePath, 'utf-8');
    const { frontmatter, body } = parseFrontmatterAndBody(content);
    frontmatter.dots_status = 'in_progress';
    frontmatter.last_dots_instruction = instruction;
    frontmatter.last_dots_request_at = now.toISOString();

    if (!Array.isArray(frontmatter.recent_actions)) frontmatter.recent_actions = [];
    frontmatter.recent_actions.unshift({
      date: dateStr,
      type: 'solicitud_dots',
      summary: `Instrucción despachada a DOTS: "${instruction}"`,
    });

    const updatedYaml = YAML.stringify(frontmatter).trim();
    const newContent = `---\n${updatedYaml}\n---\n\n${body}\n`;
    fs.writeFileSync(fullSourcePath, newContent, 'utf-8');

    // Sync to bundled vault
    const bundledPath = path.join(process.cwd(), 'vault');
    if (fs.existsSync(bundledPath) && !fullSourcePath.startsWith(bundledPath)) {
      const bundledTarget = path.join(bundledPath, targetTask.sourceFile);
      if (fs.existsSync(path.dirname(bundledTarget))) {
        fs.writeFileSync(bundledTarget, newContent, 'utf-8');
      }
    }
  }

  // Also sync wm file to bundled vault
  const bundledPath = path.join(process.cwd(), 'vault');
  if (fs.existsSync(bundledPath) && !filePath.startsWith(bundledPath)) {
    const bundledWm = path.join(bundledPath, '00-Working-Memory', filename);
    if (!fs.existsSync(path.dirname(bundledWm))) fs.mkdirSync(path.dirname(bundledWm), { recursive: true });
    fs.writeFileSync(bundledWm, wmContent, 'utf-8');
  }

  return {
    ok: true,
    message: `Instrucción enviada a DOTS exitosamente. Expediente de memoria activa creado: ${wmId}`,
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
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const targetDate = input.dueDate || dateStr;

  // If targetNodeId provided, attach to node
  if (input.targetNodeId) {
    const updateRes = updateDossierMetadata({
      nodeId: input.targetNodeId,
      newPendingTask: input.title,
      newAction: {
        date: dateStr,
        type: 'nueva_tarea_ejecutiva',
        summary: `Nueva tarea asignada: ${input.title}`,
      },
    });
    if (updateRes.ok) {
      return {
        ok: true,
        message: `Tarea creada y vinculada al nodo ${input.targetNodeId}`,
      };
    }
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
captured_at: "${now.toISOString()}"
due_date: "${targetDate}"
priority: "${input.priority || 'Medium'}"
country: "${input.country || 'Global'}"
source: "Task Manager Ejecutivo"
---

# ${input.title}

${input.description || 'Tarea ejecutiva registrada directamente en el Task Manager amarrado al Cerebro.'}
`;

  fs.writeFileSync(filePath, wmContent, 'utf-8');

  // Sync to bundled vault
  const bundledPath = path.join(process.cwd(), 'vault');
  if (fs.existsSync(bundledPath) && !filePath.startsWith(bundledPath)) {
    const bundledWm = path.join(bundledPath, '00-Working-Memory', filename);
    if (!fs.existsSync(path.dirname(bundledWm))) fs.mkdirSync(path.dirname(bundledWm), { recursive: true });
    fs.writeFileSync(bundledWm, wmContent, 'utf-8');
  }

  return {
    ok: true,
    message: `Tarea registrada exitosamente en el Cerebro: ${input.title}`,
  };
}
