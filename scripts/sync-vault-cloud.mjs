#!/usr/bin/env node
/**
 * SM Jaleel Cloud Vault Synchronizer (versión segura)
 * ----------------------------------------------------
 * Compara el Vault local (Obsidian) con el de Render ANTES de copiar nada.
 *
 *   node scripts/sync-vault-cloud.mjs status           # estado del vault en la nube
 *   node scripts/sync-vault-cloud.mjs diff             # qué cambió de cada lado (no escribe nada)
 *   node scripts/sync-vault-cloud.mjs push [--apply]   # local -> nube
 *   node scripts/sync-vault-cloud.mjs pull [--apply]   # nube -> local
 *
 * Reglas:
 *  - Sin --apply solo muestra lo que haría (simulacro).
 *  - Nunca borra archivos de ningún lado.
 *  - Un archivo que existe en ambos lados con contenido distinto solo se copia si el origen es MÁS NUEVO
 *    (fecha de modificación). Si el destino es más nuevo se reporta como conflicto y se salta; --force lo copia igual.
 *  - Antes de sobrescribir guarda una copia de lo que se va a reemplazar en ./vault-backups/<fecha>/.
 *  - Archivos con encabezado YAML ilegible no se suben.
 */

import fs from 'fs';
import path from 'path';

const CLOUD_URL = (process.env.CLOUD_VAULT_URL || 'https://taskmanagergh.onrender.com').replace(/\/$/, '');
const LOCAL_VAULT = process.env.LOCAL_VAULT_PATH || 'C:\\Users\\Usuario\\Downloads\\SMJaleel\\vault';
const APPLY = process.argv.includes('--apply');
const FORCE = process.argv.includes('--force');
const STAMP = new Date().toISOString().replace(/[:.]/g, '-');
const BACKUP_DIR = path.resolve(process.env.VAULT_BACKUP_DIR || 'vault-backups', STAMP);

function getAllFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  let results = [];
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) results = results.concat(getAllFiles(full));
    else if (item.name.endsWith('.md')) results.push(full);
  }
  return results;
}

function yamlLooksBroken(content) {
  if (!/^\uFEFF?---\s*\r?\n/.test(content)) return false;
  return !/^\uFEFF?---\r?\n[\s\S]*?\r?\n---(\r?\n|$)/.test(content);
}

const norm = (s) => s.replace(/\r\n/g, '\n').trim();

function safeJoin(root, rel) {
  const target = path.resolve(root, rel);
  if (target !== path.resolve(root) && !target.startsWith(path.resolve(root) + path.sep)) {
    throw new Error(`Ruta fuera del vault: ${rel}`);
  }
  return target;
}

function backup(rel, content) {
  const target = safeJoin(BACKUP_DIR, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, 'utf-8');
}

async function fetchCloud() {
  const res = await fetch(`${CLOUD_URL}/api/agent/vault-sync?export=json`);
  const data = await res.json();
  if (!data.ok || !Array.isArray(data.files)) throw new Error('No se pudo exportar desde la nube');
  const map = new Map();
  for (const f of data.files) map.set(f.path.replace(/\\/g, '/'), { content: f.content || '', mtime: new Date(f.mtime).getTime() || 0 });
  return map;
}

function readLocal() {
  const map = new Map();
  for (const file of getAllFiles(LOCAL_VAULT)) {
    const rel = path.relative(LOCAL_VAULT, file).replace(/\\/g, '/');
    map.set(rel, { content: fs.readFileSync(file, 'utf-8'), mtime: fs.statSync(file).mtimeMs, file });
  }
  return map;
}

function compare(local, cloud) {
  const r = { same: 0, localOnly: [], cloudOnly: [], localNewer: [], cloudNewer: [] };
  for (const [rel, l] of local) {
    const c = cloud.get(rel);
    if (!c) { r.localOnly.push(rel); continue; }
    if (norm(l.content) === norm(c.content)) { r.same++; continue; }
    (l.mtime >= c.mtime ? r.localNewer : r.cloudNewer).push(rel);
  }
  for (const rel of cloud.keys()) if (!local.has(rel)) r.cloudOnly.push(rel);
  return r;
}

function list(title, arr) {
  console.log(`\n${title} (${arr.length})`);
  arr.slice(0, 40).forEach((p) => console.log(`   - ${p}`));
  if (arr.length > 40) console.log(`   ... y ${arr.length - 40} más`);
}

async function getStatus() {
  const res = await fetch(`${CLOUD_URL}/api/agent/vault-sync?status=1`);
  console.log('Estado del Vault en la nube:', JSON.stringify(await res.json(), null, 2));
}

