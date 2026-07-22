import { test, expect } from '@playwright/test';

// Run this with a local server and override CSMATRIX_URL when needed.

test.describe('csmatrix persistence', () => {
  test('add node persists to localStorage and survives reload', async ({ page }) => {
    const URL = process.env.CSMATRIX_URL || 'http://localhost:3031/collapse/csmatrix/index.html';
    await page.goto(URL, { waitUntil: 'networkidle' });
    // add a node via button
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

    // assert localStorage contains csmatrix.graph with nodes
    const raw = await page.evaluate(() => localStorage.getItem('csmatrix.graph'));
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string);
    expect(Array.isArray(parsed.nodes)).toBeTruthy();
    expect(parsed.nodes.length).toBeGreaterThan(0);

    // reload and assert the svg contains at least one node element
    await page.reload({ waitUntil: 'networkidle' });
    const nodesCount = await page.$$eval('svg g.node', els => els.length);
    expect(nodesCount).toBeGreaterThan(0);
  });
});
