import { test, expect, attachShot } from './fixtures';
import type { Page } from '@playwright/test';

const snapshot=(page:Page)=>page.evaluate(()=>(window as any).moonTrialSnapshot());
async function ready(page:Page){
  await page.goto('/?moontrial');
  await expect(page.locator('#boot')).toBeHidden();
}
async function explore(page:Page){
  await page.getByRole('button',{name:'Explore the Moon',exact:true}).click();
  await expect.poll(async()=>(await snapshot(page)).phase).toBe('explore');
}

test('Moon trial: touch flight, braking, photos, globe control and return',async({page},info)=>{
  const requested:string[]=[];page.on('request',request=>requested.push(request.url()));
  await ready(page);
  const saved=await page.evaluate(()=>JSON.stringify(localStorage));
  expect(requested.some(url=>url.endsWith('tycho-mountains.jpg'))).toBe(false);
  await attachShot(page,'moon-welcome',info);
  await explore(page);
  expect((await snapshot(page)).placeCount).toBe(6);
  await attachShot(page,'moon-orbit',info);
  const before=await snapshot(page);
  const size=page.viewportSize()!;
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:size.width*.65,y:size.height*.4,id:1}]});
  await expect.poll(async()=>(await snapshot(page)).speed).toBeGreaterThan(0.01);
  await expect.poll(async()=>Math.abs((await snapshot(page)).longitude-before.longitude)).toBeGreaterThan(0.3);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:size.width*.3,y:size.height*.38,id:1}]});
  await expect.poll(async()=>(await snapshot(page)).heading).toBeLessThan(0);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await expect.poll(async()=>(await snapshot(page)).speed).toBe(0);
  expect((await snapshot(page)).steering).toBe(false);
  await page.getByRole('button',{name:'Places',exact:true}).click();
  await attachShot(page,'moon-places',info);
  await page.getByRole('button',{name:'Tycho crater Mountains inside a crater'}).click();
  await expect.poll(async()=>(await snapshot(page)).navigating).toBe(false);
  await expect.poll(async()=>(await snapshot(page)).altitude).toBeCloseTo(.34,2);
  await attachShot(page,'moon-tycho-close-pass',info);
  await page.getByRole('button',{name:'Take a look',exact:true}).click();
  await expect(page.locator('.photo-viewport img')).toBeVisible();
  await expect.poll(()=>page.locator('.photo-viewport img').evaluate((img:HTMLImageElement)=>img.naturalWidth)).toBe(2560);
  await attachShot(page,'moon-tycho-photograph',info);
  const beforeModal=await snapshot(page);
  await page.keyboard.press('ArrowUp');
  expect((await snapshot(page)).latitude).toBe(beforeModal.latitude);
  for(let i=0;i<8;i++){
    await page.keyboard.press('Tab');
    expect(await page.locator('.photo-dialog').evaluate(el=>el.contains(document.activeElement))).toBe(true);
  }
  await page.getByRole('button',{name:'Look closer',exact:true}).click();
  await expect(page.locator('.photo-viewport')).toHaveClass(/is-zoomed/);
  await page.getByRole('button',{name:'Keep exploring',exact:true}).click();
  await expect(page.getByRole('button',{name:'Take a look',exact:true})).toBeFocused();
  await page.getByRole('button',{name:'Grown-up settings'}).click();
  await page.getByRole('button',{name:/Turn the globe Drag directly/}).click();
  await expect.poll(async()=>(await snapshot(page)).mode).toBe('drag');
  const dragStart=await snapshot(page);
  await page.mouse.move(size.width*.65,size.height*.46);await page.mouse.down();
  await page.mouse.move(size.width*.3,size.height*.46,{steps:15});await page.mouse.up();
  expect(Math.abs((await snapshot(page)).longitude-dragStart.longitude)).toBeGreaterThan(10);
  await attachShot(page,'moon-globe-control',info);
  await page.getByRole('button',{name:'Worlds',exact:true}).click();
  await expect(page.getByRole('button',{name:'Explore the Moon',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>JSON.stringify(localStorage))).toBe(saved);
  expect(requested.some(url=>url.endsWith('.mp3'))).toBe(false);
  expect(await page.evaluate(()=>navigator.serviceWorker.getRegistrations().then(r=>r.length))).toBe(0);
});

test('Moon trial: keyboard, height limits, modal interruption, resize and history suspension',async({page},info)=>{
  await ready(page);await explore(page);
  await page.locator('#scene').focus();
  const before=await snapshot(page);
  await page.keyboard.down('ArrowRight');
  await expect.poll(async()=>(await snapshot(page)).longitude).toBeGreaterThan(before.longitude+.2);
  await page.getByRole('button',{name:'Grown-up settings'}).click();
  expect((await snapshot(page)).speed).toBe(0);
  await page.keyboard.up('ArrowRight');await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Fly closer'}).click();
  await page.getByRole('button',{name:'Fly closer'}).click();
  await expect(page.getByRole('button',{name:'Fly closer'})).toBeDisabled();
  expect((await snapshot(page)).altitude).toBeGreaterThanOrEqual(.119);
  const frame=(await snapshot(page)).frame;
  await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));
  await page.waitForTimeout(150);
  const stopped=(await snapshot(page)).frame;
  await page.waitForTimeout(150);expect((await snapshot(page)).frame).toBe(stopped);
  expect(stopped).toBeGreaterThanOrEqual(frame);
  await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
  await expect.poll(async()=>(await snapshot(page)).frame).toBeGreaterThan(stopped);
  const size=page.viewportSize()!;
  await page.setViewportSize({width:size.height,height:size.width});
  await expect.poll(()=>page.locator('canvas').evaluate(el=>el.getBoundingClientRect().width)).toBe(size.height);
  const dock=await page.locator('.moon-dock').boundingBox();
  expect(dock!.x).toBeGreaterThanOrEqual(0);expect(dock!.x+dock!.width).toBeLessThanOrEqual(size.height);
  expect(dock!.y+dock!.height).toBeLessThan(size.width);
  await attachShot(page,'moon-resized',info);
});

test('Moon trial: failed detailed media stays intentional and escapable',async({page},info)=>{
  await page.route('**/tycho-mountains.jpg',route=>route.fulfill({status:200,contentType:'image/jpeg',body:'invalid photograph'}));
  await ready(page);await explore(page);
  await page.getByRole('button',{name:'Take a look',exact:true}).click();
  await expect(page.getByText('This photograph is unavailable. You can keep exploring.')).toBeVisible();
  await expect(page.locator('.photo-viewport img')).toBeHidden();
  await attachShot(page,'moon-photo-unavailable',info);
  await page.getByRole('button',{name:'Keep exploring',exact:true}).click();
  await page.getByRole('button',{name:'Worlds',exact:true}).click();
  await expect(page.getByRole('button',{name:'Explore the Moon',exact:true})).toBeVisible();
});
