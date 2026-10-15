import { test, expect } from './fixtures';

test.use({ reducedMotion: 'reduce' });

test('repeated Space map taps cannot launch the destination underneath the old button', async ({ page }) => {
  const snapshot = () => page.evaluate(() => (window as any).spaceNinjaSnapshot());
  await page.goto('/');
  await page.getByRole('button', { name: 'Start playing', exact: true }).click();
  await page.getByRole('button', { name: 'Fly to Earth', exact: true }).click();
  await expect.poll(async () => (await snapshot()).phase).toBe('arrived');
  await page.getByRole('button', { name: 'Find places', exact: true }).click();
  const home = (await page.getByRole('button', { name: 'Back to the space map', exact: true }).boundingBox())!;
  const x = home.x + home.width / 2;
  const y = home.y + home.height / 2;
  // One browser command preserves the true rapid double-click sequence.
  await page.mouse.dblclick(x, y, { delay: 80 });
  await expect.poll(async () => (await snapshot()).phase).toBe('idle');
  // An intentional different choice remains available; there is no global map cooldown.
  await page.getByRole('button', { name: 'Fly to Moon', exact: true }).tap();
  await expect.poll(async () => (await snapshot()).phase).not.toBe('idle');
  await expect.poll(async () => (await snapshot()).phase).toBe('arrived');
  const moonHome = (await page.getByRole('button', { name: 'Back to the space map', exact: true }).boundingBox())!;
  // A separate return: the two clicks are roughly a second apart. Keeping them in one
  // command avoids inserting state-query/render latency into the gesture under test.
  // Exact 1000ms/1200ms boundaries are covered by mapReturnGuard.test.ts.
  await page.mouse.dblclick(moonHome.x + moonHome.width / 2, moonHome.y + moonHome.height / 2, { delay: 500 });
  await expect.poll(async () => (await snapshot()).phase).toBe('idle');
  await page.getByRole('button', { name: 'Fly to Sun', exact: true }).tap();
  await expect.poll(async () => (await snapshot()).phase).toBe('arrived');
  const sunHome = (await page.getByRole('button', { name: 'Back to the space map', exact: true }).boundingBox())!;
  // Native touch input, without a state query between the repeated taps.
  await page.touchscreen.tap(sunHome.x + sunHome.width / 2, sunHome.y + sunHome.height / 2);
  await page.touchscreen.tap(sunHome.x + sunHome.width / 2, sunHome.y + sunHome.height / 2);
  await expect.poll(async () => (await snapshot()).phase).toBe('idle');
  // Keyboard activation is immediately available even over the protected footprint.
  await page.getByRole('button', { name: 'Fly to Earth', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await snapshot()).phase).not.toBe('idle');
});
