import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { buildServiceWorker } from './sw/build.ts';

/**
 * Emits `sw.js` into the build, with the list of files to precache filled in.
 *
 * A build step rather than a file in `public/`, because Vite hashes its output names and
 * the worker has to know them. Everything that decides the worker's contents is in
 * `sw/build.ts`, which is pure and tested; this only gathers the inputs. Nothing happens
 * in development, where there is no bundle to cache and a worker would only serve stale
 * modules over the dev server's live ones.
 */
function serviceWorker(): Plugin {
  return {
    name: 'spaceninja:service-worker',
    apply: 'build',
    // After Vite's own HTML plugin has emitted index.html, so it is in the bundle here.
    enforce: 'post',
    generateBundle(_options, bundle) {
      const built = Object.values(bundle)
        .map((file) => file.fileName)
        .filter((name) => !name.endsWith('.map') && name !== 'sw.js');
      const icons = readdirSync('public/icons').map((name) => 'icons/' + name);
      const textures = readdirSync('public/assets')
        .filter((name) => /\.(jpe?g|png|webp)$/i.test(name))
        .map((name) => 'assets/' + name);

      const fingerprints: Record<string, Uint8Array | string> = {};
      const index = bundle['index.html'];
      if (index?.type === 'asset') fingerprints['index.html'] = index.source;
      fingerprints['manifest.webmanifest'] = readFileSync('public/manifest.webmanifest');
      for (const icon of icons) fingerprints[icon] = readFileSync(join('public', icon));

      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: buildServiceWorker({
          template: readFileSync('sw/sw.js', 'utf8'),
          shell: [...built, 'manifest.webmanifest', ...icons],
          textures,
          fingerprints,
        }),
      });
    },
  };
}

export default defineConfig({
  // Relative base so the build can be opened from any sub-path or a plain file server.
  base: './',
  plugins: [serviceWorker()],
  server: {
    host: true, // bind 0.0.0.0 so phones/tablets on the same WiFi can connect
    port: 5173,
  },
  build: {
    target: 'es2020',
    sourcemap: true,
    // One chunk is fine here: it is almost entirely three.js, which every frame needs.
    chunkSizeWarningLimit: 800,
  },
});
