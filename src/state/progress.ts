/**
 * Discovery-journal persistence.
 *
 * localStorage throws outright in some private-browsing modes, so every access is
 * guarded: losing progress must never break the game.
 */

const STORAGE_KEY = 'spaceninja.progress.v1';

export interface StickerDefinition {
  id: string;
  emoji: string;
  label: string;
}

export const STICKERS: Record<string, StickerDefinition> = {
  'moon-explorer': { id: 'moon-explorer', emoji: '🌙', label: 'Moon Explorer' },
  'mars-explorer': { id: 'mars-explorer', emoji: '🔴', label: 'Mars Explorer' },
  'earth-explorer': { id: 'earth-explorer', emoji: '🌍', label: 'Earth Explorer' },
  /**
   * The last one, for finding every place on every world. The title of the game is the
   * thing a child becomes by finishing it — which is also why it is one sticker rather
   * than a fourth "explorer": it is not another world, it is all of them.
   */
  'space-ninja': { id: 'space-ninja', emoji: '🥷', label: 'Space Ninja' },
};

/** The sticker that finishing the whole game earns. */
export const FINALE_STICKER = 'space-ninja';

export interface Progress {
  /**
   * Places found, by discovery id, in the order they were found. This is what the
   * journal shows: a list of things the child went and looked at, rather than a count of
   * how many times they finished a tapping game.
   */
  discoveries: string[];
  /** Collections finished. */
  stickers: string[];
  /**
   * Bodies the ship has actually arrived at.
   *
   * Kept apart from stickers because "where you have been" and "what you finished" are
   * different facts, and the game needs the first one on its own: the opening shot widens
   * to take in Mars once the Moon has been *visited*. Tying that to a sticker meant a
   * child who flew to the Moon and simply looked at it never unlocked anything.
   */
  visited: string[];
}

/**
 * A fresh blank record every time. Deliberately a function rather than a shared constant:
 * callers push onto these arrays, and a spread of a constant copies the object but not
 * the arrays inside it — so one award would have quietly appended to the blank for the
 * rest of the session.
 */
function empty(): Progress {
  return { discoveries: [], stickers: [], visited: [] };
}

/** Anything that is not an array of strings is treated as absent rather than trusted. */
function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string');
}

function read(): Progress {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty();
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return empty();
    const record = parsed as Partial<Progress>;
    return {
      // Absent in saves written before there was anything to discover, and in saves
      // written before visits were tracked. Both simply mean "none yet".
      discoveries: stringList(record.discoveries),
      stickers: stringList(record.stickers),
      visited: stringList(record.visited),
    };
  } catch {
    return empty();
  }
}

function write(progress: Progress): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Storage unavailable or full. The session still works, it just will not be remembered.
  }
}

export function loadProgress(): Progress {
  return read();
}

/** Returns true only the first time a sticker is earned, so the celebration fires once. */
export function awardSticker(id: string): boolean {
  const progress = read();
  if (progress.stickers.includes(id)) return false;
  progress.stickers.push(id);
  write(progress);
  return true;
}

/** Records a find. Returns true the first time this place is found, so it lands once. */
export function recordDiscovery(id: string): boolean {
  const progress = read();
  if (progress.discoveries.includes(id)) return false;
  progress.discoveries.push(id);
  write(progress);
  return true;
}

/**
 * Whether every place in the game has been found.
 *
 * Takes the list of ids rather than importing config, so it can be pinned in a test
 * without a scene: `all` is `Object.keys(DISCOVERIES)` in the game. Extra ids in the save
 * — a place retired between releases — count for nothing, and order does not matter.
 * Finding the ninth place completes the whole game, and it used to get exactly the same
 * celebration as finding the third.
 */
export function foundEverything(found: readonly string[], all: readonly string[]): boolean {
  if (all.length === 0) return false;
  return all.every((id) => found.includes(id));
}

/** Records an arrival. Returns true the first time this body is reached. */
export function markVisited(id: string): boolean {
  const progress = read();
  if (progress.visited.includes(id)) return false;
  progress.visited.push(id);
  write(progress);
  return true;
}
