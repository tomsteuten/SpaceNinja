// State-change audit captures (design/state-audit): every moment a child's game changes state,
// shot just before and after, with the on-screen UI state written beside each picture.
// Skipped unless STYLE_OUT is set: STYLE_OUT=design/state-audit/shots npx playwright test e2e/state-audit.pw.ts --project=phone
// Runs both viewports (phone, tablet portrait) whichever project is named. Motion is left on,
// as on the owner's tablet, so the shots show what a child sees mid-transition.
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DESTINATIONS, DISCOVERIES } from '../src/config';

const OUT = process.env.STYLE_OUT ?? '';
test.skip(!OUT, 'Set STYLE_OUT to capture.');
const snapshot = (page: Page) => page.evaluate(() => (window as any).spaceNinjaSnapshot());

async function start(page: Page, query = '/?fast', progress?: object, sound = 'on') {
  mkdirSync(OUT, { recursive: true });
  await page.addInitScript(([saved, sound]) => {
    Math.random = () => 0.1;
    localStorage.setItem('spaceninja.sound.v1', sound as string);
    if (saved) localStorage.setItem('spaceninja.progress.v1', saved);
  }, [progress ? JSON.stringify(progress) : null, sound] as const);
  await page.goto(query);
}

/** What is on screen, in words, for the findings table. */
function uiState(page: Page) {
  return page.evaluate(() => {
    const ui = document.getElementById('ui')!;
    const shown = (e: Element) => {
      const r = (e as HTMLElement).getBoundingClientRect(); const s = getComputedStyle(e as HTMLElement);
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05;
    };
    const text = (sel: string) => { const e = document.querySelector(sel); return e && shown(e) ? (e.textContent ?? '').trim() : null; };
    return {
      root: ui.className,
      hint: text('.hint'),
      heading: text('.world-heading'),
      caption: text('.mission-caption'),
      fact: text('.fact-card'),
      destinations: [...document.querySelectorAll('.destination-choice')].filter(shown)
        .map(b => `${(b as HTMLElement).dataset.destination}:${b.className.replace('destination-choice', '').trim() || 'plain'}`),
      row: [...document.querySelectorAll('.visit-actions > .btn')].filter(shown)
        .map(b => `${(b.textContent ?? '').trim()}${b.className.includes('is-appearing') ? '(popping)' : ''}`),
      overlays: ['.photo-view', '.journal-panel', '.finale', '.award', '.moon-jump', '.bedtime-spin', '.saturn-bath', '.mars-rover', '.hunt-arrow', '.coach-hand, .coach']
        .filter(sel => { const e = document.querySelector(sel); return e && shown(e); }),
      toyCaption: text('.mars-rover__caption') ?? text('.moon-jump__caption') ?? text('.saturn-bath__caption') ?? text('.bedtime-spin__caption'),
    };
  });
}

/** Find the next place (turning by the arrow if it is round the back); the postcard is left open. */
async function tapNext(page: Page) {
  const found = (await snapshot(page)).collected;
  for (let attempt = 0; attempt < 3 && (await snapshot(page)).collected === found; attempt++) {
    let target = (await snapshot(page)).targets.find((t: any) => t.visible);
    if (!target) {
      await page.locator('.hunt-arrow').click();
      await expect.poll(async () => (await snapshot(page)).targets.some((t: any) => t.visible)).toBe(true);
      target = (await snapshot(page)).targets.find((t: any) => t.visible);
    }
    await page.mouse.click(target.x, target.y);
    await expect.poll(async () => (await snapshot(page)).collected, { timeout: 10000 }).toBe(found + 1).catch(() => {});
  }
  expect((await snapshot(page)).collected).toBe(found + 1);
}

async function closePostcard(page: Page) {
  await expect(page.locator('.photo-view')).toBeVisible({ timeout: 8000 }).catch(() => {});
  if (await page.locator('.photo-view').isVisible()) {
    await page.waitForTimeout(650);
    await page.getByRole('button', { name: 'Keep exploring' }).click();
    await expect(page.locator('.photo-view')).toBeHidden();
  }
}

async function backToMap(page: Page) {
  await page.locator('.visit-actions .home-btn').click();
  await expect(page.locator('.destination-bar')).toBeVisible({ timeout: 120000 });
  await expect.poll(async () => (await snapshot(page)).phase, { timeout: 120000 }).toBe('idle');
}

async function flyTo(page: Page, world: string) {
  await expect.poll(async () => (await snapshot(page)).mapReturnGuarded ?? false).toBe(false);
  await page.getByRole('button', { name: `Fly to ${world}`, exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).phase, { timeout: 200000 }).toBe('arrived');
}

