import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const URL = process.env.CSMATRIX_URL || 'http://localhost:3031/collapse/csmatrix/index.html';
  console.log('visiting', URL);
  try {
    await page.goto(URL, { waitUntil: 'networkidle' });
  } catch (err) { console.error('goto failed', err); await browser.close(); process.exit(2); }
  await page.click('#btn-add-node');
  await page.waitForFunction(() => {
    try {
      const raw = localStorage.getItem('csmatrix.graph');
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed.nodes) && parsed.nodes.length > 0;
    } catch {
      return false;
    }
  });
  const raw = await page.evaluate(() => localStorage.getItem('csmatrix.graph'));
  console.log('localStorage csmatrix.graph:', raw ? raw.slice(0,200) + (raw.length>200? '...':'') : raw);
  await browser.close();
})();
