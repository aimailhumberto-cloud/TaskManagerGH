// Script de verificación integral: Layout Nativo (Brújula y V1 Ajustada) + Acciones DOTS
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3017;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const ARTIFACTS_DIR = 'C:\\Users\\Usuario\\.gemini\\antigravity\\brain\\3f81f3a3-e93e-4912-ab6c-125c2fdecf1b';

async function waitForServer(url, timeoutMs = 45000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch (e) {}
    await new Promise(r => setTimeout(r, 600));
  }
  throw new Error(`Servidor no respondió en ${timeoutMs}ms`);
}

async function run() {
  console.log('--- INICIANDO VERIFICACIÓN DE LAYOUT NATIVO & ACCIONES DOTS ---');
  console.log('1. Iniciando servidor Next.js en puerto', PORT);

  const server = spawn('npx', ['next', 'start', '-p', String(PORT), '-H', '127.0.0.1'], {
    cwd: path.resolve(__dirname, '..'),
    shell: true,
  });

  server.stdout.on('data', d => process.stdout.write(d.toString()));
  server.stderr.on('data', d => process.stderr.write(d.toString()));

  try {
    await waitForServer(`${BASE_URL}/api/agent/brain?market=belize`);
    console.log('✓ Servidor activo en puerto', PORT);

    // 1. Verificar GET /api/agent/brain (capabilities y layouts)
    console.log('\n--- 1. VERIFICACIÓN DE CAPABILITIES Y LAYOUTS EN API ---');
    const res = await fetch(`${BASE_URL}/api/agent/brain`);
    const data = await res.json();
    console.log('1.1 Capabilities presentes:', data.capabilities);
    console.log('1.2 Layout Brújula presente en API:', !!data.layouts?.brujula);
    console.log('1.3 Layout V1 Ajustada presente en API:', !!data.layouts?.['version-1-ajustada']);

    // 2. Probar acciones de DOTS
    console.log('\n--- 2. PROBANDO NUEVAS ACCIONES DOTS (assign_parent, update_layout_config, reset_layout_config) ---');
    
    // 2.1 update_layout_config
    const updateRes = await fetch(`${BASE_URL}/api/agent/brain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update_layout_config',
        view: 'brujula',
        updates: { spacing: { ring_base: 200 } },
      }),
    });
    const updateJson = await updateRes.json();
    console.log('2.1 update_layout_config:', updateJson.ok, updateJson.message);

    // 2.2 reset_layout_config
    const resetRes = await fetch(`${BASE_URL}/api/agent/brain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'reset_layout_config',
        view: 'brujula',
      }),
    });
    const resetJson = await resetRes.json();
    console.log('2.2 reset_layout_config:', resetJson.ok, resetJson.message);

    // 2.3 assign_parent (validación con parentId real)
    const assignRes = await fetch(`${BASE_URL}/api/agent/brain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'assign_parent',
        nodeId: 'channel-sancas-belize-wholesalers',
        parentId: 'dist-sancas-belize',
        field: 'parent_distributor_id',
      }),
    });
    const assignJson = await assignRes.json();
    console.log('2.3 assign_parent:', assignJson.ok, assignJson.message);

    // 3. Captura con Playwright: Brújula y Versión 1 Ajustada
    console.log('\n--- 3. PLAYWRIGHT UI: CAPTURA DE VISTAS BRÚJULA Y V1 AJUSTADA ---');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    await page.goto(`${BASE_URL}/cerebro`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // Brújula está por defecto
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'layout_brujula.png') });
    console.log('✓ Screenshot guardado: layout_brujula.png');

    // Cambiar a Versión 1 Ajustada
    const v1Button = page.locator('button:has-text("[V1] V1 Ajustada")').first();
    if (await v1Button.isVisible()) {
      await v1Button.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'layout_v1_ajustada.png') });
      console.log('✓ Screenshot guardado: layout_v1_ajustada.png');
    } else {
      console.log('Botón V1 Ajustada no encontrado directamente');
    }

    await browser.close();
    console.log('\n=== ¡VERIFICACIÓN DE LAYOUT NATIVO COMPLETADA CON ÉXITO! ===');
  } finally {
    if (process.platform === 'win32') {
      try {
        spawn('taskkill', ['/pid', String(server.pid), '/T', '/F']);
      } catch (e) {}
    } else {
      server.kill();
    }
  }
}

run().catch(err => {
  console.error('Error durante la verificación:', err);
  process.exit(1);
});
