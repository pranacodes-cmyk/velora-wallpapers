import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/services/ads_service.dart';
import '../../core/services/analytics.dart';
import '../../core/services/haptics.dart';
import '../../core/services/rating_service.dart';
import '../../core/theme/app_colors.dart';
import '../../widgets/lucide.dart';
import '../../state/app_providers.dart';
import '../../widgets/premium_sheet.dart';
import 'pro_quiz_picker.dart';
import 'quiz_controller.dart';
import 'quiz_data.dart';
import 'quiz_question_card.dart';
import 'quiz_results.dart';
import 'quiz_revive.dart';

/// 1:1 port of `src/pages/Quiz.tsx` + `src/components/quiz/*`.
class QuizScreen extends ConsumerStatefulWidget {
  const QuizScreen({super.key, this.autoDaily = false});

  /// Route-local intent; never broadcasts navigation to the retained Today tab.
  final bool autoDaily;

  @override
  ConsumerState<QuizScreen> createState() => _QuizScreenState();
}

class _QuizScreenState extends ConsumerState<QuizScreen> {
  late final QuizController _quiz;
  bool _endlessPaywallOpen = false;
  int _prevScore = 0;
  int _prevStreak = 0;
  _Hype? _hype;
  Timer? _hypeTimer;

  late final StateController<bool> _navHidden;
  late final StateController<bool Function()?> _backHandler;

