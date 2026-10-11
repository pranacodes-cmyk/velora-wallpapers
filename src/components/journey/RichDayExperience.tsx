import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Check, ChevronLeft, Wind } from "lucide-react";
import { haptic } from "@/utils/haptics";
import { useT } from "@/i18n";
import type { RichDay, RichSlide } from "@/data/journeyRichContent";
import { NarrationPlayer, slideBoundaries } from "./NarrationPlayer";
import { ReflectionSheet } from "./ReflectionSheet";


interface Props {
  hue: number;
  journeyId: string;
  journeyTitle: string;
  journeyEmoji: string;
  day: number;
  rich: RichDay;
  onExit: () => void;
  onComplete: () => void;
}

export default function RichDayExperience({
  hue,
  journeyId,
  journeyTitle,
  journeyEmoji,
  day,
  rich,
  onExit,
  onComplete,
}: Props) {
  const { t } = useT();
  const [index, setIndex] = useState(0);
  const [checked, setChecked] = useState<number[]>([]);
  const [reflectionOpen, setReflectionOpen] = useState(false);

  const total = rich.slides.length;
  const slide = rich.slides[index];
  const isLast = index === total - 1;

  // Boundaries of each slide section within the narration script (0..1).
  const boundaries = useMemo(() => slideBoundaries(rich), [rich]);
  // While audio is playing, auto-advance the visible slide so the reader's
  // eye follows the voice. We never go *backward* from narration — user can
  // still scroll back manually.
  const lastAutoIdx = useRef(0);
  const handleNarrationProgress = (ratio: number, playing: boolean) => {
    if (!playing) return;
    // Use a tiny lead so the slide changes just as the voice arrives at it.
    const lead = 0.01;
    let target = 0;
    for (let i = 0; i < boundaries.length; i++) {
      if (ratio + lead < boundaries[i]) {
        target = i;
        break;
      }
      target = i;
    }
    if (target > lastAutoIdx.current) {
      lastAutoIdx.current = target;
      setIndex((curr) => (target > curr ? target : curr));
    }
  };

  // Reset to top on slide change
  useEffect(() => {
    const el = document.querySelector(".rich-scroll");
    if (el) el.scrollTo({ top: 0, behavior: "auto" });
  }, [index]);

  const next = () => {
    haptic("medium");
    if (isLast) {
      // End-of-chapter reflection. Skipping or finishing both complete the day.
      setReflectionOpen(true);
    } else {
      setIndex((i) => i + 1);
    }
  };
  const prev = () => {
    haptic("soft");
    if (index === 0) onExit();
    else setIndex((i) => i - 1);
  };

  return (
    <div
      className="h-full flex flex-col relative overflow-hidden"
      style={{
        background: `radial-gradient(120% 80% at 0% 0%, hsl(${hue} 60% 22% / 0.55), transparent 55%), radial-gradient(100% 80% at 100% 100%, hsl(${hue} 50% 15% / 0.45), transparent 55%), hsl(var(--background))`,
      }}
    >
      {/* Top ambient */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(60% 40% at 50% 0%, hsl(${hue} 85% 65% / 0.18), transparent 70%)`,
        }}
      />

      {/* Header */}
      <div className="flex-shrink-0 px-4 pt-3 pb-3 safe-top relative z-20">
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={prev}
            className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{
              background: "hsl(var(--glass))",
              backdropFilter: "blur(20px)",
              border: "1px solid hsl(var(--glass-border))",
            }}
          >
            <ChevronLeft className="w-5 h-5 text-foreground" strokeWidth={2.4} />
          </button>
          <span className="flex-1 min-w-0 text-center text-[9.5px] font-bold uppercase tracking-[0.18em] text-foreground/55 truncate px-1">
            {t("jn.rich.progress", { emoji: journeyEmoji, title: journeyTitle, day: day })}
          </span>
          <div className="flex-shrink-0">
            <NarrationPlayer
              journeyId={journeyId}
              day={day}
              rich={rich}
              hue={hue}
              onProgress={handleNarrationProgress}
              activeSlideIndex={index}
              boundaries={boundaries}
            />

          </div>
        </div>

        {/* Slide progress segments */}
        <div className="flex items-center justify-center gap-1.5 mt-3.5 px-2">
          {rich.slides.map((_, i) => {
            const active = i === index;
            const done = i < index;
            return (
              <div
                key={i}
                className="h-1 flex-1 rounded-full overflow-hidden"
                style={{ background: "hsl(0 0% 100% / 0.1)" }}
              >
                <motion.div
                  initial={false}
                  animate={{ width: done || active ? "100%" : "0%" }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className="h-full rounded-full"
                  style={{
                    background: active
                      ? `linear-gradient(90deg, hsl(${hue} 70% 60%), hsl(${hue} 85% 72%))`
                      : `hsl(${hue} 75% 60%)`,
                    boxShadow: active ? `0 0 8px hsl(${hue} 80% 60% / 0.6)` : "none",
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Slide content */}
      <div className="flex-1 overflow-y-auto scroll-container rich-scroll px-5 pb-6 relative z-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
            className="max-w-md mx-auto pt-2"
          >
            <SlideBody
              slide={slide}
              hue={hue}
              checked={checked}
              setChecked={setChecked}
            />

            {/* CTA */}
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.5 }}
              whileTap={{ scale: 0.97 }}
              onClick={next}
              className="w-full rounded-[20px] py-4 text-[15px] font-extrabold tracking-tight mt-8 mb-6"
              style={{
                background: `linear-gradient(135deg, hsl(${hue} 70% 55%), hsl(${hue} 75% 45%))`,
                color: "white",
                boxShadow: `0 12px 32px -10px hsl(${hue} 70% 45% / 0.7), inset 0 1px 0 hsl(${hue} 95% 80% / 0.4)`,
              }}
            >
              <span className="flex items-center justify-center gap-2">
                {isLast && <Check className="w-4 h-4" strokeWidth={3} />}
                {slide.continueLabel}
                {!isLast && <ArrowRight className="w-4 h-4" strokeWidth={3} />}
              </span>
            </motion.button>

            <p className="text-center text-[10px] font-bold uppercase tracking-[0.22em] text-foreground/40 pb-3">
              {t("jn.rich.slideCount", { current: index + 1, total })}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      <ReflectionSheet
        open={reflectionOpen}
        context={`${journeyTitle} · Day ${day}`}
        hue={hue}
        day={day}
        onClose={() => {
          setReflectionOpen(false);
          onComplete();
        }}
      />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
function SlideBody({
  slide,
  hue,
  checked,
  setChecked,
}: {
  slide: RichSlide;
  hue: number;
  checked: number[];
  setChecked: (v: number[] | ((p: number[]) => number[])) => void;
}) {
  return (
    <>
      {/* Eyebrow */}
      <motion.p
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, duration: 0.5 }}
        className="text-[10px] font-extrabold uppercase tracking-[0.3em] text-center mb-3"
        style={{ color: `hsl(${hue} 75% 72%)` }}
      >
        {slide.eyebrow}
      </motion.p>

      {/* Title */}
      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12, duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
        className="text-[26px] font-black tracking-[-0.02em] text-foreground text-center leading-[1.15] mb-6"
        style={{ textShadow: `0 2px 24px hsl(${hue} 80% 50% / 0.22)` }}
      >
        {slide.title}
      </motion.h1>

      {/* Breath circle for opening */}
      {slide.kind === "opening" && (
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.7 }}
          className="flex justify-center mb-7"
        >
          <motion.div
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            className="w-24 h-24 rounded-full flex items-center justify-center"
            style={{
              background: `radial-gradient(circle, hsl(${hue} 80% 60% / 0.35), hsl(${hue} 70% 40% / 0.05) 70%)`,
              border: `1px solid hsl(${hue} 80% 65% / 0.4)`,
              boxShadow: `0 0 60px hsl(${hue} 80% 55% / 0.35)`,
            }}
          >
            <Wind className="w-6 h-6 text-white/80" strokeWidth={1.8} />
          </motion.div>
        </motion.div>
      )}

      {/* Verse card */}
      {slide.kind === "verse" && slide.verse && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.55 }}
          className="rounded-[24px] p-6 mb-7 relative overflow-hidden"
          style={{
            background: `linear-gradient(160deg, hsl(${hue} 45% 12%) 0%, hsl(${hue} 55% 8%) 100%)`,
            border: `1px solid hsl(${hue} 70% 55% / 0.35)`,
            boxShadow: `inset 0 1px 0 hsl(${hue} 90% 80% / 0.12), 0 16px 40px -16px hsl(${hue} 70% 30% / 0.6)`,
          }}
        >
          <span
            className="absolute -top-3 left-4 text-[90px] leading-none font-serif opacity-25"
            style={{ color: `hsl(${hue} 85% 75%)` }}
            aria-hidden
          >
            &ldquo;
          </span>
          <p
            className="relative text-[18px] leading-[1.7] text-white font-normal"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            {slide.verse}
          </p>
          {slide.reference && (
            <p
              className="relative text-[12.5px] font-extrabold mt-4 tracking-wide"
              style={{ color: `hsl(${hue} 80% 75%)` }}
            >
              — {slide.reference}
            </p>
          )}
        </motion.div>
      )}

      {/* Paragraphs — staggered reveal so it feels paced, not dumped */}
      <div className="space-y-4 px-1">
        {slide.paragraphs.map((p, i) => (
          <motion.p
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28 + i * 0.18, duration: 0.6 }}
            className="text-[16.5px] leading-[1.72] text-foreground/90 font-normal"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            {p}
          </motion.p>
        ))}
      </div>

      {/* Breath prayer */}
      {slide.breathPrayer && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="mt-7 rounded-[20px] p-5"
          style={{
            background: `hsl(${hue} 50% 14% / 0.55)`,
            border: `1px solid hsl(${hue} 70% 58% / 0.28)`,
          }}
        >
          <p
            className="text-[10px] font-extrabold uppercase tracking-[0.22em] mb-3"
            style={{ color: `hsl(${hue} 80% 75%)` }}
          >
            Breath prayer
          </p>
          <p className="text-[15.5px] leading-[1.55] text-foreground">
            <span className="font-bold" style={{ color: `hsl(${hue} 85% 78%)` }}>Inhale:</span>{" "}
            {slide.breathPrayer.inhale}
          </p>
          <p className="text-[15.5px] leading-[1.55] text-foreground mt-1.5">
            <span className="font-bold" style={{ color: `hsl(${hue} 85% 78%)` }}>Exhale:</span>{" "}
            {slide.breathPrayer.exhale}
          </p>
        </motion.div>
      )}

      {/* Prayer */}
      {slide.prayer && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="mt-4 rounded-[20px] p-5"
          style={{
            background: `linear-gradient(160deg, hsl(${hue} 45% 12%) 0%, hsl(${hue} 55% 8%) 100%)`,
            border: `1px solid hsl(${hue} 70% 55% / 0.3)`,
          }}
        >
          <p
            className="text-[10px] font-extrabold uppercase tracking-[0.22em] mb-2.5"
            style={{ color: `hsl(${hue} 80% 75%)` }}
          >
            Pray with me
          </p>
          <p
            className="text-[16px] leading-[1.65] text-white/95 italic"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            {slide.prayer}
          </p>
        </motion.div>
      )}

      {/* Tiny actions */}
      {slide.tinyActions && slide.tinyActions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.6 }}
          className="mt-4 rounded-[20px] p-5"
          style={{
            background: "hsl(var(--glass))",
            backdropFilter: "blur(20px)",
            border: "1px solid hsl(var(--glass-border))",
          }}
        >
          <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-foreground/55 mb-3">
            One small thing today
          </p>
          <div className="space-y-2">
            {slide.tinyActions.map((t, i) => {
              const done = checked.includes(i);
              return (
                <button
                  key={i}
                  onClick={() => {
                    haptic("soft");
                    setChecked((prev) =>
                      prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]
                    );
                  }}
                  className="w-full flex items-start gap-3 text-left p-2.5 rounded-xl transition-colors"
                  style={{
                    background: done ? `hsl(${hue} 60% 45% / 0.15)` : "transparent",
                  }}
                >
                  <span
                    className="flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center mt-0.5"
                    style={{
                      background: done ? `hsl(${hue} 75% 55%)` : "transparent",
                      border: done
                        ? `1px solid hsl(${hue} 75% 55%)`
                        : "1.5px solid hsl(0 0% 100% / 0.3)",
                    }}
                  >
                    {done && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3.5} />}
                  </span>
                  <span
                    className="text-[14.5px] leading-[1.5] flex-1"
                    style={{
                      color: done
                        ? "hsl(var(--foreground) / 0.55)"
                        : "hsl(var(--foreground) / 0.92)",
                      textDecoration: done ? "line-through" : "none",
                    }}
                  >
                    {t}
                  </span>
                </button>
              );
            })}
          </div>
        </motion.div>
      )}
    </>
  );
}
