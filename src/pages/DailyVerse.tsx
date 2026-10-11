import { useT } from "@/i18n";
import { useState, useCallback, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Download, Share2, Smartphone, Monitor, Lock, Layers, Sun, CheckCircle2, Crown, Image as ImageIcon, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useVerseWallpaper } from "@/hooks/useVerseWallpaper";
import { useAndroidBack } from "@/hooks/useAndroidBack";
import { haptic } from "@/utils/haptics";
import { toast } from "sonner";
import { Capacitor } from "@capacitor/core";
import WallpaperSetter from "@/plugins/wallpaper-setter";
import DailyVerseWallpaper from "@/plugins/daily-verse-wallpaper";
import { usePremium } from "@/hooks/usePremium";
import { LazyPremiumSheet as PremiumSheet } from "@/components/LazyPremiumSheet";
import { lazy as _lazy, Suspense as _Suspense } from "react";
// Lazy — both sheets carry animation + heavy children. Only mount when opened.
const DailyVersePrefetchModal = _lazy(() =>
  import("@/components/DailyVersePrefetchModal").then((m) => ({ default: m.DailyVersePrefetchModal }))
);
import { VersePackPicker } from "@/components/VersePackPicker";

import { showRewardedAd } from "@/services/ads";
import { track } from "@/services/analytics";

const WEEKLY_REFRESH_DAYS = 7;

type ApplyTarget = "home" | "lock" | "both";

