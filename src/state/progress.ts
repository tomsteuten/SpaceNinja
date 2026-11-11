/**
 * What survives between sessions: the worlds the ship has arrived at, for the map's "been
 * there" tick and its one gentle suggestion. Nothing is found, counted or collected
 * (DECISIONS.md, 11 Nov 2026: no hunt), so this is the whole record.
 *
 * localStorage throws outright in some private-browsing modes, so every access is guarded:
 * losing progress must never break the game. Saves written by earlier builds also carry
 * `discoveries` and `stickers`; they are ignored, and dropped at the next write.
 */

const STORAGE_KEY = 'spaceninja.progress.v1';

export interface Progress {
  /** Bodies the ship has actually arrived at, in the order first reached. */
  visited: string[];
}

/** Anything that is not an array of strings is treated as absent rather than trusted. */
function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string');
}

function read(): Progress {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { visited: [] };
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return { visited: [] };
    return { visited: stringList((parsed as Partial<Progress>).visited) };
  } catch {
    return { visited: [] };
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

/**
 * Start the adventure over without touching device choices such as sound or the grown-ups
 * greeting: the progress record is one key so this can be precise. Returns false only when
 * storage itself is unavailable.
 */
export function resetProgress(): boolean {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

/** Records an arrival. Returns true the first time this body is reached. */
export function markVisited(id: string): boolean {
  const progress = read();
  if (progress.visited.includes(id)) return false;
  progress.visited.push(id);
  write(progress);
  return true;
}

/**
 * The one gentle hint on the map: the first unvisited world in hint order (`available` is
 * given in that order: Earth, the Moon, Mars, the Sun, Saturn, from src/map/model.ts). Once
 * everywhere has been visited it suggests nothing. Only ever a suggestion: every world can be
 * flown to at any time.
 */
export function nextWorld(progress: Progress, available: readonly string[]): string | null {
  return available.find((id) => !progress.visited.includes(id)) ?? null;
}
