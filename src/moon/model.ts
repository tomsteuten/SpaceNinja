/** Spherical flight simulation. Rendering, pointer events and progress are separate. */
export type ControlMode = 'fly' | 'drag';
export interface FlightState {
  lat: number; lon: number; heading: number; altitude: number; targetAltitude: number;
  speed: number; mode: ControlMode;
}
export const MIN_ALTITUDE = 0.12;
export const MAX_ALTITUDE = 1.7;
export const radians = (degrees: number) => degrees * Math.PI / 180;
export const degrees = (angle: number) => angle * 180 / Math.PI;
export const wrap = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));
export const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
export function createFlight(): FlightState {
  return { lat: radians(-43.3), lon: radians(-11.4), heading: 0, altitude: 0.24,
    targetAltitude: 0.24, speed: 0, mode: 'fly' };
}
export function stopFlight(state: FlightState) { state.speed = 0; }
export function stepFlight(state: FlightState, dt: number, input: {x: number; y: number} | null, limits={min:MIN_ALTITUDE,max:MAX_ALTITUDE}) {
  dt = clamp(dt, 0, 0.05);
  state.targetAltitude = clamp(state.targetAltitude, limits.min, limits.max);
  state.altitude += (state.targetAltitude - state.altitude) * (1 - Math.exp(-dt * 4));
  if (input && state.mode === 'fly') {
    const desired = Math.atan2(input.x, -input.y);
    state.heading = wrap(state.heading + wrap(desired - state.heading) * (1 - Math.exp(-dt * 7)));
  }
  const targetSpeed = input && state.mode === 'fly' ? Math.min(state.altitude,0.65) * 0.3 : 0;
  state.speed += (targetSpeed - state.speed) * (1 - Math.exp(-dt * (input ? 7 : 16)));
  if (state.speed < 0.00001) state.speed = 0;
  state.lat += Math.cos(state.heading) * state.speed * dt;
  state.lon = wrap(state.lon + Math.sin(state.heading) * state.speed * dt / Math.max(0.2, Math.cos(state.lat)));
  // Rebound smoothly before the coordinate pole; never cross a singularity.
  const limit = radians(78);
  if (Math.abs(state.lat) > limit) {
    state.lat = clamp(state.lat, -limit, limit);
    state.heading = wrap(Math.PI - state.heading);
  }
}
export function dragGlobe(state: FlightState, dx: number, dy: number, shortEdge: number) {
  // Deltas are distances, applied exactly once; no frame-rate-dependent accumulation.
  state.lon = wrap(state.lon - dx / shortEdge * 1.6);
  state.lat = clamp(state.lat + dy / shortEdge * 1.6, radians(-78), radians(78));
}
export function angularDistance(a: {lat: number; lon: number}, b: {lat: number; lon: number}) {
  return Math.acos(clamp(Math.sin(a.lat) * Math.sin(b.lat) + Math.cos(a.lat) * Math.cos(b.lat) * Math.cos(a.lon - b.lon), -1, 1));
}
