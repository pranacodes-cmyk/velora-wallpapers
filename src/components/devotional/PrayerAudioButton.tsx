import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, Loader2 } from "lucide-react";
import { haptic } from "@/utils/haptics";
import { resolvePrayerAudio } from "@/lib/prayerAudio";
import { usePremium } from "@/hooks/usePremium";
import jesusAvatar from "@/assets/jesus-avatar.webp";
import { useT } from "@/i18n";

const PremiumSheet = lazy(() =>
  import("@/components/PremiumSheet").then((m) => ({ default: m.PremiumSheet }))
);

export const PRAYER_MUSIC_READY_EVENT = "prayer-music-ready";

interface Props {
  prayerIndex: number;
  isActive: boolean;
}

function formatDuration(sec: number): string {
  if (!sec || !isFinite(sec) || sec <= 0) return "";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Listen-to-prayer button.
 *
 * Premium users → full auto-play experience (unchanged).
 * Free users    → see a muted speaker pill with the audio duration and a small
 *                 lock badge. Tapping reveals the Premium sheet with copy that
 *                 invites them to *hear* today's prayer instead of selling features.
 *                 The audio file is still probed so we never advertise a duration
 *                 for a prayer that hasn't been narrated yet.
 */
export default function PrayerAudioButton({ prayerIndex, isActive }: Props) {
  const { t } = useT();
  const { isPremium, unlock } = usePremium();
  const [url, setUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const userPausedRef = useRef(false);

  // Hard reset whenever the prayer changes
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
    setDuration(0);
    setLoading(false);
    userPausedRef.current = false;

    let cancelled = false;
    resolvePrayerAudio(prayerIndex).then((u) => {
      if (cancelled) return;
      setUrl(u);
      // Probe duration metadata (cheap — no actual download for full file).
      if (u) {
        const probe = new Audio();
        probe.preload = "metadata";
        probe.addEventListener(
          "loadedmetadata",
          () => {
            if (!cancelled && probe.duration && isFinite(probe.duration)) {
              setDuration(probe.duration);
            }
          },
          { once: true }
        );
        probe.src = u;
      }
    });
    return () => {
      cancelled = true;
    };
  }, [prayerIndex]);

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

  const ensureAudio = (src: string): HTMLAudioElement => {
    if (audioRef.current) return audioRef.current;
    const a = new Audio(src);
    a.preload = "auto";
    a.addEventListener("timeupdate", () => {
      if (a.duration > 0) setProgress(a.currentTime / a.duration);
    });
    a.addEventListener("loadedmetadata", () => {
      if (a.duration && isFinite(a.duration)) setDuration(a.duration);
    });
    a.addEventListener("play", () => {
      setPlaying(true);
      setLoading(false);
    });
    a.addEventListener("pause", () => setPlaying(false));
    a.addEventListener("ended", () => {
      setPlaying(false);
      setProgress(1);
    });
    a.addEventListener("waiting", () => setLoading(true));
    a.addEventListener("playing", () => setLoading(false));
    a.addEventListener("canplay", () => setLoading(false));
    audioRef.current = a;
    return a;
  };

  // Auto-play (premium only) — wait until ambient music has actually started so
  // narration never beats the music to the user's ears.
  const musicReadyRef = useRef(false);
  useEffect(() => {
    const onReady = () => { musicReadyRef.current = true; };
    window.addEventListener(PRAYER_MUSIC_READY_EVENT, onReady);
    return () => window.removeEventListener(PRAYER_MUSIC_READY_EVENT, onReady);
  }, []);

  useEffect(() => {
    if (!isPremium) return;
    if (!isActive || !url) return;
    if (userPausedRef.current) return;
    let cancelled = false;
    const start = () => {
      if (cancelled) return;
      const a = ensureAudio(url);
      setLoading(true);
      a.play()
        .then(() => setLoading(false))
        .catch(() => setLoading(false));
    };
    if (musicReadyRef.current) {
      // Tiny grace so the music's fade-in is audible first.
      const t = window.setTimeout(start, 350);
      return () => { cancelled = true; window.clearTimeout(t); };
    }
    const onReady = () => {
      window.removeEventListener(PRAYER_MUSIC_READY_EVENT, onReady);
      window.setTimeout(start, 350);
    };
    window.addEventListener(PRAYER_MUSIC_READY_EVENT, onReady);
    // Safety: if music never reports ready within 2.5s, start anyway.
    const fallback = window.setTimeout(start, 2500);
    return () => {
      cancelled = true;
      window.removeEventListener(PRAYER_MUSIC_READY_EVENT, onReady);
      window.clearTimeout(fallback);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, url, isPremium]);

  // Pause instantly when the slide leaves the viewport (premium only path).
  useEffect(() => {
    if (!isActive && audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
    }
  }, [isActive]);

  // Pause when the app is backgrounded (Android minimize / tab hidden).
  useEffect(() => {
    const onHide = () => {
      if (audioRef.current && !audioRef.current.paused) audioRef.current.pause();
    };
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) onHide();
    });
    window.addEventListener("pagehide", onHide);
    window.addEventListener("blur", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("blur", onHide);
    };
  }, []);


  const togglePremium = () => {
    if (!url) return;
    haptic("soft");
    const a = ensureAudio(url);
    if (playing) {
      userPausedRef.current = true;
      a.pause();
    } else {
      userPausedRef.current = false;
      setLoading(true);
      import("@/services/analytics").then((an) => an.track("prayer_played", { prayer_index: prayerIndex, trigger: "manual" })).catch(() => {});
      a.play()
        .then(() => setLoading(false))
        .catch(() => setLoading(false));
    }
  };

  const openPaywall = () => {
    haptic("medium");
    setPaywallOpen(true);
    import("@/services/analytics").then((an) => an.track("paywall_shown", { trigger: "prayer_audio_locked", prayer_index: prayerIndex })).catch(() => {});
  };


  // Nothing to show until we know the audio exists.
  if (!url) return null;

  // -------- Free user: faux-playing pill (progress + muted icon → paywall) --------
  if (!isPremium) {
    const durLabel = formatDuration(duration);
    return (
      <>
        <motion.button
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          whileTap={{ scale: 0.94 }}
          onClick={openPaywall}
          className="relative flex items-center gap-2 pl-1 pr-3 py-1 rounded-full overflow-hidden flex-shrink-0 max-w-[260px]"
          style={{
            background: "rgba(255,255,255,0.07)",
            backdropFilter: "blur(20px) saturate(150%)",
            WebkitBackdropFilter: "blur(20px) saturate(150%)",
            border: "1px solid rgba(255,215,0,0.36)",
            boxShadow: "0 4px 16px -4px rgba(255,180,50,0.32)",
          }}
          aria-label={t("pr.audio.ariaListen")}
        >
          {/* Subtle ambient sheen */}
          <div
            aria-hidden
            className="absolute inset-y-0 left-0 w-full pointer-events-none opacity-60"
            style={{
              background:
                "linear-gradient(90deg, rgba(255,215,0,0.18), rgba(255,180,50,0.04))",
            }}
          />

          {/* Jesus avatar — the image already includes a golden halo */}
          <div className="relative flex-shrink-0">
            <motion.span
              aria-hidden
              className="absolute inset-0 rounded-full"
              animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
              transition={{ duration: 1.9, repeat: Infinity, ease: "easeOut" }}
              style={{ background: "rgba(255,215,0,0.5)" }}
            />
            <div
              className="relative w-9 h-9 rounded-full overflow-hidden"
              style={{
                boxShadow:
                  "0 0 0 1.5px rgba(255,215,0,0.9), 0 4px 14px -2px rgba(255,180,50,0.7)",
              }}
            >
              <img
                src={jesusAvatar}
                alt=""
                aria-hidden
                loading="lazy"
                width={36}
                height={36}
                className="absolute inset-0 w-full h-full object-cover"
              />
            </div>
          </div>

          <span className="relative text-[11px] font-bold tracking-tight text-amber-100/95 truncate min-w-0">
            {t("pr.audio.tapListen")}{durLabel && ` · ${durLabel}`}
          </span>
        </motion.button>


        <Suspense fallback={null}>
          {paywallOpen && (
            <PremiumSheet
              isOpen={paywallOpen}
              onClose={() => setPaywallOpen(false)}
              onUnlock={unlock}
              trigger="prayer_audio"
            />
          )}
        </Suspense>
      </>
    );
  }

  // -------- Premium user: original full experience --------
  return (
    <AnimatePresence>
      <motion.button
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.35 }}
        whileTap={{ scale: 0.94 }}
        onClick={togglePremium}
        className="relative flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full overflow-hidden flex-shrink-0 max-w-[180px]"
        style={{
          background: "rgba(255,255,255,0.08)",
          backdropFilter: "blur(20px) saturate(150%)",
          WebkitBackdropFilter: "blur(20px) saturate(150%)",
          border: "1px solid rgba(255,215,0,0.38)",
          boxShadow: "0 4px 16px -4px rgba(255,180,50,0.32)",
        }}
        aria-label={playing ? t("pr.audio.ariaPause") : t("pr.audio.ariaPlay")}
      >
        <div
          aria-hidden
          className="absolute inset-y-0 left-0 pointer-events-none transition-[width] duration-200"
          style={{
            width: `${progress * 100}%`,
            background:
              "linear-gradient(90deg, rgba(255,215,0,0.30), rgba(255,180,50,0.18))",
          }}
        />
        <div
          className="relative w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
          style={{
            background:
              "linear-gradient(135deg, rgba(255,215,0,0.98), rgba(255,170,40,0.98))",
            boxShadow: "0 4px 14px -2px rgba(255,180,50,0.6)",
          }}
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: "#3a2000" }} strokeWidth={3} />
          ) : playing ? (
            <Pause className="w-3.5 h-3.5" style={{ color: "#3a2000" }} strokeWidth={3} fill="currentColor" />
          ) : (
            <Play className="w-3.5 h-3.5 ml-[1px]" style={{ color: "#3a2000" }} strokeWidth={3} fill="currentColor" />
          )}
        </div>
        <span className="relative text-[11px] font-bold tracking-tight text-amber-100/95 truncate min-w-0">
          {loading
            ? t("pr.audio.preparing")
            : playing
            ? t("pr.audio.listening")
            : `${t("pr.audio.listen")}${duration ? ` · ${formatDuration(duration)}` : ""}`}
        </span>
      </motion.button>
    </AnimatePresence>
  );
}
