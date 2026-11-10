const { spawn } = require('child_process');
const { chromium } = require('playwright');
const http = require('http');

function waitServer(url, timeoutMs = 20000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    function ping() {
      http.get(url, (res) => {
        if (res.statusCode === 200) resolve();
        else setTimeout(ping, 500);
      }).on('error', () => {
        if (Date.now() - start > timeoutMs) reject(new Error('Server timeout'));
        else setTimeout(ping, 500);
      });
    }
    ping();
  });
}

(async () => {
  const server = spawn('npx', ['next', 'start', '-p', '3016'], {
    cwd: 'C:/Users/Usuario/.gemini/antigravity/scratch/hermes-task-dashboard',
    shell: true,
    stdio: 'inherit'
  });

  try {
    await waitServer('http://localhost:3016/cerebro');
    const browser = await chromium.launch({ headless: true });

    // Test mobile settings sheet
    const mobilePage = await browser.newPage({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true
    });
    await mobilePage.goto('http://localhost:3016/cerebro', { waitUntil: 'networkidle' });
    await mobilePage.waitForTimeout(1500);

    // Tap settings button
    console.log('Tapping settings button on mobile...');
    await mobilePage.touchscreen.tap(360, 24); // Settings button at top right
    await mobilePage.waitForTimeout(600);

    await mobilePage.screenshot({ path: 'C:/Users/Usuario/.gemini/antigravity/brain/3f81f3a3-e93e-4912-ab6c-125c2fdecf1b/audit_mobile_settings_open.png' });
    console.log('Saved audit_mobile_settings_open.png');

    await browser.close();
  } finally {
    server.kill();
  }
})().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
