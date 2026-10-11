import { useState } from "react";
import { motion } from "framer-motion";
import { Share2, Star } from "lucide-react";
import { haptic } from "@/utils/haptics";
import { toast } from "sonner";
import { nativeShare } from "@/utils/nativeShare";
import PrayerAudioButton from "@/components/devotional/PrayerAudioButton";
import { useT } from "@/i18n";

import bg1Asset from "@/assets/devotional-bg-1.jpg.asset.json";
import bg2Asset from "@/assets/devotional-bg-2.jpg.asset.json";
import bg3Asset from "@/assets/devotional-bg-3.jpg.asset.json";
import bg4Asset from "@/assets/devotional-bg-4.jpg.asset.json";
import { toAbsoluteAssetUrl } from "@/data/parallaxScenes";

// Capacitor WebView origin is https://localhost which cannot serve /__l5e/ paths —
// force the public CDN origin so prayer backgrounds actually render on device.
const backgrounds = [
  toAbsoluteAssetUrl(bg1Asset.url),
  toAbsoluteAssetUrl(bg2Asset.url),
  toAbsoluteAssetUrl(bg3Asset.url),
  toAbsoluteAssetUrl(bg4Asset.url),
];

interface DevotionalSlideProps {
  prayer: string;
  prayerIndex: number;
  bgIndex: number;
  isActive: boolean;
  // Kept in the interface to avoid breaking the parent — currently unused
  // because the streak chip / "X of Y" header were removed to free up
  // vertical space for the prayer card itself.
  streak?: number;
  slideNumber: number;
  totalSlides: number;
  onOpenPersonalPrayer?: () => void;
  onContinue?: () => void;
  continueLabel?: string;
}

