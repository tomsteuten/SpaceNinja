import { expect, test, type Page, type TestInfo } from '@playwright/test';

const snapshot = (page: Page) => page.evaluate(() => (window as any).spaceNinjaSnapshot());
async function shot(page: Page, info: TestInfo, name: string) {
  const path = info.outputPath(`${name}.png`);
  await page.screenshot({ path });
  await info.attach(name, { path, contentType: 'image/png' });
}
async function collect(page: Page) {
  const target = (await snapshot(page)).targets.find((t: any) => t.visible);
  await page.mouse.click(target.x, target.y);
  await expect(page.locator('.photo-view.is-reward')).toBeVisible();
}
async function fits(page: Page, selector: string, minSize = 54) {
  const box = (await page.locator(selector).boundingBox())!;
  expect(box).not.toBeNull();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  expect(box.width).toBeGreaterThanOrEqual(minSize);
  expect(box.height).toBeGreaterThanOrEqual(minSize);
}
async function postcardFits(page: Page) {
  await fits(page, '.photo-view__continue', 54);
  await fits(page, '.photo-view__close', 54);
  const figure = (await page.locator('.photo-view__figure').boundingBox())!;
  const exit = (await page.locator('.photo-view__continue').boundingBox())!;
  expect(figure.y).toBeGreaterThanOrEqual(0);
  expect(figure.y + figure.height <= exit.y - 8 || figure.x + figure.width <= exit.x - 8).toBe(true);
}

test('picture exits close discoveries, return to the map and allow a Sun visit', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 4 });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 2 });
    Math.random = () => 0.1;
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Start playing', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Fly to Sun', exact: true })).toBeVisible();
  for (let index = 0; index < 5; index++) {
    await fits(page, `.destination-choice:nth-child(${index + 1})`);
  }
  await shot(page, info, 'space-map');

  await page.getByRole('button', { name: 'Fly to Moon', exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).phase).toBe('arrived');
  await expect(page.locator('.mission-hud')).toBeVisible();
  const row = await page.locator('.visit-actions > button:visible').evaluateAll(buttons =>
    buttons.map(button => {
      const { x, y, width, height } = button.getBoundingClientRect();
      return { x, y, width, height };
    }));
  expect(row).toHaveLength(4);
  for (const box of row) {
    expect(box.y).toBeCloseTo(row[0]!.y, 1);
    expect(box.width).toBeCloseTo(row[0]!.width, 1);
    expect(box.height).toBe(row[0]!.height);
  }
  await collect(page);
  await expect(page.locator('.photo-view__return-world .world-orb--moon')).toBeVisible();
  await postcardFits(page);
  await expect(page.locator('.photo-view').getByRole('button', { name: 'Keep exploring', exact: true })).toBeFocused();
  await shot(page, info, 'discovery-picture-exit');
  if (info.project.name === 'phone') {
    const viewport = page.viewportSize()!;
    await page.setViewportSize({ width: 319, height: 561 });
    await postcardFits(page);
    await shot(page, info, 'narrow-discovery-picture-exit');
    await page.setViewportSize(viewport);
  }

  // Android's trailing compatibility click is not a dismissal. Explicit exits are immediate.
  await page.locator('.photo-view').dispatchEvent('click');
  await expect(page.locator('.photo-view')).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Close the photo' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('.photo-view').getByRole('button', { name: 'Keep exploring', exact: true })).toBeFocused();
  // Screenshots and keyboard checks can finish inside the intentional opening guard.
  // This pointer press represents a deliberate return, not an opening double tap.
  await page.waitForTimeout(650);
  await page.locator('.photo-view').getByRole('button', { name: 'Keep exploring', exact: true }).click();
  await expect(page.locator('.photo-view')).toBeHidden();
  await page.getByRole('button', { name: 'Read the words', exact: true }).click();
  await page.getByRole('button', { name: 'See a photo of this place', exact: true }).click();
  await expect(page.locator('.photo-view__return-world .world-orb--moon')).toBeVisible();
  await expect(page.locator('.photo-view').getByRole('button', { name: 'Keep exploring', exact: true })).toBeVisible();
  await page.waitForTimeout(650);
  await page.getByRole('button', { name: 'Close the photo' }).click();
  await expect(page.locator('.photo-view')).toBeHidden();
  await page.keyboard.press('Escape');
  await fits(page, '.home-btn');
  await expect(page.locator('.home-btn svg')).toBeVisible();
  await shot(page, info, 'moon-space-map-exit');
  await page.getByRole('button', { name: 'Back to the space map', exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).phase).toBe('idle');

  // New non-hunt destinations use the normal flight, camera controls and home return.
  await page.getByRole('button', { name: 'Fly to Sun', exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).world).toBe('sun');
  await expect.poll(async () => (await snapshot(page)).phase).toBe('arrived');
  await expect(page.locator('.mission-hud')).toBeHidden();
  await expect(page.locator('.spin-btn')).toBeHidden();
  expect((await snapshot(page)).ids).toEqual([]);
  await fits(page, '.home-btn');
  await shot(page, info, 'sun-visit');
  if (info.project.name === 'phone') {
    const viewport = page.viewportSize()!;
    const frame = (await snapshot(page)).frame;
    await page.setViewportSize({ width: 640, height: 360 });
    await expect.poll(async () => (await snapshot(page)).frame).toBeGreaterThan(frame + 12);
    await fits(page, '.home-btn');
    expect((await snapshot(page)).bodyScreenRadius).toBeGreaterThan(70);
    await shot(page, info, 'sun-resized-landscape');
    await page.setViewportSize(viewport);
    await expect.poll(async () => (await snapshot(page)).bodyScreenRadius).toBeGreaterThan(90);
  }
  await page.getByRole('button', { name: 'Read the words', exact: true }).click();
  await expect(page.locator('.fact-card')).toContainText('nearest star');
  await expect(page.locator('.fact-card')).toContainText('no solid ground');
  await page.getByRole('button', { name: 'Close the words', exact: true }).click();
  const surfaceSize = (await snapshot(page)).bodyScreenRadius;
  await page.mouse.move(page.viewportSize()!.width * 0.65, page.viewportSize()!.height * 0.4);
  await page.mouse.down();
  await page.mouse.move(page.viewportSize()!.width * 0.35, page.viewportSize()!.height * 0.4, { steps: 12 });
  await page.mouse.up();
  await expect.poll(async () => (await snapshot(page)).bodyScreenRadius).toBeGreaterThan(surfaceSize * 0.9);
  await page.getByRole('button', { name: 'Back to the space map', exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).phase).toBe('idle');
  const progress = await page.evaluate(() => JSON.parse(localStorage.getItem('spaceninja.progress.v1')!));
  expect(progress.visited).toContain('sun');
  expect(progress.discoveries).toHaveLength(1);
  await page.getByRole('button', { name: 'Fly to Earth', exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).world).toBe('earth');
  await page.getByRole('button', { name: 'Find places', exact: true }).click();
  await expect(page.locator('.mission-hud')).toBeVisible();
  expect((await snapshot(page)).targets).toHaveLength(3);
  expect(errors).toEqual([]);
});
