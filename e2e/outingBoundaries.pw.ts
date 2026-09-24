import type { Page } from '@playwright/test';
import { test, expect, attachShot } from './fixtures';

const snapshot = (page: Page) => page.evaluate(() => (window as any).spaceNinjaSnapshot());

test('a memory holds the ship, reduced motion cuts to the Moon, and one Escape leaves one level', async ({ page }, info) => {
  test.setTimeout(480_000); // Software WebGL can stretch the assisted journey on Windows.
  await page.addInitScript(() => {
    localStorage.setItem('spaceninja.progress.v1', JSON.stringify({ discoveries: ['moon-tycho'], visited: ['moon'], stickers: [] }));
  });
  await page.goto('/?outing');
  await expect(page.locator('#boot')).toBeHidden();
  const reduced = await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const memory = page.getByRole('button', { name: /Memory/ });
  const photo = page.locator('.photo-view:not(.is-hidden)');

  if (!reduced) {
    // Opening a memory mid-journey stops the ship and it stays where it stopped.
    await page.getByRole('button', { name: 'Help me to the Moon' }).click();
    await expect.poll(async () => (await snapshot(page)).speed).toBeGreaterThan(0.1);
    await memory.click();
    await expect(photo).toBeVisible();
    const held = await snapshot(page);
    expect(held).toMatchObject({ photoOpen: true, speed: 0, autopilot: null });
    await expect.poll(async () => (await snapshot(page)).frame).toBeGreaterThan(held.frame + 10);
    expect((await snapshot(page)).position).toEqual(held.position);
    await attachShot(page, 'memory-holds-flight', info);
    await page.getByRole('button', { name: 'Close the photo' }).click();
    await expect(photo).toBeHidden();
    expect(await snapshot(page)).toMatchObject({ photoOpen: false, speed: 0, autopilot: null });
  }

  await page.getByRole('button', { name: 'Help me to the Moon' }).click();
  if (reduced) {
    // A cut, not a faster sweep: the hover is reported without an automated journey.
    await expect.poll(async () => (await snapshot(page)).explorable, { timeout: 5_000 }).toBe('moon');
    expect((await snapshot(page)).autopilot).toBeNull();
  }
  await expect(page.getByRole('button', { name: 'Explore the Moon' })).toBeVisible({ timeout: 120_000 });
  await attachShot(page, 'moon-hover', info);
  await page.getByRole('button', { name: 'Explore the Moon' }).click();
  await expect.poll(async () => (await snapshot(page)).target).not.toBeNull();

  const { width, height } = page.viewportSize()!;
  const target = (await snapshot(page)).target as { x: number; y: number };
  await page.mouse.click((target.x + 1) * width / 2, (1 - target.y) * height / 2);
  await expect(photo).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close the photo' })).toBeFocused();

  // First Escape closes only the photograph.
  await page.keyboard.press('Escape');
  await expect(photo).toBeHidden();
  expect(await snapshot(page)).toMatchObject({ phase: 'explore', photoOpen: false });
  await expect(page.getByRole('button', { name: 'Fly Home' })).toBeVisible();
  await attachShot(page, 'escape-closed-photo-only', info);

  // A second, separate Escape flies home.
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await snapshot(page)).phase).toBe('flight');
  await expect(page.getByRole('button', { name: 'Help me to the Moon' })).toBeVisible();
});
