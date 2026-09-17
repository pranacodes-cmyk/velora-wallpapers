import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Play, Pause, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { haptic } from "@/utils/haptics";
import { useT, getLang } from "@/i18n";
import type { RichDay } from "@/data/journeyRichContent";
import {
  composeNarrationScript,
  narrationSlideBoundaries,
} from "@/lib/narrationScript";

interface Props {
  journeyId: string;
  day: number;
  rich: RichDay;
  hue: number;
  /** Called continuously with playback ratio 0..1 while audio is playing. */
  onProgress?: (ratio: number, playing: boolean) => void;
  /** Index of the slide currently visible to the user. */
  activeSlideIndex?: number;
  /** Cumulative end-of-slide ratios (matches narrationSlideBoundaries). */
  boundaries?: number[];
}

// Re-export so the parent (RichDayExperience) keeps its existing import.
export const slideBoundaries = narrationSlideBoundaries;


export function NarrationPlayer({ journeyId, day, rich, hue, onProgress, activeSlideIndex, boundaries }: Props) {
  const { t } = useT();

  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;
  // Track user intent so we only autoplay when entering a chapter, never
  // override a deliberate pause.
  const userPausedRef = useRef(false);

  // Hard reset when the chapter changes: stop the previous narration,
  // null out the audio element, and clear any cached URL so the new
  // chapter's script is fetched and played fresh.
  useEffect(() => {
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current.load();
      } catch {}
      audioRef.current = null;
    }
    setUrl(null);
    setPlaying(false);
    setProgress(0);
    userPausedRef.current = false;
    onProgressRef.current?.(0, false);
  }, [journeyId, day]);

  // Stop audio if the component unmounts
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        try {
          audioRef.current.pause();
          audioRef.current.src = "";
        } catch {}
        audioRef.current = null;
      }
    };
  }, []);

  const ensureUrl = async (existing: string | null): Promise<string | null> => {
    if (existing) return existing;
    setLoading(true);
    try {
      const script = composeNarrationScript(rich);
      const { data, error } = await supabase.functions.invoke(
        "generate-day-narration",
        { body: { journeyId, day, script } },
      );
      if (error) throw error;
      const u = (data as { url?: string })?.url;
      if (!u) throw new Error("no url");
      setUrl(u);
      return u;
    } catch (e) {
      console.error("narration error", e);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const ensureAudio = (u: string): HTMLAudioElement => {
    if (audioRef.current) return audioRef.current;
    const a = new Audio(u);
    a.preload = "auto";
    a.addEventListener("timeupdate", () => {
      if (a.duration > 0) {
        const r = a.currentTime / a.duration;
        setProgress(r);
        onProgressRef.current?.(r, !a.paused);
      }
    });
    a.addEventListener("ended", () => {
      setPlaying(false);
      setProgress(1);
      onProgressRef.current?.(1, false);
    });
    a.addEventListener("pause", () => {
      setPlaying(false);
      onProgressRef.current?.(a.duration ? a.currentTime / a.duration : 0, false);
    });
    a.addEventListener("play", () => setPlaying(true));
    audioRef.current = a;
    return a;
  };

  // Auto-play narration whenever the chapter opens / changes.
  // English only: narration audio exists solely in English, so for every other
  // language we stay silent until the user taps Listen (no prefetch either).
  useEffect(() => {
    if (getLang() !== "en") return;
    let cancelled = false;
    (async () => {
      const u = await ensureUrl(null);
      if (cancelled || !u) return;
      if (userPausedRef.current) return;
      const a = ensureAudio(u);
      a.play().catch(() => {
        // Autoplay blocked (e.g. no prior gesture) — user can tap Listen.
      });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journeyId, day]);


  // Keep audio in sync when the user manually navigates between slides.
  // If the playhead is outside the active slide's window, snap it to that
  // slide's start so the voice matches what's on screen.
  useEffect(() => {
    if (activeSlideIndex == null || !boundaries || boundaries.length === 0) return;
    const a = audioRef.current;
    if (!a || !a.duration || !isFinite(a.duration)) return;
    const startRatio = activeSlideIndex === 0 ? 0 : boundaries[activeSlideIndex - 1];
    const endRatio = boundaries[activeSlideIndex] ?? 1;
    const current = a.currentTime / a.duration;
    // Small tolerance so auto-advance (which already lands inside the window)
    // never triggers a re-seek.
    const tol = 0.005;
    if (current < startRatio - tol || current > endRatio + tol) {
      try {
        a.currentTime = Math.max(0, startRatio * a.duration);
      } catch {}
    }
  }, [activeSlideIndex, boundaries]);



  const toggle = async () => {
    haptic("soft");
    const u = await ensureUrl(url);
    if (!u) return;
    const a = ensureAudio(u);
    if (playing) {
      userPausedRef.current = true;
      a.pause();
    } else {
      userPausedRef.current = false;
      a.play().catch(() => {});
    }
  };


  return (
    <motion.button
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      onClick={toggle}
      className="relative flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full overflow-hidden flex-shrink-0 max-w-[140px]"
      style={{
        background: "hsl(var(--glass))",
        backdropFilter: "blur(20px)",
        border: "1px solid hsl(var(--glass-border))",
      }}
      aria-label={playing ? t("jn.narration.ariaPause") : t("jn.narration.ariaPlay")}
    >
      {/* Progress fill */}
      <div
        aria-hidden
        className="absolute inset-y-0 left-0 pointer-events-none transition-[width] duration-200"
        style={{
          width: `${progress * 100}%`,
          background: `linear-gradient(90deg, hsl(${hue} 70% 55% / 0.28), hsl(${hue} 80% 65% / 0.18))`,
        }}
      />
      <div
        className="relative w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
        style={{
          background: `linear-gradient(135deg, hsl(${hue} 75% 60%), hsl(${hue} 80% 48%))`,
          boxShadow: `0 4px 14px -2px hsl(${hue} 70% 45% / 0.55)`,
        }}
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 text-white animate-spin" strokeWidth={2.8} />
        ) : playing ? (
          <Pause className="w-3.5 h-3.5 text-white" strokeWidth={3} fill="currentColor" />
        ) : (
          <Play className="w-3.5 h-3.5 text-white ml-0.5" strokeWidth={3} fill="currentColor" />
        )}
      </div>
      <span className="relative text-[11px] font-bold tracking-tight text-foreground/85 truncate min-w-0">
        {loading ? t("jn.narration.preparing") : playing ? t("jn.narration.listening") : t("jn.narration.listen")}
      </span>
    </motion.button>
  );
}
