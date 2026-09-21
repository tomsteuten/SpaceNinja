import { test, expect, attachShot } from './fixtures';

/**
 * The explorer welcome screen stacks a title, a world chooser, the Explore button, a caption
 * and a corner credit into a fixed overlay. On phones the button and caption were once pinned
 * with hand-tuned `calc(100dvh - Npx)` offsets that overlapped by a few pixels at almost every
 * height (first reported on a Galaxy S25). This guards that regression across a bracket of real
 * device viewports so a future layout change cannot quietly reintroduce it.
 *
 * Overlap is measured geometrically from bounding boxes, not by eye, so the check is exact.
 * The matrix runs once (not once per configured project) because it sets its own viewports.
 */

// width x height in CSS pixels; the visible web viewport, chrome already subtracted.
// Scoped to >=360 wide (every modern phone incl. the reported S25); 320px ultra-narrow keeps
// the attribution micro-text tucked in the same corner as a touch target and is out of scope.
const VIEWPORTS = [
  { name: 's25', w: 360, h: 780 },
  { name: 's25-ultra', w: 412, h: 883 },
  { name: 'pixel-8', w: 393, h: 852 },
  { name: 'config-phone', w: 390, h: 844 },
  { name: 'galaxy-a', w: 360, h: 800 },
  { name: 'iphone-13-mini', w: 375, h: 700 },
  { name: 'iphone-15-pro-max', w: 430, h: 845 },
  { name: 'short-android', w: 360, h: 640 },
  { name: 'tablet-portrait', w: 800, h: 1180 },
];

// Pairs that must never share pixels on the welcome screen.
const PAIRS: [string, string][] = [
  ['.moon-start', '.welcome-note'],
  ['.moon-start', '.moon-credit'],
  ['.welcome-note', '.moon-credit'],
  ['.moon-credit', '.moon-original'],
  ['.world-choice', '.moon-start'],
  ['.world-choice', '.welcome-note'],
];

test('welcome screen: no overlapping controls across device viewports', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone', 'Layout matrix sets its own viewports; run it once.');

  for (const v of VIEWPORTS) {
    await page.setViewportSize({ width: v.w, height: v.h });
    await page.goto('/');
    await expect(page.locator('#boot')).toBeHidden();
    await expect(page.locator('.moon-start')).toBeVisible();

    const overlaps = await page.evaluate((pairs) => {
      const box = (sel: string) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
      };
      const hit = (a: any, b: any) =>
        !!a && !!b && !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);
      return pairs.filter(([x, y]: [string, string]) => hit(box(x), box(y))).map(([x, y]) => `${x} × ${y}`);
    }, PAIRS);

    expect(overlaps, `overlapping controls at ${v.name} (${v.w}x${v.h})`).toEqual([]);

    // The primary action must sit fully within the viewport, not clipped off the bottom.
    const start = await page.locator('.moon-start').boundingBox();
    expect(start, `Explore button missing at ${v.name}`).not.toBeNull();
    expect(start!.y, `Explore button clipped at top on ${v.name}`).toBeGreaterThanOrEqual(0);
    expect(start!.y + start!.height, `Explore button clipped at bottom on ${v.name}`).toBeLessThanOrEqual(v.h);

    await attachShot(page, `welcome-${v.name}`, info);
  }
});
