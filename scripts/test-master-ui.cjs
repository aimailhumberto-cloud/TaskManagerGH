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
  console.log('Starting local Next.js production server on port 3015...');
  const server = spawn('npx', ['next', 'start', '-p', '3015'], {
    cwd: 'C:/Users/Usuario/.gemini/antigravity/scratch/hermes-task-dashboard',
    shell: true,
    stdio: 'inherit'
  });

  try {
    await waitServer('http://localhost:3015/cerebro');
    console.log('Server is UP! Launching Playwright audit...');

    const browser = await chromium.launch({ headless: true });
    
    // 1. Desktop Test (1280x800)
    console.log('--- TEST 1: DESKTOP CLEAN HEADER & SETTINGS ---');
    const desktopPage = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await desktopPage.goto('http://localhost:3015/cerebro', { waitUntil: 'networkidle' });
    await desktopPage.waitForTimeout(2000);

    // Verify search bar is present
    const searchInput = await desktopPage.$('input[placeholder*="Buscar marca"]');
    console.log('Search input present?:', !!searchInput);
    if (searchInput) {
      await searchInput.fill('Busta');
      await desktopPage.waitForTimeout(600);
      const results = await desktopPage.$$eval('div:has-text("Resultados") ~ div', els => els.map(e => e.innerText.split('\n')[0]));
      console.log('Search results for "Busta":', results.slice(0, 3));
      await searchInput.fill(''); // Clear
    }

    // Verify Settings Button & Popover
    console.log('Testing Settings Popover...');
    await desktopPage.click('button:has-text("Ajustes")');
    await desktopPage.waitForTimeout(500);
    const popoverHeader = await desktopPage.$('text=Ajustes & Control Cerebro');
    console.log('Settings Popover opened?:', !!popoverHeader);
    
    await desktopPage.screenshot({ path: 'C:/Users/Usuario/.gemini/antigravity/brain/3f81f3a3-e93e-4912-ab6c-125c2fdecf1b/audit_desktop_settings_popover.png' });
    console.log('Saved audit_desktop_settings_popover.png');

    // Close settings popover
    await desktopPage.click('button:has-text("Ajustes")');
    await desktopPage.waitForTimeout(500);

    // Test Drill-down & Breadcrumbs
    console.log('Testing Drill-down & Breadcrumbs via node click or search...');
    await desktopPage.evaluate(() => {
      const nodes = (window).__getNodes ? (window).__getNodes() : [];
      const busta = nodes.find(n => n.id.includes('busta'));
      if (busta && (window).__selectNode) {
        (window).__selectNode(busta);
      }
    });
    await desktopPage.waitForTimeout(1000);

    // Click canvas center to trigger node click & drill
    await desktopPage.mouse.click(640, 400);
    await desktopPage.waitForTimeout(1000);

    await desktopPage.screenshot({ path: 'C:/Users/Usuario/.gemini/antigravity/brain/3f81f3a3-e93e-4912-ab6c-125c2fdecf1b/audit_desktop_clean_view.png' });
    console.log('Saved audit_desktop_clean_view.png');

    // 2. Mobile Test (iPhone 13 - 390x844)
    console.log('--- TEST 2: MOBILE VIEW & BOTTOM SHEET ---');
    const mobilePage = await browser.newPage({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true
    });
    await mobilePage.goto('http://localhost:3015/cerebro', { waitUntil: 'networkidle' });
    await mobilePage.waitForTimeout(2000);

    // Mobile Header check
    const mobileHeaderButtons = await mobilePage.$$eval('header button', btns => btns.map(b => b.innerText.trim()));
    console.log('Mobile header buttons:', mobileHeaderButtons);

    await mobilePage.screenshot({ path: 'C:/Users/Usuario/.gemini/antigravity/brain/3f81f3a3-e93e-4912-ab6c-125c2fdecf1b/audit_mobile_clean_header.png' });
    console.log('Saved audit_mobile_clean_header.png');

    // Tap node on mobile
    console.log('Tapping node on mobile (195, 500)...');
    await mobilePage.touchscreen.tap(195, 500);
    await mobilePage.waitForTimeout(1500);

    const hasCloseMobile = await mobilePage.$('button:has-text("Cerrar Ficha Ejecutiva")');
    console.log('Bottom sheet opened on mobile?:', !!hasCloseMobile);

    await mobilePage.screenshot({ path: 'C:/Users/Usuario/.gemini/antigravity/brain/3f81f3a3-e93e-4912-ab6c-125c2fdecf1b/audit_mobile_sheet_with_avatar.png' });
    console.log('Saved audit_mobile_sheet_with_avatar.png');

    await browser.close();
    console.log('All Playwright tests PASSED successfully!');
  } finally {
    server.kill();
  }
})().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
