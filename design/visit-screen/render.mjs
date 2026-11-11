// Renders each sheet of mocks.html to a PNG beside it. Needs the dev server on :5173.
//   node design/visit-screen/render.mjs
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 2600, height: 1400 }, deviceScaleFactor: 1.5 });
await page.goto('http://localhost:5173/design/visit-screen/mocks.html');
await page.waitForSelector('body[data-ready="1"]', { timeout: 60000 });
for (const id of await page.$$eval('.sheet', (els) => els.map((e) => e.id))) {
  await page.locator(`#${id}`).screenshot({ path: path.join(here, `${id}.png`) });
  console.log('wrote', `${id}.png`);
}
await browser.close();
