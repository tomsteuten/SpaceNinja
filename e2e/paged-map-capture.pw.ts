// Full-resolution captures of the paged Space map for review (design/paged-map): every page a
// child can see, on a portrait and a landscape phone, plus the hint carried by a page arrow.
// Skipped unless STYLE_OUT is set: STYLE_OUT=design/paged-map npx playwright test e2e/paged-map-capture.pw.ts --project=phone
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT = process.env.STYLE_OUT ?? '';
test.skip(!OUT, 'Set STYLE_OUT to capture.');
const snapshot = (page: Page) => page.evaluate(() => (window as any).spaceNinjaSnapshot());

async function open(page: Page, visited: string[]) {
  mkdirSync(OUT, { recursive: true });
  await page.addInitScript((seen) => {
    Math.random = () => 0.1;
    localStorage.setItem('spaceninja.sound.v1', 'off');
    localStorage.setItem('spaceninja.grownups.v1', 'yes');
    if (seen.length) localStorage.setItem('spaceninja.progress.v1', JSON.stringify({ visited: seen, discoveries: [], stickers: [] }));
  }, visited);
  await page.goto('/?fast');
  await expect(page.locator('.space-map')).toBeVisible();
}

async function turn(page: Page, direction: 'Previous' | 'Next', expected: number) {
  await page.getByRole('button', { name: new RegExp(`^${direction} worlds`) }).click();
  await expect.poll(async () => (await snapshot(page)).mapPage).toBe(expected);
}

for (const [name, viewport] of [
  ['portrait-360x740', { width: 360, height: 740 }],
  ['landscape-800x360', { width: 800, height: 360 }],
] as const) {
  test.describe(name, () => {
    test.use({ viewport, deviceScaleFactor: 1, reducedMotion: 'reduce', hasTouch: true });
    const shot = (page: Page, file: string) => page.screenshot({ path: join(OUT, `${name}-${file}.png`) });

    test(`every page ${name}`, async ({ page }) => {
      await open(page, []);
      await page.waitForTimeout(2000);
      await shot(page, '2-earth-moon-mars');
      await turn(page, 'Previous', 0);
      await page.waitForTimeout(1200);
      await shot(page, '1-sun');
      await turn(page, 'Next', 1);
      await turn(page, 'Next', 2);
      await page.waitForTimeout(1200);
      await shot(page, '3-saturn');
    });

    test(`hint on another page ${name}`, async ({ page }) => {
      // Earth, the Moon and Mars visited: the Sun is suggested, and the session opens on its
      // page. One page on, the previous arrow carries the hint.
      await open(page, ['earth', 'moon', 'mars']);
      await expect.poll(async () => (await snapshot(page)).mapPage).toBe(0);
      await page.waitForTimeout(1500);
      await shot(page, '5-sun-suggested');
      await turn(page, 'Next', 1);
      await page.waitForTimeout(1500);
      await shot(page, '4-hint-on-arrow');
    });

    test(`Saturn suggested ${name}`, async ({ page }) => {
      await open(page, ['earth', 'moon', 'mars', 'sun']);
      await expect.poll(async () => (await snapshot(page)).mapPage).toBe(2);
      await page.waitForTimeout(1500);
      await shot(page, '6-saturn-suggested');
    });
  });
}
