import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, ArrowRight, Cross, Clock3, Flame, Cross as CrossIcon, Crown } from "lucide-react";
import { getLocalizedJourneys } from "@/data/journeys";
import { useJourneyProgress, isPremiumJourneyDay } from "@/hooks/useJourneyProgress";
import { useStreak } from "@/hooks/useStreak";
import { usePremium } from "@/hooks/usePremium";
import { haptic } from "@/utils/haptics";
import { showRewardedAd } from "@/services/ads";
import LockedDaySheet from "@/components/journey/LockedDaySheet";
import { LazyPremiumSheet as PremiumSheet } from "@/components/LazyPremiumSheet";
import { isJourneyFreeForUser } from "@/lib/userProfile";
import { useT } from "@/i18n";

import imgAnxietyPeace from "@/assets/journey-anxiety-peace.webp";
import imgStrength from "@/assets/journey-strength-hard-times.webp";
import imgHealing from "@/assets/journey-healing.webp";
import imgBuildingFaith from "@/assets/journey-building-faith.webp";
import imgGratitude from "@/assets/journey-gratitude-joy.webp";
import imgLoneliness from "@/assets/journey-loneliness.webp";
import imgForgiveness from "@/assets/journey-forgiveness-letting-go.webp";
import imgPurpose from "@/assets/journey-purpose-calling.webp";
import imgMarriage from "@/assets/journey-marriage-love.webp";
import imgOvercoming from "@/assets/journey-overcoming-temptation.webp";
import imgGrief from "@/assets/journey-grief-loss.jpg";
import imgMoney from "@/assets/journey-money-provision.jpg";
import imgRest from "@/assets/journey-rest-sleep.jpg";

const JOURNEY_IMAGES: Record<string, string> = {
  "anxiety-peace": imgAnxietyPeace,
  "strength-hard-times": imgStrength,
  "healing": imgHealing,
  "building-faith": imgBuildingFaith,
  "gratitude-joy": imgGratitude,
  "loneliness": imgLoneliness,
  "forgiveness-letting-go": imgForgiveness,
  "purpose-calling": imgPurpose,
  "marriage-love": imgMarriage,
  "overcoming-temptation": imgOvercoming,
  "grief-loss": imgGrief,
  "money-provision": imgMoney,
  "rest-sleep": imgRest,
};

const journeyLightStyle = {
  "--journey-bg": "42 48% 96%",
  "--journey-bg-soft": "42 60% 98%",
  "--journey-surface": "0 0% 100%",
  "--journey-surface-warm": "43 68% 96%",
  "--journey-ink": "222 38% 10%",
  "--journey-muted": "222 16% 39%",
  "--journey-soft": "42 28% 84%",
} as CSSProperties;

const journeyDarkStyle = {
  "--journey-bg": "222 42% 6%",
  "--journey-bg-soft": "222 38% 9%",
  "--journey-surface": "222 32% 12%",
  "--journey-surface-warm": "224 30% 14%",
  "--journey-ink": "44 60% 96%",
  "--journey-muted": "220 18% 68%",
  "--journey-soft": "222 22% 22%",
} as CSSProperties;

function useIsDark(): boolean {
  const [isDark, setIsDark] = useState(
    typeof document !== "undefined" &&
      !document.documentElement.classList.contains("light"),
  );
  useEffect(() => {
    if (typeof document === "undefined") return;
    const el = document.documentElement;
    const update = () => setIsDark(!el.classList.contains("light"));
    update();
    const mo = new MutationObserver(update);
    mo.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  }, []);
  return isDark;
}

