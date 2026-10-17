import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';

test.use({ reducedMotion: 'reduce' });

type Box = { x: number; y: number; width: number; height: number };

/**
 * A destination whose button lies clear of the old Space map button (plus the guard's 12px
 * tolerance), so tapping it straight away is a different, deliberate choice. Which one that
 * is depends on the layout: on short landscape the Sun sits under the old button.
 */
async function destinationClearOf(page: Page, home: Box, worlds: string[]): Promise<string> {
  for (const world of worlds) {
    const box = await page.getByRole('button', { name: `Fly to ${world}`, exact: true }).boundingBox();
    if (!box) continue;
    const clear = box.x > home.x + home.width + 12 || box.x + box.width < home.x - 12 ||
      box.y > home.y + home.height + 12 || box.y + box.height < home.y - 12;
    if (clear) return world;
  }
  throw new Error('Every destination lies under the old Space map button');
}

test('repeated Space map taps cannot launch the destination underneath the old button', async ({ page }) => {
  const snapshot = () => page.evaluate(() => (window as any).spaceNinjaSnapshot());
  await page.goto('/');
  await page.getByRole('button', { name: 'Start playing', exact: true }).click();
  await page.getByRole('button', { name: 'Fly to Earth', exact: true }).click();
  await expect.poll(async () => (await snapshot()).phase).toBe('arrived');
  await page.getByRole('button', { name: 'Find places', exact: true }).click();
  const home = (await page.getByRole('button', { name: 'Back to the space map', exact: true }).boundingBox())!;
  const x = home.x + home.width / 2;
  const y = home.y + home.height / 2;
  // One browser command preserves the true rapid double-click sequence.
  await page.mouse.dblclick(x, y, { delay: 80 });
  await expect.poll(async () => (await snapshot()).phase).toBe('idle');
  // An intentional different choice remains available; there is no global map cooldown.
  expect(await destinationClearOf(page, home, ['Moon'])).toBe('Moon');
  await page.getByRole('button', { name: 'Fly to Moon', exact: true }).tap();
  await expect.poll(async () => (await snapshot()).phase).not.toBe('idle');
  await expect.poll(async () => (await snapshot()).phase).toBe('arrived');
  const moonHome = (await page.getByRole('button', { name: 'Back to the space map', exact: true }).boundingBox())!;
  // A separate return: the two clicks are roughly a second apart. Keeping them in one
  // command avoids inserting state-query/render latency into the gesture under test.
  // Exact 1000ms/1200ms boundaries are covered by mapReturnGuard.test.ts.
  await page.mouse.dblclick(moonHome.x + moonHome.width / 2, moonHome.y + moonHome.height / 2, { delay: 500 });
  await expect.poll(async () => (await snapshot()).phase).toBe('idle');
  const next = await destinationClearOf(page, moonHome, ['Sun', 'Mars', 'Earth']);
  await page.getByRole('button', { name: `Fly to ${next}`, exact: true }).tap();
  await expect.poll(async () => (await snapshot()).phase).toBe('arrived');
  const nextHome = (await page.getByRole('button', { name: 'Back to the space map', exact: true }).boundingBox())!;
  // Native touch input, without a state query between the repeated taps.
  await page.touchscreen.tap(nextHome.x + nextHome.width / 2, nextHome.y + nextHome.height / 2);
  await page.touchscreen.tap(nextHome.x + nextHome.width / 2, nextHome.y + nextHome.height / 2);
  await expect.poll(async () => (await snapshot()).phase).toBe('idle');
  // Keyboard activation is immediately available even over the protected footprint.
  await page.getByRole('button', { name: 'Fly to Earth', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await snapshot()).phase).not.toBe('idle');
});
