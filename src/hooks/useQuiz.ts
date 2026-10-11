import { useState, useCallback, useRef, useEffect } from "react";
import { QuizQuestion, getRandomQuestions, getDailyQuestions, markQuestionsSeen } from "@/data/quizQuestions";
import { getQuestionsByBook, getQuestionsByPack } from "@/data/quizPacks";
import { bumpStreakIfNewDay } from "@/hooks/useStreak";
import { localizeQuizQuestion } from "@/i18n/content";

export type QuizMode = "daily" | "streak" | "challenge" | "book" | "pack" | "boss" | "speedrun";
export type QuizState = "idle" | "pre_ad" | "playing" | "answered" | "revive" | "results";

export interface StartQuizOptions {
  book?: string;
  packId?: string;
}

interface QuizStats {
  correct: number;
  wrong: number;
  streak: number;
  bestStreak: number;
  score: number;
  timeBonus: number;
}

const DAILY_KEY = "cw_quiz_daily";
const BEST_STREAK_KEY = "cw_quiz_best_streak";
const QUIZ_STREAK_KEY = "cw_quiz_daily_streak";
const HIGH_SCORE_KEY = "cw_quiz_high_score";
const TOTAL_CORRECT_KEY = "cw_quiz_total_correct";
const GAMES_PLAYED_KEY = "cw_quiz_games_played";
const BOOK_MASTERY_KEY = "cw_quiz_book_mastery"; // JSON: { [book]: bestScore }
const DEFAULT_TIME_PER_QUESTION = 15;
// Legacy export kept for any external imports
const TIME_PER_QUESTION = DEFAULT_TIME_PER_QUESTION;

function timeForMode(mode: QuizMode): number {
  if (mode === "boss") return 10;
  if (mode === "speedrun") return 5;
  return DEFAULT_TIME_PER_QUESTION;
}

function maxRevivesForMode(mode: QuizMode): number {
  if (mode === "boss" || mode === "speedrun") return 0; // brutal Pro modes
  return 3;
}

function scoreMultiplierForMode(mode: QuizMode): number {
  if (mode === "speedrun") return 2; // adrenaline bonus
  if (mode === "boss") return 1.5;
  return 1;
}

function getTodayKey() {
  return new Date().toISOString().split("T")[0];
}

function loadNum(key: string): number {
  try { return parseInt(localStorage.getItem(key) || "0", 10) || 0; } catch { return 0; }
}

function saveNum(key: string, val: number) {
  try { localStorage.setItem(key, String(val)); } catch {}
}

