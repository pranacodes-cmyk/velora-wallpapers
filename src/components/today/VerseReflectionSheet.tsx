import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Share2, Check, Star } from "lucide-react";
import { markReflectionDone, useTodayTasks } from "@/hooks/useTodayTasks";
import { haptic } from "@/utils/haptics";
import { useVerseWallpaper } from "@/hooks/useVerseWallpaper";
import { VERSE_REFLECTIONS } from "@/data/verseReflections";
import { setHandoff } from "@/lib/dailyFunnel";
import { tryShowInterstitial } from "@/services/ad-cooldown";
import { useAndroidBack } from "@/hooks/useAndroidBack";
import { track } from "@/services/analytics";
import { useT } from "@/i18n";
import { localizeReflection } from "@/i18n/content";

import { bumpStreakIfNewDay } from "@/hooks/useStreak";


interface Props {
  open: boolean;
  onClose: () => void;
}

// Hand-crafted, per-verse reflections (319 unique references) live in
// src/data/verseReflections.ts, keyed by the English reference. Translations
// live in src/i18n/content/reflections/<lang>.ts. If a verse is somehow
// missing, we fall back to a graceful default so the UI never goes blank.
function buildReflection(reference: string): { meaning: string; apply: string } {
  const hit = VERSE_REFLECTIONS[reference];
  if (hit) return localizeReflection(reference, hit);
  return {
    meaning: `${reference} is short on length and long on weight. Read it slowly — let it land as something spoken to you today, not just something written long ago.`,
    apply: "Pick one phrase that hit hardest and carry it into the next hour. Let it interrupt the noise when the day gets loud.",
  };
}

