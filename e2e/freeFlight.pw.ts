import { expect, test, type Page, type TestInfo } from '@playwright/test';

async function attachShot(page: Page, name: string, info: TestInfo) {
  await info.attach(name, { body: await page.screenshot(), contentType: 'image/png' });
}

test('assisted free flight boots, flies, arrives and hands control back', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.addInitScript(() => {
    // Exercise the supported older-device tier; software bloom can saturate CI hosts.
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 4 });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 2 });
    Math.random = () => 0.1;
  });

  await page.goto('/?freeflight');
  await expect(page.locator('#boot')).toBeHidden();
  await expect(page.locator('.ff-hint')).toContainText('Hold anywhere and steer');
  await expect(page.getByRole('button', { name: /^Autopilot to / })).toHaveCount(4);
  await attachShot(page, 'free-flight-ready', info);

  await page.getByRole('button', { name: 'Autopilot to earth' }).click();
  await expect(page.locator('.ff-hint')).toContainText('Autopilot to Earth');
  await expect(page.locator('.ff-banner')).toHaveClass(/is-open/, { timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'Explore' })).toBeVisible();
  await attachShot(page, 'free-flight-hover', info);

  await page.getByRole('button', { name: 'Explore' }).click();
  await expect(page.locator('.ff-arrival')).toHaveClass(/is-open/);
  await expect(page.getByRole('heading')).toContainText('You reached Earth');
  await attachShot(page, 'free-flight-arrival', info);

  await page.getByRole('button', { name: 'Keep flying' }).click();
  await expect(page.locator('.ff-arrival')).not.toHaveClass(/is-open/);

  const { width, height } = page.viewportSize()!;
  await page.mouse.move(width * 0.72, height * 0.42);
  await page.mouse.down();
  await page.waitForTimeout(700);
  await page.mouse.move(width * 0.82, height * 0.34, { steps: 12 });
  await page.waitForTimeout(500);
  await attachShot(page, 'free-flight-manual-turn', info);
  await page.mouse.up();

  expect(errors).toEqual([]);
});
