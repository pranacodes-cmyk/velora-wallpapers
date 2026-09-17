import { useState } from "react";
import { Capacitor } from "@capacitor/core";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";

/**
 * Device-only Pro reset (admin tool).
 *
 * Wipes every local trace of the premium entitlement on THIS phone so the app
 * behaves exactly like a fresh free install:
 *  - premium cache + ad-free window
 *  - strike / grace guard counters (premium-sync)
 *  - the one-shot silent restore flag (so a reinstall-style restore can run again)
 *  - the RevenueCat anonymous app user id (logOut mints a brand new one)
 *  - the parallax live wallpaper, if ours is currently applied
 *
 * It does NOT cancel or refund the Google Play subscription — if the Play
 * account still owns an active sub, a manual "Restore purchases" (or the next
 * silent recovery) can bring Pro back.
 */
const LOCAL_KEYS = [
  "cw_premium_unlocked",
  "cw_ad_free_until",
  "cw_premium_free_strikes",
  "cw_premium_grace_until",
  "cw_rc_auto_restored_v1",
];

export default function DevicePremiumReset() {
  const [busy, setBusy] = useState(false);

  const reset = async () => {
    setBusy(true);
    try {
      // 1. Local premium cache + guards
      for (const k of LOCAL_KEYS) {
        try { localStorage.removeItem(k); } catch { /* ignore */ }
      }

      // 2. Fresh RevenueCat anonymous identity on this device
      if (Capacitor.isNativePlatform()) {
        try {
          const { Purchases } = await import("@revenuecat/purchases-capacitor");
          await (Purchases as any).logOut?.();
        } catch { /* not logged in / not initialised — fine */ }
      }

      // 3. Drop the Pro live wallpaper if ours is active, and re-sync native state
      try {
        const { syncPremiumState } = await import("@/services/premium-sync");
        await syncPremiumState(false);
      } catch { /* ignore */ }

      // 4. Tell every usePremium() subscriber
      try { window.dispatchEvent(new Event("cw:premium-change")); } catch { /* ignore */ }

      toast.success("Pro reset on this device — reloading…");
      setTimeout(() => window.location.reload(), 900);
    } catch (e: any) {
      toast.error(`Reset failed: ${e?.message ?? e}`);
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card/50 p-4 mb-4">
      <h3 className="text-sm font-semibold text-foreground">Reset Pro (this device only)</h3>
      <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
        Clears the local Pro cache, strike/grace guards, the one-shot restore flag and the
        RevenueCat anonymous ID, and removes our live wallpaper if it's applied. Does not
        cancel the Play subscription — restoring purchases can bring Pro back.
      </p>
      <button
        onClick={reset}
        disabled={busy}
        className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-destructive text-destructive-foreground text-xs font-semibold disabled:opacity-50"
      >
        <RotateCcw className="w-3.5 h-3.5" />
        {busy ? "Resetting…" : "Reset Pro on this device"}
      </button>
    </div>
  );
}
