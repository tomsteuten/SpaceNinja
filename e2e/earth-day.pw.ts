import { test, expect, settlePanel } from './fixtures';

test('Earth day and night is child-triggered, repeatable, and leaves discoveries intact', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start playing', exact: true }).click();
  await page.getByRole('button', { name: 'Fly to Earth', exact: true }).click();
  const snapshot = () => page.evaluate(() => (window as any).spaceNinjaSnapshot());
  await expect.poll(async () => (await snapshot()).phase).toBe('arrived');
  const day = page.getByRole('button', { name: 'Day and night on Earth' });
  const done = page.getByRole('button', { name: 'Stop day and night' });
  const visibleTargets = async () =>
    (await snapshot()).targets.filter((target: { visible: boolean }) => target.visible).length;

  // The first invitation offers the lesson or a direct route into discoveries.
  await expect(day).toBeVisible();
  await expect(done).toBeHidden();
  await expect.poll(visibleTargets).toBe(0);
  await expect(page.getByRole('button', { name: 'Find places', exact: true })).toBeVisible();
  await expect(page.locator('.fact-card')).toBeHidden();

  // Trigger it: the world turns, the places step aside, the button becomes Done.
  await day.click();
  await expect(done).toBeVisible();
  await expect.poll(async () => (await snapshot()).targets.length).toBe(0);
  const still = await snapshot();
  await page.waitForFunction(frame => (window as any).spaceNinjaSnapshot().frame > frame + 8, still.frame);
  expect((await snapshot()).surfaceRotation).toBeCloseTo(still.surfaceRotation, 6);
  // The child, rather than elapsed time, starts the surface movement.
  await page.getByRole('button', { name: 'Turn Earth a little', exact: true }).click();
  // Wait for the actual surface turn, not a wall-clock delay (software WebGL is slower).
  await page.waitForFunction(() => Number(document.querySelector<HTMLElement>('.spin-globe')?.style.getPropertyValue('--turn')) > 0.08);
  const teaching = await snapshot();
  expect(teaching.teachingSun.visible).toBe(true);
  for (const subject of [teaching.teachingSun, teaching.bodyScreen]) {
    expect(subject.x - subject.radius).toBeGreaterThan(12);
    expect(subject.x + subject.radius).toBeLessThan(page.viewportSize()!.width - 12);
    expect(subject.y - subject.radius).toBeGreaterThan(56);
    expect(subject.y + subject.radius).toBeLessThan(page.viewportSize()!.height - 90);
  }
  expect(Math.hypot(teaching.teachingSun.x - teaching.bodyScreen.x,
    teaching.teachingSun.y - teaching.bodyScreen.y)).toBeGreaterThan(
      teaching.teachingSun.radius + teaching.bodyScreen.radius + 12);

  // The words are one tap away while it turns.
  await page.getByRole('button', { name: 'Listen', exact: true }).click();
  await expect(page.locator('.fact-card')).toBeHidden();
  const about = page.getByRole('button', { name: 'Read the words', exact: true });
  await about.click();
  await expect(page.locator('.fact-card .fact-title')).toContainText('Day & night');
  await expect(page.locator('.fact-card p')).toBeVisible();
  await settlePanel(page);
  await page.getByRole('button', { name: 'Close the words', exact: true }).click();
  await expect(page.locator('.fact-card')).toBeHidden();

  // Survive a history suspend/restore mid-turn.
  const frameBeforeHistory = (await snapshot()).frame;
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
  await expect(done).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
  await expect.poll(async () => (await snapshot()).frame).toBeGreaterThan(frameBeforeHistory);
  await expect(done).toBeVisible();

  // End the turn: it leads into the guided hunt, the places return, none lost, camera handed back.
  await done.click();
  await expect(day).toBeVisible();
  await expect.poll(async () => (await snapshot()).guidedHunt).toBe(true);
  await expect.poll(visibleTargets).toBe(2);
  await expect.poll(async () => (await snapshot()).cameraReturning).toBe(false);
  expect((await snapshot()).teachingSun.visible).toBe(false);

  // A replay remains hands-on until Done, with the same hand-back and no lost discoveries.
  await day.click();
  await expect(done).toBeVisible();
  await expect.poll(async () => (await snapshot()).teachingSun.visible).toBe(true);
  const beforeDrag = await snapshot();
  const { width, height } = page.viewportSize()!;
  await page.mouse.move(width * 0.4, height * 0.5);
  await page.mouse.down();
  await page.mouse.move(width * 0.65, height * 0.5, { steps: 12 });
  await page.mouse.up();
  await expect.poll(async () => Math.abs((await snapshot()).surfaceRotation - beforeDrag.surfaceRotation)).toBeGreaterThan(0.3);
  expect((await snapshot()).dayTurning).toBe(true);
  await done.click();
  await expect.poll(async () => (await snapshot()).dayTurning).toBe(false);
  await expect.poll(async () => (await snapshot()).cameraReturning).toBe(false);
  await expect.poll(visibleTargets).toBe(2);
  expect((await snapshot()).teachingSun.visible).toBe(false);

  // Collect one visible place.
  const target = (await snapshot()).targets.find((item: { visible: boolean }) => item.visible);
  expect(target).toBeTruthy();
  expect(target.x).toBeGreaterThan(0);
  expect(target.x).toBeLessThan(page.viewportSize()!.width);
  await page.mouse.click(target.x, target.y);
  await expect.poll(async () => (await snapshot()).collected).toBe(1);
  await expect(page.locator('.photo-view.is-reward')).toBeVisible();
  await settlePanel(page);
  await page.getByRole('button', { name: 'Keep exploring' }).click();
  await expect(page.locator('.photo-view')).toBeHidden();

  // Leave via Space map and return: still offered (not automatic), the discovery persists.
  await page.getByRole('button', { name: 'Back to the space map', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Fly to Earth', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Fly to Earth', exact: true }).click();
  await expect.poll(async () => (await snapshot()).phase).toBe('arrived');
  await expect(day).toBeVisible();
  await expect(done).toBeHidden();
  await expect.poll(visibleTargets).toBe(2);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('spaceninja.progress.v1') ?? '{}').discoveries?.length)).toBe(1);
});

