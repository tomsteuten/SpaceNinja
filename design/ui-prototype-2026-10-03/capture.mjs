import { chromium } from '@playwright/test';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
const dir = new URL('./scenes/', import.meta.url);
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const earthOnly=process.argv.includes('--earth');
const results = earthOnly?JSON.parse(await readFile(new URL('./scenes.json',import.meta.url),'utf8')):{};
try {
  for (const [device, viewport] of Object.entries({ phone: {width:390,height:844}, tablet: {width:1024,height:768}, landscape:{width:844,height:390} })) {
    const context = await browser.newContext({ viewport, deviceScaleFactor:1, hasTouch:true, reducedMotion:'reduce', serviceWorkers:'block' });
    const page = await context.newPage();
    page.setDefaultTimeout(120000);
    const errors=[];
    page.on('pageerror', e=>errors.push(e.message));
    page.on('console', m=>{if(m.type()==='error')errors.push(m.text());});
    await page.addInitScript(()=>{Math.random=()=>0.1;Object.defineProperty(navigator,'hardwareConcurrency',{get:()=>4});Object.defineProperty(navigator,'deviceMemory',{get:()=>2});});
    await page.goto('http://127.0.0.1:4181/');
    await page.getByRole('button',{name:'Start playing',exact:true}).click();
    await page.waitForFunction(()=>Boolean(window.spaceNinjaSnapshot));
    const capture=async(state)=>{
      await page.screenshot({path:new URL(`current-${device}-${state}.png`,dir).pathname.replace(/^\/(\w:)/,'$1')});
      const style=await page.addStyleTag({content:'.ui {visibility:hidden!important}'});
      await page.waitForTimeout(100);
      await page.screenshot({path:new URL(`${device}-${state}.png`,dir).pathname.replace(/^\/(\w:)/,'$1')});
      results[`${device}-${state}`]=await page.evaluate(()=>window.spaceNinjaSnapshot());
      await style.evaluate(n=>n.remove());
      console.log(`Captured ${device} ${state}`);
    };
    if(!earthOnly)await capture('map');
    for (const world of earthOnly?['Earth']:['Moon','Earth','Sun']) {
      await page.getByRole('button',{name:`Fly to ${world}`,exact:true}).click();
      await page.waitForFunction(()=>window.spaceNinjaSnapshot().phase==='arrived');
      await page.waitForTimeout(1200);
      await capture(world.toLowerCase());
      if(world==='Earth'){
        await page.locator('.spin-btn').click();
        await page.waitForTimeout(1600);
        await capture('day');
        await page.locator('.spin-btn').click();
      }
      await page.getByRole('button',{name:'Back to the space map',exact:true}).click();
      await page.getByRole('button',{name:'Fly to Moon',exact:true}).waitFor();
    }
    if(errors.length)throw new Error(errors.join('\n'));
    await context.close();
  }
  await writeFile(new URL('./scenes.json',import.meta.url),JSON.stringify(results,null,2));
}finally{await browser.close();}
