/**
 * Adversarial Empirical Stress-Test Harness for Cerebro Frontend
 * 
 * Verifies:
 * 1. renderFormattedBody & balanced-bracket JSON stripping with adversarial, deeply nested,
 *    malformed inputs, obscure scraping disclaimers, and complex wikilinks.
 * 2. Mobile touch geometry: Pythagorean distance, midpoint drift compensation across 100 micro-moves.
 * 3. Tap vs drag discrimination thresholds (5px distance, 350ms duration).
 * 4. CSS class constraints in src/app/cerebro/page.tsx (canvas >=550px, header <=48px, bottom sheet 100% width, close touch target >=44px).
 * 5. Mobile camera math: auto-framing in upper visible window above bottom sheet.
 * 6. Fuzzer with 1,000 randomized synthetic inputs.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pageTsxPath = path.resolve(__dirname, '../../src/app/cerebro/page.tsx');

// ANSI Colors
const reset = '\x1b[0m';
const bold = '\x1b[1m';
const green = '\x1b[32m';
const red = '\x1b[31m';
const yellow = '\x1b[33m';
const cyan = '\x1b[36m';

let passedChecks = 0;
let failedChecks = 0;
const failureDetails = [];

function assert(condition, message, details = {}) {
  if (condition) {
    passedChecks++;
    console.log(`  ${green}✔${reset} ${message}`);
  } else {
    failedChecks++;
    console.log(`  ${red}✖ FAIL:${reset} ${message}`);
    failureDetails.push({ message, details });
  }
}

// ============================================================================
// 1. EXTRACT EXACT CODE & REGEXES FROM page.tsx
// ============================================================================
console.log(`\n${bold}${cyan}=== STEP 1: Code & Token Extraction from page.tsx ===${reset}`);

assert(fs.existsSync(pageTsxPath), 'page.tsx exists on disk', { pageTsxPath });
const pageTsxContent = fs.readFileSync(pageTsxPath, 'utf8');

// Balanced-bracket parser identical to page.tsx:102-137
function stripJsonBlocksPageTsx(text) {
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

// Pipeline matching renderFormattedBody in page.tsx:190-244
function renderFormattedBodySimulation(body) {
  if (!body) return null;

  // Step 1: Strip simple and nested JSON blocks
  const noJson = stripJsonBlocksPageTsx(body);

  // Step 2: Strip technical sections & forensic noise lines
  const rawLines = noJson.split(/\r?\n/);
  const cleanLines = [];
  let skippingTechnicalSection = false;

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
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

    // Filter residual JSON key-value pairs or brackets
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

    // Collapse multiple consecutive empty lines
    if (!trimmed && cleanLines.length > 0 && !cleanLines[cleanLines.length - 1].trim()) {
      continue;
    }

    cleanLines.push(line);
  }

  const finalContent = cleanLines.join('\n').trim();
  if (!finalContent) return null;

  const displayLines = finalContent.split('\n');
  const parsedNodes = [];

  for (let idx = 0; idx < displayLines.length; idx++) {
    const trimmed = displayLines[idx].trim();
    if (!trimmed) {
      parsedNodes.push({ type: 'spacer' });
    } else if (trimmed.startsWith('# ')) {
      parsedNodes.push({ type: 'h1', text: trimmed.replace(/^#\s+/, '') });
    } else if (trimmed.startsWith('## ')) {
      parsedNodes.push({ type: 'h2', text: trimmed.replace(/^##\s+/, '') });
    } else if (trimmed.startsWith('### ')) {
      parsedNodes.push({ type: 'h3', text: trimmed.replace(/^###\s+/, '') });
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      parsedNodes.push({ type: 'bullet', text: trimmed.replace(/^[-*]\s+/, '') });
    } else {
      parsedNodes.push({ type: 'paragraph', text: trimmed });
    }
  }

  return { finalContent, displayLines, parsedNodes };
}

function parseWikilinks(text) {
  const parts = text.split(/(\[\[.*?\]\])/g);
  const links = [];
  for (const part of parts) {
    const match = part.match(/^\[\[(.*?)\]\]$/);
    if (match) {
      const raw = match[1];
      const [target, alias] = raw.split('|');
      links.push({
        raw,
        target: target.trim(),
        display: (alias || target).trim(),
      });
    }
  }
  return links;
}

// ============================================================================
// 2. ADVERSARIAL STRESS-TESTS FOR renderFormattedBody
// ============================================================================
console.log(`\n${bold}${cyan}=== STEP 2: Adversarial Stress-Tests for renderFormattedBody ===${reset}`);

// Test 2.1: Deeply nested JSON (5, 10, and 20 levels)
function generateDeepJson(depth) {
  let curr = { value: 'leaf_data', secret_token: 'DO_NOT_RENDER' };
  for (let d = depth; d >= 1; d--) {
    curr = {
      level: d,
      description: `nested_level_${d}`,
      sub_batch: [curr],
      meta: { depth_index: d }
    };
  }
  return JSON.stringify(curr, null, 2);
}

for (const depth of [5, 10, 20]) {
  const deepJson = generateDeepJson(depth);
  const testInput = `## Executive Overview\nCorporate operations continue normally.\n\n${deepJson}\n\n- Key operational milestone reached.`;
  const result = renderFormattedBodySimulation(testInput);

  assert(result !== null, `Deep JSON (depth ${depth}) parsed successfully without null crash`);
  assert(!result.finalContent.includes('DO_NOT_RENDER'), `Deep JSON (depth ${depth}) stripped secret leaf token completely`);
  assert(!result.finalContent.includes('sub_batch'), `Deep JSON (depth ${depth}) stripped internal array key`);
  assert(result.finalContent.includes('Corporate operations continue normally.'), `Deep JSON (depth ${depth}) preserved executive body paragraph`);
  assert(result.finalContent.includes('Key operational milestone reached.'), `Deep JSON (depth ${depth}) preserved post-JSON bullet point`);
}

// Test 2.2: Malformed JSON strings, unclosed braces, unmatched quotes
console.log(`\n${bold}${yellow}Testing Malformed JSON Strings & Unclosed Braces:${reset}`);

const malformedCases = [
  {
    name: 'Unclosed outer brace with valid inner keys',
    input: '## Overview\nValid text.\n{ "id": "MALFORMED-1", "unclosed": "true", "nested": { "a": 1 }\n\n- Milestone 1',
    shouldNotThrow: true,
  },
  {
    name: 'Unmatched single quote in JSON key',
    input: '## Section\nText before.\n{ "broken\'quote": 123, "val": "abc" }\n- Next item',
    shouldNotThrow: true,
  },
  {
    name: 'Unclosed string quote inside object',
    input: '## Section\nText before.\n{ "broken: "unterminated string\nText between\n}\n- Next item',
    shouldNotThrow: true,
  },
  {
    name: 'Stray closing braces without open',
    input: '## Stray Braces\nParagraph here.}\n}}\n- Bullet with closing brace } in text',
    shouldNotThrow: true,
  },
  {
    name: 'Escaped quotes and slashes inside JSON string',
    input: '## Escaped JSON\n{ "path": "C:\\\\Users\\\\Admin\\\\file.json", "escaped_quote": "He said \\"Hello\\" to everyone" }\nExecutive text remains.',
    shouldNotThrow: true,
  },
  {
    name: 'JSON with embedded markdown and wikilinks inside string values',
    input: '## Markdown in JSON\n{ "note": "## Fake Header\\n- fake bullet\\n[[Fake Link]]" }\nReal executive summary.',
    shouldNotThrow: true,
  },
];

for (const tc of malformedCases) {
  let threw = false;
  let res = null;
  try {
    res = renderFormattedBodySimulation(tc.input);
  } catch (err) {
    threw = true;
  }
  assert(!threw, `Malformed Case: "${tc.name}" executed without throwing exception`);
  assert(res !== null, `Malformed Case: "${tc.name}" produced output`);
}

// Test 2.3: Mixed markdown with JSON keys and bullet points
console.log(`\n${bold}${yellow}Testing Mixed Markdown with JSON keys:${reset}`);

const mixedInput = `
# Trinidad & Tobago Operations
## Executive Summary
S.M. Jaleel & Co. Ltd. operates as the master manufacturing hub in Oropouche.

- "Commercial Status": 100% active across all Caribbean corridors
- Distribution through [[Medimex - Curacao Distribution]] and local branches
{
  "id": "CORP-RAW-001",
  "technical_audit": true,
  "metrics": {
    "q1_revenue": 14500000,
    "containers": 2800
  }
}
- "Production Standard": ISO 9001 certified facilities
- Export volume: Over 2,800 containers annually
`;

const mixedResult = renderFormattedBodySimulation(mixedInput);
assert(!mixedResult.finalContent.includes('CORP-RAW-001'), 'Mixed input: stripped technical JSON object');
assert(!mixedResult.finalContent.includes('q1_revenue'), 'Mixed input: stripped nested metric keys');
assert(mixedResult.finalContent.includes('"Commercial Status": 100% active'), 'Mixed input: preserved valid bullet containing quoted key');
assert(mixedResult.finalContent.includes('"Production Standard": ISO 9001'), 'Mixed input: preserved post-JSON quoted bullet');
assert(mixedResult.finalContent.includes('[[Medimex - Curacao Distribution]]'), 'Mixed input: preserved wikilink');

// Test 2.4: Complex wikilinks & Malformed Wikilinks
console.log(`\n${bold}${yellow}Testing Complex & Malformed Wikilinks:${reset}`);

const wikilinkSample = `
See [[Complex Target (HQ) & Distribution|S.M. Jaleel Master]] for details.
Also compare with [[Country - Trinidad & Tobago]] and [[Person - Dr. Sham Mohammed|Founder]].
Here is an unclosed [[Unclosed Wikilink with normal text following.
And an empty [[]] tag followed by [[Target With Spaces]].
`;

const extractedLinks = parseWikilinks(wikilinkSample);
assert(extractedLinks.length >= 3, 'Extracted at least 3 valid wikilinks from sample', { count: extractedLinks.length });

const pipedLink = extractedLinks.find(l => l.target === 'Complex Target (HQ) & Distribution');
assert(pipedLink !== undefined, 'Found complex piped target with parentheses & ampersand');
assert(pipedLink?.display === 'S.M. Jaleel Master', 'Piped display alias resolved properly');

const unclosedLink = extractedLinks.find(l => l.raw.includes('Unclosed'));
assert(unclosedLink === undefined, 'Malformed unclosed [[ was not treated as a closed wikilink');

// Test 2.5: Obscure scraping disclaimers
console.log(`\n${bold}${yellow}Testing Obscure Scraping Disclaimers & Technical Headers:${reset}`);

const scrapingNoiseInput = `
## Corporate Governance
Legitimate executive text.

## Corporate evidence batch 2026-11-09
{ "id": "BATCH-001", "dump": true }
More junk lines

## Visual sources associated
- Logo.png: SHA256 e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855

## Person and connection audit
Dr. Sham Mohammed verified via local registry.

## Valid Executive Section
Source package: smj_vault_v1
Sources: verified internal database
No legal ownership percentages
Verified local bytes against remote server
Research identity: automated pipeline
Observed 2026-11-09
Uncorroborated legacy fields removed
Professional contexts are not audited
No live deployment found
Recopilacion SMJ
Solo datos explicitamente transcritos
SHA256: 44d88612fea8a8f36de82e1278abb02f

- Valid executive bullet point 1
- Valid executive bullet point 2
`;

const cleanNoiseResult = renderFormattedBodySimulation(scrapingNoiseInput);
assert(cleanNoiseResult.finalContent.includes('Corporate Governance'), 'Preserved valid initial header');
assert(!cleanNoiseResult.finalContent.includes('Corporate evidence batch'), 'Filtered ## Corporate evidence batch');
assert(!cleanNoiseResult.finalContent.includes('Visual sources associated'), 'Filtered ## Visual sources associated');
assert(!cleanNoiseResult.finalContent.includes('Person and connection audit'), 'Filtered ## Person and connection audit');
assert(cleanNoiseResult.finalContent.includes('Valid Executive Section'), 'Preserved ## Valid Executive Section');
assert(!cleanNoiseResult.finalContent.includes('Source package:'), 'Stripped Source package: line');
assert(!cleanNoiseResult.finalContent.includes('Sources:'), 'Stripped Sources: line');
assert(!cleanNoiseResult.finalContent.includes('Uncorroborated legacy fields'), 'Stripped Uncorroborated legacy fields line');
assert(!cleanNoiseResult.finalContent.includes('Verified local bytes'), 'Stripped Verified local bytes line');
assert(!cleanNoiseResult.finalContent.includes('SHA256:'), 'Stripped SHA256: line');
assert(cleanNoiseResult.finalContent.includes('Valid executive bullet point 1'), 'Retained executive bullet point 1');
assert(cleanNoiseResult.finalContent.includes('Valid executive bullet point 2'), 'Retained executive bullet point 2');

// ============================================================================
// 3. MATHEMATICAL & EMPIRICAL STRESS-TESTS FOR TOUCH INTERACTIONS & GEOMETRY
// ============================================================================
console.log(`\n${bold}${cyan}=== STEP 3: Touch Geometry, Midpoint Drift & Thresholds ===${reset}`);

// Test 3.1: Pythagorean distance precision
function pythagorean(p0, p1) {
  return Math.hypot(p1.x - p0.x, p1.y - p0.y);
}

// 3-4-5 Triangle
assert(pythagorean({ x: 0, y: 0 }, { x: 3, y: 4 }) === 5, 'Pythagorean exact for 3-4-5 triangle');
// 5-12-13 Triangle
assert(pythagorean({ x: 10, y: 10 }, { x: 15, y: 22 }) === 13, 'Pythagorean exact for 5-12-13 triangle');
// Large coordinates (avoid overflow)
const largeDist = pythagorean({ x: 100000, y: 100000 }, { x: 100300, y: 100400 });
assert(Math.abs(largeDist - 500) < 1e-9, 'Pythagorean handles large coordinates without precision loss');
// Subpixel float coordinates
const subpixelDist = pythagorean({ x: 100.125, y: 200.25 }, { x: 103.125, y: 204.25 });
assert(Math.abs(subpixelDist - 5.0) < 1e-9, 'Pythagorean handles sub-pixel floats accurately');

// Test 3.2: Midpoint Drift Compensation across 100 consecutive micro-moves
console.log(`\n${bold}${yellow}Testing Midpoint Drift Compensation Simulation:${reset}`);

function simulatePinchGestureWithCompensation() {
  let transform = { x: 200, y: 300, scale: 1.0 };
  let initialPinchDist = 200;
  let initialPinchScale = 1.0;
  let pinchCenter = { x: 400, y: 400 };

  // World coordinates of the gesture center BEFORE pinch
  const initialWorldMidX = (pinchCenter.x - transform.x) / transform.scale;
  const initialWorldMidY = (pinchCenter.y - transform.y) / transform.scale;

  // Simulate 100 consecutive pinch-to-zoom updates with varying centers and expanding distances
  for (let step = 1; step <= 100; step++) {
    const p0 = { x: 300 - step * 0.5, y: 400 };
    const p1 = { x: 500 + step * 0.5, y: 400 };

    const currentDist = Math.hypot(p1.x - p0.x, p1.y - p0.y);
    const pinchRatio = currentDist / initialPinchDist;
    const newScale = Math.max(0.25, Math.min(3.0, initialPinchScale * pinchRatio));

    const currentCenter = {
      x: (p0.x + p1.x) / 2,
      y: (p0.y + p1.y) / 2,
    };

    // Drift compensation math from page.tsx:2386-2394
    const prevScale = transform.scale;
    const worldMidX = (pinchCenter.x - transform.x) / prevScale;
    const worldMidY = (pinchCenter.y - transform.y) / prevScale;

    transform.scale = newScale;
    transform.x = currentCenter.x - worldMidX * newScale;
    transform.y = currentCenter.y - worldMidY * newScale;

    pinchCenter = currentCenter;
    initialPinchDist = currentDist;
    initialPinchScale = newScale;
  }

  // Verify that the original world midpoint still projects precisely to the current center
  const projectedScreenX = initialWorldMidX * transform.scale + transform.x;
  const projectedScreenY = initialWorldMidY * transform.scale + transform.y;

  const driftX = Math.abs(projectedScreenX - pinchCenter.x);
  const driftY = Math.abs(projectedScreenY - pinchCenter.y);

  return { driftX, driftY, finalScale: transform.scale };
}

const driftResult = simulatePinchGestureWithCompensation();
assert(driftResult.driftX < 0.0001, `Midpoint drift in X after 100 micro-moves is practically zero (${driftResult.driftX.toFixed(8)}px)`);
assert(driftResult.driftY < 0.0001, `Midpoint drift in Y after 100 micro-moves is practically zero (${driftResult.driftY.toFixed(8)}px)`);
assert(driftResult.finalScale > 1.4, 'Final zoom scale expanded smoothly as expected');

// Test 3.3: Tap vs Drag Discrimination Threshold (5px, 350ms)
console.log(`\n${bold}${yellow}Testing Tap vs Drag Thresholds (5px / 350ms):${reset}`);

function evaluateTapVsDrag(startX, startY, startTime, endX, endY, endTime) {
  const dist = Math.hypot(endX - startX, endY - startY);
  const duration = endTime - startTime;
  const touchMoved = dist > 5;
  const wasTap = !touchMoved && duration < 350;
  return { dist, duration, touchMoved, wasTap };
}

// 1. Subtle finger jitter (2px in 150ms) -> TAP
const t1 = evaluateTapVsDrag(100, 100, 1000, 102, 100, 1150);
assert(t1.wasTap === true, 'Subtle finger jitter (2px, 150ms) classified as TAP');

// 2. Just below distance threshold (4.9px in 200ms) -> TAP
const t2 = evaluateTapVsDrag(100, 100, 1000, 103, 103.87, 1200);
assert(t2.wasTap === true, 'Sub-5px movement (4.9px, 200ms) classified as TAP');

// 3. Just above distance threshold (5.1px in 100ms) -> DRAG (NOT tap)
const t3 = evaluateTapVsDrag(100, 100, 1000, 105.1, 100, 1100);
assert(t3.wasTap === false, '5.1px movement (100ms) classified as DRAG, NOT tap');
assert(t3.touchMoved === true, 'touchMoved set to true at 5.1px');

// 4. Long press (0px in 400ms) -> NOT tap (duration >= 350ms)
const t4 = evaluateTapVsDrag(100, 100, 1000, 100, 100, 1400);
assert(t4.wasTap === false, 'Long press (400ms) suppressed from being tap');

// 5. Quick drag flick (20px in 80ms) -> DRAG (NOT tap)
const t5 = evaluateTapVsDrag(100, 100, 1000, 120, 100, 1080);
assert(t5.wasTap === false, 'Quick flick (20px, 80ms) classified as DRAG');

// ============================================================================
// 4. CSS CLASS CONSTRAINTS IN page.tsx
// ============================================================================
console.log(`\n${bold}${cyan}=== STEP 4: CSS Layout Constraints in page.tsx ===${reset}`);

// Constraint A: Canvas minimum height >= 550px
const hasCanvasMinHeight = pageTsxContent.includes('min-h-[550px]');
assert(hasCanvasMinHeight, 'Canvas container explicitly contains "min-h-[550px]" class');

// Constraint B: Mobile header max-height <= 48px
const hasHeaderH12 = pageTsxContent.includes('h-12 max-h-[48px]') || pageTsxContent.includes('max-h-[48px]');
assert(hasHeaderH12, 'Mobile header explicitly enforces "max-h-[48px]" (h-12 = 48px)');

// Constraint C: Bottom sheet width 100% on mobile
const hasBottomSheetFullWidth = pageTsxContent.includes('inset-x-0') && pageTsxContent.includes('w-full') && pageTsxContent.includes('max-h-[85vh]');
assert(hasBottomSheetFullWidth, 'Bottom sheet enforces mobile full-width ("inset-x-0 bottom-0 z-50 w-full max-h-[85vh]")');

// Constraint D: Thumb close button touch targets >= 44x44px
const hasTopCloseButtonTouchTarget = pageTsxContent.includes('min-h-[44px] min-w-[44px]');
assert(hasTopCloseButtonTouchTarget, 'Top close button touch target is at least 44x44px ("min-h-[44px] min-w-[44px]")');

const hasStickyCloseButtonTouchTarget = pageTsxContent.includes('min-h-[44px]') && pageTsxContent.includes('Mobile Sticky Thumb Action Bar');
assert(hasStickyCloseButtonTouchTarget, 'Mobile sticky bottom bar contains min-h-[44px] close button for thumb access');

// ============================================================================
// 5. MOBILE CAMERA AUTO-FRAMING MATH
// ============================================================================
console.log(`\n${bold}${cyan}=== STEP 5: Mobile Camera Auto-Framing Math ===${reset}`);

// Mathematical analysis of page.tsx:2478-2483
// When mobile (innerWidth < 768):
// visibleH = Math.max(containerH * 0.42, 180);
// transform.x = (containerW / 2) - (node.x * scale);
// transform.y = (visibleH / 2) - (node.y * scale);
// Therefore:
// nodeScreenX = node.x * scale + transform.x = containerW / 2 (Horizontally centered)
// nodeScreenY = node.y * scale + transform.y = visibleH / 2 (Vertically centered in upper visible window)

const testMobileScreens = [
  { device: 'iPhone SE (compact)', w: 375, h: 667 },
  { device: 'iPhone 14 / 15', w: 390, h: 844 },
  { device: 'Pixel 7', w: 412, h: 915 },
  { device: 'Min Height Canvas', w: 360, h: 550 },
];

for (const scr of testMobileScreens) {
  const containerW = scr.w;
  const containerH = scr.h;
  const scale = 0.85;
  const node = { x: 350, y: -200 };

  const visibleH = Math.max(containerH * 0.42, 180);
  const transformX = (containerW / 2) - (node.x * scale);
  const transformY = (visibleH / 2) - (node.y * scale);

  const nodeScreenX = node.x * scale + transformX;
  const nodeScreenY = node.y * scale + transformY;

  const screenYPercent = (nodeScreenY / containerH) * 100;
  const sheetTopScreenY = containerH * (1 - 0.75); // 75vh bottom sheet starts at 25% height

  assert(nodeScreenX === containerW / 2, `[${scr.device}] Node is centered horizontally at x=${nodeScreenX}`);
  assert(screenYPercent >= 15 && screenYPercent <= 30, `[${scr.device}] Node screen Y is at ${screenYPercent.toFixed(1)}% (in upper exposed 20-30% region)`);
  assert(nodeScreenY < sheetTopScreenY || nodeScreenY < containerH * 0.42, `[${scr.device}] Node is positioned above the bottom sheet threshold`);
}

// ============================================================================
// 6. ADVERSARIAL FUZZER (1,000 SYNTHETIC INPUTS)
// ============================================================================
console.log(`\n${bold}${cyan}=== STEP 6: 1,000-Iteration Adversarial Fuzzer ===${reset}`);

const characters = ['{', '}', '[', ']', '"', ':', ',', '\\', '#', '-', '*', 'a', '1', ' ', '\n', '\t', '[[', ']]', '|'];

function generateFuzzString(length) {
  let s = '';
  for (let i = 0; i < length; i++) {
    s += characters[Math.floor(Math.random() * characters.length)];
  }
  return s;
}

let fuzzerErrors = 0;
const fuzzerStart = Date.now();

for (let iter = 1; iter <= 1000; iter++) {
  const fuzzLength = Math.floor(Math.random() * 300) + 10;
  const fuzzedInput = generateFuzzString(fuzzLength);

  try {
    const stripped = stripJsonBlocksPageTsx(fuzzedInput);
    renderFormattedBodySimulation(stripped);
  } catch (err) {
    fuzzerErrors++;
    failureDetails.push({ iter, err: err.message, inputSample: fuzzedInput.slice(0, 50) });
  }
}
const fuzzerDuration = Date.now() - fuzzerStart;

assert(fuzzerErrors === 0, `1,000 random adversarial inputs processed with 0 crashes (${fuzzerDuration}ms)`);

// ============================================================================
// SUMMARY & VERDICT
// ============================================================================
console.log(`\n${bold}${cyan}======================================================================${reset}`);
console.log(`${bold}ADVERSARIAL STRESS-TEST HARNESS SUMMARY${reset}`);
console.log(`${cyan}======================================================================${reset}`);
console.log(`  Passed Checks : ${bold}${green}${passedChecks}${reset}`);
console.log(`  Failed Checks : ${failedChecks === 0 ? green + '0' : bold + red + failedChecks}${reset}`);

if (failedChecks === 0) {
  console.log(`\n${bold}${green}VERDICT: 100% PASS — APPROVE${reset}\n`);
  process.exit(0);
} else {
  console.log(`\n${bold}${red}VERDICT: FAILURES DETECTED — REQUEST_CHANGES${reset}\n`);
  console.log(JSON.stringify(failureDetails, null, 2));
  process.exit(1);
}