for (const [name, viewport] of [
  ['phone', { width: 390, height: 844 }],
  ['tablet', { width: 768, height: 1024 }],
] as const) {
  test.describe(name, () => {
    test.use({ viewport, deviceScaleFactor: 1, reducedMotion: 'no-preference', hasTouch: false });

    function recorder(page: Page, file: string) {
      const log: Record<string, unknown> = {};
      const shot = async (id: string) => {
        await page.screenshot({ path: join(OUT, `${name}-${id}.png`), timeout: 60000 });
        log[id] = await uiState(page);
        writeFileSync(join(OUT, `${name}-${file}.json`), JSON.stringify(log, null, 1));
      };
      return shot;
    }

    // States 1–9 as a brand-new child meets them: splash, map, Earth, the Moon, back to the map.
    test(`first run ${name}`, async ({ page }) => {
      test.setTimeout(900000);
      const shot = recorder(page, 'first-run');
      await start(page);
      await expect(page.getByRole('button', { name: 'Start playing', exact: true })).toBeVisible();
      await page.waitForTimeout(800);
      await shot('a01-splash');
      await page.getByRole('button', { name: 'Start playing', exact: true }).click();
      await expect(page.locator('.destination-bar')).toBeVisible();
      await page.waitForTimeout(1500);
      await shot('a02-map-first');
      // A locked world, then the hint once it has settled back.
      await page.locator('.destination-choice[data-destination="mars"]').click();
      await page.waitForTimeout(250);
      await shot('a03-locked-tap');
      await page.waitForTimeout(3200);
      await shot('a04-locked-after');
      // A miss: empty sky near the top.
      await page.mouse.click(viewport.width * 0.85, viewport.height * 0.3);
      await page.waitForTimeout(120);
      await shot('a05-miss');

      await page.getByRole('button', { name: 'Fly to Earth', exact: true }).click();
      await expect.poll(async () => (await snapshot(page)).phase, { timeout: 200000 }).toBe('arrived');
      await page.waitForTimeout(1500);
      await shot('b01-earth-welcome');
      await page.waitForTimeout(6000);
      await shot('b02-earth-welcome-later');

      await page.locator('.spin-btn').click();
      const toy = page.locator('.bedtime-spin');
      await expect(toy).toBeVisible();
      await page.waitForTimeout(1200);
      await shot('b03-bedtime-open');
      for (let i = 0; i < 3; i++) { await toy.getByRole('button', { name: 'Turn Earth' }).click(); await page.waitForTimeout(900); }
      await page.waitForTimeout(1200);
      await shot('b04-bedtime-night');
      for (let i = 0; i < 5; i++) { await toy.getByRole('button', { name: 'Turn Earth' }).click(); await page.waitForTimeout(900); }
      await page.waitForTimeout(1500);
      await shot('b05-bedtime-morning');
      await toy.getByRole('button', { name: 'Back to Earth' }).click();
      await expect(toy).toHaveCount(0);
      await page.waitForTimeout(2500);
      await shot('b06-earth-after-bedtime');

      await tapNext(page);
      await page.waitForTimeout(400);
      await shot('b07-find1-label');
      await expect(page.locator('.photo-view')).toBeVisible({ timeout: 8000 });
      await page.waitForTimeout(1200);
      await shot('b08-postcard1');
      await closePostcard(page);
      await page.waitForTimeout(800);
      await shot('b09-after-postcard1');
      await tapNext(page); await closePostcard(page);
      await page.waitForTimeout(800);
      await shot('b10-after-find2');
      await tapNext(page);
      await expect(page.locator('.photo-view')).toBeVisible({ timeout: 8000 });
      await page.waitForTimeout(1200);
      await shot('b11-postcard3');
      await closePostcard(page);
      await page.waitForTimeout(150);
      await shot('b12-after-find3');
      await page.waitForTimeout(5000);
      await shot('b13-after-find3-later');

      await page.locator('.visit-actions .journal-btn').click();
      await expect(page.locator('.journal-panel')).toBeVisible();
      await page.waitForTimeout(1000);
      await shot('b14-journal');
      await page.waitForTimeout(650);
      await page.keyboard.press('Escape');
      await expect(page.locator('.journal-panel')).toBeHidden();
      await page.waitForTimeout(800);
      await shot('b15-after-journal');

      await page.locator('.visit-actions .home-btn').click();
      await page.waitForTimeout(400);
      await shot('c01-returning');
      await expect(page.locator('.destination-bar')).toBeVisible({ timeout: 120000 });
      await expect.poll(async () => (await snapshot(page)).phase, { timeout: 120000 }).toBe('idle');
      await page.waitForTimeout(300);
      await shot('c02-map-after-earth');
      await page.waitForTimeout(5000);
      await shot('c03-map-after-earth-later');

      await flyTo(page, 'Moon');
      await page.waitForTimeout(400);
      await shot('d01-moon-arrival');
      await page.waitForTimeout(5000);
      await shot('d02-moon-arrival-later');
      await tapNext(page); await closePostcard(page);
      await tapNext(page); await closePostcard(page);
      await tapNext(page);
      await expect(page.locator('.photo-view')).toBeVisible({ timeout: 8000 });
      await page.waitForTimeout(1000);
      await closePostcard(page);
      await page.waitForTimeout(150);
      await shot('d03-toy-popping');
      await page.waitForTimeout(4000);
      await shot('d04-toy-next');
      await page.locator('.jump-btn').click();
      await page.waitForTimeout(1000);
      await shot('d05-jump-open');
      await page.locator('.moon-jump__jump').click();
      await page.waitForTimeout(1700);
      await shot('d06-jump-mid');
      await page.waitForTimeout(5000);
      await shot('d07-jump-after');
      await page.getByRole('button', { name: 'Back to the Moon' }).click();
      await page.waitForTimeout(200);
      await shot('d08-after-jump');
      await page.waitForTimeout(3000);
      await shot('d09-after-jump-later');

      await backToMap(page);
      await page.waitForTimeout(300);
      await shot('e01-map-after-moon');
      await page.waitForTimeout(1500);
      await shot('e02-map-after-moon-2s');
      await page.waitForTimeout(4000);
      await shot('e03-map-after-moon-6s');
      await page.waitForTimeout(12000);
      await shot('e04-map-after-moon-18s');
      await flyTo(page, 'Mars');
      await page.waitForTimeout(800);
      await shot('e05-mars-first-arrival');
      await page.waitForTimeout(5000);
      await shot('e06-mars-first-arrival-later');
    });

    // Mars rover and Saturn bath, then the map after each.
    test(`outer worlds ${name}`, async ({ page }) => {
      test.setTimeout(900000);
      const shot = recorder(page, 'outer');
      await start(page, '/?fast', { visited: ['earth', 'moon'], discoveries: [], stickers: [] });
      await page.getByRole('button', { name: 'Start playing', exact: true }).click();
      await expect(page.locator('.destination-bar')).toBeVisible();
      await page.waitForTimeout(1500);
      await shot('f01-map-mars-offered');
      await flyTo(page, 'Mars');
      for (let i = 0; i < 3; i++) { await tapNext(page); await closePostcard(page); }
      await page.waitForTimeout(3000);
      await shot('f02-mars-toy-next');
      await page.locator('.rover-btn').click();
      const rover = page.locator('.mars-rover');
      await expect(rover).toBeVisible();
      await page.waitForTimeout(1000);
      await shot('f03-rover-open');
      await rover.locator('.mars-rover__key--right').click();
      await page.waitForTimeout(300);
      await shot('f04-rover-first-press');
      await page.waitForTimeout(1500);
      await shot('f05-rover-waiting');
      await expect.poll(async () => rover.getAttribute('data-busy'), { timeout: 60000 }).toBe('').catch(() => {});
      await shot('f06-rover-moved');
      // A child mashing arrows: what does the screen show?
      for (const move of ['up', 'up', 'right', 'right', 'down', 'left', 'up', 'up', 'up']) await rover.locator(`.mars-rover__key--${move}`).click();
      await page.waitForTimeout(400);
      await shot('f07-rover-mashed');
      await rover.locator('.mars-rover__drill').click();
      await page.waitForTimeout(6000);
      await shot('f08-rover-mashed-later');
      await expect.poll(async () => rover.getAttribute('data-flying'), { timeout: 90000 }).toBe('0').catch(() => {});
      await expect.poll(async () => rover.getAttribute('data-busy'), { timeout: 90000 }).toBe('').catch(() => {});
      await shot('f09-rover-settled');
      await rover.getByRole('button', { name: 'Back to Mars' }).click();
      await page.waitForTimeout(2500);
      await shot('f10-after-rover');

      await backToMap(page);
      await page.waitForTimeout(300);
      await shot('g01-map-after-mars');
      await page.waitForTimeout(5000);
      await shot('g02-map-after-mars-later');
      await flyTo(page, 'Saturn');
      await page.waitForTimeout(2500);
      await shot('g03-saturn-arrival');
      for (let i = 0; i < 3; i++) { await tapNext(page); await closePostcard(page); }
      await page.waitForTimeout(3000);
      await shot('g04-saturn-toy-next');
      await page.locator('.bath-btn').click();
      const bath = page.locator('.saturn-bath');
      await page.waitForTimeout(1000);
      await shot('g05-bath-open');
      for (let i = 0; i < 4; i++) { await bath.locator('.saturn-bath__plop').click(); await page.waitForTimeout(400); }
      await expect(bath).toHaveAttribute('data-floating', 'saturn', { timeout: 60000 });
      await page.waitForTimeout(800);
      await shot('g06-bath-floating');
      await bath.getByRole('button', { name: 'Back to Saturn' }).click();
      await page.waitForTimeout(2500);
      await shot('g07-after-bath');
      await backToMap(page);
      await page.waitForTimeout(300);
      await shot('g08-map-after-saturn');
      await page.waitForTimeout(5000);
      await shot('g09-map-after-saturn-later');
    });

    // The full-length flight and the pull-back home.
    test(`flight ${name}`, async ({ page }) => {
      test.setTimeout(900000);
      const shot = recorder(page, 'flight');
      await start(page, '/', { visited: ['earth'], discoveries: [], stickers: [] });
      await page.getByRole('button', { name: 'Start playing', exact: true }).click();
      await expect(page.locator('.destination-bar')).toBeVisible();
      await page.waitForTimeout(1500);
      await page.getByRole('button', { name: 'Fly to Moon', exact: true }).click();
      await page.waitForTimeout(1500);
      await shot('h01-flight-start');
      await page.waitForTimeout(15000);
      await shot('h02-flight-mid');
      await expect.poll(async () => (await snapshot(page)).phase, { timeout: 300000 }).toBe('arrived');
      await page.waitForTimeout(500);
      await shot('h03-flight-landed');
      await page.locator('.visit-actions .home-btn').click();
      await page.waitForTimeout(3000);
      await shot('h04-pullback');
      await expect.poll(async () => (await snapshot(page)).phase, { timeout: 300000 }).toBe('idle');
      await page.waitForTimeout(500);
      await shot('h05-home-after-early-exit');
    });

    test(`finale ${name}`, async ({ page }) => {
      test.setTimeout(600000);
      const shot = recorder(page, 'finale');
      const moon = DESTINATIONS.moon!.mission!.discoveries.map((d) => d.id);
      const all = Object.keys(DISCOVERIES).filter((id) => id !== moon[moon.length - 1]);
      await start(page, '/?fast', { discoveries: all, stickers: [], visited: Object.keys(DESTINATIONS) });
      await page.getByRole('button', { name: 'Start playing', exact: true }).click();
      await expect(page.locator('.destination-bar')).toBeVisible();
      await page.waitForTimeout(1500);
      await shot('i01-map-before-finale');
      await flyTo(page, 'Moon');
      for (let i = 0; i < 3; i++) {
        let target = (await snapshot(page)).targets.find((t: any) => t.visible);
        if (!target) {
          await expect(page.locator('.hunt-arrow')).toBeVisible();
          await page.waitForTimeout(800);
          await shot('i02-hunt-arrow');
          await page.locator('.hunt-arrow').click();
          await expect.poll(async () => (await snapshot(page)).targets.some((t: any) => t.visible)).toBe(true);
          target = (await snapshot(page)).targets.find((t: any) => t.visible);
        }
        await page.mouse.click(target.x, target.y);
        await expect.poll(async () => (await snapshot(page)).collected).toBe(i + 1);
        if (i === 0) { await page.waitForTimeout(300); await shot('i03-revisited-find'); }
        await page.waitForTimeout(1000);
        if (await page.locator('.photo-view').isVisible()) await closePostcard(page);
      }
      await expect(page.locator('.finale')).toBeVisible({ timeout: 20000 });
      await page.waitForTimeout(2500);
      await shot('i04-finale');
      await page.getByRole('button', { name: 'Hooray!' }).click();
      await page.waitForTimeout(1500);
      await shot('i05-after-finale');
      await backToMap(page);
      await page.waitForTimeout(500);
      await shot('i06-map-after-finale');
      await page.waitForTimeout(5000);
      await shot('i07-map-after-finale-later');
    });

    // Sound off, a reload mid-visit, and the grown-ups panel.
    test(`edges ${name}`, async ({ page }) => {
      test.setTimeout(600000);
      const shot = recorder(page, 'edges');
      await start(page, '/?fast', { visited: ['earth'], discoveries: [], stickers: [] }, 'off');
      await page.getByRole('button', { name: 'Start playing', exact: true }).click();
      await expect(page.locator('.destination-bar')).toBeVisible();
      await flyTo(page, 'Moon');
      await page.waitForTimeout(3000);
      await shot('j01-sound-off-arrival');
      await tapNext(page); await closePostcard(page);
      await page.waitForTimeout(500);
      await page.reload();
      await page.waitForTimeout(2500);
      await shot('j02-reload-mid-visit');
      const start2 = page.getByRole('button', { name: 'Start playing', exact: true });
      if (await start2.isVisible()) await start2.click();
      await page.waitForTimeout(1500);
      await shot('j03-reload-after-start');
      await page.goto('/?grownups');
      await expect(page.getByRole('dialog', { name: 'Grown-ups settings' })).toBeVisible();
      await page.waitForTimeout(800);
      await shot('j04-grownups');
    });
  });
}
