import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { buildServiceWorker } from './build';

const source = buildServiceWorker({
  template: readFileSync(new URL('./sw.js', import.meta.url), 'utf8'),
  shell: ['index.html'], textures: [], fingerprints: {},
});

describe('offline navigation boundary', () => {
  for (const path of ['/SpaceNinja/', '/SpaceNinja/index.html', '/SpaceNinja/?freeflight', '/SpaceNinja/?explorer']) {
    it(`serves the installed game for ${path}`, async () => {
      expect(await navigate(path)).toBe('installed game');
    });
  }
  it('leaves nested design previews to the server instead of booting the game at a wrong base URL', async () => {
    expect(await navigate('/SpaceNinja/design/ui-prototype-2026-10-03/index.html')).toBeUndefined();
  });
});

async function navigate(path: string) {
  let fetchHandler: (event: unknown) => void = () => {};
  runInNewContext(source, {
    URL,
    self: {
      location: { origin: 'https://example.com' },
      registration: { scope: 'https://example.com/SpaceNinja/' },
      addEventListener(name: string, handler: typeof fetchHandler) { if (name === 'fetch') fetchHandler = handler; },
    },
    caches: { match: async () => 'installed game' },
  });
  let response: Promise<string> | undefined;
  fetchHandler({
    request: { url: 'https://example.com' + path, method: 'GET', mode: 'navigate' },
    respondWith(value: Promise<string>) { response = value; },
  });
  return response;
}
