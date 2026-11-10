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

  // Let's find node positions from the page's React state or DOM
  const nodeInfo = await page.evaluate(() => {
    // Check if there are any debug info or canvas dimensions
    const c = document.querySelector('canvas');
    return {
      canvasWidth: c ? c.width : 0,
      canvasHeight: c ? c.height : 0,
      clientWidth: c ? c.clientWidth : 0,
      clientHeight: c ? c.clientHeight : 0,
    };
  });
  console.log('Canvas info:', nodeInfo);

  // Let's use touch tap (tap with finger) at the center of the canvas!
  // Canvas clientHeight is ~796. The middle is around x: 195, y: 446 (header is 48px).
  console.log('Tapping at (195, 500) using page.touchscreen.tap...');
  await page.touchscreen.tap(195, 500);
  await page.waitForTimeout(2000);

  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log('After tap at (195, 500):');
  console.log('Contains S.M. JALEEL?:', bodyText.includes('S.M. JALEEL') || bodyText.includes('JALEEL'));
  console.log('Close button found?:', !!(await page.$('button:has-text("✕ Cerrar Ficha Ejecutiva")')));

  // Let's also check if tapping near the Jaleel logo works (e.g. y: 450, 480, 520)
  for (const y of [450, 480, 510, 540]) {
    await page.touchscreen.tap(195, y);
    await page.waitForTimeout(1000);
    const hasClose = !!(await page.$('button:has-text("✕ Cerrar Ficha Ejecutiva")'));
    if (hasClose) {
      console.log(`Found close button tapping at (195, ${y})!`);
      break;
    }
  }

  await page.screenshot({ path: 'C:/Users/Usuario/.gemini/antigravity/brain/3f81f3a3-e93e-4912-ab6c-125c2fdecf1b/test_tap_result.png' });
  await browser.close();
})();
