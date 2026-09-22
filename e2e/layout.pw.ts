import { test, expect, attachShot } from './fixtures';
import type { Page } from '@playwright/test';

/**
 * Overlap is measured geometrically from bounding boxes, not by eye. The matrix runs once
 * (in the phone project) because it sets its own viewports, and it resizes one live visit
 * rather than flying out again per size, which also exercises resize mid-exploration.
 */
const VIEWPORTS = [
  { name: 's25', w: 360, h: 780 },
  { name: 'pixel-8', w: 393, h: 852 },
  { name: 'iphone-13-mini', w: 375, h: 700 },
  { name: 'short-android', w: 360, h: 640 },
  { name: 'phone-landscape', w: 844, h: 390 },
  { name: 'tablet-landscape', w: 1024, h: 768 },
  { name: 'tablet-portrait', w: 800, h: 1180 },
  { name: 'laptop', w: 1366, h: 768 },
];

const SYSTEM = ['.ex-worlds', '.ex-hint', '.ex-corner', '.ex-brand', '.ex-original'];
const EXPLORING = ['.ex-dock', '.ex-landmark', '.ex-top', '.ex-corner', '.ex-coach', '.ex-status'];

async function overlaps(page: Page, selectors: string[]) {
  return page.evaluate((list) => {
    const boxes = list.map((selector) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element || element.closest('[hidden]') || getComputedStyle(element).display === 'none' || !element.getClientRects().length) return null;
      const r = element.getBoundingClientRect();
      return r.width && r.height ? { selector, left: r.left, right: r.right, top: r.top, bottom: r.bottom } : null;
    }).filter(Boolean) as Array<{ selector: string; left: number; right: number; top: number; bottom: number }>;
    const hits: string[] = [];
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]!, b = boxes[j]!;
      if (!(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top)) hits.push(`${a.selector} × ${b.selector}`);
    }
    const outside = boxes.filter((b) => b.left < 0 || b.top < 0 || b.right > innerWidth + 0.5 || b.bottom > innerHeight + 0.5).map((b) => b.selector);
    return { hits, outside };
  }, selectors);
}

test('controls never overlap each other or leave the screen, in the system or exploring', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone', 'Layout matrix sets its own viewports; run it once.');
  await page.goto('/');
  await expect(page.locator('#boot')).toBeHidden();
  for (const v of VIEWPORTS) {
    await page.setViewportSize({ width: v.w, height: v.h });
    await page.waitForTimeout(150);
    const result = await overlaps(page, SYSTEM);
    expect(result, `solar system at ${v.name}`).toEqual({ hits: [], outside: [] });
    for (const button of await page.locator('.ex-world').all()) {
      expect((await button.boundingBox())!.height, `world button height at ${v.name}`).toBeGreaterThanOrEqual(48);
    }
    await attachShot(page, `system-${v.name}`, info);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: /^Fly to Moon/ }).click();
  await expect.poll(async () => (await page.evaluate(() => (window as any).spaceNinjaSnapshot())).phase, { timeout: 150_000 }).toBe('exploring');
  // Put the found-place card on screen too: it is the largest thing the exploring view shows.
  await page.getByRole('button', { name: 'Places', exact: true }).click();
  await page.locator('.place-option').first().click();
  await expect(page.locator('.ex-landmark')).toBeVisible({ timeout: 60_000 });
  for (const v of VIEWPORTS) {
    await page.setViewportSize({ width: v.w, height: v.h });
    await page.waitForTimeout(250);
    const result = await overlaps(page, EXPLORING);
    expect(result, `exploring at ${v.name}`).toEqual({ hits: [], outside: [] });
    await attachShot(page, `exploring-${v.name}`, info);
  }
});
