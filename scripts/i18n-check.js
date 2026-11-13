#!/usr/bin/env node
/**
 * Candado de idioma (español / inglés): avisa si una pantalla alcanzable tiene texto fijo en español sin traducir.
 *   1. «sin envolver»: un texto en español escrito directo en pantalla (fuera de T(), t(), L() y de los diccionarios).
 *   2. «sin traducción»: T('texto') o t('texto') cuyo texto no está en ningún diccionario en inglés.
 * Uso: node scripts/i18n-check.js            (solo avisa; sale 0)
 *      node scripts/i18n-check.js --strict   (sale 1 si hay algo fuera del baseline)
 * Lo aceptado a propósito (nombres de idioma, ejemplos de código…) va en scripts/i18n-baseline.json.
 */
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const ts = require(path.join(root, 'node_modules/typescript'));
const strict = process.argv.includes('--strict');
const scope = JSON.parse(fs.readFileSync(path.join(__dirname, 'i18n-scope.json'), 'utf8')).files;
let baseline = []; try { baseline = JSON.parse(fs.readFileSync(path.join(__dirname, 'i18n-baseline.json'), 'utf8')).accepted || []; } catch {}
const ES = /[áéíóúñ¿¡ÁÉÍÓÚÑ]|\b(el|la|los|las|del|que|para|con|sin|por|una|tus|tu|más|mi|mis|aún|hoy|mañana|tareas?|agenda|todo|todas|nuevo|nueva|guardar|cancelar|borrar|buscar|cerrar|ver|abrir|crear|editar|cargando|reunión|reuniones|fecha|hora|persona|personas|ficha|fichas|cerebro|notas?|vence|vencida|pendiente|completar|completada)\b/i;
const IGN = /^(use client|[\w./@:-]+)$/;
const parse = f => { const src = fs.readFileSync(path.join(root, f), 'utf8'); return ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true, f.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS); };

// Diccionarios en inglés: todas las claves (texto en español) de los archivos de traducción.
const dictFiles = []; (function walk(d) { for (const e of fs.readdirSync(path.join(root, d), { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/(^|\/)(en|pagesEn|i18n|[A-Za-z]+I18n)\.ts$/.test(p)) dictFiles.push(p); } })('src');
const keys = new Set();
for (const f of dictFiles) { const visit = n => { if (ts.isPropertyAssignment(n) && (ts.isStringLiteral(n.name) || ts.isNoSubstitutionTemplateLiteral(n.name))) keys.add(n.name.text); ts.forEachChild(n, visit); }; visit(parse(f)); }
const norm = t => t.replace(/\s+/g, ' ').trim();

const wrapped = n => {
  for (let p = n.parent; p; p = p.parent) {
    if (ts.isCallExpression(p)) { const e = p.expression.getText(); if (/^(L|T|t|tr|tw|tasksT)$/.test(e)) return true; if (/^(console\.\w+|fetch|require|import)$/.test(e) || /\.(test|match|replace|includes|startsWith|endsWith|split|querySelector|getItem|setItem|addEventListener|dispatchEvent|has|get|set)$/.test(e)) return true; }
    if (ts.isConditionalExpression(p) && /\blang\b|uiLang|=== 'en'|=== "en"|\.lang\b/.test(p.condition.getText())) return true; // «lang === 'en' ? inglés : español»: ya está en los dos idiomas
    if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p)) return true;
    if (ts.isJsxAttribute(p) && !/^(placeholder|title|aria-label|alt|label|aria-description)$/.test(p.name.getText())) return true;
  }
  return false;
};
const found = []; // [archivo, línea, tipo, texto]
for (const f of scope) {
  if (!fs.existsSync(path.join(root, f))) continue;
  const sf = parse(f); const at = n => sf.getLineAndCharacterOfPosition(n.getStart()).line + 1;
  const add = (n, text, kind) => { const t = norm(text); if (t.length < 3 || IGN.test(t) || !/[A-Za-zÁ-ú]{3}/.test(t) || !ES.test(t)) return; found.push([f, at(n), kind, t.slice(0, 90)]); };
  const visit = n => {
    if (ts.isCallExpression(n) && /^(T|t|tasksT)$/.test(n.expression.getText()) && n.arguments[0] && (ts.isStringLiteral(n.arguments[0]) || ts.isNoSubstitutionTemplateLiteral(n.arguments[0]))) {
      const t = norm(n.arguments[0].text); if (ES.test(t) && !keys.has(n.arguments[0].text) && !keys.has(t)) add(n, t, 'sin traducción');
    } else if (ts.isJsxText(n)) { if (!keys.has(norm(n.getText()))) add(n, n.getText(), 'sin envolver'); }
    else if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) { if (!wrapped(n) && !keys.has(n.text) && !keys.has(norm(n.text))) add(n, n.text, 'sin envolver'); }
    else if (ts.isTemplateExpression(n)) { if (!wrapped(n) && !(n.parent && ts.isCallExpression(n.parent) && /^(T|t|tasksT|L|tr|tw)$/.test(n.parent.expression.getText()))) add(n, n.head.text + ' ' + n.templateSpans.map(s => s.literal.text).join(' '), 'sin envolver'); }
    ts.forEachChild(n, visit);
  };
  visit(sf);
}
const accepted = new Set(baseline.map(b => `${b.file}|${b.text}`));
const fresh = found.filter(([f, , , t]) => !accepted.has(`${f}|${t}`));
const by = {}; for (const [f, l, k, t] of fresh) (by[f] ||= []).push(`  ${l} [${k}] ${t}`);
for (const f of Object.keys(by)) console.log(`${f} (${by[f].length})\n${by[f].join('\n')}`);
console.log(`\ni18n: ${scope.length} archivos revisados · ${keys.size} textos traducidos · ${fresh.length} sin traducir${baseline.length ? ` (${found.length - fresh.length} aceptados a propósito)` : ''}`);
if (process.argv.includes('--write-baseline')) { fs.writeFileSync(path.join(__dirname, 'i18n-baseline.json'), JSON.stringify({ comment: 'Textos en español aceptados a propósito (nombres de idioma, ejemplos de código, lógica interna). Revisar antes de agregar.', accepted: found.map(([file, , , text]) => ({ file, text })) }, null, 1)); console.log('baseline escrito'); }
process.exit(strict && fresh.length ? 1 : 0);
