const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, // iPhone 12/13/14
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1'
  });
  const page = await context.newPage();
  console.log('Navigating to Render live mobile...');
  await page.goto('https://taskmanagergh.onrender.com/cerebro', { waitUntil: 'networkidle', timeout: 35000 });
  await page.waitForTimeout(3000);
  
  await page.screenshot({ path: 'C:/Users/Usuario/.gemini/antigravity/brain/3f81f3a3-e93e-4912-ab6c-125c2fdecf1b/live_render_mobile_current.png' });
  console.log('Screenshot saved: live_render_mobile_current.png');
  
  const sheet = await page.$('button:has-text("Cerrar Ficha Ejecutiva")');
  console.log('Is bottom sheet close button present on load:', !!sheet);
  
  const canvas = await page.$('canvas');
  if (canvas) {
    const box = await canvas.boundingBox();
    console.log('Canvas bounding box:', box);
  } else {
    console.log('No canvas element found!');
  }
  
  await browser.close();
})().catch(err => {
  console.error('Playwright error:', err);
  process.exit(1);
});
