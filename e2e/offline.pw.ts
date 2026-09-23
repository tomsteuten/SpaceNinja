import { test, expect, expectRendering } from './fixtures';

test('installed shell reloads offline and an active adventure defers a controller handover', async ({ page, context }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start playing', exact: true }).click();
  await expect(page.locator('#boot')).toBeHidden();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker?.controller))).toBe(true);

  // The route has now cached its shell. A subsequent launch must work without a network.
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: 'Fly to Moon', exact: true })).toBeVisible();
  await context.setOffline(false);

  await page.getByRole('button', { name: 'Fly to Moon', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).spaceNinjaSnapshot().phase)).toBe('arrived');
  const before = await page.evaluate(() => (window as any).spaceNinjaSnapshot().frame);
  // The registration listener's contract is what protects an in-progress adventure from a
  // real worker takeover. Dispatching the browser event gives that branch deterministic
  // coverage without claiming a second deployed build exists in this one-build test server.
  await page.evaluate(() => navigator.serviceWorker.dispatchEvent(new Event('controllerchange')));
  await expect.poll(() => page.evaluate(() => (window as any).spaceNinjaSnapshot().frame)).toBeGreaterThan(before);
  await expect(page.getByRole('button', { name: 'Fly Home', exact: true })).toBeVisible();
  await expectRendering(page);
});
