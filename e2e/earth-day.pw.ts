import { test, expect, settlePanel } from './fixtures';

test('Earth day and night is child-triggered, repeatable, and leaves discoveries intact', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start playing', exact: true }).click();
  await page.getByRole('button', { name: 'Fly to Earth', exact: true }).click();
  const snapshot = () => page.evaluate(() => (window as any).spaceNinjaSnapshot());
  await expect.poll(async () => (await snapshot()).phase).toBe('arrived');
  const day = page.getByRole('button', { name: 'Day and night on Earth' });
  const done = page.getByRole('button', { name: 'Done with day and night' });
  const visibleTargets = async () =>
    (await snapshot()).targets.filter((target: { visible: boolean }) => target.visible).length;

  // No automatic turn any more: the gold places are on screen at once and day & night is an
  // offered button the child triggers themselves (it pulses on this first visit).
  await expect(day).toBeVisible();
  await expect(done).toBeHidden();
  await expect.poll(visibleTargets).toBe(2);
  await expect(page.locator('.fact-card')).toBeHidden();

  // Trigger it: the world turns, the places step aside, the button becomes Done.
  await day.click();
  await expect(done).toBeVisible();
  await expect.poll(async () => (await snapshot()).targets.length).toBe(0);

  // The words are one tap away while it turns.
  const about = page.getByRole('button', { name: 'About', exact: true });
  await about.click();
  await expect(page.locator('.fact-card .fact-title')).toContainText('Day & night');
  await expect(page.locator('.fact-card p')).toBeVisible();
  await settlePanel(page);
  await about.click();
  await expect(page.locator('.fact-card')).toBeHidden();

  // Survive a history suspend/restore mid-turn.
  const frameBeforeHistory = (await snapshot()).frame;
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
  await expect(done).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
  await expect.poll(async () => (await snapshot()).frame).toBeGreaterThan(frameBeforeHistory);
  await expect(done).toBeVisible();

  // End the turn: it leads into the guided hunt, the places return, none lost, camera handed back.
  await done.click();
  await expect(day).toBeVisible();
  await expect.poll(async () => (await snapshot()).guidedHunt).toBe(true);
  await expect.poll(visibleTargets).toBe(2);
  await expect.poll(async () => (await snapshot()).cameraReturning).toBe(false);

  // Collect one visible place.
  const target = (await snapshot()).targets.find((item: { visible: boolean }) => item.visible);
  expect(target).toBeTruthy();
  expect(target.x).toBeGreaterThan(0);
  expect(target.x).toBeLessThan(page.viewportSize()!.width);
  await page.mouse.click(target.x, target.y);
  await expect.poll(async () => (await snapshot()).collected).toBe(1);
  await expect(page.locator('.photo-view.is-reward')).toBeVisible();
  await settlePanel(page);
  await page.getByRole('button', { name: 'Keep exploring' }).click();
  await expect(page.locator('.photo-view')).toBeHidden();

  // Leave via Space map and return: still offered (not automatic), the discovery persists.
  await page.getByRole('button', { name: 'Space map', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Fly to Earth', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Fly to Earth', exact: true }).click();
  await expect.poll(async () => (await snapshot()).phase).toBe('arrived');
  await expect(day).toBeVisible();
  await expect(done).toBeHidden();
  await expect.poll(visibleTargets).toBe(2);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('spaceninja.progress.v1') ?? '{}').discoveries?.length)).toBe(1);
});

test('the short landscape hunt counter leaves both gold places clear', async ({ page }, info) => {
  test.skip(info.project.name !== 'short-landscape');
  await page.goto('/');
  await page.getByRole('button', { name: 'Start playing', exact: true }).click();
  await page.getByRole('button', { name: 'Fly to Earth', exact: true }).click();
  const snapshot = () => page.evaluate(() => (window as any).spaceNinjaSnapshot());
  await expect.poll(async () => (await snapshot()).phase).toBe('arrived');
  // Trigger day & night and end it, which leads into the guided hunt deterministically rather
  // than waiting out the roam timer.
  await page.getByRole('button', { name: 'Day and night on Earth' }).click();
  await page.getByRole('button', { name: 'Done with day and night' }).click();
  await expect.poll(async () => (await snapshot()).guidedHunt).toBe(true);
  await expect.poll(async () => (await snapshot()).cameraReturning).toBe(false);
  const hud = page.locator('.mission-hud');
  await expect(hud).toBeVisible();
  const bounds = await hud.boundingBox();
  expect(bounds).toBeTruthy();
  const visible = (await snapshot()).targets.filter((target: { visible: boolean }) => target.visible);
  expect(visible).toHaveLength(2);
  for (const target of visible) {
    const outside = target.x < bounds!.x - 10 || target.x > bounds!.x + bounds!.width + 10 ||
      target.y < bounds!.y - 10 || target.y > bounds!.y + bounds!.height + 10;
    expect(outside, 'A gold place must remain clear of the guided-hunt counter').toBe(true);
  }
});
