// Full-resolution captures of every child-facing screen for visual review: home map, Moon
// visit, postcard, jump toy, Earth hunt, Words card, day/night, journal, hunt arrow, finale
// and grown-ups panel.
// Skipped unless STYLE_OUT is set: STYLE_OUT=design/<folder> npx playwright test e2e/style-capture.pw.ts --project=phone
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { DESTINATIONS, DISCOVERIES } from '../src/config';

const OUT = process.env.STYLE_OUT ?? '';
test.skip(!OUT, 'Set STYLE_OUT to capture.');
const snapshot = (page: Page) => page.evaluate(() => (window as any).spaceNinjaSnapshot());

async function start(page: Page, query = '/?fast', progress?: object) {
  mkdirSync(OUT, { recursive: true });
  await page.addInitScript((saved) => {
    Math.random = () => 0.1;
    localStorage.setItem('spaceninja.sound.v1', 'off');
    if (saved) localStorage.setItem('spaceninja.progress.v1', saved);
  }, progress ? JSON.stringify(progress) : null);
  await page.goto(query);
}

async function fly(page: Page, world: string) {
  await page.getByRole('button', { name: 'Start playing', exact: true }).click();
  await page.getByRole('button', { name: `Fly to ${world}`, exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).phase, { timeout: 200000 }).toBe('arrived');
}

for (const [name, viewport] of [
  ['tablet', { width: 768, height: 1024 }],
  ['phone', { width: 390, height: 844 }],
  ['landscape', { width: 844, height: 390 }],
] as const) {
  test.describe(name, () => {
    test.use({ viewport, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    const shot = (page: Page, file: string) => page.screenshot({ path: join(OUT, `${name}-${file}.png`) });

    test(`moon ${name}`, async ({ page }) => {
      await start(page);
      await page.getByRole('button', { name: 'Start playing', exact: true }).click();
      await expect(page.locator('.destination-bar')).toBeVisible();
      await page.waitForTimeout(1500);
      await shot(page, '0-home');
      await page.getByRole('button', { name: 'Fly to Moon', exact: true }).click();
      await expect.poll(async () => (await snapshot(page)).phase, { timeout: 200000 }).toBe('arrived');
      await expect(page.locator('.jump-btn')).toBeVisible();
      await page.waitForTimeout(2500);
      await shot(page, '1-visit');

      const target = (await snapshot(page)).targets.find((t: any) => t.visible);
      await page.mouse.click(target.x, target.y);
      await expect(page.locator('.photo-view.is-reward')).toBeVisible();
      await page.waitForTimeout(1500);
      await shot(page, '2-postcard');
      await page.getByRole('button', { name: 'Keep exploring' }).click();
      await expect(page.locator('.photo-view')).toBeHidden();
      await page.waitForTimeout(1000);
      await shot(page, '2b-found');

      await page.locator('.jump-btn').click();
      await page.locator('.moon-jump__jump').click();
      await page.waitForTimeout(1700);
      await shot(page, '3-jump');
    });

    test(`earth ${name}`, async ({ page }) => {
      await start(page);
      await fly(page, 'Earth');
      await page.waitForTimeout(1500);
      await shot(page, '4-earth-welcome');
      await page.getByRole('button', { name: 'Find places', exact: true }).click();
      await expect(page.locator('.mission-hud')).toBeVisible();
      await page.waitForTimeout(1000);
      await page.getByRole('button', { name: 'Words', exact: true }).click();
      await page.waitForTimeout(1000);
      await shot(page, '5-words');
      await page.waitForTimeout(650);
      await page.getByRole('button', { name: 'Close the words', exact: true }).click();

      await page.locator('.spin-btn').click();
      const toy = page.locator('.bedtime-spin');
      await expect(toy).toBeVisible();
      for (let i = 0; i < 2; i++) { await toy.getByRole('button', { name: 'Turn Earth' }).click(); await page.waitForTimeout(800); }
      await page.waitForTimeout(1500);
      await shot(page, '6-day-night');
      await toy.getByRole('button', { name: 'Back to Earth' }).click();
      await expect(toy).toHaveCount(0);

      await page.locator('.visit-actions .journal-btn').click();
      await expect(page.locator('.journal-panel')).toBeVisible();
      await page.waitForTimeout(1000);
      await shot(page, '7-journal');
    });

    test(`finale ${name}`, async ({ page }) => {
      // Everything found but one Moon place, so this visit finishes the whole game.
      const moon = DESTINATIONS.moon!.mission!.discoveries.map((d) => d.id);
      const all = Object.keys(DISCOVERIES).filter((id) => id !== moon[moon.length - 1]);
      await start(page, '/?fast', { discoveries: all, stickers: [], visited: Object.keys(DESTINATIONS) });
      await fly(page, 'Moon');
      for (let i = 0; i < 3; i++) {
        let target = (await snapshot(page)).targets.find((t: any) => t.visible);
        if (!target) {
          await expect(page.locator('.hunt-arrow')).toBeVisible();
          await page.waitForTimeout(800);
          await shot(page, '8-hunt-arrow');
          await page.locator('.hunt-arrow').click();
          await expect.poll(async () => (await snapshot(page)).targets.some((t: any) => t.visible)).toBe(true);
          target = (await snapshot(page)).targets.find((t: any) => t.visible);
        }
        // A place found on an earlier visit just counts; only the new one opens a postcard.
        await page.mouse.click(target.x, target.y);
        await expect.poll(async () => (await snapshot(page)).collected).toBe(i + 1);
        await page.waitForTimeout(1000);
        if (await page.locator('.photo-view').isVisible()) {
          await page.getByRole('button', { name: 'Close the photo', exact: true }).click();
          await expect(page.locator('.photo-view')).toBeHidden();
        }
      }
      await expect(page.locator('.finale')).toBeVisible({ timeout: 20000 });
      await page.waitForTimeout(2500);
      await shot(page, '9-finale');
    });

    test(`grownups ${name}`, async ({ page }) => {
      await start(page, '/?grownups');
      await expect(page.getByRole('dialog', { name: 'Grown-ups settings' })).toBeVisible();
      await page.waitForTimeout(800);
      await shot(page, '10-grownups');
    });
  });
}
