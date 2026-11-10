// Full-resolution before/after captures of the Space map's "what next" states for review
// (design/map-next). Uses only markup that existed before the change, so the same file runs
// against an older build for the "before" set.
// Skipped unless STYLE_OUT is set: STYLE_OUT=design/map-next/after npx playwright test e2e/map-next-capture.pw.ts --project=phone
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT = process.env.STYLE_OUT ?? '';
test.skip(!OUT, 'Set STYLE_OUT to capture.');
test.use({ deviceScaleFactor: 1 });
const snapshot = (page: Page) => page.evaluate(() => (window as any).spaceNinjaSnapshot());

async function visitAndReturn(page: Page, world: string) {
  await expect.poll(async () => (await snapshot(page)).mapReturnGuarded).toBe(false);
  await page.getByRole('button', { name: `Fly to ${world}`, exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).phase, { timeout: 200000 }).toBe('arrived');
  const findPlaces = page.getByRole('button', { name: 'Find places', exact: true });
  if (await findPlaces.isVisible()) await findPlaces.click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'Back to the space map', exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).phase, { timeout: 200000 }).toBe('idle');
  await expect(page.locator('.space-map')).toBeVisible();
}

for (const [name, viewport] of [
  ['tablet', { width: 768, height: 1024 }],
  ['phone', { width: 390, height: 844 }],
] as const) {
  test(`${name} map next steps`, async ({ page }) => {
    test.setTimeout(900000);
    await page.setViewportSize(viewport);
    mkdirSync(OUT, { recursive: true });
    const shot = (file: string) => page.screenshot({ path: join(OUT, `${name}-${file}.png`) });
    await page.addInitScript(() => {
      Math.random = () => 0.1;
      localStorage.setItem('spaceninja.sound.v1', 'off');
    });
    await page.goto('/?fast');
    await page.getByRole('button', { name: 'Start playing', exact: true }).click();
    await page.waitForTimeout(2500);
    await shot('1-first-map');

    // The locked-tap and unlock shots are retired: nothing is locked (DECISIONS.md).
    await visitAndReturn(page, 'Earth');
    await page.waitForTimeout(2500);
    await shot('3-map-after-earth');

    await visitAndReturn(page, 'Moon');
    await page.waitForTimeout(2500);
    await shot('5-map-after-moon');

    await visitAndReturn(page, 'Mars');
    await page.waitForTimeout(3000);
    await shot('6-map-after-mars');
  });
}
