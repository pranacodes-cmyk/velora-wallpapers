import { motion } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Bell, Check, Heart, Lock, Shield } from "lucide-react";
import { useT } from "@/i18n";
import { SocialAppIcon } from "@/components/prayscreen/SocialAppIcon";
import storyEmbraceArt from "@/assets/onboarding-story-2-embrace.jpg";
import prayscreenDemoVideo from "@/assets/prayscreen/prayscreen-demo.webm";
import {
  ONB_IN_DELAY,
  ONB_IN_DUR,
  ONB_SLIDE_EXIT,
  ONB_SLIDE_FADE_SECONDS,
  goldSpan,
  headlineStyle,
} from "./onboardingShared";

const feedApps = [
  { id: "instagram", name: "Instagram", notice: "12 new likes", count: 12 },
  { id: "tiktok", name: "TikTok", notice: "New videos waiting", count: 9 },
  { id: "snapchat", name: "Snapchat", notice: "4 new snaps", count: 4 },
  { id: "x", name: "X", notice: "18 new posts", count: 18 },
] as const;

const guardIds = ["instagram", "tiktok", "snapchat", "x", "youtube", "facebook"] as const;

function StoryFrame({
  children,
  exiting,
  artwork = 0,
  art,
  artX = "50%",
}: {
  children: ReactNode;
  exiting?: boolean;
  artwork?: number;
  art?: string;
  artX?: string;
}) {
  // Onboarding ships in the midnight palette only, in both system themes.
  const isLight = false;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: exiting ? 0 : 1 }}
      exit={ONB_SLIDE_EXIT}
      transition={{ duration: ONB_SLIDE_FADE_SECONDS, ease: "easeOut" }}
      className="onb-slide-layer absolute inset-0 flex flex-col overflow-hidden bg-background text-foreground"
    >
      {/* Royal-blue bloom + a single gold light leak: candlelight in stone. */}
      <div
        className="absolute inset-0"
        style={{
          background: isLight
            ? "radial-gradient(ellipse 95% 70% at 50% 25%, hsl(43 60% 90%), transparent 78%)"
            : "radial-gradient(ellipse 95% 70% at 50% 25%, hsl(var(--accent)/0.24), transparent 78%)",
        }}
      />
      <div className="pointer-events-none absolute -bottom-24 -left-20 h-[230px] w-[230px] rounded-full bg-primary/10 blur-[90px]" />
      {artwork > 0 && art && (
        /* On ivory the painting gets a navy mat + gold hairline, so it reads as
           a framed icon instead of a dark patch floating on cream. */
        <div
          className="pointer-events-none absolute bottom-[118px] top-[clamp(148px,26svh,212px)] overflow-hidden rounded-[30px]"
          style={{
            insetInline: "14px",
            background:
              "linear-gradient(180deg, hsl(220 48% 12% / 0.55), hsl(222 30% 5% / 0.72))",
            border: "1px solid hsl(0 0% 100% / 0.1)",
            boxShadow:
              "0 0 54px -18px hsl(42 85% 52% / 0.14), 0 16px 30px -14px hsl(0 0% 0% / 0.45)",
          }}
        >
          <motion.img
            src={art}
            alt=""
            aria-hidden
            width={1100}
            height={1100}
            initial={{ opacity: 0, scale: 1.03 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            style={{ objectPosition: `${artX} center`, filter: "brightness(1.1)" }}
            /* Wide painting fills the glass plate edge to edge. */
            className="absolute inset-0 h-full w-full object-cover"
          />
          {/* Soft bottom scrim keeps the locked icons + pill readable. */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg,transparent 35%,hsl(222 30% 5% / 0.35) 68%,hsl(222 30% 5% / 0.85) 100%)",
            }}
          />
          {/* Glass sheen down the top edge. */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(135deg, hsl(0 0% 100% / 0.1) 0%, hsl(0 0% 100% / 0.02) 22%, transparent 50%)",
            }}
          />
        </div>
      )}
      {children}
    </motion.div>
  );
}

function StoryHeader({ kicker, pre, gold, subcopy }: { kicker: string; pre: string; gold: string; subcopy: string }) {
  return (
    <div className="relative z-20 flex shrink-0 flex-col items-center px-7 pt-[max(env(safe-area-inset-top),clamp(26px,4.6svh,52px))] text-center">
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 0.85, y: 0 }}
        transition={{ delay: ONB_IN_DELAY, duration: ONB_IN_DUR }}
        className="mb-[clamp(6px,1.4svh,12px)] text-[10px] font-bold uppercase tracking-[0.34em] text-primary"
      >
        {kicker}
      </motion.p>
      <motion.h2
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: ONB_IN_DELAY, duration: ONB_IN_DUR, ease: [0.22, 1, 0.36, 1] }}
        className="text-[clamp(21px,3.4svh,27px)] font-bold leading-[1.16]"
        style={headlineStyle}
      >
        {pre}<br /><span style={goldSpan}>{gold}</span>
      </motion.h2>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.62 }}
        transition={{ delay: ONB_IN_DELAY, duration: ONB_IN_DUR }}
        className="mt-[clamp(6px,1.4svh,12px)] max-w-[312px] text-[clamp(11px,1.7svh,12.5px)] leading-[1.5] text-foreground"
      >
        {subcopy}
      </motion.p>
    </div>
  );
}

