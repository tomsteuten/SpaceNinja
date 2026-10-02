/** Full CSS-resolution review of the discovery exit and map return, before and after. */
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const label = process.argv[2];
if (!['before', 'after'].includes(label)) throw new Error('Use before or after');
const url = process.env.SPACE_NINJA_CAPTURE_URL ?? 'http://127.0.0.1:4180/';
const output = process.env.SPACE_NINJA_CAPTURE_DIR ?? 'design/publish-review-2026-10-03';
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  ...(process.env.SPACE_NINJA_CHROMIUM ? { executablePath: process.env.SPACE_NINJA_CHROMIUM } : {}),
});
try {
  for (const [device, viewport] of Object.entries({
    phone: { width: 390, height: 844 }, tablet: { width: 1024, height: 768 },
    'short-landscape': { width: 844, height: 390 },
  })) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: true,
      reducedMotion: 'reduce', serviceWorkers: 'block' });
    const page = await context.newPage();
    page.setDefaultTimeout(120000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 4 });
      Object.defineProperty(navigator, 'deviceMemory', { get: () => 2 });
      Math.random = () => 0.1;
    });
    const directory = `${output}/${device}`;
    await mkdir(directory, { recursive: true });
    const shot = async name => page.screenshot({ path: `${directory}/${label}-${name}.png` });
    await page.goto(url);
    await page.getByRole('button', { name: 'Start playing', exact: true }).click();
    await shot('space-map');
    await page.getByRole('button', { name: 'Fly to Moon', exact: true }).click();
    await page.waitForFunction(() => window.spaceNinjaSnapshot?.().phase === 'arrived');
    await page.waitForTimeout(1500);
    await shot('world-return');
    const target = await page.evaluate(() => window.spaceNinjaSnapshot().targets.find(t => t.visible));
    await page.mouse.click(target.x, target.y);
    await page.locator('.photo-view.is-reward').waitFor();
    await page.waitForFunction(() => document.querySelector('.photo-view__image').naturalWidth > 0);
    await page.waitForTimeout(650);
    await shot('discovery-exit');
    await page.getByRole('button', { name: 'Keep exploring', exact: true }).click();
    if (label === 'after') {
      await page.getByRole('button', { name: 'Back to the space map', exact: true }).click();
      await page.getByRole('button', { name: 'Fly to Sun', exact: true }).click();
      await page.waitForFunction(() => window.spaceNinjaSnapshot?.().phase === 'arrived');
      await page.waitForTimeout(1500);
      await shot('sun-visit');
    }
    if (errors.length) throw new Error(errors.join('\n'));
    console.log(`${label} ${device}: captured at deviceScaleFactor 1`);
    await context.close();
  }
} finally { await browser.close(); }
