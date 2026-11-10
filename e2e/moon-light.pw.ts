import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

const snapshot = (page: Page) => page.evaluate(() => (window as any).spaceNinjaSnapshot());

/*
 * The Moon's second toy is Moonlight: the Moon shines with the Sun's light. It takes Day & night's
 * cell in the Moon's row (after a first find or the toy), is never the ringed next step, and
 * inside, moving the Moon changes its phase and switching the Sun off darkens it.
 */
async function arriveAtMoon(page: Page) {
  await page.addInitScript(() => localStorage.setItem('spaceninja.sound.v1', 'off'));
  await page.goto('/?fast');
  await page.getByRole('button', { name: 'Start playing', exact: true }).click();
  await page.getByRole('button', { name: 'Fly to Moon', exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).phase).toBe('arrived');
}

test('Moon: Moonlight joins the row, the Moon changes phase, and no Sun means no moonlight', async ({ page }) => {
  await arriveAtMoon(page);

  // Held back on arrival; once Jump is played it joins, in Day & night's cell.
  const moonlightButton = page.getByRole('button', { name: 'Moonlight: why the Moon shines', exact: true });
  await expect(moonlightButton).toBeHidden();
  await page.getByRole('button', { name: 'Jump on the Moon', exact: true }).click();
  await page.getByRole('button', { name: 'Back to the Moon', exact: true }).click();
  await expect(page.locator('.visit-actions .is-appearing')).toHaveCount(0);
  await expect(moonlightButton).toBeVisible();
  await expect(page.locator('.spin-btn')).toBeHidden();
  await expect(page.locator('.visit-actions > button:visible')).toHaveCount(5);
  const box = (await moonlightButton.boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(54);
  expect(box.height).toBeGreaterThanOrEqual(54);
  await expect(moonlightButton).toHaveCSS('outline-style', 'none');

  await moonlightButton.click();
  const toy = page.getByRole('dialog', { name: 'Moonlight: why the Moon shines' });
  await expect(toy).toBeVisible();
  await expect(toy.locator('.moon-light__caption')).toHaveText("The Moon shines with the Sun's light.");
  await expect(toy).toHaveAttribute('data-phase', 'Waxing crescent');
  await expect(toy).toHaveAttribute('data-sun', 'on');
  await expect(toy.getByRole('img')).toHaveAttribute('aria-label', /Waxing crescent/);

  // Move Moon steps an eighth of the way round; the arrow keys do the same.
  await toy.getByRole('button', { name: 'Move the Moon round Earth' }).click();
  await expect(toy).toHaveAttribute('data-phase', 'First Quarter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(toy).toHaveAttribute('data-phase', 'Full Moon');
  await expect(toy.getByRole('img')).toHaveAttribute('aria-label', /Full Moon/);
  await page.keyboard.press('ArrowLeft');
  await expect(toy).toHaveAttribute('data-phase', 'Waxing gibbous');
  await page.keyboard.press('ArrowRight');

  // The Sun is a button: off, the Moon goes dark in both views; on, it lights up again.
  await toy.getByRole('button', { name: 'Sun off' }).click();
  await expect(toy).toHaveAttribute('data-sun', 'off');
  await expect(toy.locator('.moon-light__caption')).toHaveText('No Sun, no moonlight.');
  await expect(toy.getByRole('img')).toHaveAttribute('aria-label', /dark/);
  await toy.getByRole('button', { name: 'Sun on' }).click();
  await expect(toy).toHaveAttribute('data-sun', 'on');
  await expect(toy.locator('.moon-light__caption')).toHaveText("The Moon shines with the Sun's light.");

  // Escape closes it and returns focus to its button; the scene's canvas is the only one left.
  await page.keyboard.press('Escape');
  await expect(toy).toHaveCount(0);
  await expect(page.locator('canvas')).toHaveCount(1);
  await expect(moonlightButton).toBeFocused();
  // Playing Moonlight is not the ringed next step.
  await expect(page.locator('#ui')).not.toHaveClass(/is-toy-next|is-map-next/);
});

test('Moon: Moonlight survives a turn of the phone and the back button returns focus', async ({ page }) => {
  await arriveAtMoon(page);
  await page.getByRole('button', { name: 'Jump on the Moon', exact: true }).click();
  await page.getByRole('button', { name: 'Back to the Moon', exact: true }).click();
  await page.getByRole('button', { name: 'Moonlight: why the Moon shines', exact: true }).click();
  const toy = page.getByRole('dialog', { name: 'Moonlight: why the Moon shines' });
  const viewport = page.viewportSize()!;
  await page.setViewportSize({ width: viewport.height, height: viewport.width });
  await expect(toy).toBeVisible();
  const frame = (await toy.locator('.moon-light__window').boundingBox())!;
  const size = page.viewportSize()!;
  expect(frame.x).toBeGreaterThanOrEqual(0);
  expect(frame.x + frame.width).toBeLessThanOrEqual(size.width);
  expect(frame.y + frame.height).toBeLessThanOrEqual(size.height);
  await toy.getByRole('button', { name: 'Back to the Moon' }).click();
  await expect(toy).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Moonlight: why the Moon shines', exact: true })).toBeFocused();
});
