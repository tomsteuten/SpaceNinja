import type { Page } from '@playwright/test';
import { test, expect, attachShot } from './fixtures';
const snapshot = (page: Page) => page.evaluate(() => (window as any).spaceNinjaSnapshot());
async function launch(page: Page, world: string) {
  await page.getByRole('button', {name:`Fly to ${world}`,exact:true}).click();
  await expect.poll(async () => (await snapshot(page)).phase).toBe('arrived');
  await expect(page.locator('.mission-hud')).toBeHidden();
  await expect.poll(async () => (await snapshot(page)).draws).toBeGreaterThan(0);
  const s = await snapshot(page);
  const visible = s.targets.filter((t:any) => t.visible);
  expect(visible).toHaveLength(2);
  const dock = await page.locator('.dock').boundingBox();
  for (const target of visible) {
    expect(target.x).toBeGreaterThan(10);
    expect(target.x).toBeLessThan(page.viewportSize()!.width - 10);
    expect(target.y).toBeGreaterThan(100);
    expect(target.y).toBeLessThan(dock!.y - 5);
  }
}
async function collectVisible(page: Page) {
  const s = await snapshot(page);
  const target = s.targets.find((t:any) => t.visible);
  expect(target).toBeTruthy();
  await page.mouse.click(target.x,target.y);
  await expect.poll(async () => (await snapshot(page)).collected).toBe(s.collected + 1);
}
async function keepExploring(page: Page) {
  await expect(page.locator('.photo-view.is-reward')).toBeVisible();
  await page.getByRole('button',{name:'Keep exploring'}).click();
  await expect(page.locator('.photo-view')).toBeHidden();
}
async function home(page: Page) {
  await page.getByRole('button',{name:'Fly Home',exact:true}).click();
  await expect(page.getByRole('button',{name:'Fly to Moon',exact:true})).toBeVisible();
}
test('rendered discoveries, drag, media, return, repeat and outer-world arrivals', async ({page}, info) => {
  await page.goto('/');
  await page.getByRole('button',{name:'Start playing',exact:true}).click();
  await expect(page.locator('#boot')).toBeHidden();
  await launch(page,'Moon');
  await attachShot(page, 'moon-arrival', info);
  const firstIds = (await snapshot(page)).ids;
  await collectVisible(page);
  await expect.poll(async () => (await snapshot(page)).guidedHunt).toBe(true);
  await expect(page.locator('.mission-hud')).toBeVisible();
  await expect(page.locator('.slot-row > *')).toHaveCount(3);
  // The first find is the postcard moment. Its photo is lazy, so the assertion waits for
  // the actual browser image rather than assuming a fast local disk/cache.
  await expect(page.locator('.photo-view.is-reward')).toBeVisible();
  await expect(page.getByRole('button',{name:'Keep exploring'})).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close the photo' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: 'Keep exploring' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Close the photo' })).toBeFocused();
  await expect.poll(() => page.locator('.photo-view__image').evaluate((img:HTMLImageElement)=>img.naturalWidth)).toBeGreaterThan(0);
  const detail = await page.locator('.photo-view__detail').boundingBox();
  const exit = await page.getByRole('button', { name: 'Keep exploring' }).boundingBox();
  expect(detail!.y + detail!.height, 'Postcard words must clear the exit').toBeLessThan(exit!.y);
  await attachShot(page, 'first-find-postcard', info);
  await page.keyboard.press('Escape');
  await expect(page.locator('.photo-view')).toBeHidden();
  await collectVisible(page);
  await keepExploring(page);
  await expect.poll(async () => (await snapshot(page)).hidden?.visible).toBe(false);
  // Pull from the indicated side. This is a real drag through OrbitInput.
  for(let attempt=0; attempt<8 && !(await snapshot(page)).targets.some((t:any)=>t.visible); attempt++) {
    const side = (await snapshot(page)).hidden.side;
    const {width,height}=page.viewportSize()!;
    await page.mouse.move(width/2, height*0.45);
    await page.mouse.down();
    await page.mouse.move(width/2-side*width*0.2,height*0.45,{steps:15});
    await page.mouse.up();
  }
  await collectVisible(page);
  await keepExploring(page);
  await expect(page.locator('.hint')).toContainText('Found!');
  await page.getByRole('button',{name:'Open your discovery journal'}).click();
  await expect(page.locator('.collection-progress')).toContainText('3/6');
  const tiles=page.locator('.sticker-grid button');
  let photoFound=false;
  for(let i=0; i<await tiles.count(); i++) {
    await tiles.nth(i).click();
    const photo=page.getByRole('button',{name:'See a photo of this discovery'});
    try { await photo.waitFor({state:'visible',timeout:3000}); } catch { continue; }
    await photo.click();
    await expect(page.locator('.photo-view')).toBeVisible();
    await expect.poll(() => page.locator('.photo-view__image').evaluate((img:HTMLImageElement)=>img.naturalWidth)).toBeGreaterThan(0);
    await attachShot(page, 'journal-photo', info);
    await expect(page.getByRole('button',{name:'Close the photo'})).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(photo).toBeFocused();
    await page.getByRole('button',{name:'Read this discovery out loud'}).click();
    await expect(page.getByRole('button',{name:'Stop reading discovery'})).toBeVisible();
    photoFound=true; break;
  }
  expect(photoFound,'The deterministic smoke visit must exercise a real photo').toBe(true);
  await page.getByRole('button',{name:'Close',exact:true}).click();
  await home(page);
  await launch(page,'Moon');
  expect((await snapshot(page)).ids.some((id:string)=>!firstIds.includes(id))).toBe(true);
  await home(page);
  await launch(page,'Mars'); await home(page);
  await launch(page,'Saturn');
  await attachShot(page, 'saturn-arrival', info);
  await home(page);
  await launch(page,'Earth');
  await page.setViewportSize({width:768,height:1024});
  await expect.poll(async () => (await snapshot(page)).bodyScreenRadius).toBeGreaterThan(110);
  await attachShot(page, 'earth-after-resize', info);
  await home(page);

});
