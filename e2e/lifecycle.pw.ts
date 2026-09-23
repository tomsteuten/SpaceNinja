import { test, expect, frame, expectRendering, attachShot } from './fixtures';

const SHOT: Record<string, string> = { '/': 'outing-restored', '/?classic': 'adventure-restored', '/?freeflight': 'free-flight-restored' };

for (const route of ['/', '/?classic', '/?freeflight']) {
  test(`history suspension preserves and resumes ${route}`, async ({ page }, info) => {
    const steers = route !== '/?classic';
    await page.goto(route);
    if (!steers) await page.getByRole('button', { name: 'Start playing', exact: true }).click();
    await expect(page.locator('#boot')).toBeHidden();
    await expectRendering(page);

    if (steers) {
      await page.mouse.move(280, 230);
      await page.mouse.down();
      await expect.poll(() => page.evaluate(() => (window as any).spaceNinjaSnapshot().steering)).toBe(true);
    }
    // Deterministic browser event contract; actual BFCache eligibility varies by browser.
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
    const paused = await frame(page);
    await page.waitForTimeout(250);
    expect(await frame(page)).toBe(paused);
    if (steers) {
      expect(await page.evaluate(() => (window as any).spaceNinjaSnapshot().steering)).toBe(false);
      await page.mouse.up();
    }
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
    await expectRendering(page);
    await expect(page.locator('#boot')).toBeHidden();
    await attachShot(page, SHOT[route]!, info);
  });
}