/** Per-tick growth of each unread badge — Flutter uses the same steps. */
const badgeStep = [1, 2, 1, 3];
const BADGE_TICK_MS = 700;

/**
 * Slide 1 — the pull: four notifications drop in one after another (same calm
 * fade+rise as every other slide: 420ms, 70ms stagger), the unread count lands
 * on each app icon, and then the counts keep climbing on their own every 1.4s —
 * the feed piling up while you watch. Flutter mirrors these exact numbers
 * (see `pray_screen_slides.dart`).
 */
export function PrayScreenInterruptionSlide({ active, exiting }: { active: boolean; exiting?: boolean }) {
  const { t } = useT();
  const [ticks, setTicks] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setTicks((n) => n + 1), BADGE_TICK_MS);
    return () => window.clearInterval(id);
  }, [active]);
  if (!active) return null;
  return (
    <StoryFrame exiting={exiting}>
      <StoryHeader kicker={t("onb.ps1.kicker")} pre={t("onb.ps1.headlinePre")} gold={t("onb.ps1.headlineGold")} subcopy={t("onb.ps1.subcopy")} />
      <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center px-6 pb-[118px]">
        {/* CSS keyframes, not Framer: onboarding runs with reducedMotion="always"
            on Android, which would snap motion values to their end state. */}
        <div className="relative flex w-full max-w-[330px] flex-col gap-[clamp(8px,1.4svh,12px)]">
          {feedApps.map((app, index) => {
            const raw = app.count + badgeStep[index] * ticks;
            const shown = raw > 99 ? "99+" : String(raw);
            return (
            <div
              key={app.id}
              className="onb-storm-card flex h-[clamp(52px,7.4svh,60px)] items-center gap-3 rounded-[18px] border px-3 shadow-[0_10px_24px_hsl(var(--background)/0.6)] backdrop-blur-md"
              style={{
                background: `hsl(var(--card) / ${0.82 * (1 - index * 0.13)})`,
                borderColor: `hsl(var(--border) / ${0.6 * (1 - index * 0.13)})`,
                ["--storm-delay" as string]: `${70 * index}ms`,
              }}
            >
              {/* Icon stays fully bright; the unread count lands on its corner. */}
              <span className="relative block shrink-0 rounded-[11px] shadow-[0_3px_10px_hsl(var(--background)/0.55)]">
                <SocialAppIcon id={app.id} name={app.name} size="sm" />
                <span
                  key={shown}
                  className="onb-storm-badge absolute -right-1.5 -top-1.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full border border-background bg-[#FF3B30] px-1 text-[9px] font-black leading-none text-white"
                  style={{ ["--storm-delay" as string]: `${70 * index}ms` }}
                >
                  {shown}
                </span>
              </span>
              <span className="min-w-0 flex-1 text-left" style={{ opacity: 1 - index * 0.13 }}>
                <span className="block truncate text-[11.5px] font-extrabold text-foreground">{app.name}</span>
                <span className="block truncate text-[9.5px] text-muted-foreground">{app.notice}</span>
              </span>
              <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-[#FF4D4D]" />
            </div>
            );
          })}
        </div>
      </div>
    </StoryFrame>
  );

}

