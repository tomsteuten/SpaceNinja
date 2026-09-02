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
};

/** Empty slots shown alongside earned stickers, so the journal looks like a collection. */
export const JOURNAL_SLOTS = 6;

export interface Progress {
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
  return { stickers: [], visited: [] };
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
      stickers: stringList(record.stickers),
      // Absent in saves written before visits were tracked, which is simply "nowhere yet".
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

/** Records an arrival. Returns true the first time this body is reached. */
export function markVisited(id: string): boolean {
  const progress = read();
  if (progress.visited.includes(id)) return false;
  progress.visited.push(id);
  write(progress);
  return true;
}
