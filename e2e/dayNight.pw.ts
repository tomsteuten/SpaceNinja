import { expect, test, type Page, type TestInfo } from '@playwright/test';

/*
 * The 3D day turn: the camera swings side-on, the world turns once with the teaching Sun
 * beside it, and the camera is handed back. Earth uses its bedtime spin toy instead
 * (earth-day.pw.ts); the Moon and Mars still use this.
 */

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
  const boxes = await page.locator('.visit-actions > button:visible').evaluateAll(buttons =>
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
  await page.goto('/?fast');
  await page.getByRole('button', { name: 'Start playing', exact: true }).click();
  await page.getByRole('button', { name: 'Fly to Moon', exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).phase).toBe('arrived');
  // Day & night joins the Moon's row after the places and the toy (quiet-arrival.pw.ts).
  for (let i = 0; i < 3; i++) {
    let target = (await snapshot(page)).targets.find((t: any) => t.visible);
    if (!target) {
      await page.locator('.hunt-arrow').click();
      await expect.poll(async () => (await snapshot(page)).targets.some((t: any) => t.visible)).toBe(true);
      target = (await snapshot(page)).targets.find((t: any) => t.visible);
    }
    await page.mouse.click(target.x, target.y);
    await expect(page.locator('.photo-view.is-reward')).toBeVisible();
    await page.waitForTimeout(650);
    await page.getByRole('button', { name: 'Close the photo', exact: true }).click();
    await expect(page.locator('.photo-view')).toBeHidden();
  }
  await page.getByRole('button', { name: 'Jump on the Moon', exact: true }).click();
  await page.getByRole('button', { name: 'Back to the Moon', exact: true }).click();
  const activity = page.locator('.spin-btn');
  await expect(activity).toHaveText('Day & night');
  expect((await snapshot(page)).dayTurning).toBe(false);
  await assertControlsFit(page);
  await screenshot(page, info, 'moon-contextual-controls');

  // Keyboard activation and explicit stop also work during the initial camera swing.
  const before = await snapshot(page);
  await activity.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Stop day and night', exact: true })).toBeEnabled();
  await expect(page.locator('.day-legend')).toBeVisible();
  expect((await snapshot(page)).dayTurning).toBe(true);
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await snapshot(page)).dayTurning).toBe(false);
  await expect.poll(async () => (await snapshot(page)).cameraReturning).toBe(false);
  // The Moon's surface drifts slowly on its own, so the exact one-turn guarantee lives in
  // DayTurn.test.ts; here the places and the hunt come back unchanged.
  const stoppedFrame = (await snapshot(page)).frame;
  await expect.poll(async () => (await snapshot(page)).frame).toBeGreaterThan(stoppedFrame);
  const after = await snapshot(page);
  await expect(page.locator('.day-legend')).toBeHidden();
  expect(after.ids).toEqual(before.ids);
  await expect(page.locator('.visit-actions')).toBeVisible();

  // Replay is allowed; Words opens beside it without moving the controls.
  await activity.click();
  await expect.poll(async () => (await snapshot(page)).teachingSun.visible).toBe(true);
  const controlsBeforeWords = await page.locator('.visit-actions').boundingBox();
  await page.getByRole('button', { name: 'Words', exact: true }).click();
  await assertControlsFit(page);
  const controlsWithWords = await page.locator('.visit-actions').boundingBox();
  expect(controlsWithWords!.x).toBeCloseTo(controlsBeforeWords!.x, 1);
  expect(controlsWithWords!.y).toBeCloseTo(controlsBeforeWords!.y, 1);
  await screenshot(page, info, 'moon-day-night-words');
  await page.waitForTimeout(650);
  await page.getByRole('button', { name: 'Close the words', exact: true }).click();

  // The teaching Sun and the world both stay framed through a resize mid-turn.
  const frameBefore = (await snapshot(page)).frame;
  await page.setViewportSize({ width: 844, height: 390 });
  await expect.poll(async () => (await snapshot(page)).frame).toBeGreaterThan(frameBefore + 2);
  const resized = await snapshot(page);
  expect(resized.dayTurning).toBe(true);
  expect(resized.teachingSun.visible).toBe(true);
  for (const subject of [resized.teachingSun, resized.bodyScreen]) {
    expect(subject.y - subject.radius).toBeGreaterThan(56);
    expect(subject.y + subject.radius).toBeLessThan(318);
  }

  // Returning home interrupts a turn without leaving a second camera owner behind.
  await page.getByRole('button', { name: 'Back to the space map', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Fly to Moon', exact: true })).toBeVisible();
  await expect.poll(async () => (await snapshot(page)).phase).toBe('idle');
  expect((await snapshot(page)).dayTurning).toBe(false);
  expect((await snapshot(page)).cameraReturning).toBe(false);
  expect((await snapshot(page)).teachingSun.visible).toBe(false);
  await expect(page.locator('.visit-actions')).toBeHidden();
  await expect(page.locator('.day-legend')).toBeHidden();
  expect(errors).toEqual([]);
});
