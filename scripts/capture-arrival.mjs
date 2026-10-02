/**
 * Full-resolution arrival captures for the owner's eye: phone, tablet and short landscape,
 * at device scale 1. Usage: node scripts/capture-arrival.mjs <label> [world]
 *
 * Expects a playtest preview at SPACE_NINJA_CAPTURE_URL (default the Playwright preview,
 * http://127.0.0.1:4180/): `npm run build:playtest && npm run preview:playtest`. For a
 * "before" set, run it from a temporary worktree of the previous commit with its own
 * `npm ci`, never a linked node_modules (see AGENTS.md).
 */
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const label = process.argv[2];
const world = process.argv[3] ?? 'Moon';
if (!label) throw new Error('Provide a label, e.g. before or after');
const url = process.env.SPACE_NINJA_CAPTURE_URL ?? 'http://127.0.0.1:4180/';
const output = process.env.SPACE_NINJA_CAPTURE_DIR ?? 'design/flight-review-2026-09-24';
await mkdir(output, { recursive: true });
const executablePath = process.env.SPACE_NINJA_CHROMIUM;
const browser = await chromium.launch({
  ...(executablePath ? { executablePath } : {}),
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const viewports = {
    phone: { width: 390, height: 844 },
    tablet: { width: 1024, height: 768 },
    'short-landscape': { width: 844, height: 390 },
  };
  for (const [device, viewport] of Object.entries(viewports)) {
    const context = await browser.newContext({
      viewport, deviceScaleFactor: 1, hasTouch: true, reducedMotion: 'reduce', serviceWorkers: 'block',
    });
    const page = await context.newPage();
    page.setDefaultTimeout(180000);
    await page.addInitScript(() => {
      localStorage.setItem('spaceninja.grownups.v1', 'yes');
      Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 4 });
      Object.defineProperty(navigator, 'deviceMemory', { get: () => 2 });
      Math.random = () => 0.1;
    });
    await page.goto(url);
    const start = page.getByRole('button', { name: 'Start playing', exact: true });
    if (await start.isVisible()) await start.click();
    await page.locator('#boot').waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: `Fly to ${world}`, exact: true }).click();
    await page.waitForFunction(() => window.spaceNinjaSnapshot?.().phase === 'arrived');
    await page.getByRole('button', { name: 'Space map', exact: true }).waitFor();
    // Let the arrival settle: the hint, the card and the parked ship's dimming.
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${output}/${label}-${device}.png` });
    console.log(`${label} ${device}`);
    await context.close();
  }
} finally {
  await browser.close();
}
