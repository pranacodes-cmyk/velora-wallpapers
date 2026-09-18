import 'dart:async';
import 'dart:math';

import 'package:flutter/material.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/services/ads_service.dart';
import '../../core/services/analytics.dart';
import '../../core/services/haptics.dart';
import '../../core/theme/app_colors.dart';
import '../../widgets/app_toast.dart';
import 'quiz_controller.dart';

/// 1:1 port of `src/components/quiz/QuizResults.tsx`.
class QuizResults extends StatefulWidget {
  const QuizResults({
    super.key,
    required this.controller,
    required this.onPlayAgain,
    required this.onHome,
  });

  final QuizController controller;
  final VoidCallback onPlayAgain;
  final VoidCallback onHome;

  @override
  State<QuizResults> createState() => _QuizResultsState();
}

class _QuizResultsState extends State<QuizResults> {
  bool _doubleUsed = false;
  bool _doubling = false;
  final _rand = Random();
  late final List<_ConfettiSpec> _confetti;

  @override
  void initState() {
    super.initState();
    final c = widget.controller;
    Analytics.capture('quiz_completed', {
      'mode': quizModeKey(c.mode),
      'total_questions': c.totalQuestions,
      'correct': c.stats.correct,
      'wrong': c.stats.wrong,
      'score': c.stats.score,
      'best_streak': c.stats.bestStreak,
      'is_new_high_score': c.isNewHighScore,
    });
    _confetti = List.generate(
      20,
      (i) => _ConfettiSpec(
        color: Colors.white,
        left: _rand.nextDouble(),
        delayMs: (_rand.nextDouble() * 500).round(),
        durationMs: 2000 + (_rand.nextDouble() * 2000).round(),
        dx: (_rand.nextDouble() - 0.5) * 200,
        rotate: _rand.nextDouble() * 720,
      ),
    );
  }

  Future<void> _handleDouble() async {
    final c = widget.controller;
    if (_doubleUsed || _doubling || c.stats.score <= 0) return;
    haptic(HapticStyle.medium);
    setState(() => _doubling = true);
    final earned = await AdsService.showRewarded();
    if (!mounted) return;
    setState(() => _doubling = false);
    if (!earned) {
      AppToast.error(context, t('quiz.results.doubleToastError'));
      return;
    }
    final score = c.doubleScore();
    setState(() => _doubleUsed = true);
    haptic(HapticStyle.heavy);
    if (mounted)
      AppToast.success(context, t('quiz.results.doubleToastSuccess'));
    Analytics.capture('quiz_score_doubled', {
      'mode': quizModeKey(c.mode),
      'score': score,
    });
  }

