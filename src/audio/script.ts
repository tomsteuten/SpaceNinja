/**
 * The spoken words, read from the one narration manifest.
 *
 * `narration-script.json` is the single source of every cue's text and the filename its
 * recording carries (the filename is the cue id). The UI speaks through `speakGuide(text,
 * cueId)`, so the words have to arrive from somewhere; this keeps them living once, in the
 * manifest, rather than copied into the wiring. `narration-script.test.ts` pins the full set.
 */

import script from './narration-script.json';

const CUES = script.cues as Record<string, string>;

/**
 * The line for a cue id. Throws on an unknown id rather than speaking nothing: a cue the code
 * asks for that the manifest does not have is a wiring mistake, and a silent one is worse than
 * a loud one. Every id passed here is a literal in the source, so this fires in development.
 */
export function cueText(id: string): string {
  const text = CUES[id];
  if (text === undefined) {
    throw new Error(`No narration cue "${id}" in narration-script.json`);
  }
  return text;
}
