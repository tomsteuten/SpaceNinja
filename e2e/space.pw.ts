import { test,expect,attachShot } from './fixtures';
import type { Page } from '@playwright/test';
const snapshot=(page:Page)=>page.evaluate(()=>(window as any).moonTrialSnapshot());

test('space: real touch steering, braking, help, interruption and world exploration',async({page},info)=>{
  await page.goto('/');await expect(page.locator('#boot')).toBeHidden();
  await attachShot(page,'space-launch-chooser',info);
  await page.getByRole('button',{name:'Fly into space',exact:true}).filter({visible:true}).click();
  await expect.poll(async()=>(await snapshot(page)).phase).toBe('space');
  const dock=await page.locator('.space-dock').boundingBox();const size=page.viewportSize()!;
  expect(dock!.x).toBeGreaterThanOrEqual(0);expect(dock!.x+dock!.width).toBeLessThanOrEqual(size.width);
  await attachShot(page,'space-playground',info);
  const cdp=await page.context().newCDPSession(page);
  const before=(await snapshot(page)).space;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:size.width*.5,y:size.height*.5,id:1}]});
  await expect.poll(async()=>(await snapshot(page)).space.z).toBeGreaterThan(before.z+.5);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:size.width*.7,y:size.height*.42,id:1}]});
  await expect.poll(async()=>(await snapshot(page)).space.yaw).toBeLessThan(-.15);
  await attachShot(page,'space-rocket-steering',info);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await expect.poll(async()=>(await snapshot(page)).space.speed).toBe(0);
  await page.getByRole('button',{name:'Fly to Moon',exact:true}).click();
  if(!(await snapshot(page)).reducedMotion){
    await expect.poll(async()=>(await snapshot(page)).space.target).toBe('moon');
    await page.locator('#scene').focus();await page.keyboard.down('ArrowLeft');
    await expect.poll(async()=>(await snapshot(page)).space.target).toBeNull();await page.keyboard.up('ArrowLeft');
    await page.getByRole('button',{name:'Fly to Moon',exact:true}).click();
    await page.getByRole('button',{name:'Grown-up settings'}).click();
    expect((await snapshot(page)).space.speed).toBe(0);expect((await snapshot(page)).space.target).toBeNull();
    await page.keyboard.press('Escape');
    await page.getByRole('button',{name:'Fly to Moon',exact:true}).click();
  }
  await expect(page.locator('.space-enter')).toHaveText('Explore the Moon');
  await expect(page.locator('.space-enter')).toBeVisible();
  await attachShot(page,'space-moon-arrival',info);
  await page.locator('.space-enter').click();
  await expect.poll(async()=>(await snapshot(page)).phase).toBe('explore');
  expect((await snapshot(page)).world).toBe('moon');
  await attachShot(page,'space-rocket-over-moon',info);
  await page.getByRole('button',{name:'Places',exact:true}).click();
  await expect(page.locator('.place-option')).toHaveCount(6);await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Fly into space',exact:true}).filter({visible:true}).click();
  await expect.poll(async()=>(await snapshot(page)).phase).toBe('space');
  await page.getByRole('button',{name:'Worlds',exact:true}).click();
  await expect(page.locator('.moon-launch')).toBeVisible();
});

test('space: reduced-motion assistance reaches all four worlds without an automatic sweep',async({page},info)=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/');await expect(page.locator('#boot')).toBeHidden();
  await page.locator('.moon-launch').click();
  for(const name of ['Earth','Moon','Mars','Saturn']) {
    await page.getByRole('button',{name:`Fly to ${name}`,exact:true}).click();
    await expect.poll(async()=>(await snapshot(page)).space.nearby).toBe(name.toLowerCase());
    expect((await snapshot(page)).space.target).toBeNull();expect((await snapshot(page)).space.speed).toBe(0);
    await expect(page.locator('.space-enter')).toBeVisible();
  }
  await attachShot(page,'space-saturn',info);
  await page.locator('.space-enter').click();await expect.poll(async()=>(await snapshot(page)).phase).toBe('explore');
  expect((await snapshot(page)).world).toBe('saturn');
});
