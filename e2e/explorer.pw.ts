import { test,expect,attachShot } from './fixtures';
const snapshot=(page:any)=>page.evaluate(()=>(window as any).moonTrialSnapshot());

test('all worlds: selection, six places, archive image and a clear way home',async({page},info)=>{
  await page.goto('/');
  await expect(page.locator('#boot')).toBeHidden();
  const saved=await page.evaluate(()=>JSON.stringify(localStorage));
  for(const id of ['earth','moon','mars','saturn']){
    await page.locator('[data-world="'+id+'"]').click();
    await expect.poll(async()=>(await snapshot(page)).worldReady).toBe(true);
    expect((await snapshot(page)).renderedWorld).toBe(id);
    await attachShot(page,id+'-chooser',info);
    await page.locator('.moon-start').click();
    await expect.poll(async()=>(await snapshot(page)).phase).toBe('explore');
    await attachShot(page,id+'-exploring',info);
    await page.getByRole('button',{name:'Places',exact:true}).click();
    await expect(page.locator('.place-option')).toHaveCount(6);
    await page.locator('.place-option').last().click();
    await expect.poll(async()=>(await snapshot(page)).navigating).toBe(false);
    await page.getByRole('button',{name:'Take a look',exact:true}).click();
    await expect(page.locator('.photo-viewport img')).toBeVisible();
    expect(await page.locator('.photo-source').getAttribute('href')).toMatch(/^https:\/\/.+\/.+/);
    await page.getByRole('button',{name:'Keep exploring',exact:true}).click();
    await page.getByRole('button',{name:'Worlds',exact:true}).click();
    await expect(page.locator('.moon-start')).toBeVisible();
  }
  expect(await page.evaluate(()=>JSON.stringify(localStorage))).toBe(saved);
});

test('slow and failed world loads cannot start the wrong globe',async({page})=>{
  let release!:()=>void;
  const held=new Promise<void>(resolve=>{release=resolve;});
  await page.route('**/assets/mars.jpg',async route=>{await held;await route.continue();});
  await page.goto('/'); await expect(page.locator('#boot')).toBeHidden();
  await page.locator('[data-world="mars"]').click();
  await expect(page.locator('.moon-start')).toBeDisabled();
  await page.locator('[data-world="moon"]').click();
  await expect(page.locator('.moon-start')).toBeEnabled();
  release();
  await expect.poll(async()=>(await snapshot(page)).renderedWorld).toBe('moon');
  await page.locator('.moon-start').click();
  await expect.poll(async()=>(await snapshot(page)).phase).toBe('explore');
  expect((await snapshot(page)).world).toBe('moon');
  await page.getByRole('button',{name:'Worlds',exact:true}).click();
  await page.route('**/assets/saturn.jpg',route=>route.fulfill({status:200,body:'invalid image'}));
  await page.locator('[data-world="saturn"]').click();
  await expect(page.getByText('This world could not open. Try it again or choose another.')).toBeVisible();
  await expect(page.locator('.moon-start')).toBeDisabled();
  await page.locator('[data-world="earth"]').click();
  await expect(page.locator('.moon-start')).toBeEnabled();
  expect((await snapshot(page)).renderedWorld).toBe('earth');
});
