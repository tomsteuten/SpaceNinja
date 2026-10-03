import { chromium } from '@playwright/test';
const browser = await chromium.launch({ args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
try {
  for (const [device, viewport] of Object.entries({phone:{width:390,height:844},tablet:{width:1024,height:768},landscape:{width:844,height:390}})) {
    const context = await browser.newContext({viewport,deviceScaleFactor:1,hasTouch:true,reducedMotion:'reduce',serviceWorkers:'block'});
    const page = await context.newPage(); page.setDefaultTimeout(120000);
    await page.addInitScript(() => { Math.random=()=>.1; Object.defineProperty(navigator,'hardwareConcurrency',{get:()=>4}); Object.defineProperty(navigator,'deviceMemory',{get:()=>2}); });
    await page.goto(process.env.UI_BASELINE_URL ?? 'http://127.0.0.1:4185/');
    await page.getByRole('button',{name:'Start playing',exact:true}).click();
    await page.getByRole('button',{name:'Fly to Moon',exact:true}).click();
    await page.waitForFunction(()=>window.spaceNinjaSnapshot().phase==='arrived');
    await page.getByRole('button',{name:'Show words',exact:true}).click();
    const shot=async state=>page.screenshot({path:`design/ui-implementation-2026-10-03/before-${device}-${state}.png`});
    await shot('listen');
    await page.getByRole('button',{name:'Hide words',exact:true}).click();
    const target=await page.evaluate(()=>window.spaceNinjaSnapshot().targets.find(t=>t.visible));
    await page.mouse.click(target.x,target.y);
    await page.locator('.photo-view.is-reward').waitFor(); await shot('photo'); await page.keyboard.press('Escape');
    await page.getByRole('button',{name:'Open your discovery journal'}).click(); await shot('journal');
    await context.close(); console.log(`Baseline panels: ${device}`);
  }
} finally { await browser.close(); }
