import { test, expect, settlePanel } from './fixtures';

test('Earth day and night can be ended, repeated, and left without losing discoveries', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start playing', exact: true }).click();
  await page.getByRole('button', { name: 'Fly to Earth', exact: true }).click();
  const snapshot = () => page.evaluate(() => (window as any).spaceNinjaSnapshot());
  await expect.poll(async () => (await snapshot()).phase).toBe('arrived');
  const day = page.getByRole('button', { name: 'Day and night on Earth' });
  const done = page.getByRole('button', { name: 'Done with day and night' });
  // A first visit opens with the turn itself as the introduction: no gold places yet, the
  // button reads Done, and any tap on the world ends it straight into the guided hunt.
  await expect(done).toBeVisible();
  await expect.poll(async () => (await snapshot()).targets.length).toBe(0);
  await expect(page.locator('.fact-card')).toBeHidden();
  const { width, height } = page.viewportSize()!;
  await page.mouse.click(width / 2, height / 2);
  await expect(day).toBeVisible();
  await expect.poll(async () => (await snapshot()).guidedHunt).toBe(true);
  await expect.poll(async () => (await snapshot()).cameraReturning).toBe(false);
  await expect.poll(async () => (await snapshot()).targets.filter((target: { visible: boolean }) => target.visible).length).toBe(2);
  await expect(page.locator('.fact-card')).toBeHidden();
  const initial = await snapshot();

  const about = page.getByRole('button', { name: 'About', exact: true });
  await about.click();
  await expect(page.locator('.fact-card p')).toBeVisible();
  await settlePanel(page);
  await about.click();
  await expect(page.locator('.fact-card')).toBeHidden();

  await day.click();
  await expect(done).toBeVisible();
  await expect.poll(async () => (await snapshot()).targets.length).toBe(0);
  const frameBeforeHistory = (await snapshot()).frame;
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
  await expect(done).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
  await expect.poll(async () => (await snapshot()).frame).toBeGreaterThan(frameBeforeHistory);
  await expect.poll(async () => (await snapshot()).targets.length).toBe(0);
  await about.click();
  await expect(page.locator('.fact-card .fact-title')).toContainText('Day & night');
  await expect(page.locator('.fact-card p')).toBeVisible();
  await settlePanel(page);
  await about.click();
  await expect(page.locator('.fact-card')).toBeHidden();
  await done.click();
  await expect(day).toBeVisible();
  await expect.poll(async () => (await snapshot()).targets.length).toBe(initial.targets.length);
  await expect.poll(async () => (await snapshot()).cameraReturning).toBe(false);

  const restored = await snapshot();
  const target = restored.targets.find((item: { visible: boolean }) => item.visible);
  expect(target).toBeTruthy();
  expect(target.x).toBeGreaterThan(0);
  expect(target.x).toBeLessThan(page.viewportSize()!.width);
  expect(target.y).toBeGreaterThan(0);
  expect(target.y).toBeLessThan(page.viewportSize()!.height);
  await page.mouse.click(target.x, target.y);
  await expect.poll(async () => (await snapshot()).collected).toBe(1);
  await expect(page.locator('.photo-view.is-reward')).toBeVisible();
  await settlePanel(page);
  await page.getByRole('button', { name: 'Keep exploring' }).click();
  await expect(page.locator('.photo-view')).toBeHidden();

  await day.click();
  await expect(done).toBeVisible();
  await page.getByRole('button', { name: 'Space map', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Fly to Earth', exact: true })).toBeVisible();

  // A later visit does not run the introduction: the button is offered, the gold places are
  // there at once, and the discovery from the first visit is still recorded.
  await page.getByRole('button', { name: 'Fly to Earth', exact: true }).click();
  await expect.poll(async () => (await snapshot()).phase).toBe('arrived');
  await expect(day).toBeVisible();
  await expect(done).toBeHidden();
  await expect.poll(async () => (await snapshot()).targets.filter((target: { visible: boolean }) => target.visible).length).toBe(2);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('spaceninja.progress.v1') ?? '{}').discoveries?.length)).toBe(1);
});

test('the short landscape hunt counter leaves both gold places clear', async ({ page }, info) => {
  test.skip(info.project.name !== 'short-landscape');
  await page.goto('/');
  await page.getByRole('button', { name: 'Start playing', exact: true }).click();
  await page.getByRole('button', { name: 'Fly to Earth', exact: true }).click();
  const snapshot = () => page.evaluate(() => (window as any).spaceNinjaSnapshot());
  await expect.poll(async () => (await snapshot()).guidedHunt).toBe(true);
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
