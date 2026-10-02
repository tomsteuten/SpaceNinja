import { expect, test, type Page, type TestInfo } from '@playwright/test';

const snapshot = (page: Page) => page.evaluate(() => (window as any).spaceNinjaSnapshot());

async function screenshot(page: Page, info: TestInfo, name: string) {
  await info.attach(name, { body: await page.screenshot(), contentType: 'image/png' });
}

async function assertControlsFit(page: Page) {
  const row = await page.locator('.visit-actions').boundingBox();
  expect(row).not.toBeNull();
  const viewport = page.viewportSize()!;
  expect(row!.x).toBeGreaterThanOrEqual(0);
  expect(row!.x + row!.width).toBeLessThanOrEqual(viewport.width);
  expect(row!.y + row!.height).toBeLessThanOrEqual(viewport.height);
  const boxes = await page.locator('.visit-actions > button').evaluateAll(buttons =>
    buttons.map(button => {
      const { x, y, width, height } = button.getBoundingClientRect();
      return { x, y, width, height };
    }));
  for (const box of boxes) {
    expect(box.width).toBeGreaterThanOrEqual(54);
    expect(box.height).toBeGreaterThanOrEqual(54);
  }
  for (let i = 1; i < boxes.length; i++) {
    expect(boxes[i]!.x).toBeGreaterThanOrEqual(boxes[i - 1]!.x + boxes[i - 1]!.width);
  }
}

test('day/night is optional, discoverable, stoppable and returns camera ownership', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 4 });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 2 });
    localStorage.setItem('spaceninja.sound.v1', 'off');
    Math.random = () => 0.1;
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Start playing', exact: true }).click();
  await page.getByRole('button', { name: 'Fly to Earth', exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).phase).toBe('arrived');
  const activity = page.locator('.spin-btn');
  await expect(activity).toHaveText('↻Day & night');
  await expect(activity).toHaveAccessibleName('Day and night on Earth: watch day and night');
  expect((await snapshot(page)).dayTurning).toBe(false);
  await assertControlsFit(page);
  await screenshot(page, info, 'earth-contextual-controls');

  if (info.project.name === 'phone') {
    const originalViewport = page.viewportSize()!;
    for (const viewport of [{ width: 319, height: 561 }, { width: 640, height: 360 }]) {
      await page.setViewportSize(viewport);
      await expect.poll(async () => (await snapshot(page)).bodyScreenRadius).toBeGreaterThan(70);
      await assertControlsFit(page);
      await screenshot(page, info, `earth-controls-${viewport.width}x${viewport.height}`);
    }
    await page.setViewportSize(originalViewport);
    await expect.poll(async () => (await snapshot(page)).bodyScreenRadius).toBeGreaterThan(110);
  }

  // The activity is available before completing a hunt. A find then opens the postcard;
  // the invitation waits for that reward to close rather than competing with it.
  const target = (await snapshot(page)).targets.find((t: any) => t.visible);
  await page.mouse.click(target.x, target.y);
  await expect(page.getByRole('button', { name: 'Keep exploring' })).toBeVisible();
  await expect(activity).not.toHaveClass(/is-inviting/);
  await page.waitForTimeout(650);
  await page.getByRole('button', { name: 'Keep exploring' }).click();
  await expect(activity).toHaveClass(/is-inviting/, { timeout: 60000 });
  await expect(page.locator('.coach')).toBeHidden();
  expect((await snapshot(page)).collected).toBe(1);
  await screenshot(page, info, 'earth-day-night-invitation');

  // Keyboard activation and explicit stop also work during the initial camera swing.
  const before = await snapshot(page);
  await activity.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Stop day and night', exact: true })).toBeEnabled();
  await expect(page.locator('.day-legend')).toBeVisible();
  await expect(page.locator('.mission-caption')).toBeHidden();
  expect((await snapshot(page)).dayTurning).toBe(true);
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await snapshot(page)).dayTurning).toBe(false);
  await expect.poll(async () => (await snapshot(page)).cameraReturning).toBe(false);
  const after = await snapshot(page);
  await expect(page.locator('.day-legend')).toBeHidden();
  await expect(page.locator('.mission-caption')).toBeVisible();
  expect(after.ids).toEqual(before.ids);
  expect(after.collected).toBe(before.collected);
  expect(Math.cos(after.surfaceRotation)).toBeCloseTo(Math.cos(before.surfaceRotation), 6);
  expect(Math.sin(after.surfaceRotation)).toBeCloseTo(Math.sin(before.surfaceRotation), 6);
  await expect(activity).not.toHaveClass(/is-inviting/);

  // Replay is allowed. The live button follows the visual turn and the canvas still skips.
  await activity.click();
  await expect.poll(() => page.locator('.spin-globe').evaluate(el =>
    Number((el as HTMLElement).style.getPropertyValue('--turn')))).toBeGreaterThan(0.08);
  await assertControlsFit(page);
  await screenshot(page, info, 'earth-day-night-running');
  await page.mouse.click(page.viewportSize()!.width / 2, page.viewportSize()!.height * 0.35);
  await expect.poll(async () => (await snapshot(page)).dayTurning).toBe(false);
  await expect.poll(async () => (await snapshot(page)).cameraReturning).toBe(false);

  const controlsBeforeWords = await page.locator('.visit-actions').boundingBox();
  await page.getByRole('button', { name: 'About', exact: true }).click();
  await assertControlsFit(page);
  const controlsWithWords = await page.locator('.visit-actions').boundingBox();
  expect(controlsWithWords!.x).toBeCloseTo(controlsBeforeWords!.x, 1);
  expect(controlsWithWords!.y).toBeCloseTo(controlsBeforeWords!.y, 1);
  await screenshot(page, info, 'earth-day-night-words');
  await page.waitForTimeout(650);
  await page.getByRole('button', { name: 'About', exact: true }).click();

  // Returning home interrupts a turn without leaving a second camera owner behind.
  await activity.click();
  await page.getByRole('button', { name: 'Back to the space map', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Fly to Earth', exact: true })).toBeVisible();
  await expect.poll(async () => (await snapshot(page)).phase).toBe('idle');
  expect((await snapshot(page)).dayTurning).toBe(false);
  expect((await snapshot(page)).cameraReturning).toBe(false);
  await expect(page.locator('.visit-actions')).toBeHidden();
  await expect(page.locator('.day-legend')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Open your discovery journal' })).toBeVisible();
  expect(errors).toEqual([]);
});