  @override
  Widget build(BuildContext context) {
    final c = widget.controller;
    final stats = c.stats;
    final totalQuestions = c.totalQuestions;
    final percentage = totalQuestions > 0
        ? ((stats.correct / totalQuestions) * 100).round()
        : 0;
    final isPerfect = percentage == 100;
    final isGreat = percentage >= 80;
    final isGood = percentage >= 50;

    final emoji = isPerfect
        ? '👑'
        : isGreat
        ? '🏆'
        : isGood
        ? '👏'
        : '📖';
    final message = isPerfect
        ? t('quiz.results.perfect')
        : isGreat
        ? t('quiz.results.great')
        : isGood
        ? t('quiz.results.good')
        : t('quiz.results.keepLearning');

    final grade = isPerfect
        ? 'S'
        : isGreat
        ? 'A'
        : isGood
        ? 'B'
        : percentage >= 30
        ? 'C'
        : 'D';
    final gradeColor = isPerfect
        ? const Color(0xFFEAB93A) // hsl(42 85% 52%)
        : isGreat
        ? const Color(0xFF3FA85B) // hsl(142 60% 45%)
        : isGood
        ? AppColors.primary
        : AppColors.mutedForeground;

    return Stack(
      clipBehavior: Clip.none,
      children: [
        if (isGreat)
          Positioned.fill(
            child: IgnorePointer(child: _ConfettiLayer(specs: _confetti)),
          ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (c.isNewHighScore) ...[
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(16),
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [
                        const Color(0xFFEAB93A).withValues(alpha: 0.15),
                        const Color(0xFFEAB93A).withValues(alpha: 0.05),
                      ],
                    ),
                    border: Border.all(
                      color: const Color(0xFFEAB93A).withValues(alpha: 0.4),
                      width: 1.5,
                    ),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(
                        Icons.emoji_events,
                        size: 20,
                        color: Color(0xFFEAB93A),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        t('quiz.results.newHigh'),
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w900,
                          color: Color(0xFFEAB93A),
                        ),
                      ),
                      const SizedBox(width: 8),
                      const Icon(
                        Icons.emoji_events,
                        size: 20,
                        color: Color(0xFFEAB93A),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),
              ],
              Center(
                child: Container(
                  width: 112,
                  height: 112,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [
                        AppColors.primary.withValues(alpha: 0.15),
                        AppColors.accent.withValues(alpha: 0.1),
                      ],
                    ),
                    border: Border.all(
                      color: gradeColor.withValues(alpha: 0.31),
                      width: 3,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: gradeColor.withValues(alpha: 0.19),
                        blurRadius: 40,
                      ),
                    ],
                  ),
                  child: Text(emoji, style: const TextStyle(fontSize: 46)),
                ),
              ),
              const SizedBox(height: 20),
              Center(
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 40,
                      height: 40,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(12),
                        color: gradeColor.withValues(alpha: 0.13),
                        border: Border.all(
                          color: gradeColor.withValues(alpha: 0.25),
                        ),
                      ),
                      child: Text(
                        grade,
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w900,
                          color: gradeColor,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${stats.score}',
                          style: TextStyle(
                            fontSize: 30,
                            fontWeight: FontWeight.w900,
                            color: AppColors.primary,
                          ),
                        ),
                        Text(
                          t('quiz.results.totalPoints'),
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 1.2,
                            color: AppColors.mutedForeground,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              Text(
                message,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: AppColors.foreground,
                ),
              ),
              const SizedBox(height: 20),
              Row(
                children: [
                  Expanded(
                    child: _StatCard(
                      icon: Icons.gps_fixed,
                      iconColor: AppColors.primary,
                      label: t('quiz.results.accuracy'),
                      value: '$percentage%',
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _StatCard(
                      icon: Icons.local_fire_department,
                      iconColor: Colors.orange,
                      label: t('quiz.results.bestStreak'),
                      value: '${stats.bestStreak}',
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: _StatCard(
                      icon: Icons.bolt,
                      iconColor: Colors.yellow,
                      label: t('quiz.results.timeBonus'),
                      value: '+${stats.timeBonus}',
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _StatCard(
                      icon: Icons.emoji_events,
                      iconColor: AppColors.accent,
                      label: t('quiz.results.allTimeBest'),
                      value: '${c.bestStreakEver}',
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    t('quiz.results.correctCount', {'count': stats.correct}),
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      color: AppColors.mutedForeground,
                    ),
                  ),
                  Text(
                    t('quiz.results.wrongCount', {'count': stats.wrong}),
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      color: AppColors.mutedForeground,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              ClipRRect(
                borderRadius: BorderRadius.circular(999),
                child: SizedBox(
                  height: 12,
                  child: Row(
                    children: [
                      Expanded(
                        flex: percentage,
                        child: Container(
                          decoration: const BoxDecoration(
                            gradient: LinearGradient(
                              colors: [Color(0xFF3FA85B), Color(0xFF6FBF7F)],
                            ),
                          ),
                        ),
                      ),
                      if (stats.wrong > 0)
                        Expanded(
                          flex: 100 - percentage,
                          child: ColoredBox(color: AppColors.destructive),
                        ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Wrap(
                alignment: WrapAlignment.center,
                spacing: 4,
                runSpacing: 4,
                children: [
                  for (var i = 0; i < totalQuestions; i++)
                    Container(
                      width: 20,
                      height: 20,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(6),
                        color: i >= stats.correct + stats.wrong
                            ? AppColors.muted
                            : i < stats.correct
                            ? const Color(0xFF1F7A3D)
                            : AppColors.destructive.withValues(alpha: 0.7),
                      ),
                      child: Text(
                        '${i + 1}',
                        style: const TextStyle(
                          fontSize: 8,
                          fontWeight: FontWeight.w900,
                          color: Colors.white,
                        ),
                      ),
                    ),
                ],
              ),
              if (stats.score > 0 && !_doubleUsed) ...[
                const SizedBox(height: 20),
                Material(
                  color: Colors.transparent,
                  child: InkWell(
                    borderRadius: BorderRadius.circular(16),
                    onTap: _handleDouble,
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(16),
                        gradient: LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [
                            const Color(0xFFEAB93A).withValues(alpha: 0.18),
                            AppColors.accent.withValues(alpha: 0.12),
                          ],
                        ),
                        border: Border.all(
                          color: const Color(0xFFEAB93A).withValues(alpha: 0.5),
                          width: 1.5,
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: const Color(
                              0xFFEAB93A,
                            ).withValues(alpha: 0.18),
                            blurRadius: 24,
                          ),
                        ],
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 40,
                            height: 40,
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(12),
                              gradient: const LinearGradient(
                                colors: [Color(0xFFEAB93A), Color(0xFFEFA93E)],
                              ),
                              boxShadow: [
                                BoxShadow(
                                  color: const Color(
                                    0xFFEAB93A,
                                  ).withValues(alpha: 0.5),
                                  blurRadius: 12,
                                ),
                              ],
                            ),
                            child: const Icon(
                              Icons.star,
                              size: 20,
                              color: Colors.white,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Text(
                                      t('quiz.results.doubleTitle'),
                                      style: TextStyle(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w900,
                                        color: AppColors.foreground,
                                      ),
                                    ),
                                    const SizedBox(width: 6),
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 6,
                                        vertical: 2,
                                      ),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFFEAB93A),
                                        borderRadius: BorderRadius.circular(4),
                                      ),
                                      child: const Text(
                                        '2X',
                                        style: TextStyle(
                                          fontSize: 8,
                                          fontWeight: FontWeight.w900,
                                          color: Colors.white,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  _doubling
                                      ? t('quiz.results.doubleLoading')
                                      : t('quiz.results.doubleWatch', {
                                          'from': stats.score,
                                          'to': stats.score * 2,
                                        }),
                                  style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w600,
                                    color: AppColors.mutedForeground,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 4,
                            ),
                            decoration: BoxDecoration(
                              color: const Color(
                                0xFFEAB93A,
                              ).withValues(alpha: 0.2),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: const Text(
                              '📺',
                              style: TextStyle(fontSize: 10),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
              if (_doubleUsed) ...[
                const SizedBox(height: 12),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(16),
                    color: const Color(0xFF1F7A3D).withValues(alpha: 0.15),
                    border: Border.all(
                      color: const Color(0xFF1F7A3D).withValues(alpha: 0.3),
                    ),
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    t('quiz.results.doubleDone', {'score': stats.score}),
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF6FBF7F),
                    ),
                  ),
                ),
              ],
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: SizedBox(
                      height: 48,
                      child: ElevatedButton(
                        onPressed: widget.onPlayAgain,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.replay, size: 18),
                            const SizedBox(width: 8),
                            Text(
                              t('quiz.results.playAgain'),
                              style: const TextStyle(
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  SizedBox(
                    width: 48,
                    height: 48,
                    child: OutlinedButton(
                      onPressed: widget.onHome,
                      style: OutlinedButton.styleFrom(
                        backgroundColor: AppColors.card,
                        side: BorderSide(color: AppColors.glassBorder),
                        padding: EdgeInsets.zero,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: Icon(
                        Icons.home_outlined,
                        size: 18,
                        color: AppColors.foreground,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.icon,
    required this.iconColor,
    required this.label,
    required this.value,
  });
  final IconData icon;
  final Color iconColor;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        color: AppColors.card,
        border: Border.all(color: AppColors.glassBorder),
      ),
      child: Column(
        children: [
          Icon(icon, size: 16, color: iconColor),
          const SizedBox(height: 4),
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
}

class _ConfettiSpec {
  _ConfettiSpec({
    required this.color,
    required this.left,
    required this.delayMs,
    required this.durationMs,
    required this.dx,
    required this.rotate,
  });
  final Color color;
  final double left;
  final int delayMs;
  final int durationMs;
  final double dx;
  final double rotate;
}

class _ConfettiLayer extends StatefulWidget {
  const _ConfettiLayer({required this.specs});
  final List<_ConfettiSpec> specs;

  @override
  State<_ConfettiLayer> createState() => _ConfettiLayerState();
}

class _ConfettiLayerState extends State<_ConfettiLayer>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 4),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  static const _colors = [
    AppColors.primary,
    AppColors.accent,
    Color(0xFFEAB93A),
    Color(0xFF3FA85B),
    Colors.white,
  ];

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        return AnimatedBuilder(
          animation: _controller,
          builder: (context, _) {
            final h = constraints.maxHeight;
            final w = constraints.maxWidth;
            return Stack(
              children: [
                for (var i = 0; i < widget.specs.length; i++)
                  _buildDot(widget.specs[i], i, h, w),
              ],
            );
          },
        );
      },
    );
  }

  Widget _buildDot(_ConfettiSpec spec, int i, double h, double w) {
    final totalMs = 4000;
    final elapsed = (_controller.value * totalMs).round();
    final localElapsed = (elapsed - spec.delayMs) % spec.durationMs;
    final progress = localElapsed < 0 ? 0.0 : localElapsed / spec.durationMs;
    final y = -10 + (h + 20) * progress;
    final x = spec.left * w + spec.dx * progress;
    final opacity = progress < 0.9 ? 1.0 : (1 - progress) * 10;
    return Positioned(
      left: x,
      top: y,
      child: Opacity(
        opacity: opacity.clamp(0.0, 1.0),
        child: Transform.rotate(
          angle: spec.rotate * progress * pi / 180,
          child: Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(
              color: _colors[i % _colors.length],
              shape: BoxShape.circle,
            ),
          ),
        ),
      ),
    );
  }
}
