import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('a failed game bundle offers retry and the real game boots after recovery', async ({ page }) => {
  await page.route('**/assets/index-*.js', route => route.abort('failed'));
  await page.goto('/');
  await expect(page.locator('#boot')).toHaveClass(/has-load-error/);
  await expect(page.locator('.boot-status')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Start again', exact: true })).toBeVisible();
  await page.unroute('**/assets/index-*.js');
  await page.getByRole('button', { name: 'Start again', exact: true }).click();
  await expect(page.locator('#boot')).toBeHidden();
  await page.getByRole('button', { name: 'Start playing', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Fly to Moon', exact: true })).toBeVisible();
});

test('a stalled download offers retry and a late bundle can still finish startup', async ({ page }) => {
  await page.clock.install();
  let release: () => void = () => {};
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/assets/index-*.js', async route => {
    await held;
    await route.continue();
  });
  try {
    await page.goto('/', { waitUntil: 'commit' });
    await expect(page.locator('.boot-status')).toBeVisible();
    await page.clock.fastForward(45001);
    await expect(page.locator('#boot')).toHaveClass(/has-load-error/);
    await expect(page.getByRole('button', { name: 'Start again', exact: true })).toBeVisible();
    release();
    await expect(page.locator('#boot')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Start playing', exact: true })).toBeVisible();
  } finally {
    release();
  }
});
