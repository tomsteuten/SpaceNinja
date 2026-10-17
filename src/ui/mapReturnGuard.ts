/** Protect the old Space map button's footprint against the rest of the same tapping.
 *
 * A double tap on Space map used to land its second press on whatever destination sits
 * underneath once the map is back. The window runs from the press that returned (and is
 * extended by each press it rejects), so a fast or roughly one-second repeat is caught, while
 * a deliberate choice made after a pause, at any spot, always goes through. During an
 * animated return the destination buttons are not on screen, so a repeat there cannot launch
 * anything; the window only matters for an instant return, where press and map coincide.
 * Other locations and keyboard input are never delayed.
 */
export const MAP_RETURN_REPEAT_MS = 1200;
type Point = { clientX: number; clientY: number };
type Bounds = { left: number; right: number; top: number; bottom: number };

export function createMapReturnGuard(target: EventTarget, now = () => performance.now()) {
  let bounds: Bounds | null = null;
  let lastPress = 0;
  let blockedClick = false;
  const blockedPointers = new Set<number>();
  const reset = () => { bounds = null; blockedClick = false; blockedPointers.clear(); };
  function guarding() {
    if (bounds && now() - lastPress >= MAP_RETURN_REPEAT_MS) bounds = null;
    return bounds !== null;
  }
  function protectedPoint(point: Point) {
    if (!guarding() || !bounds) return false;
    return point.clientX >= bounds.left - 12 && point.clientX <= bounds.right + 12 &&
      point.clientY >= bounds.top - 12 && point.clientY <= bounds.bottom + 12;
  }
  function stop(event: Event) { event.preventDefault(); event.stopImmediatePropagation(); }
  const down = (event: Event) => {
    const pointer = event as PointerEvent;
    blockedClick = protectedPoint(pointer);
    if (blockedClick) {
      lastPress = now();
      blockedPointers.add(pointer.pointerId);
      stop(event);
    } else bounds = null;
  };
  const up = (event: Event) => {
    const pointer = event as PointerEvent;
    if (blockedPointers.delete(pointer.pointerId)) stop(event);
  };
  const click = (event: Event) => {
    const mouse = event as MouseEvent;
    if (mouse.detail === 0) { reset(); return; }
    if (blockedClick || protectedPoint(mouse)) stop(event);
    blockedClick = false;
  };
  const listeners: [string, EventListener][] = [
    ['pointerdown', down], ['pointerup', up], ['pointercancel', up], ['click', click], ['keydown', reset],
  ];
  for (const [type, listener] of listeners) target.addEventListener(type, listener, { capture: true });
  return {
    arm(rect: Bounds, event: { detail: number }) {
      reset();
      if (event.detail === 0) return;
      bounds = { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
      lastPress = now();
    },
    /** True while a repeat over the old footprint would still be rejected. */
    get active() { return guarding(); },
    reset,
    dispose() {
      reset();
      for (const [type, listener] of listeners) target.removeEventListener(type, listener, { capture: true });
    },
  };
}
