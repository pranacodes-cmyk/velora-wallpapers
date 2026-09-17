import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";

/**
 * RevenueCat is the source of truth, so native UI must not decide whether to
 * show onboarding offers from an empty localStorage cache after a data clear.
 * Keep the branded shell mounted until Play ownership has been reconciled.
 */
export function PremiumBootstrap({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(() => !Capacitor.isNativePlatform());

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let cancelled = false;
    // Never hold the first frame hostage to a slow Play/RevenueCat handshake.
    // After this cap the app renders and reconciliation finishes in background
    // (usePremium re-reads the snapshot, and an open paywall auto-closes).
    const cap = window.setTimeout(() => { if (!cancelled) setReady(true); }, 900);


    const hydrate = async () => {
      try {
        const revenueCat = await import("@/services/revenuecat");
        await revenueCat.initRevenueCat();
        let status = await revenueCat.resolvePremiumStatus();
        // A reinstall may initially be either confirmed-free (new anonymous RC
        // user) or unknown (Play/RC cache still warming). In both cases perform
        // the silent ownership recovery before onboarding or offers can mount.
        if (status !== "premium") {
          // Force this check on every native cold start before onboarding.
          // Google Play restore is silent; correctness for an existing payer is
          // more important than trusting any WebView/Android backup marker.
          const recovered = await revenueCat.recoverEntitlementIfNeeded(true);
          if (recovered !== "unknown") status = recovered;
        }
        if (status !== "unknown") {
          const { syncPremiumState } = await import("@/services/premium-sync");
          await syncPremiumState(status === "premium");
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    };

    void hydrate();
    return () => { cancelled = true; window.clearTimeout(cap); };
  }, []);

  if (!ready) {
    // Plain dark screen while Play ownership reconciles (max ~900ms).
    return <div className="fixed inset-0 bg-background" aria-label="Opening Prayly" />;
  }
  return children;
}