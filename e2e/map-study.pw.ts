import { test, expect, attachShot, expectRendering, settlePanel } from './fixtures';

test.use({ deviceScaleFactor: 1 });
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('spaceninja.sound.v1', 'off'));
});

test('map paging responds without changing progress and survives interruption', async ({ page }, info) => {
  await page.goto('/?mapstudy');
  await page.getByRole('button', { name: 'Start playing', exact: true }).click();
  const map = page.locator('.neighborhood-map');
  const next = page.locator('.map-page--next');
  await expect(map).toHaveAttribute('data-neighborhood', 'earth');
  await expectRendering(page);
  const heading = (await page.locator('.map-heading').boundingBox())!;
  const tray = (await page.locator('.map-tray').boundingBox())!;
  await expect.poll(() => page.evaluate(({ top, bottom }) => {
    const bodies = (window as any).spaceNinjaSnapshot().mapBodies;
    return bodies.length === 2 && bodies.every((b: { x: number; y: number; radius: number }) =>
      b.x - b.radius > 0 && b.x + b.radius < innerWidth && b.y - b.radius > top && b.y + b.radius < bottom);
  }, { top: heading.y + heading.height, bottom: tray.y })).toBe(true);
  await attachShot(page, 'map-study-earth', info);
  const progress = await page.evaluate(() => localStorage.getItem('spaceninja.progress.v1'));
  await next.click();
  await expect(map).toHaveAttribute('data-neighborhood', 'mars');
  await expect(next).toBeFocused();
  const locked = page.locator('.map-destination[data-destination="mars"]');
  // aria-disabled choices still acknowledge a child's physical tap.
  const bounds = (await locked.boundingBox())!;
  await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await expect(page.locator('.map-instruction')).toHaveText('Visit The Moon first');
  await expect.poll(() => page.evaluate(() => (window as any).spaceNinjaSnapshot().phase)).toBe('idle');
  await next.focus();
  await page.keyboard.press('Enter');
  await expect(map).toHaveAttribute('data-neighborhood', 'jupiter');
  await expect(page.locator('.map-destination')).toHaveCount(3);
  const europa = page.locator('.map-destination[data-destination="europa"]');
  await europa.focus();
  await page.keyboard.press('Space');
  await expect(page.locator('.map-instruction')).toContainText('Europa is coming later');
  const more = page.getByRole('button', { name: /More moons/ });
  await more.click();
  await expect(more).toBeFocused();
  await expect(page.locator('.map-destination[data-destination="callisto"]')).toBeVisible();
  await attachShot(page, 'map-study-future', info);
  for (const button of await page.locator('.map-tray button:visible').all()) {
    const box = (await button.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(56);
    expect(box.height).toBeGreaterThanOrEqual(56);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  }
  const { width, height } = page.viewportSize()!;
  await page.mouse.move(width * .7, height * .5);
  await page.mouse.down();
  await page.mouse.move(width * .3, height * .5, { steps: 5 });
  await page.mouse.up();
  await expect(map).toHaveAttribute('data-neighborhood', 'saturn');
  // A suspended held gesture cannot become a swipe on history restoration.
  await page.mouse.move(width * .7, height * .5);
  await page.mouse.down();
  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  });
  await page.mouse.move(width * .3, height * .5);
  await page.mouse.up();
  await expect(map).toHaveAttribute('data-neighborhood', 'saturn');
  await page.setViewportSize({ width: 320, height: 568 });
  await next.click();
  await expect(map).toHaveAttribute('data-neighborhood', 'uranus');
  await expectRendering(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  expect(await page.evaluate(() => localStorage.getItem('spaceninja.progress.v1'))).toBe(progress);
});

