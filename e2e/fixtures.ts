import { test as base, expect, type Page, type TestInfo } from '@playwright/test';

/** Every test gets fresh browser storage and fails on uncaught errors, even after navigation. */
export const test = base.extend<{ browserHealth: void }>({
  browserHealth: [async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 4 });
      Object.defineProperty(navigator, 'deviceMemory', { get: () => 2 });
      Math.random = () => 0.1;
    });
    await use();
    expect(errors, 'Browser errors across the entire interaction').toEqual([]);
  }, { auto: true }],
});
export { expect };

export async function attachShot(page: Page, name: string, info: TestInfo) {
  const path = info.outputPath(`${name}.png`);
  await page.screenshot({ path });
  await info.attach(name, { path, contentType: 'image/png' });
}

export async function frame(page: Page): Promise<number> {
  return page.evaluate(() => (window as any).spaceNinjaSnapshot().frame);
}

export async function expectRendering(page: Page) {
  const before = await frame(page);
  await expect.poll(() => frame(page)).toBeGreaterThan(before);
}
