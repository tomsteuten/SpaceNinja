/** Browser lifetime shared by adventure and free flight; gameplay reset stays route-owned. */
export function createSessionLifecycle(options: {
  stage: { start(): void; stop(): void; onCrash(handler: (error: unknown) => void): void };
  document: EventTarget & { readonly hidden: boolean };
  window: EventTarget;
  suspend(): void;
  reset?(): void;
  dispose(): void;
  fail(error: unknown): void;
}) {
  let state: 'paused' | 'running' | 'crashed' | 'disposed' = 'paused';
  let inHistory = false;

  function pause() {
    if (state !== 'running') return;
    state = 'paused';
    options.stage.stop();
    options.suspend();
  }
  function resume() {
    if (state !== 'paused' || options.document.hidden || inHistory) return;
    state = 'running';
    options.stage.start();
  }
  function visibility() {
    if (options.document.hidden) pause();
    else resume();
  }
  function pagehide(event: Event) {
    if ((event as PageTransitionEvent).persisted) {
      inHistory = true;
      pause();
    } else dispose();
  }
  function pageshow() {
    inHistory = false;
    resume();
  }
  function dispose() {
    if (state === 'disposed') return;
    options.stage.stop();
    state = 'disposed';
    options.document.removeEventListener('visibilitychange', visibility);
    options.window.removeEventListener('pagehide', pagehide);
    options.window.removeEventListener('pageshow', pageshow);
    options.suspend();
    options.dispose();
  }
  options.stage.onCrash((error) => {
    if (state === 'disposed' || state === 'crashed') return;
    state = 'crashed';
    options.stage.stop();
    options.suspend();
    options.fail(error);
  });
  options.document.addEventListener('visibilitychange', visibility);
  options.window.addEventListener('pagehide', pagehide);
  options.window.addEventListener('pageshow', pageshow);
  return {
    start: resume,
    dispose,
    restart() {
      if (state === 'crashed' || state === 'disposed') return;
      options.reset?.();
    },
  };
}
