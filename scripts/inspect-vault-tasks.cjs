const fs = require('fs');
const path = require('path');
const YAML = require('yaml');

const vaultDir = 'C:\\Users\\Usuario\\Downloads\\SMJaleel\\vault';

function inspectDir(subDir) {
  const full = path.join(vaultDir, subDir);
  if (!fs.existsSync(full)) return;
  const files = fs.readdirSync(full).filter(f => f.endsWith('.md'));
  console.log(`\n=== Ficheros en ${subDir} (${files.length}) ===`);
  for (const f of files) {
    const content = fs.readFileSync(path.join(full, f), 'utf-8');
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    let fm = {};
    if (match) {
      try { fm = YAML.parse(match[1]) || {}; } catch {}
    }
    console.log(`File: ${f}`);
    console.log(' - Title:', fm.title || f);
    console.log(' - Type:', fm.type);
    if (fm.pending_tasks) console.log(' - Pending Tasks:', fm.pending_tasks);
    if (fm.next_followup_date) console.log(' - Next Followup:', fm.next_followup_date, fm.next_followup_action);
  }
}

inspectDir('00-Working-Memory');
inspectDir('04-Operations-Routines');
inspectDir('02-External-Clients');