export default function DevotionalSlide({
  prayer,
  prayerIndex,
  bgIndex,
  isActive,
  slideNumber,
  totalSlides,
  onOpenPersonalPrayer,
  onContinue,
  continueLabel,
}: DevotionalSlideProps) {
  const { t } = useT();
  const [amenTapped, setAmenTapped] = useState(false);
  const [amenCount, setAmenCount] = useState(() => Math.floor(Math.random() * 12000) + 8000);
  const [ripples, setRipples] = useState<number[]>([]);

  const handleShare = async () => {
    haptic("soft");
    const appLink = "https://play.google.com/store/apps/details?id=com.jesuswallpaperbible.app";
    const shareMessages = [
      t("dev.slide.share.text1", { prayer, link: appLink }),
      t("dev.slide.share.text2", { prayer, link: appLink }),
      t("dev.slide.share.text3", { prayer, link: appLink }),
    ];
    const text = shareMessages[Math.floor(Math.random() * shareMessages.length)];
    await nativeShare({
      title: t("dev.slide.share.title"),
      text,
      dialogTitle: t("dev.slide.share.dialog"),
    });
  };

  const amenMessages = [
    t("dev.amen.msg1"),
    t("dev.amen.msg2"),
    t("dev.amen.msg3"),
    t("dev.amen.msg4"),
    t("dev.amen.msg5"),
    t("dev.amen.msg6"),
  ];

  const handleAmen = () => {
    haptic("medium");
    setAmenTapped(true);
    setAmenCount((c) => c + 1);
    setRipples((prev) => [...prev, Date.now()]);
    const msg = amenMessages[Math.floor(Math.random() * amenMessages.length)];
    toast(msg, { duration: 2000 });
    setTimeout(() => setAmenTapped(false), 400);
    setTimeout(() => setRipples((prev) => prev.slice(1)), 900);
  };

  const amenFormatted =
    amenCount >= 1000 ? `${(amenCount / 1000).toFixed(1)}K` : String(amenCount);

  const prayerLines = prayer
    .replace(/\. /g, ".\n")
    .replace(/ Amen/g, "\nAmen")
    .split("\n")
    .filter(Boolean);

  // Sparse, slow-rising embers — placed once, deterministic per slide so they
  // don't reshuffle on each render and never feel busy.
  const embers = [
    { left: "12%", delay: 0,  dur: 18, drift: "18px",  size: 3 },
    { left: "28%", delay: 6,  dur: 22, drift: "-22px", size: 2 },
    { left: "46%", delay: 11, dur: 26, drift: "12px",  size: 2.5 },
    { left: "64%", delay: 3,  dur: 20, drift: "-14px", size: 3 },
    { left: "82%", delay: 9,  dur: 24, drift: "20px",  size: 2 },
    { left: "92%", delay: 14, dur: 28, drift: "-10px", size: 2.5 },
  ];

  return (
    <div className="w-full h-full flex-shrink-0 relative overflow-hidden">
      {/* Background with slow Ken-Burns — only animates on the active slide */}
      <img
        src={backgrounds[bgIndex]}
        alt=""
        className={`absolute inset-0 w-full h-full object-cover ${isActive ? "prayer-kenburns" : ""}`}
      />

      {/* Cinematic vignette overlays */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "linear-gradient(180deg, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0.18) 28%, rgba(0,0,0,0.18) 52%, rgba(0,0,0,0.6) 82%, rgba(0,0,0,0.82) 100%)",
      }} />
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "radial-gradient(ellipse at center, transparent 38%, rgba(0,0,0,0.5) 100%)",
      }} />

      {/* Golden light rays from above — slow rotation, very soft */}
      <div
        className={`absolute inset-x-0 -top-1/4 h-[80%] pointer-events-none ${isActive ? "prayer-rays" : ""}`}
        style={{
          background:
            "conic-gradient(from 200deg at 50% 0%, transparent 0deg, rgba(255,210,120,0.10) 18deg, transparent 36deg, rgba(255,200,90,0.08) 60deg, transparent 80deg, rgba(255,220,140,0.10) 110deg, transparent 140deg)",
          filter: "blur(14px)",
          mixBlendMode: "screen",
        }}
      />

      {/* Halo aura behind the card — pulses softly with Amen taps */}
      <div
        className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] h-[420px] pointer-events-none ${isActive ? "prayer-aura" : ""}`}
        style={{
          background:
            "radial-gradient(circle, rgba(255,200,90,0.18) 0%, rgba(255,180,60,0.08) 35%, transparent 70%)",
          filter: amenTapped ? "blur(8px) brightness(1.4)" : "blur(10px)",
          transition: "filter 600ms ease-out",
          mixBlendMode: "screen",
        }}
      />

      {/* Floating embers — sparse, rising slowly */}
      {isActive && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {embers.map((e, i) => (
            <span
              key={i}
              className="prayer-ember absolute bottom-0 rounded-full"
              style={{
                left: e.left,
                width: e.size,
                height: e.size,
                background: "radial-gradient(circle, rgba(255,220,140,0.95) 0%, rgba(255,180,60,0.5) 60%, transparent 100%)",
                boxShadow: "0 0 6px rgba(255,200,90,0.7)",
                animationDuration: `${e.dur}s`,
                animationDelay: `${e.delay}s`,
                ["--drift" as any]: e.drift,
              }}
            />
          ))}
        </div>
      )}


      {/* Floating share button — small, tucked into the top-right corner with
          enough offset to never clash with the prayer card on narrow screens. */}
      <motion.button
        whileTap={{ scale: 0.88 }}
        onClick={handleShare}
        className="absolute z-20 flex items-center justify-center w-9 h-9 rounded-full"
        style={{
          top: "calc(env(safe-area-inset-top, 0px) + 0.6rem)",
          right: "0.6rem",
          background: "rgba(255,255,255,0.1)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          border: "1px solid rgba(255,255,255,0.16)",
          boxShadow: "0 4px 14px rgba(0,0,0,0.35)",
        }}
        aria-label={t("dev.slide.share.dialog")}
      >
        <Share2 className="w-[15px] h-[15px] text-white/90" strokeWidth={2.2} />
      </motion.button>

      {/* Content */}
      <div
        className="relative z-10 h-full flex flex-col items-center px-4"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 1.5rem)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)",
        }}
      >
        {/* Slim audio control — keeps the page calm without the old header
            block (Daily Devotion / X of Y / streak), which now lives elsewhere
            so the prayer card can breathe full-width. */}
        <motion.div
          initial={isActive ? { opacity: 0, y: -10 } : false}
          animate={isActive ? { opacity: 1, y: 0 } : false}
          transition={{ duration: 0.5 }}
          className="flex-shrink-0 pb-2 flex flex-col items-center"
        >
          <PrayerAudioButton prayerIndex={prayerIndex} isActive={isActive} />
        </motion.div>



        {/* Prayer card — wider now that the header & like button are gone. */}
        <div className="flex-1 flex items-center justify-center w-full min-h-0 py-1">
          <motion.div
            initial={isActive ? { opacity: 0, scale: 0.95 } : false}
            animate={isActive ? { opacity: 1, scale: 1 } : false}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="w-full max-w-[380px] max-h-full rounded-[26px] px-5 py-5 text-center relative overflow-hidden flex flex-col"
            style={{
              background: "rgba(255,255,255,0.07)",
              backdropFilter: "blur(20px) saturate(150%)",
              WebkitBackdropFilter: "blur(20px) saturate(150%)",
              border: "1px solid rgba(255,255,255,0.13)",
              boxShadow: "0 8px 28px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.08)",
            }}
          >
            <div className="absolute inset-0 pointer-events-none rounded-[26px]" style={{
              background: "radial-gradient(ellipse at top center, rgba(255,215,0,0.05) 0%, transparent 60%)",
            }} />

            <div className="w-10 h-[1px] mx-auto mb-3 flex-shrink-0" style={{ background: "rgba(255,255,255,0.18)" }} />

            <div
              className="relative z-10 space-y-1 overflow-y-auto flex-1 min-h-0 px-1 overscroll-y-auto"
              style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}
            >
              {prayerLines.map((line, i) => (
                <motion.p
                  key={i}
                  initial={isActive ? { opacity: 0, y: 10 } : false}
                  animate={isActive ? { opacity: 1, y: 0 } : false}
                  transition={{ duration: 0.5, delay: 0.2 + i * 0.08 }}
                  className="text-[16.5px] leading-[1.6] text-white/95 font-light"
                  style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}
                >
                  {line.trim()}
                </motion.p>
              ))}
            </div>

            <div className="w-10 h-[1px] mx-auto mt-3 flex-shrink-0" style={{ background: "rgba(255,255,255,0.18)" }} />
          </motion.div>
        </div>

        {/* Bottom actions — properly sized for native devices, never overlap,
            auto-shrink the secondary row on very narrow screens. Continue is
            the hero CTA (full-width); Amen + personal-prayer sit above it as
            balanced secondary chips. */}
        <motion.div
          initial={isActive ? { opacity: 0, y: 20 } : false}
          animate={isActive ? { opacity: 1, y: 0 } : false}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="w-full max-w-[420px] mx-auto flex flex-col items-stretch gap-2.5 flex-shrink-0 pt-4"
        >
          {/* Secondary row — Amen + Pray-for-someone. Equal flex so neither
              overflows on 320px devices. Text auto-truncates only as a last
              resort; padding scales down before that. */}
          <div className="flex items-stretch gap-2 w-full">
            {/* Amen — equal-flex chip with inline count */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleAmen}
              className="relative flex-1 min-w-0 rounded-full overflow-hidden inline-flex items-center justify-center gap-1.5 px-3 py-2.5"
              style={{
                background: amenTapped
                  ? "linear-gradient(135deg, rgba(246,211,101,0.95) 0%, rgba(253,160,133,0.95) 100%)"
                  : "linear-gradient(135deg, rgba(255,215,0,0.22) 0%, rgba(255,180,50,0.18) 100%)",
                border: "1px solid rgba(255,215,0,0.45)",
                backdropFilter: "blur(10px)",
                boxShadow: amenTapped
                  ? "0 0 20px rgba(255,215,0,0.45)"
                  : "0 2px 10px -2px rgba(255,180,50,0.25)",
              }}
            >
              {ripples.map((id) => (
                <motion.div
                  key={id}
                  initial={{ scale: 0, opacity: 0.6 }}
                  animate={{ scale: 3, opacity: 0 }}
                  transition={{ duration: 0.8 }}
                  className="absolute inset-0 rounded-full"
                  style={{ border: "2px solid rgba(255,255,255,0.5)" }}
                />
              ))}
              <span
                className="relative z-10 text-[13px] font-bold tracking-wide whitespace-nowrap"
                style={{ color: amenTapped ? "#3a2000" : "#ffe7a3" }}
              >
                🙏 {t("dev.slide.amen")}
              </span>
              <span
                className="relative z-10 text-[11px] font-semibold opacity-80 tabular-nums whitespace-nowrap"
                style={{ color: amenTapped ? "#3a2000" : "#ffe7a3" }}
              >
                · {amenFormatted}
              </span>
            </motion.button>

            {/* Personal AI prayer CTA — equal-flex sibling, label truncates on
                ultra-narrow screens (≤320px) instead of wrapping or pushing. */}
            {onOpenPersonalPrayer && (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  haptic("medium");
                  onOpenPersonalPrayer();
                }}
                className="relative flex-1 min-w-0 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-full overflow-hidden"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(255,215,0,0.18), rgba(255,180,50,0.12))",
                  backdropFilter: "blur(10px)",
                  border: "1px solid rgba(255,215,0,0.35)",
                  boxShadow: "0 2px 12px -2px rgba(255,180,50,0.25)",
                }}
              >
                <Star
                  className="relative w-3.5 h-3.5 flex-shrink-0"
                  style={{ color: "#ffd76a" }}
                  strokeWidth={2.4}
                  fill="#ffd76a"
                />
                <span className="relative text-[12px] font-bold text-amber-100/95 tracking-tight truncate">
                  {t("dev.slide.prayForSomeone")}
                </span>
              </motion.button>
            )}
          </div>

          {/* Primary CTA — Continue. Full-width so it's impossible to miss
              and matches the visual weight of the prayer card above. */}
          {onContinue && (
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => { haptic("medium"); onContinue(); }}
              className="w-full inline-flex items-center justify-center gap-2 rounded-full py-3.5 px-6"
              style={{
                background: "linear-gradient(135deg, #ffd76a 0%, #ffb83a 100%)",
                boxShadow:
                  "0 8px 22px -6px rgba(255,180,50,0.6), 0 0 22px rgba(255,215,0,0.28), inset 0 1px 0 rgba(255,255,255,0.45)",
              }}
            >
              <span
                className="text-[15px] font-black tracking-wide"
                style={{ color: "#2a1700" }}
              >
                {continueLabel ?? t("dev.slide.continue")}
              </span>
              <span
                className="text-[15px] font-black"
                style={{ color: "#2a1700" }}
              >
                →
              </span>
            </motion.button>
          )}

          {/* Swipe hint - only on first slide */}
          {slideNumber === 1 && totalSlides > 1 && (
            <motion.p
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="text-[10px] text-white/35 font-medium text-center mt-0.5"
            >
              {t("dev.slide.swipeHint")}
            </motion.p>
          )}
        </motion.div>
      </div>
    </div>
  );
}
