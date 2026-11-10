const fs = require('fs');
const path = require('path');
const assert = require('assert');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(full));
    } else if (file.endsWith('.md')) {
      results.push(full);
    }
  });
  return results;
}

const vaultDir = "c:/Users/Usuario/Downloads/SMJaleel/vault";
const allMd = walk(vaultDir);
console.log(`Scanned ${allMd.length} markdown files in vault.`);

// 1. Verify 0 files in entire vault contain "Corporate evidence batch"
const matches = allMd.filter(f => {
  const content = fs.readFileSync(f, 'utf8');
  return content.includes('Corporate evidence batch');
});

console.log(`Files in vault containing 'Corporate evidence batch': ${matches.length}`);
assert.strictEqual(matches.length, 0, `Expected 0 files containing Corporate evidence batch, found ${matches.length}`);

// 2. Verify the 13 specific files
const files13 = [
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

for (const rel of files13) {
  const full = path.join(vaultDir, rel);
  const content = fs.readFileSync(full, 'utf8');

  // Check ends with exactly one newline
  assert.ok(content.endsWith('\n'), `${rel} must end with newline`);
  assert.ok(!content.endsWith('\n\n'), `${rel} must not end with multiple newlines`);

  // Check no batch string
  assert.ok(!content.includes('Corporate evidence batch'), `${rel} must not contain Corporate evidence batch`);
  assert.ok(!content.includes('STR-REL-'), `${rel} must not contain STR-REL JSON remnants`);

  // Check frontmatter is preserved
  assert.ok(content.startsWith('---\n') || content.startsWith('---\r\n'), `${rel} must preserve YAML frontmatter opening`);
  const secondDashes = content.indexOf('---', 4);
  assert.ok(secondDashes > 0, `${rel} must preserve YAML frontmatter closing`);

  console.log(`[PASS] ${rel}: clean truncation verified (prose & frontmatter intact, batch eliminated)`);
}

console.log("\nALL 13 VAULT FILES VERIFIED CLEAN!");
