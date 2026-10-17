import type { Page } from '@playwright/test';
import { test, expect, settleMapReturn } from './fixtures';

/*
 * Earth's hands-on day/night: one little house to watch into night and back into morning.
 * The first Earth visit is the rail (DECISIONS.md, line 4): the round trip suggests the Moon
 * and gently lights Space map. Done and Space map stay put throughout; no full turn needed.
 */

const snapshot = (page: Page) => page.evaluate(() => (window as any).spaceNinjaSnapshot());

async function drag(page: Page, dx: number) {
  const { width, height } = page.viewportSize()!;
  const x = width / 2 - dx / 2;
  await page.mouse.move(x, height * 0.5);
  await page.mouse.down();
  await page.mouse.move(x + dx, height * 0.5, { steps: 6 });
  await page.mouse.up();
}

/** Drags in whichever direction takes the house towards night, then back to morning. */
async function nightAndBack(page: Page) {
  await expect.poll(async () => (await snapshot(page)).daySpot?.facing ?? 0).toBeGreaterThan(0.2);
  const start = (await snapshot(page)).daySpot;
  expect(start.lit).toBe(true);
  expect(start.sunlight).toBeGreaterThan(0);
  await drag(page, 50);
  await page.waitForFunction(n => (window as any).spaceNinjaSnapshot().frame > n + 2, (await snapshot(page)).frame);
  const direction = (await snapshot(page)).daySpot.sunlight < start.sunlight ? 50 : -50;
  for (let i = 0; i < 30 && (await snapshot(page)).daySpot.lit; i++) await drag(page, direction);
  await expect.poll(async () => (await snapshot(page)).daySpot.lit).toBe(false);
  await expect(page.locator('.world-heading__caption')).toHaveText('Night time! The lights come on.');
  for (let i = 0; i < 30 && !(await snapshot(page)).daySpot.roundTrip; i++) await drag(page, -direction);
  await expect.poll(async () => (await snapshot(page)).daySpot.roundTrip).toBe(true);
}

test('the day/night house goes into night and back, then suggests the Moon without moving Space map', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start playing', exact: true }).click();
  await page.getByRole('button', { name: 'Fly to Earth', exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).phase).toBe('arrived');

  const map = page.getByRole('button', { name: 'Back to the space map', exact: true });
  const done = page.getByRole('button', { name: 'Stop day and night' });
  await page.getByRole('button', { name: 'Day and night on Earth' }).click();
  await expect(done).toBeVisible();
  await expect.poll(async () => (await snapshot(page)).teachingSun.visible).toBe(true);
  await expect(page.locator('.world-heading__caption')).toHaveText('Turn Earth. Take the little house into night.');

  const mapBefore = await map.boundingBox();
  const spot = (await snapshot(page)).daySpot;
  const { width, height } = page.viewportSize()!;
  expect(spot.x).toBeGreaterThan(0);
  expect(spot.x).toBeLessThan(width);
  expect(spot.y).toBeGreaterThan(0);
  expect(spot.y).toBeLessThan(height);

  await nightAndBack(page);
  await expect(page.locator('.world-heading__caption')).toHaveText('Morning again! Next, fly to the Moon.');
  expect((await snapshot(page)).mapInvite).toBe(true);
  // Nothing hid or moved; Done was there the whole time.
  await expect(map).toBeVisible();
  await expect(done).toBeEnabled();
  const mapAfter = await map.boundingBox();
  for (const key of ['x', 'y', 'width', 'height'] as const) {
    expect(Math.abs(mapAfter![key] - mapBefore![key])).toBeLessThan(1.5);
  }

  // Done ends it cleanly: the house leaves, the invitation ends, the hunt begins.
  await done.click();
  await expect.poll(async () => (await snapshot(page)).dayTurning).toBe(false);
  expect((await snapshot(page)).daySpot).toBeNull();
  expect((await snapshot(page)).mapInvite).toBe(false);
  await expect.poll(async () => (await snapshot(page)).guidedHunt).toBe(true);

  // A later visit is open-ended: the same round trip suggests turning more or Done instead.
  await map.click();
  const fly = page.getByRole('button', { name: 'Fly to Earth', exact: true });
  await expect(fly).toBeVisible();
  await settleMapReturn(page);
  await fly.click();
  await expect.poll(async () => (await snapshot(page)).phase).toBe('arrived');
  await page.getByRole('button', { name: 'Day and night on Earth' }).click();
  await expect(done).toBeVisible();
  await nightAndBack(page);
  await expect(page.locator('.world-heading__caption')).toHaveText('Morning again! Turn more, or tap Done.');
  expect((await snapshot(page)).mapInvite).toBe(false);

  // Leaving mid-turn takes the house with it.
  await map.click();
  await expect.poll(async () => (await snapshot(page)).phase).toBe('idle');
  expect((await snapshot(page)).daySpot).toBeNull();
});