export function getBookMastery(): Record<string, number> {
  try {
    const raw = localStorage.getItem(BOOK_MASTERY_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

export function useQuiz() {
  const [mode, setMode] = useState<QuizMode>("daily");
  const [state, setState] = useState<QuizState>("idle");
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [timePerQuestion, setTimePerQuestion] = useState(DEFAULT_TIME_PER_QUESTION);
  const [timeLeft, setTimeLeft] = useState(DEFAULT_TIME_PER_QUESTION);
  const [stats, setStats] = useState<QuizStats>({
    correct: 0, wrong: 0, streak: 0, bestStreak: 0, score: 0, timeBonus: 0,
  });
  const [hasRevived, setHasRevived] = useState(false);
  const [reviveCount, setReviveCount] = useState(0);
  const [maxRevives, setMaxRevives] = useState(3);
  const canRevive = reviveCount < maxRevives;
  // Context for book mastery + pack tracking — saved on finish
  const [activeBook, setActiveBook] = useState<string | null>(null);
  const [activePackId, setActivePackId] = useState<string | null>(null);
  const [dailyCompleted, setDailyCompleted] = useState(() => {
    try { return localStorage.getItem(DAILY_KEY) === getTodayKey(); } catch { return false; }
  });
  const [dailyStreak, setDailyStreak] = useState(() => {
    try {
      const raw = localStorage.getItem(QUIZ_STREAK_KEY);
      return raw ? JSON.parse(raw) : { count: 0, lastDate: "" };
    } catch { return { count: 0, lastDate: "" }; }
  });
  const [bestStreakEver, setBestStreakEver] = useState(() => loadNum(BEST_STREAK_KEY));
  const [highScore, setHighScore] = useState(() => loadNum(HIGH_SCORE_KEY));
  const [totalCorrect, setTotalCorrect] = useState(() => loadNum(TOTAL_CORRECT_KEY));
  const [gamesPlayed, setGamesPlayed] = useState(() => loadNum(GAMES_PLAYED_KEY));
  const [isNewHighScore, setIsNewHighScore] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const questionStartTime = useRef(Date.now());

  const currentQuestion = questions[currentIndex] ?? null;
  const isLastQuestion = currentIndex >= questions.length - 1;
  const totalQuestions = questions.length;

  // Timer
  useEffect(() => {
    if (state !== "playing") return;
    setTimeLeft(timePerQuestion);
    questionStartTime.current = Date.now();

    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          handleTimeout();
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [state, currentIndex, timePerQuestion]);

  const handleTimeout = useCallback(() => {
    setSelectedAnswer(-1);
    setStats((s) => ({ ...s, wrong: s.wrong + 1, streak: 0 }));

    if (canRevive) {
      setState("revive");
    } else if (mode === "streak" || mode === "boss" || mode === "speedrun") {
      // No-revive / endless modes → instant game over on wrong
      setTimeout(() => finishQuiz(), 300);
    } else {
      setState("answered");
    }
  }, [mode, canRevive]);

  const startQuiz = useCallback((quizMode: QuizMode, opts: StartQuizOptions = {}) => {
    setMode(quizMode);
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setHasRevived(false);
    setReviveCount(0);
    setMaxRevives(maxRevivesForMode(quizMode));
    setTimePerQuestion(timeForMode(quizMode));
    setActiveBook(opts.book ?? null);
    setActivePackId(opts.packId ?? null);
    setIsNewHighScore(false);
    setStats({ correct: 0, wrong: 0, streak: 0, bestStreak: 0, score: 0, timeBonus: 0 });

    let qs: QuizQuestion[];
    if (quizMode === "daily") {
      qs = getDailyQuestions();
    } else if (quizMode === "streak") {
      qs = getRandomQuestions(50);
    } else if (quizMode === "boss") {
      // 20 hard-only questions, no revives, 10s timer
      qs = getRandomQuestions(20, 3);
    } else if (quizMode === "speedrun") {
      // 25 random questions, 5s timer, score x2
      qs = getRandomQuestions(25);
    } else if (quizMode === "book" && opts.book) {
      qs = getQuestionsByBook(opts.book, 15);
    } else if (quizMode === "pack" && opts.packId) {
      qs = getQuestionsByPack(opts.packId, 10);
    } else {
      // Challenge - progressive: 4 easy, 4 medium, 4 hard
      qs = [
        ...getRandomQuestions(4, 1),
        ...getRandomQuestions(4, 2),
        ...getRandomQuestions(4, 3),
      ];
    }

    if (quizMode !== "daily") markQuestionsSeen(qs.map((q) => q.id));
    // ↑ book/pack/boss/speedrun all flow through here, so fresh-rotation is honored on every replay.


    setQuestions(qs.map(localizeQuizQuestion));
    setState("playing");
    import("@/services/analytics").then((a) => a.track("quiz_started", {
      mode: quizMode,
      question_count: qs.length,
      book: opts.book,
      pack: opts.packId,
    })).catch(() => {});
  }, []);


  const beginPlaying = useCallback(() => {
    setState("playing");
  }, []);

  const answerQuestion = useCallback((answerIndex: number) => {
    if (state !== "playing" || selectedAnswer !== null) return;
    clearInterval(timerRef.current);

    const q = questions[currentIndex];
    const isCorrect = answerIndex === q.correctIndex;
    const elapsed = (Date.now() - questionStartTime.current) / 1000;
    const bonus = isCorrect ? Math.max(0, Math.round((timePerQuestion - elapsed) * 10)) : 0;
    const basePoints = isCorrect ? (q.difficulty * 100 + bonus) : 0;
    const points = Math.round(basePoints * scoreMultiplierForMode(mode));

    setSelectedAnswer(answerIndex);
    setStats((s) => {
      const newStreak = isCorrect ? s.streak + 1 : 0;
      return {
        correct: s.correct + (isCorrect ? 1 : 0),
        wrong: s.wrong + (isCorrect ? 0 : 1),
        streak: newStreak,
        bestStreak: Math.max(s.bestStreak, newStreak),
        score: s.score + points,
        timeBonus: s.timeBonus + bonus,
      };
    });

    if (!isCorrect && canRevive) {
      // Wrong answer → offer revive (rewarded video) in every mode while
      // revives remain. Daily quiz is no longer one-shot punishing.
      setTimeout(() => setState("revive"), 600);
    } else if (!isCorrect && (mode === "streak" || mode === "boss" || mode === "speedrun") && !canRevive) {
      // Out of revives in run-ending modes → game over
      setTimeout(() => finishQuiz(), 600);
    } else {
      setState("answered");
    }
  }, [state, selectedAnswer, questions, currentIndex, mode, canRevive]);

  const nextQuestion = useCallback(() => {
    if (isLastQuestion) {
      finishQuiz();
      return;
    }
    setCurrentIndex((i) => i + 1);
    setSelectedAnswer(null);
    setState("playing");
  }, [isLastQuestion]);

  const revive = useCallback(() => {
    setHasRevived(true);
    setReviveCount((c) => c + 1);
    // Undo the wrong answer (don't restore streak — they still got it wrong,
    // but we forgive the run-ending miss). Reveal the correct answer so the
    // user learns, then they tap Next to continue from where they left off.
    setStats((s) => ({
      ...s,
      wrong: Math.max(0, s.wrong - 1),
    }));
    // Reveal the correct answer on the question card
    const q = questions[currentIndex];
    if (q) setSelectedAnswer(q.correctIndex);
    setState("answered");
  }, [questions, currentIndex]);

  const finishQuiz = useCallback(() => {
    setState("results");
    import("@/services/analytics").then((a) => a.track("quiz_completed", {
      mode,
      score: stats.score,
      correct: stats.correct,
      wrong: stats.wrong,
      best_streak: stats.bestStreak,
    })).catch(() => {});
    // Delay paywall ~2.5s so user reads their results first, then we pitch Pro.
    setTimeout(() => {
      import("@/lib/paywallScheduler").then((m) => m.firePaywallTrigger("quiz_finished")).catch(() => {});
    }, 2500);



    // Persist best streak
    const finalBest = Math.max(bestStreakEver, stats.bestStreak, stats.streak);
    if (finalBest > bestStreakEver) {
      setBestStreakEver(finalBest);
      saveNum(BEST_STREAK_KEY, finalBest);
    }

    // High score
    const finalScore = stats.score;
    if (finalScore > highScore) {
      setHighScore(finalScore);
      setIsNewHighScore(true);
      saveNum(HIGH_SCORE_KEY, finalScore);
    }

    // Lifetime stats
    const newTotal = totalCorrect + stats.correct;
    setTotalCorrect(newTotal);
    saveNum(TOTAL_CORRECT_KEY, newTotal);

    const newGames = gamesPlayed + 1;
    setGamesPlayed(newGames);
    saveNum(GAMES_PLAYED_KEY, newGames);

    // Daily completion
    if (mode === "daily") {
      const today = getTodayKey();
      try { localStorage.setItem(DAILY_KEY, today); } catch {}
      setDailyCompleted(true);

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];

      const newStreak = dailyStreak.lastDate === yesterdayStr
        ? { count: dailyStreak.count + 1, lastDate: today }
        : dailyStreak.lastDate === today
          ? dailyStreak
          : { count: 1, lastDate: today };

      setDailyStreak(newStreak);
      try { localStorage.setItem(QUIZ_STREAK_KEY, JSON.stringify(newStreak)); } catch {}
    }

    // Book Mastery — persist best score per book
    if (mode === "book" && activeBook) {
      try {
        const raw = localStorage.getItem(BOOK_MASTERY_KEY);
        const map = raw ? JSON.parse(raw) : {};
        const prev = map[activeBook] || 0;
        if (stats.score > prev) {
          map[activeBook] = stats.score;
          localStorage.setItem(BOOK_MASTERY_KEY, JSON.stringify(map));
        }
      } catch {}
    }

    // Bump the unified app streak — finishing any quiz counts as a daily
    // engagement (idempotent: only fires once per calendar day).
    try { bumpStreakIfNewDay(); } catch {}

    // Arm the rating prompt — actual fire happens when the user leaves the
    // results screen (navigates to a different tab/section), so we don't
    // interrupt their celebration moment.
    try { sessionStorage.setItem("jw_rating_armed", "1"); } catch {}

  }, [mode, stats, bestStreakEver, dailyStreak, highScore, totalCorrect, gamesPlayed, activeBook]);

  const reset = useCallback(() => {
    setState("idle");
    setQuestions([]);
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setHasRevived(false);
    setReviveCount(0);
    setIsNewHighScore(false);
    clearInterval(timerRef.current);
  }, []);

  /**
   * Double the player's final score.
   * Updates high score if the doubled score beats it. Returns the new score.
   */
  const doubleScore = useCallback(() => {
    let newScore = 0;
    setStats((s) => {
      newScore = s.score * 2;
      return { ...s, score: newScore };
    });
    setHighScore((prev) => {
      if (newScore > prev) {
        saveNum(HIGH_SCORE_KEY, newScore);
        setIsNewHighScore(true);
        return newScore;
      }
      return prev;
    });
    return newScore;
  }, []);

  return {
    mode, state, currentQuestion, currentIndex, totalQuestions,
    selectedAnswer, timeLeft, stats, hasRevived, reviveCount, canRevive, maxRevives,
    activeBook, activePackId,
    dailyCompleted, dailyStreak, bestStreakEver, highScore,
    isLastQuestion, isNewHighScore, totalCorrect, gamesPlayed,
    startQuiz, beginPlaying, answerQuestion, nextQuestion, revive, finishQuiz, reset,
    doubleScore,
    TIME_PER_QUESTION: timePerQuestion,
    timePerQuestion,
  };
}
