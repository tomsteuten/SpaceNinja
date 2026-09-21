import { test, expect, attachShot } from './fixtures';
import type { Page } from '@playwright/test';

/**
 * Choosing a different world flies there — the body departs, the imagery swaps at the far
 * point, and the new world arrives — instead of the map cutting in place. This guards that the
 * journey engages (a `travel` phase, when motion is allowed), always lands on the world that
 * was chosen, and returns to a usable welcome screen from which Explore still works.
 */
const snapshot = (page: Page) => page.evaluate(() => (window as unknown as { moonTrialSnapshot(): { phase: string; renderedWorld: string; worldReady: boolean; world: string } }).moonTrialSnapshot());

test('choosing another world flies there and lands on it', async ({ page }, info) => {
  await page.goto('/');
  await expect(page.locator('#boot')).toBeHidden();
  const reduced = await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  // The default opens on Earth; pick a different world so a real hop is required.
  await page.locator('[data-world="mars"]').click();
  if (!reduced) {
    // With motion allowed the hop is visible before it settles.
    await expect.poll(async () => (await snapshot(page)).phase).toBe('travel');
  }
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
