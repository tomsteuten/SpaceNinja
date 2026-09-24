import { test, expect, attachShot, expectRendering } from './fixtures';

test('Earth to Moon outing: pilot, stop, help, Tycho, memory and return', async ({ page }, info) => {
  test.setTimeout(480_000); // Software WebGL can stretch the full journey on Windows.
  await page.goto('/?outing');
  await expect(page.locator('#boot')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Help me to the Moon' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as any).spaceNinjaSnapshot().shipVisible)).toBe(true);
  await attachShot(page, 'outing-ready', info);

  const { width, height } = page.viewportSize()!;
  await page.mouse.move(width * 0.55, height * 0.44);
  await page.mouse.down();
  await page.waitForTimeout(650);
  await expect.poll(() => page.evaluate(() => (window as any).spaceNinjaSnapshot().speed)).toBeGreaterThan(0.1);
  await attachShot(page, 'outing-steering', info);
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => (window as any).spaceNinjaSnapshot().speed)).toBe(0);

  // Reduced motion replaces the optional automatic journey with a cut to the Moon.
  const reduced = await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  if (!reduced) {
    await page.getByRole('button', { name: 'Help me to the Moon' }).click();
    await expect.poll(() => page.evaluate(() => (window as any).spaceNinjaSnapshot().autopilot)).toBe('moon');
    await page.getByRole('button', { name: 'Stop' }).click();
    await expect.poll(() => page.evaluate(() => (window as any).spaceNinjaSnapshot().autopilot)).toBeNull();
    await expect.poll(() => page.evaluate(() => (window as any).spaceNinjaSnapshot().speed)).toBe(0);
  }
  await page.getByRole('button', { name: 'Help me to the Moon' }).click();
  await expect(page.getByRole('button', { name: 'Explore the Moon' })).toBeVisible({ timeout: 50_000 });
  await attachShot(page, 'outing-moon-hover', info);
  await page.getByRole('button', { name: 'Explore the Moon' }).click();
  await expect.poll(() => page.evaluate(() => (window as any).spaceNinjaSnapshot().cameraOwner)).toBe('explore');
  await expect.poll(() => page.evaluate(() => (window as any).spaceNinjaSnapshot().target)).not.toBeNull();
  await attachShot(page, 'outing-moon-target', info);

  const target = await page.evaluate(() => (window as any).spaceNinjaSnapshot().target as {x:number;y:number});
  await page.mouse.click((target.x + 1) * width / 2, (1 - target.y) * height / 2);
  await expect(page.locator('.photo-view:not(.is-hidden)')).toBeVisible();
  await expect(page.locator('.photo-view__image')).toHaveAttribute('src', /moon-tycho\.jpg/);
  await expect.poll(() => page.evaluate(() => (window as any).spaceNinjaSnapshot().found)).toBe(true);
  await attachShot(page, 'outing-tycho-photo', info);
  await page.getByRole('button', { name: 'Close the photo' }).click();
  await expect(page.getByRole('button', { name: 'Fly Home' })).toBeVisible();
  await attachShot(page, 'outing-discovered', info);
  await page.getByRole('button', { name: 'Fly Home' }).click();
  await expect(page.getByRole('button', { name: 'Help me to the Moon' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Memory' })).toBeVisible();
  await expectRendering(page);
  await attachShot(page, 'outing-home-return', info);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Memory' })).toBeVisible();
});
