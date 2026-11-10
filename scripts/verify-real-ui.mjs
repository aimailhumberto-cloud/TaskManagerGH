import { chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const artifactDir = 'C:\\Users\\Usuario\\.gemini\\antigravity\\brain\\3f81f3a3-e93e-4912-ab6c-125c2fdecf1b';

async function main() {
  console.log('Launching browser...');
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  const page = await context.newPage();

  console.log('Navigating directly to /tasks...');
  await page.goto('http://localhost:3010/tasks', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // 1. Desktop - Mi Día
  await page.screenshot({ path: path.join(artifactDir, 'real_tasks_mi_dia_desktop.png') });
  console.log('Saved real_tasks_mi_dia_desktop.png');

  // 2. Desktop - Distribuidores & Cuotas
  await page.locator('nav[aria-label="Vistas Ejecutivas"] button:has-text("Distribuidores")').click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(artifactDir, 'real_tasks_distribuidores_desktop.png') });
  console.log('Saved real_tasks_distribuidores_desktop.png');

  // 3. Desktop - Universo Completo
  await page.locator('nav[aria-label="Vistas Ejecutivas"] button:has-text("Universo")').click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(artifactDir, 'real_tasks_universo_desktop.png') });
  console.log('Saved real_tasks_universo_desktop.png');

  // 4. Open "Pedir a DOTS" Modal from Universe table
  const dotsBtn = page.locator('button:has-text("Pedir a DOTS")').first();
  if (await dotsBtn.isVisible()) {
    await dotsBtn.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(artifactDir, 'real_tasks_modal_dots_desktop.png') });
    console.log('Saved real_tasks_modal_dots_desktop.png');
    // Close modal
    await page.locator('button:has-text("Cancelar")').click();
    await page.waitForTimeout(400);
  }

  // 5. Open "Ver en Cerebro" Dossier Modal
  const dossierBtn = page.locator('button:has-text("Ficha")').first();
  if (await dossierBtn.isVisible()) {
    await dossierBtn.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(artifactDir, 'real_tasks_modal_dossier_desktop.png') });
    console.log('Saved real_tasks_modal_dossier_desktop.png');
    await page.locator('button:has-text("Cerrar")').click();
    await page.waitForTimeout(400);
  }

  // 6. Mobile View (iPhone 14 viewport)
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('nav[aria-label="Vistas Ejecutivas"] button:has-text("Mi Día")').click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(artifactDir, 'real_tasks_movil.png') });
  console.log('Saved real_tasks_movil.png');

  await browser.close();
  console.log('ALL SCREENSHOTS CAPTURED SUCCESSFULLY!');
}

main().catch(console.error);
