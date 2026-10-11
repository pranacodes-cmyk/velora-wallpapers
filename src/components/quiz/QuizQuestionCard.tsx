import { useT } from "@/i18n";
import { motion, AnimatePresence } from "framer-motion";
import { QuizQuestion } from "@/data/quizQuestions";
import { cn } from "@/lib/utils";
import { Check, X, BookOpen } from "lucide-react";
import { haptic } from "@/utils/haptics";

interface QuizQuestionCardProps {
  question: QuizQuestion;
  selectedAnswer: number | null;
  timeLeft: number;
  maxTime: number;
  onAnswer: (index: number) => void;
  questionNumber: number;
  totalQuestions: number;
}

export function QuizQuestionCard({
  question,
  selectedAnswer,
  timeLeft,
  maxTime,
  onAnswer,
  questionNumber,
  totalQuestions,
}: QuizQuestionCardProps) {
  const { t } = useT();
  const answered = selectedAnswer !== null;
  const timerPercent = (timeLeft / maxTime) * 100;
  const timerUrgent = timeLeft <= 5;

  const typeLabel =
    question.type === "multiple_choice"
      ? t("quiz.card.mc")
      : question.type === "true_false"
      ? t("quiz.card.tf")
      : t("quiz.card.fill");

  const typeIcon =
    question.type === "fill_verse" ? "✝️" : question.type === "true_false" ? "⚡" : "🧠";

  return (
    <motion.div
      key={question.id}
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="flex flex-col gap-4"
    >
      {/* Progress bar */}
      <div className="flex items-center gap-3 mb-1">
        <span className="text-[11px] font-bold text-muted-foreground tabular-nums">
          {questionNumber}/{totalQuestions}
        </span>
        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "hsl(var(--muted))" }}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--accent)))" }}
            initial={{ width: 0 }}
            animate={{ width: `${(questionNumber / totalQuestions) * 100}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      {/* Timer */}
      <div className="relative h-2 rounded-full overflow-hidden" style={{ background: "hsl(var(--muted))" }}>
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            background: timerUrgent
              ? "hsl(var(--destructive))"
              : "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--accent)))",
          }}
          animate={{ width: `${timerPercent}%` }}
          transition={{ duration: 0.3 }}
        />
        {timerUrgent && (
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{ background: "hsl(var(--destructive) / 0.3)" }}
            animate={{ opacity: [0.3, 0.8, 0.3] }}
            transition={{ duration: 0.5, repeat: Infinity }}
          />
        )}
      </div>
      <div className="flex justify-between items-center">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
          {typeIcon} {typeLabel}
        </span>
        <span
          className={cn(
            "text-sm font-black tabular-nums",
            timerUrgent ? "text-destructive" : "text-primary"
          )}
        >
          {timeLeft}s
        </span>
      </div>

      {/* Question */}
      <div
        className="rounded-2xl p-5"
        style={{
          background: "linear-gradient(135deg, hsl(var(--card)), hsl(var(--secondary)))",
          border: "1px solid hsl(var(--glass-border))",
          boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
        }}
      >
        <p className="text-[11px] font-bold text-primary mb-2">{question.category}</p>
        <p
          className={cn(
            "font-bold leading-relaxed text-foreground",
            question.type === "fill_verse" ? "text-base italic" : "text-lg"
          )}
        >
          {question.question}
        </p>
        {question.reference && (
          <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
            <BookOpen className="w-3 h-3" /> {question.reference}
          </p>
        )}
      </div>

      {/* Options */}
      <div className="flex flex-col gap-2.5">
        {question.options.map((option, idx) => {
          const isSelected = selectedAnswer === idx;
          const isCorrect = idx === question.correctIndex;
          const showCorrect = answered && isCorrect;
          const showWrong = answered && isSelected && !isCorrect;

          return (
            <motion.button
              key={idx}
              whileTap={!answered ? { scale: 0.97 } : undefined}
              onClick={() => {
                if (!answered) {
                  haptic("medium");
                  onAnswer(idx);
                }
              }}
              disabled={answered}
              className={cn(
                "relative w-full text-left rounded-xl px-4 py-3.5 font-semibold text-sm transition-all overflow-hidden",
                !answered && "active:scale-[0.98]"
              )}
              style={{
                background: showCorrect
                  ? "linear-gradient(135deg, hsl(142 70% 20%), hsl(142 60% 15%))"
                  : showWrong
                  ? "linear-gradient(135deg, hsl(0 70% 20%), hsl(0 60% 15%))"
                  : "hsl(var(--card))",
                border: showCorrect
                  ? "1.5px solid hsl(142 60% 40%)"
                  : showWrong
                  ? "1.5px solid hsl(0 60% 40%)"
                  : "1.5px solid hsl(var(--glass-border))",
                color: showCorrect || showWrong ? "white" : undefined,
              }}
            >
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-black shrink-0",
                    showCorrect
                      ? "bg-green-500/30 text-green-300"
                      : showWrong
                      ? "bg-red-500/30 text-red-300"
                      : "text-primary"
                  )}
                  style={
                    !showCorrect && !showWrong
                      ? { background: "hsl(var(--primary) / 0.1)" }
                      : undefined
                  }
                >
                  {showCorrect ? (
                    <Check className="w-4 h-4" />
                  ) : showWrong ? (
                    <X className="w-4 h-4" />
                  ) : (
                    String.fromCharCode(65 + idx)
                  )}
                </span>
                <span className={showCorrect || showWrong ? "text-white" : "text-foreground"}>
                  {option}
                </span>
              </div>

              {/* Shimmer on correct */}
              {showCorrect && (
                <motion.div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)",
                  }}
                  animate={{ x: ["-100%", "200%"] }}
                  transition={{ duration: 1.5, repeat: 1 }}
                />
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Explanation (after answering) */}
      <AnimatePresence>
        {answered && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-xl p-4 overflow-hidden"
            style={{
              background: "hsl(var(--primary) / 0.06)",
              border: "1px solid hsl(var(--primary) / 0.15)",
            }}
          >
            <p className="text-[11px] font-bold text-primary mb-1">{t("quiz.card.didYouKnow")}</p>
            <p className="text-[12px] text-muted-foreground leading-relaxed">
              {question.explanation}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