test('the teaching Sun survives resize and leaves with Space map', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start playing', exact: true }).click();
  await page.getByRole('button', { name: 'Fly to Earth', exact: true }).click();
  const snapshot = () => page.evaluate(() => (window as any).spaceNinjaSnapshot());
  await expect.poll(async () => (await snapshot()).phase).toBe('arrived');
  await page.getByRole('button', { name: 'Day and night on Earth' }).click();
  await page.getByRole('button', { name: 'Turn Earth a little', exact: true }).click();
  await page.waitForFunction(() => Number(document.querySelector<HTMLElement>('.spin-globe')?.style.getPropertyValue('--turn')) > 0.05);
  const before = (await snapshot()).frame;
  await page.setViewportSize({ width: 844, height: 390 });
  await expect.poll(async () => (await snapshot()).frame).toBeGreaterThan(before + 2);
  const resized = await snapshot();
  expect(resized.dayTurning).toBe(true);
  expect(resized.teachingSun.visible).toBe(true);
  for (const subject of [resized.teachingSun, resized.bodyScreen]) {
    expect(subject.y - subject.radius).toBeGreaterThan(56);
    expect(subject.y + subject.radius).toBeLessThan(318);
  }
  await page.getByRole('button', { name: 'Back to the space map', exact: true }).click();
  await expect.poll(async () => (await snapshot()).phase).toBe('idle');
  expect((await snapshot()).teachingSun.visible).toBe(false);
});

