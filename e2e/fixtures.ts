import { test as base, expect, type Page, type TestInfo } from '@playwright/test';

/**
 * Every test gets fresh browser storage and fails on uncaught errors, even after navigation.
 * A test may name console messages it deliberately provokes, and must then prove their
 * cause itself (see offline.pw.ts); uncaught page errors are never ignorable.
 */
export const test = base.extend<{ ignoredConsoleErrors: RegExp[]; browserHealth: void }>({
  ignoredConsoleErrors: [[], { option: true }],
  browserHealth: [async ({ page, ignoredConsoleErrors }, use) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() !== 'error') return;
      const text = message.text();
      if (!ignoredConsoleErrors.some(pattern => pattern.test(text))) errors.push(text);
    });
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

/**
 * Panels ignore a close for the first half second after opening and never close from the
 * press that opened them (src/ui/panelGuard.ts), because a child's double tap was opening
 * and closing the journal, the About words and the photo in one go. A driver that opens a
 * panel and closes it in the same breath is exactly that double tap, so wait the guard out.
 */
export async function settlePanel(page: Page) {
  await page.waitForTimeout(650);
}
