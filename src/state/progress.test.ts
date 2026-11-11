/**
 * The visits are the one thing that survives between sessions. These cover the paths that
 * are awkward to reach by hand: an old save, a corrupted entry, storage that refuses to work.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadProgress, markVisited, nextWorld, resetProgress } from './progress';

const KEY = 'spaceninja.progress.v1';

/** Minimal in-memory stand-in. */
function fakeStorage(seed: Record<string, string> = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    clear: () => map.clear(),
    key: (index: number) => [...map.keys()][index] ?? null,
    get length() {
      return map.size;
    },
  } as Storage;
}

function useStorage(storage: Storage) {
  vi.stubGlobal('window', { localStorage: storage });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loadProgress', () => {
  it('starts empty when nothing has been saved', () => {
    useStorage(fakeStorage());
    expect(loadProgress()).toEqual({ visited: [] });
  });

  it('reads an old save with finds and stickers as just its visits', () => {
    useStorage(fakeStorage({ [KEY]: JSON.stringify({
      discoveries: ['moon-tycho'], stickers: ['moon-explorer'], visited: ['earth', 'moon'] }) }));
    expect(loadProgress()).toEqual({ visited: ['earth', 'moon'] });
  });

  it('survives a corrupted entry, an unknown shape and non-string entries', () => {
    useStorage(fakeStorage({ [KEY]: '{not json' }));
    expect(loadProgress().visited).toEqual([]);
    useStorage(fakeStorage({ [KEY]: JSON.stringify({ visited: 'moon' }) }));
    expect(loadProgress().visited).toEqual([]);
    useStorage(fakeStorage({ [KEY]: JSON.stringify({ visited: ['moon', 7, null] }) }));
    expect(loadProgress().visited).toEqual(['moon']);
  });

  it('survives storage that throws, the way private browsing does', () => {
    useStorage({
      getItem() { throw new Error('SecurityError'); },
      setItem() { throw new Error('SecurityError'); },
    } as unknown as Storage);
    expect(loadProgress().visited).toEqual([]);
    expect(markVisited('moon')).toBe(true);
  });
});

describe('markVisited', () => {
  it('returns true the first time a body is reached and false after', () => {
    useStorage(fakeStorage());
    expect(markVisited('moon')).toBe(true);
    expect(markVisited('moon')).toBe(false);
    expect(loadProgress().visited).toEqual(['moon']);
  });
});

describe('resetProgress', () => {
  it('clears the visits without clearing unrelated device choices', () => {
    const storage = fakeStorage({ 'spaceninja.sound.v1': 'off' });
    useStorage(storage);
    markVisited('moon');
    expect(resetProgress()).toBe(true);
    expect(loadProgress()).toEqual({ visited: [] });
    expect(storage.getItem('spaceninja.sound.v1')).toBe('off');
  });

  it('fails harmlessly when private browsing refuses the removal', () => {
    useStorage({ removeItem() { throw new Error('SecurityError'); } } as unknown as Storage);
    expect(resetProgress()).toBe(false);
  });
});

describe('nextWorld', () => {
  const order = ['earth', 'moon', 'mars', 'sun', 'saturn'];
  it('suggests the first unvisited world in hint order', () => {
    expect(nextWorld({ visited: [] }, order)).toBe('earth');
    expect(nextWorld({ visited: ['earth', 'moon'] }, order)).toBe('mars');
    expect(nextWorld({ visited: ['moon'] }, order)).toBe('earth');
  });
  it('suggests nothing once everywhere has been visited', () => {
    expect(nextWorld({ visited: order }, order)).toBeNull();
  });
});
