/*
 * The visit screen smoke set (owner's pick B, the toy shelf; DECISIONS.md "Tests").
 *
 * Fly to a world and every control is there on arrival, inside the screen, clear of each other
 * and of the world; open a toy and come back to the same screen; return to the Space map. The
 * Moon and Earth are the two polished worlds. Run on all three projects.
 *
 * VISIT_SHOTS=design/visit-screen/built also saves full-resolution pictures of the Moon and
 * Earth visit screens for the owner (run with --project=phone and --project=short-landscape).
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Locator, Page } from '@playwright/test';
import { test, expect, settleMapReturn, showWorld } from './fixtures';

const snapshot = (page: Page) => page.evaluate(() => (window as any).spaceNinjaSnapshot());
type Box = { x: number; y: number; width: number; height: number };

/** The controls the visit screen must show on arrival, by accessible name (cards per world). */
const CARDS: Record<string, string[]> = {
  Moon: ['Jump on the Moon', 'Moonlight: why the Moon shines'],
  Earth: ['Turn Earth: day and night'],
};

function controls(page: Page, world: string): [string, Locator][] {
  return [
    ['Space map', page.getByRole('button', { name: 'Back to the space map', exact: true })],
    // Sound off (as these checks run), the speaker opens the words to read.
    ['Listen', page.getByRole('button', { name: /^(Listen|Read the words)$/ })],
    ['Journal', page.getByRole('button', { name: 'Open your discovery journal', exact: true })],
    ...CARDS[world]!.map((name): [string, Locator] => [name, page.getByRole('button', { name, exact: true })]),
    ['Found counter', page.getByRole('img', { name: /^\d of 3 places found$/ })],
    ['Name chip', page.locator('.visit-chip')],
  ];
}

async function start(page: Page) {
  await page.addInitScript(() => localStorage.setItem('spaceninja.sound.v1', 'off'));
  await page.goto('/?fast');
  await page.getByRole('button', { name: 'Start playing', exact: true }).click();
  await expect(page.locator('#boot')).toBeHidden();
}

/** Fly there and wait for the arrival shot to stop moving. */
async function fly(page: Page, world: string) {
  await showWorld(page, world);
  await page.getByRole('button', { name: `Fly to ${world}`, exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).phase, { timeout: 200000 }).toBe('arrived');
  let last = '';
  await expect.poll(async () => {
    const disc = (await snapshot(page)).bodyScreen;
    const now = [disc.x, disc.y, disc.radius].map((v: number) => Math.round(v)).join();
    const settled = now === last;
    last = now;
    return settled;
  }, { intervals: [400] }).toBe(true);
}

async function boxes(page: Page, world: string): Promise<Record<string, Box>> {
  const out: Record<string, Box> = {};
  for (const [name, control] of controls(page, world)) {
    await expect(control, `${name} is on screen from arrival`).toBeVisible();
    out[name] = (await control.boundingBox())!;
  }
  return out;
}

function overlaps(a: Box, b: Box) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/** Every control inside the viewport, clear of every other control and of the world's disc. */
async function expectClearLayout(page: Page, world: string) {
  const { width, height } = page.viewportSize()!;
  const placed = await boxes(page, world);
  const names = Object.keys(placed);
  for (const name of names) {
    const box = placed[name]!;
    expect(box.x, `${name} inside the left edge`).toBeGreaterThanOrEqual(0);
    expect(box.y, `${name} inside the top edge`).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, `${name} inside the right edge`).toBeLessThanOrEqual(width);
    expect(box.y + box.height, `${name} inside the bottom edge`).toBeLessThanOrEqual(height);
  }
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      expect(overlaps(placed[names[i]!]!, placed[names[j]!]!), `${names[i]} clear of ${names[j]}`).toBe(false);
    }
  }
  const shelf = (await page.locator('.toy-shelf').boundingBox())!;
  const disc = (await snapshot(page)).bodyScreen as { x: number; y: number; radius: number };
  for (const [name, box] of [...Object.entries(placed), ['Toy shelf', shelf] as const]) {
    const nearestX = Math.max(box.x, Math.min(disc.x, box.x + box.width));
    const nearestY = Math.max(box.y, Math.min(disc.y, box.y + box.height));
    expect(Math.hypot(disc.x - nearestX, disc.y - nearestY), `${name} clear of the world`).toBeGreaterThan(disc.radius);
  }
  // A world worth looking at: at least a third of the short side across.
  expect(disc.radius * 2).toBeGreaterThan(Math.min(width, height) / 3);
  return placed;
}

