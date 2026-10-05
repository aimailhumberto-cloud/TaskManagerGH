import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const origin = 'http://127.0.0.1:3011';
const before = readFileSync('.local-data/preview.json');
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  assert((await context.request.post(origin + '/api/auth/login', { data: { email: 'humberto@local.test', password: 'preview-local-only' } })).ok());
  const page = await context.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  let gps = 0;
  await page.exposeFunction('countGPS', () => { gps++; });
  await page.addInitScript(() => Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition: success => { window.countGPS(); setTimeout(() => success({ coords: { latitude: 45, longitude: -35 } }), 400); } } }));
  const loaded = async () => { await page.goto(origin); await page.locator('.tm-workspace[data-sources-loaded=true]').waitFor(); };
  await loaded();
  const strip = page.getByLabel('Indicadores de Casa');
  assert.equal(await strip.getByRole('button').count(), 1);
  assert.equal(await page.getByRole('button', { name: 'Personalizar Inicio' }).count(), 0);
  assert.equal(await page.getByRole('article', { name: 'Casa fija' }).count(), 0);
  assert.equal(await page.locator('.tm-hero .tm-hero-indicators').count(), 1);
  assert((await strip.innerText()).includes('Playa Caracol')); assert((await strip.innerText()).includes('Marea')); assert((await strip.innerText()).includes('Pendiente')); assert.equal(gps, 0);
  await strip.getByRole('button', { name: 'Configurar', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: 'Configuración de Inicio' });
  await dialog.getByRole('button', { name: 'Configurar Casa' }).click();
  const form = dialog.getByRole('form', { name: 'Configurar Casa' });
  await form.getByLabel('Nombre meteorológico').fill('Cancelled draft only');
  await form.getByRole('button', { name: 'Cancelar selección' }).click();
  await dialog.getByRole('button', { name: 'Elegir ubicación actual' }).click();
  await dialog.getByRole('button', { name: /Usar GPS/ }).click();
  await dialog.getByRole('button', { name: 'Volver a Inicio' }).click();
  await strip.getByRole('button', { name: 'Configurar', exact: true }).click();
  await dialog.getByRole('button', { name: 'Elegir ubicación actual' }).click();
  await page.waitForTimeout(650); // Delayed GPS cancellation behavior, not a network wait.
  assert.equal(await dialog.getByRole('form', { name: 'Configurar ubicación actual' }).getByLabel('Latitud meteorológica').inputValue(), '');
  await page.keyboard.press('Escape'); assert.equal(await dialog.count(), 0); assert.equal(gps, 1);
  const sources = await (await context.request.get(origin + '/api/workspace/environment')).json();
  assert(sources.weather && typeof sources.weather.values.temperature_2m === 'number', 'Actual weather source unavailable');
  assert(sources.marine && typeof sources.marine.values.wave_height === 'number', 'Actual wave source unavailable');
  await loaded();
  await page.waitForFunction(() => !document.querySelector('.tm-hero-indicators')?.textContent.includes('Consultando'), undefined, { timeout: 30000 });
  assert((await strip.innerText()).includes('°C')); assert.equal(gps, 1);
  mkdirSync('artifacts', { recursive: true });
  await page.screenshot({ path: 'artifacts/taskmanager-hero-compacto-real.png', fullPage: true });
  for (const width of [1440, 1024, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    if (width < 1024) await page.waitForFunction(() => !document.querySelector('aside') || document.querySelector('aside').getBoundingClientRect().right <= 1);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await strip.getByRole('button', { name: 'Configurar', exact: true }).click();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert(await dialog.isVisible()); await page.keyboard.press('Escape');
    if (width === 390) await page.screenshot({ path: 'artifacts/taskmanager-hero-compacto-movil-real.png', fullPage: true });
  }
  assert.deepEqual(readFileSync('.local-data/preview.json'), before); assert.deepEqual(errors, []);
  const report = { checkedAt: new Date().toISOString(), imageReference: 'libfile_2581f0daf3048191bff2b779235286ff', singleConfigure: true, coordinatesHiddenUntilConfigure: true, cancelBackEscapeReload: true, staleGPSIgnored: true, widths: [1440, 1024, 390, 320], dataUnchanged: true, pageErrors: errors, weather: sources.weather, marine: sources.marine, tide: 'Pending' };
  writeFileSync('.local-data/compact-hero-ui-report.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ checkedAt: report.checkedAt, dataUnchanged: true, pageErrors: errors, actualSourceObservedAt: sources.weather.observedAt, tide: report.tide, widths: report.widths }));
} finally { await browser.close(); }
