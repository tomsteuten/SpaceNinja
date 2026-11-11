import { mkdirSync } from 'node:fs';
import { test, expect, showWorld } from './fixtures';
import type { Locator, Page } from '@playwright/test';

const snapshot = (page: Page) => page.evaluate(() => (window as any).spaceNinjaSnapshot());

// Full-resolution pictures for review: FARAWAY_OUT=design/visit-screen/built
test.use({ deviceScaleFactor: 1 });

/*
 * The Sun's toy is Far away: drag the rocket along a strip from the Sun to a star. The Sun in
 * the sky shrinks as the rocket goes; at the far end it is one star among the others.
 */
async function openToy(page: Page) {
  await page.addInitScript(() => localStorage.setItem('spaceninja.sound.v1', 'off'));
  await page.goto('/?fast');
  await page.getByRole('button', { name: 'Start playing', exact: true }).click();
  await showWorld(page, 'Sun');
  await page.getByRole('button', { name: 'Fly to Sun', exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).phase).toBe('arrived');
  await page.getByRole('button', { name: /far away/i }).click();
}

async function centre(locator: Locator) {
  const box = (await locator.boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function dragTo(page: Page, thumb: Locator, to: { x: number; y: number }) {
  const from = await centre(thumb);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, to.y, { steps: 6 });
  await page.mouse.move(to.x, to.y, { steps: 6 });
  await page.mouse.up();
}

async function expectInside(page: Page, locator: Locator) {
  const view = page.viewportSize()!;
  const b = (await locator.boundingBox())!;
  expect(b.x).toBeGreaterThanOrEqual(-0.5);
  expect(b.y).toBeGreaterThanOrEqual(-0.5);
  expect(b.x + b.width).toBeLessThanOrEqual(view.width + 0.5);
  expect(b.y + b.height).toBeLessThanOrEqual(view.height + 0.5);
}

test('Sun: drag the rocket from the Sun to Earth and on to a star, and back', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: info.project.name === 'tablet' ? 'no-preference' : 'reduce' });
  await openToy(page);
  const toy = page.getByRole('dialog', { name: 'Fly far away from the Sun' });
  await expect(toy).toBeVisible();
  const thumb = toy.getByRole('slider', { name: /rocket/i });
  const caption = toy.locator('.sun-star__caption');
  const band = toy.locator('.sun-star__band');
  const back = toy.getByRole('button', { name: 'Back to the Sun' });
  const hand = toy.locator('.sun-star__hand');
  const radius = async () => Number(await toy.getAttribute('data-sun-radius'));
  const shot = async (name: string) => {
    const out = process.env.FARAWAY_OUT;
    const view = page.viewportSize()!;
    if (!out || !((view.width === 390 && view.height === 844) || (view.width === 844 && view.height === 390))) return;
    mkdirSync(out, { recursive: true });
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${out}/faraway-${name}-${view.width < view.height ? 'portrait' : 'landscape'}.png` });
  };

  // Layout: the thumb is big, the hint shows, and nothing overlaps or leaves the screen.
  const thumbBox = (await thumb.boundingBox())!;
  expect(thumbBox.width).toBeGreaterThanOrEqual(56);
  expect(thumbBox.height).toBeGreaterThanOrEqual(56);
  await expect(hand).toBeVisible();
  await expect(caption).toHaveText('Up close, the Sun is huge.');
  await expect(thumb).toHaveAttribute('aria-valuenow', '0');
  const noOverlap = async () => {
    const root = (await toy.boundingBox())!;
    const bandTop = (await band.boundingBox())!.y - root.y;
    const sunY = Number(await toy.getAttribute('data-sun-y'));
    expect(sunY + (await radius())).toBeLessThanOrEqual(bandTop);
    const rocket = (await toy.locator('.sun-star__sky-rocket').boundingBox())!;
    expect(rocket.y + rocket.height).toBeLessThanOrEqual((await band.boundingBox())!.y + 1);
    const a = (await back.boundingBox())!;
    const t = (await thumb.boundingBox())!;
    expect(a.x + a.width <= t.x || t.x + t.width <= a.x || a.y + a.height <= t.y || t.y + t.height <= a.y).toBe(true);
    for (const part of [caption, band, back, thumb, toy.locator('.sun-star__sky-rocket')]) await expectInside(page, part);
  };
  await noOverlap();
  const huge = await radius();
  expect(huge).toBeGreaterThan(60);
  await shot('start');

  // Drag the rocket to Earth: the Sun shrinks and the words change; the hint is gone for good.
  await dragTo(page, thumb, await centre(toy.locator('.sun-star__stn[data-stop="earth"]')));
  await expect(toy).toHaveAttribute('data-milestone', 'earth');
  await expect(caption).toHaveText('From Earth, the Sun looks this big.');
  const atEarth = await radius();
  expect(atEarth).toBeLessThan(huge / 5);
  await expect(hand).toBeHidden();
  await noOverlap();
  await shot('earth');

  // Drag all the way: the Sun is one ringed star among the stars.
  await dragTo(page, thumb, await centre(toy.locator('.sun-star__stn[data-stop="far"]')));
  await expect(toy).toHaveAttribute('data-milestone', 'far');
  await expect(caption).toHaveText('Far, far away the Sun is a star.');
  expect(await radius()).toBeLessThan(atEarth);
  await expect(toy).toHaveAttribute('data-ring', 'on');
  await expect(thumb).toHaveAttribute('aria-valuenow', '100');
  await noOverlap();
  await shot('end');

  // A tap on a picture goes there.
  await toy.locator('.sun-star__stn[data-stop="neptune"]').click();
  await expect(toy).toHaveAttribute('data-milestone', 'neptune');
  await expect(caption).toHaveText('From Neptune it is a very bright star.');
  await expect.poll(() => radius()).toBeLessThan(atEarth);

  // Keyboard: steps, then Home comes back to the start.
  await thumb.focus();
  await page.keyboard.press('End');
  await expect(thumb).toHaveAttribute('aria-valuenow', '100');
  await page.keyboard.press('ArrowLeft');
  await expect(thumb).not.toHaveAttribute('aria-valuenow', '100');
  await page.keyboard.press('Home');
  await expect(thumb).toHaveAttribute('aria-valuenow', '0');
  await expect(caption).toHaveText('Up close, the Sun is huge.');
  await expect.poll(() => radius()).toBeCloseTo(huge, 0);
  await noOverlap();

  // A turn of the phone with the rocket at the far end keeps everything on screen.
  await page.keyboard.press('End');
  const view = page.viewportSize()!;
  await page.setViewportSize({ width: view.height, height: view.width });
  await expect(toy).toBeVisible();
  await expect(thumb).toHaveAttribute('aria-valuenow', '100');
  await expect.poll(async () => { await noOverlap().catch(() => { throw new Error('layout'); }); return true; }).toBe(true);
  await page.setViewportSize(view);

  await back.click();
  await expect(toy).toHaveCount(0);
  await expect(page.locator('canvas')).toHaveCount(1);
});
