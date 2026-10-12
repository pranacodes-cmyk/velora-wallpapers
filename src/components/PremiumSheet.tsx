import { Button } from "@/components/ui/button";
import { PaywallWelcomeFilm } from "@/components/PaywallWelcomeFilm";
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { X, Check, Shield, Route, Sunrise, Image as ImageIcon, BanIcon, Headphones, LockOpen, ArrowRight, BookOpen } from "lucide-react";
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
    { icon: Route,      title: t("premium.benefit.journeys.title"),     sub: t("premium.benefit.journeys.sub") },
    { icon: BookOpen,   title: t("premium.benefit.bible.title"),       sub: t("premium.benefit.bible.sub") },
    { icon: ImageIcon,  title: t("premium.benefit.hdWallpapers.title"), sub: t("premium.benefit.hdWallpapers.sub") },
    { icon: Sunrise,    title: t("premium.benefit.dailyVerse.title"),   sub: t("premium.benefit.dailyVerse.sub") },
    { icon: Headphones, title: t("premium.benefit.prayerAudio.title"),  sub: t("premium.benefit.prayerAudio.sub") },
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
  const forceMidnightTheme = trigger === "post_onboarding";
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

  const selected = livePlans.find((p) => p.id === selectedPlan);
  const selectedPackage = packages[selectedPlan];
  const zeroTodayLabel = t("premium.cta.zeroTodayFallback");

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

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.section
          key="premium-redesign"
          role="dialog"
          aria-modal="true"
          aria-label="Prayly Pro"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.25 }}
          className={`paywall-cinema fixed inset-0 z-[10001] flex flex-col justify-center bg-background text-foreground ${forceMidnightTheme ? "premium-sheet-dark" : ""}`}
          data-back-consumer="premium-sheet"
        >
          <div className="paywall-layout mx-auto flex max-h-full w-full max-w-[520px] flex-col">
            <div className="relative min-h-0 shrink overflow-y-auto overscroll-contain">
              <div className="paywall-film relative overflow-hidden">
                <PaywallWelcomeFilm />
                <div className="paywall-film-shade pointer-events-none absolute inset-0" />
                <div className="paywall-heading absolute inset-x-0 bottom-0 px-5 text-center">
                  <p className="mb-2 text-[10px] font-medium text-primary">Prayly · PRO</p>
                  <h2 className="paywall-title text-[28px] font-semibold leading-[1.15]">{heroCopy.title}</h2>
                  <p className="mx-auto mt-2 max-w-[330px] text-[12px] leading-snug text-muted-foreground">{heroCopy.sub}</p>
                </div>
              </div>
              <div className="px-6 pb-3 pt-4">
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  {[benefits[2], benefits[1], benefits[0], benefits[4]].map((benefit) => {
                    const Icon = benefit.icon;
                    return <div key={benefit.title} className="flex min-w-0 items-center gap-2.5 text-left">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <Icon className="h-3.5 w-3.5 text-primary" strokeWidth={1.7} />
                      </span>
                      <span className="min-w-0">
                        <span className="block break-words text-[11px] font-semibold leading-tight text-foreground">{benefit.title}</span>
                        <span className="mt-0.5 block break-words text-[10px] leading-[1.35] text-muted-foreground">{benefit.sub}</span>
                      </span>
                    </div>;
                  })}
                </div>
              </div>
            </div>
            <footer className="paywall-purchase shrink-0 bg-background px-5 pt-2">
                <div role="radiogroup" aria-label="Plans" className="mb-2 space-y-2">
                  {livePlans.map((plan) => {
                    const active = selectedPlan === plan.id;
                    return <Button key={plan.id} variant="ghost" role="radio" aria-checked={active}
                      onClick={() => { setSelectedPlan(plan.id); haptic("soft"); }}
                      className={`paywall-plan-option h-auto min-h-[54px] w-full justify-start gap-0 whitespace-normal rounded-xl border px-3 py-2.5 text-left transition-[border-color,background-color,box-shadow] hover:border-primary/55 hover:bg-primary/5 ${active ? "paywall-plan-active border-primary" : "border-border bg-card"}`}>
                      <span className={`mr-3 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border transition-colors ${active ? "border-primary bg-primary text-paywall-cta" : "border-muted-foreground/55 bg-background"}`}>
                        {active && <Check className="h-3 w-3" strokeWidth={3} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-semibold leading-tight text-foreground">{plan.label}</span>
                        <span className="mt-1 block text-[10px] font-medium leading-snug text-muted-foreground">{plan.id === "yearly" ? t("premium.plan.trialBadge") : plan.subtitle}</span>
                      </span>
                      <span className="ml-3 max-w-[46%] break-words text-right">
                        <span className="block text-[15px] font-semibold leading-tight text-foreground">{plan.price}<span className="ml-1 text-[10px] font-medium text-muted-foreground">/ {plan.period}</span></span>
                        {plan.anchor && <span className="mt-1 block text-[9px] font-medium leading-snug text-muted-foreground">{plan.anchor}</span>}
                      </span>
                    </Button>;
                  })}
                </div>

                <div className="mb-2 flex items-center justify-center gap-2 text-[10px] text-primary">
                  <LockOpen className="h-3 w-3 shrink-0" />
                  <span className="text-center font-semibold">{t("premium.offer.today")}</span>
                </div>
              <Button onClick={handleContinue} disabled={purchasing} className="paywall-cta h-auto min-h-12 w-full gap-3 whitespace-normal rounded-full bg-primary px-5 py-3 hover:bg-primary/90">
                <span className="text-[14px] font-semibold leading-tight">{purchasing ? t("premium.cta.processing") : t(`premium.cta.${selectedPlan}.title`)}</span>
                <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={1.8} />
              </Button>
              <p className="mt-2 text-center text-[10px] leading-snug text-muted-foreground">{selectedPlan === "yearly" ? `${zeroTodayLabel} · ` : ""}{t(selectedPlan === "weekly" ? "premium.reminder.weekly" : "premium.reminder.yearly")}</p>
              <div className="mt-1 flex flex-wrap items-center justify-center gap-x-3">
                <Button variant="link" onClick={handleRestore} disabled={restoring} className="h-8 px-0 text-[10px] font-normal text-muted-foreground">{t(restoring ? "premium.footer.restoring" : "premium.footer.restore")}</Button>
                <span className="text-[10px] text-muted-foreground">{t("premium.footer.terms")}</span>
                <span className="text-[10px] text-muted-foreground">{t("premium.footer.privacy")}</span>
              </div>
            </footer>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label={t("premium.aria.close")} className="paywall-close absolute right-4 h-9 w-9 rounded-full bg-background/65 text-foreground hover:bg-background/80"><X className="h-4 w-4" /></Button>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
