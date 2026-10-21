import { test, expect, attachShot, frame, expectRendering } from './fixtures';
import type { Page } from '@playwright/test';

test.use({
  deviceScaleFactor: 1,
  ignoredConsoleErrors: [/^Space Ninja stopped Error: 3D graphics were interrupted\./],
});

async function loseGraphics(page: Page) {
  await page.evaluate(() => {
    const gl = document.querySelector('canvas')!.getContext('webgl2')!;
    const extension = gl.getExtension('WEBGL_lose_context');
    if (!extension) throw new Error('WEBGL_lose_context is required for this regression check');
    (window as any).lostGraphics = extension;
    extension.loseContext();
  });
}

test('graphics loss during flight offers restart, stays stopped after restoration, and preserves saves', async ({ page }, info) => {
  await page.addInitScript(() => {
    const sources = new Set<AudioScheduledSourceNode>();
    (window as any).activeSoundSources = sources;
    AudioScheduledSourceNode.prototype.start = new Proxy(AudioScheduledSourceNode.prototype.start, {
      apply(start, source, args) {
        Reflect.apply(start, source, args);
        sources.add(source);
        source.addEventListener('ended', () => sources.delete(source), { once: true });
      },
    });
  });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Start playing', exact: true }).click();
  await page.getByRole('button', { name: 'Fly to Earth', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).spaceNinjaSnapshot().phase)).toBe('flying');
  await expect.poll(() => page.evaluate(() => (window as any).activeSoundSources.size)).toBeGreaterThan(0);
  const saved = await page.evaluate(() => JSON.stringify(localStorage));
  await loseGraphics(page);
  await expect(page.locator('#boot')).toHaveClass(/has-crash/, { timeout: 5000 });
  await expect(page.locator('.boot-detail')).toContainText('3D graphics were interrupted.');
  await expect(page.getByRole('button', { name: 'Start again', exact: true })).toBeFocused();
  const stopped = await frame(page);
  await page.waitForTimeout(250);
  expect(await frame(page)).toBe(stopped);
  expect(await page.evaluate(() => (window as any).spaceNinjaSnapshot().speaking)).toBe(false);
  await expect.poll(() => page.evaluate(() => (window as any).activeSoundSources.size)).toBe(0);
  await attachShot(page, 'graphics-loss-restart', info);

  // Use the actual driver extension, not a synthetic restoration event.
  await page.evaluate(() => new Promise<void>(resolve => {
    document.querySelector('canvas')!.addEventListener('webglcontextrestored', () => resolve(), { once: true });
    (window as any).lostGraphics.restoreContext();
  }));
  // Three rebuilds WebGLInfo on restoration, resetting its render counter to zero.
  const restored = await frame(page);
  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  });
  await page.waitForTimeout(250);
  expect(await frame(page)).toBe(restored);
  await expect(page.locator('#boot')).toHaveClass(/has-crash/);
  expect(await page.evaluate(() => JSON.stringify(localStorage))).toBe(saved);
  await page.keyboard.press('Enter');
  await expect(page.locator('#boot')).toBeHidden();
  await expectRendering(page);
  expect(await page.evaluate(() => JSON.stringify(localStorage))).toBe(saved);
});

test('graphics loss takes the bedtime spin away and releases the camera before restart', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Start playing', exact: true }).click();
  await page.getByRole('button', { name: 'Fly to Earth', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).spaceNinjaSnapshot().phase)).toBe('arrived');
  await page.locator('.spin-btn').click();
  await expect(page.locator('.bedtime-spin')).toBeVisible();
  await loseGraphics(page);
  await expect(page.locator('#boot')).toHaveClass(/has-crash/);
  await expect(page.locator('.bedtime-spin')).toHaveCount(0);
  const stopped = await page.evaluate(() => (window as any).spaceNinjaSnapshot());
  expect(stopped.dayTurning).toBe(false);
  expect(stopped.teachingSun.visible).toBe(false);
  expect(stopped.speaking).toBe(false);
  await page.getByRole('button', { name: 'Start again', exact: true }).click();
  await expect(page.locator('#boot')).toBeHidden();
  await expectRendering(page);
});

test('graphics loss over a discovery photo exposes recovery and keeps the collected place', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Start playing', exact: true }).click();
  await page.getByRole('button', { name: 'Fly to Earth', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).spaceNinjaSnapshot().phase)).toBe('arrived');
  await page.getByRole('button', { name: 'Find places', exact: true }).click();
  const target = await page.evaluate(() => (window as any).spaceNinjaSnapshot().targets.find((t: any) => t.visible));
  await page.mouse.click(target.x, target.y);
  await expect(page.locator('.photo-view.is-reward')).toBeVisible();
  const saved = await page.evaluate(() => JSON.stringify(localStorage));
  expect(JSON.parse(JSON.parse(saved)['spaceninja.progress.v1']).discoveries).toHaveLength(1);
  await loseGraphics(page);
  await expect(page.locator('#boot')).toHaveClass(/has-crash/);
  const restart = page.getByRole('button', { name: 'Start again', exact: true });
  await expect(restart).toBeFocused();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(restart).toBeFocused();
  await restart.click();
  await expect(page.locator('#boot')).toBeHidden();
  await expectRendering(page);
  expect(await page.evaluate(() => JSON.stringify(localStorage))).toBe(saved);
});
