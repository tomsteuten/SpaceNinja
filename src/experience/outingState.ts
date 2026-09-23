import * as THREE from 'three';
import { DEFAULT_TUNING, type FreeFlightTuning } from '../flight/freeFlightModel';

/**
 * The outing's single transition owner.
 *
 * Every child or browser action becomes an event here; the result is the next state plus the
 * effects the scene glue must perform, in order. Nothing in `outing.ts` infers interaction
 * state from the DOM or from ship speed. The earlier version did, which is how opening a photo
 * left autopilot flying underneath it, one Escape closed a photo *and* flew home, and a
 * stopped ship looked like an untouched title screen to the service-worker update.
 *
 * Pure and DOM-free so each boundary is a unit test rather than a browser timing.
 */
export type OutingPhase = 'flight' | 'explore';

export interface OutingState {
  readonly phase: OutingPhase;
  /** A photograph is requested or showing. It is modal: flight is held while it is open. */
  readonly photoOpen: boolean;
  /** Any deliberate action has happened. Before it, an update may reload invisibly. */
  readonly touched: boolean;
}

export type OutingEvent =
  | { type: 'press' }
  | { type: 'help' }
  | { type: 'stop' }
  | { type: 'explore' }
  | { type: 'home' }
  | { type: 'escape' }
  | { type: 'openPhoto'; reward: boolean }
  | { type: 'photoClosed' }
  | { type: 'background' };

export type OutingEffect =
  | { type: 'beginSteer' }
  | { type: 'collectAt' }
  | { type: 'haltFlight' }
  | { type: 'engageHelp' }
  | { type: 'arriveNow' }
  | { type: 'enterMoon' }
  | { type: 'leaveMoon' }
  | { type: 'showPhoto'; reward: boolean }
  | { type: 'hidePhoto' }
  | { type: 'silence' };

export interface OutingContext {
  /** The flight model reports the ship hovering beside the Moon. */
  readonly explorable: boolean;
  readonly reducedMotion: boolean;
}

export interface Transition {
  readonly state: OutingState;
  readonly effects: readonly OutingEffect[];
}

export const INITIAL_OUTING: OutingState = Object.freeze({ phase: 'flight', photoOpen: false, touched: false });

const none = (state: OutingState): Transition => ({ state, effects: [] });

export function transition(state: OutingState, event: OutingEvent, context: OutingContext): Transition {
  const touched: OutingState = state.touched ? state : { ...state, touched: true };
  switch (event.type) {
    case 'press':
      // A photo is modal. Its own backdrop handling decides whether a press closes it.
      if (state.photoOpen) return none(state);
      return { state: touched, effects: [{ type: state.phase === 'flight' ? 'beginSteer' : 'collectAt' }] };

    case 'help':
      if (state.phase !== 'flight' || state.photoOpen) return none(state);
      // Reduced motion replaces the optional automatic journey with a cut. Direct steering
      // is the child's own motion and stays available.
      return {
        state: touched,
        effects: context.reducedMotion ? [{ type: 'haltFlight' }, { type: 'arriveNow' }] : [{ type: 'engageHelp' }],
      };

    case 'stop':
      if (state.phase !== 'flight' || state.photoOpen) return none(state);
      return { state: touched, effects: [{ type: 'haltFlight' }] };

    case 'explore':
      if (state.phase !== 'flight' || state.photoOpen || !context.explorable) return none(state);
      return { state: { ...touched, phase: 'explore' }, effects: [{ type: 'haltFlight' }, { type: 'enterMoon' }] };

    case 'home':
      if (state.phase !== 'explore') return none(state);
      return {
        state: { ...touched, phase: 'flight', photoOpen: false },
        effects: [{ type: 'hidePhoto' }, { type: 'silence' }, { type: 'leaveMoon' }],
      };

    case 'escape':
      // One Escape leaves one level. With a photo open it closes only the photo; this covers
      // focus outside the dialog. The DOM glue ignores an Escape the dialog already handled,
      // because by then the photo has closed and this state would read it as a second press.
      if (state.photoOpen) return { state: { ...state, photoOpen: false }, effects: [{ type: 'hidePhoto' }] };
      return transition(state, { type: state.phase === 'flight' ? 'stop' : 'home' }, context);

    case 'openPhoto':
      if (state.photoOpen) return none(state);
      // Opening a memory mid-flight stops the ship, including while the image loads. It
      // stays stopped afterwards: the child resumes by holding or asking for help again.
      return {
        state: { ...touched, photoOpen: true },
        effects: [{ type: 'haltFlight' }, { type: 'showPhoto', reward: event.reward }],
      };

    case 'photoClosed':
      return state.photoOpen ? { state: { ...state, photoOpen: false }, effects: [] } : none(state);

    case 'background':
      return { state, effects: [{ type: 'haltFlight' }, { type: 'silence' }] };
  }
}

/** The flight model advances only while flying with nothing modal in front of it. */
export function flightRuns(state: OutingState): boolean {
  return state.phase === 'flight' && !state.photoOpen;
}

/** A new build may reload only an untouched opening view, never a paused or stopped outing. */
export function canReloadForUpdate(state: OutingState): boolean {
  return !state.touched && state.phase === 'flight' && !state.photoOpen;
}

/**
 * Where a reduced-motion "help" places the ship: on the line from where it is now to the
 * body, inside the explore range and outside the hover shell, so the unchanged flight model
 * immediately reports the same hover an assisted journey would have ended in.
 */
export function assistedArrival(
  from: THREE.Vector3,
  center: THREE.Vector3,
  radius: number,
  tuning: FreeFlightTuning = DEFAULT_TUNING,
): { position: THREE.Vector3; heading: THREE.Vector3 } {
  const toShip = from.clone().sub(center);
  if (toShip.lengthSq() < 1e-9) toShip.set(0, 0, 1);
  toShip.normalize();
  const distance = radius * (tuning.hoverInnerFactor + tuning.hoverOuterFactor) / 2;
  const position = center.clone().addScaledVector(toShip, distance);
  return { position, heading: toShip.negate() };
}
