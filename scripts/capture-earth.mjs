import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const label=process.argv[2];
if (!label) throw new Error('Provide before, after or guided');
const url=process.env.SPACE_NINJA_CAPTURE_URL ?? 'http://127.0.0.1:4173/';
const output='design/earth-review-2026-09-24';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
  for(const [device,viewport] of Object.entries({phone:{width:390,height:844},tablet:{width:1024,height:768},'short-landscape':{width:844,height:390}})) {
    const context=await browser.newContext({viewport,deviceScaleFactor:1,hasTouch:true,reducedMotion:'reduce',serviceWorkers:'block'});
    const page=await context.newPage(); page.setDefaultTimeout(120000);
    await page.addInitScript(()=>{localStorage.setItem('spaceninja.grownups.v1','yes');Object.defineProperty(navigator,'hardwareConcurrency',{get:()=>4});Object.defineProperty(navigator,'deviceMemory',{get:()=>2});Math.random=()=>0.1});
    await page.goto(url);
    const start=page.getByRole('button',{name:'Start playing',exact:true});
    if(await start.isVisible()) await start.click();
    await page.getByRole('dialog',{name:'Grown-ups settings'}).waitFor({state:'hidden'});
    await page.getByRole('button',{name:'Fly to Earth',exact:true}).click();
    await page.getByRole('button',{name:'Fly Home',exact:true}).waitFor();
    if (label === 'guided') await page.locator('.mission-hud').waitFor({state:'visible'});
    await page.screenshot({path:`${output}/${label}-${device}.png`});
    console.log(`${label} ${device}`);
    if (label === 'after') {
      await page.getByRole('button',{name:'Day and night on Earth'}).click();
      await page.getByRole('button',{name:'Done with day and night'}).waitFor();
      await page.waitForFunction(() => Number(document.querySelector('.spin-globe')?.getAttribute('style')?.match(/--turn:\s*([\d.]+)/)?.[1] ?? 0) >= 0.1);
      await page.screenshot({path:`${output}/after-active-${device}.png`});
      console.log(`after-active ${device}`);
    }
    await context.close();
  }
} finally {await browser.close()}
