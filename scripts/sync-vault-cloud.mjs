#!/usr/bin/env node
/**
 * SM Jaleel Cloud Vault Synchronizer
 * -----------------------------------
 * Sincroniza bidireccionalmente el Vault de Obsidian con el servidor Render en la nube.
 * No requiere 'git commit' ni 'git push' ni reinicios de Render.
 * 
 * Uso:
 *   node scripts/sync-vault-cloud.mjs push    # Sube cambios locales a la nube (Render)
 *   node scripts/sync-vault-cloud.mjs pull    # Descarga el vault de la nube a local
 *   node scripts/sync-vault-cloud.mjs status  # Muestra el estado del almacenamiento en la nube
 */

import fs from 'fs';
import path from 'path';

const CLOUD_URL = process.env.CLOUD_VAULT_URL || 'https://taskmanagergh.onrender.com';
const LOCAL_VAULT = process.env.LOCAL_VAULT_PATH || 'C:\\Users\\Usuario\\Downloads\\SMJaleel\\vault';

async function getStatus() {
  console.log(`📡 Consultando estado en ${CLOUD_URL}...`);
  const res = await fetch(`${CLOUD_URL}/api/agent/vault-sync?status=1`);
  const data = await res.json();
  console.log('✅ Estado del Vault en la nube:', JSON.stringify(data, null, 2));
}

function getAllFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  let results = [];
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of list) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) {
      results = results.concat(getAllFiles(full));
    } else if (item.name.endsWith('.md')) {
      results.push(full);
    }
  }
  return results;
}

async function pushVault() {
  console.log(`🚀 Iniciando subida instantánea desde ${LOCAL_VAULT} a ${CLOUD_URL}...`);
  const files = getAllFiles(LOCAL_VAULT);
  console.log(`📦 Encontrados ${files.length} archivos Markdown locales.`);

  const batch = [];
  for (const file of files) {
    const rel = path.relative(LOCAL_VAULT, file).replace(/\\/g, '/');
    const content = fs.readFileSync(file, 'utf-8');
    batch.push({ path: rel, content });
  }

  // Enviar en lotes de 50 para máxima velocidad y estabilidad
  const chunkSize = 50;
  let sent = 0;
  for (let i = 0; i < batch.length; i += chunkSize) {
    const chunk = batch.slice(i, i + chunkSize);
    const res = await fetch(`${CLOUD_URL}/api/agent/vault-sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'batch_sync', files: chunk }),
    });
    const result = await res.json();
    sent += chunk.length;
    console.log(`  ⚡ Sincronizados ${sent}/${batch.length} archivos... (${result.message || 'OK'})`);
  }
  console.log(`✨ ¡Sincronización completada! El Cerebro en Render ya tiene todos los archivos actualizados.`);
}

async function pullVault() {
  console.log(`📥 Descargando Vault completo desde la nube (${CLOUD_URL})...`);
  const res = await fetch(`${CLOUD_URL}/api/agent/vault-sync?export=json`);
  const data = await res.json();

  if (!data.ok || !Array.isArray(data.files)) {
    console.error('❌ Error al exportar desde la nube:', data);
    return;
  }

  console.log(`📦 Recibidos ${data.files.length} archivos. Escribiendo en ${LOCAL_VAULT}...`);
  if (!fs.existsSync(LOCAL_VAULT)) fs.mkdirSync(LOCAL_VAULT, { recursive: true });

  let written = 0;
  for (const item of data.files) {
    const target = path.join(LOCAL_VAULT, item.path);
    const dir = path.dirname(target);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(target, item.content, 'utf-8');
    written++;
  }
  console.log(`✨ ¡Descarga completada! ${written} archivos actualizados en tu Obsidian local.`);
}

const command = process.argv[2] || 'status';
if (command === 'push') {
  pushVault().catch(console.error);
} else if (command === 'pull') {
  pullVault().catch(console.error);
} else {
  getStatus().catch(console.error);
}
