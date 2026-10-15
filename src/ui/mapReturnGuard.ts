/** Protect the old Space map button's footprint while a return settles.
 * Other destinations and keyboard input remain immediately available. The interval starts
 * when the map appears, so software-rendered returns and reduced-motion cuts agree.
 */
export const MAP_RETURN_REPEAT_MS = 1200;
type Point = { clientX: number; clientY: number };
type Bounds = { left: number; right: number; top: number; bottom: number };

export function createMapReturnGuard(target: EventTarget, now = () => performance.now()) {
  let bounds: Bounds | null = null;
  let readyAt: number | null = null;
  let blockedClick = false;
  const blockedPointers = new Set<number>();
  const reset = () => { bounds = null; readyAt = null; blockedClick = false; blockedPointers.clear(); };
  function protectedPoint(point: Point) {
    if (!bounds) return false;
    if (readyAt !== null && now() - readyAt >= MAP_RETURN_REPEAT_MS) {
      bounds = null;
      return false;
    }
    return point.clientX >= bounds.left - 12 && point.clientX <= bounds.right + 12 &&
      point.clientY >= bounds.top - 12 && point.clientY <= bounds.bottom + 12;
  }
  function stop(event: Event) { event.preventDefault(); event.stopImmediatePropagation(); }
  const down = (event: Event) => {
    const pointer = event as PointerEvent;
    blockedClick = protectedPoint(pointer);
    if (blockedClick) { blockedPointers.add(pointer.pointerId); stop(event); }
    else { bounds = null; readyAt = null; }
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
      if (event.detail !== 0) bounds = { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
    },
    mapShown() { if (bounds && readyAt === null) readyAt = now(); },
    reset,
    dispose() {
      reset();
      for (const [type, listener] of listeners) target.removeEventListener(type, listener, { capture: true });
    },
  };
}
