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

  // Check buttons on initial page
  const buttonsBefore = await page.$$eval('button', btns => btns.map(b => b.innerText.trim()));
  console.log('Buttons on initial load:', buttonsBefore);

  // Tap at (195, 500)
  console.log('Tapping (195, 500)...');
  await page.touchscreen.tap(195, 500);
  await page.waitForTimeout(1500);

  const buttonsAfter = await page.$$eval('button', btns => btns.map(b => b.innerText.trim()));
  console.log('Buttons after tap:', buttonsAfter);

  const hasCerrar = buttonsAfter.some(b => b.includes('Cerrar'));
  console.log('Has Cerrar button:', hasCerrar);

  if (hasCerrar) {
    console.log('Clicking Cerrar button...');
    await page.click('button:has-text("Cerrar")');
    await page.waitForTimeout(1000);
    const buttonsAfterClose = await page.$$eval('button', btns => btns.map(b => b.innerText.trim()));
    console.log('Buttons after close:', buttonsAfterClose);
    
    console.log('Waiting 6s to confirm persistent closure...');
    await page.waitForTimeout(6000);
    const buttonsAfterWait = await page.$$eval('button', btns => btns.map(b => b.innerText.trim()));
    console.log('Buttons after 6s wait:', buttonsAfterWait);
    console.log('Persistent close test passed?:', !buttonsAfterWait.some(b => b.includes('Cerrar')));
  }

  await browser.close();
})();
