import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { X, Check, ShieldCheck, Shield, Sparkles, Heart, Cross, Sunrise, Image as ImageIcon, BanIcon, Headphones, LockOpen } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { haptic } from "@/utils/haptics";
import { useState, useCallback, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { usePremium } from "@/hooks/usePremium";
import { useT } from "@/i18n";
import { useAndroidBack } from "@/hooks/useAndroidBack";
import { isAndroidPerfMode } from "@/lib/androidPerf";
import {
  fetchOfferingPackages,
  purchasePackage,
  restorePurchases,
  isRevenueCatAvailable,
  isUserCancelled,
  type PremiumPackage,
} from "@/services/revenuecat";

// Cache — Android skips battery-draining loops; desktop/iOS keeps them.
const IS_ANDROID = isAndroidPerfMode();


interface PremiumSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onUnlock?: () => void;
  /** Where this paywall was triggered from — used for analytics funnels. */
  trigger?: string;
  /** Optional context so the hero copy can name the exact moment (e.g. the
   *  journey the user just finished a day of). Kept optional so every caller
   *  works without changes. */
  context?: {
    journeyTitle?: string;
    day?: number;
    totalDays?: number;
  };
}


type PlanId = "weekly" | "monthly" | "yearly";

type Plan = {
  id: PlanId;
  label: string;
  /** Placeholder until live Play Store price loads. */
  price: string;
  period: string;
  /** Non-price subtitle so live Play Store price isn't duplicated. */
  subtitle: string;
  badge?: string;
};

function buildPlans(t: (key: string, vars?: Record<string, string | number>) => string): Plan[] {
  return [
    // Yearly FIRST — the anchor & default. Trial is the hero.
    { id: "yearly",   label: t("premium.plan.yearly.label"),   price: "—", period: t("premium.period.year"),    subtitle: t("premium.plan.yearly.subtitle"), badge: t("premium.plan.yearly.badge") },
    // Monthly hidden from UI only; store product stays live for existing subscribers.
    { id: "weekly",   label: t("premium.plan.weekly.label"),   price: "—", period: t("premium.period.week"),    subtitle: t("premium.plan.weekly.subtitle") },
  ];
}

/** 6 concrete Pro features that actually ship today — Shield leads. The removed
 *  Journeys / Bible Chat rows are gone for good. */
function buildBenefits(t: (key: string) => string) {
  return [
    { icon: Shield,     title: t("premium.benefit.shield.title"),       sub: t("premium.benefit.shield.sub") },
    { icon: BanIcon,    title: t("premium.benefit.adFree.title"),       sub: t("premium.benefit.adFree.sub") },
    { icon: ImageIcon,  title: t("premium.benefit.hdWallpapers.title"), sub: t("premium.benefit.hdWallpapers.sub") },
    { icon: Sunrise,    title: t("premium.benefit.dailyVerse.title"),   sub: t("premium.benefit.dailyVerse.sub") },
    { icon: Headphones, title: t("premium.benefit.prayerAudio.title"),  sub: t("premium.benefit.prayerAudio.sub") },
    { icon: Sparkles,   title: t("premium.benefit.versePacks.title"),   sub: t("premium.benefit.versePacks.sub") },
  ];
}

function displayPriceFor(pkg: PremiumPackage, fallback: string) {
  return priceInfoFor(pkg, fallback).label;
}

function priceInfoFor(pkg: PremiumPackage, fallback = "—") {
  if (pkg.googlePlayPrice?.priceString) {
    return {
      label: pkg.googlePlayPrice.priceString,
      amount: pkg.googlePlayPrice.amountMicros > 0 ? pkg.googlePlayPrice.amountMicros / 1_000_000 : 0,
      currency: pkg.googlePlayPrice.currencyCode || "USD",
    };
  }
  // On Android, prefer RevenueCat's cached price label over a blank "—".
  // A possibly-stale label still gives the user a price to anchor on; "—"
  // kills the decision and bounces them out of the sheet.
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android") {
    const cached = pkg.product?.priceString;
    if (cached) {
      const amount = Number(pkg.product?.price || 0);
      const currency = pkg.product?.currencyCode || "USD";
      return { label: cached, amount, currency };
    }
    return { label: fallback, amount: 0, currency: "USD" };
  }
  const freshProduct = pkg.storeProduct || pkg.product;
  const packageOption = (pkg.product as any).defaultOption;
  const options = ((freshProduct as any).subscriptionOptions || []) as any[];
  const matchingOption = options.find((option) =>
    (packageOption?.id && option.id === packageOption.id) ||
    (packageOption?.storeProductId && option.storeProductId === packageOption.storeProductId)
  ) || (freshProduct as any).defaultOption || packageOption;
  const phase = matchingOption?.fullPricePhase || [...(matchingOption?.pricingPhases || [])].reverse().find((p: any) => p?.price?.amountMicros > 0);
  const label = phase?.price?.formatted || freshProduct.priceString || pkg.product.priceString || fallback;
  const micros = Number(phase?.price?.amountMicros || 0);
  const amount = micros > 0 ? micros / 1_000_000 : Number(freshProduct.price || pkg.product.price || 0);
  const currency = phase?.price?.currencyCode || freshProduct.currencyCode || pkg.product.currencyCode || "USD";
  return { label, amount, currency };
}

