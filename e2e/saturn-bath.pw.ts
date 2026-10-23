import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

const snapshot = (page: Page) => page.evaluate(() => (window as any).spaceNinjaSnapshot());

/*
 * Saturn's toy is the bath. Like Jump on the Moon, the places come first and the toy appears
 * as the next step after three finds; inside, the rocky worlds sink and only Saturn floats.
 */
test('Saturn: the bath is the next step after three finds, and floats only Saturn', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('spaceninja.sound.v1', 'off');
    localStorage.setItem('spaceninja.progress.v1', JSON.stringify({ visited: ['earth', 'moon', 'mars'], discoveries: [], stickers: [] }));
  });
  await page.goto('/?fast');
  await page.getByRole('button', { name: 'Start playing', exact: true }).click();
  await page.getByRole('button', { name: 'Fly to Saturn', exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).phase).toBe('arrived');

  // The bath waits for the places.
  const bathButton = page.locator('.bath-btn');
  await expect(page.locator('.home-btn')).toBeVisible();
  await expect(bathButton).toBeHidden();

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
  await expect(page.locator('.world-heading__caption')).toHaveText('Three found! Now try the bath.');
  await expect(bathButton).toBeVisible();
  await expect(page.locator('.visit-actions .journal-btn')).toBeHidden();

  // Drop all four worlds in, and only Saturn stays on top.
  await page.getByRole('button', { name: 'Saturn bath time', exact: true }).click();
  await expect(ui).not.toHaveClass(/is-toy-next/);
  const bath = page.locator('.saturn-bath');
  await expect(bath).toBeVisible();
  for (let i = 0; i < 4; i++) {
    await bath.locator('.saturn-bath__plop').click();
    await page.waitForTimeout(300);
  }
  await expect(bath).toHaveAttribute('data-shelf', '');
  await expect(bath).toHaveAttribute('data-floating', 'saturn', { timeout: 60000 });
  await expect(bath).toHaveAttribute('data-sunk', /earth/);
  await expect(bath).toHaveAttribute('data-sunk', /mars/);
  await expect(bath).toHaveAttribute('data-sunk', /moon/);
  await expect(bath).not.toHaveAttribute('data-sunk', /saturn/);
  await expect(bath.getByRole('button', { name: 'Empty the bath' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to Saturn', exact: true }).click();
  await expect(page.locator('.saturn-bath')).toHaveCount(0);
  // Detached when closed, not hidden: the scene's canvas is the only one left.
  await expect(page.locator('canvas')).toHaveCount(1);
  await expect(page.locator('.world-heading__caption')).toHaveText('Choose your next trip on the Space map.');
  await expect(page.locator('.visit-actions .journal-btn')).toBeVisible();
});
