import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

const snapshot = (page: Page) => page.evaluate(() => (window as any).spaceNinjaSnapshot());

/*
 * Mars's toy is the rover. Like Jump on the Moon, the places come first and the toy appears as the
 * next step after three finds; inside, every command takes a while to reach Mars, and the
 * rover moves only when it gets there.
 */
test('Mars: the rover waits for each message, drills a sample, and is the next step after three finds', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('spaceninja.sound.v1', 'off');
    localStorage.setItem('spaceninja.progress.v1', JSON.stringify({ visited: ['earth', 'moon'], discoveries: [], stickers: [] }));
  });
  await page.goto('/?fast');
  await page.getByRole('button', { name: 'Start playing', exact: true }).click();
  await page.getByRole('button', { name: 'Fly to Mars', exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).phase).toBe('arrived');

  // The rover waits for the places: during the hunt the row is Space map and Listen.
  await expect(page.locator('.home-btn')).toBeVisible();
  await expect(page.locator('.rover-btn')).toBeHidden();

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
  await expect(page.locator('.world-heading__caption')).toHaveText('Three found! Now drive the rover.');
  await expect(page.locator('.visit-actions .is-appearing')).toHaveCount(0);

  // Rover has its own cell in the row (Space map, Listen, Day & night, Rover, Journal): the
  // row fits, side by side, each control a big enough touch target.
  const row = (await page.locator('.visit-actions').boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(row.x).toBeGreaterThanOrEqual(0);
  expect(row.x + row.width).toBeLessThanOrEqual(viewport.width);
  expect(row.y + row.height).toBeLessThanOrEqual(viewport.height);
  const boxes = await page.locator('.visit-actions > button:visible').evaluateAll(buttons =>
    buttons.map(button => button.getBoundingClientRect().toJSON() as DOMRect));
  expect(boxes).toHaveLength(3);
  for (let i = 0; i < boxes.length; i++) {
    expect(boxes[i]!.width).toBeGreaterThanOrEqual(54);
    expect(boxes[i]!.height).toBeGreaterThanOrEqual(54);
    if (i) expect(boxes[i]!.x).toBeGreaterThanOrEqual(boxes[i - 1]!.x + boxes[i - 1]!.width);
  }

  // A message leaves Earth at once; the rover stays put until it lands.
  await page.getByRole('button', { name: 'Drive the Mars rover', exact: true }).click();
  const rover = page.locator('.mars-rover');
  await expect(rover).toBeVisible();
  await expect(rover).toContainText('Send the rover a message!');
  await expect(rover).toHaveAttribute('data-col', '0');
  await expect(rover).toHaveAttribute('data-row', '3');
  await page.getByRole('button', { name: 'Drive right', exact: true }).click();
  await expect(rover).toHaveAttribute('data-flying', '1');
  await expect(rover).toHaveAttribute('data-col', '0');
  // Then plan ahead: two more moves and a drill, all in flight together, onto the rock at (1, 1).
  await page.getByRole('button', { name: 'Drive up', exact: true }).click();
  await page.getByRole('button', { name: 'Drive up', exact: true }).click();
  await page.getByRole('button', { name: 'Drill a rock', exact: true }).click();
  await expect(rover).toHaveAttribute('data-col', '1', { timeout: 60000 });
  await expect(rover).toHaveAttribute('data-row', '1', { timeout: 60000 });
  await expect(rover).toHaveAttribute('data-samples', '1', { timeout: 60000 });
  await expect(rover).toHaveAttribute('data-flying', '0');
  await page.getByRole('button', { name: 'Back to Mars', exact: true }).click();
  await expect(page.locator('.mars-rover')).toHaveCount(0);
  // Detached when closed, not hidden: the scene's canvas is the only one left.
  await expect(page.locator('canvas')).toHaveCount(1);

  await expect(ui).not.toHaveClass(/is-toy-next/);
  await expect(page.locator('.world-heading__caption')).toHaveText('Three found this trip! See your journal.');
  await expect(page.locator('.visit-actions .journal-btn')).toBeVisible();
});
