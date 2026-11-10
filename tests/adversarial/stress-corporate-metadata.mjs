import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

const VAULT_DIR = 'c:\\Users\\Usuario\\Downloads\\SMJaleel\\vault';

const CORPORATE_21_FILES = [
  '01-Internal-Clients/Core - S.M. Jaleel & Co. Ltd..md',
  '01-Internal-Clients/Estructura-corporativa-2026-11-09/group-smj-group.md',
  '01-Internal-Clients/Estructura-corporativa-2026-11-09/organization-guyana-beverages-inc.md',
  '01-Internal-Clients/Estructura-corporativa-2026-11-09/organization-s-m-j-beverages-st-lucia-ltd.md',
  '01-Internal-Clients/Estructura-corporativa-2026-11-09/organization-smj-beverages-barbados-inc.md',
  '01-Internal-Clients/Estructura-corporativa-2026-11-09/organization-smj-beverages-sa-pty-ltd.md',
  '01-Internal-Clients/Estructura-corporativa-2026-11-09/organization-smj-beverages-suriname-n-v.md',
  '01-Internal-Clients/Estructura-corporativa-2026-11-09/organization-smj-beverages-usa-inc.md',
  '01-Internal-Clients/Estructura-corporativa-2026-11-09/organization-smj-procurement-marketing-inc.md',
  '01-Internal-Clients/Dept - Manufacturing & Plant Trinidad.md',
  '01-Internal-Clients/Dept - International Exports.md',
  '01-Internal-Clients/Dept - Supply Chain & Procurement.md',
  '01-Internal-Clients/Dept - Finance & Export Credit.md',
  '03-Portfolio-Supply/Brand - Chubby.md',
  '03-Portfolio-Supply/Brand - Busta.md',
  '03-Portfolio-Supply/Brand - Fruta.md',
  '03-Portfolio-Supply/Brand - Oasis.md',
  '03-Portfolio-Supply/Brand - Altitude.md',
  '02-External-Clients/Distributor - SanCas Belize.md',
  '02-External-Clients/Distributor - Walton and Post.md',
  '02-External-Clients/Distributor - Morgan Williams.md',
];

// Build index of all markdown files in vault for wikilink resolution
function buildVaultIndex(dir) {
  const index = new Map(); // normalized name -> relative path
  function walk(current) {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const ent of entries) {
      const full = path.join(current, ent.name);
      if (ent.name.startsWith('.')) continue;
      if (ent.isDirectory()) {
        walk(full);
      } else if (ent.isFile() && ent.name.endsWith('.md')) {
        const basenameNoExt = ent.name.slice(0, -3);
        const rel = path.relative(dir, full);
        index.set(basenameNoExt.toLowerCase(), rel);
        index.set(rel.toLowerCase().replace(/\\/g, '/'), rel);
      }
    }
  }
  walk(dir);
  return index;
}

const vaultIndex = buildVaultIndex(VAULT_DIR);
console.log(`Vault entity index created: ${vaultIndex.size / 2} entities cataloged.\n`);

const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const PHONE_REGEX = /^\+?[0-9\s\-().]{6,25}$/;
const IMAGE_EXT_REGEX = /\.(png|jpe?g|webp|svg|gif)$/i;

function extractWikilinks(text) {
  const links = [];
  const regex = /\[\[(.*?)\]\]/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const raw = match[1].trim();
    if (raw.includes('|')) {
      const [target, alias] = raw.split('|').map(s => s.trim());
      links.push({ raw: match[0], target, alias });
    } else {
      links.push({ raw: match[0], target: raw, alias: raw });
    }
  }
  return links;
}

