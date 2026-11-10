import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ARTIFACTS_DIR = 'C:/Users/Usuario/.gemini/antigravity/brain/3f81f3a3-e93e-4912-ab6c-125c2fdecf1b';
const PORT = 3014;
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
  console.log('Iniciando Next.js en puerto', PORT);
  const server = spawn('npx', ['next', 'start', '-p', String(PORT), '-H', '127.0.0.1'], {
    cwd: path.resolve(__dirname, '..'),
    shell: true,
  });

  server.stdout.on('data', d => process.stdout.write(d.toString()));
  server.stderr.on('data', d => process.stderr.write(d.toString()));

  try {
    await waitForServer(`${BASE_URL}/api/agent/tasks`);
    console.log('Servidor listo');

    const browser = await chromium.launch({ headless: true });

    // 1. Desktop - Tasks page with active sidebar tab
    const pageDesktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await pageDesktop.goto(`${BASE_URL}/tasks`, { waitUntil: 'networkidle' });
    await pageDesktop.waitForTimeout(1000);
    await pageDesktop.screenshot({ path: path.join(ARTIFACTS_DIR, 'nav_desktop_tasks_tab.png') });
    console.log('✓ nav_desktop_tasks_tab.png');

    // 2. Desktop - Home page with SSOT banner
    await pageDesktop.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
    await pageDesktop.waitForTimeout(1000);
    await pageDesktop.screenshot({ path: path.join(ARTIFACTS_DIR, 'nav_home_ssot_banner.png') });
    console.log('✓ nav_home_ssot_banner.png');

    // 3. Desktop - Cerebro with top header back to Tareas
    await pageDesktop.goto(`${BASE_URL}/cerebro`, { waitUntil: 'networkidle' });
    await pageDesktop.waitForTimeout(1500);
    await pageDesktop.screenshot({ path: path.join(ARTIFACTS_DIR, 'nav_cerebro_back_to_tasks.png') });
    console.log('✓ nav_cerebro_back_to_tasks.png');

    // 4. Mobile - Tasks page with bottom navigation bar
    const pageMobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
    await pageMobile.goto(`${BASE_URL}/tasks`, { waitUntil: 'networkidle' });
    await pageMobile.waitForTimeout(1000);
    await pageMobile.screenshot({ path: path.join(ARTIFACTS_DIR, 'nav_mobile_tasks_tab.png') });
    console.log('✓ nav_mobile_tasks_tab.png');

    await browser.close();
    console.log('=== CAPTURAS DE NAVEGACIÓN COMPLETADAS ===');
  } finally {
    server.kill();
  }
}

run().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
