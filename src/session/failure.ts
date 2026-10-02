const boot = document.getElementById('boot');

/**
 * The boot screen doubles as the failure screen. `crash` is the mid-session case: the
 * frame loop threw, the picture underneath is the last good frame, and without this the
 * only signal a tablet gives is a child saying it stopped. The words differ, there is a
 * button that reloads, and the error itself is printed small for whoever reports it.
 */
export function fail(message: string, error: unknown, crash = false) {
  console.error(message, error);
  if (!boot) return;
  boot.classList.add('has-error');
  boot.classList.toggle('has-crash', crash);
  boot.classList.remove('is-hidden');
  if (!crash) return;
  const detail = boot.querySelector('.boot-detail');
  if (detail) detail.textContent = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  boot.querySelector('.boot-restart')?.addEventListener('click', () => window.location.reload(), {
    once: true,
  });
}