/** Slide 2 — the shield standing over those same apps, locked. */
export function PrayScreenPauseSlide({ active, exiting }: { active: boolean; exiting?: boolean }) {
  const { t } = useT();
  if (!active) return null;
  return (
    <StoryFrame exiting={exiting} artwork={1} art={storyEmbraceArt}>
      <StoryHeader kicker={t("onb.ps2.kicker")} pre={t("onb.ps2.headlinePre")} gold={t("onb.ps2.headlineGold")} subcopy={t("onb.ps2.subcopy")} />
      <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center gap-[clamp(14px,2.6svh,24px)] px-6 pb-[118px]">
        <div className="flex w-full max-w-[330px] items-center justify-between">
          {guardIds.map((id, index) => (
            <span key={id} className="relative block">
              <motion.span
                initial={{ opacity: 0, y: 12, scale: 0.86 }}
                animate={{ opacity: 1, y: 0, scale: 1, rotate: [-3, 2, -1.2, 3, -2, 1.2][index % 6] }}
                transition={{ delay: 0.12 + index * 0.06, duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
                className="block rounded-xl shadow-[0_5px_14px_hsl(var(--background)/0.6)]"
              >
                <SocialAppIcon id={id} name={id} size="sm" />
              </motion.span>
              {/* Sealed, not stickered: midnight disc with a gold hairline. */}
              <motion.span
                initial={{ opacity: 0, scale: 0.3 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.24 + index * 0.11, duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
                className="absolute -bottom-1 -right-1 flex h-[18px] w-[18px] items-center justify-center rounded-full border border-primary/80 bg-background"
              >
                <Lock className="h-2.5 w-2.5 text-primary" />
              </motion.span>
            </span>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.38 }}
          className="flex items-center gap-2 whitespace-nowrap rounded-full border border-primary/30 bg-background/65 px-4 py-2 text-[9.5px] font-bold uppercase tracking-[0.18em] text-primary shadow-[0_4px_20px_hsl(var(--background)/0.5)] backdrop-blur-md"
        >
          <Shield className="h-3.5 w-3.5" /> {t("onb.ps1.badge")}
        </motion.div>
      </div>
    </StoryFrame>
  );
}

/** Slide 3 — how simple it is: lock, pray, open. */
export function PrayScreenPromiseSlide({ active, exiting }: { active: boolean; exiting?: boolean }) {
  const { t } = useT();
  if (!active) return null;
  const times = ["12 AM", "5 AM", "12 PM", "6 PM"];
  const steps = [
    { icon: Lock, label: t("onb.ps3.step1") },
    { icon: Heart, label: t("onb.ps3.step2") },
    { icon: Check, label: t("onb.ps3.step3") },
  ];
  return (
    <StoryFrame exiting={exiting}>
      <StoryHeader kicker={t("onb.ps3.kicker")} pre={t("onb.ps3.headlinePre")} gold={t("onb.ps3.headlineGold")} subcopy={t("onb.ps3.subcopy")} />
      <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-start gap-[clamp(8px,1.6svh,14px)] px-6 pb-[118px] pt-[clamp(10px,1.8svh,16px)]">
        <div className="flex w-full max-w-[330px] flex-col gap-[clamp(8px,1.4svh,10px)]">
          {steps.map((step, index) => (
            <motion.div
              key={step.label}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.07 * (index + 1), duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-center gap-3 rounded-[18px] border border-primary/25 bg-[linear-gradient(90deg,hsl(var(--primary)/0.1),hsl(var(--card)/0.72))] px-3.5 py-[clamp(9px,1.6svh,12px)] shadow-[0_10px_22px_hsl(var(--background)/0.5)] backdrop-blur-md"
            >
              <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10">
                <step.icon className="h-[15px] w-[15px] text-primary" />
              </span>
              <span className="min-w-0 flex-1 text-left text-[12.5px] font-semibold leading-[1.35] text-foreground/90">{step.label}</span>
              <span className="text-[12px] font-black text-primary/45">0{index + 1}</span>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28, duration: 0.42 }}
          className="w-full max-w-[330px] rounded-[18px] border border-primary/20 bg-card/[0.78] p-[clamp(10px,2svh,14px)] backdrop-blur-md"
        >
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-[11px] font-extrabold text-foreground"><Bell className="h-[15px] w-[15px] text-primary" />{t("onb.ps3.rhythm")}</span>
            <span className="text-[8px] font-black uppercase tracking-[0.16em] text-primary">{t("onb.ps3.daily")}</span>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-1.5">
            {times.map((time) => (
              <div key={time} className="rounded-lg border border-primary/15 bg-primary/5 py-[7px] text-center text-[9.5px] font-bold text-foreground/70">{time}</div>
            ))}
          </div>
        </motion.div>
      </div>
    </StoryFrame>
  );
}

// =============================================================================
// SINGLE SHIELD SLIDE — the rendered PrayScreen feature film already contains
// its own real device mockup, so it is presented directly without a second
// decorative phone around it. The 9:16 ratio stays locked at every viewport.
// =============================================================================
export function PrayScreenShieldSlide({ active, exiting }: { active: boolean; exiting?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (active) {
      video.currentTime = 0;
      void video.play().catch(() => {
        /* Autoplay can be blocked before first interaction; the poster frame still shows. */
      });
    } else {
      video.pause();
    }
  }, [active]);

  if (!active) return null;

  return (
    <StoryFrame exiting={exiting}>
      <div className="relative z-20 flex shrink-0 flex-col items-center px-6 pt-[max(env(safe-area-inset-top),clamp(14px,2.2svh,22px))] text-center">
        <p className="text-[8px] font-black uppercase tracking-[0.28em] text-primary">Prayly Shield</p>
        <h2 className="mt-1 text-[clamp(18px,2.8svh,22px)] font-black leading-tight" style={headlineStyle}>
          See the pause. <span style={goldSpan}>Feel the difference.</span>
        </h2>
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center px-4 pb-[116px] pt-[clamp(5px,1svh,9px)]">
        {/* Video is cropped to the phone screen only; this clip matches its corner curve. */}
        <div className="aspect-[360/762] h-[clamp(370px,64svh,500px)] max-w-full shrink-0 overflow-hidden rounded-[clamp(22px,3.8svh,29px)]">
          <video
            ref={videoRef}
            src={prayscreenDemoVideo}
            muted
            loop
            playsInline
            autoPlay
            preload="auto"
            width={360}
            height={762}
            aria-label="Prayly Shield demonstration: an app tap is met by a sacred pause, a verse, a prayer, then the app opens with intention"
            className="block h-full w-full object-cover"
          />
        </div>
      </div>
    </StoryFrame>
  );
}
