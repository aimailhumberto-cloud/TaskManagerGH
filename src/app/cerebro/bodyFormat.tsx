// Formato del texto de las fichas (cuerpo de la nota y enlaces).
// Extraído de page.tsx sin cambios de comportamiento.
import React from 'react';

export function formatDisplayValue(val: any): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') {
    if (Array.isArray(val)) {
      return val.map(item => (typeof item === 'object' ? formatDisplayValue(item) : String(item))).join(' · ');
    }
    return Object.entries(val).map(([k, v]) => `${k}: ${v}`).join(' · ');
  }
  return String(val);
}

// Balanced-bracket scanner to strip simple and arbitrarily nested JSON blocks { ... }
export function stripJsonBlocks(text: string): string {
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

export const TECHNICAL_HEADER_REGEX = /^##\s+(?:Corporate evidence batch|Visual sources associated|Person and connection audit|Archivo de roles aprobado|Evidence and limits|Source attributes|Sources|Evidence boundary audit|Evidencia y limites|Fuente y limites|Verified Canada operation|Official catalogue evidence|Additional sourced catalogue|Additional local pickup|Brand identity relation|Logo oficial)/i;

export const FORENSIC_NOISE_LINE_REGEX = /^(?:Source package:|Sources:|No legal ownership percentages|Verified local bytes|Research identity:|Observed 2026-11-09|Uncorroborated legacy fields|Professional contexts are not|No live deployment|Recopilacion SMJ|Solo datos explicitamente transcritos|SHA256)/i;

export function renderInlineWithWikilinks(text: string, onWikilinkClick?: (target: string) => void, resolveLabel?: (target: string) => string) {
  const parts = text.split(/(\[\[.*?\]\])/g);
  return parts.map((part, index) => {
    const match = part.match(/^\[\[(.*?)\]\]$/);
    if (!match) return <React.Fragment key={index}>{part}</React.Fragment>;
    const raw = match[1];
    const [target, alias] = raw.split('|');
    const cleanTarget = target.trim();
    const display = (alias || resolveLabel?.(cleanTarget) || target).trim();

    return (
      <button
        key={index}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (onWikilinkClick) {
            onWikilinkClick(cleanTarget);
          } else if (typeof window !== 'undefined') {
            const globalHandler = (window as any).handleWikilinkClick || (window as any).__cerebroHandleWikilinkClick;
            if (typeof globalHandler === 'function') {
              globalHandler(cleanTarget);
            } else {
              const buttons = Array.from(document.querySelectorAll('button'));
              const cleanLower = cleanTarget.toLowerCase();
              const targetBtn = buttons.find(b => {
                const btnText = b.textContent?.trim().toLowerCase() || '';
                return btnText === `[[${cleanLower}]]` || btnText === cleanLower;
              });
              if (targetBtn && targetBtn !== e.currentTarget) {
                targetBtn.click();
              } else {
                window.dispatchEvent(new CustomEvent('cerebro:wikilink', { detail: cleanTarget }));
              }
            }
          }
        }}
        className="text-sky-300 hover:text-white underline decoration-sky-500/50 hover:decoration-sky-300 font-mono text-[11px] px-1 py-0.5 rounded bg-sky-950/60 border border-sky-800/80 hover:bg-sky-900 transition mx-0.5 inline-flex items-center gap-1 cursor-pointer align-baseline"
        title={`${typeof document !== 'undefined' && document.documentElement.lang === 'en' ? 'Open synapse' : 'Abrir sinapsis'}: ${cleanTarget}`}
      >
        <span>🔗</span>
        <span>[[{display}]]</span>
      </button>
    );
  });
}

export function renderFormattedBody(body: string, onWikilinkClick?: (target: string) => void, resolveLabel?: (target: string) => string) {
  if (!body) return null;

  // Step 1: Strip simple and nested JSON blocks
  const noJson = stripJsonBlocks(body);

  // Step 2: Strip technical sections & forensic noise lines
  const rawLines = noJson.split(/\r?\n/);
  const cleanLines: string[] = [];
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

  return (
    <div className="space-y-1.5 text-xs text-gray-300 leading-relaxed font-sans">
      {displayLines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-1" />;
        if (trimmed.startsWith('# ')) {
          return (
            <h2 key={idx} className="text-sm font-bold text-sky-300 tracking-wide mt-2 mb-1">
              {renderInlineWithWikilinks(trimmed.replace(/^#\s+/, ''), onWikilinkClick, resolveLabel)}
            </h2>
          );
        }
        if (trimmed.startsWith('## ')) {
          return (
            <h3 key={idx} className="text-xs font-bold text-sky-400 uppercase tracking-wider mt-2.5 pt-1 border-t border-gray-800/80">
              {renderInlineWithWikilinks(trimmed.replace(/^##\s+/, ''), onWikilinkClick, resolveLabel)}
            </h3>
          );
        }
        if (trimmed.startsWith('### ')) {
          return (
            <h4 key={idx} className="text-[11px] font-semibold text-emerald-300 mt-2">
              {renderInlineWithWikilinks(trimmed.replace(/^###\s+/, ''), onWikilinkClick, resolveLabel)}
            </h4>
          );
        }
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          return (
            <div key={idx} className="flex items-start gap-1.5 pl-2 text-gray-300">
              <span className="text-sky-400 text-[10px] mt-0.5">•</span>
              <span>{renderInlineWithWikilinks(trimmed.replace(/^[-*]\s+/, ''), onWikilinkClick, resolveLabel)}</span>
            </div>
          );
        }
        return <p key={idx}>{renderInlineWithWikilinks(trimmed, onWikilinkClick, resolveLabel)}</p>;
      })}
    </div>
  );
}

if (typeof globalThis !== 'undefined') {
  (globalThis as any).__renderFormattedBody = renderFormattedBody;
}
