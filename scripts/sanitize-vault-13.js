const fs = require('fs');
const path = require('path');

const files = [
  "01-Internal-Clients/Core - S.M. Jaleel & Co. Ltd..md",
  "01-Internal-Clients/Person - Debiena Yearwood.md",
  "01-Internal-Clients/Person - Humberto Bouche.md",
  "01-Internal-Clients/Person - Michelle Grant.md",
  "01-Internal-Clients/Estructura-corporativa-2026-11-09/group-smj-group.md",
  "01-Internal-Clients/Estructura-corporativa-2026-11-09/organization-guyana-beverages-inc.md",
  "01-Internal-Clients/Estructura-corporativa-2026-11-09/organization-s-m-j-beverages-st-lucia-ltd.md",
  "01-Internal-Clients/Estructura-corporativa-2026-11-09/organization-smj-beverages-barbados-inc.md",
  "01-Internal-Clients/Estructura-corporativa-2026-11-09/organization-smj-beverages-sa-pty-ltd.md",
  "01-Internal-Clients/Estructura-corporativa-2026-11-09/organization-smj-beverages-suriname-n-v.md",
  "01-Internal-Clients/Estructura-corporativa-2026-11-09/organization-smj-beverages-usa-inc.md",
  "01-Internal-Clients/Estructura-corporativa-2026-11-09/person-walvyx-parra.md",
  "01-Internal-Clients/Estructura-corporativa-2026-11-09/person-wazid-baksh.md"
];

const vaultDir = "c:/Users/Usuario/Downloads/SMJaleel/vault";

console.log("Starting sanitization of 13 vault files...");

let processedCount = 0;

for (const f of files) {
  const fullPath = path.join(vaultDir, f);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${fullPath}`);
  }

  const raw = fs.readFileSync(fullPath, 'utf8');
  const targetPattern = /## Corporate evidence batch 2026-11-09/m;
  const match = raw.match(targetPattern);

  if (!match) {
    throw new Error(`Target pattern '## Corporate evidence batch 2026-11-09' not found in: ${f}`);
  }

  const cutIndex = match.index;
  // Truncate cleanly before the heading, trim trailing whitespace, append single \n
  const sanitized = raw.slice(0, cutIndex).trimEnd() + '\n';

  fs.writeFileSync(fullPath, sanitized, 'utf8');

  // Verify write
  const reread = fs.readFileSync(fullPath, 'utf8');
  if (reread.includes("Corporate evidence batch 2026-11-09")) {
    throw new Error(`Sanitization failed for ${f}: batch still present`);
  }
  if (!reread.endsWith('\n') || reread.endsWith('\n\n')) {
    throw new Error(`File does not end with exactly single newline: ${f}`);
  }

  console.log(`[OK] Sanitized: ${f} (${raw.length} bytes -> ${reread.length} bytes)`);
  processedCount++;
}

console.log(`\nSuccessfully sanitized all ${processedCount} of ${files.length} vault files.`);
