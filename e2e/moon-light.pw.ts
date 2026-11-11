import { test, expect } from './fixtures';
import type { Locator, Page } from '@playwright/test';

const snapshot = (page: Page) => page.evaluate(() => (window as any).spaceNinjaSnapshot());

// Full-size pictures for review: MOONLIGHT_SHOTS=1 saves them to design/visit-screen/built/.
test.use({ deviceScaleFactor: 1 });

/*
 * The Moon's second toy is Moonlight, the "bounce" picture: sunlight flies to the Moon and
 * bounces down to a house. Nothing to drag; one big Sun switch. Off, the Moon goes dark, the
 * beams vanish and the house loses its glow.
 */
async function arriveAtMoon(page: Page) {
  await page.addInitScript(() => localStorage.setItem('spaceninja.sound.v1', 'off'));
  await page.goto('/?fast');
  await page.getByRole('button', { name: 'Start playing', exact: true }).click();
  await page.getByRole('button', { name: 'Fly to Moon', exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).phase).toBe('arrived');
}

/** Mean brightness (0-255) of the left or right half of the Moon's picture. */
const moonBrightness = (toy: Locator, half: 'left' | 'right') =>
  toy.locator('.moon-light__moon').evaluate((node, side) => {
    const c = node as HTMLCanvasElement;
    const w = c.width;
    const h = c.height;
    const x0 = side === 'left' ? Math.floor(w * 0.15) : Math.floor(w * 0.6);
    const data = c.getContext('2d')!.getImageData(x0, Math.floor(h * 0.35), Math.floor(w * 0.25), Math.floor(h * 0.3)).data;
    let sum = 0;
    let n = 0;
    for (let i = 0; i < data.length; i += 4) { sum += (data[i] + data[i + 1] + data[i + 2]) / 3; n++; }
    return sum / n;
  }, half);

type Box = { name: string; x: number; y: number; w: number; h: number };

async function boxes(toy: Locator): Promise<Box[]> {
  return toy.evaluate(root => {
    const out: Box[] = [];
    const add = (name: string, node: Element | null) => {
      if (!node) return;
      const r = node.getBoundingClientRect();
      if (r.width && r.height) out.push({ name, x: r.left, y: r.top, w: r.width, h: r.height });
    };
    add('switch', root.querySelector('.moon-light__switch'));
    add('back', root.querySelector('.moon-light__back'));
    add('words', root.querySelector('.moon-light__caption'));
    add('moon', root.querySelector('.moon-light__moon'));
    add('house', root.querySelector('.moon-light__house'));
    root.querySelectorAll('.moon-light__beams > g').forEach((g, i) => add(`beam${i}`, g));
    return out;
  });
}

function expectClear(all: Box[], viewport: { width: number; height: number }) {
  for (const b of all) {
    expect(b.x, `${b.name} left`).toBeGreaterThanOrEqual(-0.5);
    expect(b.y, `${b.name} top`).toBeGreaterThanOrEqual(-0.5);
    expect(b.x + b.w, `${b.name} right`).toBeLessThanOrEqual(viewport.width + 0.5);
    expect(b.y + b.h, `${b.name} bottom`).toBeLessThanOrEqual(viewport.height + 0.5);
  }
  const hit = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      // The beams are a family running into one another; everything else must stand clear.
      if (all[i].name.startsWith('beam') && all[j].name.startsWith('beam')) continue;
      expect(hit(all[i], all[j]), `${all[i].name} overlaps ${all[j].name}`).toBe(false);
    }
  }
}

test('Moon: Moonlight is sunlight bounced, and no Sun means no moonlight', async ({ page }, info) => {
  await arriveAtMoon(page);

  // Find the button by its name; if it is held back until the Moon has been played, play Jump first.
  const open = page.getByRole('button', { name: /moonlight/i });
  if (!(await open.isVisible())) {
    await page.getByRole('button', { name: /^Jump on the Moon/i }).click();
    await page.getByRole('button', { name: /^Back to the Moon/i }).click();
  }
  await expect(open).toBeVisible();
  await open.click();

  const toy = page.getByRole('dialog', { name: /moonlight/i });
  await expect(toy).toBeVisible();
  const sunSwitch = toy.getByRole('switch', { name: 'Sun' });
  await expect(sunSwitch).toBeChecked();
  await expect(toy.locator('.moon-light__caption')).toHaveText('Moonlight is sunlight, bounced.');

  // On: the Moon is lit on the side facing the Sun, the beams are drawn and the house glows.
  await expect.poll(() => moonBrightness(toy, 'left')).toBeGreaterThan(90);
  expect(await moonBrightness(toy, 'right')).toBeLessThan(60);
  await expect(toy.locator('.moon-light__beams > g')).toHaveCount(5);
  await expect(toy.locator('.moon-light__beams')).toBeVisible();
  await expect(toy.locator('.moon-light__glow')).toBeVisible();
  const viewport = page.viewportSize()!;
  expectClear(await boxes(toy), viewport);

  const shot = async (state: 'on' | 'off') => {
    if (!process.env.MOONLIGHT_SHOTS) return;
    const shape = viewport.width > viewport.height ? 'landscape' : 'portrait';
    if (info.project.name === 'tablet') return;
    await page.screenshot({ path: `design/visit-screen/built/moonlight-${state}-${shape}.png` });
  };
  await shot('on');

  // Off: grey Sun, no beams, a dark Moon, no glow. The Sun switch is the whole card.
  await sunSwitch.click();
  await expect(sunSwitch).not.toBeChecked();
  await expect(toy.locator('.moon-light__caption')).toHaveText('No Sun, no moonlight.');
  await expect(toy.locator('.moon-light__beams')).toBeHidden();
  await expect(toy.locator('.moon-light__glow')).toBeHidden();
  await expect.poll(() => moonBrightness(toy, 'left')).toBeLessThan(40);
  await shot('off');

  // On again: everything returns, and Enter works from the keyboard.
  await sunSwitch.focus();
  await page.keyboard.press('Enter');
  await expect(sunSwitch).toBeChecked();
  await expect(toy.locator('.moon-light__beams')).toBeVisible();
  await expect.poll(() => moonBrightness(toy, 'left')).toBeGreaterThan(90);
  await expect(toy.locator('.moon-light__caption')).toHaveText('Moonlight is sunlight, bounced.');

  // Turn the phone while it is open: still inside the screen and nothing overlaps.
  await page.setViewportSize({ width: viewport.height, height: viewport.width });
  const turned = page.viewportSize()!;
  await expect.poll(async () => {
    const all = await boxes(toy);
    return all.every(b => b.x + b.w <= turned.width + 0.5 && b.y + b.h <= turned.height + 0.5);
  }).toBe(true);
  expectClear(await boxes(toy), turned);
  await page.setViewportSize(viewport);
  // Wait for the re-layout after turning back before measuring.
  await expect.poll(async () => {
    const all = await boxes(toy);
    return all.length > 5 && all.every(b => b.x + b.w <= viewport.width + 0.5 && b.y + b.h <= viewport.height + 0.5);
  }).toBe(true);
  expectClear(await boxes(toy), viewport);

  // Back closes it and hands focus back to the opening button.
  await toy.getByRole('button', { name: /^Back to the Moon/i }).click();
  await expect(toy).toHaveCount(0);
  await expect(open).toBeFocused();
});
