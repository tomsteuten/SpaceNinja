/*
 * The visit screen smoke set (owner's pick B, the toy shelf; DECISIONS.md "Tests").
 *
 * Fly to a world and every control is there on arrival, inside the screen, clear of each other
 * and of the world; open a toy and come back to the same screen; the Places card turns the
 * world to a place and shows its photo (owner's pick B, design/places/places-B.png), the
 * photo's arrow goes to the next place and a press on the world puts it away; return to the
 * Space map. There is no hunt: no gold targets, no counter, no journal. Run on all three
 * projects.
 *
 * VISIT_SHOTS=<folder> also saves full-resolution pictures of the Moon and Earth visit screens
 * and their Places photos for the owner (run with --project=phone and
 * --project=short-landscape); VISIT_SHOTS_OTHERS=<folder> adds Mars, Saturn and the Sun.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Locator, Page } from '@playwright/test';
import { test, expect, settleMapReturn, showWorld } from './fixtures';

const snapshot = (page: Page) => page.evaluate(() => (window as any).spaceNinjaSnapshot());
type Box = { x: number; y: number; width: number; height: number };
type Disc = { x: number; y: number; radius: number };

const PLACES = 'Places: see real photos';
/** The cards each world's shelf shows on arrival, by accessible name. */
const CARDS: Record<string, string[]> = {
  Moon: ['Jump on the Moon', 'Moonlight: why the Moon shines', PLACES],
  Earth: ['Turn Earth: day and night', PLACES],
};

function controls(page: Page, world: string): [string, Locator][] {
  return [
    ['Space map', page.getByRole('button', { name: 'Back to the space map', exact: true })],
    // Sound off (as these checks run), the speaker opens the words to read.
    ['Listen', page.getByRole('button', { name: /^(Listen|Read the words)$/ })],
    ...CARDS[world]!.map((name): [string, Locator] => [name, page.getByRole('button', { name, exact: true })]),
    ['Name chip', page.locator('.visit-chip')],
  ];
}

async function start(page: Page) {
  await page.addInitScript(() => localStorage.setItem('spaceninja.sound.v1', 'off'));
  await page.goto('/?fast');
  await page.getByRole('button', { name: 'Start playing', exact: true }).click();
  await expect(page.locator('#boot')).toBeHidden();
}

/** Wait for the world's picture to stop moving (arrival, or the reframe round the photo). */
async function settle(page: Page) {
  let last = '';
  await expect.poll(async () => {
    const s = await snapshot(page);
    const disc = s.bodyScreen as Disc;
    const now = [disc.x, disc.y, disc.radius].map((v: number) => Math.round(v)).join() + (s.placeTurning ? 't' : '');
    const settled = now === last && !s.placeTurning;
    last = now;
    return settled;
  }, { intervals: [400] }).toBe(true);
}

async function fly(page: Page, world: string) {
  await showWorld(page, world);
  await page.getByRole('button', { name: `Fly to ${world}`, exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).phase, { timeout: 200000 }).toBe('arrived');
  await settle(page);
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

function clearOfDisc(box: Box, disc: Disc) {
  const nearestX = Math.max(box.x, Math.min(disc.x, box.x + box.width));
  const nearestY = Math.max(box.y, Math.min(disc.y, box.y + box.height));
  return Math.hypot(disc.x - nearestX, disc.y - nearestY);
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
  const disc = (await snapshot(page)).bodyScreen as Disc;
  for (const [name, box] of [...Object.entries(placed), ['Toy shelf', shelf] as const]) {
    expect(clearOfDisc(box, disc), `${name} clear of the world`).toBeGreaterThan(disc.radius);
  }
  // A world worth looking at: at least a third of the short side across.
  expect(disc.radius * 2).toBeGreaterThan(Math.min(width, height) / 3);
  return placed;
}

/** Keyboard / TV remote: Tab reaches every control, in reading order, with its name. */
async function expectTabReach(page: Page, world: string) {
  const wanted = ['Back to the space map', 'Read the words', ...CARDS[world]!];
  await page.locator('body').focus();
  const seen: string[] = [];
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    seen.push(await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? ''));
  }
  for (const name of wanted) expect(seen, `${name} is reachable by Tab`).toContain(name);
  expect(seen.filter((name) => wanted.includes(name)).slice(0, wanted.length)).toEqual(wanted);
}

/**
 * The Places card: the world turns so the place faces the child (its mark on the visible
 * face), the photo and its name come up inside the screen, clear of the shelf and the way
 * back, and the world moves into the room the photo leaves.
 */
