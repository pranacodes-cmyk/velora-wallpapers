/**
 * Tiny serial lock for post-onboarding overlays so the native notification
 * prompt, the premium paywall, and the daily permission nudge don't race
 * each other or stack on top of one another.
 *
 * Each overlay calls `acquireOverlay()` before showing itself and the
 * returned `release()` when it's fully dismissed. Anyone who acquires
 * while the lock is held waits in FIFO order.
 */

type Releaser = () => void;

let holder: string | null = null;
const waiters: Array<{ name: string; resolve: (r: Releaser) => void }> = [];

function makeReleaser(name: string): Releaser {
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (holder !== name) return;
    holder = null;
    const next = waiters.shift();
    if (next) {
      holder = next.name;
      next.resolve(makeReleaser(next.name));
    }
  };
}

export function acquireOverlay(name: string): Promise<Releaser> {
  return new Promise((resolve) => {
    if (holder === null) {
      holder = name;
      resolve(makeReleaser(name));
      return;
    }
    waiters.push({ name, resolve });
  });
}

export function currentOverlayHolder() {
  return holder;
}

/**
 * Lightweight visibility registry for sheets that manage their own local
 * state and therefore can't take the serial lock (e.g. a PremiumSheet opened
 * straight from a page). They only need to advertise "I'm on screen right
 * now" so the rating prompt can wait instead of firing underneath them.
 */
const visible = new Set<string>();

export function markOverlayVisible(name: string): () => void {
  visible.add(name);
  let done = false;
  return () => {
    if (done) return;
    done = true;
    visible.delete(name);
  };
}

/** True when the serial lock is held OR any self-managed sheet is on screen. */
export function anyOverlayVisible(): boolean {
  return holder !== null || visible.size > 0;
}

/** Debug label of whatever is currently on screen. */
export function visibleOverlayLabel(): string | null {
  return holder ?? (visible.size ? Array.from(visible)[0] : null);
}

