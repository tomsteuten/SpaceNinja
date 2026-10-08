import { test, expect, attachShot } from './fixtures';

test('grown-ups panel and journal keep keyboard focus with a clear escape route', async ({ page }, info) => {
  await page.goto('/?grownups');
  const grownups = page.getByRole('dialog', { name: 'Grown-ups settings' });
  await expect(grownups).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start playing' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(grownups).toBeHidden();
  await expect(page.locator('#boot')).toBeHidden();
  await page.getByRole('button', { name: 'Open your discovery journal' }).click();
  const journal = page.getByRole('dialog', { name: 'My Discoveries' });
  const close = journal.getByRole('button', { name: 'Close', exact: true });
  const dismiss = journal.getByRole('button', { name: 'Close journal', exact: true });
  const worlds = journal.getByRole('group', { name: 'Places found on each world' }).getByRole('button');
  const earth = worlds.filter({ hasText: 'Earth' });
  const moon = worlds.filter({ hasText: 'Moon' });
  await expect(earth).toHaveAttribute('aria-pressed', 'true');
  await expect(moon).toBeVisible();
  const worldCount = await worlds.count();
  await expect(close).toBeFocused();
  // The pictured return is last in DOM order. Tab wraps to X, then visits the
  // world-page buttons added to the journal, before returning to the exit.
  await page.keyboard.press('Tab');
  await expect(dismiss).toBeFocused();
  for (let i = 0; i < worldCount; i++) {
    await page.keyboard.press('Tab');
    await expect(worlds.nth(i)).toBeFocused();
  }
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  for (let i = worldCount - 1; i >= 0; i--) {
    await page.keyboard.press('Shift+Tab');
    await expect(worlds.nth(i)).toBeFocused();
  }
  await page.keyboard.press('Shift+Tab');
  await expect(dismiss).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(close).toBeFocused();

  // Activating a page rebuilds the selectors. Focus must stay on the selected
  // world, so the next key still belongs to the journal rather than the game.
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(earth).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(moon).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(journal.locator('.journal-page-caption')).toHaveText('Moon · 0 of 6 places found');
  await expect(moon).toHaveAttribute('aria-pressed', 'true');
  await expect(moon).toBeFocused();
  await attachShot(page, 'keyboard-journal-world-page', info);
  await page.keyboard.press('Escape');
  await expect(journal).toBeHidden();
  await expect(page.getByRole('button', { name: 'Open your discovery journal' })).toBeFocused();
  await attachShot(page, 'keyboard-dialogs', info);
});
