import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';

import '../../core/services/analytics.dart';
import '../../core/services/prefs.dart';
import '../../core/services/rating_service.dart';
import '../../core/services/streak_store.dart';
import '../../core/services/today_tasks_store.dart';
import 'quiz_data.dart';

/// 1:1 port of `src/hooks/useQuiz.ts`.
enum QuizMode { daily, streak, challenge, book, pack, boss, speedrun }

enum QuizState { idle, playing, answered, revive, results }

String quizModeKey(QuizMode m) => m.name;

QuizMode quizModeFromKey(String k) => QuizMode.values.firstWhere(
  (m) => m.name == k,
  orElse: () => QuizMode.daily,
);

class QuizStats {
  const QuizStats({
    this.correct = 0,
    this.wrong = 0,
    this.streak = 0,
    this.bestStreak = 0,
    this.score = 0,
    this.timeBonus = 0,
  });
  final int correct;
  final int wrong;
  final int streak;
  final int bestStreak;
  final int score;
  final int timeBonus;

  QuizStats copyWith({
    int? correct,
    int? wrong,
    int? streak,
    int? bestStreak,
    int? score,
    int? timeBonus,
  }) => QuizStats(
    correct: correct ?? this.correct,
    wrong: wrong ?? this.wrong,
    streak: streak ?? this.streak,
    bestStreak: bestStreak ?? this.bestStreak,
    score: score ?? this.score,
    timeBonus: timeBonus ?? this.timeBonus,
  );
}

class DailyStreak {
  const DailyStreak({this.count = 0, this.lastDate = ''});
  final int count;
  final String lastDate;
}

const _dailyKey = 'cw_quiz_daily';
const _bestStreakKey = 'cw_quiz_best_streak';
const _quizStreakKey = 'cw_quiz_daily_streak';
const _highScoreKey = 'cw_quiz_high_score';
const _totalCorrectKey = 'cw_quiz_total_correct';
const _gamesPlayedKey = 'cw_quiz_games_played';
const _bookMasteryKey = 'cw_quiz_book_mastery';
const _defaultTimePerQuestion = 15;

int _timeForMode(QuizMode m) {
  if (m == QuizMode.boss) return 10;
  if (m == QuizMode.speedrun) return 5;
  return _defaultTimePerQuestion;
}

int _maxRevivesForMode(QuizMode m) {
  if (m == QuizMode.boss || m == QuizMode.speedrun) return 0;
  return 3;
}

double _scoreMultiplierForMode(QuizMode m) {
  if (m == QuizMode.speedrun) return 2;
  if (m == QuizMode.boss) return 1.5;
  return 1;
}

String _todayKey() {
  // UTC to match web `useQuiz.ts` (`new Date().toISOString().split("T")[0]`),
  // so "daily quiz completed" resets on the same boundary as the web build.
  final d = DateTime.now().toUtc();
  return '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
}

int _loadNum(String key) => Prefs.getInt(key);
Future<void> _saveNum(String key, int v) => Prefs.setInt(key, v);

Map<String, int> getBookMastery() {
  try {
    final raw = Prefs.getString(_bookMasteryKey);
    if (raw == null) return {};
    return (jsonDecode(raw) as Map<String, dynamic>).map(
      (k, v) => MapEntry(k, (v as num).toInt()),
    );
  } catch (_) {
    return {};
  }
}

/// Port of the `useQuiz()` hook as a `ChangeNotifier`.
class QuizController extends ChangeNotifier {
  QuizMode mode = QuizMode.daily;
  QuizState state = QuizState.idle;
  List<QuizQuestion> questions = [];
  int currentIndex = 0;
  int? selectedAnswer;
  int timePerQuestion = _defaultTimePerQuestion;
  int timeLeft = _defaultTimePerQuestion;
  QuizStats stats = const QuizStats();
  bool hasRevived = false;
  int reviveCount = 0;
  int maxRevives = 3;
  String? activeBook;
  String? activePackId;
  bool dailyCompleted = false;
  DailyStreak dailyStreak = const DailyStreak();
  int bestStreakEver = 0;
  int highScore = 0;
  int totalCorrect = 0;
  int gamesPlayed = 0;
  bool isNewHighScore = false;

  Timer? _timer;
  DateTime _questionStartTime = DateTime.now();

  QuizQuestion? get currentQuestion =>
      currentIndex < questions.length ? questions[currentIndex] : null;
  bool get isLastQuestion => currentIndex >= questions.length - 1;
  int get totalQuestions => questions.length;
  bool get canRevive => reviveCount < maxRevives;

