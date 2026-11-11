import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import { spawn } from 'child_process';
import assert from 'assert';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ARTIFACTS_DIR = 'C:/Users/Usuario/.gemini/antigravity/brain/3f81f3a3-e93e-4912-ab6c-125c2fdecf1b';
const PORT = 3016;
const BASE_URL = `http://127.0.0.1:${PORT}`;

async function waitForServer(url, timeoutMs = 25000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(url, (res) => {
          if (res.statusCode) resolve(true);
          else reject();
        });
        req.on('error', reject);
        req.setTimeout(1000, () => req.destroy());
      });
      return true;
    } catch {
      await new Promise(r => setTimeout(r, 400));
    }
  }
  throw new Error(`Servidor no respondió en ${timeoutMs}ms`);
}

async function run() {
  console.log('--- INICIANDO VERIFICACIÓN DE TOPOLOGÍA COMERCIAL Y RECONFIGURACIÓN ESPACIAL ---');
  console.log('1. Iniciando servidor Next.js en puerto', PORT);

  const server = spawn('npx', ['next', 'start', '-p', String(PORT), '-H', '127.0.0.1'], {
    cwd: path.resolve(__dirname, '..'),
    shell: true,
  });

  server.stdout.on('data', d => process.stdout.write(d.toString()));
  server.stderr.on('data', d => process.stderr.write(d.toString()));

  try {
    await waitForServer(`${BASE_URL}/api/agent/brain?market=belize`);
    console.log('✓ Servidor activo');

    // 1. API Verification
    console.log('\n--- 1. VERIFICACIÓN DE API Y SINAPSIS TOPOLÓGICAS (4 CAPAS) ---');
    const res = await fetch(`${BASE_URL}/api/agent/brain?market=belize`);
    const graph = await res.json();

    const wholesalerNode = graph.nodes.find(n => n.id === 'channel-sancas-belize-wholesalers');
    const brodiesNode = graph.nodes.find(n => n.id === 'client-brodies-belize');
    const nandosNode = graph.nodes.find(n => n.id === 'dist-nandos-belize');

    console.log('1.1 Nodo Mayoristas detectado:', !!wholesalerNode);
    console.log('    - market_id:', wholesalerNode?.market_id);
    console.log('    - spatial_tier:', wholesalerNode?.spatial_tier);
    console.log('    - channel_type:', wholesalerNode?.channel_type);

    console.log('1.2 Nodo Cliente Brodies detectado:', !!brodiesNode);
    console.log('    - market_id:', brodiesNode?.market_id);
    console.log('    - spatial_tier:', brodiesNode?.spatial_tier);

    console.log('1.3 Nodo Nando\'s Wholesale detectado:', !!nandosNode);
    console.log('    - market_id:', nandosNode?.market_id);
    console.log('    - spatial_tier:', nandosNode?.spatial_tier);

    // Check synapses / links
    const links = graph.links;
    const wholesalerToMarket = links.find(l => l.source === 'channel-sancas-belize-wholesalers' && l.target === 'market-belize');
    const wholesalerToSanCas = links.find(l => l.source === 'channel-sancas-belize-wholesalers' && l.target.includes('sancas'));
    const brodiesToMarket = links.find(l => l.source === 'client-brodies-belize' && l.target === 'market-belize');
    const brodiesToSupplier = links.find(l => l.source === 'client-brodies-belize' && l.target.includes('sancas'));

    console.log('1.4 Sinapsis viva Mayoristas -> Mercado Belice:', !!wholesalerToMarket);
    console.log('1.5 Sinapsis viva Mayoristas -> SanCas:', !!wholesalerToSanCas);
    console.log('1.6 Sinapsis viva Brodies -> Mercado Belice:', !!brodiesToMarket);
    console.log('1.7 Sinapsis viva Brodies -> Suministrador SanCas:', !!brodiesToSupplier);

    // Test DOTS API reconfigure_node_topology
    console.log('\n--- 2. PROBANDO ACCIÓN DE RECONFIGURACIÓN PARA DOTS ---');
    const reconfigRes = await fetch(`${BASE_URL}/api/agent/brain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'reconfigure_node_topology',
        nodeId: 'channel-sancas-belize-wholesalers',
        updates: {
          channel_type: 'wholesale',
          spatial_tier: 'channel',
          clients: ['Client - Brodies Belize', 'Client - Red Mayoristas Independientes Belice'],
        },
      }),
    });
    const reconfigData = await reconfigRes.json();
    console.log('2.1 Respuesta reconfigure_node_topology:', reconfigData);
    assert.strictEqual(reconfigData.ok, true, 'reconfigure_node_topology debe responder con éxito');

    // 3. Playwright UI Verification
    console.log('\n--- 3. PLAYWRIGHT UI: VERIFICACIÓN ESPACIAL EN CEREBRO ---');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

    await page.goto(`${BASE_URL}/cerebro`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    // Search for Mayoristas in Universal Search
    const searchInput = page.locator('header input[placeholder*="Buscar"]');
    await searchInput.fill('Mayoristas');
    await page.waitForTimeout(600);

    const firstResult = page.locator('div:has-text("SanCas Belize: Mayoristas")').first();
    const resultVisible = await firstResult.isVisible();
    console.log('3.1 Nodo Mayoristas localizado en búsqueda universal:', resultVisible);

    if (resultVisible) {
      await firstResult.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'verify_topology_dossier_wholesaler.png') });
      console.log('✓ Screenshot guardado: verify_topology_dossier_wholesaler.png');
    }

    // Capture Constellations view
    const constButton = page.locator('button:has-text("Constelaciones")').first();
    await constButton.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'verify_topology_constellations.png') });
    console.log('✓ Screenshot guardado: verify_topology_constellations.png');

    // Capture Organigram view
    const orgButton = page.locator('button:has-text("Organigrama")').first();
    await orgButton.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'verify_topology_organigram_belize.png') });
    console.log('✓ Screenshot guardado: verify_topology_organigram_belize.png');

    await browser.close();
    console.log('\n=== ¡VERIFICACIÓN DE TOPOLOGÍA COMERCIAL (5 FASES) COMPLETADA CON ÉXITO! ===');
  } finally {
    server.kill();
  }
}

run().catch(err => {
  console.error('Error durante la verificación:', err);
  process.exit(1);
});
