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

const VAULT_DEFAULT_PATH = 'C:\\Users\\Usuario\\Downloads\\SMJaleel\\vault';

function getVaultPath(): string {
  if (process.env.SMJ_VAULT_PATH && fs.existsSync(process.env.SMJ_VAULT_PATH)) {
    return process.env.SMJ_VAULT_PATH;
  }
  if (fs.existsSync(VAULT_DEFAULT_PATH)) {
    return VAULT_DEFAULT_PATH;
  }
  const bundledPath = path.join(process.cwd(), 'vault');
  if (fs.existsSync(bundledPath)) {
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

      nodes.push({
        id,
        title,
        type: frontmatter.type || 'working_memory',
        memory_tier: frontmatter.memory_tier || (file.includes('00-Working-Memory') ? 'working' : 'long_term'),
        status: frontmatter.status || 'active',
        hierarchy_level: frontmatter.hierarchy_level !== undefined ? frontmatter.hierarchy_level : 3,
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
