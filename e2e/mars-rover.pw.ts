import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

const snapshot = (page: Page) => page.evaluate(() => (window as any).spaceNinjaSnapshot());

/*
 * Mars's toy is the rover. Like Jump on the Moon, the places come first and the toy appears as the
 * next step after three finds; inside, the child taps a rock, the message takes a while to
 * reach Mars, and only then does the rover drive there and drill.
 */
test('Mars: the rover is the next step after three finds; a tapped rock waits for the message, then is drilled', async ({ page }) => {
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

  // One verb: tap a rock. A message flies from Earth; the rover waits until it lands, then
  // drives itself to that rock and drills it.
  await page.getByRole('button', { name: 'Drive the Mars rover', exact: true }).click();
  const rover = page.locator('.mars-rover');
  await expect(rover).toBeVisible();
  await expect(rover.locator('.mars-rover__caption')).toHaveText('Tap a rock!');
  await expect(rover).toHaveAttribute('data-phase', 'idle');
  await expect(rover).toHaveAttribute('data-rocks', '3');
  // Big tap targets, much bigger than the drawn rock.
  for (const box of await rover.locator('.mars-rover__rock').evaluateAll(nodes =>
    nodes.map(n => n.getBoundingClientRect().toJSON() as DOMRect))) {
    expect(box.width).toBeGreaterThanOrEqual(64);
    expect(box.height).toBeGreaterThanOrEqual(64);
  }
  const rock = (n: number) => page.getByRole('button', { name: `Send the rover to rock ${n}`, exact: true });
  await rock(2).click();
  await expect(rover).toHaveAttribute('data-flying', '1');
  await expect(rover).toHaveAttribute('data-phase', 'message');
  await expect(rover.locator('.mars-rover__caption')).toHaveText('Mars is far away!');
  // A tap while the message is on its way is acknowledged and forgotten, not queued.
  await rock(1).click();
  await expect(rover).toHaveAttribute('data-nudges', '1');
  await expect(rover).toHaveAttribute('data-samples', '1', { timeout: 60000 });
  await expect(rover).toHaveAttribute('data-phase', 'idle');
  await expect(rover).toHaveAttribute('data-flying', '0');
  await expect(rover).toHaveAttribute('data-rocks', '2');
  await expect(rover.locator('.mars-rover__caption')).toHaveText('A rock sample!');
  await expect(rock(2)).toBeHidden();

  // Three tubes bring new rocks, and the caption comes back to the invitation.
  for (const n of [1, 3]) {
    await rock(n).click();
    await expect(rover).toHaveAttribute('data-phase', 'idle', { timeout: 60000 });
  }
  await expect(rover).toHaveAttribute('data-samples', '3');
  await expect(rover).toHaveAttribute('data-rocks', '3', { timeout: 60000 });
  await expect(rover.locator('.mars-rover__caption')).toHaveText('Tap a rock!');
  await page.getByRole('button', { name: 'Back to Mars', exact: true }).click();
  await expect(page.locator('.mars-rover')).toHaveCount(0);
  // Detached when closed, not hidden: the scene's canvas is the only one left.
  await expect(page.locator('canvas')).toHaveCount(1);

  await expect(ui).not.toHaveClass(/is-toy-next/);
  await expect(page.locator('.world-heading__caption')).toHaveText('Three found this trip! See your journal.');
  await expect(page.locator('.visit-actions .journal-btn')).toBeVisible();
});