export default function Journeys() {
  const { t, version } = useT();
  const JOURNEYS = useMemo(() => getLocalizedJourneys(), [version]);
  const navigate = useNavigate();
  const { getCompletedDays, getDayUnlockAt, unlockDay, requiresAdUnlock } = useJourneyProgress();
  const { current: streakDays } = useStreak();
  const { isPremium, unlock } = usePremium();

  const [showPremium, setShowPremium] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const inProgress = JOURNEYS.find((j) => {
    const c = getCompletedDays(j.id).length;
    return c > 0 && c < j.days.length;
  });
  const featured = inProgress ?? JOURNEYS[0];
  const featuredCompleted = getCompletedDays(featured.id).length;
  const featuredPct = (featuredCompleted / featured.days.length) * 100;
  const featuredNextDay = Math.min(featuredCompleted + 1, featured.days.length);
  const featuredUnlockAt = getDayUnlockAt(featured.id, featuredNextDay);
  const featuredIsWaiting = featuredUnlockAt !== null && featuredUnlockAt > now;
  const featuredNeedsAd = requiresAdUnlock(featured.id, featuredNextDay, isPremium);
  const featuredNeedsPremium = isPremiumJourneyDay(featuredNextDay, isPremium);

  const rest = (() => {
    const remaining = JOURNEYS.filter((j) => j.id !== featured.id);
    const frees = remaining.filter((j) => isJourneyFreeForUser(j));
    const paids = remaining.filter((j) => !isJourneyFreeForUser(j));
    const woven: typeof remaining = [];
    const max = Math.max(frees.length, paids.length);
    for (let i = 0; i < max; i++) {
      if (frees[i]) woven.push(frees[i]);
      if (paids[i]) woven.push(paids[i]);
    }
    return woven;
  })();

  const isDark = useIsDark();

  const [lockSheet, setLockSheet] = useState<{
    journeyId: string;
    day: number;
    mode: "time" | "ad";
    unlockAt?: number;
  } | null>(null);

  useEffect(() => {
    const IS_ANDROID = typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
    const id = setInterval(() => setNow(Date.now()), IS_ANDROID ? 30_000 : 1000);
    return () => clearInterval(id);
  }, []);

  const go = (id: string) => {
    const j = JOURNEYS.find((x) => x.id === id);
    if (!j) return;
    if (!isPremium && !isJourneyFreeForUser(j)) {
      haptic("medium");
      setShowPremium(true);
      return;
    }
    const completed = getCompletedDays(j.id).length;
    const nextDay = Math.min(completed + 1, j.days.length);

    if (isPremiumJourneyDay(nextDay, isPremium)) {
      haptic("medium");
      setShowPremium(true);
      return;
    }

    const unlockAt = getDayUnlockAt(j.id, nextDay);
    if (unlockAt && unlockAt > Date.now()) {
      haptic("soft");
      setLockSheet({ journeyId: j.id, day: nextDay, mode: "time", unlockAt });
      return;
    }
    if (requiresAdUnlock(j.id, nextDay, isPremium)) {
      haptic("soft");
      setLockSheet({ journeyId: j.id, day: nextDay, mode: "ad" });
      return;
    }
    haptic("soft");
    navigate(`/journeys/${id}`);
  };

  const onFeaturedClick = () => {
    if (featuredNeedsPremium) {
      haptic("medium");
      setShowPremium(true);
      return;
    }
    if (featuredIsWaiting && featuredUnlockAt) {
      haptic("soft");
      setLockSheet({ journeyId: featured.id, day: featuredNextDay, mode: "time", unlockAt: featuredUnlockAt });
      return;
    }
    if (featuredNeedsAd) {
      haptic("soft");
      setLockSheet({ journeyId: featured.id, day: featuredNextDay, mode: "ad" });
      return;
    }
    go(featured.id);
  };

  const handleUnlockWithAd = async () => {
    if (!lockSheet) return;
    const { journeyId, day } = lockSheet;
    const earned = await showRewardedAd(t("jn.toast.openingDay", { day }));
    if (earned) {
      unlockDay(journeyId, day);
      setLockSheet(null);
      haptic("medium");
      navigate(`/journeys/${journeyId}`);
    }
  };

  return (
    <div
      className="h-full flex flex-col"
      style={{
        ...(isDark ? journeyDarkStyle : journeyLightStyle),
        background: isDark
          ? "linear-gradient(180deg, hsl(222 44% 5%) 0%, hsl(222 38% 8%) 50%, hsl(224 36% 6%) 100%)"
          : "linear-gradient(180deg, hsl(var(--journey-bg-soft)) 0%, hsl(var(--journey-bg)) 46%, hsl(44 54% 95%) 100%)",
      }}
    >
      <div
        className="flex-shrink-0 relative z-30 px-5 pb-4"
        style={{
          paddingTop: "calc(max(env(safe-area-inset-top, 0px), 0.5rem) + 0.75rem)",
          background: "hsl(var(--journey-surface) / 0.92)",
          color: "hsl(var(--journey-ink))",
          backdropFilter: "blur(30px) saturate(180%)",
          WebkitBackdropFilter: "blur(30px) saturate(180%)",
          borderBottom: "1px solid hsl(var(--journey-soft) / 0.7)",
        }}
      >
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-8 h-8 rounded-[10px] flex items-center justify-center flex-shrink-0"
              style={{
                background:
                  "linear-gradient(135deg, hsl(var(--premium-gold) / 0.22), hsl(var(--premium-gold) / 0.08))",
                border: "1px solid hsl(var(--premium-gold) / 0.35)",
                boxShadow: "inset 0 1px 0 hsl(var(--premium-gold-glow) / 0.25)",
              }}
            >
              <CrossIcon className="w-4 h-4 text-primary" strokeWidth={2.6} />
            </div>
            <h1 className="fluid-h1 tracking-tight journey-ink">
              {t("jn.header.title")}
            </h1>
          </div>
          {streakDays >= 1 && (
            <div
              className="flex items-center gap-1.5 px-2.5 h-7 rounded-full text-[11px] font-extrabold tracking-tight"
              style={{
                background:
                  "linear-gradient(135deg, hsl(var(--premium-gold) / 0.18), hsl(var(--premium-gold) / 0.08))",
                color: "hsl(var(--premium-gold-glow))",
                border: "1px solid hsl(var(--premium-gold) / 0.4)",
                boxShadow: "0 4px 14px -8px hsl(var(--premium-gold) / 0.5)",
              }}
            >
              <Flame className="w-3 h-3" strokeWidth={3} />
              {streakDays}
            </div>
          )}
        </div>
        <p className="text-[12px] journey-muted mt-2.5 leading-snug">
          {t("jn.header.subtitle")}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto scroll-container pb-28">
        <div className="px-4 pt-5">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-2.5 px-1"
            style={{ color: "hsl(var(--premium-gold-glow))" }}>
            {featuredCompleted > 0 ? t("jn.featured.continue") : t("jn.featured.begin")}
          </p>

          <motion.button
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            whileTap={{ scale: 0.99 }}
            onClick={onFeaturedClick}
            className="w-full text-left rounded-[28px] overflow-hidden relative block"
            style={{
              boxShadow: isDark
                ? "0 26px 60px -30px hsl(0 0% 0% / 0.85), 0 12px 30px -20px hsl(var(--premium-gold) / 0.4)"
                : "0 26px 60px -30px hsl(222 40% 20% / 0.5), 0 12px 30px -20px hsl(var(--premium-gold) / 0.45)",
              border: "1px solid hsl(var(--premium-gold) / 0.35)",
            }}
          >
            <div className="relative w-full" style={{ height: "340px" }}>
              <img
                src={JOURNEY_IMAGES[featured.id]}
                alt={featured.title}
                className="absolute inset-0 w-full h-full object-cover"
                loading="eager"
                width={768}
                height={1024}
              />
              <div
                aria-hidden
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(180deg, hsl(0 0% 0% / 0.15) 0%, transparent 40%, hsl(0 0% 0% / 0.5) 72%, hsl(0 0% 0% / 0.92) 100%)",
                }}
              />
              <div className="absolute top-3.5 left-3.5 right-3.5 flex items-start justify-between">
                <div
                  className="px-2.5 py-1 rounded-full text-[9.5px] font-black uppercase tracking-[0.16em] flex items-center gap-1.5"
                  style={{
                    background: "hsl(0 0% 8% / 0.55)",
                    color: "hsl(45 100% 92%)",
                    border: "1px solid hsl(var(--premium-gold) / 0.4)",
                    backdropFilter: "blur(10px)",
                    WebkitBackdropFilter: "blur(10px)",
                  }}
                >
                  {featuredNeedsPremium ? (
                    <><Crown className="w-2.5 h-2.5" strokeWidth={3} />{t("jn.featured.badge.premium")}</>
                  ) : featuredCompleted > 0 ? (
                    <><Flame className="w-2.5 h-2.5" strokeWidth={3} />{t("jn.featured.badge.inProgress")}</>
                  ) : (
                    <><CrossIcon className="w-2.5 h-2.5" strokeWidth={3} />{t("jn.featured.badge.begin")}</>
                  )}
                </div>
                <div
                  className="px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1"
                  style={{
                    background: "hsl(0 0% 8% / 0.55)",
                    color: "hsl(0 0% 96%)",
                    backdropFilter: "blur(10px)",
                    WebkitBackdropFilter: "blur(10px)",
                  }}
                >
                  <Clock3 className="w-2.5 h-2.5" strokeWidth={2.5} />
                  {t("jn.featured.meta.days", { days: featured.days.length })}
                </div>
              </div>

              <div className="absolute inset-x-0 bottom-0 p-5">
                <h2
                  className="leading-[1.0] tracking-tight"
                  style={{
                    fontFamily: "'Cormorant Garamond', Georgia, serif",
                    fontWeight: 600,
                    fontSize: "34px",
                    color: "hsl(0 0% 100%)",
                    textShadow: "0 2px 20px hsl(0 0% 0% / 0.6)",
                  }}
                >
                  {featured.title}
                </h2>
                <p
                  className="mt-1.5 italic leading-snug line-clamp-1"
                  style={{
                    fontFamily: "'Cormorant Garamond', Georgia, serif",
                    fontSize: "15px",
                    color: "hsl(0 0% 92%)",
                    textShadow: "0 1px 10px hsl(0 0% 0% / 0.6)",
                  }}
                >
                  {featured.subtitle}
                </p>

                <div className="mt-4 flex items-center gap-3">
                  <div className="flex-1">
                    <div
                      className="h-1 rounded-full overflow-hidden"
                      style={{ background: "hsl(0 0% 100% / 0.22)" }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${featuredPct}%`,
                          background:
                            "linear-gradient(90deg, hsl(var(--premium-gold)), hsl(var(--premium-gold-glow)))",
                          boxShadow: "0 0 10px hsl(var(--premium-gold) / 0.7)",
                        }}
                      />
                    </div>
                    <p className="text-[10.5px] font-bold mt-1.5" style={{ color: "hsl(0 0% 90%)" }}>
                      {featuredCompleted >= featured.days.length
                        ? t("jn.featured.meta.complete")
                        : t("jn.featured.meta.progress", { current: featuredNextDay, total: featured.days.length, pct: Math.round(featuredPct) })}
                    </p>
                  </div>
                  <div
                    className="px-4 h-10 rounded-full flex items-center gap-1.5 text-[12.5px] font-black tracking-tight flex-shrink-0"
                    style={{
                      background:
                        "linear-gradient(135deg, hsl(var(--premium-gold)), hsl(var(--premium-gold-glow)))",
                      color: "hsl(222 60% 8%)",
                      boxShadow:
                        "0 10px 26px -8px hsl(var(--premium-gold) / 0.7), inset 0 1px 0 hsl(0 0% 100% / 0.4)",
                    }}
                  >
                    {featuredNeedsPremium ? (
                      <><Crown className="w-3.5 h-3.5" strokeWidth={3} />{t("jn.cta.unlock")}</>
                    ) : featuredCompleted === 0 ? (
                      <>{t("jn.cta.start")}<ArrowRight className="w-3.5 h-3.5" strokeWidth={3} /></>
                    ) : featuredCompleted >= featured.days.length ? (
                      <><Check className="w-3.5 h-3.5" strokeWidth={3} />{t("jn.cta.review")}</>
                    ) : (
                      <>{t("jn.cta.continue")}<ArrowRight className="w-3.5 h-3.5" strokeWidth={3} /></>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.button>
        </div>

        <div className="mt-9 mb-5 px-5 flex items-center gap-3">
          <div className="h-px flex-1"
            style={{ background: "linear-gradient(90deg, transparent, hsl(var(--premium-gold) / 0.4), transparent)" }} />
          <h3
            className="text-center whitespace-nowrap"
            style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontWeight: 600,
              fontSize: "22px",
              color: "hsl(var(--journey-ink))",
            }}
          >
            {t("jn.section.all")}
          </h3>
          <div className="h-px flex-1"
            style={{ background: "linear-gradient(90deg, transparent, hsl(var(--premium-gold) / 0.4), transparent)" }} />
        </div>
        <p className="text-center text-[12px] journey-muted italic mb-5 px-8 leading-snug"
          style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
          {t("jn.header.tagline")}
        </p>

        <div className="px-4 flex flex-col gap-4">
          {rest.map((j, i) => {
            const completed = getCompletedDays(j.id);
            const completedCount = completed.length;
            const totalDays = j.days.length;
            const pct = Math.round((completedCount / totalDays) * 100);
            const isStarted = completedCount > 0;
            const isFinished = completedCount >= totalDays;
            const premiumLocked = !isPremium && !isJourneyFreeForUser(j);
            const img = JOURNEY_IMAGES[j.id];

            const ctaLabel = premiumLocked
              ? t("jn.card.unlock")
              : isFinished
              ? t("jn.card.review")
              : isStarted
              ? t("jn.card.continue", { n: completedCount + 1 })
              : t("jn.card.start");

            return (
              <motion.button
                key={j.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.04 + i * 0.035, duration: 0.4 }}
                whileTap={{ scale: 0.985 }}
                onClick={() => go(j.id)}
                className="relative w-full text-left rounded-[26px] overflow-hidden flex flex-col"
                style={{
                  background: isDark
                    ? "linear-gradient(180deg, hsl(222 34% 13%) 0%, hsl(222 36% 10%) 100%)"
                    : "linear-gradient(180deg, hsl(var(--journey-surface)) 0%, hsl(var(--journey-surface-warm)) 100%)",
                  border: "1px solid hsl(var(--premium-gold) / 0.28)",
                  boxShadow: isDark
                    ? "0 22px 50px -28px hsl(0 0% 0% / 0.9), inset 0 1px 0 hsl(0 0% 100% / 0.05)"
                    : "0 22px 50px -28px hsl(222 30% 20% / 0.4), inset 0 1px 0 hsl(0 0% 100% / 0.7)",
                }}
              >
                <div className="relative w-full overflow-hidden" style={{ aspectRatio: "16 / 10" }}>
                  {img && (
                    <img
                      src={img}
                      alt={j.title}
                      className="absolute inset-0 w-full h-full object-cover"
                      loading="lazy"
                      width={768}
                      height={480}
                    />
                  )}
                  <div
                    aria-hidden
                    className="absolute inset-x-0 bottom-0 h-1/3"
                    style={{
                      background: isDark
                        ? "linear-gradient(180deg, transparent 0%, hsl(222 36% 10% / 0.7) 100%)"
                        : "linear-gradient(180deg, transparent 0%, hsl(var(--journey-surface) / 0.7) 100%)",
                    }}
                  />
                  <div className="absolute top-3 left-3 right-3 flex items-start justify-between">
                    <div
                      className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.14em] flex items-center gap-1.5"
                      style={{
                        background: "hsl(0 0% 8% / 0.55)",
                        color: "hsl(45 100% 92%)",
                        border: "1px solid hsl(var(--premium-gold) / 0.4)",
                        backdropFilter: "blur(10px)",
                        WebkitBackdropFilter: "blur(10px)",
                      }}
                    >
                      <Clock3 className="w-2.5 h-2.5" strokeWidth={2.5} />
                      {t("jn.card.days", { n: totalDays })}
                    </div>
                    {isFinished ? (
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center"
                        style={{
                          background: "linear-gradient(135deg, hsl(var(--premium-gold)), hsl(var(--premium-gold-glow)))",
                          boxShadow: "0 4px 14px -3px hsl(var(--premium-gold) / 0.7)",
                        }}
                      >
                        <Check className="w-4 h-4" strokeWidth={3.5} style={{ color: "hsl(222 60% 8%)" }} />
                      </div>
                    ) : isStarted ? (
                      <div
                        className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.14em]"
                        style={{
                          background: "hsl(var(--premium-gold) / 0.95)",
                          color: "hsl(222 60% 8%)",
                          boxShadow: "0 2px 10px -1px hsl(var(--premium-gold) / 0.6)",
                        }}
                      >
                        {t("jn.card.dayNum", { n: completedCount + 1 })}
                      </div>
                    ) : premiumLocked ? (
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center"
                        style={{
                          background: "linear-gradient(135deg, hsl(45 95% 62%), hsl(38 95% 48%))",
                          boxShadow: "0 4px 14px -3px hsl(40 90% 45% / 0.7), inset 0 1px 0 hsl(48 100% 82% / 0.7)",
                        }}
                      >
                        <Crown className="w-4 h-4" strokeWidth={3} style={{ color: "hsl(30 60% 14%)" }} />
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="p-4 pt-3.5 flex flex-col gap-3">
                  <div>
                    <h3
                      className="journey-ink leading-[1.05] tracking-tight"
                      style={{
                        fontFamily: "'Cormorant Garamond', Georgia, serif",
                        fontWeight: 600,
                        fontSize: "clamp(22px, 6.2vw, 28px)",
                      }}
                    >
                      {j.title}
                    </h3>
                    <p
                      className="journey-muted italic mt-1 leading-snug"
                      style={{
                        fontFamily: "'Cormorant Garamond', Georgia, serif",
                        fontSize: "clamp(13px, 3.6vw, 15px)",
                      }}
                    >
                      {j.subtitle}
                    </p>
                  </div>

                  {isStarted && (
                    <div className="flex items-center gap-2.5">
                      <div
                        className="flex-1 h-1 rounded-full overflow-hidden"
                        style={{
                          background: isDark ? "hsl(0 0% 100% / 0.12)" : "hsl(0 0% 0% / 0.08)",
                        }}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${pct}%`,
                            background:
                              "linear-gradient(90deg, hsl(var(--premium-gold)), hsl(var(--premium-gold-glow)))",
                            boxShadow: "0 0 6px hsl(var(--premium-gold) / 0.6)",
                          }}
                        />
                      </div>
                      <span
                        className="text-[11px] font-black tabular-nums journey-muted whitespace-nowrap"
                      >
                        {pct}%
                      </span>
                    </div>
                  )}

                  <div
                    className="w-full h-12 rounded-2xl flex items-center justify-center gap-2 text-[14px] font-black tracking-tight"
                    style={{
                      background:
                        "linear-gradient(135deg, hsl(var(--premium-gold)), hsl(var(--premium-gold-glow)))",
                      color: "hsl(222 60% 8%)",
                      boxShadow:
                        "0 10px 26px -8px hsl(var(--premium-gold) / 0.6), inset 0 1px 0 hsl(0 0% 100% / 0.4)",
                    }}
                  >
                    {premiumLocked && <Crown className="w-4 h-4" strokeWidth={3} />}
                    {isFinished && !premiumLocked && <Check className="w-4 h-4" strokeWidth={3} />}
                    {ctaLabel}
                    {!isFinished && !premiumLocked && <ArrowRight className="w-4 h-4" strokeWidth={3} />}
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>

        <div className="mt-8 mx-5 py-4 flex items-center justify-center flex-wrap gap-x-3 gap-y-2"
          style={{
            borderTop: "1px solid hsl(var(--premium-gold) / 0.18)",
            borderBottom: "1px solid hsl(var(--premium-gold) / 0.18)",
          }}
        >
          {[
            { label: t("jn.topic.anxiety"), icon: "♡" },
            { label: t("jn.topic.grief"), icon: "🕊" },
            { label: t("jn.topic.forgiveness"), icon: "✝" },
            { label: t("jn.topic.growth"), icon: "🌱" },
          ].map((topic, i) => (
            <div key={topic.label} className="flex items-center gap-1.5">
              <span className="text-[13px]" style={{ color: "hsl(var(--premium-gold-glow))" }}>{topic.icon}</span>
              <span
                className="text-[13px] journey-ink"
                style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 600 }}
              >
                {topic.label}.
              </span>
              {i < 3 && (
                <span className="text-[10px] ml-1" style={{ color: "hsl(var(--premium-gold) / 0.5)" }}>•</span>
              )}
            </div>
          ))}
        </div>

        <p
          className="text-center text-[13.5px] journey-muted-75 italic mt-6 px-8 leading-relaxed"
          style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
        >
          {t("jn.footer.verse")}
        </p>
      </div>

      <LockedDaySheet
        open={!!lockSheet}
        onClose={() => setLockSheet(null)}
        journeyTitle={(JOURNEYS.find((j) => j.id === lockSheet?.journeyId) ?? featured).title}
        journeyEmoji={(JOURNEYS.find((j) => j.id === lockSheet?.journeyId) ?? featured).emoji}
        hue={(JOURNEYS.find((j) => j.id === lockSheet?.journeyId) ?? featured).hue}
        day={lockSheet?.day ?? featuredNextDay}
        unlockAt={lockSheet?.unlockAt}
        mode={lockSheet?.mode ?? "time"}
        onUnlockWithPremium={() => {
          setLockSheet(null);
          setShowPremium(true);
        }}
        onUnlockWithAd={lockSheet?.mode === "ad" ? handleUnlockWithAd : undefined}
      />

      <PremiumSheet
        isOpen={showPremium}
        onClose={() => setShowPremium(false)}
        onUnlock={unlock}
        trigger="journeys"
      />
    </div>
  );
}
