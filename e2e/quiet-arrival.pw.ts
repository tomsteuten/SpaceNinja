import { test, expect, settlePanel } from './fixtures';
import type { Page } from '@playwright/test';

const snapshot = (page: Page) => page.evaluate(() => (window as any).spaceNinjaSnapshot());

/*
 * A quiet arrival (owner's playtest, 22 Oct 2026: the gold places were obvious, the screen
 * around them was too busy). On arrival the visit row is Space map and Listen; the Moon's
 * toy pops in as the next step after the third find, and the journal and Day & night join
 * once the toy has been played. Space map stays exactly where it was throughout.
 */
test('Moon: toy and journal wait for the finds, the toy is the next step, Space map never moves', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('spaceninja.sound.v1', 'off'));
  await page.goto('/?fast');
  await page.getByRole('button', { name: 'Start playing', exact: true }).click();
  await page.getByRole('button', { name: 'Fly to Moon', exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).phase).toBe('arrived');

  const spaceMap = page.getByRole('button', { name: 'Back to the space map', exact: true });
  const jump = page.locator('.jump-btn');
  const journal = page.locator('.visit-actions .journal-btn');
  const dayNight = page.locator('.spin-btn');
  const ui = page.locator('#ui');
  await expect(spaceMap).toBeVisible();
  const home = (await spaceMap.boundingBox())!;
  const stays = async () => {
    const box = (await spaceMap.boundingBox())!;
    expect(box.x).toBeCloseTo(home.x, 0);
    expect(box.y).toBeCloseTo(home.y, 0);
    expect(box.width).toBeCloseTo(home.width, 0);
  };

  // Arrival: the gold places are the one thing to do.
  await expect(page.locator('.visit-actions > button:visible')).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Words', exact: true })).toBeVisible();
  for (const held of [jump, journal, dayNight]) await expect(held).toBeHidden();
  await expect(page.getByRole('button', { name: 'Jump on the Moon' })).toHaveCount(0);
  await expect(page.locator('.world-heading__caption')).toBeHidden();
  // Sound off: the row's Words button is the reading route, so the heading has none.
  await expect(page.locator('.world-words')).toBeHidden();
  // A held control is out of the focus order too.
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement?.matches('.toy-btn, .journal-btn, .spin-btn'))).toBe(false);
  }

  for (let i = 0; i < 3; i++) {
    let target = (await snapshot(page)).targets.find((t: any) => t.visible);
    if (!target) {
      await page.locator('.hunt-arrow').click();
      await expect.poll(async () => (await snapshot(page)).targets.some((t: any) => t.visible)).toBe(true);
      target = (await snapshot(page)).targets.find((t: any) => t.visible);
    }
    await page.mouse.click(target.x, target.y);
    await expect(page.locator('.photo-view.is-reward')).toBeVisible();
    await settlePanel(page);
    await page.getByRole('button', { name: 'Close the photo', exact: true }).click();
    await expect(page.locator('.photo-view')).toBeHidden();
    await stays();
    if (i < 2) for (const held of [jump, journal, dayNight]) await expect(held).toBeHidden();
  }

  // Three found: the toy appears and is the next step; the journal still waits.
  await expect(ui).toHaveClass(/is-toy-next/);
  await expect(jump).toBeVisible();
  await expect(jump).toHaveCSS('outline-style', 'solid');
  await expect(ui).not.toHaveClass(/is-map-next/);
  await expect(spaceMap).toHaveCSS('outline-style', 'none');
  await expect(page.locator('.world-heading__caption')).toHaveText('Three found! Now try Jump.');
  await expect(page.locator('.world-heading__caption')).toBeVisible();
  await expect(journal).toBeHidden();
  await stays();
  // Measured once its pop has settled.
  await expect(page.locator('.visit-actions .is-appearing')).toHaveCount(0);
  const jumpBox = (await jump.boundingBox())!;
  expect(jumpBox.width).toBeGreaterThanOrEqual(54);
  expect(jumpBox.height).toBeGreaterThanOrEqual(54);

  await jump.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.moon-jump')).toBeVisible();
  await expect(ui).not.toHaveClass(/is-toy-next/);
  await page.getByRole('button', { name: 'Back to the Moon', exact: true }).click();
  await expect(page.locator('.moon-jump')).toHaveCount(0);
  await expect(jump).toBeFocused();

  // After the toy: the journal and Day & night are there, and Space map has not moved.
  await expect(journal).toBeVisible();
  await expect(dayNight).toBeVisible();
  await expect(page.locator('.world-heading__caption')).toHaveText('Choose your next trip on the Space map.');
  // One next step: Space map is ringed, Journal is there but not.
  await expect(ui).toHaveClass(/is-map-next/);
  await expect(spaceMap).toHaveCSS('outline-style', 'solid');
  await expect(journal).toHaveCSS('outline-style', 'none');
  await stays();
  await spaceMap.click();
  await expect.poll(async () => (await snapshot(page)).phase).toBe('idle');
  // Back on the map the journal is its usual corner button, not held.
  await expect(page.getByRole('button', { name: 'Open your discovery journal' })).toBeVisible();
});
