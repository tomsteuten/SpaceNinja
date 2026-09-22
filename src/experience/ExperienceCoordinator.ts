/** Explicit non-rendering ownership for the unified route. */
export type ExperienceState = 'SYSTEM' | 'DEPARTING' | 'ARRIVING' | 'EXPLORING' | 'RETURNING' | 'SUSPENDED' | 'CRASHED' | 'DISPOSED';

const allowed: Record<ExperienceState, readonly ExperienceState[]> = {
  SYSTEM: ['DEPARTING', 'SUSPENDED', 'CRASHED', 'DISPOSED'],
  DEPARTING: ['ARRIVING', 'SYSTEM', 'SUSPENDED', 'CRASHED', 'DISPOSED'],
  ARRIVING: ['EXPLORING', 'SYSTEM', 'SUSPENDED', 'CRASHED', 'DISPOSED'],
  EXPLORING: ['RETURNING', 'SUSPENDED', 'CRASHED', 'DISPOSED'],
  RETURNING: ['SYSTEM', 'SUSPENDED', 'CRASHED', 'DISPOSED'],
  SUSPENDED: ['SYSTEM', 'DEPARTING', 'ARRIVING', 'EXPLORING', 'RETURNING', 'CRASHED', 'DISPOSED'],
  CRASHED: ['DISPOSED'], DISPOSED: [],
};

export interface ExperienceCoordinator {
  readonly state: ExperienceState;
  move(next: ExperienceState): boolean;
  suspend(): void;
  resume(): void;
  crash(): void;
  dispose(): void;
}

export function createExperienceCoordinator(initial: ExperienceState = 'SYSTEM'): ExperienceCoordinator {
  let state = initial;
  let resumeState = initial;
  return {
    get state() { return state; },
    move(next) { if (!allowed[state].includes(next)) return false; state = next; return true; },
    suspend() { if (!['SUSPENDED', 'CRASHED', 'DISPOSED'].includes(state)) { resumeState = state; state = 'SUSPENDED'; } },
    resume() { if (state === 'SUSPENDED') state = resumeState; },
    crash() { if (state !== 'DISPOSED') state = 'CRASHED'; },
    dispose() { state = 'DISPOSED'; },
  };
}
