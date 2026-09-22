import { test, expect, attachShot } from './fixtures';
import type { Page } from '@playwright/test';

/**
 * Choosing a different world flies there — the body departs, the imagery swaps at the far
 * point, and the new world arrives — instead of the map cutting in place. This guards that the
 * journey engages (a `travel` phase, when motion is allowed), always lands on the world that
 * was chosen, and returns to a usable welcome screen from which Explore still works.
 */
const snapshot = (page: Page) => page.evaluate(() => (window as unknown as { moonTrialSnapshot(): { phase: string; renderedWorld: string; worldReady: boolean; world: string } }).moonTrialSnapshot());

test.use({ reducedMotion: 'no-preference' });

test('choosing another world flies there and lands on it', async ({ page }, info) => {
  await page.goto('/');
  await expect(page.locator('#boot')).toBeHidden();
  await expect.poll(async () => (await snapshot(page)).phase).toBe('welcome');
  // The default opens on Earth; pick a different world so a real hop is required.
  await page.locator('[data-world="mars"]').click();
  await expect(page.locator('.moon-start')).toBeDisabled();
  // With motion explicitly enabled the hop is visible before it settles.
  await expect.poll(async () => (await snapshot(page)).phase).toBe('travel');
  await expect.poll(async () => (await snapshot(page)).worldReady).toBe(true);
  const settled = await snapshot(page);
  expect(settled.renderedWorld).toBe('mars');
  expect(settled.phase).toBe('welcome');
  await attachShot(page, 'travel-arrived-mars', info);
  // The welcome screen is fully usable after arriving: Explore descends to the surface.
  await expect(page.locator('.moon-start')).toBeEnabled();
  await page.locator('.moon-start').click();
  await expect.poll(async () => (await snapshot(page)).phase).toBe('explore');
  expect((await snapshot(page)).world).toBe('mars');
});

test('the opening fly-in gives a canvas tap an immediate response', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#boot')).toBeHidden();
  await expect.poll(async () => (await snapshot(page)).phase).toBe('travel');
  await page.locator('canvas').click({ position: { x: 10, y: 10 } });
  await expect.poll(async () => (await snapshot(page)).phase).toBe('approach');
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('a stale slow load cannot repaint the newest world', async ({ page }) => {
    let release!: () => void;
    let marsReleased!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    const marsFinished = new Promise<void>(resolve => { marsReleased = resolve; });
    await page.route('**/assets/mars.jpg', async route => {
      await held;
      await route.continue();
      marsReleased();
    });

    await page.goto('/');
    await expect(page.locator('#boot')).toBeHidden();
    await page.locator('[data-world="mars"]').click();
    await expect(page.locator('.moon-start')).toBeDisabled();
    await page.locator('[data-world="earth"]').click();
    await expect(page.locator('.moon-start')).toBeEnabled();

    release();
    await marsFinished;
    await page.waitForTimeout(700);
    const settled = await snapshot(page);
    expect(settled.world).toBe('earth');
    expect(settled.renderedWorld).toBe('earth');
  });
});
