import { test, expect } from './fixtures';

test('Earth day and night can be ended, repeated, and left without losing discoveries', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start playing', exact: true }).click();
  await page.getByRole('button', { name: 'Fly to Earth', exact: true }).click();
  const snapshot = () => page.evaluate(() => (window as any).spaceNinjaSnapshot());
  await expect.poll(async () => (await snapshot()).phase).toBe('arrived');
  const day = page.getByRole('button', { name: 'Day and night on Earth' });
  await expect(day).toBeVisible();
  await expect(page.locator('.fact-card')).toBeHidden();
  const initial = await snapshot();
  expect(initial.targets.filter((target: { visible: boolean }) => target.visible)).toHaveLength(2);

  const about = page.getByRole('button', { name: 'About', exact: true });
  await about.click();
  await expect(page.locator('.fact-card p')).toBeVisible();
  await about.click();
  await expect(page.locator('.fact-card')).toBeHidden();

  await day.click();
  const done = page.getByRole('button', { name: 'Done with day and night' });
  await expect(done).toBeVisible();
  await expect.poll(async () => (await snapshot()).targets.length).toBe(0);
  await about.click();
  await expect(page.locator('.fact-card .fact-title')).toContainText('Day & night');
  await expect(page.locator('.fact-card p')).toBeVisible();
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
  await page.getByRole('button', { name: 'Keep exploring' }).click();

  await day.click();
  await expect(done).toBeVisible();
  await page.getByRole('button', { name: 'Fly Home', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Fly to Earth', exact: true })).toBeVisible();
});
