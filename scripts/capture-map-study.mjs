import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

// Independent baseline checkout with its own npm ci; both Vite servers must be running.
const output = new URL('../design/map-study-2026-10-08/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  ...(process.env.SPACE_NINJA_CHROMIUM ? { executablePath: process.env.SPACE_NINJA_CHROMIUM } : {}) });
try {
  for (const [device, width, height] of [['phone',390,844],['tablet',1024,768],['short-landscape',844,390]]) {
    for (const [version, url] of [['before','http://127.0.0.1:5182/'],['after','http://127.0.0.1:5181/?mapstudy']]) {
      for (const progressed of [false,true]) {
        const context = await browser.newContext({ viewport:{width,height}, deviceScaleFactor:1, hasTouch:true, reducedMotion:'reduce' });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
        await page.addInitScript(progressed => {
          Object.defineProperty(navigator,'hardwareConcurrency',{get:()=>4});
          Object.defineProperty(navigator,'deviceMemory',{get:()=>2});
          Math.random=()=>.1;
          localStorage.setItem('spaceninja.sound.v1','off');
          if (progressed) localStorage.setItem('spaceninja.progress.v1',JSON.stringify({visited:['moon','mars'],discoveries:[],stickers:[]}));
        },progressed);
        await page.goto(url);
        await page.getByRole('button',{name:'Start playing',exact:true}).click();
        await page.locator('#boot').waitFor({state:'hidden'});
        if (version==='after') await page.locator('.map-title').waitFor();
        await page.evaluate(() => document.fonts.ready);
        // Let the off-center projection settle; screenshots are evidence, not assertions.
        await page.waitForTimeout(2000);
        const shot = async suffix => {
          const name=`${device}-${version}-${suffix}.png`;
          await page.screenshot({path:new URL(name,output).pathname.replace(/^\/(\w:)/,'$1')});
          console.log(name);
        };
        await shot(progressed?'progressed':'fresh');
        if (version==='after') {
          for(let i=0;i< (progressed?3:2);i++) await page.locator('.map-page--next').click();
          await page.waitForTimeout(1000);
          await shot(progressed?'saturn':'future');
        }
        if(errors.length) throw new Error(errors.join('\n'));
        await context.close();
      }
    }
  }
} finally { await browser.close(); }
