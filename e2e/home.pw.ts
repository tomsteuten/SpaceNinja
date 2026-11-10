import type { Locator, Page } from '@playwright/test';
import { test, expect, attachShot } from './fixtures';

// Visual approval uses the device's full CSS resolution, independently of the slower
// multi-journey suite's rendering budget.
test.use({ deviceScaleFactor: 1 });

const snapshot = (page: Page) => page.evaluate(() => (window as any).spaceNinjaSnapshot());
type Box = { x: number; y: number; width: number; height: number };

/** Every world on the page is on screen, large enough, apart, and clear of every control. */
async function expectPageFramed(page: Page, controls: Locator[]) {
  const viewport = page.viewportSize()!;
  const s = await snapshot(page);
  const worlds = Object.entries(s.mapScreen) as [string, { x: number; y: number; radius: number }][];
  expect(worlds.map(([id]) => id).sort()).toEqual([...s.mapBodyIds].sort());
  const boxes: Box[] = [];
  for (const control of controls) {
    if (await control.isVisible()) boxes.push((await control.boundingBox())!);
  }
  for (const [id, body] of worlds) {
    expect(body.radius * 2, `${id} is clearly visible`).toBeGreaterThan(20);
    expect(body.x - body.radius, `${id} left edge`).toBeGreaterThanOrEqual(0);
    expect(body.x + body.radius, `${id} right edge`).toBeLessThanOrEqual(viewport.width);
    expect(body.y - body.radius, `${id} top edge`).toBeGreaterThanOrEqual(0);
    expect(body.y + body.radius, `${id} bottom edge`).toBeLessThanOrEqual(viewport.height);
    for (const box of boxes) {
      // The nearest point of the control to the world's centre is outside its silhouette.
      const nx = Math.max(box.x, Math.min(body.x, box.x + box.width));
      const ny = Math.max(box.y, Math.min(body.y, box.y + box.height));
      expect(Math.hypot(nx - body.x, ny - body.y), `${id} clear of a control`).toBeGreaterThan(body.radius * 0.9);
    }
  }
  worlds.forEach(([a, one], i) => worlds.slice(i + 1).forEach(([b, other]) => {
    expect(Math.hypot(one.x - other.x, one.y - other.y), `${a} apart from ${b}`).toBeGreaterThan(one.radius + other.radius);
  }));
}

test('home opens on Earth\'s neighbourhood and every world is a page turn away', async ({ page }, info) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start playing', exact: true }).click();
  await expect(page.locator('#boot')).toBeHidden();

  const cards = page.locator('.map-card');
  const previous = page.getByRole('button', { name: /^Previous worlds/ });
  const next = page.getByRole('button', { name: /^Next worlds/ });
  const journal = page.getByRole('button', { name: 'Open your discovery journal' });
  const controls = [cards.first(), cards.nth(1), cards.nth(2), previous, next, journal, page.locator('.hint'), page.locator('.map-dots')];

  // A new save: Earth's page, three cards, Earth suggested; only these worlds are drawn.
  await expect(cards).toHaveCount(3);
  await expect(page.locator('.map-card.is-suggested')).toHaveAttribute('data-destination', 'earth');
  await expect(page.locator('.hint')).toHaveText('Tap Earth');
  await expect.poll(async () => (await snapshot(page)).mapBodyIds).toEqual(['earth', 'moon', 'mars']);
  expect((await snapshot(page)).mapPage).toBe(1);
  await expect(page.locator('.map-dots > span')).toHaveCount(3);
  await expect(page.locator('.map-dots > span').nth(1)).toHaveClass(/is-current/);
  for (const world of ['Earth', 'Moon', 'Mars']) {
    await expect(page.getByRole('button', { name: `Fly to ${world}`, exact: true })).toBeVisible();
  }
  await expectPageFramed(page, controls);
  for (const control of [...await cards.all(), previous, next]) {
    const bounds = (await control.boundingBox())!;
    expect(bounds.width).toBeGreaterThanOrEqual(54);
    expect(bounds.height).toBeGreaterThanOrEqual(54);
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  }
  const hint = await page.locator('.hint').boundingBox();
  const journalBox = await journal.boundingBox();
  expect(hint!.x + hint!.width).toBeLessThan(journalBox!.x);
  await attachShot(page, 'home-earth-page', info);

  await journal.click();
  await expect(page.getByRole('dialog', { name: 'My Discoveries' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(journal).toBeFocused();
  await expect(page.locator('.space-map')).toBeVisible();

  // The Sun's page, to the left: the end, so no previous arrow; the next arrow carries the hint.
  await previous.click();
  await expect.poll(async () => (await snapshot(page)).mapBodyIds).toEqual(['sun']);
  await expect(previous).toBeHidden();
  await expect(cards).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Fly to Sun', exact: true })).toBeVisible();
  await expect(next).toHaveClass(/is-suggested/);
  await expect(next.locator('.map-pointer')).toHaveCount(1);
  await expect(page.locator('.map-pointer')).toHaveCount(1);
  await expect(page.locator('.hint')).toHaveText('Tap the arrow for Earth');
  await expectPageFramed(page, controls);
  await attachShot(page, 'home-sun-page', info);

  // A swipe on the scene turns the page: right to left is the next page, as in a book.
  const { width, height } = page.viewportSize()!;
  await page.mouse.move(width * 0.8, height * 0.4);
  await page.mouse.down();
  await page.mouse.move(width * 0.2, height * 0.4, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => (await snapshot(page)).mapPage).toBe(1);
  await expect(page.locator('.hint')).toHaveText('Tap Earth');

  // The keyboard (or a TV remote) turns pages with Left and Right.
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await snapshot(page)).mapBodyIds).toEqual(['saturn']);
  await expect(next).toBeHidden();
  await expect(previous).toHaveClass(/is-suggested/);
  await expectPageFramed(page, controls);
  await attachShot(page, 'home-saturn-page', info);
  await page.keyboard.press('ArrowRight');
  expect((await snapshot(page)).mapPage).toBe(2);

  // The far world is a tap away on its own page, in the scene as well as on its card.
  const saturn = (await snapshot(page)).mapScreen.saturn;
  await page.mouse.click(saturn.x, saturn.y);
  await expect.poll(async () => (await snapshot(page)).phase).not.toBe('idle');
  await expect(page.locator('.space-map')).toBeHidden();
  // The journey draws every world again.
  await expect.poll(async () => (await snapshot(page)).mapBodyIds).toEqual(['sun', 'earth', 'moon', 'mars', 'saturn']);
});
