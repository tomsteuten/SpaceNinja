import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { DISCOVERIES } from '../src/config';

// Playtest 2: back on the Space map after a world, the child did not know what to do next.
// The map now shows it: a tick on worlds already visited, one arrow on the card to press
// next (with the ring in the scene and the ship's nose on the same world), an unlock moment
// for a world opened by the last visit, and a locked press that points at the world opening it.

const snapshot = (page: Page) => page.evaluate(() => (window as any).spaceNinjaSnapshot());
const card = (page: Page, id: string) => page.locator(`.destination-choice[data-destination="${id}"]`);

async function expectPointedAt(page: Page, id: string) {
  await expect(page.locator('.destination-choice__pointer')).toHaveCount(1);
  await expect(card(page, id).locator('.destination-choice__pointer')).toBeVisible();
  await expect.poll(async () => (await snapshot(page)).mapRing).toBe(id);
  await expect.poll(async () => (await snapshot(page)).shipAim).toBe(id);
}

async function visitAndReturn(page: Page, world: string) {
  await page.getByRole('button', { name: `Fly to ${world}`, exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).phase).toBe('arrived');
  const findPlaces = page.getByRole('button', { name: 'Find places', exact: true });
  if (await findPlaces.isVisible()) await findPlaces.click();
  await page.getByRole('button', { name: 'Back to the space map', exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).phase).toBe('idle');
}

test('the map shows what is done and what to do next', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('spaceninja.sound.v1', 'off'));
  await page.goto('/?fast');
  await page.getByRole('button', { name: 'Start playing', exact: true }).click();

  // First map: nothing done yet, everything points at Earth.
  await expect(page.locator('.destination-choice__done')).toHaveCount(0);
  await expectPointedAt(page, 'earth');

  // A locked press points at the world that opens it, then settles back.
  await page.getByRole('button', { name: 'Saturn — visit Mars first', exact: true }).click();
  await expect(page.locator('.hint')).toHaveText('Visit the Moon first');
  await expect(card(page, 'moon')).toHaveClass(/is-unlocker/);
  await expectPointedAt(page, 'moon');
  await expect(card(page, 'moon')).not.toHaveClass(/is-unlocker/, { timeout: 6000 });
  await expectPointedAt(page, 'earth');

  // Back from Earth: Earth wears the tick, the arrow moves to the Moon.
  await visitAndReturn(page, 'Earth');
  await expect(card(page, 'earth').locator('.destination-choice__done')).toBeVisible();
  await expect(page.locator('.destination-choice__done')).toHaveCount(1);
  await expectPointedAt(page, 'moon');

  // Back from the Moon: Mars has just opened, loses its padlock and gets the arrow.
  await visitAndReturn(page, 'Moon');
  await expect(card(page, 'mars')).toHaveClass(/is-new/);
  await expect(card(page, 'mars')).not.toHaveClass(/is-locked/);
  await expect(page.locator('.destination-choice__done')).toHaveCount(2);
  await expectPointedAt(page, 'mars');
  for (const button of await page.locator('.destination-choice').all()) {
    const box = (await button.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(54);
    expect(box.height).toBeGreaterThanOrEqual(54);
  }
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
    visited: ['earth', 'moon', 'mars', 'saturn'], stickers: [], discoveries,
  })), allButThree());
  await page.goto('/?fast');

  await expect(card(page, 'earth')).toHaveClass(/is-full/);
  await expect(card(page, 'earth').locator('.destination-choice__pips')).toHaveCount(0);
  for (const id of ['moon', 'mars', 'saturn']) {
    await expect(card(page, id)).not.toHaveClass(/is-full/);
    await expect(card(page, id).locator('.destination-choice__pips > span')).toHaveCount(6);
    await expect(card(page, id).locator('.destination-choice__pips > .is-found')).toHaveCount(3);
  }
  await expect(page.locator('.destination-choice__pointer')).toHaveCount(1);
  await expect(page.locator('.destination-choice.is-new')).toHaveCount(0);
  await expect(page.locator('.hint')).toContainText('More to find');
  await expect(page.locator('.hint .icon circle')).toHaveCount(2);
  // The dots stay inside their card at every viewport.
  for (const button of await page.locator('.destination-choice:has(.destination-choice__pips)').all()) {
    const box = (await button.boundingBox())!;
    const pips = (await button.locator('.destination-choice__pips').boundingBox())!;
    expect(pips.y + pips.height).toBeLessThanOrEqual(box.y + box.height - 2);
    expect(pips.x).toBeGreaterThanOrEqual(box.x);
    expect(pips.x + pips.width).toBeLessThanOrEqual(box.x + box.width);
  }
});

/** Every Earth place and the first three of each other world, by id from the build's own config. */
function allButThree() {
  const all = Object.keys(DISCOVERIES);
  return ['earth', 'moon', 'mars', 'saturn'].flatMap(world => {
    const own = all.filter(id => id.startsWith(world + '-'));
    return world === 'earth' ? own : own.slice(0, 3);
  });
}
