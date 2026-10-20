// Full-resolution captures of the Moon visit, postcard and jump toy for visual review.
// Skipped unless STYLE_OUT is set: STYLE_OUT=design/<folder> npx playwright test e2e/style-capture.pw.ts --project=phone
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT = process.env.STYLE_OUT ?? '';
test.skip(!OUT, 'Set STYLE_OUT to capture.');
const snapshot = (page: Page) => page.evaluate(() => (window as any).spaceNinjaSnapshot());

for (const [name, viewport] of [
  ['tablet', { width: 768, height: 1024 }],
  ['phone', { width: 390, height: 844 }],
  ['landscape', { width: 844, height: 390 }],
] as const) {
  test.describe(name, () => {
    test.use({ viewport, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    test(`capture ${name}`, async ({ page }) => {
      mkdirSync(OUT, { recursive: true });
      await page.addInitScript(() => { Math.random = () => 0.1; });
      await page.goto('/?fast');
      await page.getByRole('button', { name: 'Start playing', exact: true }).click();
      await page.getByRole('button', { name: 'Fly to Moon', exact: true }).click();
      await expect.poll(async () => (await snapshot(page)).phase, { timeout: 200000 }).toBe('arrived');
      await expect(page.locator('.jump-btn')).toBeVisible();
      await page.waitForTimeout(2500);
      await page.screenshot({ path: join(OUT, `${name}-1-visit.png`) });

      const target = (await snapshot(page)).targets.find((t: any) => t.visible);
      await page.mouse.click(target.x, target.y);
      await expect(page.locator('.photo-view.is-reward')).toBeVisible();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: join(OUT, `${name}-2-postcard.png`) });
      await page.getByRole('button', { name: 'Keep exploring' }).click();
      await expect(page.locator('.photo-view')).toBeHidden();

      await page.locator('.jump-btn').click();
      await page.locator('.moon-jump__jump').click();
      await page.waitForTimeout(1700);
      await page.screenshot({ path: join(OUT, `${name}-3-jump.png`) });
    });
  });
}
