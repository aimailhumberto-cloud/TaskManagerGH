const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true
  });
  const page = await context.newPage();
  await page.goto('https://taskmanagergh.onrender.com/cerebro', { waitUntil: 'networkidle', timeout: 35000 });
  await page.waitForTimeout(3000);

  // 1. Initial state: canvas visible, no card
  let closeBtn = await page.$('button:has-text("✕ Cerrar Ficha Ejecutiva")');
  console.log('1. Initial load - has closeBtn:', !!closeBtn);

  // 2. Tap node to open bottom sheet
  await page.touchscreen.tap(195, 540);
  await page.waitForTimeout(1500);

  closeBtn = await page.$('button:has-text("✕ Cerrar Ficha Ejecutiva")');
  console.log('2. After tap node - has closeBtn:', !!closeBtn);

  // 3. Click close button
  if (closeBtn) {
    console.log('Clicking close button...');
    await closeBtn.click();
    await page.waitForTimeout(1000);
    
    closeBtn = await page.$('button:has-text("✕ Cerrar Ficha Ejecutiva")');
    console.log('3. Immediately after close - has closeBtn:', !!closeBtn);

    // Wait 5 seconds (fetchGraph runs every 3.5s)
    console.log('Waiting 6 seconds to verify it does NOT auto-reopen...');
    await page.waitForTimeout(6000);

    closeBtn = await page.$('button:has-text("✕ Cerrar Ficha Ejecutiva")');
    console.log('4. After 6 seconds - has closeBtn:', !!closeBtn);

    await page.screenshot({ path: 'C:/Users/Usuario/.gemini/antigravity/brain/3f81f3a3-e93e-4912-ab6c-125c2fdecf1b/live_after_close_persists.png' });
    console.log('Saved live_after_close_persists.png');
  }

  await browser.close();
})();