test('real journeys yield the camera and return to their neighborhood', async ({ page }, info) => {
  // Exercise each viewport's camera handoff and existing arrival controls. The tablet
  // additionally covers unlocked outer worlds without repeating long trips everywhere.
  await page.addInitScript(() => localStorage.setItem('spaceninja.progress.v1', JSON.stringify({
    visited: ['moon', 'mars'], discoveries: [], stickers: [],
  })));
  await page.goto('/?mapstudy');
  await page.getByRole('button', { name: 'Start playing', exact: true }).click();
  const map = page.locator('.neighborhood-map');
  const snapshot = () => page.evaluate(() => (window as any).spaceNinjaSnapshot());
  await page.getByRole('button', { name: 'Fly to Earth', exact: true }).click();
  await expect(map).toBeHidden();
  await expect.poll(async () => (await snapshot()).phase).toBe('arrived');
  await expect(page.getByRole('button', { name: 'Day and night on Earth' })).toBeVisible();
  await page.getByRole('button', { name: 'Find places', exact: true }).click();
  await expect.poll(async () => (await snapshot()).targets.filter((t: { visible: boolean }) => t.visible).length).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Back to the space map', exact: true }).click();
  await expect(map).toBeVisible();
  await expect(map).toHaveAttribute('data-neighborhood', 'earth');
  if (info.project.name === 'tablet') {
    for (let i = 0; i < 3; i++) await page.locator('.map-page--next').click();
    await expect(map).toHaveAttribute('data-neighborhood', 'saturn');
    await expectRendering(page);
    await attachShot(page, 'map-study-saturn', info);
    await page.getByRole('button', { name: 'Fly to Saturn', exact: true }).click();
    await expect.poll(async () => (await snapshot()).phase).toBe('arrived');
    expect((await snapshot()).world).toBe('saturn');
    await page.getByRole('button', { name: 'Back to the space map', exact: true }).click();
    await expect(map).toBeVisible();
    await expect(map).toHaveAttribute('data-neighborhood', 'saturn');
    expect((await snapshot()).mapBodyIds).toContain('saturn');
  }
  await expectRendering(page);
});

test('a real Moon tap unlocks Mars, discoveries persist, and Sun remains reachable', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone', 'One fresh-save progression pass complements the three viewport handoffs.');
  await page.goto('/?mapstudy');
  await page.getByRole('button', { name: 'Start playing', exact: true }).click();
  const snapshot = () => page.evaluate(() => (window as any).spaceNinjaSnapshot());
  await expect.poll(async () => (await snapshot()).mapBodies.length).toBe(2);
  const moon = (await snapshot()).mapBodies.find((b: { id: string }) => b.id === 'moon');
  await page.mouse.click(moon.x, moon.y);
  await expect.poll(async () => (await snapshot()).phase).toBe('arrived');
  expect((await snapshot()).world).toBe('moon');
  const place = (await snapshot()).targets.find((t: { visible: boolean }) => t.visible);
  await page.mouse.click(place.x, place.y);
  await expect.poll(async () => (await snapshot()).collected).toBe(1);
  await expect(page.locator('.photo-view.is-reward')).toBeVisible();
  await settlePanel(page);
  await page.getByRole('button', { name: 'Keep exploring' }).click();
  await page.getByRole('button', { name: 'Back to the space map', exact: true }).click();
  await expect(page.locator('.map-instruction')).toHaveText('Mars is ready on the map');
  await page.locator('.map-page--next').click();
  await page.getByRole('button', { name: 'Fly to Mars', exact: true }).click();
  await expect.poll(async () => (await snapshot()).phase).toBe('arrived');
  expect((await snapshot()).world).toBe('mars');
  await page.getByRole('button', { name: 'Back to the space map', exact: true }).click();
  await expect(page.locator('.neighborhood-map')).toHaveAttribute('data-neighborhood', 'mars');
  await page.locator('.map-page--previous').click();
  await page.getByRole('button', { name: 'Fly to Sun', exact: true }).click();
  await expect.poll(async () => (await snapshot()).phase).toBe('arrived');
  expect((await snapshot()).world).toBe('sun');
  await page.getByRole('button', { name: 'Back to the space map', exact: true }).click();
  await expect(page.locator('.neighborhood-map')).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('spaceninja.progress.v1')!));
  expect(saved.discoveries).toHaveLength(1);
  expect(saved.visited).toEqual(expect.arrayContaining(['moon','mars','sun']));
});
