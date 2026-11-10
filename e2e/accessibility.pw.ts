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

test('the Space map works from a keyboard or TV remote: Tab order, Left/Right pages, Enter flies', async ({ page }) => {
  const snapshot = () => page.evaluate(() => (window as any).spaceNinjaSnapshot());
  await page.addInitScript(() => localStorage.setItem('spaceninja.grownups.v1', 'yes'));
  await page.goto('/?fast');
  await expect(page.locator('.space-map')).toBeVisible();
  const previous = page.getByRole('button', { name: 'Previous worlds: Sun', exact: true });
  const next = page.getByRole('button', { name: 'Next worlds: Saturn', exact: true });
  const fly = (world: string) => page.getByRole('button', { name: `Fly to ${world}`, exact: true });
  const journal = page.getByRole('button', { name: 'Open your discovery journal' });

  // Tab order: previous arrow, the page's cards, next arrow, journal.
  await previous.focus();
  for (const expected of [fly('Earth'), fly('Moon'), fly('Mars'), next, journal]) {
    await page.keyboard.press('Tab');
    await expect(expected).toBeFocused();
  }
  await page.keyboard.press('Shift+Tab');
  await expect(next).toBeFocused();

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

  // An open journal owns the keys: Left/Right do not turn the page behind it.
  await journal.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'My Discoveries' })).toBeVisible();
  await page.keyboard.press('ArrowRight');
  expect((await snapshot()).mapPage).toBe(1);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'My Discoveries' })).toBeHidden();
  // The dialog hands focus back on the next animation frame; let it land first.
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
  await expect(journal).toBeFocused();

  // Back along the row from the journal, and Space on a card flies there.
  for (const expected of [next, fly('Mars'), fly('Moon')]) {
    await page.keyboard.press('Shift+Tab');
    await expect(expected).toBeFocused();
  }
  await page.keyboard.press('Space');
  await expect.poll(async () => (await snapshot()).phase).not.toBe('idle');
});
