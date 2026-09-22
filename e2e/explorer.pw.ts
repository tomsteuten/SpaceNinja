import { test, expect, attachShot } from './fixtures';

const snapshot = (page: any) => page.evaluate(() => (window as any).spaceNinjaSnapshot());

test('default route is an open solar-system hub with a close exploration return loop', async ({ page }, info) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start playing', exact: true }).click();
  await expect(page.locator('#boot')).toBeHidden();

  const choices = page.getByRole('navigation', { name: 'Choose a world' }).getByRole('button');
  await expect(choices).toHaveCount(4);
  for (const world of ['Earth', 'Moon', 'Mars', 'Saturn']) {
    await expect(page.getByRole('button', { name: `Fly to ${world}`, exact: true })).toBeVisible();
  }
  await attachShot(page, 'unified-system-phone', info);

  // The DOM fallback is a real launch. A second rapid press cannot create a second flight.
  const mars = page.getByRole('button', { name: 'Fly to Mars', exact: true });
  await mars.click();
  await mars.click({ force: true });
  await expect.poll(async () => (await snapshot(page)).phase).toBe('arrived');
  expect((await snapshot(page)).world).toBe('mars');
  await expect(page.locator('.mission-hud')).toBeVisible();
  await attachShot(page, 'unified-mars-arrival-phone', info);

  await page.getByRole('button', { name: 'Fly Home', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Fly to Saturn', exact: true })).toBeVisible();
  await attachShot(page, 'unified-returned-system-phone', info);
});
