import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://localhost:3030/collapse/chud/index.html', { waitUntil: 'networkidle' });
  await page.waitForSelector('.approach-grid');

  // Click Force
  const force = await page.$('.approach-grid .core-card:has-text("Force")');
  if (!force) {
    console.error('Force card not found');
    await browser.close();
    process.exit(2);
  }
  await force.click();

  // read stored state
  const stored = await page.evaluate(() => {
    try {
      const raw = localStorage.getItem('chud.state.v1');
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null }
  });
  console.log('stored after click:', stored);

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.approach-grid');
  const forceValue = await page.$eval('.approach-grid .core-card:has-text("Force") .core-value', el => el.textContent.trim());
  console.log('force value after reload:', forceValue);

  await browser.close();
})();