async function diff() {
  const [local, cloud] = [readLocal(), await fetchCloud()];
  const r = compare(local, cloud);
  console.log(`Local: ${local.size} archivos | Nube: ${cloud.size} archivos | Iguales: ${r.same}`);
  list('Solo en local (nuevos para la nube)', r.localOnly);
  list('Solo en la nube (nuevos para local)', r.cloudOnly);
  list('Distintos, local más reciente', r.localNewer);
  list('Distintos, nube más reciente', r.cloudNewer);
}

async function pushVault() {
  const [local, cloud] = [readLocal(), await fetchCloud()];
  const r = compare(local, cloud);
  let toSend = [...r.localOnly, ...r.localNewer];
  if (FORCE) toSend = [...toSend, ...r.cloudNewer];
  const broken = toSend.filter((rel) => yamlLooksBroken(local.get(rel).content));
  toSend = toSend.filter((rel) => !broken.includes(rel));

  console.log(`${APPLY ? 'SUBIENDO' : 'SIMULACRO de subida'} ${LOCAL_VAULT} -> ${CLOUD_URL}`);
  list('Se subirán (nuevos)', r.localOnly.filter((p) => toSend.includes(p)));
  list('Se subirán (local más reciente, reemplazan la nube)', r.localNewer.filter((p) => toSend.includes(p)));
  if (!FORCE) list('CONFLICTO: la nube es más reciente, se saltan (usa pull o --force)', r.cloudNewer);
  if (FORCE) list('Forzados (la nube era más reciente)', r.cloudNewer);
  if (broken.length) list('Saltados: encabezado YAML ilegible', broken);
  if (!APPLY) { console.log('\nNo se escribió nada. Agrega --apply para ejecutar.'); return; }
  if (!toSend.length) { console.log('\nNada que subir.'); return; }

  for (const rel of toSend) if (cloud.has(rel)) backup(rel, cloud.get(rel).content);
  if (toSend.some((rel) => cloud.has(rel))) console.log(`\nCopia de lo reemplazado en la nube guardada en ${BACKUP_DIR}`);

  const chunkSize = 50;
  let sent = 0;
  for (let i = 0; i < toSend.length; i += chunkSize) {
    const chunk = toSend.slice(i, i + chunkSize).map((rel) => ({ path: rel, content: local.get(rel).content }));
    const res = await fetch(`${CLOUD_URL}/api/agent/vault-sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'batch_sync', files: chunk }),
    });
    const result = await res.json();
    if (!result.ok) throw new Error(`La nube rechazó el lote: ${JSON.stringify(result)}`);
    sent += chunk.length;
    console.log(`  ${sent}/${toSend.length} archivos... (${result.message || 'OK'})`);
  }
  console.log('Subida completada. Nada fue borrado.');
}

async function pullVault() {
  const [local, cloud] = [readLocal(), await fetchCloud()];
  const r = compare(local, cloud);
  let toWrite = [...r.cloudOnly, ...r.cloudNewer];
  if (FORCE) toWrite = [...toWrite, ...r.localNewer];

  console.log(`${APPLY ? 'DESCARGANDO' : 'SIMULACRO de descarga'} ${CLOUD_URL} -> ${LOCAL_VAULT}`);
  list('Se descargarán (nuevos)', r.cloudOnly);
  list('Se descargarán (nube más reciente, reemplazan local)', r.cloudNewer);
  if (!FORCE) list('CONFLICTO: local es más reciente, se saltan (usa push o --force)', r.localNewer);
  if (!APPLY) { console.log('\nNo se escribió nada. Agrega --apply para ejecutar.'); return; }
  if (!toWrite.length) { console.log('\nNada que descargar.'); return; }

  let written = 0;
  for (const rel of toWrite) {
    const target = safeJoin(LOCAL_VAULT, rel);
    if (local.has(rel)) backup(rel, local.get(rel).content);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, cloud.get(rel).content, 'utf-8');
    written++;
  }
  console.log(`Descarga completada: ${written} archivos. Lo reemplazado quedó en ${BACKUP_DIR}. Nada fue borrado.`);
}

const command = process.argv[2] || 'status';
const run = { push: pushVault, pull: pullVault, diff, status: getStatus }[command];
if (!run) {
  console.error(`Comando desconocido: ${command}. Usa status | diff | push | pull`);
  process.exit(1);
}
run().catch((e) => { console.error('Error:', e.message || e); process.exit(1); });
