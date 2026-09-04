/**
 * The service worker is built, not written, and what is built decides whether a child's
 * tablet ever sees an update. These pin the two ways that goes quietly wrong.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildServiceWorker, buildVersion } from './build';

const template = readFileSync(new URL('./sw.js', import.meta.url), 'utf8');

const base = {
  shell: ['index.html', 'assets/index-abc123.js', 'assets/index-def456.css', 'manifest.webmanifest'],
  textures: ['assets/earth.jpg', 'assets/moon.jpg'],
  fingerprints: { 'index.html': '<!doctype html><title>Space Ninja</title>' },
};

describe('buildServiceWorker', () => {
  it('fills every placeholder and leaves valid JavaScript', () => {
    const source = buildServiceWorker({ template, ...base });
    expect(source).not.toContain('__VERSION__');
    expect(source).not.toContain('__SHELL__');
    expect(source).not.toContain('__TEXTURES__');
    // Parses. A template edit that breaks the syntax would otherwise only be found by a
    // tablet that silently failed to install it.
    expect(() => new Function(source)).not.toThrow();
  });

  it('lists the shell and the textures relative to the worker, sorted, without repeats', () => {
    const source = buildServiceWorker({
      template,
      ...base,
      shell: ['/index.html', 'index.html', './assets/index-abc123.js'],
    });
    expect(source).toContain('["./assets/index-abc123.js","./index.html"]');
    expect(source).toContain('["./assets/earth.jpg","./assets/moon.jpg"]');
  });

  it('refuses a template that has lost a placeholder', () => {
    expect(() => buildServiceWorker({ template: 'nothing here', ...base })).toThrow(/__VERSION__/);
  });
});

describe('buildVersion', () => {
  it('is stable for the same build', () => {
    expect(buildVersion(base)).toBe(buildVersion({ ...base }));
  });

  it('changes when a hashed file name changes', () => {
    const next = { ...base, shell: ['index.html', 'assets/index-zzz999.js'] };
    expect(buildVersion(next)).not.toBe(buildVersion(base));
  });

  it('changes when index.html changes, even though its name never does', () => {
    // The case that matters: a worker whose bytes do not change is never reinstalled,
    // and the stale index.html in the old cache would be served for good.
    const next = { ...base, fingerprints: { 'index.html': '<!doctype html><title>Changed</title>' } };
    expect(buildVersion(next)).not.toBe(buildVersion(base));
  });

  it('ignores the order files were listed in', () => {
    const shuffled = { ...base, shell: [...base.shell].reverse() };
    expect(buildVersion(shuffled)).toBe(buildVersion(base));
  });
});
