import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

// Capture the same fresh home on a baseline, live deployment, or candidate.
// Independent contexts, real controls, deviceScaleFactor 1; no scene state setters.
const [url, label, output = 'design/home-review-2026-09-24'] = process.argv.slice(2);
if (!url || !label) throw new Error('Usage: node scripts/capture-home.mjs URL LABEL [OUTPUT]');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ args: [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
] });
try {
  for (const [device, viewport] of Object.entries({
    phone: { width: 390, height: 844 }, tablet: { width: 1024, height: 768 },
  })) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1,
      hasTouch: true, reducedMotion: 'reduce', serviceWorkers: 'block' });
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
    await page.goto(url, { waitUntil: 'load', timeout: 120000 });
    const start = page.getByRole('button', { name: 'Start playing', exact: true });
    await start.or(page.locator('.destination-bar')).first().waitFor({ state: 'visible' });
    if (await start.isVisible()) await start.click();
    await page.locator('#boot').waitFor({ state: 'hidden' });
    await page.locator('.destination-bar').waitFor({ state: 'visible' });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: output + '/' + label + '-' + device + '.png' });
    const controls = await page.locator('.destination-choice, .journal-btn, .hint').evaluateAll(nodes =>
      nodes.map(node => ({ text: node.textContent, label: node.getAttribute('aria-label'),
        classes: node.className, bounds: node.getBoundingClientRect().toJSON() })));
    await writeFile(output + '/' + label + '-' + device + '.json', JSON.stringify({ url, viewport,
      deviceScaleFactor: 1, errors, controls }, null, 2));
    console.log(label + ' ' + device + ': ' + errors.length + ' browser errors');
    if (errors.length && !label.startsWith('live')) throw new Error(errors.join('\n'));
    await context.close();
  }
} finally { await browser.close(); }
