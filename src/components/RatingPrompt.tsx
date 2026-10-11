import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Star, MessageCircle, X } from "lucide-react";
import { openNativeRating, openFeedback, markLater } from "@/services/rating";
import { acquireOverlay } from "@/lib/overlayQueue";
import { haptic } from "@/utils/haptics";
import { useT } from "@/i18n";

type Step = "ask" | "thank" | "feedback";

/**
 * Listens for "jw:show-rating-prompt" and presents a 2-step sheet with a
 * faithful, Jesus-centered tone:
 *   1. "Has this app blessed you?" → 🙌 Yes / 🤔 Could be better
 *   2a. Yes → glowing 5-star moment → opens native Play Store review
 *   2b. Could be better → "Share what's on your heart" → email feedback
 *
 * Designed to maximize 5-star CTR by routing unhappy users to private
 * feedback while inviting blessed users to share publicly. Serialized
 * through the overlayQueue so a paywall/permission nudge never covers it.
 */
export function RatingPrompt() {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("ask");
  const releaseRef = useRef<null | (() => void)>(null);

  const trackEvent = (event: string, props?: Record<string, any>) => {
    import("@/services/analytics").then((a) => a.track(event, props)).catch(() => {});
  };

  useEffect(() => {
    const handler = async () => {
      // Wait for any competing overlay (paywall, notif primer, perm nudge)
      // to release first so this prompt is always the top-most sheet.
      const release = await acquireOverlay("rating_prompt");
      releaseRef.current = release;
      setStep("ask");
      setOpen(true);
      trackEvent("rating_prompt_shown");
    };
    window.addEventListener("jw:show-rating-prompt", handler);
    return () => window.removeEventListener("jw:show-rating-prompt", handler);
  }, []);

  const closeAndRelease = () => {
    setOpen(false);
    if (releaseRef.current) {
      releaseRef.current();
      releaseRef.current = null;
    }
    // Let chained overlays (e.g. paywall) know the rating flow is done.
    try { window.dispatchEvent(new Event("jw:rating-flow-done")); } catch {}
  };

  const handleLove = async () => {
    haptic("medium");
    trackEvent("rating_love_clicked");
    setStep("thank");
    // Brief celebration moment before Play sheet pops
    setTimeout(async () => {
      await openNativeRating();
      trackEvent("rating_play_store_opened");
      closeAndRelease();
    }, 1100);
  };

  const handleNotReally = () => {
    haptic("soft");
    trackEvent("rating_not_really_clicked");
    setStep("feedback");
  };

  const handleSendFeedback = () => {
    haptic("soft");
    trackEvent("rating_feedback_sent");
    openFeedback();
    closeAndRelease();
  };

  const handleDismiss = () => {
    haptic("soft");
    trackEvent("rating_dismissed", { step });
    // Soft dismiss: never a permanent opt-out. Users tap the backdrop or the
    // X by accident constantly — killing the prompt forever cost us ratings.
    markLater();
    closeAndRelease();
  };


  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            background: "hsl(var(--background) / 0.7)",
            backdropFilter: "blur(24px) saturate(1.4)",
          }}
          onClick={() => {
            // Backdrop taps are usually accidental — ignore them so a stray
            // tap doesn't burn a rating opportunity. Only X / "later" dismiss.
            trackEvent("rating_backdrop_tap", { step });
          }}
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ y: 60, scale: 0.94, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 60, scale: 0.94, opacity: 0 }}
            transition={{ type: "spring", damping: 24, stiffness: 320 }}
            className="w-full max-w-sm rounded-[28px] p-7 text-center relative overflow-hidden"
            style={{
              background:
                "linear-gradient(180deg, hsl(var(--card)) 0%, hsl(var(--card) / 0.96) 100%)",
              border: "1px solid hsl(var(--glass-border))",
              boxShadow:
                "0 40px 100px hsl(var(--background) / 0.7), 0 0 0 1px hsl(var(--primary) / 0.08) inset",
            }}
          >
            {/* Gold halo */}
            <div
              className="absolute -top-32 left-1/2 -translate-x-1/2 w-[360px] h-[240px] pointer-events-none"
              style={{
                background:
                  "radial-gradient(closest-side, hsl(var(--primary) / 0.22), transparent 70%)",
              }}
            />

            {/* Close */}
            <button
              onClick={handleDismiss}
              className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center z-10"
              style={{
                background: "hsl(var(--background) / 0.5)",
                border: "1px solid hsl(var(--glass-border))",
              }}
              aria-label={t("common.close")}
            >
              <X className="w-4 h-4 text-foreground/60" />
            </button>

            {step === "ask" && (
              <motion.div
                key="ask"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.div
                  className="w-20 h-20 mx-auto rounded-3xl flex items-center justify-center mb-5 relative"
                  style={{
                    background:
                      "linear-gradient(135deg, hsl(var(--primary) / 0.25), hsl(var(--accent) / 0.15))",
                    border: "1px solid hsl(var(--primary) / 0.4)",
                    boxShadow: "0 12px 40px hsl(var(--primary) / 0.3)",
                  }}
                  animate={{ y: [0, -4, 0], rotate: [0, -3, 3, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                >
                  <Heart className="w-10 h-10 text-primary fill-primary" strokeWidth={1.5} />
                </motion.div>

                <h2 className="text-[22px] font-black text-foreground mb-2 tracking-tight">
                  {t("ov.rating.ask.title")}
                </h2>
                <p className="text-[14px] text-foreground/65 mb-7 leading-relaxed px-2">
                  {t("ov.rating.ask.body")}
                </p>

                <div className="flex flex-col gap-2.5">
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleLove}
                    className="w-full h-14 rounded-2xl font-black text-[15px] gap-2 inline-flex items-center justify-center text-white relative overflow-hidden"
                    style={{
                      background:
                        "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))",
                      boxShadow: "0 10px 30px hsl(var(--primary) / 0.4)",
                    }}
                  >
                    <Star className="w-5 h-5 fill-white" strokeWidth={2} />
                    {t("ov.rating.ask.yes")}
                  </motion.button>

                  <button
                    onClick={handleNotReally}
                    className="w-full h-12 rounded-2xl text-[14px] font-semibold text-foreground/70 hover:text-foreground transition"
                    style={{
                      background: "hsl(var(--background) / 0.5)",
                      border: "1px solid hsl(var(--glass-border))",
                    }}
                  >
                    {t("ov.rating.ask.no")}
                  </button>
                </div>
              </motion.div>
            )}

            {step === "thank" && (
              <motion.div
                key="thank"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.div
                  className="flex justify-center gap-1.5 mb-5"
                  initial="hidden"
                  animate="show"
                  variants={{
                    show: { transition: { staggerChildren: 0.08 } },
                  }}
                >
                  {[0, 1, 2, 3, 4].map((i) => (
                    <motion.div
                      key={i}
                      variants={{
                        hidden: { scale: 0, rotate: -90, opacity: 0 },
                        show: { scale: 1, rotate: 0, opacity: 1 },
                      }}
                      transition={{ type: "spring", damping: 12, stiffness: 300 }}
                    >
                      <Star
                        className="w-9 h-9 text-primary fill-primary"
                        strokeWidth={1.5}
                        style={{ filter: "drop-shadow(0 4px 12px hsl(var(--primary) / 0.5))" }}
                      />
                    </motion.div>
                  ))}
                </motion.div>
                <h2 className="text-[22px] font-black text-foreground mb-2 tracking-tight">
                  {t("ov.rating.thank.title")}
                </h2>
                <p className="text-[14px] text-foreground/65 leading-relaxed px-2">
                  {t("ov.rating.thank.body")}
                </p>
              </motion.div>
            )}

            {step === "feedback" && (
              <motion.div
                key="feedback"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
              >
                <div
                  className="w-20 h-20 mx-auto rounded-3xl flex items-center justify-center mb-5"
                  style={{
                    background: "hsl(var(--accent) / 0.15)",
                    border: "1px solid hsl(var(--accent) / 0.35)",
                  }}
                >
                  <MessageCircle className="w-10 h-10 text-accent" strokeWidth={1.8} />
                </div>
                <h2 className="text-[22px] font-black text-foreground mb-2 tracking-tight">
                  {t("ov.rating.feedback.title")}
                </h2>
                <p className="text-[14px] text-foreground/65 mb-6 leading-relaxed px-2">
                  {t("ov.rating.feedback.body")}
                </p>
                <div className="flex flex-col gap-2.5">
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleSendFeedback}
                    className="w-full h-14 rounded-2xl font-black text-[15px] gap-2 inline-flex items-center justify-center text-white"
                    style={{
                      background:
                        "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))",
                      boxShadow: "0 10px 30px hsl(var(--primary) / 0.4)",
                    }}
                  >
                    <MessageCircle className="w-5 h-5" strokeWidth={2.2} />
                    {t("ov.rating.feedback.send")}
                  </motion.button>
                  <button
                    onClick={handleDismiss}
                    className="w-full h-11 rounded-2xl text-[13px] font-semibold text-foreground/55"
                  >
                    {t("ov.rating.feedback.later")}
                  </button>
                </div>
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
