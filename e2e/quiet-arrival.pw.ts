import { test, expect, settlePanel } from './fixtures';
import type { Locator, Page } from '@playwright/test';

const snapshot = (page: Page) => page.evaluate(() => (window as any).spaceNinjaSnapshot());

/*
 * A quiet arrival (owner's playtest, 22 Oct 2026: the gold places were obvious, the screen
 * around them was too busy), with open exploring (DECISIONS.md): nothing is held back.
 * On arrival the visit row is Space map, Listen and the world's toy, and nothing is ringed.
 * The journal and Day & night join once the child has done something (a first find or the
 * toy). At most one next step is ringed: the toy after the third find if it has not been
 * played, else Space map. Space map stays exactly where it was throughout.
 */

async function arriveAtMoon(page: Page) {
  await page.addInitScript(() => localStorage.setItem('spaceninja.sound.v1', 'off'));
  await page.goto('/?fast');
  await page.getByRole('button', { name: 'Start playing', exact: true }).click();
  await page.getByRole('button', { name: 'Fly to Moon', exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).phase).toBe('arrived');
  const spaceMap = page.getByRole('button', { name: 'Back to the space map', exact: true });
  await expect(spaceMap).toBeVisible();
  const home = (await spaceMap.boundingBox())!;
  const stays = async () => {
    const box = (await spaceMap.boundingBox())!;
    expect(box.x).toBeCloseTo(home.x, 0);
    expect(box.y).toBeCloseTo(home.y, 0);
    expect(box.width).toBeCloseTo(home.width, 0);
  };
  return { spaceMap, stays };
}

async function findOne(page: Page, close: 'Close the photo' | 'Keep exploring' = 'Close the photo') {
  let target = (await snapshot(page)).targets.find((t: any) => t.visible);
  if (!target) {
    await page.locator('.hunt-arrow').click();
    await expect.poll(async () => (await snapshot(page)).targets.some((t: any) => t.visible)).toBe(true);
    target = (await snapshot(page)).targets.find((t: any) => t.visible);
  }
  const before = (await snapshot(page)).collected;
  await page.mouse.click(target.x, target.y);
  await expect.poll(async () => (await snapshot(page)).collected).toBe(before + 1);
  await expect(page.locator('.photo-view.is-reward')).toBeVisible();
  await settlePanel(page);
  await page.getByRole('button', { name: close, exact: true }).click();
  await expect(page.locator('.photo-view')).toBeHidden();
}

async function expectNothingRinged(page: Page, spaceMap: Locator, jump: Locator) {
  const ui = page.locator('#ui');
  await expect(ui).not.toHaveClass(/is-toy-next/);
  await expect(ui).not.toHaveClass(/is-map-next/);
  await expect(jump).toHaveCSS('outline-style', 'none');
  await expect(spaceMap).toHaveCSS('outline-style', 'none');
}

