import { test, expect, attachShot } from './fixtures';

test('grown-ups panel and journal keep keyboard focus with a clear escape route', async ({ page }, info) => {
  await page.goto('/?classic&grownups');
  const grownups = page.getByRole('dialog', { name: 'Grown-ups settings' });
  await expect(grownups).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start playing' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(grownups).toBeHidden();
  await expect(page.locator('#boot')).toBeHidden();
  await page.getByRole('button', { name: 'Open your discovery journal' }).click();
  const journal = page.getByRole('dialog', { name: 'My Discoveries' });
  const close = journal.getByRole('button', { name: 'Close', exact: true });
  await expect(close).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(journal).toBeHidden();
  await expect(page.getByRole('button', { name: 'Open your discovery journal' })).toBeFocused();
  await attachShot(page, 'keyboard-dialogs', info);
});
