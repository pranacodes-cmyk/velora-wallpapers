import { describe, it, expect, beforeEach, vi } from "vitest";

// Minimal DOM shims — the rating service only needs localStorage + events.
const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
};
const bus = new EventTarget();
(globalThis as any).window = {
  addEventListener: bus.addEventListener.bind(bus),
  removeEventListener: bus.removeEventListener.bind(bus),
  dispatchEvent: bus.dispatchEvent.bind(bus),
};
if (!(globalThis as any).CustomEvent) {
  (globalThis as any).CustomEvent = class extends Event {} as any;
}

vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: () => false } }));
vi.mock("@capacitor-community/in-app-review", () => ({ InAppReview: { requestReview: async () => {} } }));
vi.mock("@/services/analytics", () => ({ track: () => {} }));

import { maybeRequestRating, ratingBlockReason, _resetRating } from "@/services/rating";
import { markOverlayVisible } from "@/lib/overlayQueue";

describe("rating guarantee", () => {
  beforeEach(() => {
    localStorage.clear();
    _resetRating();
  });

  it("always lets the very first prompt through", () => {
    expect(ratingBlockReason()).toBe(null);
    const shown = vi.fn();
    window.addEventListener("jw:show-rating-prompt", shown);
    expect(maybeRequestRating()).toBe(true);
    expect(shown).toHaveBeenCalledTimes(1);
  });

  it("applies cooldown only after the first prompt", () => {
    expect(maybeRequestRating()).toBe(true);
    expect(maybeRequestRating()).toBe(false);
    expect(ratingBlockReason()).toBe("session_gap");
  });

  it("defers behind a self-managed paywall then fires when it closes", async () => {
    // bun's vi shim lacks advanceTimersByTime — use real timers here.
    const dispose = markOverlayVisible("premium_sheet_test");
    const shown = vi.fn();
    window.addEventListener("jw:show-rating-prompt", shown);
    expect(maybeRequestRating()).toBe(false);
    await new Promise((r) => setTimeout(r, 4300));
    expect(shown).not.toHaveBeenCalled();
    dispose();
    await new Promise((r) => setTimeout(r, 2600));
    expect(shown).toHaveBeenCalledTimes(1);
  }, 10000);

  it("never asks again after the user rated or opted out", () => {
    localStorage.setItem("jw_rating_done", "1");
    expect(maybeRequestRating()).toBe(false);
    localStorage.clear();
    localStorage.setItem("jw_rating_opt_out", "1");
    expect(maybeRequestRating()).toBe(false);
  });
});
