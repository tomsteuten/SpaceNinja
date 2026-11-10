import { test, expect, showWorld } from './fixtures';
import type { Page } from '@playwright/test';

const snapshot = (page: Page) => page.evaluate(() => (window as any).spaceNinjaSnapshot());

/*
 * The Sun's toy is Far away: the Sun is a star like the others, just much closer. It is in the
 * row from arrival (nothing ringed); inside, flying away shrinks the Sun past Earth and Neptune
 * to one dot among the stars. The phone project runs with reduced motion, where a press cuts to
 * the next milestone; the hold test switches motion back on.
 */
async function arriveAtSun(page: Page) {
  await page.addInitScript(() => localStorage.setItem('spaceninja.sound.v1', 'off'));
  await page.goto('/?fast');
  await page.getByRole('button', { name: 'Start playing', exact: true }).click();
  await showWorld(page, 'Sun');
  await page.getByRole('button', { name: 'Fly to Sun', exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).phase).toBe('arrived');
}

test('Sun: Far away is on the row at arrival, flies out past Earth and Neptune to a star among stars', async ({ page }) => {
  // Stepping by milestone is the reduced-motion behaviour; with motion on a tap is a short hop.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await arriveAtSun(page);
  const ui = page.locator('#ui');
  const button = page.getByRole('button', { name: 'Far away: fly away from the Sun', exact: true });

  // Present on arrival with Space map and Listen; nothing is ringed.
  await expect(page.locator('.home-btn')).toBeVisible();
  await expect(button).toBeVisible();
  await expect(ui).not.toHaveClass(/is-toy-next|is-map-next/);
  await expect(page.locator('.home-btn')).toHaveCSS('outline-style', 'none');
  const box = (await button.boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(54);
  expect(box.height).toBeGreaterThanOrEqual(54);
  await expect(page.locator('.visit-actions > button:visible')).toHaveCount(4);

  await button.click();
  const toy = page.getByRole('dialog', { name: 'Fly far away from the Sun' });
  await expect(toy).toBeVisible();
  await expect(toy).toHaveAttribute('data-milestone', '');
  await expect(toy.locator('.sun-star__caption')).toHaveText('');

  // Each press of Fly away moves on to the next milestone (a cut, with reduced motion).
  const fly = toy.getByRole('button', { name: /^Fly away from the Sun/ });
  await fly.click();
  await expect(toy).toHaveAttribute('data-milestone', 'earth');
  await expect(toy.locator('.sun-star__caption')).toHaveText('From Earth, the Sun looks this big.');
  await fly.click();
  await expect(toy).toHaveAttribute('data-milestone', 'neptune');
  await expect(toy.locator('.sun-star__caption')).toHaveText('From Neptune it is a very bright star.');
  await fly.click();
  await expect(toy).toHaveAttribute('data-milestone', 'far');
  await expect(toy.locator('.sun-star__caption')).toHaveText('The Sun is a star. The other stars are suns too, very far away.');
  await expect(toy).toHaveAttribute('data-ring', 'on');
  await expect(toy).toHaveAttribute('data-progress', '1.000');

  // The other stars bloom into a little sun when tapped.
  const canvas = (await toy.locator('.sun-star__canvas').boundingBox())!;
  const stripTop = (await toy.locator('.sun-star__strip').boundingBox())!.y;
  search: for (let y = canvas.y + 70; y < stripTop - 20; y += 60) {
    for (let x = canvas.x + 30; x < canvas.x + canvas.width - 20; x += 60) {
      await page.mouse.click(x, y);
      if (Number(await toy.getAttribute('data-blooms')) > 0) break search;
    }
  }
  expect(Number(await toy.getAttribute('data-blooms'))).toBeGreaterThan(0);

  // Fly back returns through the milestones; the strip's slider and the arrow keys move it too.
  await toy.getByRole('button', { name: 'Fly back towards the Sun' }).click();
  await expect(toy).toHaveAttribute('data-milestone', 'neptune');
  const slider = toy.getByRole('slider', { name: 'How far from the Sun' });
  await slider.focus();
  await page.keyboard.press('Home');
  await expect(toy).toHaveAttribute('data-progress', '0.000');
  await page.keyboard.press('ArrowRight');
  await expect(toy).not.toHaveAttribute('data-progress', '0.000');
  await toy.getByRole('button', { name: /^Fly away from the Sun/ }).focus();
  await page.keyboard.press('ArrowLeft');
  await expect(toy).toHaveAttribute('data-progress', '0.000');

  // Escape closes it and returns focus to its button; the scene's canvas is the only one left.
  await page.keyboard.press('Escape');
  await expect(toy).toHaveCount(0);
  await expect(page.locator('canvas')).toHaveCount(1);
  await expect(button).toBeFocused();
  // Played: Space map is the one ringed next step.
  await expect(ui).toHaveClass(/is-map-next/);
  await expect(page.locator('.home-btn')).toHaveCSS('outline-style', 'solid');
  await expect(page.locator('.world-heading__caption')).toHaveText('Choose your next trip on the Space map.');
});

test('Sun: holding Fly away flies and releasing stops, with motion on; the toy survives a turn of the phone', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await arriveAtSun(page);
  await page.getByRole('button', { name: 'Far away: fly away from the Sun', exact: true }).click();
  const toy = page.getByRole('dialog', { name: 'Fly far away from the Sun' });
  await expect(toy).toBeVisible();
  const fly = toy.getByRole('button', { name: /^Fly away from the Sun/ });
  const box = (await fly.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(toy).toHaveAttribute('data-flying', 'away');
  await page.waitForTimeout(1500);
  await page.mouse.up();
  await expect(toy).toHaveAttribute('data-flying', 'no');
  // Let the eased picture settle on where the flight stopped (slow frames lag behind it).
  await page.waitForTimeout(800);
  const stopped = Number(await toy.getAttribute('data-progress'));
  expect(stopped).toBeGreaterThan(0.1);
  expect(stopped).toBeLessThan(0.5);
  await page.waitForTimeout(600);
  expect(Number(await toy.getAttribute('data-progress'))).toBeCloseTo(stopped, 1);

  const viewport = page.viewportSize()!;
  await page.setViewportSize({ width: viewport.height, height: viewport.width });
  await expect(toy).toBeVisible();
  const size = page.viewportSize()!;
  for (const name of [/^Fly away from the Sun/, /^Fly back/, /^Back to the Sun/]) {
    const b = (await toy.getByRole('button', { name }).boundingBox())!;
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(size.width);
    expect(b.y + b.height).toBeLessThanOrEqual(size.height);
    expect(b.height).toBeGreaterThanOrEqual(54);
  }
  await toy.getByRole('button', { name: 'Back to the Sun' }).click();
  await expect(toy).toHaveCount(0);
});
