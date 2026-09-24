import { test, expect, attachShot } from './fixtures';

// Visual approval uses the device's full CSS resolution, independently of the slower
// multi-journey suite's rendering budget.
test.use({ deviceScaleFactor: 1 });

test('home gives the Moon a clear invitation and answers future-world presses', async ({ page }, info) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start playing', exact: true }).click();
  await expect(page.locator('#boot')).toBeHidden();
  const destinations = page.locator('.destination-choice');
  await expect(destinations).toHaveCount(4);
  await expect(page.locator('.destination-choice.is-suggested')).toHaveAttribute('data-destination', 'moon');
  await expect.poll(() => page.evaluate(() => (window as any).spaceNinjaSnapshot().mapBodyIds))
    .toEqual(['earth', 'moon']);
  await expect.poll(() => page.evaluate(() => (window as any).spaceNinjaSnapshot().bodyScreenRadius))
    .toBeGreaterThan(50);

  const journal = page.getByRole('button', { name: 'Open your discovery journal' });
  const hint = await page.locator('.hint').boundingBox();
  const journalBox = await journal.boundingBox();
  expect(hint!.x + hint!.width).toBeLessThan(journalBox!.x);
  for (const button of await destinations.all()) {
    const bounds = await button.boundingBox();
    expect(bounds!.width).toBeGreaterThanOrEqual(54);
    expect(bounds!.height).toBeGreaterThanOrEqual(54);
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  }
  await attachShot(page, 'home-map', info);

  await page.getByRole('button', { name: 'Mars — visit The Moon first', exact: true }).click();
  await expect(page.locator('.hint')).toHaveText('Visit The Moon first');
  await expect.poll(() => page.evaluate(() => (window as any).spaceNinjaSnapshot().phase)).toBe('idle');
  await expect(page.locator('[data-destination="mars"]')).toHaveClass(/is-refused/);
  await journal.click();
  await expect(page.getByRole('dialog', { name: 'My Discoveries' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(journal).toBeFocused();
  await expect(page.locator('.destination-bar')).toBeVisible();
});
