// Before/after captures for "make done visible" (fix 5, design/done-visible). Each state is shot
// as the build shows it, then again with design/done-visible/mock.{css,js} applied over it.
// Skipped unless STYLE_OUT is set: STYLE_OUT=design/done-visible/shots npx playwright test e2e/done-visible-capture.pw.ts --project=phone
// Runs both viewports whichever project is named.
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { DISCOVERIES } from '../src/config';

const OUT = process.env.STYLE_OUT ?? '';
test.skip(!OUT, 'Set STYLE_OUT to capture.');
const snapshot = (page: Page) => page.evaluate(() => (window as any).spaceNinjaSnapshot());
const all = (world: string) => Object.keys(DISCOVERIES).filter(id => id.startsWith(world + '-'));

async function start(page: Page, progress?: object) {
  await page.addInitScript((saved) => {
    Math.random = () => 0.1;
    localStorage.setItem('spaceninja.sound.v1', 'off');
    if (saved && !sessionStorage.getItem('seeded')) {
      localStorage.setItem('spaceninja.progress.v1', saved);
      sessionStorage.setItem('seeded', '1');
    }
  }, progress ? JSON.stringify(progress) : null);
  await page.goto('/?fast');
  const startButton = page.getByRole('button', { name: 'Start playing', exact: true });
  // The splash shows whenever the grown-ups note has not been acknowledged; wait for it rather than race it.
  if (await startButton.waitFor({ timeout: 30000 }).then(() => true, () => false)) await startButton.click();
  await page.waitForTimeout(2500);
}

async function mock(page: Page) {
  await page.addStyleTag({ path: 'design/done-visible/mock.css' });
  await page.addScriptTag({ path: 'design/done-visible/mock.js' });
}

async function tapNext(page: Page) {
  const found = (await snapshot(page)).collected;
  for (let attempt = 0; attempt < 3 && (await snapshot(page)).collected === found; attempt++) {
    let target = (await snapshot(page)).targets.find((t: any) => t.visible);
    if (!target) {
      await page.locator('.hunt-arrow').click();
      await expect.poll(async () => (await snapshot(page)).targets.some((t: any) => t.visible)).toBe(true);
      target = (await snapshot(page)).targets.find((t: any) => t.visible);
    }
    await page.mouse.click(target.x, target.y);
    await expect.poll(async () => (await snapshot(page)).collected, { timeout: 10000 }).toBe(found + 1).catch(() => {});
  }
  expect((await snapshot(page)).collected).toBe(found + 1);
  await expect(page.locator('.photo-view')).toBeVisible({ timeout: 8000 }).catch(() => {});
  if (await page.locator('.photo-view').isVisible()) {
    await page.waitForTimeout(650);
    await page.getByRole('button', { name: 'Keep exploring' }).click();
    await expect(page.locator('.photo-view')).toBeHidden();
  }
}

/** Fly, find the visit's three places, and open the journal from the visit (shown or held). */
async function finishVisit(page: Page, world: string) {
  await page.getByRole('button', { name: `Fly to ${world}`, exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).phase, { timeout: 200000 }).toBe('arrived');
  const findPlaces = page.getByRole('button', { name: 'Find places', exact: true });
  if (await findPlaces.isVisible()) await findPlaces.click();
  for (let i = 0; i < 3; i++) await tapNext(page);
  await page.waitForTimeout(1500);
  const before = new Set<string>(await page.evaluate(() => JSON.parse(localStorage.getItem('spaceninja.progress.v1')!).discoveries));
  await page.evaluate(() => (document.querySelector('.visit-actions .journal-btn') as HTMLElement).click());
  await expect(page.locator('.journal-panel')).toBeVisible();
  await page.waitForTimeout(800);
  return [...before].filter(id => id.startsWith(world.toLowerCase() + '-')).slice(-3);
}

for (const [name, viewport] of [
  ['phone', { width: 390, height: 844 }],
  ['tablet', { width: 768, height: 1024 }],
] as const) {
  test.describe(name, () => {
    test.use({ viewport, deviceScaleFactor: 1, reducedMotion: 'reduce', hasTouch: false });
    const shot = (page: Page, file: string) => page.screenshot({ path: join(OUT, `${name}-${file}.png`), timeout: 180000 });

    test('journal after the first finished visit', async ({ page }) => {
      test.setTimeout(900000);
      mkdirSync(OUT, { recursive: true });
      await start(page);
      const trip = await finishVisit(page, 'Earth');
      await shot(page, '1-journal-first-before');
      await mock(page);
      await page.evaluate(ids => (window as any).doneMock.journal('earth', ids), trip);
      await shot(page, '1-journal-first-after');
    });

    test('journal mid-game', async ({ page }) => {
      test.setTimeout(900000);
      mkdirSync(OUT, { recursive: true });
      await start(page, { visited: ['earth', 'moon'], stickers: [], discoveries: [...all('earth'), ...all('moon').slice(0, 3)] });
      const trip = await finishVisit(page, 'Mars');
      await shot(page, '2-journal-mid-before');
      await mock(page);
      await page.evaluate(ids => (window as any).doneMock.journal('mars', ids), trip);
      await shot(page, '2-journal-mid-after');
    });

    test('map with every world visited', async ({ page }) => {
      test.setTimeout(300000);
      mkdirSync(OUT, { recursive: true });
      await start(page, {
        visited: ['earth', 'moon', 'mars', 'saturn'], stickers: [],
        discoveries: [...all('earth'), ...all('moon').slice(0, 3), ...all('mars').slice(0, 3), ...all('saturn').slice(0, 3)],
      });
      await shot(page, '3-map-all-visited-before');
      await mock(page);
      await page.evaluate(() => (window as any).doneMock.map());
      await shot(page, '3-map-all-visited-after');
    });
  });
}
