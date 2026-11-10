import fs from 'node:fs';
import path from 'node:path';

const sourceVault = 'c:\\Users\\Usuario\\Downloads\\SMJaleel\\vault';
const mirrorVault = 'C:\\Users\\Usuario\\.gemini\\antigravity\\scratch\\hermes-task-dashboard\\vault';

function scanDir(dir) {
  let results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.name.startsWith('.')) continue;
    if (ent.isDirectory()) {
      results = results.concat(scanDir(full));
    } else if (ent.isFile() && ent.name.endsWith('.md')) {
      results.push(full);
    }
  }
  return results;
}

const sourceFiles = scanDir(sourceVault);
const mirrorFiles = scanDir(mirrorVault);

console.log(`Source Vault: scanned ${sourceFiles.length} files in ${sourceVault}`);
console.log(`Mirror Vault: scanned ${mirrorFiles.length} files in ${mirrorVault}`);

const FORBIDDEN_PATTERNS = [
  { name: 'Corporate evidence batch', regex: /##\s*Corporate evidence batch/i },
  { name: 'STR-REL-*', regex: /STR-REL-[A-Za-z0-9_-]+/i },
  { name: 'JSON evidence dump', regex: /\{\s*"id":\s*"STR-REL-[^"]+"/i },
  { name: 'Raw scraping evidence section', regex: /##\s*Evidence and limits/i },
  { name: 'Residual source attributes', regex: /##\s*Source attributes/i }
];

let violations = [];

function checkFiles(vaultLabel, files) {
  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf-8');
    for (const pat of FORBIDDEN_PATTERNS) {
      if (pat.regex.test(content)) {
        violations.push({
          vault: vaultLabel,
          file: path.relative(vaultLabel === 'source' ? sourceVault : mirrorVault, filePath),
          pattern: pat.name
        });
      }
    }
  }
}

checkFiles('source', sourceFiles);
checkFiles('mirror', mirrorFiles);

console.log(`\nScan results:`);
console.log(`Total violations found: ${violations.length}`);

if (violations.length > 0) {
  console.error('VIOLATIONS FOUND:');
  for (const v of violations) {
    console.error(`- [${v.vault}] ${v.file}: matched ${v.pattern}`);
  }
  process.exit(1);
} else {
  console.log('SUCCESS: All files verified clean of all forbidden patterns across both source and mirror vaults!');
  process.exit(0);
}