test('Moon: the toy is there on arrival, the journal joins after a find, one next step at a time', async ({ page }) => {
  const { spaceMap, stays } = await arriveAtMoon(page);
  const jump = page.locator('.jump-btn');
  const journal = page.locator('.visit-actions .journal-btn');
  const dayNight = page.locator('.spin-btn');
  const ui = page.locator('#ui');

  // Arrival: Space map, Listen and Jump. Nothing ringed, nothing else talking.
  await expect(page.locator('.visit-actions > button:visible')).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'Words', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Jump on the Moon', exact: true })).toBeVisible();
  for (const held of [journal, dayNight]) await expect(held).toBeHidden();
  await expectNothingRinged(page, spaceMap, jump);
  await expect(page.locator('.world-heading__caption')).toBeHidden();
  // Sound off: the row's Words button is the reading route, so the heading has none.
  await expect(page.locator('.world-words')).toBeHidden();
  const jumpBox = (await jump.boundingBox())!;
  expect(jumpBox.width).toBeGreaterThanOrEqual(54);
  expect(jumpBox.height).toBeGreaterThanOrEqual(54);
  // Focus order: Space map, Listen, Jump; a held control is out of the focus order.
  const reached: string[] = [];
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement?.matches('.journal-btn, .spin-btn'))).toBe(false);
    reached.push(await page.evaluate(() => ['home-btn', 'listen-btn', 'jump-btn']
      .find(name => document.activeElement?.classList.contains(name)) ?? ''));
  }
  const order = ['home-btn', 'listen-btn', 'jump-btn'].map(name => reached.indexOf(name));
  for (const index of order) expect(index).toBeGreaterThanOrEqual(0);
  expect(order, 'Space map, then Listen, then the toy').toEqual([...order].sort((a, b) => a - b));

  // A first find is doing something: the journal and Day & night join once its postcard is
  // closed. Still nothing ringed, and Space map has not moved.
  await findOne(page);
  await expect(journal).toBeVisible();
  await expect(dayNight).toBeVisible();
  await expect(page.locator('.visit-actions .is-appearing')).toHaveCount(0);
  await expectNothingRinged(page, spaceMap, jump);
  await stays();
  await findOne(page);
  await expectNothingRinged(page, spaceMap, jump);
  await findOne(page);

  // Three found, Jump not played yet: Jump is the one ringed next step.
  await expect(ui).toHaveClass(/is-toy-next/);
  await expect(jump).toHaveCSS('outline-style', 'solid');
  await expect(ui).not.toHaveClass(/is-map-next/);
  await expect(spaceMap).toHaveCSS('outline-style', 'none');
  await expect(page.locator('.world-heading__caption')).toHaveText('Three found! Now try Jump.');
  await expect(page.locator('.world-heading__caption')).toBeVisible();
  await stays();

  await jump.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.moon-jump')).toBeVisible();
  await expect(ui).not.toHaveClass(/is-toy-next/);
  await page.getByRole('button', { name: 'Back to the Moon', exact: true }).click();
  await expect(page.locator('.moon-jump')).toHaveCount(0);
  await expect(jump).toBeFocused();

  // After the toy: Space map is the one ringed step; Journal is there but not ringed.
  await expect(page.locator('.world-heading__caption')).toHaveText('Choose your next trip on the Space map.');
  await expect(ui).toHaveClass(/is-map-next/);
  await expect(spaceMap).toHaveCSS('outline-style', 'solid');
  await expect(journal).toHaveCSS('outline-style', 'none');
  await expect(jump).toHaveCSS('outline-style', 'none');
  await stays();
  await spaceMap.click();
  await expect.poll(async () => (await snapshot(page)).phase).toBe('idle');
  // Back on the map the journal is its usual corner button, not held.
  await expect(page.getByRole('button', { name: 'Open your discovery journal' })).toBeVisible();
});

test('Moon: playing Jump first needs no finds, rings nothing, and the finds then ring Space map', async ({ page }) => {
  const { spaceMap, stays } = await arriveAtMoon(page);
  const jump = page.getByRole('button', { name: 'Jump on the Moon', exact: true });
  const journal = page.locator('.visit-actions .journal-btn');
  const ui = page.locator('#ui');

  await jump.click();
  await expect(page.locator('.moon-jump')).toBeVisible();
  await page.getByRole('button', { name: 'Back to the Moon', exact: true }).click();
  await expect(page.locator('.moon-jump')).toHaveCount(0);
  // Played the toy: the journal joins; places remain, so nothing is ringed.
  await expect(journal).toBeVisible();
  await expect(page.locator('.spin-btn')).toBeVisible();
  await expectNothingRinged(page, spaceMap, jump);
  await stays();
  // The gold places are still there and still work.
  expect((await snapshot(page)).targets).toHaveLength(3);

  for (let i = 0; i < 3; i++) await findOne(page);
  // Toy already played this visit: the third find rings Space map, not Jump.
  await expect(ui).toHaveClass(/is-map-next/);
  await expect(ui).not.toHaveClass(/is-toy-next/);
  await expect(spaceMap).toHaveCSS('outline-style', 'solid');
  await expect(jump).toHaveCSS('outline-style', 'none');
  await expect(page.locator('.world-heading__caption')).toHaveText('Choose your next trip on the Space map.');
  await stays();
});
