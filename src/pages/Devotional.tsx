import { useRef, useEffect, useState, useCallback, useMemo } from "react";

const PRAYER_MUSIC_URL = "https://pub-d9ad13d080884ba18697f09f5aa3b7e9.r2.dev/audio/prayer_background_music.mp3";
import { getDailyPrayer, getDailyPrayerIndex } from "@/data/dailyVerses";
import { useStreak } from "@/hooks/useStreak";
import DevotionalSlide from "@/components/devotional/DevotionalSlide";
import LockedPrayerCard from "@/components/devotional/LockedPrayerCard";
import { PersonalPrayerSheet } from "@/components/prayer/PersonalPrayerSheet";
import {
  getCurrentSlot,
  isUnlocked,
  markUnlocked,
  markOpened,
  PRAYER_SLOT_EVENT,
  type PrayerSlot,
} from "@/lib/prayerSlots";
import { showRewardedAd } from "@/services/ads";
import { tryShowInterstitial } from "@/services/ad-cooldown";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { getPrayerViewedMs, markPrayerViewed, setHandoff } from "@/lib/dailyFunnel";
import { useFunnelExit } from "@/hooks/useFunnelExit";
import FunnelExitModal from "@/components/today/FunnelExitModal";
import { useAndroidBack } from "@/hooks/useAndroidBack";
import { useTodayTasks } from "@/hooks/useTodayTasks";
import { ArrowLeft } from "lucide-react";
import { useT } from "@/i18n";

import bg1Asset from "@/assets/devotional-bg-1.jpg.asset.json";
import bg2Asset from "@/assets/devotional-bg-2.jpg.asset.json";
import bg3Asset from "@/assets/devotional-bg-3.jpg.asset.json";
import bg4Asset from "@/assets/devotional-bg-4.jpg.asset.json";
import { toAbsoluteAssetUrl } from "@/data/parallaxScenes";

// In Capacitor the WebView origin is https://localhost — the relative
// /__l5e/ pointer 404s there, so backgrounds silently disappeared on device.
// Force absolute CDN URLs.
const backgrounds = [
  toAbsoluteAssetUrl(bg1Asset.url),
  toAbsoluteAssetUrl(bg2Asset.url),
  toAbsoluteAssetUrl(bg3Asset.url),
  toAbsoluteAssetUrl(bg4Asset.url),
];

