import { test, expect, attachShot } from './fixtures';
import type { Page } from '@playwright/test';

const snapshot=(page:Page)=>page.evaluate(()=>(window as any).moonTrialSnapshot());

test('Earth offers an optional sunlight lesson that can be paused or left immediately',async({page},info)=>{
  await page.goto('/');await expect(page.locator('#boot')).toBeHidden();
  await page.getByRole('button',{name:'Earth Oceans & mountains',exact:true}).click();
  await page.getByRole('button',{name:'Explore Earth',exact:true}).click();
  await expect.poll(async()=>(await snapshot(page)).phase).toBe('explore');
  await expect(page.getByRole('button',{name:'Watch sunlight move across Earth',exact:true})).toBeVisible();
  await attachShot(page,'earth-sunlight-invitation',info);
  await page.getByRole('button',{name:'Watch sunlight move across Earth',exact:true}).click();
  await expect.poll(async()=>(await snapshot(page)).dayActive).toBe(true);
  await expect.poll(async()=>(await snapshot(page)).dayAngle).toBeGreaterThan(0.1);
  await attachShot(page,'earth-sunlight-moving',info);
  await page.getByRole('button',{name:'Pause sunlight moving across Earth',exact:true}).click();
  await expect.poll(async()=>(await snapshot(page)).dayActive).toBe(false);
  await page.getByRole('button',{name:'Watch sunlight move across Earth',exact:true}).click();
  await page.getByRole('button',{name:'Worlds',exact:true}).click();
  await expect(page.getByRole('button',{name:'Explore Earth',exact:true})).toBeVisible();
});
