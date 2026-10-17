import { test, expect, frame, expectRendering, attachShot } from './fixtures';

test('history suspension preserves and resumes the adventure', async ({ page }, info) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start playing', exact: true }).click();
  await expect(page.locator('#boot')).toBeHidden();
  await expectRendering(page);

  // Deterministic browser event contract; actual BFCache eligibility varies by browser.
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
  const paused = await frame(page);
  await page.waitForTimeout(250);
  expect(await frame(page)).toBe(paused);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
  await expectRendering(page);
  await expect(page.locator('#boot')).toBeHidden();
  await attachShot(page, 'adventure-restored', info);
});
