import { test, expect, attachShot } from './fixtures';

test('the grown-ups panel keeps keyboard focus with a clear escape route', async ({ page }, info) => {
  await page.goto('/?grownups');
  const grownups = page.getByRole('dialog', { name: 'Grown-ups settings' });
  await expect(grownups).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start playing' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(grownups).toBeHidden();
  await expect(page.locator('#boot')).toBeHidden();
  await attachShot(page, 'keyboard-dialogs', info);
});

test('the Space map works from a keyboard or TV remote: Tab order, Left/Right pages, Enter flies', async ({ page }) => {
  const snapshot = () => page.evaluate(() => (window as any).spaceNinjaSnapshot());
  await page.addInitScript(() => localStorage.setItem('spaceninja.grownups.v1', 'yes'));
  await page.goto('/?fast');
  await expect(page.locator('.space-map')).toBeVisible();
  const previous = page.getByRole('button', { name: 'Previous worlds: Sun', exact: true });
  const next = page.getByRole('button', { name: 'Next worlds: Saturn', exact: true });
  const fly = (world: string) => page.getByRole('button', { name: `Fly to ${world}`, exact: true });

  // Tab order: previous arrow, the page's cards, next arrow.
  await previous.focus();
  for (const expected of [fly('Earth'), fly('Moon'), fly('Mars'), next]) {
    await page.keyboard.press('Tab');
    await expect(expected).toBeFocused();
  }

  // Enter on an arrow turns the page; at the end the arrow goes and focus stays on the map.
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await snapshot()).mapPage).toBe(2);
  await expect(fly('Saturn')).toBeFocused();
  // Left and Right turn pages from anywhere on the map.
  await page.keyboard.press('ArrowLeft');
  await expect.poll(async () => (await snapshot()).mapPage).toBe(1);
  await expect(fly('Earth')).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect.poll(async () => (await snapshot()).mapPage).toBe(0);
  await page.keyboard.press('ArrowLeft');
  expect((await snapshot()).mapPage).toBe(0);
  await expect(fly('Sun')).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await snapshot()).mapPage).toBe(1);

  // Back along the row from the next arrow, and Space on a card flies there.
  await next.focus();
  for (const expected of [fly('Mars'), fly('Moon')]) {
    await page.keyboard.press('Shift+Tab');
    await expect(expected).toBeFocused();
  }
  await page.keyboard.press('Space');
  await expect.poll(async () => (await snapshot()).phase).not.toBe('idle');
});