test('Earth itself opens the lesson, canvas taps assist, and cancelled or vertical drags do not keep turning', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start playing', exact: true }).click();
  await page.getByRole('button', { name: 'Fly to Earth', exact: true }).click();
  const snapshot = () => page.evaluate(() => (window as any).spaceNinjaSnapshot());
  await expect.poll(async () => (await snapshot()).phase).toBe('arrived');
  const globe = (await snapshot()).bodyScreen;
  await page.mouse.click(globe.x, globe.y);
  await expect.poll(async () => (await snapshot()).handsOnDay).toBe(true);
  await expect.poll(async () => (await snapshot()).teachingSun.visible).toBe(true);
  const before = await snapshot();
  await page.mouse.click(before.bodyScreen.x, before.bodyScreen.y);
  await expect.poll(async () => Math.abs((await snapshot()).surfaceRotation - before.surfaceRotation)).toBeGreaterThan(1.5);
  const turnedFrame = (await snapshot()).frame;
  await page.waitForFunction(n => (window as any).spaceNinjaSnapshot().frame > n + 12, turnedFrame);
  const tapped = await snapshot();
  expect(tapped.dayTurning).toBe(true);
  const { x, y } = tapped.bodyScreen;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 60, { steps: 8 });
  await page.mouse.up();
  const verticalFrame = (await snapshot()).frame;
  await page.waitForFunction(n => (window as any).spaceNinjaSnapshot().frame > n + 12, verticalFrame);
  expect((await snapshot()).surfaceRotation).toBeCloseTo(tapped.surfaceRotation, 6);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 70, y, { steps: 8 });
  await expect.poll(async () => Math.abs((await snapshot()).surfaceRotation - tapped.surfaceRotation)).toBeGreaterThan(0.1);
  await page.locator('canvas').dispatchEvent('pointercancel', { pointerId: 1, isPrimary: true });
  const cancelled = await snapshot();
  await page.mouse.move(x + 140, y, { steps: 8 });
  await page.mouse.up();
  const cancelledFrame = (await snapshot()).frame;
  await page.waitForFunction(n => (window as any).spaceNinjaSnapshot().frame > n + 12, cancelledFrame);
  expect((await snapshot()).surfaceRotation).toBeCloseTo(cancelled.surfaceRotation, 6);
  await page.getByRole('button', { name: 'Back to the space map', exact: true }).click();
  await expect.poll(async () => (await snapshot()).phase).toBe('idle');
});

test('the short landscape hunt counter leaves both gold places clear', async ({ page }, info) => {
  test.skip(info.project.name !== 'short-landscape');
  await page.goto('/');
  await page.getByRole('button', { name: 'Start playing', exact: true }).click();
  await page.getByRole('button', { name: 'Fly to Earth', exact: true }).click();
  const snapshot = () => page.evaluate(() => (window as any).spaceNinjaSnapshot());
  await expect.poll(async () => (await snapshot()).phase).toBe('arrived');
  // Trigger day & night and end it, which leads into the guided hunt deterministically rather
  // than waiting out the roam timer.
  await page.getByRole('button', { name: 'Day and night on Earth' }).click();
  await page.getByRole('button', { name: 'Stop day and night' }).click();
  await expect.poll(async () => (await snapshot()).guidedHunt).toBe(true);
  await expect.poll(async () => (await snapshot()).cameraReturning).toBe(false);
  const hud = page.locator('.mission-hud');
  await expect(hud).toBeVisible();
  const bounds = await hud.boundingBox();
  expect(bounds).toBeTruthy();
  const visible = (await snapshot()).targets.filter((target: { visible: boolean }) => target.visible);
  expect(visible).toHaveLength(2);
  for (const target of visible) {
    const outside = target.x < bounds!.x - 10 || target.x > bounds!.x + bounds!.width + 10 ||
      target.y < bounds!.y - 10 || target.y > bounds!.y + bounds!.height + 10;
    expect(outside, 'A gold place must remain clear of the guided-hunt counter').toBe(true);
  }
});
