import type { Page } from '@playwright/test';
import { test, expect, expectRendering } from './fixtures';

const snapshot = (page: Page) => page.evaluate(() => (window as any).spaceNinjaSnapshot());
// Null while a reload is replacing the document, so polling rides through the navigation.
const timeOrigin = (page: Page) => page.evaluate(() => performance.timeOrigin).catch(() => null);
// The registration listener's contract is what protects play from a real worker takeover.
// Dispatching the browser event covers that branch deterministically without claiming a
// second deployed build exists in this one-build test server. It is queued, not dispatched
// inside the evaluate, because an accepted update reloads the page synchronously.
const takeOver = (page: Page) => page.evaluate(() => {
  setTimeout(() => navigator.serviceWorker.dispatchEvent(new Event('controllerchange')), 0);
});

// Offline, a HEAD probe for an optional image that was never cached (the placeholder sun, a
// derived roughness map) is a network failure by design; the loader falls back quietly. The
// test ignores that console text and instead proves every failed request was such a probe.
test.use({ ignoredConsoleErrors: [/^Failed to load resource: net::ERR_FAILED$/] });

test('installed outing reloads offline and an update never restarts a stopped outing', async ({ page, context }) => {
  const failed: string[] = [];
  page.on('requestfailed', (request) => {
    if (request.failure()?.errorText !== 'net::ERR_ABORTED') failed.push(`${request.method()} ${request.url()}`);
  });
  await page.goto('/');
  await expect(page.locator('#boot')).toBeHidden();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker?.controller))).toBe(true);

  // The route has now cached its shell. A subsequent launch must work without a network.
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: 'Help me to the Moon' })).toBeVisible();
  await context.setOffline(false);
  await expect(page.locator('#boot')).toBeHidden();

  // Untouched opening view: the new build may land invisibly.
  expect((await snapshot(page)).updateSafe).toBe(true);
  const untouched = await timeOrigin(page);
  await takeOver(page);
  await expect.poll(() => timeOrigin(page)).not.toBe(untouched);
  await expect(page.locator('#boot')).toBeHidden();

  // A child who asked for help and then stopped is mid-outing, even though the ship is still.
  await page.getByRole('button', { name: 'Help me to the Moon' }).click();
  await page.getByRole('button', { name: /Stop$/ }).click();
  await expect.poll(async () => (await snapshot(page)).speed).toBe(0);
  expect((await snapshot(page)).updateSafe).toBe(false);
  const playing = await timeOrigin(page);
  const before = (await snapshot(page)).frame;
  await takeOver(page);
  await expect.poll(async () => (await snapshot(page)).frame).toBeGreaterThan(before + 10);
  expect(await timeOrigin(page)).toBe(playing);
  expect((await snapshot(page)).touched).toBe(true);
  await expectRendering(page);
  for (const request of failed) expect(request, 'Only optional image probes may fail offline').toMatch(/^HEAD .+\.(jpg|png)$/);
});
