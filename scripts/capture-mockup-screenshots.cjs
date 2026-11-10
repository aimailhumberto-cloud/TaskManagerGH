const { chromium } = require('playwright');
const path = require('path');

async function capture() {
  console.log('📸 Iniciando captura de mockups en alta definición...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 860 },
    deviceScaleFactor: 2, // Retina HD quality
  });
  const page = await context.newPage();

  const fileUrl = 'file:///' + path.resolve('C:/Users/Usuario/.gemini/antigravity/brain/3f81f3a3-e93e-4912-ab6c-125c2fdecf1b/mockup_taskmanager_interactivo.html').replace(/\\/g, '/');
  console.log('🌐 Navegando a:', fileUrl);
  await page.goto(fileUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // 1. Capture Vista Diaria (Default)
  const outDir = 'C:/Users/Usuario/.gemini/antigravity/brain/3f81f3a3-e93e-4912-ab6c-125c2fdecf1b';
  await page.screenshot({ path: path.join(outDir, 'mockup_vista_diaria.png') });
  console.log('✅ Capturado: mockup_vista_diaria.png');

  // 2. Switch to Distribuidores and Capture
  await page.click('#btn-distributors');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outDir, 'mockup_vista_distribuidores.png') });
  console.log('✅ Capturado: mockup_vista_distribuidores.png');

  // 3. Switch to Universo Completo and Capture
  await page.click('#btn-universe');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outDir, 'mockup_vista_universo.png') });
  console.log('✅ Capturado: mockup_vista_universo.png');

  // 4. Switch to Calendario and Capture
  await page.click('#btn-calendar');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outDir, 'mockup_vista_calendario.png') });
  console.log('✅ Capturado: mockup_vista_calendario.png');

  // 5. Mobile Viewport capture of daily view
  await page.setViewportSize({ width: 390, height: 844 });
  await page.click('#btn-daily');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outDir, 'mockup_vista_movil.png') });
  console.log('✅ Capturado: mockup_vista_movil.png');

  await browser.close();
  console.log('🎉 ¡Todas las capturas se completaron exitosamente!');
}

capture().catch(err => {
  console.error('❌ Error capturando:', err);
  process.exit(1);
});