  @override
  void initState() {
    super.initState();
    _quiz = QuizController();
    // Cache notifiers now: `ref` is unusable once this widget is disposed,
    // and the reset below runs after disposal.
    _navHidden = ref.read(quizNavHiddenProvider.notifier);
    _backHandler = ref.read(quizBackHandlerProvider.notifier);
    _quiz.addListener(_onQuizChanged);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      ref.read(quizBackHandlerProvider.notifier).state = _handleHardwareBack;
      if (widget.autoDaily) _startDailyQuiz();
    });
  }

  /// Android hardware back, routed here by the shell. Returns true when it
  /// consumed the press (same steps as the header's arrow), false when the
  /// quiz is idle and the shell should do its tab-level thing.
  bool _handleHardwareBack() {
    switch (_quiz.state) {
      case QuizState.playing:
      case QuizState.answered:
      case QuizState.revive:
        haptic(HapticStyle.soft);
        _quiz.finishQuiz();
        return true;
      case QuizState.results:
        haptic(HapticStyle.soft);
        _quiz.reset();
        return true;
      case QuizState.idle:
        return false;
    }
  }

  /// Auto-start from the prayer/Today handoff (web: `?auto=daily`) — drops
  /// the user straight into the running daily quiz.
  void _startDailyQuiz() {
    if (_quiz.state != QuizState.idle) return;
    if (_quiz.dailyCompleted) return;
    Analytics.capture('quiz_started', {'mode': quizModeKey(QuizMode.daily)});
    _quiz.startQuiz(QuizMode.daily);
  }

  @override
  void dispose() {
    _quiz.removeListener(_onQuizChanged);
    _quiz.dispose();
    _hypeTimer?.cancel();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      try { _navHidden.state = false; } catch (_) {}
      try {
        if (_backHandler.state == _handleHardwareBack) _backHandler.state = null;
      } catch (_) {}
    });
    // Fire the armed rating prompt when the user LEAVES the Quiz screen, not
    // the moment a quiz ends — same 600ms settle delay as `Quiz.tsx`.
    RatingService.fireArmedQuizRatingIfNeeded();
    super.dispose();
  }

  void _onQuizChanged() {
    final inProgress =
        _quiz.state == QuizState.playing ||
        _quiz.state == QuizState.answered ||
        _quiz.state == QuizState.revive;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      ref.read(quizNavHiddenProvider.notifier).state = inProgress;
    });

    if (_quiz.state == QuizState.answered) {
      final score = _quiz.stats.score;
      final streak = _quiz.stats.streak;
      if (streak > _prevStreak && streak >= 3) {
        final _HypeTier tier = streak >= 15
            ? _HypeTier(
                t('quiz.hype.unstoppable'),
                t('quiz.hype.streakInfo', {'count': streak}),
              )
            : streak >= 10
            ? _HypeTier(
                t('quiz.hype.onFire'),
                t('quiz.hype.streakKeep', {'count': streak}),
              )
            : streak >= 7
            ? _HypeTier(
                t('quiz.hype.heavenly'),
                t('quiz.hype.straight', {'count': streak}),
              )
            : streak >= 5
            ? _HypeTier(
                t('quiz.hype.blessed'),
                t('quiz.hype.streakInfo', {'count': streak}),
              )
            : _HypeTier(
                t('quiz.hype.combo'),
                t('quiz.hype.streakInfo', {'count': streak}),
              );
        setState(
          () => _hype = _Hype(
            DateTime.now().millisecondsSinceEpoch,
            tier.text,
            tier.sub,
          ),
        );
        _hypeTimer?.cancel();
        _hypeTimer = Timer(const Duration(milliseconds: 1300), () {
          if (mounted) setState(() => _hype = null);
        });
      }
      _prevScore = score;
      _prevStreak = streak;
    }
    setState(() {});
  }

  static const _proModes = {
    QuizMode.book,
    QuizMode.pack,
    QuizMode.boss,
    QuizMode.speedrun,
  };

  Future<void> _handleStartQuiz(
    QuizMode mode, {
    String? book,
    String? packId,
  }) async {
    final isPremium = ref.read(premiumProvider);
    if (_proModes.contains(mode) && !isPremium) {
      haptic(HapticStyle.medium);
      setState(() => _endlessPaywallOpen = true);
      final trigger = switch (mode) {
        QuizMode.streak => 'endless_quiz',
        QuizMode.book => 'book_mastery',
        QuizMode.pack => 'themed_pack',
        QuizMode.boss => 'boss_round',
        QuizMode.speedrun => 'speed_run',
        _ => 'endless_quiz',
      };
      Analytics.capture('paywall_shown', {'trigger': trigger});
      return;
    }
    haptic(HapticStyle.medium);
    Analytics.capture('quiz_started', {
      'mode': quizModeKey(mode),
      if (book != null) 'book': book,
      if (packId != null) 'packId': packId,
    });
    await _quiz.startQuiz(mode, book: book, packId: packId);
  }

  Future<void> _handleRevive() async {
    final isPremium = ref.read(premiumProvider);
    if (isPremium) {
      _quiz.revive();
      return;
    }
    final earned = await AdsService.showRewarded();
    if (earned) {
      Analytics.capture('quiz_revived', {'mode': quizModeKey(_quiz.mode)});
      _quiz.revive();
    }
  }

  void _openProPicker(String kind) {
    haptic(HapticStyle.soft);
    showProQuizPicker(
      context,
      kind: kind,
      onPickBook: (book) => _handleStartQuiz(QuizMode.book, book: book),
      onPickPack: (packId) => _handleStartQuiz(QuizMode.pack, packId: packId),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isPremium = ref.watch(premiumProvider);
    final navHidden =
        _quiz.state == QuizState.playing ||
        _quiz.state == QuizState.answered ||
        _quiz.state == QuizState.revive;

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        bottom: false,
        child: Stack(
          children: [
            Column(
              children: [
                _header(context),
                Expanded(
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      Padding(
                        padding: EdgeInsets.fromLTRB(
                          16,
                          16,
                          16,
                          navHidden ? 32 : 140,
                        ),
                        child: SingleChildScrollView(
                          child: _body(context, isPremium),
                        ),
                      ),
                      if (_quiz.state == QuizState.revive)
                        Positioned.fill(
                          child: QuizRevive(
                            streak: _quiz.stats.bestStreak,
                            onRevive: _handleRevive,
                            onGiveUp: _quiz.finishQuiz,
                            mode: quizModeKey(_quiz.mode),
                            reviveCount: _quiz.reviveCount,
                            maxRevives: _quiz.maxRevives,
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            ),
            if (_hype != null)
              Positioned(
                left: 0,
                right: 0,
                top: MediaQuery.sizeOf(context).height * 0.28,
                child: Center(
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 20,
                      vertical: 12,
                    ),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(16),
                      gradient: const LinearGradient(
                        colors: [Color(0xFFE8792E), Color(0xFFF2C13A)],
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFFE8792E).withValues(alpha: 0.5),
                          blurRadius: 40,
                        ),
                      ],
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          _hype!.text,
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w900,
                            color: Colors.white,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          _hype!.sub,
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                            color: Colors.white.withValues(alpha: 0.9),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            if (_endlessPaywallOpen)
              PremiumSheet(
                trigger: 'endless_quiz',
                onClose: () => setState(() => _endlessPaywallOpen = false),
                onUnlock: () {
                  ref.read(premiumProvider.notifier).setUnlocked();
                  setState(() => _endlessPaywallOpen = false);
                  Timer(
                    const Duration(milliseconds: 300),
                    () => _quiz.startQuiz(QuizMode.streak),
                  );
                },
              ),
          ],
        ),
      ),
    );
  }

  Widget _header(BuildContext context) {
    final title = _quiz.state == QuizState.idle
        ? t('quiz.header.title')
        : _quiz.mode == QuizMode.daily
        ? t('quiz.header.daily')
        : _quiz.mode == QuizMode.streak
        ? t('quiz.header.streak')
        : t('quiz.header.challenge');
    final showStats =
        _quiz.state == QuizState.playing || _quiz.state == QuizState.answered;

    return Container(
      padding: EdgeInsets.fromLTRB(
        16,
        MediaQuery.paddingOf(context).top + 12,
        16,
        12,
      ),
      decoration: BoxDecoration(
        color: AppColors.navBlur,
        border: Border(bottom: BorderSide(color: AppColors.glassBorder)),
      ),
      child: Row(
        children: [
          Material(
            color: Colors.transparent,
            child: InkWell(
              borderRadius: BorderRadius.circular(12),
              onTap: () {
                haptic(HapticStyle.soft);
                if (_quiz.state == QuizState.playing ||
                    _quiz.state == QuizState.answered) {
                  _quiz.finishQuiz();
                  return;
                }
                if (_quiz.state == QuizState.idle) {
                  Navigator.of(context).maybePop();
                } else {
                  _quiz.reset();
                }
              },
              child: Container(
                width: 36,
                height: 36,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: AppColors.card,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.glassBorder),
                ),
                child: LucideIcon(
                  'arrow-left',
                  size: 16,
                  color: AppColors.foreground,
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              title,
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w900,
                color: AppColors.foreground,
              ),
            ),
          ),
          if (showStats) ...[
            if (_quiz.stats.streak >= 3)
              Container(
                margin: const EdgeInsets.only(right: 8),
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFFE8792E).withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    LucideIcon('flame', size: 14, color: Color(0xFFE8792E)),
                    const SizedBox(width: 4),
                    Text(
                      '${_quiz.stats.streak}',
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w900,
                        color: Color(0xFFE8792E),
                      ),
                    ),
                  ],
                ),
              ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  LucideIcon('zap', size: 14, color: AppColors.primary),
                  const SizedBox(width: 6),
                  Text(
                    '${_quiz.stats.score}',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w900,
                      color: AppColors.primary,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _body(BuildContext context, bool isPremium) {
    switch (_quiz.state) {
      case QuizState.idle:
        return _hub(context, isPremium);
      case QuizState.playing:
      case QuizState.answered:
      case QuizState.revive:
        final q = _quiz.currentQuestion;
        if (q == null) return const SizedBox.shrink();
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            QuizQuestionCard(
              question: q,
              selectedAnswer: _quiz.selectedAnswer,
              timeLeft: _quiz.timeLeft,
              maxTime: _quiz.timePerQuestion,
              onAnswer: _quiz.answerQuestion,
              questionNumber: _quiz.currentIndex + 1,
              totalQuestions: _quiz.totalQuestions,
            ),
            if (_quiz.state == QuizState.answered)
              Padding(
                padding: const EdgeInsets.only(top: 16),
                child: SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: ElevatedButton(
                    onPressed: () {
                      haptic(HapticStyle.soft);
                      _quiz.nextQuestion();
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: Text(
                      _quiz.isLastQuestion
                          ? t('quiz.game.finish')
                          : t('quiz.game.next'),
                      style: const TextStyle(fontWeight: FontWeight.bold),
                    ),
                  ),
                ),
              ),
          ],
        );
      case QuizState.results:
        return Padding(
          padding: const EdgeInsets.only(top: 16),
          child: QuizResults(
            controller: _quiz,
            onPlayAgain: () => _handleStartQuiz(_quiz.mode),
            onHome: _quiz.reset,
          ),
        );
    }
  }

  Widget _hub(BuildContext context, bool isPremium) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                AppColors.primary.withValues(alpha: 0.12),
                AppColors.accent.withValues(alpha: 0.08),
              ],
            ),
            border: Border.all(
              color: AppColors.primary.withValues(alpha: 0.2),
            ),
          ),
          child: Column(
            children: [
              Container(
                width: 64,
                height: 64,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(16),
                  gradient: LinearGradient(
                    colors: [AppColors.primary, AppColors.accent],
                  ),
                ),
                child: const LucideIcon(
                  'book-open',
                  size: 32,
                  color: Colors.white,
                  strokeWidth: 2.2,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                t('quiz.hero.title'),
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w900,
                  color: AppColors.foreground,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                t('quiz.hero.subtitle'),
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 12,
                  color: AppColors.mutedForeground,
                ),
              ),
              if (_quiz.highScore > 0) ...[
                const SizedBox(height: 8),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    LucideIcon('crown', size: 12, color: Color(0xFFEAB93A)),
                    const SizedBox(width: 6),
                    Text(
                      t('quiz.hero.highScore', {'score': _quiz.highScore}),
                      style: const TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFFEAB93A),
                      ),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 16),
        Row(
          children: [
            Expanded(
              child: _quickStat(
                '🔥',
                t('quiz.stats.dailyStreak'),
                '${_quiz.dailyStreak.count}',
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: _quickStat(
                '🏆',
                t('quiz.stats.bestRun'),
                '${_quiz.bestStreakEver}',
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: _quickStat(
                '🎮',
                t('quiz.stats.games'),
                '${_quiz.gamesPlayed}',
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        _modeCard(
          icon: 'calendar',
          title: t('quiz.mode.daily.title'),
          description: t('quiz.mode.daily.desc'),
          tag: _quiz.dailyCompleted
              ? t('quiz.mode.daily.completed')
              : t('quiz.mode.daily.new'),
          tagColor: _quiz.dailyCompleted
              ? const Color(0xFF3FA85B)
              : AppColors.primary,
          disabled: _quiz.dailyCompleted,
          onTap: () => _handleStartQuiz(QuizMode.daily),
        ),
        const SizedBox(height: 10),
        _modeCard(
          icon: 'infinity',
          title: t('quiz.mode.streak.title'),
          description: t('quiz.mode.streak.desc'),
          tag: t('quiz.mode.streak.tag'),
          tagColor: AppColors.accent,
          onTap: () => _handleStartQuiz(QuizMode.streak),
        ),
        const SizedBox(height: 10),
        _modeCard(
          icon: 'swords',
          title: t('quiz.mode.challenge.title'),
          description: t('quiz.mode.challenge.desc'),
          tag: t('quiz.mode.challenge.tag'),
          tagColor: AppColors.primary,
          onTap: () => _handleStartQuiz(QuizMode.challenge),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 12),
          child: Row(
            children: [
              LucideIcon('crown', size: 14, color: _proInk),
              const SizedBox(width: 6),
              Text(
                t('quiz.pro.header'),
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 1.2,
                  color: _proInk,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Container(
                  height: 1,
                  color: _proInk.withValues(alpha: 0.4),
                ),
              ),
            ],
          ),
        ),
        _proModeCard(
          icon: 'book-open',
          title: t('quiz.mode.book.title'),
          description: t('quiz.mode.book.desc'),
          tag: t('quiz.mode.book.tag'),
          locked: !isPremium,
          onTap: () {
            if (!isPremium) {
              _handleStartQuiz(QuizMode.book);
              return;
            }
            _openProPicker('book');
          },
        ),
        const SizedBox(height: 10),
        _proModeCard(
          icon: 'sparkles',
          title: t('quiz.mode.pack.title'),
          description: t('quiz.mode.pack.desc'),
          tag: t('quiz.mode.pack.tag'),
          locked: !isPremium,
          onTap: () {
            if (!isPremium) {
              _handleStartQuiz(QuizMode.pack);
              return;
            }
            _openProPicker('pack');
          },
        ),
        const SizedBox(height: 10),
        _proModeCard(
          icon: 'skull',
          title: t('quiz.mode.boss.title'),
          description: t('quiz.mode.boss.desc'),
          tag: t('quiz.mode.boss.tag'),
          locked: !isPremium,
          onTap: () => _handleStartQuiz(QuizMode.boss),
        ),
        const SizedBox(height: 10),
        _proModeCard(
          icon: 'rocket',
          title: t('quiz.mode.speedrun.title'),
          description: t('quiz.mode.speedrun.desc'),
          tag: t('quiz.mode.speedrun.tag'),
          locked: !isPremium,
          onTap: () => _handleStartQuiz(QuizMode.speedrun),
        ),
      ],
    );
  }

  Widget _quickStat(String icon, String label, String value) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        color: AppColors.card,
        border: Border.all(color: AppColors.glassBorder),
      ),
      child: Column(
        children: [
          Text(icon, style: const TextStyle(fontSize: 16)),
          Text(
            value,
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w900,
              color: AppColors.foreground,
            ),
          ),
          Text(
            label,
            style: TextStyle(
              fontSize: 9,
              fontWeight: FontWeight.bold,
              letterSpacing: 0.6,
              color: AppColors.mutedForeground,
            ),
          ),
        ],
      ),
    );
  }

  Widget _modeCard({
    required String icon,
    required String title,
    required String description,
    required String tag,
    required Color tagColor,
    bool disabled = false,
    required VoidCallback onTap,
  }) {
    return Opacity(
      opacity: disabled ? 0.5 : 1,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: disabled ? null : onTap,
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.card,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.glassBorder),
              boxShadow: [
                BoxShadow(
                  color: AppColors.isLight
                      ? AppColors.foreground.withValues(alpha: 0.08)
                      : Colors.black.withValues(alpha: 0.2),
                  blurRadius: 20,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 40,
                  height: 40,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: LucideIcon(icon, size: 20, color: AppColors.primary),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              title,
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.bold,
                                color: AppColors.foreground,
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 2,
                            ),
                            decoration: BoxDecoration(
                              color: tagColor.withValues(alpha: 0.13),
                              borderRadius: BorderRadius.circular(999),
                            ),
                            child: Text(
                              tag,
                              style: TextStyle(
                                fontSize: 9,
                                fontWeight: FontWeight.bold,
                                color: tagColor,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        description,
                        style: TextStyle(
                          fontSize: 11,
                          height: 1.4,
                          color: AppColors.mutedForeground,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  /// Pro-mode ink: gold reads cheap on the cream light theme, so light mode
  /// uses the deep royal-blue ink (`hsl(222 60% 24%)`) and keeps gold only for
  /// the small PRO badge. Dark mode stays gold, exactly like web.
  Color get _proInk =>
      AppColors.isLight ? const Color(0xFF182F62) : const Color(0xFFEAB93A);

  Widget _proModeCard({
    required String icon,
    required String title,
    required String description,
    required String tag,
    required bool locked,
    required VoidCallback onTap,
  }) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                _proInk.withValues(alpha: AppColors.isLight ? 0.07 : 0.10),
                AppColors.card,
              ],
              stops: const [0, 0.6],
            ),
            border: Border.all(
              color: _proInk.withValues(alpha: AppColors.isLight ? 0.28 : 0.35),
            ),
            boxShadow: [
              BoxShadow(
                color: AppColors.isLight
                    ? _proInk.withValues(alpha: 0.14)
                    : Colors.black.withValues(alpha: 0.34),
                blurRadius: 20,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 40,
                height: 40,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: AppColors.isLight
                        ? const [Color(0xFF182F62), Color(0xFF2C4C96)]
                        : const [Color(0xFFEAB93A), Color(0xFFF0A93A)],
                  ),
                ),
                child: LucideIcon(icon, size: 20, color: Colors.white),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Wrap(
                      crossAxisAlignment: WrapCrossAlignment.center,
                      spacing: 8,
                      runSpacing: 4,
                      children: [
                        Text(
                          title,
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.bold,
                            color: AppColors.foreground,
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: _proInk.withValues(alpha: 0.14),
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            tag,
                            style: TextStyle(
                              fontSize: 9,
                              fontWeight: FontWeight.w900,
                              color: _proInk,
                            ),
                          ),
                        ),
                        if (locked)
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 2,
                            ),
                            decoration: BoxDecoration(
                              color: const Color(0xFFEAB93A),
                              borderRadius: BorderRadius.circular(999),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: const [
                                LucideIcon(
                                  'crown',
                                  size: 10,
                                  color: Color(0xFF16213B),
                                ),
                                SizedBox(width: 3),
                                Text(
                                  'PRO',
                                  style: TextStyle(
                                    fontSize: 9,
                                    fontWeight: FontWeight.w900,
                                    color: Color(0xFF16213B),
                                  ),
                                ),
                              ],
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      description,
                      style: TextStyle(
                        fontSize: 11,
                        height: 1.4,
                        color: AppColors.mutedForeground,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Hype {
  _Hype(this.id, this.text, this.sub);
  final int id;
  final String text;
  final String sub;
}

class _HypeTier {
  _HypeTier(this.text, this.sub);
  final String text;
  final String sub;
}
