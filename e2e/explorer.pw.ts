import { test, expect, attachShot } from './fixtures';
import type { Page } from '@playwright/test';

const snapshot = (page: Page) => page.evaluate(() => (window as any).spaceNinjaSnapshot());
// Software WebGL stretches the seven-second flight; wait on state, never on the clock.
const LONG = { timeout: 150_000 };

async function boot(page: Page) {
  await page.goto('/');
  await expect(page.locator('#boot')).toBeHidden();
  await expect.poll(async () => (await snapshot(page)).phase).toBe('system');
}

async function flyTo(page: Page, name: string) {
  await page.getByRole('button', { name: new RegExp(`^Fly to ${name}`) }).click();
  await expect.poll(async () => (await snapshot(page)).phase, LONG).toBe('exploring');
}

test('the solar system, a flight out, close exploration, a find and the way home', async ({ page }, info) => {
  await boot(page);
  await expect(page.getByRole('navigation', { name: 'Choose a world' }).getByRole('button')).toHaveCount(4);
  await attachShot(page, 'system', info);

  const mars = page.getByRole('button', { name: /^Fly to Mars/ });
  await mars.click();
  expect((await snapshot(page)).phase).toBe('flying');
  // The row is gone mid-flight, and a forced second press cannot begin another journey.
  await expect(mars).toBeHidden();
  await page.locator('[data-world="mars"]').dispatchEvent('click');
  expect((await snapshot(page)).phase).not.toBe('system');
  await expect.poll(async () => (await snapshot(page)).phase, LONG).toBe('exploring');

  const arrived = await snapshot(page);
  expect(arrived.world).toBe('mars');
  // Close to the ground, not the solar-system framing: the explorer's surface view.
  expect(arrived.cameraAltitude).toBeLessThan(1);
  expect(arrived.beacons).toHaveLength(6);
  await expect(page.getByRole('button', { name: /Solar system/ })).toBeVisible();
  await attachShot(page, 'exploring', info);

  // Hold to fly, release to stop. Press clear of the place pictures: pressing one of those
  // glides to it instead, which is the next test.
  const { width, height } = page.viewportSize()!;
  const hold = [[0.5, 0.3], [0.3, 0.4], [0.7, 0.4], [0.5, 0.55]]
    .map(([x, y]) => ({ x: width * x!, y: height * y! }))
    .map((point) => ({ point, clearance: Math.min(...arrived.beacons.filter((b: any) => b.visible).map((b: any) => Math.hypot(b.x - point.x, b.y - point.y)), Infinity) }))
    .sort((a, b) => b.clearance - a.clearance)[0]!.point;
  await page.mouse.move(hold.x, hold.y);
  await page.mouse.down();
  await expect.poll(async () => (await snapshot(page)).speed).toBeGreaterThan(0);
  await page.waitForTimeout(1200);
  await page.mouse.up();
  await expect.poll(async () => (await snapshot(page)).speed).toBe(0);
  const flown = await snapshot(page);
  expect(Math.abs(flown.latitude - arrived.latitude) + Math.abs(flown.longitude - arrived.longitude)).toBeGreaterThan(0.1);

  // Places glides to a place; arriving over it finds it.
  await page.getByRole('button', { name: 'Places', exact: true }).click();
  await expect(page.locator('.place-option')).toHaveCount(6);
  await page.locator('[data-place="mars-olympus"]').click();
  await expect.poll(async () => (await snapshot(page)).found, LONG).toContain('mars-olympus');
  await expect(page.locator('.ex-landmark')).toContainText('Olympus Mons');
  await attachShot(page, 'found', info);

  await page.getByRole('button', { name: /Take a look/ }).click();
  await expect(page.locator('.photo-viewport img')).toBeVisible();
  expect(await page.locator('.photo-source').getAttribute('href')).toMatch(/^https:\/\/.+\/.+/);
  await attachShot(page, 'postcard', info);
  await page.getByRole('button', { name: 'Keep exploring' }).click();

  await page.getByRole('button', { name: 'Open your journal' }).click();
  await expect(page.locator('[data-postcard="mars-olympus"]')).toBeVisible();
  await expect(page.locator('.journal-grid .postcard.is-empty')).toHaveCount(5);
  await attachShot(page, 'journal', info);
  await page.keyboard.press('Escape');
  await expect(page.locator('.journal-dialog')).toBeHidden();

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('spaceninja.progress.v1')!));
  expect(saved.discoveries).toContain('mars-olympus');
  expect(saved.visited).toContain('mars');

  await page.getByRole('button', { name: /Solar system/ }).click();
  await expect.poll(async () => (await snapshot(page)).phase, LONG).toBe('system');
  await expect(page.locator('[data-world="mars"] .ex-dots i.is-found')).toHaveCount(1);
  await attachShot(page, 'home-again', info);
});

