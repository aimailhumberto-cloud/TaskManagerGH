/**
 * Reference implementation & test oracle for the Frontend Rendering Shield (F5).
 * Matches the specification in PROJECT.md and survey_explorer_1 architecture report.
 */

const TECHNICAL_AUDIT_HEADERS = [
  'corporate evidence batch',
  'visual sources associated',
  'person and connection audit',
  'source attributes',
  'sources',
  'evidence audit',
];

const DISCLAIMER_PREFIXES = [
  'source package:',
  'sources:',
  'uncorroborated legacy fields',
  'professional contexts are not',
  'verified local bytes against',
  'no legal ownership percentages',
  'historical text and aliases',
];

/**
 * Strips standalone and nested JSON objects from text using balanced bracket counting.
 */
export function stripJsonBlocks(text) {
  if (!text || typeof text !== 'string') return '';
  let result = '';
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inString) {
      if (escape) {
        escape = false;
      } else if (char === '\\') {
        escape = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"' && depth > 0) {
      inString = true;
      continue;
    }

    if (char === '{') {
      depth++;
      continue;
    }

    if (char === '}') {
      if (depth > 0) {
        depth--;
      }
      continue;
    }

    if (depth === 0) {
      result += char;
    }
  }

  return result;
}

/**
 * Filters out technical audit sections and disclaimers line by line.
 */
export function filterTechnicalSections(text) {
  if (!text) return '';
  const lines = text.split(/\r?\n/);
  const cleanLines = [];
  let inExcludedSection = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Check for section header
    if (trimmed.startsWith('#')) {
      const headerTitle = trimmed.replace(/^#+\s*/, '').toLowerCase();
      const isExcluded = TECHNICAL_AUDIT_HEADERS.some(h => headerTitle.includes(h));
      if (isExcluded) {
        inExcludedSection = true;
        continue;
      } else {
        inExcludedSection = false;
      }
    }

    if (inExcludedSection) {
      continue;
    }

    // Check for single-line disclaimers
    const lowerTrimmed = trimmed.toLowerCase();
    const isDisclaimer = DISCLAIMER_PREFIXES.some(p => lowerTrimmed.startsWith(p));
    if (isDisclaimer) {
      continue;
    }

    cleanLines.push(line);
  }

  return cleanLines.join('\n');
}

/**
 * Parses inline wikilinks inside text segments into structured tokens.
 */
export function parseWikilinkTokens(text) {
  const tokens = [];
  const regex = /\[\[(.*?)\]\]/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: 'text', content: text.substring(lastIndex, match.index) });
    }
    const inner = match[1].trim();
    if (!inner) {
      tokens.push({ type: 'text', content: match[0] });
      lastIndex = regex.lastIndex;
      continue;
    }
    if (inner.includes('|')) {
      const [target, alias] = inner.split('|').map(s => s.trim());
      tokens.push({ type: 'wikilink', target, alias: alias || target });
    } else {
      tokens.push({ type: 'wikilink', target: inner, alias: inner });
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    tokens.push({ type: 'text', content: text.substring(lastIndex) });
  }

  return tokens;
}

/**
 * High-level AST generator for rendered executive body.
 */
export function sanitizeAndParseBody(body) {
  if (!body || typeof body !== 'string') return [];
  const textWithoutSections = filterTechnicalSections(body);
  const textWithoutJson = stripJsonBlocks(textWithoutSections);
  const lines = textWithoutJson.split(/\r?\n/);
  const elements = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('## ')) {
      elements.push({
        type: 'h2',
        title: trimmed.replace(/^##\s+/, ''),
        tokens: parseWikilinkTokens(trimmed.replace(/^##\s+/, '')),
      });
    } else if (trimmed.startsWith('### ')) {
      elements.push({
        type: 'h3',
        title: trimmed.replace(/^###\s+/, ''),
        tokens: parseWikilinkTokens(trimmed.replace(/^###\s+/, '')),
      });
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const bulletContent = trimmed.replace(/^[-*]\s+/, '');
      elements.push({
        type: 'bullet',
        content: bulletContent,
        tokens: parseWikilinkTokens(bulletContent),
      });
    } else {
      elements.push({
        type: 'paragraph',
        content: trimmed,
        tokens: parseWikilinkTokens(trimmed),
      });
    }
  }

  return elements;
}
