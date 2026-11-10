const fs = require('fs');
const assert = require('assert');

// Scanner function
function stripJsonBlocks(text) {
  let result = '';
  let i = 0;
  while (i < text.length) {
    if (text[i] === '{') {
      let depth = 1;
      let j = i + 1;
      let inString = false;
      let escape = false;
      while (j < text.length && depth > 0) {
        const char = text[j];
        if (escape) {
          escape = false;
        } else if (char === '\\') {
          escape = true;
        } else if (char === '"') {
          inString = !inString;
        } else if (!inString) {
          if (char === '{') depth++;
          else if (char === '}') depth--;
        }
        j++;
      }
      if (depth === 0) {
        const candidate = text.slice(i, j);
        if (candidate.includes('"') && (candidate.includes(':') || candidate.includes('id'))) {
          i = j;
          continue;
        }
      }
    }
    result += text[i];
    i++;
  }
  return result;
}

const TECHNICAL_HEADER_REGEX = /^##\s+(?:Corporate evidence batch|Visual sources associated|Person and connection audit|Archivo de roles aprobado|Evidence and limits|Source attributes|Sources|Evidence boundary audit|Evidencia y limites|Fuente y limites|Verified Canada operation|Official catalogue evidence|Additional sourced catalogue|Additional local pickup|Brand identity relation|Logo oficial)/i;

const FORENSIC_NOISE_LINE_REGEX = /^(?:Source package:|Sources:|No legal ownership percentages|Verified local bytes|Research identity:|Observed 2026-11-09|Uncorroborated legacy fields|Professional contexts are not|No live deployment|Recopilacion SMJ|Solo datos explicitamente transcritos|SHA256)/i;

function cleanBody(body) {
  if (!body) return '';

  const noJson = stripJsonBlocks(body);
  const lines = noJson.split(/\r?\n/);
  const cleanLines = [];
  let skippingTechnicalSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('## ') || trimmed.startsWith('# ')) {
      if (TECHNICAL_HEADER_REGEX.test(trimmed)) {
        skippingTechnicalSection = true;
        continue;
      } else {
        skippingTechnicalSection = false;
      }
    }

    if (skippingTechnicalSection || FORENSIC_NOISE_LINE_REGEX.test(trimmed)) {
      continue;
    }

    if (
      /^"[a-zA-Z0-9_-]+":\s*/.test(trimmed) ||
      trimmed === '{' ||
      trimmed === '}' ||
      trimmed === '},' ||
      trimmed === ',' ||
      trimmed === ']' ||
      trimmed === '],' ||
      /^"[^"]+",?$/.test(trimmed)
    ) {
      continue;
    }

    cleanLines.push(line);
  }

  return cleanLines.join('\n').trim();
}

function parseWikilinks(text) {
  const parts = text.split(/(\[\[.*?\]\])/g);
  return parts.map(part => {
    const match = part.match(/^\[\[(.*?)\]\]$/);
    if (!match) return { type: 'text', content: part };
    const raw = match[1];
    const [target, alias] = raw.split('|');
    return {
      type: 'wikilink',
      target: target.trim(),
      display: (alias || target).trim()
    };
  });
}

// TESTS
console.log('--- Test 1: Nested JSON stripping ---');
const sampleNested = `
# Executive Title
Some executive prose before.

{
  "id": "STR-REL-001",
  "source_references": [
    {
      "id": "PUB-CAREERS",
      "location": "https://www.smjaleel.net/careers-at-smj/"
    }
  ],
  "notes": "Testing nested braces { and } here"
}

Some executive prose after with [[Market - Panama|Panamá]].
`;
const stripped1 = cleanBody(sampleNested);
console.log('Result 1:\n' + stripped1);
assert(!stripped1.includes('STR-REL-001'), 'Should not contain STR-REL-001');
assert(!stripped1.includes('PUB-CAREERS'), 'Should not contain PUB-CAREERS');
assert(stripped1.includes('Some executive prose before.'), 'Should retain prose before');
assert(stripped1.includes('Some executive prose after with [[Market - Panama|Panamá]].'), 'Should retain prose after');

console.log('--- Test 2: Technical header suppression ---');
const sampleHeaders = `
## Misión de Exportaciones
Abastecer a más de 60 mercados internacionales.

## Corporate evidence batch 2026-11-09
Source package: C:\\test
{ "id": "TEST-1" }

## Visual sources associated 2026-11-09
Verified local bytes against manifest...

## Conexiones y Relaciones Clave
- Casa Matriz: [[Core - S.M. Jaleel & Co. Ltd.]]
`;
const stripped2 = cleanBody(sampleHeaders);
console.log('Result 2:\n' + stripped2);
assert(stripped2.includes('Misión de Exportaciones'), 'Retains Misión');
assert(stripped2.includes('Abastecer a más de 60 mercados internacionales.'), 'Retains content');
assert(!stripped2.includes('Corporate evidence batch'), 'Suppresses Corporate evidence batch');
assert(!stripped2.includes('Visual sources associated'), 'Suppresses Visual sources associated');
assert(!stripped2.includes('Source package:'), 'Suppresses Source package');
assert(!stripped2.includes('TEST-1'), 'Suppresses JSON inside section');
assert(stripped2.includes('Conexiones y Relaciones Clave'), 'Retains Conexiones');
assert(stripped2.includes('[[Core - S.M. Jaleel & Co. Ltd.]]'), 'Retains wikilink');

console.log('--- Test 3: Wikilink Parsing ---');
const wlParts = parseWikilinks('Casa Matriz: [[Core - S.M. Jaleel & Co. Ltd.]] y filial [[Market - Panama|Panamá]].');
console.log('Result 3:', JSON.stringify(wlParts));
assert.strictEqual(wlParts.length, 5);
assert.strictEqual(wlParts[1].type, 'wikilink');
assert.strictEqual(wlParts[1].target, 'Core - S.M. Jaleel & Co. Ltd.');
assert.strictEqual(wlParts[1].display, 'Core - S.M. Jaleel & Co. Ltd.');
assert.strictEqual(wlParts[3].type, 'wikilink');
assert.strictEqual(wlParts[3].target, 'Market - Panama');
assert.strictEqual(wlParts[3].display, 'Panamá');

console.log('ALL UNIT CHECKS PASSED SUCCESSFULLY!');
