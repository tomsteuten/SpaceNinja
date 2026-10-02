/** Spherical flight simulation. Rendering, pointer events and progress are separate. */
export interface FlightState {
  lat: number; lon: number; heading: number; altitude: number; targetAltitude: number;
  speed: number;
}
/** Altitudes are in body radii above the surface, so one model serves every world. */
export const MIN_ALTITUDE = 0.12;
export const MAX_ALTITUDE = 1.7;
export const radians = (degrees: number) => degrees * Math.PI / 180;
export const degrees = (angle: number) => angle * 180 / Math.PI;
export const wrap = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));
export const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
/** Never closer to a pole than this: the lat/lon frame has a singularity there. */
export const LATITUDE_LIMIT = radians(78);
export function createFlight(): FlightState {
  return { lat: radians(-43.3), lon: radians(-11.4), heading: 0, altitude: 0.24,
    targetAltitude: 0.24, speed: 0 };
}
export function stopFlight(state: FlightState) { state.speed = 0; }
export function stepFlight(state: FlightState, dt: number, input: {x: number; y: number} | null, limits={min:MIN_ALTITUDE,max:MAX_ALTITUDE}) {
  dt = clamp(dt, 0, 0.05);
  state.targetAltitude = clamp(state.targetAltitude, limits.min, limits.max);
  state.altitude += (state.targetAltitude - state.altitude) * (1 - Math.exp(-dt * 4));
  if (input) {
    const desired = Math.atan2(input.x, -input.y);
    state.heading = wrap(state.heading + wrap(desired - state.heading) * (1 - Math.exp(-dt * 7)));
  }
  // Speed is proportional to height (capped), so the ground slides past at a readable rate
  // whether skimming low or cruising high. Orbital worlds sit far above their 0.65 cap.
  const targetSpeed = input ? Math.min(state.altitude,0.65) * 0.3 : 0;
  state.speed += (targetSpeed - state.speed) * (1 - Math.exp(-dt * (input ? 7 : 16)));
  if (state.speed < 0.00001) state.speed = 0;
  state.lat += Math.cos(state.heading) * state.speed * dt;
  state.lon = wrap(state.lon + Math.sin(state.heading) * state.speed * dt / Math.max(0.2, Math.cos(state.lat)));
  // Rebound smoothly before the coordinate pole; never cross a singularity.
  if (Math.abs(state.lat) > LATITUDE_LIMIT) {
    state.lat = clamp(state.lat, -LATITUDE_LIMIT, LATITUDE_LIMIT);
    state.heading = wrap(Math.PI - state.heading);
  }
}
export function angularDistance(a: {lat: number; lon: number}, b: {lat: number; lon: number}) {
  return Math.acos(clamp(Math.sin(a.lat) * Math.sin(b.lat) + Math.cos(a.lat) * Math.cos(b.lat) * Math.cos(a.lon - b.lon), -1, 1));
}