/** Keyboard / TV remote: Tab reaches every control, in reading order, with its name. */
async function expectTabReach(page: Page, world: string) {
  const wanted = ['Back to the space map', 'Read the words', 'Open your discovery journal', ...CARDS[world]!];
  await page.locator('body').focus();
  const seen: string[] = [];
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    seen.push(await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? ''));
  }
  for (const name of wanted) expect(seen, `${name} is reachable by Tab`).toContain(name);
  expect(seen.filter((name) => wanted.includes(name)).slice(0, wanted.length)).toEqual(wanted);
}

async function backToMap(page: Page, world: string) {
  await page.getByRole('button', { name: 'Back to the space map', exact: true }).click();
  await expect(page.getByRole('button', { name: `Fly to ${world}`, exact: true })).toBeVisible({ timeout: 60000 });
  await expect(page.locator('.visit')).toBeHidden();
  await settleMapReturn(page);
}

test('every visit control is there on arrival, stays put through a toy, and the map is the way back', async ({ page }) => {
  await start(page);

  await fly(page, 'Moon');
  const moon = await expectClearLayout(page, 'Moon');
  await expect(page.locator('.hunt-arrow')).toHaveCount(0);
  await expectTabReach(page, 'Moon');
  // Open a toy from its card and come back: the same screen, nothing moved.
  await page.getByRole('button', { name: 'Jump on the Moon', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Jump on Earth and on the Moon' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to the Moon', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Jump on the Moon', exact: true })).toBeFocused();
  expect(await boxes(page, 'Moon')).toEqual(moon);
  // Finding a place fills a ring; nothing appears or moves.
  const target = (await snapshot(page)).targets.find((t: any) => t.visible);
  await page.mouse.click(target.x, target.y);
  await expect(page.getByRole('img', { name: '1 of 3 places found', exact: true })).toBeVisible();
  // A first find's postcard opens once its photograph has loaded, which can take a moment.
  await page.locator('.photo-view').waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
  if (await page.locator('.photo-view').isVisible()) {
    await page.waitForTimeout(650);
    await page.keyboard.press('Escape');
    await expect(page.locator('.photo-view')).toBeHidden();
  }
  expect(await boxes(page, 'Moon')).toEqual(moon);
  await backToMap(page, 'Moon');

  await fly(page, 'Earth');
  const earth = await expectClearLayout(page, 'Earth');
  // No first-visit special flow: the gold places are there and so is everything else.
  expect((await snapshot(page)).targets.some((t: any) => t.visible)).toBe(true);
  await expectTabReach(page, 'Earth');
  await page.getByRole('button', { name: 'Turn Earth: day and night', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Spin Earth through a day' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to Earth', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Turn Earth: day and night', exact: true })).toBeFocused();
  expect(await boxes(page, 'Earth')).toEqual(earth);
  await backToMap(page, 'Earth');
});

test.describe('pictures for the owner', () => {
  const OUT = process.env.VISIT_SHOTS ?? '';
  test.skip(!OUT, 'Set VISIT_SHOTS to save the visit screen pictures.');
  test.use({ deviceScaleFactor: 1 });

  test('Moon and Earth visit screens', async ({ page }) => {
    mkdirSync(OUT, { recursive: true });
    const { width, height } = page.viewportSize()!;
    const shape = width > height ? 'landscape' : 'portrait';
    await start(page);
    for (const world of ['Moon', 'Earth']) {
      await fly(page, world);
      await expectClearLayout(page, world);
      // The arrival words come and go on their own; picture the screen as it stays.
      await page.waitForTimeout(1500);
      await page.screenshot({ path: join(OUT, `visit-${world.toLowerCase()}-${shape}.png`) });
      await backToMap(page, world);
    }
  });

  // Mars, Saturn and the Sun have the same shelf; pictured for the roll-out, not yet polished.
  test('the other worlds (VISIT_SHOTS_OTHERS)', async ({ page }) => {
    const others = process.env.VISIT_SHOTS_OTHERS ?? '';
    test.skip(!others, 'Set VISIT_SHOTS_OTHERS as well to picture Mars, Saturn and the Sun.');
    mkdirSync(others, { recursive: true });
    const { width, height } = page.viewportSize()!;
    const shape = width > height ? 'landscape' : 'portrait';
    await start(page);
    for (const world of ['Mars', 'Saturn', 'Sun']) {
      await fly(page, world);
      await page.waitForTimeout(1500);
      await page.screenshot({ path: join(others, `visit-${world.toLowerCase()}-${shape}.png`) });
      await backToMap(page, world);
    }
  });
});
