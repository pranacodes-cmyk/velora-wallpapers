import { useT } from "@/i18n";
import { motion } from "framer-motion";
import { Play, Heart, Swords, Loader2, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface QuizReviveProps {
  streak: number;
  onRevive: () => Promise<void> | void;
  onGiveUp: () => void;
  mode?: string;
  reviveCount?: number;
  maxRevives?: number;
}

export function QuizRevive({ streak, onRevive, onGiveUp, mode, reviveCount = 0, maxRevives = 3 }: QuizReviveProps) {
  const { t } = useT();
  const isChallenge = mode === "challenge";
  const used = reviveCount;
  const remaining = Math.max(0, maxRevives - used);
  const isLast = remaining === 1;
  const [loading, setLoading] = useState(false);

  const handleRevive = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await onRevive();
    } finally {
      // keep loading visible briefly even on success — overlay will unmount
      setTimeout(() => setLoading(false), 400);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{
        background: "hsl(var(--background) / 0.85)",
        backdropFilter: "blur(20px) saturate(1.4)",
      }}
    >
      <motion.div
        className="w-full max-w-sm rounded-3xl p-7 text-center relative overflow-hidden"
        style={{
          background:
            "linear-gradient(180deg, hsl(var(--card)) 0%, hsl(var(--card) / 0.95) 100%)",
          border: "1px solid hsl(var(--glass-border))",
          boxShadow:
            "0 30px 80px hsl(var(--background) / 0.6), 0 0 0 1px hsl(var(--primary) / 0.06) inset",
        }}
        initial={{ y: 30, scale: 0.95 }}
        animate={{ y: 0, scale: 1 }}
        transition={{ type: "spring", damping: 22, stiffness: 280 }}
      >
        {/* Subtle gold halo */}
        <div
          className="absolute -top-24 left-1/2 -translate-x-1/2 w-[280px] h-[180px] pointer-events-none"
          style={{
            background:
              "radial-gradient(closest-side, hsl(var(--primary) / 0.18), transparent 70%)",
          }}
        />

        {/* Icon */}
        <motion.div
          className="w-20 h-20 mx-auto rounded-2xl flex items-center justify-center mb-5 relative"
          style={{
            background:
              "linear-gradient(135deg, hsl(var(--primary) / 0.18), hsl(var(--accent) / 0.12))",
            border: "1px solid hsl(var(--primary) / 0.35)",
            boxShadow: "0 8px 30px hsl(var(--primary) / 0.25)",
          }}
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        >
          {isChallenge ? (
            <Swords className="w-9 h-9 text-primary" strokeWidth={2} />
          ) : (
            <Flame className="w-9 h-9 text-primary" strokeWidth={2} />
          )}
        </motion.div>

        <h2 className="text-2xl font-black text-foreground mb-2 tracking-tight">
          {isChallenge ? t("quiz.revive.titleChallenge") : t("quiz.revive.titleStreak")}
        </h2>
        <p className="text-sm text-foreground/75 mb-1.5 leading-relaxed">
          {isChallenge ? (
            <>{t("quiz.revive.descChallenge")}</>
          ) : (
            <>
              {t("quiz.revive.descStreak", { count: streak })}
            </>
          )}
        </p>
        <p className="text-[13px] text-foreground/60 mb-5 leading-relaxed">
          {isLast
            ? t("quiz.revive.lastRevive")
            : t("quiz.revive.watchAd")}
        </p>

        {/* Lives indicator — hearts representing remaining revives */}
        <div
          className="inline-flex items-center justify-center gap-2.5 mb-6 px-4 py-2 rounded-full"
          style={{
            background: "hsl(var(--primary) / 0.1)",
            border: "1px solid hsl(var(--primary) / 0.2)",
          }}
        >
          <div className="flex items-center gap-1">
            {Array.from({ length: maxRevives }).map((_, i) => {
              const filled = i < remaining;
              return (
                <Heart
                  key={i}
                  className={`w-3.5 h-3.5 transition-all ${
                    filled ? "text-primary fill-primary" : "text-foreground/25"
                  }`}
                />
              );
            })}
          </div>
          <span className="text-[11px] font-bold text-foreground/85 tabular-nums">
            {t("quiz.revive.status", { current: remaining, total: maxRevives, label: remaining === 1 ? t("quiz.revive.reviveLabelOne") : t("quiz.revive.reviveLabelOther") })}
          </span>
        </div>

        <div className="flex flex-col gap-2.5">
          <Button
            onClick={handleRevive}
            disabled={loading}
            className="w-full h-12 rounded-xl font-bold text-sm gap-2 text-white relative overflow-hidden"
            style={{
              background:
                "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))",
              boxShadow: "0 8px 24px hsl(var(--primary) / 0.35)",
            }}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t("quiz.revive.loading")}
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" /> {t("quiz.revive.btnRevive")}
              </>
            )}
          </Button>
          <Button
            onClick={onGiveUp}
            disabled={loading}
            variant="ghost"
            className="w-full h-10 rounded-xl text-sm text-foreground/65 hover:text-foreground"
          >
            {t("quiz.revive.btnGiveUp")}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
