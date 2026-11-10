import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

const VAULT_DIR = 'c:\\Users\\Usuario\\Downloads\\SMJaleel\\vault';

const TARGET_FILES = [
  // Group 1: Corporate Core & Umbrella (2 nodes)
  '01-Internal-Clients/Core - S.M. Jaleel & Co. Ltd..md',
  '01-Internal-Clients/Estructura-corporativa-2026-11-09/group-smj-group.md',

  // Group 2: International Operating Subsidiaries (7 nodes)
  '01-Internal-Clients/Estructura-corporativa-2026-11-09/organization-guyana-beverages-inc.md',
  '01-Internal-Clients/Estructura-corporativa-2026-11-09/organization-s-m-j-beverages-st-lucia-ltd.md',
  '01-Internal-Clients/Estructura-corporativa-2026-11-09/organization-smj-beverages-barbados-inc.md',
  '01-Internal-Clients/Estructura-corporativa-2026-11-09/organization-smj-beverages-sa-pty-ltd.md',
  '01-Internal-Clients/Estructura-corporativa-2026-11-09/organization-smj-beverages-suriname-n-v.md',
  '01-Internal-Clients/Estructura-corporativa-2026-11-09/organization-smj-beverages-usa-inc.md',
  '01-Internal-Clients/Estructura-corporativa-2026-11-09/organization-smj-procurement-marketing-inc.md',

  // Group 3: Core Manufacturing Facilities & Operational Departments (4 nodes)
  '01-Internal-Clients/Dept - Manufacturing & Plant Trinidad.md',
  '01-Internal-Clients/Dept - International Exports.md',
  '01-Internal-Clients/Dept - Supply Chain & Procurement.md',
  '01-Internal-Clients/Dept - Finance & Export Credit.md',

  // Group 4: Primary Corporate Brands (5 nodes)
  '03-Portfolio-Supply/Brand - Chubby.md',
  '03-Portfolio-Supply/Brand - Busta.md',
  '03-Portfolio-Supply/Brand - Fruta.md',
  '03-Portfolio-Supply/Brand - Oasis.md',
  '03-Portfolio-Supply/Brand - Altitude.md',

  // Group 5: Strategic Partner Distributors (3 nodes)
  '02-External-Clients/Distributor - SanCas Belize.md',
  '02-External-Clients/Distributor - Walton and Post.md',
  '02-External-Clients/Distributor - Morgan Williams.md',
];

const DEBRIS_PATTERNS = [
  /##\s*Corporate evidence batch/i,
  /##\s*Visual sources associated/i,
  /##\s*Person and connection audit/i,
  /##\s*Archivo de roles aprobado/i,
  /##\s*Evidence and limits/i,
  /##\s*Source attributes/i,
  /##\s*Sources(\r?\n|$)/i,
  /##\s*Revision documentada/i,
  /##\s*Evidence boundary audit/i,
  /##\s*Official catalogue evidence/i,
  /##\s*Additional sourced catalogue/i,
  /\{[\s\r\n]*"id":\s*"[^"]+"/i,
];

function splitFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { frontmatterRaw: null, body: content };
  return { frontmatterRaw: match[1], body: match[2] };
}

