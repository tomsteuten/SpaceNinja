import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

const snapshot = (page: Page) => page.evaluate(() => (window as any).spaceNinjaSnapshot());

/*
 * The Moon has gold places and a toy. Places come first and the toy is the next step, and
 * neither talks over the other: the places guidance waits while the jump is open, and after
 * the third find Jump (not the journal) is what the visit points at.
 */
test('Moon: the hunt waits while Jump is open, and Jump is the next step after three finds', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('spaceninja.sound.v1', 'off'));
  await page.goto('/?fast');
  await page.getByRole('button', { name: 'Start playing', exact: true }).click();
  await page.getByRole('button', { name: 'Fly to Moon', exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).phase).toBe('arrived');

  // Straight into the toy: the 12-second hunt start must not fire behind it.
  await page.getByRole('button', { name: 'Jump on the Moon', exact: true }).click();
  await expect(page.locator('.moon-jump')).toBeVisible();
  await page.waitForTimeout(14000);
  expect((await snapshot(page)).guidedHunt).toBe(false);
  await expect(page.locator('.mission-hud')).toBeHidden();
  await page.getByRole('button', { name: 'Back to the Moon', exact: true }).click();
  await expect(page.locator('.moon-jump')).toHaveCount(0);

  for (let i = 0; i < 3; i++) {
    let target = (await snapshot(page)).targets.find((t: any) => t.visible);
    if (!target) {
      await page.locator('.hunt-arrow').click();
      await expect.poll(async () => (await snapshot(page)).targets.some((t: any) => t.visible)).toBe(true);
      target = (await snapshot(page)).targets.find((t: any) => t.visible);
    }
    await page.mouse.click(target.x, target.y);
    await expect(page.locator('.photo-view.is-reward')).toBeVisible();
    await page.waitForTimeout(650);
    await page.getByRole('button', { name: 'Close the photo', exact: true }).click();
    await expect(page.locator('.photo-view')).toBeHidden();
    await page.waitForTimeout(800);
  }

  const ui = page.locator('#ui');
  await expect(ui).toHaveClass(/is-toy-next/);
  await expect(page.locator('.world-heading__caption')).toHaveText('Three found! Now try Jump.');
  await page.getByRole('button', { name: 'Jump on the Moon', exact: true }).click();
  await expect(ui).not.toHaveClass(/is-toy-next/);
  await page.getByRole('button', { name: 'Back to the Moon', exact: true }).click();
  await expect(page.locator('.world-heading__caption')).toHaveText('Three found this trip! See your journal.');
});