export default function VerseReflectionSheet({ open, onClose }: Props) {
  const navigate = useNavigate();
  
  const { allDone } = useTodayTasks();
  const { verse, bgSrc, share, loading } = useVerseWallpaper();
  const refKey = verse.refKey ?? verse.reference;
  const { lang, version } = useT();
  const reflection = useMemo(
    () => buildReflection(refKey),
    [refKey, lang, version]
  );

  const [marked, setMarked] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [handingOff, setHandingOff] = useState(false);

  useEffect(() => {
    if (open && !marked) {
      markReflectionDone();
      bumpStreakIfNewDay();
      setMarked(true);
      track("reflection_sheet_opened", { reference: verse.reference, all_done: allDone });
    }
  }, [open, marked, verse.reference, allDone]);

  // Hide the global bottom nav while the reflection is open so it feels
  // like a full-screen moment (same pattern as Devotional/Quiz/Chat).
  useEffect(() => {
    if (!open) return;
    document.body.dataset.hideNav = "true";
    return () => { delete document.body.dataset.hideNav; };
  }, [open]);

  // Daily flow ad cadence: ONE interstitial fires on close (any path),
  // gated by the global 45s cooldown — so if a prayer-close ad just fired,
  // this one is automatically suppressed. No back-to-back stacking.
  const closeOnly = async () => {
    haptic("soft");
    track("reflection_sheet_closed", { method: "x_button", all_done: allDone });
    if (!allDone) setHandoff("quiz");
    onClose();
  };


  // Hardware back button closes the sheet (instead of bubbling to exit dialog).
  useAndroidBack(open ? () => { void closeOnly(); } : undefined);


  // Explicit "Continue to Quiz" button — still routes directly.
  const closeAndContinueToQuiz = async () => {
    if (handingOff) return;
    if (allDone) {
      haptic("soft");
      track("reflection_sheet_closed", { method: "continue_button", all_done: true });
      onClose();
      return;
    }
    setHandingOff(true);
    haptic("soft");
    track("reflection_continue_to_quiz_tapped", { reference: verse.reference });
    onClose();
    navigate("/quiz?auto=daily");
  };

  const handleShare = async () => {
    if (sharing || loading) return;
    haptic("medium");
    setSharing(true);
    track("reflection_share_tapped", { reference: verse.reference });
    try {
      await share();
      track("reflection_share_completed", { reference: verse.reference });
    } finally {
      setSharing(false);
    }
  };


  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[100] overflow-hidden"
          data-back-consumer="reflection-sheet"
        >

          {/* Full wallpaper background */}
          <div className="absolute inset-0">
            <img
              src={bgSrc}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.45) 30%, rgba(0,0,0,0.7) 70%, rgba(0,0,0,0.92) 100%)",
              }}
            />
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "radial-gradient(ellipse at 50% 38%, transparent 25%, rgba(0,0,0,0.55) 100%)",
              }}
            />
          </div>

          <button
            onClick={closeOnly}
            className="absolute top-[max(env(safe-area-inset-top),14px)] right-4 z-10 w-10 h-10 rounded-full flex items-center justify-center bg-black/45 backdrop-blur-md border border-white/15 hover:bg-black/60"
            aria-label="Close"
          >
            <X className="w-[18px] h-[18px] text-white" strokeWidth={2.4} />
          </button>

          <div
            className="relative h-full w-full overflow-y-auto px-6 flex flex-col"
            style={{
              paddingTop: "max(env(safe-area-inset-top), 18px)",
              paddingBottom: "max(env(safe-area-inset-bottom), 22px)",
            }}
          >
            {/* Eyebrow */}
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05, duration: 0.4 }}
              className="flex items-center justify-center gap-1.5 mt-10 mb-8"
            >
              <Star className="w-3 h-3 text-amber-300" strokeWidth={2.6} />
              <p className="text-[10px] font-extrabold uppercase tracking-[0.3em] text-amber-200/95">
                Today's reflection
              </p>
            </motion.div>

            {/* Verse — hero on the wallpaper */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className="relative px-1 pt-6 pb-10 text-center"
            >
              <div className="flex justify-center mb-6">
                <svg width="32" height="40" viewBox="0 0 28 36" fill="none">
                  <line x1="14" y1="2" x2="14" y2="34" stroke="#f5cc6e" strokeWidth="2.8" strokeLinecap="round" style={{ filter: "drop-shadow(0 0 8px rgba(245,204,110,0.75))" }} />
                  <line x1="3" y1="12" x2="25" y2="12" stroke="#f5cc6e" strokeWidth="2.8" strokeLinecap="round" style={{ filter: "drop-shadow(0 0 8px rgba(245,204,110,0.75))" }} />
                </svg>
              </div>

              <p
                className="text-white font-semibold italic leading-[1.5] text-[22px]"
                style={{
                  fontFamily: "'Georgia', 'Times New Roman', serif",
                  textShadow: "0 2px 20px rgba(0,0,0,0.9), 0 1px 4px rgba(0,0,0,0.9)",
                }}
              >
                "{verse.text}"
              </p>

              <div className="mt-6 flex items-center justify-center gap-3">
                <span className="h-px w-10 bg-amber-200/55" />
                <p
                  className="font-extrabold tracking-[0.28em] uppercase text-[11px] text-amber-200"
                  style={{ textShadow: "0 1px 6px rgba(0,0,0,0.85)" }}
                >
                  {verse.reference}
                </p>
                <span className="h-px w-10 bg-amber-200/55" />
              </div>
            </motion.div>

            {/* Two-part reflection that actually explains the verse */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.22, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className="mt-2"
            >
              <div
                className="rounded-2xl p-5 backdrop-blur-md"
                style={{
                  background: "rgba(10, 12, 20, 0.6)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <p className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-amber-200/85 mb-2.5">
                  Reflection
                </p>
                <p className="text-[14.5px] text-white/90 leading-[1.65]">
                  {reflection.meaning}
                </p>
                <p className="mt-3 text-[14px] text-amber-100/90 leading-[1.6] italic">
                  {reflection.apply}
                </p>
              </div>
            </motion.div>

            <div className="flex-1 min-h-[24px]" />

            {/* CTAs pinned near the bottom of the full-screen view */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.32, duration: 0.45 }}
              className="mt-6"
            >
              <button
                onClick={closeAndContinueToQuiz}
                disabled={handingOff}
                className="w-full rounded-[22px] py-4 text-[15px] font-extrabold tracking-tight flex items-center justify-center gap-2 disabled:opacity-70"
                style={{
                  background:
                    "linear-gradient(135deg, #ffd966 0%, #f5cc6e 45%, #e8b94a 100%)",
                  color: "#1a1305",
                  boxShadow:
                    "0 16px 36px -10px rgba(245, 204, 110, 0.6), inset 0 1px 0 rgba(255,255,255,0.55), inset 0 -1px 0 rgba(0,0,0,0.18)",
                }}
              >
                <Check className="w-[18px] h-[18px]" strokeWidth={3} />
                {handingOff ? "Loading quiz…" : "Continue to Daily Quiz →"}
              </button>

              <button
                onClick={handleShare}
                disabled={sharing || loading}
                className="w-full mt-2.5 rounded-[18px] py-3 text-[13px] font-bold text-white/85 hover:text-white flex items-center justify-center gap-1.5 disabled:opacity-70 border border-white/15 bg-white/[0.04] backdrop-blur-md"
              >
                <Share2 className="w-3.5 h-3.5" strokeWidth={2.6} />
                {sharing ? "Preparing…" : loading ? "Crafting wallpaper…" : "Share this verse"}
              </button>

            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
