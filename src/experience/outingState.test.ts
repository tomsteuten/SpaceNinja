import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createFreeFlight, DEFAULT_TUNING, type FlightBody } from '../flight/freeFlightModel';
import {
  INITIAL_OUTING,
  assistedArrival,
  canReloadForUpdate,
  flightRuns,
  transition,
  type OutingEvent,
  type OutingState,
} from './outingState';

const motion = { explorable: false, reducedMotion: false };
const types = (effects: readonly { type: string }[]) => effects.map((effect) => effect.type);

function run(events: OutingEvent[], context = motion, start: OutingState = INITIAL_OUTING): OutingState {
  return events.reduce((state, event) => transition(state, event, context).state, start);
}

const atMoon = run([{ type: 'explore' }], { explorable: true, reducedMotion: false });

describe('outing transitions', () => {
  it('opening a memory mid-flight stops the ship and holds the flight model while open', () => {
    const flying = run([{ type: 'help' }]);
    const opened = transition(flying, { type: 'openPhoto', reward: false }, motion);
    expect(types(opened.effects)).toEqual(['haltFlight', 'showPhoto']);
    expect(flightRuns(opened.state)).toBe(false);
    // Press, help and stop are all inert behind the modal photo.
    for (const event of [{ type: 'press' }, { type: 'help' }, { type: 'stop' }] as const) {
      expect(transition(opened.state, event, motion).effects).toEqual([]);
    }
    // Dismissal resumes the flight model but not the journey: the ship stays stopped.
    const closed = transition(opened.state, { type: 'photoClosed' }, motion);
    expect(closed.effects).toEqual([]);
    expect(flightRuns(closed.state)).toBe(true);
  });

  it('Escape belongs to an open photo and never also flies home', () => {
    const photo = run([{ type: 'openPhoto', reward: true }], motion, atMoon);
    const first = transition(photo, { type: 'escape' }, motion);
    expect(types(first.effects)).toEqual(['hidePhoto']);
    expect(first.state).toMatchObject({ phase: 'explore', photoOpen: false });
    // Only a second, separate Escape leaves the Moon.
    const home = transition(first.state, { type: 'escape' }, motion);
    expect(home.state.phase).toBe('flight');
    expect(types(home.effects)).toEqual(['hidePhoto', 'silence', 'leaveMoon']);
  });

  it('Escape in flight only stops', () => {
    const result = transition(run([{ type: 'help' }]), { type: 'escape' }, motion);
    expect(result.state.phase).toBe('flight');
    expect(types(result.effects)).toEqual(['haltFlight']);
  });

  it('reduced motion replaces the automatic journey with a cut, not a faster sweep', () => {
    const reduced = { explorable: false, reducedMotion: true };
    expect(types(transition(INITIAL_OUTING, { type: 'help' }, reduced).effects)).toEqual(['haltFlight', 'arriveNow']);
    expect(types(transition(INITIAL_OUTING, { type: 'help' }, motion).effects)).toEqual(['engageHelp']);
    // The child's own steering is unchanged.
    expect(types(transition(INITIAL_OUTING, { type: 'press' }, reduced).effects)).toEqual(['beginSteer']);
  });

  it('an update may reload only the untouched opening view', () => {
    expect(canReloadForUpdate(INITIAL_OUTING)).toBe(true);
    for (const event of [{ type: 'press' }, { type: 'help' }, { type: 'stop' }, { type: 'openPhoto', reward: false }] as const) {
      expect(canReloadForUpdate(run([event])), event.type).toBe(false);
    }
    // Stopped after help, at the Moon, and back home again all count as play in progress.
    expect(canReloadForUpdate(run([{ type: 'help' }, { type: 'stop' }]))).toBe(false);
    expect(canReloadForUpdate(atMoon)).toBe(false);
    expect(canReloadForUpdate(run([{ type: 'home' }], motion, atMoon))).toBe(false);
    // A background suspension is not a child's action.
    expect(canReloadForUpdate(run([{ type: 'background' }]))).toBe(true);
  });

  it('explore requires the flight model to report the Moon within reach', () => {
    expect(transition(INITIAL_OUTING, { type: 'explore' }, motion).state.phase).toBe('flight');
    const entered = transition(INITIAL_OUTING, { type: 'explore' }, { explorable: true, reducedMotion: false });
    expect(entered.state.phase).toBe('explore');
    expect(types(entered.effects)).toEqual(['haltFlight', 'enterMoon']);
  });

  it('presses on the Moon collect rather than steer', () => {
    expect(types(transition(atMoon, { type: 'press' }, motion).effects)).toEqual(['collectAt']);
  });

  it('flying home closes any open photo and clears the modal state', () => {
    const photo = run([{ type: 'openPhoto', reward: false }], motion, atMoon);
    const home = transition(photo, { type: 'home' }, motion);
    expect(home.state).toMatchObject({ phase: 'flight', photoOpen: false });
    expect(types(home.effects)[0]).toBe('hidePhoto');
  });

  it('a duplicate photo close is inert', () => {
    expect(transition(INITIAL_OUTING, { type: 'photoClosed' }, motion)).toEqual({ state: INITIAL_OUTING, effects: [] });
  });
});

describe('assistedArrival', () => {
  it('places the ship where the unchanged flight model reports the Moon explorable', () => {
    const moon: FlightBody = { id: 'moon', center: new THREE.Vector3(6, 0.4, -9), radius: 0.4 };
    const earth: FlightBody = { id: 'earth', center: new THREE.Vector3(0, 0, 0), radius: 1, brakeOnApproach: false, canExplore: false };
    const pose = assistedArrival(new THREE.Vector3(1, 0.5, 3), moon.center, moon.radius);
    const flight = createFreeFlight(pose, DEFAULT_TUNING);
    const state = flight.update(0, { pointer: null }, [earth, moon]);
    expect(state.explorable).toBe('moon');
    expect(state.speed).toBe(0);
    // Facing the Moon, outside its clearance shell.
    expect(state.heading.dot(moon.center.clone().sub(state.position).normalize())).toBeCloseTo(1, 5);
    expect(state.position.distanceTo(moon.center)).toBeGreaterThan(moon.radius * DEFAULT_TUNING.clearFactor);
  });
});
