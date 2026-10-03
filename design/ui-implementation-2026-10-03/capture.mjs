import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const dir='design/ui-implementation-2026-10-03';
await mkdir(dir,{recursive:true});
const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
 for(const [device,viewport] of Object.entries({phone:{width:390,height:844},tablet:{width:1024,height:768},landscape:{width:844,height:390}})){
  if(process.argv[2]&&process.argv[2]!==device)continue;
  const context=await browser.newContext({viewport,deviceScaleFactor:1,hasTouch:true,reducedMotion:'reduce',serviceWorkers:'block'});
  const page=await context.newPage();page.setDefaultTimeout(120000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.addInitScript(()=>{Math.random=()=>.1;Object.defineProperty(navigator,'hardwareConcurrency',{get:()=>4});Object.defineProperty(navigator,'deviceMemory',{get:()=>2});});
  await page.goto(process.env.UI_REVIEW_URL ?? 'http://127.0.0.1:4186/');
  await page.getByRole('button',{name:'Start playing',exact:true}).click();
  const shot=async name=>{await page.screenshot({path:`${dir}/${device}-${name}.png`});console.log(device,name);};
  await shot('map');
  for(const name of ['Moon','Earth','Sun']){
   await page.getByRole('button',{name:`Fly to ${name}`,exact:true}).click();
   await page.waitForFunction(()=>window.spaceNinjaSnapshot().phase==='arrived');
   await page.waitForTimeout(1500);
   await shot(name.toLowerCase());
   if(name==='Moon'){
    await page.getByRole('button',{name:'Listen',exact:true}).click();await shot('listen');await page.keyboard.press('Escape');
    const target=await page.evaluate(()=>window.spaceNinjaSnapshot().targets.find(t=>t.visible));await page.mouse.click(target.x,target.y);
    await page.locator('.photo-view.is-reward').waitFor();await shot('photo');await page.keyboard.press('Escape');
    await page.getByRole('button',{name:'Open your discovery journal'}).click();
    await page.locator('.sticker img').first().evaluate(i=>i.decode());await shot('journal');await page.keyboard.press('Escape');
   }
   if(name==='Earth'){
    await page.locator('.spin-btn').click();
    await page.waitForFunction(()=>window.spaceNinjaSnapshot().teachingSun?.visible);
    await page.waitForTimeout(900);await shot('day');await page.locator('.spin-btn').click();
   }
   await page.getByRole('button',{name:'Back to the space map',exact:true}).click();
   await page.getByRole('button',{name:'Fly to Moon',exact:true}).waitFor();
  }
  if(errors.length)throw Error(errors.join('\n'));
  await context.close();
 }
}finally{await browser.close();}
