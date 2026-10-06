import { test, expect, attachShot, settlePanel } from './fixtures';
import type { Page } from '@playwright/test';

const snapshot = (page: Page) => page.evaluate(() => (window as any).spaceNinjaSnapshot());
async function fits(page: Page, selector: string) {
  const box = (await page.locator(selector).boundingBox())!;
  expect(box).not.toBeNull();
  expect(box.width).toBeGreaterThanOrEqual(48);
  expect(box.height).toBeGreaterThanOrEqual(48);
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height);
}

test('Earth discoveries lead into a world page, story, photo, and back to exploration', async ({ page }, info) => {
  await page.addInitScript(() => localStorage.setItem('spaceninja.sound.v1', 'off'));
  await page.goto('/');
  await page.getByRole('button', { name: 'Start playing', exact: true }).click();
  await page.getByRole('button', { name: 'Fly to Earth', exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).phase).toBe('arrived');
  await page.getByRole('button', { name: 'Find places', exact: true }).click();
  await expect(page.locator('.mission-hud')).toBeVisible();
  for (let i = 0; i < 3; i++) {
    let target = (await snapshot(page)).targets.find((t: any) => t.visible);
    if (!target) {
      const before = await snapshot(page);
      await page.getByRole('button', { name: 'Turn to the last place', exact: true }).click();
      await expect.poll(async () => (await snapshot(page)).targets.some((t: any) => t.visible)).toBe(true);
      const after = await snapshot(page);
      expect(after.surfaceRotation).toBeCloseTo(before.surfaceRotation, 6);
      expect(after.targets[0].sunlight).toBeCloseTo(before.targets[0].sunlight, 6);
      target = after.targets.find((t: any) => t.visible);
    }
    await page.mouse.click(target.x, target.y);
    await expect(page.locator('.photo-view.is-reward')).toBeVisible();
    await expect(page.locator('.photo-view__saved')).toContainText('Saved to your journal');
    await expect(page.locator('.photo-view__count')).toHaveText(`${i + 1} / 3`);
    await fits(page, '.photo-view__continue');
    await fits(page, '.photo-view__close');
    if (i < 2) {
      await expect(page.locator('.photo-view__journal')).toBeHidden();
      await settlePanel(page);
      await page.getByRole('button', { name: 'Keep exploring', exact: true }).click();
    } else {
      await fits(page, '.photo-view__journal');
      const overflow = await page.locator('.photo-view__actions button:visible').evaluateAll(buttons =>
        buttons.some(button => button.scrollWidth > button.clientWidth + 1));
      expect(overflow, 'Reward button content stays inside its control').toBe(false);
      if (info.project.name === 'phone') {
        const viewport = page.viewportSize()!;
        await page.setViewportSize({ width: 319, height: 561 });
        await fits(page, '.photo-view__continue');
        await fits(page, '.photo-view__journal');
        expect(await page.locator('.photo-view__actions button:visible').evaluateAll(buttons =>
          buttons.some(button => button.scrollWidth > button.clientWidth + 1 || button.scrollHeight > button.clientHeight + 1)),
        'Both choices remain readable on a narrow phone').toBe(false);
        await page.setViewportSize(viewport);
      }
      await attachShot(page, 'earth-third-photo', info);
      await settlePanel(page);
      await page.getByRole('button', { name: 'See discoveries', exact: true }).click();
    }
  }
  await expect(page.locator('.journal-panel')).toBeVisible();
  await expect(page.locator('.journal-page-caption')).toHaveText('Earth · 3 of 6 places found');
  await expect(page.locator('.sticker-grid > *')).toHaveCount(6);
  await expect(page.locator('.sticker-grid button')).toHaveCount(3);
  await expect(page.locator('.sticker--empty')).toHaveCount(3);
  await fits(page, '.journal-panel > .panel-return');
  await attachShot(page, 'earth-journal-page', info);
  await page.getByRole('button', { name: 'Moon: 0 of 6 places found', exact: true }).click();
  await expect(page.locator('.sticker-grid button')).toHaveCount(0);
  await expect(page.locator('.sticker--empty')).toHaveCount(6);
  await expect(page.locator('.collection-progress__world[aria-pressed="true"]')).toBeFocused();
  await page.getByRole('button', { name: 'Earth: 3 of 6 places found', exact: true }).click();
  const tile = page.locator('.sticker-grid button').first();
  const label = await tile.getAttribute('aria-label');
  await tile.click();
  await expect(page.locator('.journal-back')).toBeFocused();
  await expect(page.locator('.sticker-grid')).toBeHidden();
  await expect(page.locator('.journal-detail')).not.toBeEmpty();
  await expect(page.getByRole('button', { name: 'Read this discovery out loud' })).toBeHidden();
  await fits(page, '.journal-panel > .panel-return');
  await attachShot(page, 'earth-journal-story', info);
  await page.getByRole('button', { name: 'See a photo of this discovery', exact: true }).click();
  await expect(page.locator('.photo-view')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Back to journal', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.journal-panel.is-reading')).toBeVisible();
  await expect(page.getByRole('button', { name: 'See a photo of this discovery', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'All places', exact: true }).click();
  await expect(page.getByRole('button', { name: label!, exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('.journal-panel')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Open your discovery journal', exact: true })).toBeFocused();
  await expect(page.locator('.world-heading__caption')).toContainText('See your journal');
  await page.getByRole('button', { name: /^Day and night on Earth/ }).click();
  await page.getByRole('button', { name: 'Stop day and night', exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).cameraReturning).toBe(false);
  await expect(page.locator('.world-heading__caption')).toContainText('See your journal');
  await page.getByRole('button', { name: 'Back to the space map', exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).phase).toBe('idle');
  expect((await page.evaluate(() => JSON.parse(localStorage.getItem('spaceninja.progress.v1')!))).discoveries).toHaveLength(3);
});