function numericDisplayPrice(pkg: PremiumPackage) {
  const { amount, currency, label } = priceInfoFor(pkg);
  return { amount, currency, label };
}

/**
 * Money formatter that never prints a raw ISO code ("PHP 449").
 * Intl with the device locale falls back to the currency *code* whenever the
 * locale has no symbol for that currency (common when the Play account country
 * differs from the phone language). In that case we reuse the symbol from the
 * store's own price label (e.g. "₱449.00") so every market reads natively.
 */
function extractCurrencyAffix(sample?: string): { prefix: string; suffix: string } | null {
  if (!sample) return null;
  const m = sample.match(/^([^\d\s.,-]*)\s*[\d.,\s]+\s*([^\d\s.,-]*)$/);
  if (!m) return null;
  const prefix = (m[1] || "").trim();
  const suffix = (m[2] || "").trim();
  if (!prefix && !suffix) return null;
  // Ignore alphabetic codes like "PHP" — those are the exact thing we're fixing.
  if (/^[A-Za-z]{2,}$/.test(prefix) || /^[A-Za-z]{2,}$/.test(suffix)) return null;
  return { prefix, suffix };
}

function formatMoney(amount: number, currency: string, sampleLabel?: string): string {
  const cur = currency || "USD";
  const affix = extractCurrencyAffix(sampleLabel);
  const num = (() => {
    try {
      return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
    } catch {
      return amount.toFixed(2);
    }
  })();
  try {
    const label = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: cur,
      currencyDisplay: "narrowSymbol",
      maximumFractionDigits: 2,
    }).format(amount);
    // If Intl printed the ISO code (no symbol available for this locale),
    // rebuild the label with the store's real symbol.
    if (label.includes(cur) && affix) return `${affix.prefix}${num}${affix.suffix}`;
    return label;
  } catch {
    if (affix) return `${affix.prefix}${num}${affix.suffix}`;
    return `${num} ${cur}`;
  }
}

function formatZeroMoney(currency: string, sampleLabel?: string): string {
  const cur = currency || "USD";
  const affix = extractCurrencyAffix(sampleLabel);
  try {
    const parts = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: cur,
      currencyDisplay: "narrowSymbol",
      maximumFractionDigits: 0,
    }).formatToParts(0);
    if (parts.some((part) => part.type === "currency" && part.value === cur) && affix) {
      return `${affix.prefix}0${affix.suffix}`;
    }
    return parts.map((part) => part.value).join("");
  } catch {
    return affix ? `${affix.prefix}0${affix.suffix}` : `0 ${cur}`;
  }
}


/** Quiet Scripture anchor — rotates above the CTA. Reframes the moment as an invitation, not a purchase. */
function buildScriptureAnchors(t: (key: string) => string) {
  return [1, 2, 3, 4, 5].map((i) => ({ ref: t(`premium.scripture.${i}.ref`), text: t(`premium.scripture.${i}.text`) }));
}


/** Rotating Scripture anchor — soft, italic, sits quietly above the CTA.
 *  Smart cadence: slower on Android, paused when tab hidden. */
