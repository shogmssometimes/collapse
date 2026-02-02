import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://localhost:3030/collapse/#/chud', { waitUntil: 'networkidle' });

  // Wait for iframe to load. Try specific title first, fallback to iframe with chud src.
  let frameSelector = 'iframe[title="cHUD — Compact HUD"]';
  if (!(await page.locator(frameSelector).count())) {
    frameSelector = 'iframe[src*="chud/index.html"]';
  }
  // wait for an iframe to appear and list iframes for debugging
  await page.waitForTimeout(2000);
  const frames = await page.$$('iframe');
  console.log('iframe count on page:', frames.length);
  for (let i = 0; i < frames.length; i++) {
    const title = await frames[i].getAttribute('title');
    const src = await frames[i].getAttribute('src');
    console.log(`iframe[${i}] title=${title} src=${src}`);
  }

  await page.waitForSelector(frameSelector, { timeout: 15000 });
  const frameLocator = page.frameLocator(frameSelector);

  // find the frame object so we can inspect its DOM
  let fr = null;
  for (let i = 0; i < 15; i++) {
    fr = page.frames().find(f => f.url().includes('chud/index.html'));
    if (fr) break;
    await page.waitForTimeout(1000);
  }
  if (!fr) {
    console.error('could not find frame by url');
    await browser.close();
    process.exit(2);
  }

  // dump some of the frame's HTML for inspection
  const bodyHtml = await fr.evaluate(() => document.body?.innerHTML?.slice(0, 2000) ?? '');
  console.log('iframe body (snippet):', bodyHtml.replace(/\n/g, '').slice(0,600));
  const scriptSrcs = await fr.evaluate(() => Array.from(document.querySelectorAll('script')).map(s => s.src));
  console.log('iframe script srcs:', scriptSrcs);

  // capture console / errors while iframe scripts run
  const logs = [];
  page.on('console', msg => logs.push({type: 'console', text: msg.text()}));
  page.on('pageerror', err => logs.push({type: 'pageerror', text: String(err)}));

  // wait a bit to let scripts execute
  await page.waitForTimeout(3000);
  console.log('recent logs:', logs.slice(0, 20));

  // further diagnostics inside the iframe
  const diag = await fr.evaluate(() => ({
    ready: !!document.querySelector('.approach-grid'),
    rootExists: !!document.getElementById('root'),
    hasReactHook: !!(window.__REACT_DEVTOOLS_GLOBAL_HOOK__ ?? false),
    lsKey: (() => { try { return localStorage.getItem('chud.state.v1') } catch(e){ return String(e) } })(),
  }));
  console.log('iframe diag:', diag);

  await frameLocator.locator('.approach-grid').waitFor({ timeout: 15000 });
  const forceCard = frameLocator.locator('.approach-grid .core-card', { hasText: 'Force' }).first();
  if (!await forceCard.count()) {
    console.error('Force card not found inside iframe');
    await browser.close();
    process.exit(2);
  }

  // click and check visible value immediately
  await forceCard.click();
  const visible = await forceCard.locator('.core-value').innerText();
  console.log('visible after click (iframe):', visible.trim());

  // also check storage inside frame
  const stored = await fr.evaluate(() => {
    try {
      const raw = localStorage.getItem('chud.state.v1');
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null }
  });
  console.log('stored after click (iframe):', stored);

  await browser.close();
})();