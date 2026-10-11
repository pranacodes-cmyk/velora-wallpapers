import { useT } from "@/i18n";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Trophy, Target, Flame, Zap, RotateCcw, Home, Crown, Star, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { haptic } from "@/utils/haptics";
import { toast } from "sonner";
import { showRewardedAd } from "@/services/ads";

interface QuizResultsProps {
  stats: {
    correct: number;
    wrong: number;
    streak: number;
    bestStreak: number;
    score: number;
    timeBonus: number;
  };
  mode: string;
  totalQuestions: number;
  bestStreakEver: number;
  isNewHighScore?: boolean;
  onPlayAgain: () => void;
  onHome: () => void;
  onDoubleScore?: () => void;
}

export function QuizResults({
  stats,
  mode,
  totalQuestions,
  bestStreakEver,
  isNewHighScore,
  onPlayAgain,
  onHome,
  onDoubleScore,
}: QuizResultsProps) {
  const { t } = useT();
  const [doubleUsed, setDoubleUsed] = useState(false);
  const [doubling, setDoubling] = useState(false);

  // Analytics — fires once when results render
  useEffect(() => {
    import("@/services/analytics").then((a) => a.track("quiz_completed", {
      mode,
      total_questions: totalQuestions,
      correct: stats.correct,
      wrong: stats.wrong,
      score: stats.score,
      best_streak: stats.bestStreak,
      is_new_high_score: !!isNewHighScore,
    })).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const handleDouble = async () => {
    if (doubleUsed || doubling || !onDoubleScore || stats.score <= 0) return;
    haptic("medium");
    setDoubling(true);
    const earned = await showRewardedAd(t("quiz.results.doubleLoading"));
    setDoubling(false);
    if (!earned) {
      toast.error(t("quiz.results.doubleToastError"));
      return;
    }
    onDoubleScore();
    setDoubleUsed(true);
    haptic("heavy");
    toast.success(t("quiz.results.doubleToastSuccess"));
    import("@/services/analytics").then((a) => a.track("quiz_score_doubled", { mode, score: stats.score })).catch(() => {});
  };


  const percentage = totalQuestions > 0 ? Math.round((stats.correct / totalQuestions) * 100) : 0;
  const isPerfect = percentage === 100;
  const isGreat = percentage >= 80;
  const isGood = percentage >= 50;

  const emoji = isPerfect ? "👑" : isGreat ? "🏆" : isGood ? "👏" : "📖";
  const message = isPerfect
    ? t("quiz.results.perfect")
    : isGreat
    ? t("quiz.results.great")
    : isGood
    ? t("quiz.results.good")
    : t("quiz.results.keepLearning");

  const grade = isPerfect ? "S" : isGreat ? "A" : isGood ? "B" : percentage >= 30 ? "C" : "D";
  const gradeColor = isPerfect ? "hsl(42 85% 52%)" : isGreat ? "hsl(142 60% 45%)" : isGood ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
      className="flex flex-col items-center gap-5 px-2"
    >
      {/* Confetti particles for great scores */}
      {isGreat && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          {Array.from({ length: 20 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 rounded-full"
              style={{
                background: ['hsl(var(--primary))', 'hsl(var(--accent))', 'hsl(42 85% 52%)', 'hsl(142 60% 45%)', '#fff'][i % 5],
                left: `${Math.random() * 100}%`,
                top: -10,
              }}
              animate={{
                y: [0, window.innerHeight + 20],
                x: [0, (Math.random() - 0.5) * 200],
                rotate: [0, Math.random() * 720],
                opacity: [1, 1, 0],
              }}
              transition={{
                duration: 2 + Math.random() * 2,
                delay: Math.random() * 0.5,
                ease: "easeOut",
              }}
            />
          ))}
        </div>
      )}

      {/* New High Score banner */}
      {isNewHighScore && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.1, type: "spring" }}
          className="w-full rounded-2xl p-3 text-center"
          style={{
            background: "linear-gradient(135deg, hsl(42 85% 52% / 0.15), hsl(42 85% 52% / 0.05))",
            border: "1.5px solid hsl(42 85% 52% / 0.4)",
          }}
        >
          <div className="flex items-center justify-center gap-2">
            <Crown className="w-5 h-5" style={{ color: "hsl(42 85% 52%)" }} />
            <span className="text-sm font-black" style={{ color: "hsl(42 85% 52%)" }}>{t("quiz.results.newHigh")}</span>
            <Crown className="w-5 h-5" style={{ color: "hsl(42 85% 52%)" }} />
          </div>
        </motion.div>
      )}

      {/* Trophy circle with grade */}
      <motion.div
        className="relative w-28 h-28 rounded-full flex items-center justify-center"
        style={{
          background: "linear-gradient(135deg, hsl(var(--primary) / 0.15), hsl(var(--accent) / 0.1))",
          border: `3px solid ${gradeColor}50`,
          boxShadow: `0 0 40px ${gradeColor}30`,
        }}
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: [0, 1.2, 1], rotate: 0 }}
        transition={{ delay: 0.2, duration: 0.8 }}
      >
        <span className="text-5xl">{emoji}</span>
        {/* Pulsing ring */}
        {isGreat && (
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{ border: `2px solid ${gradeColor}` }}
            animate={{ scale: [1, 1.5, 2], opacity: [0.6, 0.2, 0] }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
          />
        )}
      </motion.div>

      {/* Grade badge */}
      <motion.div
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.5, type: "spring" }}
        className="flex items-center gap-2"
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black"
          style={{ background: `${gradeColor}20`, color: gradeColor, border: `1.5px solid ${gradeColor}40` }}
        >
          {grade}
        </div>
        <div>
          <p className="text-3xl font-black text-primary tabular-nums">{stats.score}</p>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t("quiz.results.totalPoints")}</p>
        </div>
      </motion.div>

      <p className="text-sm font-semibold text-foreground text-center">{message}</p>

      {/* Stats grid */}
      <motion.div
        className="grid grid-cols-2 gap-2.5 w-full"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <StatCard icon={<Target className="w-4 h-4 text-primary" />} label={t("quiz.results.accuracy")} value={`${percentage}%`} />
        <StatCard icon={<Flame className="w-4 h-4 text-orange-400" />} label={t("quiz.results.bestStreak")} value={String(stats.bestStreak)} />
        <StatCard icon={<Zap className="w-4 h-4 text-yellow-400" />} label={t("quiz.results.timeBonus")} value={`+${stats.timeBonus}`} />
        <StatCard icon={<Trophy className="w-4 h-4 text-accent" />} label={t("quiz.results.allTimeBest")} value={String(bestStreakEver)} />
      </motion.div>

      {/* Correct/Wrong bar */}
      <motion.div
        className="w-full"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
      >
        <div className="flex justify-between text-[10px] font-bold text-muted-foreground mb-1.5">
          <span className="flex items-center gap-1">{t("quiz.results.correctCount", { count: stats.correct })}</span>
          <span className="flex items-center gap-1">{t("quiz.results.wrongCount", { count: stats.wrong })}</span>
        </div>
        <div className="h-3 rounded-full overflow-hidden flex" style={{ background: "hsl(var(--muted))" }}>
          <motion.div
            className="h-full rounded-l-full"
            style={{ background: "linear-gradient(90deg, hsl(142 60% 45%), hsl(142 50% 55%))" }}
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ delay: 0.8, duration: 0.8 }}
          />
          {stats.wrong > 0 && (
            <motion.div
              className="h-full rounded-r-full"
              style={{ background: "hsl(var(--destructive))" }}
              initial={{ width: 0 }}
              animate={{ width: `${100 - percentage}%` }}
              transition={{ delay: 0.8, duration: 0.8 }}
            />
          )}
        </div>
      </motion.div>

      {/* Answer breakdown: questions answered */}
      <motion.div
        className="w-full flex gap-1 flex-wrap justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9 }}
      >
        {Array.from({ length: totalQuestions }).map((_, i) => {
          const isCorrectQ = i < stats.correct;
          return (
            <motion.div
              key={i}
              className="w-5 h-5 rounded-md flex items-center justify-center text-[8px] font-black"
              style={{
                background: i >= stats.correct + stats.wrong
                  ? "hsl(var(--muted))"
                  : isCorrectQ
                  ? "hsl(142 60% 35%)"
                  : "hsl(var(--destructive) / 0.7)",
                color: "white",
              }}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.9 + i * 0.03 }}
            >
              {i + 1}
            </motion.div>
          );
        })}
      </motion.div>

      {/* Double Score */}
      {onDoubleScore && stats.score > 0 && !doubleUsed && (
        <motion.button
          onClick={handleDouble}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.0, type: "spring" }}
          whileTap={{ scale: 0.97 }}
          className="w-full rounded-2xl p-3.5 relative overflow-hidden disabled:opacity-70"
          style={{
            background:
              "linear-gradient(135deg, hsl(42 85% 52% / 0.18), hsl(var(--accent) / 0.12))",
            border: "1.5px solid hsl(42 85% 52% / 0.5)",
            boxShadow: "0 8px 24px hsl(42 85% 52% / 0.18)",
          }}
        >
          {/* Shimmer */}
          <motion.div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "linear-gradient(90deg, transparent, hsl(42 85% 52% / 0.18), transparent)",
            }}
            animate={{ x: ["-100%", "200%"] }}
            transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 1 }}
          />
          <div className="relative flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background:
                  "linear-gradient(135deg, hsl(42 85% 52%), hsl(38 90% 55%))",
                boxShadow: "0 4px 12px hsl(42 85% 52% / 0.5)",
              }}
            >
              <Star className="w-5 h-5 text-white" fill="currentColor" />
            </div>
            <div className="flex-1 text-left">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-black text-foreground">
                  {t("quiz.results.doubleTitle")}
                </span>
                <span
                  className="text-[8px] font-black px-1.5 py-0.5 rounded"
                  style={{
                    background: "hsl(42 85% 52%)",
                    color: "white",
                  }}
                >
                  2X
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground font-semibold mt-0.5">
                {doubling ? t("quiz.results.doubleLoading") : t("quiz.results.doubleWatch", { from: stats.score, to: stats.score * 2 })}
              </p>
            </div>
            <span
              className="text-[10px] font-black px-2 py-1 rounded-lg"
              style={{
                background: "hsl(42 85% 52% / 0.2)",
                color: "hsl(42 85% 52%)",
              }}
            >
              📺
            </span>
          </div>
        </motion.button>
      )}

      {doubleUsed && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="w-full rounded-2xl p-2.5 text-center"
          style={{
            background: "hsl(142 60% 35% / 0.15)",
            border: "1px solid hsl(142 60% 35% / 0.3)",
          }}
        >
          <span className="text-[11px] font-bold" style={{ color: "hsl(142 60% 55%)" }}>
            {t("quiz.results.doubleDone", { score: stats.score })}
          </span>
        </motion.div>
      )}

      {/* Actions */}
      <motion.div
        className="flex gap-3 w-full mt-2"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.1 }}
      >
        <Button
          onClick={onPlayAgain}
          className="flex-1 h-12 rounded-xl font-bold text-sm gap-2 text-white"
          style={{
            background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))",
          }}
        >
          <RotateCcw className="w-4 h-4" /> {t("quiz.results.playAgain")}
        </Button>
        <Button
          onClick={onHome}
          variant="outline"
          className="h-12 w-12 rounded-xl p-0"
          style={{
            borderColor: "hsl(var(--glass-border))",
            background: "hsl(var(--card))",
          }}
        >
          <Home className="w-4 h-4" />
        </Button>
      </motion.div>
    </motion.div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div
      className="rounded-xl p-3 text-center"
      style={{
        background: "hsl(var(--card))",
        border: "1px solid hsl(var(--glass-border))",
      }}
    >
      <div className="flex items-center justify-center gap-1.5 mb-1">{icon}</div>
      <p className="text-lg font-black text-foreground tabular-nums">{value}</p>
      <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">{label}</p>
    </div>
  );
}
