import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

const snapshot = (page: Page) => page.evaluate(() => (window as any).spaceNinjaSnapshot());

/** Earth's centre and radius in the bedtime spin, matching its layout(). */
async function spinGeometry(page: Page) {
  const box = (await page.locator('.bedtime-spin__canvas').boundingBox())!;
  const r = Math.min(box.width * 0.36, box.height * 0.3, 260);
  return { cx: box.x + box.width * 0.56, cy: box.y + box.height * 0.44, r };
}

/** Drags round Earth's centre through `degrees` (negative = counter-clockwise on screen). */
async function dragAround(page: Page, from: number, degrees: number) {
  const { cx, cy, r } = await spinGeometry(page);
  const at = (deg: number) => {
    const a = (deg * Math.PI) / 180;
    return [cx + Math.cos(a) * r * 0.7, cy + Math.sin(a) * r * 0.7] as const;
  };
  await page.mouse.move(...at(from));
  await page.mouse.down();
  const steps = 16;
  for (let i = 1; i <= steps; i++) await page.mouse.move(...at(from + (degrees * i) / steps));
  await page.mouse.up();
}

test('first Earth visit: Turn Earth opens the bedtime spin, and night then morning points on to the Moon', async ({ page }) => {
  const cues: string[] = [];
  page.on('request', (request) => {
    const match = /(day-night-[a-z]+)[^/]*\.mp3/.exec(request.url());
    if (match) cues.push(match[1]!);
  });
  await page.goto('/?fast');
  await page.getByRole('button', { name: 'Start playing', exact: true }).click();
  await page.getByRole('button', { name: 'Fly to Earth', exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).phase).toBe('arrived');
  await expect(page.locator('.spin-btn')).toHaveText('Turn Earth');
  await expect(page.locator('canvas')).toHaveCount(1);

  await page.locator('.spin-btn').click();
  const toy = page.getByRole('dialog', { name: 'Spin Earth through a day' });
  await expect(toy).toBeVisible();
  await expect(toy).toHaveAttribute('data-part', 'day');
  const startHour = Number(await toy.getAttribute('data-hour'));

  // Clockwise is backwards for Earth seen from above the North Pole: nothing happens.
  await dragAround(page, 90, 60);
  expect(Number(await toy.getAttribute('data-hour'))).toBeCloseTo(startHour, 1);
  // Counter-clockwise turns it on through the evening into night.
  await dragAround(page, 90, -75);
  await expect.poll(async () => Number(await toy.getAttribute('data-hour'))).toBeGreaterThan(startHour + 3);
  await expect(toy).toHaveAttribute('data-part', 'night');

  // The big button carries on through the night to morning.
  const turn = toy.getByRole('button', { name: 'Turn Earth' });
  for (let i = 0; i < 6 && !(await snapshot(page)).mapInvite; i++) {
    await turn.click();
    await page.waitForTimeout(700);
  }
  await expect.poll(async () => (await snapshot(page)).mapInvite).toBe(true);
  await expect.poll(() => cues).toEqual(expect.arrayContaining(['day-night-start', 'day-night-night', 'day-night-moon']));

  await toy.getByRole('button', { name: 'Back to Earth' }).click();
  await expect(toy).toHaveCount(0);
  await expect(page.locator('canvas')).toHaveCount(1);
  await expect(page.locator('.spin-btn')).toBeFocused();
  await expect.poll(async () => (await snapshot(page)).guidedHunt).toBe(true);
  // The hunt is the next step: no ring on Space map while gold places remain.
  expect((await snapshot(page)).mapInvite).toBe(false);
});

test('a later Earth visit: Day & night opens the spin, a full turn is a day, and the places are untouched', async ({ page }) => {
  const cues: string[] = [];
  page.on('request', (request) => { if (/day-night-.*\.mp3/.test(request.url())) cues.push(request.url()); });
  await page.addInitScript(() => {
    localStorage.setItem('spaceninja.sound.v1', 'off');
    localStorage.setItem('spaceninja.progress.v1', JSON.stringify({ visited: ['earth'], discoveries: [], stickers: [] }));
  });
  await page.goto('/?fast');
  await page.getByRole('button', { name: 'Start playing', exact: true }).click();
  await page.getByRole('button', { name: 'Fly to Earth', exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).phase).toBe('arrived');
  await expect(page.locator('.spin-btn')).toHaveText('Day & night');
  const before = await snapshot(page);

  await page.locator('.spin-btn').click();
  const toy = page.getByRole('dialog', { name: 'Spin Earth through a day' });
  await expect(toy).toBeVisible();
  // Keyboard and the button both turn it, three hours a press: eight presses make a day.
  await page.keyboard.press('ArrowRight');
  const turn = toy.getByRole('button', { name: 'Turn Earth' });
  for (let i = 0; i < 7; i++) await turn.click();
  await expect(toy).toHaveAttribute('data-days', '1', { timeout: 15000 });
  await expect(toy.locator('.bedtime-spin__days')).toHaveText('1 turn = 1 day');
  // The real Earth picture loaded: the toy shows the game's own map, not a placeholder.
  await expect.poll(() => page.evaluate(() => performance.getEntriesByType('resource')
    .some(entry => entry.name.includes('earth.jpg')))).toBe(true);

  await page.keyboard.press('Escape');
  await expect(toy).toHaveCount(0);
  // The 3D Earth was left alone while the toy was open.
  expect((await snapshot(page)).surfaceRotation).toBeCloseTo(before.surfaceRotation, 6);
  expect((await snapshot(page)).dayTurning).toBe(false);
  expect(cues, 'Muted play starts no narration').toEqual([]);

  await expect.poll(async () => (await snapshot(page)).targets.some((t: any) => t.visible)).toBe(true);
  const target = (await snapshot(page)).targets.find((t: any) => t.visible);
  await page.mouse.click(target.x, target.y);
  await expect.poll(async () => (await snapshot(page)).collected).toBe(1);
});

test('the short landscape hunt counter leaves both gold places clear', async ({ page }, info) => {
  test.skip(info.project.name !== 'short-landscape');
  await page.goto('/?fast');
  await page.getByRole('button', { name: 'Start playing', exact: true }).click();
  await page.getByRole('button', { name: 'Fly to Earth', exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).phase).toBe('arrived');
  // Find places leads into the guided hunt deterministically rather than waiting out the roam timer.
  await page.getByRole('button', { name: 'Find places', exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).guidedHunt).toBe(true);
  await expect.poll(async () => (await snapshot(page)).cameraReturning).toBe(false);
  const hud = page.locator('.mission-hud');
  await expect(hud).toBeVisible();
  const bounds = await hud.boundingBox();
  expect(bounds).toBeTruthy();
  const visible = (await snapshot(page)).targets.filter((target: { visible: boolean }) => target.visible);
  expect(visible).toHaveLength(2);
  for (const target of visible) {
    const outside = target.x < bounds!.x - 10 || target.x > bounds!.x + bounds!.width + 10 ||
      target.y < bounds!.y - 10 || target.y > bounds!.y + bounds!.height + 10;
    expect(outside, 'A gold place must remain clear of the guided-hunt counter').toBe(true);
  }
});