  QuizController() {
    dailyCompleted = Prefs.getString(_dailyKey) == _todayKey();
    try {
      final raw = Prefs.getString(_quizStreakKey);
      if (raw != null) {
        final m = jsonDecode(raw) as Map<String, dynamic>;
        dailyStreak = DailyStreak(
          count: (m['count'] as num?)?.toInt() ?? 0,
          lastDate: m['lastDate'] as String? ?? '',
        );
      }
    } catch (_) {}
    bestStreakEver = _loadNum(_bestStreakKey);
    highScore = _loadNum(_highScoreKey);
    totalCorrect = _loadNum(_totalCorrectKey);
    gamesPlayed = _loadNum(_gamesPlayedKey);
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _startTimer() {
    _timer?.cancel();
    timeLeft = timePerQuestion;
    _questionStartTime = DateTime.now();
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      timeLeft -= 1;
      if (timeLeft <= 0) {
        t.cancel();
        timeLeft = 0;
        notifyListeners();
        _handleTimeout();
        return;
      }
      notifyListeners();
    });
  }

  void _handleTimeout() {
    selectedAnswer = -1;
    stats = stats.copyWith(wrong: stats.wrong + 1, streak: 0);
    if (canRevive) {
      state = QuizState.revive;
      notifyListeners();
    } else if (mode == QuizMode.streak ||
        mode == QuizMode.boss ||
        mode == QuizMode.speedrun) {
      notifyListeners();
      Timer(const Duration(milliseconds: 300), finishQuiz);
    } else {
      state = QuizState.answered;
      notifyListeners();
    }
  }

  Future<void> startQuiz(
    QuizMode quizMode, {
    String? book,
    String? packId,
  }) async {
    mode = quizMode;
    currentIndex = 0;
    selectedAnswer = null;
    hasRevived = false;
    reviveCount = 0;
    maxRevives = _maxRevivesForMode(quizMode);
    timePerQuestion = _timeForMode(quizMode);
    activeBook = book;
    activePackId = packId;
    isNewHighScore = false;
    stats = const QuizStats();

    List<QuizQuestion> qs;
    switch (quizMode) {
      case QuizMode.daily:
        qs = QuizBank.getDailyQuestions();
      case QuizMode.streak:
        qs = QuizBank.getRandomQuestions(50);
      case QuizMode.boss:
        qs = QuizBank.getRandomQuestions(20, 3);
      case QuizMode.speedrun:
        qs = QuizBank.getRandomQuestions(25);
      case QuizMode.book:
        qs = book != null ? QuizBank.getQuestionsByBook(book, 15) : const [];
      case QuizMode.pack:
        qs = packId != null
            ? QuizBank.getQuestionsByPack(packId, 10)
            : const [];
      case QuizMode.challenge:
        qs = [
          ...QuizBank.getRandomQuestions(4, 1),
          ...QuizBank.getRandomQuestions(4, 2),
          ...QuizBank.getRandomQuestions(4, 3),
        ];
    }

    if (quizMode != QuizMode.daily) {
      await QuizBank.markSeen(qs.map((q) => q.id).toList());
    }

    questions = qs;
    state = QuizState.playing;
    _startTimer();
    notifyListeners();

    await Analytics.capture('quiz_started', {
      'mode': quizModeKey(quizMode),
      'question_count': qs.length,
      if (book != null) 'book': book,
      if (packId != null) 'pack': packId,
    });
  }

  Future<void> answerQuestion(int answerIndex) async {
    if (state != QuizState.playing || selectedAnswer != null) return;
    _timer?.cancel();

    final q = questions[currentIndex];
    final isCorrect = answerIndex == q.correctIndex;
    final elapsed =
        DateTime.now().difference(_questionStartTime).inMilliseconds / 1000;
    final bonus = isCorrect
        ? ((timePerQuestion - elapsed) * 10).round().clamp(0, 1 << 30)
        : 0;
    final basePoints = isCorrect ? (q.difficulty * 100 + bonus) : 0;
    final points = (basePoints * _scoreMultiplierForMode(mode)).round();

    selectedAnswer = answerIndex;
    final newStreak = isCorrect ? stats.streak + 1 : 0;
    stats = QuizStats(
      correct: stats.correct + (isCorrect ? 1 : 0),
      wrong: stats.wrong + (isCorrect ? 0 : 1),
      streak: newStreak,
      bestStreak: newStreak > stats.bestStreak ? newStreak : stats.bestStreak,
      score: stats.score + points,
      timeBonus: stats.timeBonus + bonus,
    );

    if (!isCorrect && canRevive) {
      notifyListeners();
      Timer(const Duration(milliseconds: 600), () {
        state = QuizState.revive;
        notifyListeners();
      });
    } else if (!isCorrect &&
        (mode == QuizMode.streak ||
            mode == QuizMode.boss ||
            mode == QuizMode.speedrun) &&
        !canRevive) {
      notifyListeners();
      Timer(const Duration(milliseconds: 600), finishQuiz);
    } else {
      state = QuizState.answered;
      notifyListeners();
    }
  }

  void nextQuestion() {
    if (isLastQuestion) {
      finishQuiz();
      return;
    }
    currentIndex += 1;
    selectedAnswer = null;
    state = QuizState.playing;
    _startTimer();
    notifyListeners();
  }

  void revive() {
    hasRevived = true;
    reviveCount += 1;
    stats = stats.copyWith(wrong: (stats.wrong - 1).clamp(0, 1 << 30));
    final q = currentIndex < questions.length ? questions[currentIndex] : null;
    if (q != null) selectedAnswer = q.correctIndex;
    state = QuizState.answered;
    notifyListeners();
  }

  Future<void> finishQuiz() async {
    state = QuizState.results;
    notifyListeners();

    // Arm the rating prompt — it fires when the user leaves the results
    // screen, so the celebration moment is never interrupted (`useQuiz.ts`).
    RatingService.armQuizRating();

    await Analytics.capture('quiz_completed', {
      'mode': quizModeKey(mode),
      'score': stats.score,
      'correct': stats.correct,
      'wrong': stats.wrong,
      'best_streak': stats.bestStreak,
    });

    final finalBest = [
      bestStreakEver,
      stats.bestStreak,
      stats.streak,
    ].reduce((a, b) => a > b ? a : b);
    if (finalBest > bestStreakEver) {
      bestStreakEver = finalBest;
      await _saveNum(_bestStreakKey, finalBest);
    }

    final finalScore = stats.score;
    if (finalScore > highScore) {
      highScore = finalScore;
      isNewHighScore = true;
      await _saveNum(_highScoreKey, finalScore);
    }

    totalCorrect += stats.correct;
    await _saveNum(_totalCorrectKey, totalCorrect);

    gamesPlayed += 1;
    await _saveNum(_gamesPlayedKey, gamesPlayed);

    if (mode == QuizMode.daily) {
      final today = _todayKey();
      await Prefs.setString(_dailyKey, today);
      dailyCompleted = true;
      await TodayTasksStore.markQuizDone();

      final yesterday = _dayKey(
        DateTime.now().subtract(const Duration(days: 1)),
      );
      final newStreak = dailyStreak.lastDate == yesterday
          ? DailyStreak(count: dailyStreak.count + 1, lastDate: today)
          : dailyStreak.lastDate == today
          ? dailyStreak
          : DailyStreak(count: 1, lastDate: today);
      dailyStreak = newStreak;
      await Prefs.setString(
        _quizStreakKey,
        jsonEncode({'count': newStreak.count, 'lastDate': newStreak.lastDate}),
      );
    }

    if (mode == QuizMode.book && activeBook != null) {
      try {
        final map = getBookMastery();
        final prev = map[activeBook] ?? 0;
        if (stats.score > prev) {
          map[activeBook!] = stats.score;
          await Prefs.setString(_bookMasteryKey, jsonEncode(map));
        }
      } catch (_) {}
    }

    try {
      await StreakStore.bumpIfNewDay();
    } catch (_) {}

    notifyListeners();
  }

  static String _dayKey(DateTime d) =>
      '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  void reset() {
    state = QuizState.idle;
    questions = [];
    currentIndex = 0;
    selectedAnswer = null;
    hasRevived = false;
    reviveCount = 0;
    isNewHighScore = false;
    _timer?.cancel();
    notifyListeners();
  }

  int doubleScore() {
    final newScore = stats.score * 2;
    stats = stats.copyWith(score: newScore);
    if (newScore > highScore) {
      highScore = newScore;
      isNewHighScore = true;
      _saveNum(_highScoreKey, newScore);
    }
    notifyListeners();
    return newScore;
  }
}
