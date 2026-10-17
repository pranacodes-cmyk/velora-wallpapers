import { freeTrialPeriod } from "@/lib/offeringRules";
import { useEffect, useRef, useState } from "react";
import { PremiumSheet } from "@/components/PremiumSheet";
import { usePremium } from "@/hooks/usePremium";
import { acquireOverlay } from "@/lib/overlayQueue";
import { TrialReadyTransition } from "@/components/TrialReadyTransition";
import { AnimatePresence } from "framer-motion";
import {
  ONBOARDING_REPLAY_KEY,
  POST_ONBOARDING_FLOW_COMPLETE_EVENT,
} from "@/components/onboarding/OnboardingFlow";
import { fetchOfferingPackages, isRevenueCatAvailable, trialOffered } from "@/services/revenuecat";
import { markShown } from "@/lib/paywallScheduler";

const SHOWN_KEY = "cw_post_onboarding_premium_shown";

/**
 * Show the Premium sheet once, right after the user finishes onboarding.
 * Coordinates with NotificationPrimer via overlayQueue so the paywall
 * never opens behind the system notification dialog. Only marks SHOWN_KEY
 * after the user actually dismisses the sheet — a kill/crash mid-flow
 * retries on next launch.
 */
export function PostOnboardingPremium() {
  const [open, setOpen] = useState(false);
  const [showTrialTransition, setShowTrialTransition] = useState(false);
  const [previewingReplayOffer, setPreviewingReplayOffer] = useState(false);
  const { isPremium } = usePremium();
  const releaseRef = useRef<(() => void) | null>(null);
  const timersRef = useRef<number[]>([]);
  const handedOffRef = useRef(false);

  const completeOnboardingHandoff = () => {
    if (handedOffRef.current) return;
    handedOffRef.current = true;
    window.dispatchEvent(new Event(POST_ONBOARDING_FLOW_COMPLETE_EVENT));
  };

  // Safety valve: if this component ever goes away (e.g. a purchase flips
  // isPremium to true and the render returns null) before the handoff fired,
  // release the onboarding overlay anyway. Otherwise the user is stranded on
  // the dark intro screen right after paying.
  useEffect(() => {
    return () => {
      if (!handedOffRef.current) {
        window.dispatchEvent(new Event(POST_ONBOARDING_FLOW_COMPLETE_EVENT));
        handedOffRef.current = true;
      }
    };
  }, []);

  // Entitlement updates may arrive while the final onboarding frame is still
  // mounted (restore, purchase, or a CustomerInfo push). Premium users never
  // need the offer; release the onboarding surface immediately rather than
  // relying on a timer owned by the previous free-state effect.
  useEffect(() => {
    if (!isPremium) return;
    setShowTrialTransition(false);
    setOpen(false);
    if (releaseRef.current) {
      releaseRef.current();
      releaseRef.current = null;
    }
    try {
      if (localStorage.getItem("cw_onboarded_v3") === "true") {
        completeOnboardingHandoff();
      }
    } catch {
      completeOnboardingHandoff();
    }
  }, [isPremium]);

  useEffect(() => {
    let cancelled = false;

    const tryOpen = async (showIntro: boolean, allowPremiumReplay = false) => {
      if (cancelled) return;
      // A fresh onboarding run (including a Settings replay) owns the screen
      // again, so the handoff must be allowed to fire once more.
      handedOffRef.current = false;
      if (isPremium && !allowPremiumReplay) {
        completeOnboardingHandoff();
        return;
      }
      try {
        if (!allowPremiumReplay && localStorage.getItem(SHOWN_KEY) === "1") {
          completeOnboardingHandoff();
          return;
        }
      } catch {}
      if (isRevenueCatAvailable()) await fetchOfferingPackages();
      let hasTrial = trialOffered();
      if (!isRevenueCatAvailable()) {
        try {
          const trials = JSON.parse(localStorage.getItem("prayly_preview_trials") ?? '{}');
          hasTrial = Object.entries(trials).some(([id, period]) => freeTrialPeriod(id, typeof period === "string" ? period : null) !== null);
        } catch { hasTrial = false; }
      }
      const release = await acquireOverlay("post_onboarding_premium");
      if (cancelled || (isPremium && !allowPremiumReplay)) {
        release();
        completeOnboardingHandoff();
        return;
      }
      try {
        if (!allowPremiumReplay && localStorage.getItem(SHOWN_KEY) === "1") {
          release();
          completeOnboardingHandoff();
          return;
        }
      } catch {}
      releaseRef.current = release;
      if (allowPremiumReplay) setPreviewingReplayOffer(true);
      // This is the session's premium offer. Count it in the global scheduler
      // so a later notification permission result or home event cannot cause a
      // second automatic paywall immediately after onboarding.
      if (!allowPremiumReplay) markShown();
      const introTimer = window.setTimeout(() => {
        if (cancelled || (isPremium && !allowPremiumReplay)) {
          release(); releaseRef.current = null; return;
        }
        if (!showIntro || !hasTrial) {
          setOpen(true);
          return;
        }
        setShowTrialTransition(true);
        const paywallTimer = window.setTimeout(() => {
          if (cancelled || (isPremium && !allowPremiumReplay)) {
            release(); releaseRef.current = null; return;
          }
          setOpen(true);
        }, 3200);
        // Let the Premium sheet finish mounting beneath the opaque transition,
        // then reveal it. There is never a blank frame or overlapping motion.
        const revealPaywallTimer = window.setTimeout(() => {
          if (!cancelled) setShowTrialTransition(false);
        }, 3460);
        timersRef.current.push(paywallTimer, revealPaywallTimer);
      }, 0);

      timersRef.current.push(introTimer);
    };

    const onComplete = (event: Event) => {
      let persistedReplay = false;
      try {
        persistedReplay = localStorage.getItem(ONBOARDING_REPLAY_KEY) === "1";
        localStorage.removeItem(ONBOARDING_REPLAY_KEY);
      } catch {}
      const replay = persistedReplay || (event instanceof CustomEvent && event.detail?.replay === true);
      if (replay) {
        completeOnboardingHandoff();
        return;
      }
      void tryOpen(true, replay);
    };
    window.addEventListener("onboarding-complete", onComplete);

    // Recovery: onboarding completed previously but the sheet never opened.
    try {
      const onboarded = localStorage.getItem("cw_onboarded_v3") === "true";
      const shown = localStorage.getItem(SHOWN_KEY) === "1";
      if (onboarded && !shown && !isPremium) {
        const recoveryTimer = window.setTimeout(() => void tryOpen(false), 2500);
        timersRef.current.push(recoveryTimer);
      }
    } catch {}

    return () => {
      cancelled = true;
      window.removeEventListener("onboarding-complete", onComplete);
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
      timersRef.current = [];
      if (releaseRef.current) { releaseRef.current(); releaseRef.current = null; }
    };
  }, [isPremium]);

  // Stay mounted while the sheet is open even if the purchase flips isPremium —
  // otherwise the sheet unmounts mid-flow and the onboarding handoff never runs.
  if (isPremium && !previewingReplayOffer && !open) return null;

  const handleClose = () => {
    setOpen(false);
    setPreviewingReplayOffer(false);
    try { localStorage.setItem(SHOWN_KEY, "1"); } catch {}
    if (releaseRef.current) { releaseRef.current(); releaseRef.current = null; }
    // Keep the midnight onboarding surface behind the sheet until its exit
    // animation is fully gone; only then mount the homepage.
    // NOT tracked in timersRef on purpose: a purchase flips isPremium, which
    // re-runs the effect cleanup and would clear this timer, leaving the
    // onboarding overlay on screen forever.
    window.setTimeout(() => {
      completeOnboardingHandoff();
      window.dispatchEvent(new Event("prayly:request-notifications-after-paywall"));
    }, 260);
  };

  return (
    <>
      <AnimatePresence>
        {showTrialTransition && <TrialReadyTransition visible />}
      </AnimatePresence>
      <PremiumSheet
        isOpen={open}
        onClose={handleClose}
        onUnlock={handleClose}
        trigger="post_onboarding"
      />
    </>
  );
}
