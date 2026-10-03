import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const dir=new URL('./review/',import.meta.url);await mkdir(dir,{recursive:true});
const browser=await chromium.launch();
const results=[];
try{
for(const[device,viewport]of Object.entries({phone:{width:390,height:844},tablet:{width:1024,height:768},landscape:{width:844,height:390}})){
const context=await browser.newContext({viewport,deviceScaleFactor:1,reducedMotion:'reduce',hasTouch:true});const page=await context.newPage();const errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
for(const state of ['moon','earth','sun','map','photo','day']){
await page.goto(`http://127.0.0.1:4181/design/ui-prototype-2026-10-03/scene.html?state=${state}`);
await page.waitForFunction(()=>{const i=document.querySelector('#background');return i.complete&&i.naturalWidth>0});
if(state==='photo')await page.waitForFunction(()=>document.querySelector('.photo')?.naturalWidth>0);
const metrics=await page.evaluate(()=>{
const boxes=[...document.querySelectorAll('.rail .control')].map(b=>{const r=b.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height}});
const visible=[...document.querySelectorAll('button')].filter(b=>b.getClientRects().length&&!b.closest('[inert]')).map(b=>{const r=b.getBoundingClientRect();return{label:b.textContent.trim()||b.getAttribute('aria-label'),x:r.x,y:r.y,w:r.width,h:r.height};});
return{boxes,overflow:document.documentElement.scrollWidth>innerWidth,visible};});
if(metrics.overflow)throw Error(`${device} ${state}: document overflow`);
for(const b of metrics.visible)if(b.x<-.1||b.y<-.1||b.x+b.w>viewport.width+.1||b.y+b.h>viewport.height+.1)throw Error(`${device} ${state}: offscreen ${b.label}`);
if(state!=='map'&&metrics.boxes.length){const a=metrics.boxes[0];for(const b of metrics.boxes)if(Math.abs(b.y-a.y)>.2||Math.abs(b.w-a.w)>.2||Math.abs(b.h-a.h)>.2)throw Error(`${device} ${state}: unaligned controls`);}
await page.screenshot({path:new URL(`${device}-${state}.png`,dir).pathname.replace(/^\/(\w:)/,'$1')});
results.push({device,state,aligned:true,onscreen:true,buttons:metrics.visible.length});
}
await page.goto('http://127.0.0.1:4181/design/ui-prototype-2026-10-03/scene.html?state=moon');
await page.getByRole('button',{name:'Open discovery',exact:false}).first().click();
await page.getByRole('button',{name:'Keep exploring'}).click();
await page.getByRole('button',{name:'Listen',exact:true}).click();
await page.getByRole('dialog').waitFor();
await page.screenshot({path:new URL(`${device}-listen.png`,dir).pathname.replace(/^\/(\w:)/,'$1')});
await page.keyboard.press('Escape');
await page.getByRole('button',{name:'Journal',exact:true}).click();
await page.locator('.postcard img').evaluate(i=>i.decode());
await page.screenshot({path:new URL(`${device}-journal.png`,dir).pathname.replace(/^\/(\w:)/,'$1')});
await page.getByRole('button',{name:'First footprints'}).click();
await page.getByRole('button',{name:'Back to journal',exact:true}).click();
await page.getByRole('button',{name:'Keep exploring'}).click();
await page.getByRole('button',{name:'Space map',exact:true}).click();
await page.getByRole('button',{name:'Sun',exact:true}).click();
if(await page.getByRole('button',{name:'Day & night',exact:true}).count())throw Error('Sun has an unsupported activity');
await page.getByRole('button',{name:'Space map',exact:true}).click();
await page.getByRole('button',{name:'Earth',exact:true}).click();
await page.getByRole('button',{name:'Day & night',exact:true}).click();
await page.getByRole('button',{name:'Stop',exact:true}).click();
await page.getByRole('button',{name:'Space map',exact:true}).click();
for(const s of ['earth','day']){
await page.goto(`http://127.0.0.1:4181/design/ui-prototype-2026-10-03/scene.html?state=${s}&version=current`);
await page.waitForFunction(()=>{const i=document.querySelector('#background');return i.complete&&i.naturalWidth>0});
}
if(errors.length)throw Error(errors.join('\n'));
console.log(`${device}: 6 views captured; pictured return, journal, Listen/Escape, map, Sun and day/stop passed`);
await context.close();
}
const page=await browser.newPage({viewport:{width:1280,height:1050}});
await page.goto('http://127.0.0.1:4181/design/ui-prototype-2026-10-03/index.html');
await page.frameLocator('iframe').getByRole('button',{name:'Space map',exact:true}).waitFor();
await page.getByRole('button',{name:'Phone',exact:true}).click();
await page.getByRole('button',{name:'Photo exit',exact:true}).click();
await page.frameLocator('iframe').getByRole('button',{name:'Keep exploring'}).waitFor();
await page.getByRole('button',{name:'Current',exact:true}).click();
await page.frameLocator('iframe').locator('#background').evaluate(i=>i.decode());
await page.getByRole('button',{name:'Proposed',exact:true}).click();
await page.getByRole('button',{name:'Tablet',exact:true}).click();
await page.getByRole('button',{name:'Moon',exact:true}).click();
await page.frameLocator('iframe').locator('#background').evaluate(i=>i.decode());
await page.frameLocator('iframe').locator('.rail').waitFor();
await page.screenshot({path:new URL('review-page.png',dir).pathname.replace(/^\/(\w:)/,'$1')});
await page.close();
await writeFile(new URL('./verification.json',import.meta.url),JSON.stringify({results,errors:[],scope:'Prototype UI only; no game behavior or physical device claims'},null,2));
}finally{await browser.close();}
