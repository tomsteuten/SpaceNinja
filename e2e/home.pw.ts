import { test, expect, attachShot } from './fixtures';

// Visual approval uses the device's full CSS resolution, independently of the slower
// multi-journey suite's rendering budget.
test.use({ deviceScaleFactor: 1 });

test('home suggests Earth first, and every world is drawn and flies from the first second', async ({ page }, info) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start playing', exact: true }).click();
  await expect(page.locator('#boot')).toBeHidden();
  const destinations = page.locator('.destination-choice');
  await expect(destinations).toHaveCount(5);
  await expect(page.locator('.destination-choice.is-suggested')).toHaveAttribute('data-destination', 'earth');
  // Nothing is locked: every world is in the scene and tappable on a brand-new save.
  await expect.poll(() => page.evaluate(() => (window as any).spaceNinjaSnapshot().mapBodyIds))
    .toEqual(['sun', 'earth', 'moon', 'mars', 'saturn']);
  for (const world of ['Sun', 'Earth', 'Moon', 'Mars', 'Saturn']) {
    await expect(page.getByRole('button', { name: `Fly to ${world}`, exact: true })).toBeVisible();
  }
  await expect(page.locator('.destination-choice__lock, .destination-choice.is-locked')).toHaveCount(0);

  // The framing fits the worlds it draws: each planet and moon's silhouette (Saturn's rings
  // included) is on screen and clear of the destination bar. The Sun is a distant backdrop.
  const bar = (await page.locator('.destination-bar').boundingBox())!;
  const viewport = page.viewportSize()!;
  const screen = await page.evaluate(() => (window as any).spaceNinjaSnapshot().mapScreen);
  for (const id of ['earth', 'moon', 'mars', 'saturn']) {
    const body = screen[id];
    expect(body.x - body.radius, `${id} left edge`).toBeGreaterThanOrEqual(0);
    expect(body.x + body.radius, `${id} right edge`).toBeLessThanOrEqual(viewport.width);
    expect(body.y - body.radius, `${id} top edge`).toBeGreaterThanOrEqual(0);
    expect(body.y + body.radius, `${id} bottom edge`).toBeLessThanOrEqual(bar.y);
  }
  await expect.poll(() => page.evaluate(() => (window as any).spaceNinjaSnapshot().bodyScreenRadius))
    .toBeGreaterThan(5);

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

  await journal.click();
  await expect(page.getByRole('dialog', { name: 'My Discoveries' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(journal).toBeFocused();
  await expect(page.locator('.destination-bar')).toBeVisible();

  // The far world is a press away, not a lesson away.
  await page.getByRole('button', { name: 'Fly to Saturn', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).spaceNinjaSnapshot().phase)).not.toBe('idle');
});
