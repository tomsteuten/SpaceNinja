/**
 * Choices a grown-up makes about this device.
 *
 * Kept apart from progress.ts, which is about what a child has *done* — the journal is
 * theirs and clearing it would be taking something away, whereas these are settings and
 * losing them costs nothing but a second tap. Same guarded access either way: localStorage
 * throws outright in some private-browsing modes, and neither a preference nor a journal is
 * worth breaking the game over.
 */

const SOUND_KEY = 'spaceninja.sound.v1';

/**
 * Sound on unless it has been explicitly turned off.
 *
 * Absent means on, so a fresh device plays as intended and a storage failure fails towards
 * the game working rather than towards silence — a child who cannot hear the chime has no
 * way to know it is a setting, whereas an adult in a quiet room can always turn it off
 * again.
 */
export function loadSoundOn(): boolean {
  try {
    return window.localStorage.getItem(SOUND_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function saveSoundOn(on: boolean): void {
  try {
    window.localStorage.setItem(SOUND_KEY, on ? 'on' : 'off');
  } catch {
    // Private browsing. The choice holds for this session and no longer.
  }
}