async function expectPlaceShown(page: Page, id: string) {
  const photo = page.getByRole('figure', { name: 'Photo of this place' });
  await expect(photo).toBeVisible();
  await settle(page);
  const s = await snapshot(page);
  expect(s.place).toBe(id);
  expect(s.placeMark.facing, `${id} faces the camera`).toBeGreaterThan(0.6);
  const { width, height } = page.viewportSize()!;
  const box = (await photo.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(width);
  expect(box.y + box.height).toBeLessThanOrEqual(height);
  const shelf = (await page.locator('.toy-shelf').boundingBox())!;
  const map = (await page.getByRole('button', { name: 'Back to the space map', exact: true }).boundingBox())!;
  expect(overlaps(box, shelf), 'photo clear of the shelf').toBe(false);
  expect(overlaps(box, map), 'photo clear of Space map').toBe(false);
  const disc = s.bodyScreen as Disc;
  // The world's edge may touch the photo's paper, never sit behind the picture.
  expect(clearOfDisc(box, disc), 'world clear of the photo').toBeGreaterThan(disc.radius - 6);
}

async function backToMap(page: Page, world: string) {
  await page.getByRole('button', { name: 'Back to the space map', exact: true }).click();
  await expect(page.getByRole('button', { name: `Fly to ${world}`, exact: true })).toBeVisible({ timeout: 60000 });
  await expect(page.locator('.visit')).toBeHidden();
  await settleMapReturn(page);
}

test('every visit control is there on arrival, Places shows real places, and the map is the way back', async ({ page }) => {
  await start(page);

  await fly(page, 'Moon');
  const moon = await expectClearLayout(page, 'Moon');
  // No hunt: no gold targets, no counter, no journal.
  await expect(page.locator('.visit-found, .journal-btn, .hunt-arrow')).toHaveCount(0);
  await expectTabReach(page, 'Moon');
  // Open a toy from its card and come back: the same screen, nothing moved.
  await page.getByRole('button', { name: 'Jump on the Moon', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Jump on Earth and on the Moon' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to the Moon', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Jump on the Moon', exact: true })).toBeFocused();
  expect(await boxes(page, 'Moon')).toEqual(moon);

  // Places: nothing pops up until asked; a tap shows the first place, the arrow the next.
  await expect(page.getByRole('figure', { name: 'Photo of this place' })).toBeHidden();
  await page.getByRole('button', { name: PLACES, exact: true }).click();
  await expectPlaceShown(page, 'moon-tranquility');
  await expect(page.getByRole('button', { name: PLACES, exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Next place', exact: true }).click();
  await expectPlaceShown(page, 'moon-tycho');
  // A press on the world puts it away, and the screen is as it was.
  const disc = (await snapshot(page)).bodyScreen as Disc;
  await page.mouse.click(disc.x, disc.y);
  await expect(page.getByRole('figure', { name: 'Photo of this place' })).toBeHidden();
  expect((await snapshot(page)).placeMark).toBeNull();
  await settle(page);
  expect(await boxes(page, 'Moon')).toEqual(moon);
  // Tapped again, the card goes on to the next place rather than back to the first.
  await page.getByRole('button', { name: PLACES, exact: true }).click();
  await expectPlaceShown(page, 'moon-procellarum');
  await backToMap(page, 'Moon');

  await fly(page, 'Earth');
  const earth = await expectClearLayout(page, 'Earth');
  await expectTabReach(page, 'Earth');
  await page.getByRole('button', { name: 'Turn Earth: day and night', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Spin Earth through a day' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to Earth', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Turn Earth: day and night', exact: true })).toBeFocused();
  expect(await boxes(page, 'Earth')).toEqual(earth);
  // The keyboard way: Enter on the card, Escape puts it away.
  await page.getByRole('button', { name: PLACES, exact: true }).focus();
  await page.keyboard.press('Enter');
  await expectPlaceShown(page, 'earth-sahara');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('figure', { name: 'Photo of this place' })).toBeHidden();
  await backToMap(page, 'Earth');
});

test.describe('pictures for the owner', () => {
  const OUT = process.env.VISIT_SHOTS ?? '';
  test.skip(!OUT, 'Set VISIT_SHOTS to save the visit screen pictures.');
  test.use({ deviceScaleFactor: 1 });

  async function picture(page: Page, folder: string, world: string, shape: string) {
    await fly(page, world);
    // The arrival words come and go on their own; picture the screen as it stays.
    await page.waitForTimeout(1500);
    await page.screenshot({ path: join(folder, `visit-${world.toLowerCase()}-${shape}.png`) });
    const places = page.getByRole('button', { name: PLACES, exact: true });
    if (await places.count()) {
      await places.click();
      await settle(page);
      await page.waitForTimeout(800);
      await page.screenshot({ path: join(folder, `places-${world.toLowerCase()}-${shape}.png`) });
      await page.getByRole('button', { name: 'Next place', exact: true }).click();
      await settle(page);
      await page.waitForTimeout(800);
      await page.screenshot({ path: join(folder, `places-${world.toLowerCase()}-next-${shape}.png`) });
    }
    await backToMap(page, world);
  }

  test('Moon and Earth visit screens and Places', async ({ page }) => {
    mkdirSync(OUT, { recursive: true });
    const { width, height } = page.viewportSize()!;
    const shape = width > height ? 'landscape' : 'portrait';
    await start(page);
    for (const world of ['Moon', 'Earth']) await picture(page, OUT, world, shape);
  });

  test('the other worlds (VISIT_SHOTS_OTHERS)', async ({ page }) => {
    const others = process.env.VISIT_SHOTS_OTHERS ?? '';
    test.skip(!others, 'Set VISIT_SHOTS_OTHERS as well to picture Mars, Saturn and the Sun.');
    mkdirSync(others, { recursive: true });
    const { width, height } = page.viewportSize()!;
    const shape = width > height ? 'landscape' : 'portrait';
    await start(page);
    for (const world of ['Mars', 'Saturn', 'Sun']) await picture(page, others, world, shape);
  });
});
