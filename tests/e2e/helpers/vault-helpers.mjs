import fs from 'fs';
import path from 'path';
import YAML from 'yaml';

export const PRIMARY_VAULT_PATH = 'c:\\Users\\Usuario\\Downloads\\SMJaleel\\vault';
export const BUNDLED_VAULT_PATH = path.resolve(process.cwd(), 'vault');

export function resolveVaultPath() {
  if (process.env.SMJ_VAULT_PATH && fs.existsSync(process.env.SMJ_VAULT_PATH)) {
    return process.env.SMJ_VAULT_PATH;
  }
  if (fs.existsSync(PRIMARY_VAULT_PATH)) {
    return PRIMARY_VAULT_PATH;
  }
  if (fs.existsSync(BUNDLED_VAULT_PATH)) {
    return BUNDLED_VAULT_PATH;
  }
  throw new Error(`Vault directory not found in ${PRIMARY_VAULT_PATH} or ${BUNDLED_VAULT_PATH}`);
}

export function getAllVaultFiles(dir = resolveVaultPath()) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(getAllVaultFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(full);
    }
  }
  return files;
}

export function parseMarkdownFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  return parseMarkdownContent(content, filePath);
}

export function parseMarkdownContent(content, filePath = 'in-memory.md') {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n([\s\S]*))?$/);
  if (!match) {
    return {
      filePath,
      frontmatter: {},
      rawFrontmatter: '',
      body: content,
      wikilinks: extractWikilinks(content),
    };
  }

  const rawYaml = match[1];
  const body = match[2] || '';
  let frontmatter = {};
  try {
    const parsed = YAML.parse(rawYaml);
    if (parsed && typeof parsed === 'object') {
      frontmatter = parsed;
    }
  } catch (err) {
    // Malformed YAML
    frontmatter = { __error: err.message };
  }

  return {
    filePath,
    frontmatter,
    rawFrontmatter: rawYaml,
    body,
    wikilinks: extractWikilinks(content),
  };
}

export function extractWikilinks(text) {
  const regex = /\[\[(.*?)\]\]/g;
  const links = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    const inner = match[1].trim();
    if (!inner) continue;
    if (inner.includes('|')) {
      const [target, alias] = inner.split('|').map(s => s.trim());
      links.push({ raw: match[0], target, alias });
    } else {
      links.push({ raw: match[0], target: inner, alias: inner });
    }
  }
  return links;
}

export const KNOWN_13_RESIDUAL_FILES = [
  '01-Internal-Clients/Core - S.M. Jaleel & Co. Ltd..md',
  '01-Internal-Clients/Person - Debiena Yearwood.md',
  '01-Internal-Clients/Person - Humberto Bouche.md',
  '01-Internal-Clients/Person - Michelle Grant.md',
  '01-Internal-Clients/Estructura-corporativa-2026-11-09/group-smj-group.md',
  '01-Internal-Clients/Estructura-corporativa-2026-11-09/organization-guyana-beverages-inc.md',
  '01-Internal-Clients/Estructura-corporativa-2026-11-09/organization-s-m-j-beverages-st-lucia-ltd.md',
  '01-Internal-Clients/Estructura-corporativa-2026-11-09/organization-smj-beverages-barbados-inc.md',
  '01-Internal-Clients/Estructura-corporativa-2026-11-09/organization-smj-beverages-sa-pty-ltd.md',
  '01-Internal-Clients/Estructura-corporativa-2026-11-09/organization-smj-beverages-suriname-n-v.md',
  '01-Internal-Clients/Estructura-corporativa-2026-11-09/organization-smj-beverages-usa-inc.md',
  '01-Internal-Clients/Estructura-corporativa-2026-11-09/person-walvyx-parra.md',
  '01-Internal-Clients/Estructura-corporativa-2026-11-09/person-wazid-baksh.md',
];

export const PRIMARY_21_NODES = [
  '01-Internal-Clients/Core - S.M. Jaleel & Co. Ltd..md',
  '02-External-Clients/Distributor - MEDIMEX.md',
  '01-Internal-Clients/Estructura-corporativa-2026-11-09/group-smj-group.md',
  '01-Internal-Clients/Estructura-corporativa-2026-11-09/organization-guyana-beverages-inc.md',
  '01-Internal-Clients/Estructura-corporativa-2026-11-09/organization-s-m-j-beverages-st-lucia-ltd.md',
  '01-Internal-Clients/Estructura-corporativa-2026-11-09/organization-smj-beverages-barbados-inc.md',
  '01-Internal-Clients/Estructura-corporativa-2026-11-09/organization-smj-beverages-sa-pty-ltd.md',
  '01-Internal-Clients/Estructura-corporativa-2026-11-09/organization-smj-beverages-suriname-n-v.md',
  '01-Internal-Clients/Estructura-corporativa-2026-11-09/organization-smj-beverages-usa-inc.md',
  '01-Internal-Clients/Person - Humberto Bouche.md',
  '01-Internal-Clients/Person - Anna Mohammed.md',
  '01-Internal-Clients/Person - Clint Villafana.md',
  '01-Internal-Clients/Person - Sonia Harris.md',
  '01-Internal-Clients/Person - Michelle Grant.md',
  '01-Internal-Clients/Person - Debiena Yearwood.md',
  '01-Internal-Clients/Person - Olivia Rampersad.md',
  '01-Internal-Clients/Person - Rajesh Maharaj.md',
  '01-Internal-Clients/Person - Ivan Saroop.md',
  '01-Internal-Clients/Estructura-corporativa-2026-11-09/person-walvyx-parra.md',
  '01-Internal-Clients/Estructura-corporativa-2026-11-09/person-wazid-baksh.md',
  '02-External-Clients/Country - Trinidad & Tobago.md',
];
