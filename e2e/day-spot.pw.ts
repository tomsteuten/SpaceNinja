import type { Page } from '@playwright/test';
import { test, expect, settleMapReturn } from './fixtures';

test.use({ deviceScaleFactor: 1 });

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
  await expect(page.locator('.world-heading__caption')).toHaveText('Night time! Bring back morning.');
  await expect(page.locator('.day-legend .night-key')).toHaveClass(/is-current/);
  for (let i = 0; i < 30 && !(await snapshot(page)).daySpot.roundTrip; i++) await drag(page, -direction);
  await expect.poll(async () => (await snapshot(page)).daySpot.roundTrip).toBe(true);
}

test('the day/night house goes into night and back, then suggests the Moon without moving Space map', async ({ page }) => {
  const cues = new Set<string>();
  page.on('request', request => {
    const cue = request.url().match(/day-night-(start|night|moon|done)/)?.[1];
    if (cue) cues.add(cue);
  });
  await page.goto('/?fast');
  await page.getByRole('button', { name: 'Start playing', exact: true }).click();
  await page.getByRole('button', { name: 'Fly to Earth', exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).phase).toBe('arrived');

  const map = page.getByRole('button', { name: 'Back to the space map', exact: true });
  const done = page.getByRole('button', { name: 'Stop day and night' });
  await page.getByRole('button', { name: 'Day and night on Earth' }).click();
  await expect(done).toBeVisible();
  await expect.poll(async () => (await snapshot(page)).teachingSun.visible).toBe(true);
  await expect(page.locator('.world-heading__caption')).toHaveText('Turn Earth. Watch your house.');
  await expect.poll(() => cues.has('start')).toBe(true);
  await expect(page.locator('.day-legend .day-key')).toHaveClass(/is-current/);

  const mapBefore = await map.boundingBox();
  const { width, height } = page.viewportSize()!;
  // The day-turn camera settles over a few frames; wait for the house to come into view
  // rather than sampling the first frame (short landscape on CI read it mid-move).
  await expect.poll(async () => {
    const s = (await snapshot(page)).daySpot;
    return Boolean(s && s.x > 0 && s.x < width && s.y > 0 && s.y < height);
  }).toBe(true);
  const spot = (await snapshot(page)).daySpot;
  expect(spot.x).toBeGreaterThan(0);
  expect(spot.x).toBeLessThan(width);
  expect(spot.y).toBeGreaterThan(0);
  expect(spot.y).toBeLessThan(height);

  await nightAndBack(page);
  await expect.poll(() => cues.has('night') && cues.has('moon')).toBe(true);
  await expect(page.locator('.day-legend .day-key')).toHaveText('Morning!');
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
  await expect.poll(() => cues.has('done')).toBe(true);
  await expect(page.locator('.world-heading__caption')).toHaveText('Morning again! Turn more, or tap Done.');
  expect((await snapshot(page)).mapInvite).toBe(false);

  // Leaving mid-turn takes the house with it.
  await map.click();
  await expect.poll(async () => (await snapshot(page)).phase).toBe('idle');
  expect((await snapshot(page)).daySpot).toBeNull();
});

test('muted play keeps house feedback and both immediate exits, without starting narration', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.setItem('spaceninja.sound.v1', 'off'));
  const activityAudio: string[] = [];
  page.on('request', request => { if (/day-night-.*\.mp3/.test(request.url())) activityAudio.push(request.url()); });
  await page.goto('/?fast');
  await page.getByRole('button', { name: 'Start playing', exact: true }).click();
  await page.getByRole('button', { name: 'Fly to Earth', exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).phase).toBe('arrived');
  await page.getByRole('button', { name: 'Day and night on Earth' }).click();
  await expect.poll(async () => (await snapshot(page)).daySpot?.radius ?? 0).toBeGreaterThan(16);
  const spot = (await snapshot(page)).daySpot;
  const hand = await page.locator('.day-gesture').boundingBox();
  expect(hand).not.toBeNull();
  // The coach must not cover the subject the child is asked to watch.
  expect(spot.x + spot.radius < hand!.x || spot.x - spot.radius > hand!.x + hand!.width ||
    spot.y + spot.radius < hand!.y || spot.y - spot.radius > hand!.y + hand!.height).toBe(true);
  const saved = await page.evaluate(() => localStorage.getItem('spaceninja.progress.v1'));
  await nightAndBack(page);
  await expect(page.locator('.day-legend .day-key')).toHaveText('Morning!');
  const caption = await page.locator('.world-heading__caption').boundingBox();
  const legend = await page.locator('.day-legend').boundingBox();
  expect(caption!.x + caption!.width <= legend!.x || caption!.y >= legend!.y + legend!.height,
    'The morning indicator must leave the instruction readable').toBe(true);
  expect((await snapshot(page)).speaking).toBe(false);
  expect(activityAudio).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem('spaceninja.progress.v1'))).toBe(saved);
  await page.getByRole('button', { name: 'Stop day and night' }).click();
  await expect.poll(async () => (await snapshot(page)).daySpot).toBeNull();
  await expect.poll(async () => (await snapshot(page)).cameraReturning).toBe(false);
  await page.getByRole('button', { name: 'Day and night on Earth' }).click();
  // Leave the next activity immediately, without a turn or acknowledgement.
  await page.getByRole('button', { name: 'Back to the space map', exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).phase).toBe('idle');
  expect((await snapshot(page)).daySpot).toBeNull();
  await expect(page.locator('.day-legend')).toBeHidden();
});
