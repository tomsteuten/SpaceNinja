// Run against `npm run preview -- --port 5182`; this uses the real production worker.
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const url=process.argv[2]??'http://127.0.0.1:5182/';
const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
  const context=await browser.newContext({viewport:{width:1024,height:768},deviceScaleFactor:0.5,reducedMotion:'reduce'});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(url);
  await page.locator('#boot').waitFor({state:'hidden'});
  assert.equal(await page.evaluate(()=>typeof window.moonTrialSnapshot),'undefined');
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
  await page.waitForFunction(()=>navigator.serviceWorker.controller!==null);
  const cached=await page.evaluate(async()=>{
    const keys=await (await caches.open('spaceninja-media-v1')).keys();
    return keys.map(request=>new URL(request.url).pathname);
  });
  assert(cached.some(path=>path.endsWith('/moon-trial/moon-color.jpg')));
  assert(!cached.some(path=>path.includes('/discoveries/')),'Discovery photos must remain lazy');
  assert(!cached.some(path=>path.endsWith('/tycho-mountains.jpg')));
  await page.locator('[data-world="moon"]').click();
  await page.locator('.moon-start:enabled').click();
  await page.locator('.moon-dock').waitFor({state:'visible'});
  await page.getByRole('button',{name:'Take a look',exact:true}).click();
  await page.locator('.photo-viewport img').waitFor({state:'visible'});
  await page.waitForFunction(async()=>Boolean(await caches.match(new URL('./assets/moon-trial/tycho-mountains.jpg',location.href).href)));
  await context.setOffline(true);
  await page.reload();
  await page.locator('#boot').waitFor({state:'hidden'});
  for(const id of ['moon','mars','saturn','earth']){
    await page.locator('[data-world="'+id+'"]').click();
    await page.locator('.moon-start:enabled').click();
    await page.locator('.moon-dock').waitFor({state:'visible'});
    if(id==='moon') {
      await page.getByRole('button',{name:'Take a look',exact:true}).click();
      await page.locator('.photo-viewport img').waitFor({state:'visible'});
      assert.equal(await page.locator('.photo-viewport img').evaluate(img=>img.naturalWidth),2560);
      await page.getByRole('button',{name:'Keep exploring',exact:true}).click();
    }
    await page.getByRole('button',{name:'Worlds',exact:true}).click();
  }
  assert.deepEqual(errors,[]);
  console.log('Production verified: no test hook; all four worlds reopen offline; photos stay lazy; opened Tycho image survives offline reload.');
} finally { await browser.close(); }
