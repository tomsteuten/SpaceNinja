/**
 * The explorer's one sequence: the solar system, a flight out, a descent, close exploration,
 * a climb back out and the pull-back home. Each step may only advance to the next, so a stray
 * press cannot start a second journey mid-flight; `reset` returns to the system from anywhere,
 * because a restart (a grown-up clearing progress, say) must never be refused.
 */
export type Phase = 'system' | 'flying' | 'descending' | 'exploring' | 'ascending' | 'returning';

const NEXT: Record<Phase, Phase | null> = {
  system: 'flying',
  flying: 'descending',
  descending: 'exploring',
  exploring: 'ascending',
  ascending: 'returning',
  returning: null,
};

export function createPhases(onChange: (phase: Phase) => void = () => {}) {
  let phase: Phase = 'system';
  return {
    get current() { return phase; },
    /** Advance to `to` if it is the step after the current one. */
    advance(to: Phase): boolean {
      if (NEXT[phase] !== to) return false;
      phase = to;
      onChange(phase);
      return true;
    },
    reset() {
      phase = 'system';
      onChange(phase);
    },
  };
}
