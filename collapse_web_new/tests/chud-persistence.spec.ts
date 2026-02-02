import { test, expect } from '@playwright/test';

const URL = 'http://localhost:3030/collapse/#/chud';
const STORAGE_KEY = 'chud.state.v1';

test('approach values persist across reload', async ({ page }) => {
  await page.goto(URL);
  // wait for approach grid
  await page.waitForSelector('.approach-grid');

  // find Force card and click it
  const forceCard = await page.locator('.approach-grid .core-card', { hasText: 'Force' }).first();
  await forceCard.click();

  // read stored state
  const stored = await page.evaluate((k) => {
    try {
      const raw = localStorage.getItem(k);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }, STORAGE_KEY);

  expect(stored).not.toBeNull();
  expect(typeof stored.approach === 'object').toBeTruthy();
  expect(stored.approach.force).toBeGreaterThanOrEqual(1);

  // Reload and verify UI reflects the stored value
  await page.reload();
  await page.waitForSelector('.approach-grid');

  const forceValue = await page.locator('.approach-grid .core-card:has-text("Force") .core-value').innerText();
  expect(Number(forceValue)).toBeGreaterThanOrEqual(1);
});