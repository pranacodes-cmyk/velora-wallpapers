import { useEffect, useState, lazy, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Crown, X } from "lucide-react";
import { FAVORITES_LIMIT_EVENT, FREE_FAVORITES_LIMIT } from "@/hooks/useFavorites";
import { haptic } from "@/utils/haptics";
import { usePremium } from "@/hooks/usePremium";
import { useT } from "@/i18n";

const PremiumSheet = lazy(() =>
  import("./PremiumSheet").then((m) => ({ default: m.PremiumSheet }))
);

export function FavoriteLimitModal() {
  const [open, setOpen] = useState(false);
  const [showPremium, setShowPremium] = useState(false);
  const { unlock } = usePremium();
  const { t } = useT();

  useEffect(() => {
    const handler = () => {
      haptic("medium");
      setOpen(true);
    };
    window.addEventListener(FAVORITES_LIMIT_EVENT, handler);
    return () => window.removeEventListener(FAVORITES_LIMIT_EVENT, handler);
  }, []);

  const close = () => setOpen(false);

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
          >
            {/* Backdrop */}
            <motion.div
              className="absolute inset-0"
              style={{
                background: "rgba(0,0,0,0.7)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />

            {/* Card */}
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ y: 40, opacity: 0, scale: 0.96 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 40, opacity: 0, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              className="relative w-full max-w-sm rounded-3xl overflow-hidden mb-[calc(env(safe-area-inset-bottom,0px)+24px)] sm:mb-0"
              style={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--glass-border))",
                boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
              }}
            >
              {/* Glow */}
              <div
                className="absolute inset-0 pointer-events-none opacity-60"
                style={{
                  background:
                    "radial-gradient(circle at 50% 0%, hsl(var(--primary) / 0.25), transparent 60%)",
                }}
              />

              <button
                onClick={close}
                className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center z-10"
                style={{ background: "hsl(var(--muted) / 0.6)" }}
              >
                <X className="w-4 h-4 text-foreground" />
              </button>

              <div className="relative p-6 pt-8 text-center">
                {/* Icon stack */}
                <div className="relative w-20 h-20 mx-auto mb-4">
                  <motion.div
                    className="absolute inset-0 rounded-3xl flex items-center justify-center"
                    style={{
                      background:
                        "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))",
                      boxShadow: "0 12px 32px hsl(var(--primary) / 0.4)",
                    }}
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <Heart className="w-9 h-9 text-white fill-white" />
                  </motion.div>
                  <motion.div
                    className="absolute -top-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center"
                    style={{
                      background: "hsl(42 85% 52%)",
                      boxShadow: "0 4px 12px hsl(42 85% 52% / 0.5)",
                    }}
                    animate={{ rotate: [0, 10, -10, 0] }}
                    transition={{ duration: 2.5, repeat: Infinity }}
                  >
                    <Crown className="w-4 h-4 text-white" />
                  </motion.div>
                </div>

                <h2 className="text-xl font-black text-foreground mb-1.5">
                  {t("ov.favLimit.title")}
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed mb-5">
                  {t("ov.favLimit.bodyPrefix")}{" "}
                  <span className="font-bold text-foreground">
                    {t("ov.favLimit.bodyWallpapers", { limit: FREE_FAVORITES_LIMIT })}
                  </span>
                  {t("ov.favLimit.bodyMiddle")}{" "}
                  <span className="font-bold text-primary">{t("ov.favLimit.bodyUnlimited")}</span>{" "}
                  {t("ov.favLimit.bodySuffix")}
                </p>

                {/* Perks */}
                <div
                  className="rounded-2xl p-3 mb-5 text-left"
                  style={{
                    background: "hsl(var(--primary) / 0.08)",
                    border: "1px solid hsl(var(--primary) / 0.2)",
                  }}
                >
                  <Perk text={t("ov.favLimit.perk1")} />
                  <Perk text={t("ov.favLimit.perk2")} />
                  <Perk text={t("ov.favLimit.perk3")} />
                  <Perk text={t("ov.favLimit.perk4")} />
                </div>

                <button
                  onClick={() => {
                    haptic("medium");
                    setOpen(false);
                    setShowPremium(true);
                  }}
                  className="w-full h-12 rounded-2xl font-bold text-sm text-white flex items-center justify-center gap-2 mb-2"
                  style={{
                    background:
                      "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))",
                    boxShadow: "0 8px 24px hsl(var(--primary) / 0.35)",
                  }}
                >
                  <Crown className="w-4 h-4" />
                  {t("ov.favLimit.unlock")}
                </button>
                <button
                  onClick={close}
                  className="w-full h-10 rounded-2xl font-semibold text-xs text-muted-foreground"
                >
                  {t("ov.favLimit.later")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {showPremium && (
        <Suspense fallback={null}>
          <PremiumSheet
            isOpen={showPremium}
            onClose={() => setShowPremium(false)}
            onUnlock={() => {
              unlock();
              setShowPremium(false);
            }}
            trigger="favorite_limit"
          />
        </Suspense>
      )}
    </>
  );
}

function Perk({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <div
        className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
        style={{ background: "hsl(var(--primary))" }}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path
            d="M2 5L4 7L8 3"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <span className="text-xs font-semibold text-foreground">{text}</span>
    </div>
  );
}