function auditFile(relPath) {
  const fullPath = path.join(VAULT_DIR, relPath);
  const issues = [];

  if (!fs.existsSync(fullPath)) {
    return { relPath, pass: false, issues: ['File does not exist'] };
  }

  const raw = fs.readFileSync(fullPath, 'utf8');
  const { frontmatterRaw, body } = splitFrontmatter(raw);

  if (!frontmatterRaw) {
    return { relPath, pass: false, issues: ['Missing YAML frontmatter block (---)'] };
  }

  let fm;
  try {
    fm = YAML.parse(frontmatterRaw);
  } catch (err) {
    return { relPath, pass: false, issues: [`YAML parse error: ${err.message}`] };
  }

  // 1. Status & Identity
  if (typeof fm.completeness_score !== 'number' || fm.completeness_score < 90) {
    issues.push(`completeness_score must be number >= 90 (got ${fm.completeness_score})`);
  }
  if (fm.is_active !== true) {
    issues.push(`is_active must be boolean true (got ${fm.is_active})`);
  }
  if (!fm.verification_status || typeof fm.verification_status !== 'string') {
    issues.push(`verification_status must be non-empty string`);
  }

  // 2. Live Telemetry
  if (!fm.last_updated_at || typeof fm.last_updated_at !== 'string' || !/\d{4}-\d{2}-\d{2}/.test(fm.last_updated_at)) {
    issues.push(`last_updated_at must be valid date/ISO string (got ${fm.last_updated_at})`);
  }
  if (!fm.last_updated_by || typeof fm.last_updated_by !== 'string') {
    issues.push(`last_updated_by must be non-empty string`);
  }
  if (!fm.last_email_subject || typeof fm.last_email_subject !== 'string') {
    issues.push(`last_email_subject must be non-empty string`);
  }
  if (!fm.last_email_date || typeof fm.last_email_date !== 'string') {
    issues.push(`last_email_date must be non-empty string`);
  }
  if (!fm.last_email_sender || typeof fm.last_email_sender !== 'string') {
    issues.push(`last_email_sender must be non-empty string`);
  }

  // 3. Upcoming Milestones
  if (!fm.next_followup_date || typeof fm.next_followup_date !== 'string') {
    issues.push(`next_followup_date must be non-empty string`);
  }
  if (!fm.next_followup_action || typeof fm.next_followup_action !== 'string') {
    issues.push(`next_followup_action must be non-empty string`);
  }

  // 4. Visuals
  if (!Array.isArray(fm.gallery_photos) || fm.gallery_photos.length < 2) {
    issues.push(`gallery_photos must be array with at least 2 items`);
  } else {
    for (const p of fm.gallery_photos) {
      if (!p || typeof p !== 'string') issues.push(`gallery_photos item must be string`);
    }
  }
  if (!fm.visual_logo_url || typeof fm.visual_logo_url !== 'string') {
    issues.push(`visual_logo_url must be non-empty string`);
  }

  // 5. Strategic Observations
  if (!fm.executive_observations || typeof fm.executive_observations !== 'string' || fm.executive_observations.length < 30) {
    issues.push(`executive_observations must be substantial string >= 30 chars`);
  }

  // 6. Real-time Timeline
  if (!Array.isArray(fm.recent_actions) || fm.recent_actions.length < 2) {
    issues.push(`recent_actions must be array with at least 2 items`);
  } else {
    for (let i = 0; i < fm.recent_actions.length; i++) {
      const a = fm.recent_actions[i];
      if (!a.date || !a.type || !a.summary) {
        issues.push(`recent_actions[${i}] must have non-empty date, type, and summary`);
      }
    }
  }

  // 7. Operations Checklist
  if (!Array.isArray(fm.pending_tasks) || fm.pending_tasks.length < 2) {
    issues.push(`pending_tasks must be array with at least 2 items`);
  } else {
    for (let i = 0; i < fm.pending_tasks.length; i++) {
      if (!fm.pending_tasks[i] || typeof fm.pending_tasks[i] !== 'string') {
        issues.push(`pending_tasks[${i}] must be non-empty string`);
      }
    }
  }

  // 8. Direct Contacts
  if (!fm.direct_contacts || typeof fm.direct_contacts !== 'object') {
    issues.push(`direct_contacts must be an object`);
  } else {
    if (!fm.direct_contacts.phone || typeof fm.direct_contacts.phone !== 'string') {
      issues.push(`direct_contacts.phone must be non-empty string`);
    }
    if (!fm.direct_contacts.email || typeof fm.direct_contacts.email !== 'string') {
      issues.push(`direct_contacts.email must be non-empty string`);
    }
    if (!fm.direct_contacts.whatsapp || typeof fm.direct_contacts.whatsapp !== 'string') {
      issues.push(`direct_contacts.whatsapp must be non-empty string`);
    }
  }

  // Body Structure Validation
  if (!body.trim().startsWith('# ')) {
    issues.push(`Body must start with a level 1 heading '# '`);
  }
  if (!/##\s*Datos/i.test(body)) {
    issues.push(`Body must contain a '## Datos ...' section`);
  }
  if (!/##\s*Conexiones y Relaciones Clave/i.test(body)) {
    issues.push(`Body must contain a '## Conexiones y Relaciones Clave' section`);
  }
  const wikilinks = body.match(/\[\[.*?\]\]/g) || [];
  if (wikilinks.length < 2) {
    issues.push(`Body must contain at least 2 wikilinks [[...]] (found ${wikilinks.length})`);
  }

  // Scraping Debris Check
  for (const pattern of DEBRIS_PATTERNS) {
    if (pattern.test(body)) {
      issues.push(`Body contains residual scraping debris matching pattern: ${pattern.toString()}`);
    }
  }

  return {
    relPath,
    pass: issues.length === 0,
    issues,
  };
}

console.log('=== AUDITING 21 CORPORATE NODES (M2 MILESTONE) ===');
let passCount = 0;
let failCount = 0;

for (const file of TARGET_FILES) {
  const result = auditFile(file);
  if (result.pass) {
    console.log(`[PASS] ${result.relPath}`);
    passCount++;
  } else {
    console.log(`[FAIL] ${result.relPath}`);
    for (const issue of result.issues) {
      console.log(`       - ${issue}`);
    }
    failCount++;
  }
}

console.log(`\nSummary: Total: ${TARGET_FILES.length} | Passed: ${passCount} | Failed: ${failCount}`);
if (failCount > 0) {
  process.exit(1);
} else {
  console.log('ALL 21 CORPORATE NODES MEET MEDIMEX BENCHMARK STANDARD 100%!');
}
