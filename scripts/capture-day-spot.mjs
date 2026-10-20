import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const [label, url, selectedView] = process.argv.slice(2);
if (!['before', 'after'].includes(label) || !url) throw new Error('Use: before|after URL [phone|tablet|short-landscape]');
const output = 'design/wave-1/earth-feedback-2026-10-19';
await mkdir(output, { recursive: true });
const views = { phone: { width:390, height:844 }, tablet: { width:1024, height:768 },
  'short-landscape': { width:844, height:390 } };
if (selectedView && !Object.hasOwn(views, selectedView)) throw new Error(`Unknown viewport: ${selectedView}`);
const browser = await chromium.launch({
  ...(process.env.SPACE_NINJA_CHROMIUM ? { executablePath:process.env.SPACE_NINJA_CHROMIUM } : { channel:'chromium' }),
  args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'],
});
try {
  for (const [view, viewport] of Object.entries(views)) {
    if (selectedView && selectedView !== view) continue;
    const context = await browser.newContext({ viewport, deviceScaleFactor:1, hasTouch:true,
      reducedMotion:'reduce', serviceWorkers:'block' });
    const page = await context.newPage();
    page.setDefaultTimeout(120000);
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'hardwareConcurrency', { get:() => 4 });
      Object.defineProperty(navigator, 'deviceMemory', { get:() => 2 });
      Math.random = () => 0.1;
    });
    const snapshot = () => page.evaluate(() => window.spaceNinjaSnapshot());
    async function drag(dx) {
      const x = viewport.width / 2 - dx / 2;
      await page.mouse.move(x, viewport.height * .5);
      await page.mouse.down();
      await page.mouse.move(x + dx, viewport.height * .5, { steps:6 });
      await page.mouse.up();
      const frame = (await snapshot()).frame;
      await page.waitForFunction(n => window.spaceNinjaSnapshot().frame > n + 2, frame);
    }
    async function capture(state) {
      const frame = (await snapshot()).frame;
      await page.waitForFunction(n => window.spaceNinjaSnapshot().frame > n + 3, frame);
      await page.screenshot({ path:`${output}/${label}-${view}-${state}.png` });
      await writeFile(`${output}/${label}-${view}-${state}.json`, JSON.stringify(await snapshot(), null, 2));
      console.log(`${label}: ${view} ${state}`);
    }
    await page.goto(url);
    await page.getByRole('button', { name:'Start playing', exact:true }).click();
    await page.getByRole('button', { name:'Fly to Earth', exact:true }).click();
    await page.waitForFunction(() => window.spaceNinjaSnapshot().phase === 'arrived');
    await page.getByRole('button', { name:'Day and night on Earth' }).click();
    await page.waitForFunction(() => window.spaceNinjaSnapshot().daySpot?.facing > .2);
    await capture('day');
    const start = (await snapshot()).daySpot;
    await drag(50);
    const dx = (await snapshot()).daySpot.sunlight < start.sunlight ? 50 : -50;
    for (let i=0; i<30 && (await snapshot()).daySpot.lit; i++) await drag(dx);
    if ((await snapshot()).daySpot.lit) throw new Error('Night was not reached');
    await capture('night');
    for (let i=0; i<30 && !(await snapshot()).daySpot.roundTrip; i++) await drag(-dx);
    if (!(await snapshot()).daySpot.roundTrip) throw new Error('Morning was not reached');
    await capture('morning');
    if (errors.length) throw new Error(errors.join('\n'));
    await context.close();
  }
} finally { await browser.close(); }

const audio = ['start','night','moon','done'].map(cue => `<p>${cue}: <audio controls preload="none" aria-label="${cue} narration" src="../../../src/audio/recordings/day-night-${cue}.mp3"></audio></p>`).join('');
const rows = Object.keys(views).map(view => `<section><h2>${view}</h2>${['day','night','morning'].map(state =>
  `<h3>${state}</h3><div class="pair">${['before','after'].map(side => `<figure><figcaption>${side}</figcaption><a href="${side}-${view}-${state}.png"><img src="${side}-${view}-${state}.png" alt="${side} ${view} ${state}"></a></figure>`).join('')}</div>`).join('')}</section>`).join('');
await writeFile(`${output}/index.html`, `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Earth day/night review</title><style>body{font:16px system-ui;background:#0b1424;color:#edf3fa;margin:24px}main{max-width:1200px;margin:auto}.pair{display:flex;gap:16px}figure{margin:0;flex:1;min-width:0}img{width:100%;height:auto}figcaption{text-transform:capitalize;padding:8px}section{margin:36px 0}a{color:#a6dce8}audio{vertical-align:middle;max-width:100%}</style><main><h1>Earth day/night — before and after</h1><p>Baseline: 36a99d7. All captures use deviceScaleFactor: 1 and reduced motion. Three states of the same activity, using real pointer drags. Browser checks are not physical-tablet or child approval.</p><details><summary>Listen to the four new local Kokoro cues</summary>${audio}</details>${rows}</main></html>`);
