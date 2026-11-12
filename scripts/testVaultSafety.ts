/**
 * Pruebas mínimas de seguridad del vault: respaldo y escritura segura.
 * Correr con: npm run test:vault
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createVaultSnapshot, ensureDailySnapshot, listVaultSnapshots, getBackupRoot, MAX_SNAPSHOTS } from '../src/lib/vaultBackup';
import { parseNoteStrict, serializeNote, updateNoteFile, atomicWriteFile } from '../src/lib/vaultFiles';

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ok  ${name}`);
}
function freshVault(): string {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'vault-test-'));
  const vault = path.join(base, 'vault');
  fs.mkdirSync(path.join(vault, '00-Working-Memory'), { recursive: true });
  fs.writeFileSync(path.join(vault, 'Nota A.md'), '---\nid: a\ntitle: Nota A\n---\n# Nota A\n\nCuerpo.\n');
  fs.writeFileSync(path.join(vault, '00-Working-Memory', 'wm.md'), '---\nid: wm\nstatus: working\n---\nTexto\n');
  return vault;
}

console.log('Respaldo del vault');
test('la foto manual copia todos los archivos y deja manifiesto', () => {
  const vault = freshVault();
  const res = createVaultSnapshot(vault, 'manual');
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.equal(res.snapshot.files, 2);
  const dir = path.join(getBackupRoot(vault), res.snapshot.name);
  assert.equal(fs.readFileSync(path.join(dir, 'vault', 'Nota A.md'), 'utf8').includes('Cuerpo.'), true);
  assert.equal(fs.existsSync(path.join(dir, 'vault', '00-Working-Memory', 'wm.md')), true);
  assert.equal(listVaultSnapshots(vault).length, 1);
});
test('la foto queda fuera del vault (no se respalda a sí misma)', () => {
  const vault = freshVault();
  createVaultSnapshot(vault, 'manual');
  assert.equal(getBackupRoot(vault).startsWith(vault + path.sep), false);
  const second = createVaultSnapshot(vault, 'manual', new Date(Date.now() + 2000));
  assert.equal(second.ok && second.snapshot.files, 2);
});
test('la foto diaria se crea una sola vez por día', () => {
  const vault = freshVault();
  const day1 = new Date('2026-11-12T15:00:00Z');
  assert.equal(ensureDailySnapshot(vault, day1).created, true);
  assert.equal(ensureDailySnapshot(vault, new Date('2026-11-12T20:00:00Z')).created, false);
  assert.equal(listVaultSnapshots(vault).length, 1);
  assert.equal(ensureDailySnapshot(vault, new Date('2026-11-13T15:00:00Z')).created, true);
  assert.equal(listVaultSnapshots(vault).length, 2);
});
test('el día se cuenta en hora de Panamá (UTC-5)', () => {
  const vault = freshVault();
  // 03:00 UTC del 13 = 22:00 del 12 en Panamá
  assert.equal(ensureDailySnapshot(vault, new Date('2026-11-13T03:00:00Z')).created, true);
  assert.equal(listVaultSnapshots(vault)[0].name.startsWith('20261112-'), true);
});
test(`se conservan solo las ${MAX_SNAPSHOTS} fotos más recientes`, () => {
  const vault = freshVault();
  for (let i = 0; i < MAX_SNAPSHOTS + 3; i++) {
    const r = createVaultSnapshot(vault, 'manual', new Date(Date.UTC(2026, 0, 1 + i, 15)));
    assert.equal(r.ok, true);
  }
  const all = listVaultSnapshots(vault);
  assert.equal(all.length, MAX_SNAPSHOTS);
  assert.equal(all[0].name.startsWith('20260117-'), true);
  assert.equal(all[all.length - 1].name.startsWith('20260104-'), true);
});
test('una foto restaura un archivo dañado después', () => {
  const vault = freshVault();
  const res = createVaultSnapshot(vault, 'manual');
  assert.equal(res.ok, true);
  if (!res.ok) return;
  fs.writeFileSync(path.join(vault, 'Nota A.md'), 'contenido roto');
  const saved = fs.readFileSync(path.join(getBackupRoot(vault), res.snapshot.name, 'vault', 'Nota A.md'), 'utf8');
  assert.equal(saved.startsWith('---\nid: a'), true);
});

console.log('Escritura segura');
test('YAML ilegible se rechaza en vez de reescribirse', () => {
  assert.equal(parseNoteStrict('---\nid: [sin cerrar\n---\ncuerpo').ok, false);
  assert.equal(parseNoteStrict('---\nid: a\nsin cierre').ok, false);
});
test('leer y volver a escribir conserva encabezado y cuerpo', () => {
  const src = '---\nid: a\ntitle: "Nota: con dos puntos"\ntags:\n  - uno\n  - dos\n---\n# Título\n\nCuerpo con [[enlace]].\n';
  const n = parseNoteStrict(src);
  assert.equal(n.ok, true);
  if (!n.ok) return;
  const again = parseNoteStrict(serializeNote(n.frontmatter, n.body));
  assert.equal(again.ok, true);
  if (!again.ok) return;
  assert.deepEqual(again.frontmatter, n.frontmatter);
  assert.equal(again.body.trim(), n.body.trim());
});
test('updateNoteFile cambia solo el campo pedido', () => {
  const vault = freshVault();
  const f = path.join(vault, 'Nota A.md');
  const r = updateNoteFile(f, (fm) => { fm.status = 'done'; });
  assert.equal(r.ok, true);
  const n = parseNoteStrict(fs.readFileSync(f, 'utf8'));
  assert.equal(n.ok && n.frontmatter.status, 'done');
  assert.equal(n.ok && n.frontmatter.title, 'Nota A');
  assert.equal(n.ok && n.body.includes('Cuerpo.'), true);
});
test('updateNoteFile no toca un archivo con YAML roto', () => {
  const vault = freshVault();
  const f = path.join(vault, 'rota.md');
  const broken = '---\nid: [x\n---\ncuerpo';
  fs.writeFileSync(f, broken);
  const r = updateNoteFile(f, (fm) => { fm.status = 'done'; });
  assert.equal(r.ok, false);
  assert.equal(fs.readFileSync(f, 'utf8'), broken);
});
test('la escritura atómica no deja archivos temporales', () => {
  const vault = freshVault();
  atomicWriteFile(path.join(vault, 'nueva.md'), 'hola');
  assert.equal(fs.readFileSync(path.join(vault, 'nueva.md'), 'utf8'), 'hola');
  assert.equal(fs.readdirSync(vault).some((n) => n.includes('.tmp-')), false);
});

console.log(`\n${passed} pruebas pasaron`);