function getPrayerItem(slot: PrayerSlot): { prayer: string; prayerIndex: number; bgIndex: number } {
  const d = new Date();
  const start = new Date(d.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((d.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const offsetDate = new Date(d);
  if (slot === "evening") offsetDate.setDate(offsetDate.getDate() + 1);
  return {
    prayer: getDailyPrayer(offsetDate),
    prayerIndex: getDailyPrayerIndex(offsetDate),
    bgIndex: (dayOfYear + (slot === "evening" ? 1 : 0)) % backgrounds.length,
  };
}

export default function Devotional() {
  const { t } = useT();
  const { current: streak } = useStreak();
  const navigate = useNavigate();
  const tasks = useTodayTasks();
  const [personalPrayerOpen, setPersonalPrayerOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const currentSlot = getCurrentSlot();
  // Memoized: this array is an effect dependency below, and a fresh array on
  // every render used to re-run markOpened → PRAYER_SLOT_EVENT → setUnlocked,
  // producing an infinite render loop ("Maximum update depth exceeded").
  const slots = useMemo<PrayerSlot[]>(
    () => (currentSlot === "morning" ? ["morning", "evening"] : ["evening", "morning"]),
    [currentSlot]
  );

  // Per-slot unlock state (the future one needs a rewarded ad)
  const [unlocked, setUnlocked] = useState<Record<PrayerSlot, boolean>>(() => ({
    morning: isUnlocked("morning"),
    evening: isUnlocked("evening"),
  }));
  const [loadingSlot, setLoadingSlot] = useState<PrayerSlot | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  // Exit-intent rescue when the user tries to bail before finishing the day
  const exit = useFunnelExit({ from: "prayer" });

  // Hide the global bottom nav for the duration of the prayer so it feels
  // like a full-screen immersive moment (same pattern as Quiz/Chat).
  useEffect(() => {
    document.body.dataset.hideNav = "true";
    return () => { delete document.body.dataset.hideNav; };
  }, []);

  const leaveDevotional = useCallback(async (opts: { fromContinue?: boolean } = {}) => {
    const prayerWasSeen = tasks.prayer || getPrayerViewedMs() > 0;
    const fromContinue = !!opts.fromContinue;

    // CONTINUE → take the user directly into the next step (no intermediate prompt).
    // BACK     → silent exit, but FunnelHandoff overlay will gently invite them
    //            into the next step when they land back on Today.
    if (fromContinue && prayerWasSeen && !tasks.reflection) {
      try { sessionStorage.setItem("cw_open_reflection_now", "1"); } catch {}
    } else if (fromContinue && prayerWasSeen && !tasks.quiz) {
      navigate("/quiz?auto=daily");
      return;
    } else if (!fromContinue && prayerWasSeen && !tasks.reflection) {
      setHandoff("reflection");
    } else if (!fromContinue && prayerWasSeen && !tasks.quiz) {
      setHandoff("quiz");
    }

    // No interstitial on prayer close/continue — kills return rate.
    navigate("/");

  }, [navigate, tasks.prayer, tasks.reflection, tasks.quiz]);

  const handleBack = useCallback(() => {
    if (exit.tryExit()) void leaveDevotional();
  }, [exit, leaveDevotional]);

  useAndroidBack(handleBack);

  // Refresh unlock state when something changes (e.g. midnight rollover, ad)
  useEffect(() => {
    const refresh = () => {
      const next = { morning: isUnlocked("morning"), evening: isUnlocked("evening") };
      // Bail out when nothing changed — a new object identity here would feed
      // back into the markOpened effect and loop forever.
      setUnlocked((prev) =>
        prev.morning === next.morning && prev.evening === next.evening ? prev : next
      );
    };
    window.addEventListener(PRAYER_SLOT_EVENT, refresh);
    window.addEventListener("focus", refresh);
    const id = setInterval(refresh, 60_000);
    return () => {
      window.removeEventListener(PRAYER_SLOT_EVENT, refresh);
      window.removeEventListener("focus", refresh);
      clearInterval(id);
    };
  }, []);

  // Mark the active slot as "opened" whenever it scrolls into view AND it's unlocked.
  useEffect(() => {
    const active = slots[activeIdx];
    if (active && unlocked[active]) {
      markOpened(active);
      markPrayerViewed();
    }
  }, [activeIdx, slots, unlocked]);

  // Ambient music
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.volume = 0;
    a.loop = true;
    let fadeId: number | undefined;
    let announced = false;
    const announceReady = () => {
      if (announced) return;
      announced = true;
      window.dispatchEvent(new Event("prayer-music-ready"));
    };
    const startFadeIn = () => {
      const play = a.play();
      if (play && typeof play.then === "function") play.then(announceReady).catch(() => {});
      else announceReady();
      let v = a.volume;
      if (fadeId) window.clearInterval(fadeId);
      fadeId = window.setInterval(() => {
        v = Math.min(0.28, v + 0.02);
        a.volume = v;
        if (v >= 0.28 && fadeId) { window.clearInterval(fadeId); fadeId = undefined; }
      }, 80);
    };
    a.addEventListener("playing", announceReady, { once: true });
    startFadeIn();

    // Pause when app is backgrounded / tab hidden; resume when visible.
    const onVisibility = () => {
      if (document.hidden) {
        if (fadeId) { window.clearInterval(fadeId); fadeId = undefined; }
        a.pause();
      } else {
        startFadeIn();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", () => a.pause());
    window.addEventListener("blur", () => a.pause());

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      if (fadeId) window.clearInterval(fadeId);
      a.pause();
      a.currentTime = 0;
    };
  }, []);


  // Track active slide via scroll
  const onScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollTop / el.clientHeight);
    if (idx !== activeIdx) setActiveIdx(idx);
  }, [activeIdx]);

  const handleUnlock = useCallback(async (slot: PrayerSlot) => {
    if (loadingSlot) return;
    setLoadingSlot(slot);
    import("@/services/analytics").then((a) => a.track("prayer_unlock_started", { slot })).catch(() => {});

    try {
      const earned = await showRewardedAd(t("dev.toast.unlocking"));
      if (earned) {
        markUnlocked(slot);
        markOpened(slot);
        setUnlocked((p) => ({ ...p, [slot]: true }));
        toast(t("dev.toast.unlocked"), { duration: 1600 });
        import("@/services/analytics").then((a) => a.track("prayer_unlocked", { slot })).catch(() => {});
      } else {
        toast(t("dev.toast.stayToEnd"), { duration: 2200 });
        import("@/services/analytics").then((a) => a.track("prayer_unlock_abandoned", { slot })).catch(() => {});
      }

    } catch {
      toast(t("dev.toast.error"));
    } finally {
      setLoadingSlot(null);
    }
  }, [loadingSlot, t]);

  return (
    <div className="h-full w-full relative bg-black overflow-hidden">
      <audio ref={audioRef} src={PRAYER_MUSIC_URL} preload="auto" playsInline />

      {/* Funnel-aware back button — kept subtle so it doesn't fight the prayer */}
      <button
        onClick={handleBack}
        aria-label={t("dev.nav.back")}
        className="absolute z-30 left-3 w-10 h-10 rounded-full flex items-center justify-center bg-black/40 backdrop-blur-md border border-white/15 active:scale-95 transition-transform"
        style={{ top: "max(env(safe-area-inset-top), 14px)" }}
      >
        <ArrowLeft className="w-[18px] h-[18px] text-white/90" strokeWidth={2.4} />
      </button>


      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="h-full w-full overflow-y-auto snap-y snap-mandatory overscroll-contain"
        style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch", scrollSnapStop: "always" as any }}
      >
        {slots.map((slot, i) => {
          const item = getPrayerItem(slot);
          const isActive = activeIdx === i;
          const isLocked = !unlocked[slot];
          return (
            <div key={slot} className="h-full w-full snap-start snap-always relative" style={{ scrollSnapStop: "always" as any }}>
              {isLocked ? (
                <div className="absolute inset-0">
                  {/* Background tease */}
                  <img src={backgrounds[item.bgIndex]} alt="" className="absolute inset-0 w-full h-full object-cover opacity-50" />
                  <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.7), rgba(0,0,0,0.85))" }} />
                  <div className="relative z-10 h-full w-full">
                    <LockedPrayerCard
                      onUnlock={() => handleUnlock(slot)}
                      isLoading={loadingSlot === slot}
                      title={slot === "evening" ? t("dev.locked.eveningTitle") : t("dev.locked.tomorrowTitle")}
                      subtitle={slot === "evening"
                        ? t("dev.locked.eveningSubtitle")
                        : t("dev.locked.tomorrowSubtitle")}
                      countdownLabel={t("dev.locked.countdownLabel")}
                    />

                  </div>
                </div>
              ) : (
                <DevotionalSlide
                  prayer={item.prayer}
                  prayerIndex={item.prayerIndex}
                  bgIndex={item.bgIndex}
                  isActive={isActive}
                  streak={streak}
                  slideNumber={i + 1}
                  totalSlides={slots.length}
                  onOpenPersonalPrayer={() => setPersonalPrayerOpen(true)}
                  continueLabel={t("dev.slide.continue")}
                  onContinue={() => { void leaveDevotional({ fromContinue: true }); }}
                />

              )}
            </div>
          );
        })}
      </div>

      <PersonalPrayerSheet
        open={personalPrayerOpen}
        onClose={() => setPersonalPrayerOpen(false)}
      />

      <FunnelExitModal
        open={exit.showModal}
        doneCount={tasks.doneCount}
        onContinue={exit.dismissModal}
        onLeave={() => { exit.confirmExit(); void leaveDevotional(); }}
      />
    </div>
  );
}
