const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1'
  });
  const page = await context.newPage();
  console.log('Navigating to Render live mobile...');
  await page.goto('https://taskmanagergh.onrender.com/cerebro', { waitUntil: 'networkidle', timeout: 35000 });
  await page.waitForTimeout(3000);

  // Click center of canvas where S.M. Jaleel core node is (x: 195, y: 500)
  console.log('Clicking center node...');
  await page.mouse.click(195, 500);
  await page.waitForTimeout(2000);

  // Capture open bottom sheet
  await page.screenshot({ path: 'C:/Users/Usuario/.gemini/antigravity/brain/3f81f3a3-e93e-4912-ab6c-125c2fdecf1b/live_render_bottom_sheet_open.png' });
  console.log('Saved live_render_bottom_sheet_open.png');

  // Verify text inside sheet
  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log('Contains Corporate evidence batch?:', bodyText.includes('Corporate evidence batch'));
  console.log('Contains STR-REL?:', bodyText.includes('STR-REL'));
  console.log('Contains Roberto Bouche?:', bodyText.includes('Roberto Bouche'));

  // Click close button
  const closeBtn = await page.$('button:has-text("✕ Cerrar Ficha Ejecutiva")');
  if (closeBtn) {
    console.log('Clicking close button...');
    await closeBtn.click();
    console.log('Waiting 5 seconds to ensure fetchGraph does not reopen...');
    await page.waitForTimeout(5000);
    
    await page.screenshot({ path: 'C:/Users/Usuario/.gemini/antigravity/brain/3f81f3a3-e93e-4912-ab6c-125c2fdecf1b/live_render_after_close.png' });
    console.log('Saved live_render_after_close.png');
    
    const sheetAfter = await page.$('button:has-text("✕ Cerrar Ficha Ejecutiva")');
    console.log('Is bottom sheet present after 5s wait?:', !!sheetAfter);
  } else {
    console.log('Close button was not found! Checking if any card was opened:');
    console.log('Any card opened?:', bodyText.includes('FICHA EJECUTIVA') || bodyText.includes('HISTORIAL'));
  }

  await browser.close();
})().catch(err => {
  console.error('Playwright error:', err);
  process.exit(1);
});
