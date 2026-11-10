const fs = require('fs');
const path = require('path');
const YAML = require('yaml');

const vaultDir = path.join(__dirname, '..', 'vault');

function parseFrontmatterAndBody(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: content };
  try {
    const parsed = YAML.parse(match[1]);
    return { frontmatter: parsed || {}, body: match[2].trim() };
  } catch {
    return { frontmatter: {}, body: content };
  }
}

function testAskDots() {
  const targetFile = path.join(vaultDir, '02-External-Clients', 'Distributor - MEDIMEX.md');
  const raw = fs.readFileSync(targetFile, 'utf-8');
  const { frontmatter, body } = parseFrontmatterAndBody(raw);
  
  console.log('Original recent_actions length:', frontmatter.recent_actions?.length);
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  
  // Create WM
  const wmDir = path.join(vaultDir, '00-Working-Memory');
  const wmId = `wm-${dateStr.replace(/-/g, '')}-${Date.now().toString().slice(-4)}`;
  const wmFilename = `${wmId} - Instruccion DOTS - Seguimiento MEDIMEX.md`;
  const wmContent = `---
id: ${wmId}
title: "Instrucción DOTS: Validar estatus de registro sanitario MEDIMEX"
type: working_memory
memory_tier: working
status: in_review_dots
requested_by: "Chairman / Executive"
target_node: "[[Distributor - MEDIMEX]]"
captured_at: "${now.toISOString()}"
instruction: "Por favor redactar correo formal a MEDIMEX solicitando actualización del registro sanitario ante APA/MINSA en Panamá."
relations:
  touches:
    - "[[Distributor - MEDIMEX]]"
    - "[[Market - Panama]]"
---

# Instrucción a DOTS: Validar estatus de registro sanitario MEDIMEX

**Instrucción Ejecutiva:**
Por favor redactar correo formal a MEDIMEX solicitando actualización del registro sanitario ante APA/MINSA en Panamá.
`;

  console.log('WM generated properly, length:', wmContent.length);
}

testAskDots();