export default function DailyVersePage() {
  const { t } = useT();
  const navigate = useNavigate();
  const { dataUrl, loading, verse, download, share } = useVerseWallpaper();
  const [applying, setApplying] = useState(false);
  const [showApplyOptions, setShowApplyOptions] = useState(false);
  const [autoActive, setAutoActive] = useState(false);
  const { isPremium, isAdFree, unlock } = usePremium();
  const [premiumOpen, setPremiumOpen] = useState(false);
  const [premiumTrigger, setPremiumTrigger] = useState<string>("daily_verse");
  const [prefetchOpen, setPrefetchOpen] = useState(false);
  const [forcePrefetch, setForcePrefetch] = useState(false);
  
  // Rating prompt parked behind the paywall — fired once that sheet closes.
  const pendingRatingRef = useRef(false);
  const applyOptionsRef = useRef<HTMLDivElement>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useAndroidBack(
    useCallback(() => navigate(-1), [navigate])
  );

  // Track page entry — single source of truth for daily verse traffic.
  useEffect(() => {
    track("daily_verse_page_viewed", {
      is_premium: !!isPremium,
      auto_active: autoActive,
      native: Capacitor.isNativePlatform(),
    });
    // intentionally fire once per mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Check if our auto-updating live wallpaper is the active one
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    DailyVerseWallpaper.isActive()
      .then((r) => setAutoActive(r.active))
      .catch(() => {});
  }, []);

  // Push premium status into the live wallpaper service so Pro users skip
  // the "NEW VERSE TODAY" badge entirely (their verse auto-updates).
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    DailyVerseWallpaper.setPremium({ premium: !!isPremium }).catch(() => {});
    // Pro users have always "unlocked" today's verse — mark it so the
    // lockscreen badge never appears for them.
    if (isPremium) {
      DailyVerseWallpaper.markVerseUnlocked().catch(() => {});
    }
    // Re-sync any previously activated mood pack to native on mount, so
    // app reinstalls / version bumps don't silently fall back to the 365
    // default rotation while the UI still claims a pack is active.
    (async () => {
      try {
        const { readActiveMoodPack } = await import("@/data/verseMoodPacks");
        const { getVersePack } = await import("@/data/versePacks");
        const packId = readActiveMoodPack();
        const pack = getVersePack(packId);
        if (!pack) return;
        const verses = pack.verses.map((v) => ({ text: v.text, reference: v.reference }));
        await DailyVerseWallpaper.setMoodPackVerses({ mood: pack.id, verses });
      } catch { /* */ }
    })();
  }, [isPremium]);

  // Silent weekly refresh: if cache > 7 days old and Pro is active, refresh
  // in the background without a modal. New users start with no cache so this
  // is a no-op for them.
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !isPremium) return;
    let cancelled = false;
    DailyVerseWallpaper.getCacheStatus()
      .then((status) => {
        if (cancelled) return;
        const stale =
          status.ready &&
          status.ageDays >= 0 &&
          status.ageDays >= WEEKLY_REFRESH_DAYS;
        if (stale) {
          DailyVerseWallpaper.prefetchAssets({ force: true }).catch(() => {});
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isPremium]);

  // Scroll the apply-target choices into view so they aren't hidden behind the bottom nav
  useEffect(() => {
    if (showApplyOptions) {
      // Wait a tick for layout, then bring options into view
      const t = setTimeout(() => {
        applyOptionsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 60);
      return () => clearTimeout(t);
    }
  }, [showApplyOptions]);

  const handleEnableAutoUpdate = async () => {
    track("daily_verse_auto_update_tapped", { is_premium: !!isPremium });

    if (!Capacitor.isNativePlatform()) {
      toast.info(t("dv.toast.nativeRequired"), { duration: 3000 });
      return;
    }

    // Auto-changing daily verse wallpaper is Premium-only — no ad shortcut.
    if (!isPremium) {
      haptic("medium");
      setPremiumTrigger("daily_verse_auto_unlock");
      setPremiumOpen(true);
      return;
    }

    haptic("heavy");
    await proceedToAutoUpdate();
  };

  const proceedToAutoUpdate = async () => {
    try {
      const status = await DailyVerseWallpaper.getCacheStatus();
      if (status.ready) {
        await launchLiveWallpaperPicker();
      } else {
        setForcePrefetch(false);
        setPrefetchOpen(true);
      }
    } catch (err: any) {
      setForcePrefetch(false);
      setPrefetchOpen(true);
    }
  };

  const launchLiveWallpaperPicker = async () => {
    try {
      await DailyVerseWallpaper.openPicker();
      track("daily_verse_picker_opened", { is_premium: !!isPremium });
      toast.success(t("dv.toast.tapSet"), { duration: 3500 });
      setTimeout(() => {
        DailyVerseWallpaper.isActive().then((r) => {
          setAutoActive(r.active);
          if (r.active) {
            track("daily_verse_wallpaper_activated", { is_premium: !!isPremium });
            toast.success(t("dv.toast.midnight"), { duration: 3000 });
            // Biggest happy moment in the app — the lockscreen is now live.
            import("@/services/rating").then((m) => {
              setTimeout(() => m.maybeRequestRating(), 5000);
            }).catch(() => {});
          }

        });
      }, 1500);
    } catch (err: any) {
      toast.error(err?.message || t("dv.toast.pickerError"));
    }
  };

  const handlePrefetchComplete = useCallback(async () => {
    setPrefetchOpen(false);
    // Brief breath, then open Android picker so the user finishes the flow
    setTimeout(() => { launchLiveWallpaperPicker(); }, 300);
  }, []);

  const handleDownload = () => {
    haptic("medium");
    download();
    toast.success(t("dv.toast.saved"));
  };

  const handleShare = async () => {
    haptic("soft");
    try {
      await share();
    } catch {
      toast.success(t("dv.toast.copied"));
    }
  };

  /**
   * Unified Apply flow (both free + Pro):
   *  1. Free users watch a rewarded ad.
   *  2. Mark today's verse as unlocked so the gold "✦ NEW VERSE TODAY" badge
   *     instantly clears from the lockscreen.
   *  3. Prefetch backgrounds (if needed) → open the live-wallpaper picker.
   *
   * Why live wallpaper for everyone: it's the only way the next-day "new verse
   * ready" badge can actually appear on a free user's lockscreen. A one-shot
   * static bitmap can't redraw itself at midnight.
   */
  const handleApplyWallpaper = async () => {
    if (applying) return;
    track("daily_verse_apply_tapped", { is_premium: !!isPremium, native: Capacitor.isNativePlatform() });


    // Every manual apply for a free user pitches Premium auto-update — the
    // real pain point is doing this every day with an ad. We always offer
    // the escape hatch. Rating prompt is suppressed when paywall opens so
    // they never collide.
    const pitchAutoUpdate = () => {
      if (isPremium) return false;
      try {
        const KEY = "jwbp_verse_manual_applies_v1";
        const count = parseInt(localStorage.getItem(KEY) || "0", 10) + 1;
        localStorage.setItem(KEY, String(count));
      } catch { /* ignore */ }
      setTimeout(() => {
        setPremiumTrigger("daily_verse_manual_apply");
        setPremiumOpen(true);
      }, 2200);
      return true;
    };

    if (!Capacitor.isNativePlatform()) {
      pitchAutoUpdate();
      toast.info(t("dv.toast.nativeRequired"), { duration: 3000 });
      handleDownload();
      return;
    }


    setApplying(true);
    haptic("heavy");

    let paywallWillOpen = false;
    try {
      // Free users watch a rewarded ad before applying.
      if (!isPremium) {
        const earned = await showRewardedAd(t("dv.toast.preparingWp"));
        if (!earned) {
          toast.error(t("dv.toast.adError"));
          setApplying(false);
          return;
        }
      }

      // Free users need TODAY'S exact background, not merely "some cached bg".
      // Otherwise changing the phone date can unlock today's verse while the
      // live wallpaper still opens on yesterday's cached image.
      if (!isPremium) {
        const prepared = await DailyVerseWallpaper.prefetchAssets({ single: true }).catch(() => null);
        if (!prepared || (prepared.totalBytes ?? 0) <= 1024) {
          toast.error(t("dv.toast.prepareError"));
          return;
        }
        await DailyVerseWallpaper.markVerseUnlocked();
        await launchLiveWallpaperPicker();
        paywallWillOpen = pitchAutoUpdate();

      } else {
        await DailyVerseWallpaper.markVerseUnlocked();
        const status = await DailyVerseWallpaper.getCacheStatus().catch(() => ({ ready: false } as any));
        if (status?.ready) {
          await launchLiveWallpaperPicker();
        } else {
          setForcePrefetch(false);
          setPrefetchOpen(true);
        }
      }

      // Rating prompt — never dropped. If the paywall is about to open we
      // just park it and fire it right after that sheet closes.
      if (paywallWillOpen) {
        pendingRatingRef.current = true;
      } else {
        import("@/services/rating").then((m) => {
          setTimeout(() => m.maybeRequestRating(), 5000);
        }).catch(() => {});
      }

    } catch (err: any) {
      toast.error(err?.message || t("dv.toast.applyError"));
    } finally {
      setApplying(false);
      setShowApplyOptions(false);
    }
  };

  const applyOptions: { target: ApplyTarget; label: string; icon: typeof Monitor; desc: string }[] = [
    { target: "home", label: t("dv.target.home"), icon: Monitor, desc: t("dv.target.homeDesc") },
    { target: "lock", label: t("dv.target.lock"), icon: Lock, desc: t("dv.target.lockDesc") },
    { target: "both", label: t("dv.target.both"), icon: Layers, desc: t("dv.target.bothDesc") },
  ];

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Glass header */}
      <div
        className="flex-shrink-0 relative z-30"
        style={{
          paddingTop: "max(env(safe-area-inset-top, 0px), 0.75rem)",
          background: "hsl(var(--glass))",
          backdropFilter: "blur(30px) saturate(180%)",
          WebkitBackdropFilter: "blur(30px) saturate(180%)",
          borderBottom: "1px solid hsl(var(--glass-border))",
        }}
      >
        <div className="flex items-center justify-between px-4 pt-2 pb-3">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-[14px] flex items-center justify-center"
            style={{
              background: "hsl(var(--foreground) / 0.06)",
              border: "1px solid hsl(var(--foreground) / 0.08)",
            }}
          >
            <ArrowLeft className="w-[18px] h-[18px] text-foreground/80" />
          </motion.button>

          <div className="text-center">
            <h1 className="text-[15px] font-black tracking-[-0.02em]">
              <span className="text-primary">{t("dv.header.daily")}</span>
              <span className="text-foreground/90">{t("dv.header.verse")}</span>
            </h1>
            <p className="text-[9px] text-foreground/70 font-semibold tracking-[0.2em] uppercase mt-0.5">
              {t("dv.header.subtitle")}
            </p>
          </div>

          <div className="w-9" />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-40">
        <div className="px-3 pt-4">
          {/* Today badge */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex items-center justify-center gap-2 mb-3"
          >
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold tracking-[0.15em] uppercase"
              style={{
                background: "hsl(var(--primary) / 0.12)",
                border: "1px solid hsl(var(--primary) / 0.25)",
                color: "hsl(var(--primary))",
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              {t("dv.badge.today")}
            </span>
          </motion.div>

          {/* Main wallpaper card — compact phone mockup */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="relative rounded-[22px] overflow-hidden mx-auto"
            style={{
              aspectRatio: "9/16",
              width: "min(58vw, 220px)",
              maxHeight: "44vh",
              boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
              border: "1px solid hsl(var(--glass-border))",
            }}
          >
            {loading ? (
              <div className="absolute inset-0 shimmer-skeleton" />
            ) : (
              <img
                src={dataUrl!}
                alt="Daily verse wallpaper"
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}
          </motion.div>

          {/* Verse text already shown on the wallpaper above — no duplicate here */}


          {/* PRIMARY CTA — Apply today's wallpaper (free) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.5 }}
            className="mt-6 px-4"
          >
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleApplyWallpaper}
              disabled={applying}
              className="w-full relative overflow-hidden rounded-2xl text-white disabled:opacity-70"
              style={{
                background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.78))",
                boxShadow: "0 12px 40px hsl(var(--primary) / 0.45)",
              }}
            >
              <div className="flex items-center justify-center gap-2.5 py-4">
                <Smartphone className="w-5 h-5" />
                <span className="text-[15px] font-black tracking-tight">
                  {applying ? t("dv.cta.preparing") : t("dv.cta.apply")}
                </span>
              </div>
            </motion.button>
            <p className="text-[10.5px] text-center text-foreground/60 font-semibold mt-2 tracking-wide">
              <span className="text-primary font-black">{t("dv.cta.free")}</span> · {t("dv.cta.freeDesc")}
            </p>
          </motion.div>

          {/* Secondary CTA — Auto-changing wallpaper (Premium). Stacked
              directly under the free CTA so users see both side-by-side
              before reading the explanation below. */}
          {!showApplyOptions && !autoActive && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="mt-3 px-4"
            >
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleEnableAutoUpdate}
                className="w-full relative overflow-hidden rounded-2xl text-white"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--accent)) 100%)",
                  boxShadow: "0 14px 44px -10px hsl(var(--primary) / 0.55)",
                }}
              >
                <div className="flex items-center justify-center gap-2 py-3.5">
                  <Crown className="w-4 h-4" />
                  <span className="text-[14px] font-black tracking-tight">
                    {t("dv.cta.auto")}
                  </span>
                </div>
              </motion.button>
              <p className="text-[10.5px] text-center text-foreground/65 font-semibold mt-2 tracking-wide leading-snug">
                <span className="text-primary font-black">{t("dv.cta.premium")}</span> · {t("dv.cta.premiumDesc")}
              </p>
            </motion.div>
          )}

          {/* "+ Includes" connector — visually tethers the Mood Packs card to the Premium CTA above */}
          <div className="relative w-[calc(100%-1.5rem)] mx-auto mt-3 flex items-center justify-center">
            <div
              aria-hidden
              className="absolute left-0 right-0 top-1/2 h-px"
              style={{ background: "linear-gradient(90deg, transparent, hsl(var(--primary) / 0.35), transparent)" }}
            />
            <span
              className="relative flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9.5px] font-black tracking-[0.14em] uppercase"
              style={{
                background: "hsl(var(--background))",
                color: "hsl(var(--primary))",
                border: "1px solid hsl(var(--primary) / 0.35)",
              }}
            >
              <Plus className="w-3 h-3" strokeWidth={3} />
              Also includes
            </span>
          </div>

          {/* Verse Packs — fully mapped out right here, no hidden sheet */}
          <VersePackPicker
            isPremium={!!isPremium}
            onProUpsell={() => {
              setPremiumTrigger("daily_verse_bg_pro_locked");
              setPremiumOpen(true);
            }}
            onPackActivated={(mood) => {
              track("verse_pack_apply_auto_launched", { mood });
              setTimeout(() => { handleApplyWallpaper(); }, 250);
            }}
          />



          {/* Pro auto-update — emotional, premium card (no toggle; CTA below) */}
          {true && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45, duration: 0.5 }}
              className="mt-5 px-4"
            >
              <div
                className="relative overflow-hidden rounded-[22px] p-4"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(var(--primary) / 0.14), hsl(var(--primary) / 0.05) 60%, hsl(var(--accent) / 0.08))",
                  border: "1px solid hsl(var(--primary) / 0.28)",
                  boxShadow: "0 10px 36px -12px hsl(var(--primary) / 0.35)",
                }}
              >
                <div
                  aria-hidden
                  className="pointer-events-none absolute -top-12 -right-12 w-40 h-40 rounded-full"
                  style={{ background: "radial-gradient(circle, hsl(var(--primary) / 0.25), transparent 70%)" }}
                />

                <div className="relative flex items-start gap-3">
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{
                      background: autoActive
                        ? "linear-gradient(135deg, hsl(142 71% 42%), hsl(142 71% 32%))"
                        : "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.7))",
                      boxShadow: autoActive
                        ? "0 8px 22px -8px hsl(142 71% 40% / 0.6)"
                        : "0 8px 22px -8px hsl(var(--primary) / 0.6)",
                    }}
                  >
                    {autoActive ? (
                      <CheckCircle2 className="w-5 h-5 text-white" />
                    ) : (
                      <Sun className="w-5 h-5 text-white" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-[13.5px] font-black text-foreground tracking-tight">
                        {t("dv.auto.title")}
                      </p>
                      {!isPremium && (
                        <Crown className="w-3.5 h-3.5 text-primary" />
                      )}
                    </div>
                    <p className="text-[11px] text-foreground/75 mt-0.5 leading-snug">
                      {autoActive
                        ? t("dv.auto.subActive")
                        : t("dv.auto.subIdle")}
                    </p>
                  </div>
                </div>

                {!autoActive && (
                  <div className="relative mt-3.5 flex flex-wrap gap-1.5">
                    {[
                      `🕊️ ${t("dv.auto.chip1")}`,
                      `🙏 ${t("dv.auto.chip2")}`,
                      `💛 ${t("dv.auto.chip3")}`,
                      `🌅 ${t("dv.auto.chip4")}`,
                    ].map((chip) => (
                      <span
                        key={chip}
                        className="text-[10px] font-bold px-2.5 py-1 rounded-full"
                        style={{
                          background: "hsl(var(--foreground) / 0.06)",
                          border: "1px solid hsl(var(--foreground) / 0.08)",
                          color: "hsl(var(--foreground) / 0.85)",
                        }}
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                )}

                {!autoActive && (
                  <div
                    className="relative mt-3.5 pt-3 flex items-center gap-2.5"
                    style={{ borderTop: "1px solid hsl(var(--foreground) / 0.08)" }}
                  >
                    <div className="flex -space-x-1.5">
                      {[
                        "linear-gradient(135deg,#f5cc6e,#d49a3a)",
                        "linear-gradient(135deg,#7aa7ff,#3d6ed1)",
                        "linear-gradient(135deg,#f0a3a3,#c66060)",
                      ].map((bg, i) => (
                        <div
                          key={i}
                          className="w-5 h-5 rounded-full border-2 flex items-center justify-center text-[8px] font-bold text-white"
                          style={{
                            background: bg,
                            borderColor: "hsl(var(--background))",
                          }}
                        >
                          {["S", "M", "J"][i]}
                        </div>
                      ))}
                    </div>
                    <p className="text-[10.5px] text-foreground/75 font-semibold leading-tight">
                      <span className="text-primary font-black">42,800+</span> {t("dv.auto.socialProof")} ✝️
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}





          {/* What is this feature — emotional explainer */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55, duration: 0.5 }}
            className="mt-7 mx-2"
          >
            <div className="text-center mb-4">
              <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-primary/80">
                {t("dv.why.eyebrow")}
              </p>
              <h2 className="fluid-h3 tracking-tight text-foreground mt-1.5 leading-tight">
                {t("dv.why.title1")}
                <span className="block text-primary">{t("dv.why.title2")}</span>
              </h2>
              <p className="fluid-small text-foreground/65 mt-2 max-w-[85%] mx-auto">
                {t("dv.why.sub")}
              </p>
            </div>


            {/* Feature pillars */}
            <div className="grid grid-cols-2 gap-2.5 mb-5">
              {[
                { icon: "🌅", title: t("dv.pillar.auto.title"), desc: t("dv.pillar.auto.desc") },
                { icon: "🪶", title: t("dv.pillar.battery.title"), desc: t("dv.pillar.battery.desc") },
                { icon: "🙏", title: t("dv.pillar.forget.title"), desc: t("dv.pillar.forget.desc") },
                { icon: "✝️", title: t("dv.pillar.verses.title"), desc: t("dv.pillar.verses.desc") },
              ].map((f) => (
                <div
                  key={f.title}
                  className="p-3 rounded-2xl"
                  style={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--glass-border))",
                  }}
                >
                  <div className="text-[20px] leading-none mb-1.5">{f.icon}</div>
                  <p className="text-[11.5px] font-black text-foreground tracking-tight">{f.title}</p>
                  <p className="text-[10px] text-foreground/65 leading-snug mt-0.5">{f.desc}</p>
                </div>
              ))}
            </div>


            {/* Closing line */}
            <p className="text-center text-[11px] text-foreground/55 italic leading-snug px-6 mb-2">
              {t("dv.closing.quote")}
              <span className="block not-italic text-primary/70 font-bold mt-1 tracking-wider text-[10px]">
                — Psalm 119:105
              </span>
            </p>
          </motion.div>
        </div>
      </div>

      {/* Auto-changing wallpaper is Premium-only — no free-with-ad path. */}



      {/* Premium upsell when free user taps "Unlock Daily Auto-Update" */}
      <PremiumSheet
        isOpen={premiumOpen}
        trigger={premiumTrigger}
        onClose={() => {
          setPremiumOpen(false);
          if (pendingRatingRef.current) {
            pendingRatingRef.current = false;
            import("@/services/rating").then((m) => {
              setTimeout(() => m.maybeRequestRating(), 1400);
            }).catch(() => {});
          }
        }}

        onUnlock={() => {
          unlock();
          setPremiumOpen(false);
          // After unlock, immediately start the prefetch flow
          setTimeout(() => {
            setForcePrefetch(false);
            setPrefetchOpen(true);
          }, 300);
        }}
      />

      {/* Asset prefetch — full-screen golden progress modal.
          Free users only need today's bg (their verse never auto-advances). */}
      {prefetchOpen && (
        <_Suspense fallback={null}>
          <DailyVersePrefetchModal
            open={prefetchOpen}
            force={forcePrefetch}
            single={!isPremium}
            onClose={() => setPrefetchOpen(false)}
            onComplete={handlePrefetchComplete}
          />
        </_Suspense>
      )}

    </div>
  );
}