function findCorruptedWikilinks(text) {
  const corruptions = [];
  // Check unclosed [[ without ]]
  const lines = text.split('\n');
  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    const openCount = (line.match(/\[\[/g) || []).length;
    const closeCount = (line.match(/\]\]/g) || []).length;
    if (openCount !== closeCount) {
      corruptions.push(`Line ${idx + 1}: Unbalanced wikilink delimiters: "${line.trim()}"`);
    }
    // Check nested [[ [[
    if (/\[\[[^\]]*\[\[/.test(line)) {
      corruptions.push(`Line ${idx + 1}: Nested wikilink open delimiter: "${line.trim()}"`);
    }
  }
  return corruptions;
}

let totalErrors = 0;

for (const relPath of CORPORATE_21_FILES) {
  console.log(`Auditing: ${relPath}`);
  const fullPath = path.join(VAULT_DIR, relPath);
  if (!fs.existsSync(fullPath)) {
    console.error(`  [FAIL] File missing: ${fullPath}`);
    totalErrors++;
    continue;
  }

  const raw = fs.readFileSync(fullPath, 'utf-8');
  const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!fmMatch) {
    console.error(`  [FAIL] Frontmatter delimiter missing or malformed`);
    totalErrors++;
    continue;
  }

  const [, frontmatterRaw, body] = fmMatch;
  let fm;
  try {
    fm = YAML.parse(frontmatterRaw);
  } catch (err) {
    console.error(`  [FAIL] Strict YAML parsing error: ${err.message}`);
    totalErrors++;
    continue;
  }

  const errors = [];

  // 1. Status & Identity
  if (fm.completeness_score !== 95) {
    errors.push(`completeness_score must be exactly 95 (got ${fm.completeness_score})`);
  }
  if (fm.is_active !== true) {
    errors.push(`is_active must be true (got ${fm.is_active})`);
  }
  if (!fm.verification_status || typeof fm.verification_status !== 'string') {
    errors.push(`verification_status is null, undefined, or not string`);
  }

  // 2. Live Telemetry
  if (!fm.last_updated_at || typeof fm.last_updated_at !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(fm.last_updated_at)) {
    errors.push(`last_updated_at invalid date format: ${fm.last_updated_at}`);
  }
  if (!fm.last_updated_by || typeof fm.last_updated_by !== 'string') {
    errors.push(`last_updated_by is null/undefined/empty`);
  }
  if (!fm.last_email_subject || typeof fm.last_email_subject !== 'string') {
    errors.push(`last_email_subject is null/undefined/empty`);
  }
  if (!fm.last_email_date || typeof fm.last_email_date !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(fm.last_email_date)) {
    errors.push(`last_email_date invalid date: ${fm.last_email_date}`);
  }
  if (!fm.last_email_sender || typeof fm.last_email_sender !== 'string') {
    errors.push(`last_email_sender is null/undefined/empty`);
  }

  // 3. Upcoming Milestones
  if (!fm.next_followup_date || typeof fm.next_followup_date !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(fm.next_followup_date)) {
    errors.push(`next_followup_date invalid date: ${fm.next_followup_date}`);
  }
  if (!fm.next_followup_action || typeof fm.next_followup_action !== 'string') {
    errors.push(`next_followup_action is null/undefined/empty`);
  }

  // 4. Visuals & Gallery
  if (!Array.isArray(fm.gallery_photos) || fm.gallery_photos.length === 0) {
    errors.push(`gallery_photos is null/empty or not array`);
  } else {
    for (const img of fm.gallery_photos) {
      if (!img || typeof img !== 'string') {
        errors.push(`gallery_photos has null/invalid element`);
      } else if (!IMAGE_EXT_REGEX.test(img)) {
        errors.push(`gallery_photos path missing image extension: ${img}`);
      }
    }
  }
  if (!fm.visual_logo_url || typeof fm.visual_logo_url !== 'string') {
    errors.push(`visual_logo_url is null/undefined/empty`);
  } else if (!IMAGE_EXT_REGEX.test(fm.visual_logo_url)) {
    errors.push(`visual_logo_url missing image extension: ${fm.visual_logo_url}`);
  }

  // 5. Strategic Observations
  if (!fm.executive_observations || typeof fm.executive_observations !== 'string' || fm.executive_observations.trim().length === 0) {
    errors.push(`executive_observations is null/undefined/empty`);
  }

  // 6. Real-time Timeline
  if (!Array.isArray(fm.recent_actions) || fm.recent_actions.length === 0) {
    errors.push(`recent_actions is null/empty or not array`);
  } else {
    for (let i = 0; i < fm.recent_actions.length; i++) {
      const act = fm.recent_actions[i];
      if (!act || typeof act !== 'object') {
        errors.push(`recent_actions[${i}] is not an object`);
      } else {
        if (!act.date || !/^\d{4}-\d{2}-\d{2}/.test(String(act.date))) errors.push(`recent_actions[${i}].date invalid`);
        if (!act.type || typeof act.type !== 'string') errors.push(`recent_actions[${i}].type invalid`);
        if (!act.summary || typeof act.summary !== 'string') errors.push(`recent_actions[${i}].summary invalid`);
      }
    }
  }

  // 7. Operations Checklist
  if (!Array.isArray(fm.pending_tasks) || fm.pending_tasks.length === 0) {
    errors.push(`pending_tasks is null/empty or not array`);
  } else {
    for (let i = 0; i < fm.pending_tasks.length; i++) {
      if (!fm.pending_tasks[i] || typeof fm.pending_tasks[i] !== 'string') {
        errors.push(`pending_tasks[${i}] is null/undefined/empty`);
      }
    }
  }

  // Direct Contacts
  if (!fm.direct_contacts || typeof fm.direct_contacts !== 'object') {
    errors.push(`direct_contacts is null or not an object`);
  } else {
    const { phone, email, whatsapp } = fm.direct_contacts;
    if (!phone || !PHONE_REGEX.test(phone)) {
      errors.push(`direct_contacts.phone is invalid or null: "${phone}"`);
    }
    if (!email || !EMAIL_REGEX.test(email)) {
      errors.push(`direct_contacts.email is invalid or null: "${email}"`);
    }
    if (!whatsapp || !PHONE_REGEX.test(whatsapp)) {
      errors.push(`direct_contacts.whatsapp is invalid or null: "${whatsapp}"`);
    }
  }

  // Corrupted wikilink syntax checks
  const syntaxErrors = findCorruptedWikilinks(raw);
  for (const synErr of syntaxErrors) {
    errors.push(`Syntax Corruption: ${synErr}`);
  }

  // Extract all wikilinks in frontmatter and body
  const allWikilinks = extractWikilinks(raw);
  if (allWikilinks.length === 0) {
    errors.push(`Node has zero wikilinks`);
  }

  const unresolvedWikilinks = [];
  for (const link of allWikilinks) {
    const targetKey = link.target.toLowerCase();
    // Normalize target: remove .md if provided, check if in vault
    const cleanKey = targetKey.endsWith('.md') ? targetKey.slice(0, -3) : targetKey;
    if (!vaultIndex.has(cleanKey)) {
      unresolvedWikilinks.push(link.target);
    }
  }

  if (unresolvedWikilinks.length > 0) {
    errors.push(`Wikilinks target non-existent vault entities: ${unresolvedWikilinks.map(u => `[[${u}]]`).join(', ')}`);
  }

  if (errors.length > 0) {
    console.error(`  [FAIL] ${errors.length} issue(s) detected:`);
    for (const e of errors) {
      console.error(`    - ${e}`);
    }
    totalErrors += errors.length;
  } else {
    console.log(`  [PASS] All 7 categories complete, completeness_score=95, is_active=true, valid gallery/contacts, all ${allWikilinks.length} wikilinks resolved.`);
  }
}

console.log(`\n============================================================`);
console.log(`Corporate Metadata Stress Audit Summary:`);
console.log(`Audited files: ${CORPORATE_21_FILES.length}`);
console.log(`Total errors: ${totalErrors}`);
console.log(`============================================================`);

if (totalErrors > 0) {
  process.exit(1);
} else {
  console.log('SUCCESS: All 21 corporate node files passed 100% strict verification!');
  process.exit(0);
}