test('a picture on the world is a way to get there, and far-side pictures cannot be touched', async ({ page }, info) => {
  await boot(page);
  await flyTo(page, 'Earth');
  const { beacons } = await snapshot(page);
  const { width, height } = page.viewportSize()!;
  // Clear of the corner controls and the dock, so the press reaches the scene.
  const onScreen = beacons.filter((b: any) => b.visible && b.x > 40 && b.x < width - 40 && b.y > 76 && b.y < height - 84);
  expect(onScreen.length, 'a place picture in view after landing').toBeGreaterThan(0);
  // Pictures round the back are hidden, not merely drawn behind the globe.
  expect(beacons.some((b: any) => !b.visible)).toBe(true);
  await attachShot(page, 'badges', info);
  const target = onScreen[0];
  await page.mouse.click(target.x, target.y);
  await expect.poll(async () => (await snapshot(page)).found, LONG).toContain(target.id);
  expect((await snapshot(page)).steering).toBe(false);
});

test('a grown-up reset mid-visit returns to the solar system, and the next flight still works', async ({ page }) => {
  await boot(page);
  await flyTo(page, 'Moon');
  await page.getByRole('button', { name: 'Places', exact: true }).click();
  await page.locator('.place-option').first().click();
  await expect.poll(async () => (await snapshot(page)).found.length, LONG).toBeGreaterThan(0);

  await page.getByRole('button', { name: 'Grown-up settings' }).click();
  await expect(page.getByRole('heading', { name: 'Fly it yourself' })).toBeVisible();
  await page.getByRole('button', { name: 'Start a new adventure' }).click();
  await page.getByRole('button', { name: 'Tap again to erase the journal' }).click();
  await expect.poll(async () => (await snapshot(page)).phase).toBe('system');
  expect((await snapshot(page)).found).toEqual([]);
  await expect(page.locator('.ex-dots i.is-found')).toHaveCount(0);

  await flyTo(page, 'Mars');
  expect((await snapshot(page)).world).toBe('mars');
});

test('keyboard flight, zoom limits and a missing photograph that stays escapable', async ({ page }) => {
  // An undecodable image rather than a 404, which the browser would also log as a console error.
  await page.route('**/assets/discoveries/earth-*.jpg', (route) =>
    route.fulfill({ status: 200, contentType: 'image/jpeg', body: 'not a photograph' }));
  await boot(page);
  await flyTo(page, 'Earth');
  await page.locator('#scene').focus();
  const before = await snapshot(page);
  await page.keyboard.down('ArrowUp');
  await expect.poll(async () => (await snapshot(page)).speed).toBeGreaterThan(0);
  await page.keyboard.up('ArrowUp');
  await expect.poll(async () => (await snapshot(page)).speed).toBe(0);
  expect((await snapshot(page)).latitude).not.toBeCloseTo(before.latitude, 3);

  // Closer until the floor: the button disables itself there rather than doing nothing.
  const closer = page.getByRole('button', { name: 'Fly closer' });
  for (let i = 0; i < 6 && await closer.isEnabled(); i++) await closer.click({ timeout: 3000 }).catch(() => {});
  await expect(closer).toBeDisabled();

  await page.getByRole('button', { name: 'Places', exact: true }).click();
  await page.locator('[data-place="earth-sahara"]').click();
  await expect.poll(async () => (await snapshot(page)).found, LONG).toContain('earth-sahara');
  await page.getByRole('button', { name: /Take a look/ }).click();
  await expect(page.getByText('This photograph is unavailable. The words are still here.')).toBeVisible();
  await expect(page.locator('.photo-words')).not.toBeEmpty();
  await page.getByRole('button', { name: 'Keep exploring' }).click();
  await expect(page.locator('.photo-dialog')).toBeHidden();
  await expect.poll(async () => (await snapshot(page)).modal).toBe(false);
});
