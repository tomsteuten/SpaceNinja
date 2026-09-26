import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const label = process.argv[2];
if (!['before', 'after'].includes(label)) throw new Error('Use before or after');
const output = 'design/day-sun-2026-09-26';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  ...(process.env.SPACE_NINJA_CHROMIUM ? { executablePath: process.env.SPACE_NINJA_CHROMIUM } : {}),
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  for (const [device, viewport] of Object.entries({
    phone: { width: 390, height: 844 },
    tablet: { width: 1024, height: 768 },
    'short-landscape': { width: 844, height: 390 },
  })) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1,
      hasTouch: true, reducedMotion: 'reduce', serviceWorkers: 'block' });
    const page = await context.newPage();
    page.setDefaultTimeout(120000);
    await page.addInitScript(() => {
      localStorage.setItem('spaceninja.grownups.v1', 'yes');
      Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 4 });
      Object.defineProperty(navigator, 'deviceMemory', { get: () => 2 });
      Math.random = () => 0.1;
    });
    await page.goto(process.env.SPACE_NINJA_CAPTURE_URL ?? 'http://127.0.0.1:4180/');
    const start = page.getByRole('button', { name: 'Start playing', exact: true });
    if (await start.isVisible()) await start.click();
    await page.getByRole('button', { name: 'Fly to Earth', exact: true }).click();
    await page.waitForFunction(() => window.spaceNinjaSnapshot?.().phase === 'arrived');
    await page.getByRole('button', { name: 'Day and night on Earth', exact: true }).click();
    await page.waitForFunction(() => Number(document.querySelector('.spin-globe')?.style.getPropertyValue('--turn')) >= 0.2);
    // Freeze after a rendered state, so screenshot encoding cannot advance the activity.
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
    await page.screenshot({ path: `${output}/${label}-${device}.png` });
    await writeFile(`${output}/${label}-${device}.json`, JSON.stringify(await page.evaluate(() => window.spaceNinjaSnapshot()), null, 2));
    console.log(`${label}: ${device}`);
    await context.close();
  }
} finally { await browser.close(); }
