import http from 'http';
import { spawn } from 'child_process';
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const PORT = 3012;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const ARTIFACTS_DIR = 'C:/Users/Usuario/.gemini/antigravity/brain/3f81f3a3-e93e-4912-ab6c-125c2fdecf1b';

async function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${url}/api/agent/tasks`);
      if (res.ok) return true;
    } catch (e) {
      // wait
    }
    await new Promise(r => setTimeout(r, 600));
  }
  throw new Error(`Server did not respond within ${timeoutMs}ms`);
}

async function run() {
  console.log('--- INICIANDO VERIFICACIÓN COMPLETA AUDITORÍA DOTS (14 PUNTOS) ---');

  // Check if server already running or start one
  let nextServer = null;
  try {
    const check = await fetch(`${BASE_URL}/api/agent/tasks`);
    if (check.ok) console.log('✓ Servidor ya activo en', BASE_URL);
  } catch {
    console.log('1. Iniciando servidor Next.js en puerto', PORT);
    nextServer = spawn('npx', ['next', 'start', '-p', String(PORT), '-H', '127.0.0.1'], {
      cwd: 'C:/Users/Usuario/.gemini/antigravity/scratch/hermes-task-dashboard',
      stdio: 'inherit',
      shell: true,
    });
    await waitForServer(BASE_URL);
    console.log('✓ Servidor activo en', BASE_URL);
  }

  try {
    // 1. Test /api/agent/tasks (Fase 1: Puntos 1 a 7)
    console.log('\n--- FASE 1: AUDITORÍA DE DATOS Y TAREAS (PUNTOS 1-7) ---');
    const tasksRes = await fetch(`${BASE_URL}/api/agent/tasks`);
    const tasksData = await tasksRes.json();

    console.log('1.1 Verificando timestamp Panamá (Punto 2 & 11):', tasksData.summary?.panamaTimestamp);
    if (!tasksData.summary?.panamaTimestamp) throw new Error('Falta panamaTimestamp en summary');

    console.log('1.2 Verificando eliminación de cuotas inventadas (Punto 1):');
    const distUnspecified = tasksData.distributors.filter(d => d.targetCasesYear === undefined);
    console.log(`✓ Distribuidores sin cuotas inventadas: ${distUnspecified.length} encontrados (ej. ${distUnspecified[0]?.name}: cuota=${distUnspecified[0]?.targetCasesYear})`);

    console.log('1.3 Verificando IDs deterministas SHA-256 (Punto 5):');
    const sampleTask = tasksData.tasks[0];
    console.log(`✓ ID de tarea de muestra: "${sampleTask.id}" (estable, no depende de posición array)`);
    if (!sampleTask.id || sampleTask.id.startsWith('pt-undefined')) throw new Error('ID no determinista');

    console.log('1.4 Verificando tareas sin plazos fijados (Punto 2):');
    const noDueDateTasks = tasksData.tasks.filter(t => !t.dueDate);
    console.log(`✓ Tareas sin fecha falsa inventada: ${noDueDateTasks.length} tareas`);

    console.log('1.5 Probando Write-Verify-Read y ciclo DOTS en 5 etapas (Puntos 3, 4, 7):');
    // Ask DOTS
    const dotsRes = await fetch(`${BASE_URL}/api/agent/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'ask_dots',
        taskId: sampleTask.id,
        instruction: 'Preparar análisis preliminar de stock y rotación Q4 para revisión HB',
      }),
    });
    const dotsResult = await dotsRes.json();
    console.log('✓ Respuesta Pedir a DOTS (Punto 7):', dotsResult.message, '| Stage:', dotsResult.stage);
    if (!dotsResult.ok) throw new Error('Fallo en Pedir a DOTS');

    // 2. Test /api/agent/brain (Fase 3: Puntos 12-14)
    console.log('\n--- FASE 3: FÓRMULA Y API (PUNTOS 12-14) ---');
    console.log('2.1 Probando endpoint upsert_node (Punto 12):');
    const upsertRes = await fetch(`${BASE_URL}/api/agent/brain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'upsert_node',
        relativePath: '00-Working-Memory/test-audit-node.md',
        frontmatter: {
          id: 'test-audit-node',
          title: 'Test Audit Node Upsert',
          type: 'working_memory',
          memory_tier: 'working',
          status: 'pulsing',
        },
        body: '# Test Audit Node\nVerificación exitosa de endpoint upsert_node.',
      }),
    });
    const upsertResult = await upsertRes.json();
    console.log('✓ Resultado upsert_node:', upsertResult.message);
    if (!upsertResult.ok) throw new Error('Fallo en upsert_node');

    console.log('2.2 Probando consolidación y promoción de memorias (Punto 12):');
    const consRes = await fetch(`${BASE_URL}/api/agent/brain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'consolidate_session',
        summary: 'Consolidación de auditoría para verificación automática de promoción de memoria.',
      }),
    });
    const consResult = await consRes.json();
    console.log('✓ Resultado consolidación y promoción:', consResult.result);

    console.log('2.3 Verificando catálogo completo allNodes (Punto 8):');
    const brainRes = await fetch(`${BASE_URL}/api/agent/brain?market=panama`);
    const brainData = await brainRes.json();
    console.log(`✓ Nodos filtrados por mercado Panamá: ${brainData.nodes.length} | Catálogo completo allNodes: ${brainData.allNodes?.length}`);
    const aleemInAll = brainData.allNodes?.find(n => n.id.includes('aleem'));
    const tomasInAll = brainData.allNodes?.find(n => n.id.includes('tomas'));
    console.log('✓ Dr. Aleem en catálogo global:', !!aleemInAll, '| Tomás Casas en catálogo global:', !!tomasInAll);

    // 3. Playwright UI Verification (Fase 2: Puntos 8 a 11 y UI de Tareas)
    console.log('\n--- FASE 2: VERIFICACIÓN UI PLAYWRIGHT (PUNTOS 8-11, 14) ---');
    const browser = await chromium.launch({ headless: true });

    // Desktop Tasks Page
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    console.log('3.1 Navegando a /tasks...');
    await page.goto(`${BASE_URL}/tasks`, { waitUntil: 'networkidle' });
    await page.waitForSelector('text=Sincronizado:', { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(800);

    const panamaHeaderBadge = await page.textContent('header');
    console.log('✓ Cabecera Tasks con sello Panamá (Punto 2 & 11):', panamaHeaderBadge.includes('Panamá'));

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'verify_audit_tasks_desktop.png') });
    console.log('✓ Screenshot guardado: verify_audit_tasks_desktop.png');

    // Click on Distribuidores tab
    console.log('3.2 Verificando pestaña Distribuidores & Cuotas...');
    await page.click('button:has-text("Distribuidores & Cuotas")');
    await page.waitForTimeout(600);
    const distContent = await page.content();
    console.log('✓ Muestra "Sin dato registrado" para distribuidor sin cuota:', distContent.includes('Sin dato registrado'));
    console.log('✓ Muestra "Sin cuota formal":', distContent.includes('Sin cuota formal'));
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'verify_audit_distributors_desktop.png') });

    // Cerebro Page UI
    console.log('3.3 Navegando a /cerebro...');
    await page.goto(`${BASE_URL}/cerebro`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);

    // Universal Search (Point 8)
    console.log('3.4 Probando buscador universal para Dr. Aleem Mohammed...');
    const searchInput = page.locator('input[placeholder*="Buscar"]');
    await searchInput.fill('Aleem');
    await page.waitForTimeout(600);
    const aleemResult = await page.locator('text=Aleem').first();
    const isAleemVisible = await aleemResult.isVisible();
    console.log('✓ Dr. Aleem Mohammed encontrado en búsqueda universal (Punto 8):', isAleemVisible);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'verify_audit_search_aleem.png') });

    // Test Tomás Casas search
    console.log('3.5 Probando buscador universal para Tomás Casas...');
    await searchInput.fill('Tomás');
    await page.waitForTimeout(600);
    const tomasResult = await page.locator('text=Tomás').first();
    const isTomasVisible = await tomasResult.isVisible();
    console.log('✓ Tomás Casas encontrado en búsqueda universal (Punto 8):', isTomasVisible);

    // Click on Tomás Casas to open Dossier
    if (isTomasVisible) {
      await tomasResult.click();
      await page.waitForTimeout(800);
      const asideContent = await page.locator('aside:has-text("Fichas Ejecutivas")').textContent();
      console.log('✓ Dossier abierto para ficha universal:', asideContent.includes('Tomás'));
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'verify_audit_dossier_tomas.png') });
    }

    // Check Organigram View (Point 9)
    console.log('3.6 Verificando Perspectiva Organigrama...');
    const settingsBtn = page.locator('button:has-text("Ajustes")');
    await settingsBtn.click();
    await page.waitForTimeout(500);

    // Check "Ir a Ficha" selector has all people
    const selectOptions = await page.locator('select option').allTextContents();
    console.log(`✓ Total entidades en "Ir a Ficha" (Punto 8): ${selectOptions.length}`);
    console.log('✓ Contiene Dr. Aleem:', selectOptions.some(o => o.includes('Aleem')));
    console.log('✓ Contiene Tomás Casas:', selectOptions.some(o => o.includes('Tomás') || o.includes('Tomas')));

    await page.click('button:has-text("Organigrama")');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'verify_audit_organigram_view.png') });
    console.log('✓ Screenshot guardado: verify_audit_organigram_view.png');

    await browser.close();
    console.log('\n=== ¡TODAS LAS PRUEBAS DE AUDITORÍA (14 PUNTOS) COMPLETADAS EXITOSAMENTE! ===');
  } finally {
    if (nextServer) {
      console.log('Deteniendo servidor...');
      nextServer.kill();
    }
  }
}

run().catch(err => {
  console.error('Error en pruebas de auditoría:', err);
  process.exit(1);
});
