import type { Page } from '@playwright/test';
import { test, expect, showWorld } from './fixtures';
import { DISCOVERIES } from '../src/config';

// Playtest 2: back on the Space map after a world, the child did not know what to do next.
// The map shows it: a tick on worlds already visited, and one arrow on the card it suggests
// (with the ring in the scene and the ship's nose on the same world). When the suggested world
// is on another page, the page arrow towards it carries the hint instead. A suggestion, never
// a gate: every world flies from the first second, in any order (DECISIONS.md).

const snapshot = (page: Page) => page.evaluate(() => (window as any).spaceNinjaSnapshot());
const card = (page: Page, id: string) => page.locator(`.map-card[data-destination="${id}"]`);

async function expectPointedAt(page: Page, id: string) {
  await expect(page.locator('.map-pointer')).toHaveCount(1);
  await expect(card(page, id).locator('.map-pointer')).toBeVisible();
  await expect.poll(async () => (await snapshot(page)).mapRing).toBe(id);
  await expect.poll(async () => (await snapshot(page)).shipAim).toBe(id);
}

/** The hint is on another page: the arrow that way carries it, and the heading says so. */
async function expectArrowPointsTo(page: Page, direction: 'previous' | 'next', id: string, label: string) {
  await expect(page.locator('.map-pointer')).toHaveCount(1);
  await expect(page.locator(`.map-arrow--${direction} .map-pointer`)).toBeVisible();
  await expect(page.locator(`.map-arrow--${direction}`)).toHaveClass(/is-suggested/);
  await expect(page.locator('.hint')).toHaveText(`Tap the arrow for ${label}`);
  await expect.poll(async () => (await snapshot(page)).mapRing).toBe(id);
}

async function visitAndReturn(page: Page, world: string) {
  await showWorld(page, world);
  await page.getByRole('button', { name: `Fly to ${world}`, exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).phase).toBe('arrived');
  const findPlaces = page.getByRole('button', { name: 'Find places', exact: true });
  if (await findPlaces.isVisible()) await findPlaces.click();
  await page.getByRole('button', { name: 'Back to the space map', exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).phase).toBe('idle');
  // Back on the page of the world just visited.
  await expect(page.getByRole('button', { name: `Fly to ${world}`, exact: true })).toBeVisible();
}

test('the map shows what is done and what to do next, across its pages', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('spaceninja.sound.v1', 'off'));
  await page.goto('/?fast');
  await page.getByRole('button', { name: 'Start playing', exact: true }).click();

  // First map: nothing done yet, everything points at Earth, and every card flies.
  await expect(page.locator('.map-card__done')).toHaveCount(0);
  await expectPointedAt(page, 'earth');
  await expect(page.getByRole('button', { name: /^Fly to / })).toHaveCount(3);
  await expect(page.locator('.hint')).toHaveText('Tap Earth');

  // Out of order is fine: Saturn first. Back on Saturn's page it wears the tick, and the
  // previous arrow carries the hint to Earth, which is on another page.
  await visitAndReturn(page, 'Saturn');
  expect((await snapshot(page)).mapPage).toBe(2);
  await expect(card(page, 'saturn').locator('.map-card__done')).toBeVisible();
  await expectArrowPointsTo(page, 'previous', 'earth', 'Earth');

  // Following the arrow brings the hint back onto a card.
  await page.getByRole('button', { name: /^Previous worlds/ }).click();
  await expectPointedAt(page, 'earth');
  await expect(page.locator('.hint')).toHaveText('Tap Earth');

  // Back from Earth: Earth wears the tick, the arrow moves to the Moon.
  await visitAndReturn(page, 'Earth');
  await expect(card(page, 'earth').locator('.map-card__done')).toBeVisible();
  await expectPointedAt(page, 'moon');

  // Back from the Moon: the arrow moves on to Mars, the next world not yet visited.
  await visitAndReturn(page, 'Moon');
  await expect(page.locator('.map-card__done')).toHaveCount(2);
  await expectPointedAt(page, 'mars');
  for (const button of await page.locator('.map-card').all()) {
    const box = (await button.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(54);
    expect(box.height).toBeGreaterThanOrEqual(54);
  }

  // Back from Mars: Earth's neighbourhood is done, so the Sun is next, one page to the left.
  await visitAndReturn(page, 'Mars');
  await expect(page.locator('.map-card__done')).toHaveCount(3);
  await expectArrowPointsTo(page, 'previous', 'sun', 'Sun');
  await page.keyboard.press('ArrowLeft');
  await expectPointedAt(page, 'sun');
  await expect(page.locator('.hint')).toHaveText('Tap Sun');
});

// State audit 22: with every world visited the arrow sends the child back to one, which must
// not look like a brand-new world. Visited cards carry the journal's dots; a whole world found
// wears a sun star instead of the tick; the pill shows the gold place, not the journal.
test('once every world is visited, "more to find" is a picture', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('spaceninja.sound.v1', 'off');
    localStorage.setItem('spaceninja.grownups.v1', 'yes');
  });
  await page.addInitScript((discoveries) => localStorage.setItem('spaceninja.progress.v1', JSON.stringify({
    visited: ['sun', 'earth', 'moon', 'mars', 'saturn'], stickers: [], discoveries,
  })), allButThree());
  await page.goto('/?fast');

  // The Moon is the invitation (the first unfinished collection), so the map opens on its page.
  await expect(card(page, 'earth')).toHaveClass(/is-full/);
  await expect(card(page, 'earth').locator('.map-card__pips')).toHaveCount(0);
  await expect(page.locator('.map-pointer')).toHaveCount(1);
  await expect(card(page, 'moon').locator('.map-pointer')).toHaveCount(1);
  await expect(page.locator('.hint')).toContainText('More to find');
  await expect(page.locator('.hint .icon circle')).toHaveCount(2);
  const pipsFit = async () => {
    for (const button of await page.locator('.map-card:has(.map-card__pips)').all()) {
      const box = (await button.boundingBox())!;
      const pips = (await button.locator('.map-card__pips').boundingBox())!;
      expect(pips.y + pips.height).toBeLessThanOrEqual(box.y + box.height - 2);
      expect(pips.x).toBeGreaterThanOrEqual(box.x);
      expect(pips.x + pips.width).toBeLessThanOrEqual(box.x + box.width);
    }
  };
  for (const id of ['moon', 'mars']) {
    await expect(card(page, id)).not.toHaveClass(/is-full/);
    await expect(card(page, id).locator('.map-card__pips > span')).toHaveCount(6);
    await expect(card(page, id).locator('.map-card__pips > .is-found')).toHaveCount(3);
  }
  await pipsFit();
  // Saturn is on its own page; the Sun has no places, so its visited card is a plain tick.
  await showWorld(page, 'Saturn');
  await expect(card(page, 'saturn').locator('.map-card__pips > .is-found')).toHaveCount(3);
  await expect(page.locator('.hint')).toHaveText('Tap the arrow for Moon');
  await pipsFit();
  await showWorld(page, 'Sun');
  await expect(card(page, 'sun').locator('.map-card__done')).toBeVisible();
  await expect(card(page, 'sun').locator('.map-card__pips')).toHaveCount(0);
  await expect(card(page, 'sun')).not.toHaveClass(/is-full/);
});

/** Every Earth place and the first three of each other world, by id from the build's own config. */
function allButThree() {
  const all = Object.keys(DISCOVERIES);
  return ['earth', 'moon', 'mars', 'saturn'].flatMap(world => {
    const own = all.filter(id => id.startsWith(world + '-'));
    return world === 'earth' ? own : own.slice(0, 3);
  });
}
