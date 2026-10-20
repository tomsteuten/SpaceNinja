import { test, expect, attachShot } from './fixtures';
import type { Page } from '@playwright/test';

const snapshot = (page: Page) => page.evaluate(() => (window as any).spaceNinjaSnapshot());

async function openGame(page: Page) {
  await page.goto('/');
  const start = page.getByRole('button', { name: 'Start playing', exact: true });
  if (await start.isVisible()) await start.click();
  await expect(page.locator('#boot')).toBeHidden();
}

test('default route travels from the visible system into explorer controls and back', async ({ page }, info) => {
  await openGame(page);

  const choices = page.getByRole('navigation', { name: 'Choose a world' }).getByRole('button');
  await expect(choices).toHaveCount(4);
  for (const world of ['Earth', 'Moon', 'Mars', 'Saturn']) {
    await expect(page.getByRole('button', { name: `Fly to ${world}`, exact: true })).toBeVisible();
  }
  await expect(page.locator('canvas')).toHaveAttribute(
    'aria-label',
    'A view of space with the Earth, the Moon, Mars and Saturn',
  );
  // Let the short entrance fade settle so the screenshot records the actual resting HUD.
  await page.waitForTimeout(700);
  await attachShot(page, `unified-system-${info.project.name}`, info);

  await page.getByRole('button', { name: 'Fly to Mars', exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).experienceState).toBe('EXPLORING');
  await expect.poll(async () => (await snapshot(page)).explorer?.phase).toBe('explore');
  await expect(page.locator('.mission-hud')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Places', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Solar System', exact: true })).toBeVisible();
  await expect(page.locator('.moon-location')).toHaveText('MARS');
  await attachShot(page, `unified-mars-explorer-${info.project.name}`, info);

  await page.getByRole('button', { name: 'Places', exact: true }).click();
  await expect(page.locator('.place-option')).toHaveCount(6);
  await page.locator('.place-option').first().click();
  await expect.poll(async () => (await snapshot(page)).explorer?.navigating).toBe(false);
  await expect(page.locator('.moon-landmark')).toBeVisible();
  await page.getByRole('button', { name: 'Take a look', exact: true }).click();
  await expect(page.locator('.photo-dialog')).toBeVisible();
  await expect.poll(() => page.locator('.photo-viewport img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  await attachShot(page, `unified-place-photo-${info.project.name}`, info);
  await page.getByRole('button', { name: 'Keep exploring', exact: true }).click();

  await page.getByRole('button', { name: 'Solar System', exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).experienceState).toBe('SYSTEM');
  await expect(page.getByRole('button', { name: 'Fly to Saturn', exact: true })).toBeVisible();
  await attachShot(page, `unified-returned-system-${info.project.name}`, info);

  // A second complete journey catches leaked camera/input ownership from the first visit.
  await page.getByRole('button', { name: 'Fly to Saturn', exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).explorer?.world).toBe('saturn');
  await expect.poll(async () => (await snapshot(page)).explorer?.phase).toBe('explore');
  await expect(page.locator('.moon-location')).toHaveText('SATURN');
  await attachShot(page, `unified-saturn-explorer-${info.project.name}`, info);
  await page.getByRole('button', { name: 'Solar System', exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).experienceState).toBe('SYSTEM');

  if (info.project.name === 'tablet') {
    await page.setViewportSize({ width: 800, height: 1180 });
    await expect(page.getByRole('button', { name: 'Fly to Earth', exact: true })).toBeVisible();
    await attachShot(page, 'unified-system-tablet-portrait', info);
  }
});
