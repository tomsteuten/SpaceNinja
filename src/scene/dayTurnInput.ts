import { dragAngle } from '../controls/OrbitInput';
import type { DayTurn } from './DayTurn';

/** Pointer input belongs to the activity while it owns the camera, not to orbit controls. */
export function createDayTurnInput(canvas: HTMLCanvasElement, turn: DayTurn, onTouch: () => void) {
  let pointer: { id: number; x: number; y: number; moved: number } | null = null;
  function down(event: PointerEvent) {
    if (!turn.interactive) return;
    // A second finger is not a tap or a one-finger turn. Stop the gesture until release.
    if (pointer) { pointer = null; return; }
    if (!event.isPrimary) return;
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: 0 };
    turn.turnBy(0); // Catch any assisted motion immediately, before the first move event.
    onTouch();
    try { canvas.setPointerCapture(event.pointerId); } catch { /* Capture is optional. */ }
  }
  function move(event: PointerEvent) {
    if (!pointer || pointer.id !== event.pointerId) return;
    const dx = event.clientX - pointer.x;
    const dy = event.clientY - pointer.y;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.moved += Math.hypot(dx, dy);
    if (turn.interactive) turn.turnBy(dragAngle(dx, Math.min(canvas.clientWidth, canvas.clientHeight)));
  }
  function up(event: PointerEvent) {
    if (!pointer || pointer.id !== event.pointerId) return;
    if (turn.interactive && pointer.moved < 12 && event.type === 'pointerup') turn.nudge();
    pointer = null;
  }
  const clear = () => { pointer = null; };
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  // Finish before OrbitInput's bubbling handler releases this same canvas's capture.
  // Otherwise lostpointercapture can erase a legitimate tap before we receive it.
  canvas.addEventListener('pointerup', up, true);
  canvas.addEventListener('pointercancel', up, true);
  canvas.addEventListener('lostpointercapture', clear);
  return {
    clear,
    dispose() {
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up, true);
      canvas.removeEventListener('pointercancel', up, true);
      canvas.removeEventListener('lostpointercapture', clear);
    },
  };
}