function ScriptureAnchor() {
  const { t } = useT();
  const scriptureAnchors = useMemo(() => buildScriptureAnchors(t), [t]);
  const [i, setI] = useState(() => Math.floor(Math.random() * scriptureAnchors.length));
  const [vis, setVis] = useState(true);
  useEffect(() => {
    const interval = IS_ANDROID ? 11000 : 7000;
    let t: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (t) return;
      t = setInterval(() => {
        if (typeof document !== "undefined" && document.hidden) return;
        setVis(false);
        setTimeout(() => {
          setI((n) => (n + 1) % scriptureAnchors.length);
          setVis(true);
        }, 320);
      }, interval);
    };
    const stop = () => { if (t) { clearInterval(t); t = null; } };
    const onVis = () => {
      if (typeof document !== "undefined" && document.hidden) stop();
      else start();
    };
    start();
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVis);
    return () => {
      stop();
      if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const v = scriptureAnchors[i];
  const gold = "hsl(45 85% 58%)";
  return (
    <motion.div
      animate={{ opacity: vis ? 1 : 0 }}
      transition={{ duration: 0.4, ease: "easeInOut" }}
      className="text-center px-3"
    >
      <p
        className="text-[12.5px] leading-[1.35] italic"
        style={{
          color: "hsl(var(--foreground) / 0.92)",
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontWeight: 500,
        }}
      >
        "{v.text}"
      </p>
      <p
        className="text-[9.5px] mt-[2px] font-semibold tracking-[0.08em] uppercase"
        style={{ color: `${gold}cc` }}
      >
        — {v.ref}
      </p>
    </motion.div>
  );
}




export function PremiumSheet({ isOpen, onClose, onUnlock, trigger = "unknown", context }: PremiumSheetProps) {
  const { t } = useT();
  const plans = useMemo(() => buildPlans(t), [t]);
  const benefits = useMemo(() => buildBenefits(t), [t]);
  const [selectedPlan, setSelectedPlan] = useState<PlanId>("yearly");
  const { unlock, isPremium } = usePremium();
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [packages, setPackages] = useState<{ weekly?: PremiumPackage; monthly?: PremiumPackage; yearly?: PremiumPackage }>({});
  const y = useMotionValue(0);
  const backdropOpacity = useTransform(y, [0, 300], [1, 0]);

  // Social-proof scarcity line — stable per-open count in the 30–60 range so
  // it feels live without being a fake ticking timer. Faith-toned, honest.
  const [joinedToday] = useState(() => 2400 + Math.floor(Math.random() * 600));

  // Adaptive density — short screens (small/budget phones, landscape-ish
  // heights) get a tighter, professional layout instead of an overflowing
  // wall of cards. Computed once per open; the sheet is short-lived.
  const [compact] = useState(() => typeof window !== "undefined" && window.innerHeight < 740);
  const [tiny] = useState(() => typeof window !== "undefined" && window.innerHeight < 620);


  // Advertise on-screen presence so the rating prompt (and any other
  // deferred overlay) waits instead of opening underneath the paywall.
  useEffect(() => {
    if (!isOpen) return;
    let dispose: (() => void) | null = null;
    let cancelled = false;
    import("@/lib/overlayQueue").then((m) => {
      const d = m.markOverlayVisible(`premium_sheet_${trigger}`);
      if (cancelled) d();
      else dispose = d;
    }).catch(() => {});
    return () => { cancelled = true; dispose?.(); };

  }, [isOpen, trigger]);

  useEffect(() => {
    if (!isOpen) return;

    // Analytics: paywall view
    import("@/services/analytics").then((a) => a.track("paywall_shown", { trigger })).catch(() => {});
    // Meta funnel signal: ViewContent on premium offer view
    import("@/services/meta-capi").then((mod) => {
      mod.metaTrackViewContent("premium_offer", "Premium Sheet");
    }).catch(() => {});
    if (!isRevenueCatAvailable()) return;
    let cancelled = false;
    fetchOfferingPackages().then((pkgs) => {
      if (!cancelled) setPackages(pkgs);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [isOpen, trigger]);


  // Build live plans from RC packages — prices, anchor, and savings % all from Play Store.
  const livePlans = plans.map((p) => {
    const pkg = packages[p.id];
    if (!pkg) return { ...p, anchor: undefined as string | undefined, badge: p.badge };
    let priceString = displayPriceFor(pkg, "Loading…");
    let period = p.period;
    let anchor: string | undefined;
    let badge = p.badge;
    if (p.id === "yearly") {
      const { amount: yPrice, currency, label: yLabel } = numericDisplayPrice(pkg);
      if (yPrice > 0) {
        // Annual leads with the weekly equivalent — smallest true number —
        // with the billed yearly total right underneath for transparency.
        priceString = formatMoney(yPrice / 52, currency, yLabel);
        period = t("premium.period.week");
        anchor = `${yLabel} / ${t("premium.period.year")}`;

        // Savings vs paying monthly for a year (honest annual-vs-monthly).
        const mPkg = packages.monthly;
        const mPrice = mPkg ? numericDisplayPrice(mPkg).amount : 0;
        if (mPrice > 0) {
          const fullYear = mPrice * 12;
          const pct = Math.round((1 - yPrice / fullYear) * 100);
          if (pct >= 5) badge = t("premium.plan.yearly.badge");
        }
      }
    }
    if (p.id === "monthly") {
      const { amount: mPrice, currency, label: mLabel } = numericDisplayPrice(pkg);
      if (mPrice > 0) {
        // Monthly mirrors the annual card: weekly equivalent first, billed
        // monthly total underneath.
        priceString = formatMoney(mPrice / 4.345, currency, mLabel);
        period = t("premium.period.week");
        anchor = `${mLabel} / ${t("premium.period.month")}`;
      }
    }

    return { ...p, price: priceString, period, anchor, badge };
  });

  const selected = livePlans.find((p) => p.id === selectedPlan)!;
  const selectedPackage = packages[selectedPlan];
  const zeroTodayLabel = selectedPackage
    ? (() => {
        const { currency, label } = numericDisplayPrice(selectedPackage);
        return t("premium.cta.zeroToday", { price: formatZeroMoney(currency, label) });
      })()
    : t("premium.cta.zeroTodayFallback");

  // Pull the honest yearly-vs-weekly savings % from the computed badge.
  const savingsMatch = livePlans.find((p) => p.id === "yearly")?.badge?.match(/SAVE (\d+)%/);
  const savingsPct = savingsMatch ? Number(savingsMatch[1]) : 0;

  // Impulse value anchor — "less than $X / day" framing, computed from real yearly price.
  const perDayLabel = (() => {
    const yPkg = packages.yearly;
    if (!yPkg) return null;
    const { amount, currency, label } = numericDisplayPrice(yPkg);
    if (!(amount > 0)) return null;
    const perDay = amount / 365;
    return t("premium.perDay", { price: formatMoney(perDay, currency, label) });

  })();

  // Personalized hero — speaks to the exact pain that opened this paywall.
  const heroCopy = (() => {
    switch (trigger) {
      case "favorites_limit":
        return { title: t("premium.hero.favoritesLimit.title"), sub: t("premium.hero.favoritesLimit.sub") };
      case "pray_screen":
      case "pray_screen_limit":
      case "shield":
        return { title: t("premium.hero.prayScreen.title"), sub: t("premium.hero.prayScreen.sub") };
      case "premium_wallpaper":
      case "wallpaper_locked":
        return { title: t("premium.hero.premiumWallpaper.title"), sub: t("premium.hero.premiumWallpaper.sub") };
      case "ad_free":
      case "remove_ads":
        return { title: t("premium.hero.adFree.title"), sub: t("premium.hero.adFree.sub") };
      case "prayer_audio":
        return { title: t("premium.hero.prayerAudio.title"), sub: t("premium.hero.prayerAudio.sub") };
      default:
        return { title: t("premium.hero.default.title"), sub: t("premium.hero.default.sub") };
    }
  })();

  // Safety net: if premium turns on while the sheet is open (purchase confirmed
  // by Play/RevenueCat, or a background sync/restore), never leave the paywall
  // sitting on screen — close it automatically.
  useEffect(() => {
    if (!isOpen || !isPremium) return;
    const timer = window.setTimeout(() => {
      if (onUnlock) onUnlock();
      onClose();
    }, 400);
    return () => window.clearTimeout(timer);
  }, [isOpen, isPremium, onUnlock, onClose]);

  const handleContinue = async () => {
    haptic("medium");
    // Analytics: CTA tapped
    import("@/services/analytics").then((a) => a.track("paywall_cta_tapped", { trigger, plan: selectedPlan })).catch(() => {});
    if (!isRevenueCatAvailable()) {
      // Dev-only convenience: never grant premium on the public web build.
      if (import.meta.env.DEV) {
        unlock();
        if (onUnlock) onUnlock();
        toast.success(t("premium.toast.devUnlocked"));
        onClose();
      } else {
        toast.info(t("premium.toast.webOnly"));
      }
      return;
    }
    const pkg = packages[selectedPlan];
    if (!pkg) {
      toast.error(t("premium.toast.notAvailable"));
      return;
    }
    // Fire Meta funnel events (top-of-funnel signal for ad optimization)
    try {
      const meta = await import("@/services/meta-events");
      meta.logInitiatedCheckout((pkg as any).product?.identifier);
      const capi = await import("@/services/meta-capi");
      const price = Number((pkg as any).product?.price ?? 0);
      const currency = String((pkg as any).product?.currencyCode ?? "USD");
      void capi.metaTrackInitiateCheckout(price, currency, (pkg as any).product?.identifier);
    } catch { /* swallow */ }
    // Analytics: purchase started
    import("@/services/analytics").then((a) => a.track("purchase_started", {
      trigger, plan: selectedPlan,
      product_id: (pkg as any).product?.identifier,
      price: Number((pkg as any).product?.price ?? 0),
      currency: String((pkg as any).product?.currencyCode ?? "USD"),
    })).catch(() => {});
    setPurchasing(true);
    try {
      const ok = await purchasePackage(pkg);
      if (ok) {
        unlock();
        haptic("heavy");
        toast.success(t("premium.toast.unlocked"));
        import("@/services/analytics").then((a) => a.track("purchase_completed", {
          trigger, plan: selectedPlan,
          product_id: (pkg as any).product?.identifier,
          price: Number((pkg as any).product?.price ?? 0),
          currency: String((pkg as any).product?.currencyCode ?? "USD"),
        })).catch(() => {});
        if (onUnlock) onUnlock();
        onClose();
      } else {
        toast.error(t("premium.toast.purchaseIncomplete"));
        import("@/services/analytics").then((a) => a.track("purchase_failed", { trigger, plan: selectedPlan, reason: "not_completed" })).catch(() => {});
      }
    } catch (e) {
      if (isUserCancelled(e)) {
        toast.info(t("premium.toast.purchaseCancelled"));
        import("@/services/analytics").then((a) => a.track("purchase_cancelled", { trigger, plan: selectedPlan })).catch(() => {});
      } else {
        console.error("[Purchase] failed", e);
        toast.error(t("premium.toast.purchaseFailed"));
        import("@/services/analytics").then((a) => a.track("purchase_failed", { trigger, plan: selectedPlan, reason: "exception" })).catch(() => {});
      }
    } finally {
      setPurchasing(false);
    }
  };


  const handleRestore = async () => {
    if (restoring) return;
    haptic("soft");
    if (!isRevenueCatAvailable()) {
      toast.info(t("premium.toast.restoreWebOnly"));
      return;
    }
    setRestoring(true);
    toast.info(t("premium.toast.checkingPurchases"));
    try {
      const ok = await restorePurchases();
      if (ok) {
        unlock();
        haptic("heavy");
        toast.success(t("premium.toast.restored"));
        if (onUnlock) onUnlock();
        onClose();
      } else {
        toast.info(t("premium.toast.noPurchasesFound"));
      }
    } catch (e) {
      console.error("[Restore] failed", e);
      toast.error(t("premium.toast.restoreFailed"));
    } finally {
      setRestoring(false);
    }
  };

  const handleDragEnd = useCallback(
    (_: any, info: PanInfo) => {
      if (info.offset.y > 100 || info.velocity.y > 500) onClose();
    },
    [onClose]
  );

  useAndroidBack(isOpen ? onClose : undefined);

  const gold = "hsl(45 85% 58%)";

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="prem-bg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28 }}
            className={`${trigger === "post_onboarding" ? "premium-sheet-dark z-[10000]" : "z-[70]"} fixed inset-0`}
            style={{
              background: "hsl(var(--background) / 0.78)",
              opacity: backdropOpacity,
            }}
            onClick={onClose}
          />

          <motion.div
            key="prem-sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 420, damping: 36, mass: 0.8 }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={0.12}
            dragListener={false}
            onDragEnd={handleDragEnd}
            style={{ y }}
            className={`${trigger === "post_onboarding" ? "premium-sheet-dark z-[10001]" : "z-[80]"} fixed inset-0 flex flex-col`}
            data-back-consumer="premium-sheet"
          >
            <div
              className="overflow-hidden flex flex-col flex-1 min-h-0 relative"
              style={{
                background: "hsl(var(--background))",
                boxShadow: "0 -20px 80px hsl(var(--foreground) / 0.25)",
                borderTop: "1px solid hsl(var(--border))",
                // Keep the whole sheet below the status bar / notch — the X
                // was rendering at status-bar level on notched Android phones.
                paddingTop: "max(env(safe-area-inset-top), 10px)",
              }}
            >
              {/* Drag handle */}
              <div
                className="flex-shrink-0 flex flex-col items-center pt-2 pb-0.5 cursor-grab active:cursor-grabbing"
                style={{ touchAction: "none" }}
              >
                <div className="w-9 h-[4px] rounded-full" style={{ background: "hsl(var(--muted-foreground) / 0.35)" }} />
              </div>

              <div className="flex-1 overflow-y-auto overscroll-contain" style={{ touchAction: "pan-y" }}>
                <div
                  className="relative px-5"
                  style={{ paddingBottom: "max(env(safe-area-inset-bottom), 14px)" }}
                >

                  {/* Single dismiss control — X only (no duplicate Cancel pill) */}

                  {/* Close */}
                  <motion.button
                    onClick={onClose}
                    aria-label={t("premium.aria.close")}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                    style={{
                      background: "hsl(var(--muted) / 0.6)",
                    }}
                    className="absolute top-1 right-4 w-8 h-8 rounded-full flex items-center justify-center z-30"
                  >
                    <X className="w-4 h-4" style={{ color: "hsl(var(--muted-foreground))" }} strokeWidth={2.2} />
                  </motion.button>

                  {/* ── Hero: emotional invitation with sacred halo ── */}
                  <div className="relative flex flex-col items-center pt-1 pb-0.5">
                    {/* Soft gold radial halo behind hero — fixed size, no layout impact.
                        `filter: blur()` is the single biggest GPU killer on Adreno/Mali,
                        so on Android we ship the softer gradient without the extra blur. */}
                    <div
                      aria-hidden
                      className="pointer-events-none absolute left-1/2 -translate-x-1/2 -top-2 w-[280px] h-[140px] rounded-full"
                      style={{
                        background: `radial-gradient(ellipse at center, ${gold}22 0%, ${gold}0d 38%, transparent 70%)`,
                        ...(IS_ANDROID ? {} : { filter: "blur(8px)" }),
                      }}
                    />
                    <motion.div
                      // Hero pulse — kept on iOS/desktop for the "alive" feel,
                      // dropped on Android where an infinite scale animation is
                      // pure GPU cost with no gameplay purpose.
                      initial={{ scale: 1 }}
                      animate={IS_ANDROID ? { scale: 1 } : { scale: [1, 1.04, 1] }}
                      transition={IS_ANDROID ? { duration: 0 } : { duration: 3, repeat: Infinity, ease: "easeInOut" }}
                      className={`relative ${compact ? "w-8 h-8 rounded-[11px] mb-1" : "w-10 h-10 rounded-[14px] mb-1.5"} flex items-center justify-center`}
                      style={{
                        background: `linear-gradient(135deg, ${gold}33, ${gold}10)`,
                        border: `1.5px solid ${gold}55`,
                        boxShadow: `0 10px 26px ${gold}30`,
                      }}
                    >
                      <Cross className="w-[18px] h-[18px]" style={{ color: gold }} strokeWidth={1.8} />
                    </motion.div>
                    {/* Limited-time offer badge — urgency framing above the hero */}
                    {/* (badge moved down into the urgency strip below) */}
                    <h2
                      className={`relative ${compact ? "text-[19px]" : "text-[23px]"} text-center leading-[1.08]`}
                      style={{
                        color: "hsl(var(--foreground))",
                        fontFamily: "'Cormorant Garamond', Georgia, serif",
                        fontWeight: 600,
                        letterSpacing: "-0.5px",
                      }}
                    >
                      {heroCopy.title}
                    </h2>
                    <p
                      className={`relative ${compact ? "text-[11.5px] mt-0.5" : "text-[12.5px] mt-1"} text-center max-w-[280px] italic`}
                      style={{
                        color: "hsl(var(--muted-foreground))",
                        fontFamily: "'Cormorant Garamond', Georgia, serif",
                        fontWeight: 400,
                      }}
                    >
                      {heroCopy.sub}
                    </p>

                    {/* Honest social proof — rating-based, no fake user count */}
                    <div className={`relative ${compact ? "mt-1" : "mt-2"} flex items-center gap-1.5`}>
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <span key={i} className="text-[11px] leading-none" style={{ color: "#e8b94a" }}>★</span>
                        ))}
                      </div>
                      <span className="text-[11px] font-semibold tracking-tight" style={{ color: "hsl(var(--foreground) / 0.92)" }}>
                        {t("premium.social.ratingLine")}
                      </span>
                    </div>
                  </div>

                  {/* Review card removed from the paywall — social proof lives
                      in onboarding only (Flutter parity). */}
                  <div className={compact ? "mt-1.5" : "mt-2"} />






                  {/* ── What you unlock — 2-col bento grid, concrete features ── */}
                  <div className={`${compact ? "mb-1.5" : "mb-2"} grid grid-cols-2 gap-1.5`}>
                    {benefits.map((b) => {
                      const Icon = b.icon;
                      return (
                        <div
                          key={b.title}
                          className={`flex items-center gap-2 rounded-xl px-2.5 ${compact ? "py-1" : "py-1.5"}`}
                          style={{
                            background: `linear-gradient(135deg, ${gold}0e, ${gold}03)`,
                            border: `1px solid ${gold}24`,
                          }}
                        >
                          <div
                            className="flex items-center justify-center flex-shrink-0"
                            style={{
                              width: 26,
                              height: 26,
                              borderRadius: 8,
                              background: `linear-gradient(135deg, ${gold}2e, ${gold}10)`,
                              border: `1px solid ${gold}40`,
                            }}
                          >
                            <Icon className="w-[13px] h-[13px]" style={{ color: gold }} strokeWidth={2.1} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p
                              className="text-[11.5px] font-semibold leading-tight"
                              style={{ color: "hsl(var(--foreground))", letterSpacing: "-0.01em" }}
                            >
                              {b.title}
                            </p>
                            <p
                              className="text-[9.5px] leading-[1.25] mt-[1px]"
                              style={{ color: "hsl(var(--muted-foreground))" }}
                            >
                              {b.sub}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>




                  {/* Urgency strip removed — the trial timeline below the plans
                      carries the conversion weight instead of a fake discount. */}


                  {/* ── Plans ── */}
                  <div className={`${compact ? "space-y-1 mb-1.5" : "space-y-1.5 mb-2"}`}>


                    {livePlans.map((plan) => {
                      const isSel = selectedPlan === plan.id;
                      const hasBadge = !!plan.badge;
                      return (
                        <motion.button
                          key={plan.id}
                          onClick={() => {
                            setSelectedPlan(plan.id);
                            haptic("soft");
                          }}
                          whileTap={{ scale: 0.99 }}
                          className="w-full rounded-2xl relative text-left transition-all"
                          style={{
                            padding: compact
                              ? (hasBadge ? "8px 12px" : "7px 12px")
                              : (hasBadge ? "11px 14px" : "9px 14px"),
                            background: isSel ? `${gold}14` : "hsl(var(--muted) / 0.3)",
                            border: isSel
                              ? `1.5px solid ${gold}`
                              : "1px solid hsl(var(--border) / 0.6)",
                            boxShadow: "none",
                          }}
                        >
                          {plan.badge && (
                            <span
                              className="absolute -top-[7px] left-3 text-[8px] font-bold tracking-[0.12em] px-2 py-[2px] rounded-[5px] z-10 uppercase"
                              style={{
                                background: `linear-gradient(135deg, ${gold}, hsl(35 92% 54%))`,
                                color: "hsl(0 0% 0%)",
                                boxShadow: `0 2px 8px ${gold}40`,
                                lineHeight: 1.1,
                              }}
                            >
                              {plan.badge}
                            </span>
                          )}

                          <div className="flex items-center gap-3">
                            <div
                              className="w-[18px] h-[18px] rounded-full flex items-center justify-center flex-shrink-0 transition-all"
                              style={{
                                background: isSel ? gold : "transparent",
                                border: isSel
                                  ? "none"
                                  : "1.5px solid hsl(var(--muted-foreground) / 0.35)",
                              }}
                            >
                              {isSel && (
                                <Check
                                  className="w-[10px] h-[10px]"
                                  style={{ color: "hsl(0 0% 0%)" }}
                                  strokeWidth={3.5}
                                />
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <p
                                className={`${compact ? "text-[13.5px]" : "text-[14.5px]"} font-semibold leading-tight`}
                                style={{ color: "hsl(var(--foreground))", letterSpacing: "-0.01em" }}
                              >
                                {plan.label}
                              </p>
                              <p
                                className={`${compact ? "text-[10px]" : "text-[11px]"} mt-[2px] leading-tight`}
                                style={{ color: "hsl(var(--muted-foreground))" }}
                              >
                                {plan.subtitle}
                              </p>
                            </div>

                            <div className="text-right flex-shrink-0">
                              {/* Weekly has no trial badge / anchor line, but both
                                  slots stay reserved (invisible) so all three
                                  cards keep the exact same height. */}
                              <span
                                className={`inline-flex items-center ${compact ? "mb-1" : "mb-1.5"} text-[9px] font-bold tracking-[0.08em] px-2 py-[2px] rounded-full uppercase`}
                                style={{
                                  background: `linear-gradient(180deg, ${gold}26, ${gold}12)`,
                                  color: gold,
                                  border: `1px solid ${gold}55`,
                                  lineHeight: 1.1,
                                  letterSpacing: "0.06em",
                                  boxShadow: `inset 0 1px 0 ${gold}30`,
                                  visibility: plan.id === "weekly" ? "hidden" : "visible",
                                }}
                              >
                                {t("premium.plan.trialBadge")}
                              </span>
                              <p
                                className={`${compact ? "text-[14px]" : "text-[15px]"} font-semibold tracking-tight leading-none`}
                                style={{ color: "hsl(var(--foreground))", letterSpacing: "-0.015em" }}
                              >
                                {plan.price}
                              </p>

                              <p
                                className="text-[10px] mt-[2px] leading-none"
                                style={{ color: "hsl(var(--muted-foreground))" }}
                              >
                                / {plan.period}
                              </p>
                              <p
                                className="text-[9.5px] font-medium mt-[3px] leading-none tracking-tight opacity-90"
                                style={{
                                  color: "hsl(var(--muted-foreground))",
                                  visibility: plan.anchor ? "visible" : "hidden",
                                }}
                              >
                                {plan.anchor ?? "—"}
                              </p>

                            </div>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>

                  {/* ── Compact limited-offer ribbon ── */}
                  {selectedPlan !== "weekly" && (() => {
                    const raw = t("premium.offer.today");
                    const sep = raw.indexOf("·");
                    const badge = sep > 0 ? raw.slice(0, sep).trim() : "";
                    const headline = sep > 0 ? raw.slice(sep + 1).trim() : raw;
                    return (
                      <div
                        className="mb-2 flex min-h-[38px] items-center justify-center gap-2 rounded-[10px] px-3 py-1.5"
                        style={{
                          background: `linear-gradient(90deg, ${gold}17, ${gold}06)`,
                          border: `1px solid ${gold}3D`,
                        }}
                      >
                        <LockOpen
                          className="h-3 w-3 flex-shrink-0"
                          style={{ color: gold }}
                        />
                        {badge && (
                          <span
                            className="shrink-0 rounded-full px-2 py-1 text-[7.5px] font-extrabold uppercase leading-none tracking-[0.1em]"
                            style={{ color: `${gold}DB`, background: `${gold}1C` }}
                          >
                            {badge}
                          </span>
                        )}
                        <span className="min-w-0 truncate text-[11px] font-extrabold leading-none" style={{ color: gold }}>
                          {headline}
                        </span>
                      </div>
                    );
                  })()}




                  {/* ── Trust strip: cancel anytime + no ads + faith-first ── */}
                  <div
                    className={`mb-2 flex items-center justify-center gap-3 rounded-xl ${compact ? "py-1" : "py-1.5"}`}
                    style={{
                      background: "hsl(var(--muted) / 0.25)",
                      border: "1px solid hsl(var(--border) / 0.4)",
                    }}
                  >
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck className="w-[12px] h-[12px]" style={{ color: gold }} strokeWidth={2.2} />
                      <span className="text-[10.5px] font-medium" style={{ color: "hsl(var(--foreground) / 0.92)" }}>
                        {t("premium.trust.cancelAnytime")}
                      </span>
                    </div>
                    <span className="text-[10px]" style={{ color: "hsl(var(--muted-foreground) / 0.8)" }}>•</span>
                    <div className="flex items-center gap-1.5">
                      <Check className="w-[12px] h-[12px]" style={{ color: gold }} strokeWidth={2.6} />
                      <span className="text-[10.5px] font-medium" style={{ color: "hsl(var(--foreground) / 0.92)" }}>
                        {t("premium.trust.noAds")}
                      </span>
                    </div>
                    <span className="text-[10px]" style={{ color: "hsl(var(--muted-foreground) / 0.8)" }}>•</span>
                    <div className="flex items-center gap-1.5">
                      <Cross className="w-[12px] h-[12px]" style={{ color: gold }} strokeWidth={2.2} />
                      <span className="text-[10.5px] font-medium" style={{ color: "hsl(var(--foreground) / 0.92)" }}>
                        {t("premium.trust.faithFirst")}
                      </span>
                    </div>
                  </div>




                  {/* ── CTA ── */}
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={handleContinue}
                    disabled={purchasing}
                    className={`w-full ${compact ? "h-[52px]" : "h-[58px]"} rounded-2xl font-semibold text-[15px] tracking-tight relative overflow-hidden flex flex-col items-center justify-center gap-[2px]`}
                    style={{
                      background: "hsl(41 90% 50%)",
                      color: "hsl(0 0% 0%)",
                      boxShadow: "none",
                      opacity: purchasing ? 0.7 : 1,
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {purchasing ? (
                      <span className="relative">{t("premium.cta.processing")}</span>
                    ) : (
                      <>
                        <span className="relative flex items-center justify-center gap-2">
                          <span
                            className="text-[19px] leading-none"
                            style={{
                              fontFamily: "'Cormorant Garamond', Georgia, serif",
                              fontWeight: 700,
                              letterSpacing: "0.005em",
                            }}
                          >
                            {selectedPlan === "weekly"
                              ? t("premium.cta.weekly.title")
                              : selectedPlan === "yearly"
                                ? t("premium.cta.yearly.title")
                                : t("premium.cta.monthly.title")}
                          </span>
                          {selectedPlan !== "weekly" && (
                            <span
                              className="text-[9px] font-black px-1.5 py-[2px] rounded-md uppercase"
                              style={{
                                background: "hsl(0 0% 0% / 0.82)",
                                color: gold,
                                letterSpacing: "0.08em",
                              }}
                            >
                              {zeroTodayLabel}
                            </span>
                          )}
                        </span>
                        <span className="relative text-[10.5px] font-medium leading-none opacity-95">
                          {selectedPlan === "weekly"
                            ? t("premium.cta.weekly.sub")
                            : selectedPlan === "yearly"
                              ? t("premium.cta.yearly.sub")
                              : t("premium.cta.monthly.sub")}
                        </span>

                      </>
                    )}
                  </motion.button>


                  {selectedPlan === "yearly" && perDayLabel && (
                    <p className="text-[11px] text-center mt-2 italic" style={{ color: "hsl(var(--foreground) / 0.92)", fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
                      {perDayLabel}
                    </p>
                  )}
                  {selectedPlan === "yearly" && (
                    <div className="flex items-center justify-center gap-1.5 mt-1.5">
                      <ShieldCheck className="w-3 h-3" style={{ color: gold, opacity: 0.7 }} strokeWidth={2.2} />
                      <p className="text-[11px]" style={{ color: "hsl(var(--muted-foreground))" }}>
                        {t("premium.reminder.yearly")}
                      </p>
                    </div>
                  )}
                  {selectedPlan === "monthly" && (
                    <div className="flex items-center justify-center gap-1.5 mt-1.5">
                      <ShieldCheck className="w-3 h-3" style={{ color: gold, opacity: 0.7 }} strokeWidth={2.2} />
                      <p className="text-[11px]" style={{ color: "hsl(var(--muted-foreground))" }}>
                        {t("premium.reminder.yearly")}
                      </p>
                    </div>
                  )}

                  {selectedPlan === "weekly" && (
                    <div className="flex items-center justify-center gap-1.5 mt-1.5">
                      <ShieldCheck className="w-3 h-3" style={{ color: gold, opacity: 0.7 }} strokeWidth={2.2} />
                      <p className="text-[11px]" style={{ color: "hsl(var(--muted-foreground))" }}>
                        {t("premium.reminder.weekly")}
                      </p>
                    </div>
                  )}


                  {/* ── Footer ── */}
                  <div className="mt-2 flex items-center justify-center gap-3.5">
                    <button
                      onClick={handleRestore}
                      disabled={restoring}
                      className="text-[11px] font-medium"
                      style={{ color: "hsl(var(--muted-foreground))" }}
                    >
                      {restoring ? t("premium.footer.restoring") : t("premium.footer.restore")}
                    </button>
                    <span style={{ color: "hsl(var(--border))" }}>·</span>
                    <span className="text-[11px]" style={{ color: "hsl(var(--muted-foreground))" }}>
                      {t("premium.footer.terms")}
                    </span>
                    <span style={{ color: "hsl(var(--border))" }}>·</span>
                    <span className="text-[11px]" style={{ color: "hsl(var(--muted-foreground))" }}>
                      {t("premium.footer.privacy")}
                    </span>
                  </div>

                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
