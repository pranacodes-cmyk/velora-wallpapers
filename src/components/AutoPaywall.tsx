import { useEffect, useRef, useState } from "react";
import { PremiumSheet } from "@/components/PremiumSheet";
import { usePremium } from "@/hooks/usePremium";
import { useIsOnboardingActive } from "@/contexts/OnboardingContext";
import { acquireOverlay } from "@/lib/overlayQueue";
import {
  firePaywallTrigger,
  maybeFireUsageMilestonePaywall,
  markDismissed,
  markConverted,
  type PaywallReason,
} from "@/lib/paywallScheduler";

/**
 * Global mount that listens for `paywall-trigger` events fired from
 * pain-point moments and opens the Premium sheet. Coordinates with the
 * overlay queue so we never stack on top of another sheet.
 */
export function AutoPaywall() {
  const { isPremium } = usePremium();
  const isOnboardingActive = useIsOnboardingActive();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<PaywallReason>("manual");
  const releaseRef = useRef<(() => void) | null>(null);
  const pausedRef = useRef(isOnboardingActive);
  pausedRef.current = isOnboardingActive;

  useEffect(() => {
    // Cold-launch session counter — fires a trigger every Nth open.
    // Never consume or emit this trigger behind onboarding; the dedicated
    // post-onboarding offer owns that journey and must be the only paywall.
    if (isOnboardingActive) return;
    try {
      firePaywallTrigger("app_session");
      // One-time day-4 offer — the habit is formed, the limits have been felt.
      setTimeout(() => maybeFireUsageMilestonePaywall(), 2500);
    } catch {}
  }, [isOnboardingActive]);

  useEffect(() => {
    const onTrigger = async (e: Event) => {
      if (pausedRef.current || isPremium) return;
      const detail = (e as CustomEvent).detail as { reason?: PaywallReason } | undefined;
      const r = (detail?.reason ?? "manual") as PaywallReason;
      const release = await acquireOverlay(`auto_paywall_${r}`);
      if (pausedRef.current || isPremium) { release(); return; }
      releaseRef.current = release;
      setReason(r);
      // Tiny breath so any prior overlay's exit anim finishes.
      setTimeout(() => setOpen(true), 220);
    };
    window.addEventListener("paywall-trigger", onTrigger as EventListener);
    return () => window.removeEventListener("paywall-trigger", onTrigger as EventListener);
  }, [isPremium]);

  if (isPremium) return null;

  const close = () => {
    setOpen(false);
    markDismissed();
    if (releaseRef.current) { releaseRef.current(); releaseRef.current = null; }
  };
  const unlock = () => {
    setOpen(false);
    markConverted();
    if (releaseRef.current) { releaseRef.current(); releaseRef.current = null; }
  };

  return (
    <PremiumSheet
      isOpen={open}
      onClose={close}
      onUnlock={unlock}
      trigger={`auto_${reason}`}
    />
  );
}
