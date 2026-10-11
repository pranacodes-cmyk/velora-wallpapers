import 'package:flutter/material.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/services/haptics.dart';
import '../../core/theme/app_colors.dart';
import '../../widgets/lucide.dart';
import 'quiz_data.dart';

/// 1:1 port of `src/components/quiz/QuizQuestionCard.tsx`.
class QuizQuestionCard extends StatelessWidget {
  const QuizQuestionCard({
    super.key,
    required this.question,
    required this.selectedAnswer,
    required this.timeLeft,
    required this.maxTime,
    required this.onAnswer,
    required this.questionNumber,
    required this.totalQuestions,
  });

  final QuizQuestion question;
  final int? selectedAnswer;
  final int timeLeft;
  final int maxTime;
  final ValueChanged<int> onAnswer;
  final int questionNumber;
  final int totalQuestions;

  @override
  Widget build(BuildContext context) {
    final answered = selectedAnswer != null;
    final timerPercent = maxTime == 0
        ? 0.0
        : (timeLeft / maxTime).clamp(0.0, 1.0);
    final timerUrgent = timeLeft <= 5;

    final typeLabel = question.type == 'multiple_choice'
        ? t('quiz.card.mc')
        : question.type == 'true_false'
        ? t('quiz.card.tf')
        : t('quiz.card.fill');
    final typeIcon = question.type == 'fill_verse'
        ? '✝️'
        : question.type == 'true_false'
        ? '⚡'
        : '🧠';

    return Column(
      key: ValueKey(question.id),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(
              '$questionNumber/$totalQuestions',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.bold,
                color: AppColors.mutedForeground,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _GradientBar(
                // Web animates the fill over 0.5s with the primary→accent
                // gradient; a flat Material bar looked noticeably cheaper.
                value: totalQuestions == 0
                    ? 0
                    : questionNumber / totalQuestions,
                height: 6,
                duration: const Duration(milliseconds: 500),
                colors: [AppColors.primary, AppColors.accent],
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        _GradientBar(
          value: timerPercent,
          height: 8,
          duration: const Duration(milliseconds: 300),
          pulse: timerUrgent,
          colors: timerUrgent
              ? [AppColors.destructive, AppColors.destructive]
              : [AppColors.primary, AppColors.accent],
        ),
        const SizedBox(height: 8),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              '$typeIcon ${typeLabel.toUpperCase()}',
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.bold,
                letterSpacing: 1,
                color: AppColors.mutedForeground,
              ),
            ),
            Text(
              '${timeLeft}s',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w900,
                color: timerUrgent ? AppColors.destructive : AppColors.primary,
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.glassBorder),
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [AppColors.card, AppColors.secondary],
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.3),
                blurRadius: 32,
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                question.category,
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                  color: AppColors.primary,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                question.question,
                style: TextStyle(
                  fontSize: question.type == 'fill_verse' ? 16 : 18,
                  fontStyle: question.type == 'fill_verse'
                      ? FontStyle.italic
                      : FontStyle.normal,
                  fontWeight: FontWeight.bold,
                  height: 1.4,
                  color: AppColors.foreground,
                ),
              ),
              if (question.reference.isNotEmpty) ...[
                const SizedBox(height: 8),
                Row(
                  children: [
                    Icon(
                      Icons.menu_book_outlined,
                      size: 12,
                      color: AppColors.mutedForeground,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      question.reference,
                      style: TextStyle(
                        fontSize: 10,
                        color: AppColors.mutedForeground,
                      ),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 16),
        for (var i = 0; i < question.options.length; i++)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: _OptionButton(
              index: i,
              label: question.options[i],
              isSelected: selectedAnswer == i,
              isCorrect: i == question.correctIndex,
              answered: answered,
              onTap: () {
                if (!answered) {
                  haptic(HapticStyle.medium);
                  onAnswer(i);
                }
              },
            ),
          ),
        AnimatedSize(
          duration: const Duration(milliseconds: 250),
          child: answered
              ? Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(12),
                    color: AppColors.primary.withValues(alpha: 0.06),
                    border: Border.all(
                      color: AppColors.primary.withValues(alpha: 0.18),
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        t('quiz.card.didYouKnow'),
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          color: AppColors.primary,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        question.explanation,
                        style: TextStyle(
                          fontSize: 12,
                          height: 1.5,
                          color: AppColors.mutedForeground,
                        ),
                      ),
                    ],
                  ),
                )
              : const SizedBox.shrink(),
        ),
      ],
    );
  }
}

class _OptionButton extends StatelessWidget {
  const _OptionButton({
    required this.index,
    required this.label,
    required this.isSelected,
    required this.isCorrect,
    required this.answered,
    required this.onTap,
  });

  final int index;
  final String label;
  final bool isSelected;
  final bool isCorrect;
  final bool answered;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final showCorrect = answered && isCorrect;
    final showWrong = answered && isSelected && !isCorrect;

    final bg = showCorrect
        ? const Color(0xFF14532D)
        : showWrong
        ? const Color(0xFF450A0A)
        : AppColors.card;
    final border = showCorrect
        ? const Color(0xFF16A34A)
        : showWrong
        ? const Color(0xFFDC2626)
        : AppColors.glassBorder;
    final textColor = showCorrect || showWrong
        ? Colors.white
        : AppColors.foreground;

    final content = Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: answered ? null : onTap,
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          decoration: BoxDecoration(
            color: bg,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: border, width: 1.5),
          ),
          child: Row(
            children: [
              Container(
                width: 28,
                height: 28,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(8),
                  color: showCorrect
                      ? Colors.green.withValues(alpha: 0.3)
                      : showWrong
                      ? Colors.red.withValues(alpha: 0.3)
                      : AppColors.primary.withValues(alpha: 0.1),
                ),
                child: showCorrect
                    ? LucideIcon('check', size: 16, color: Colors.white)
                    : showWrong
                    ? LucideIcon('x', size: 16, color: Colors.white)
                    : Text(
                        String.fromCharCode(65 + index),
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w900,
                          color: AppColors.primary,
                        ),
                      ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  label,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: textColor,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );

    // Web sweeps a soft white shimmer across the correct option once it is
    // revealed; without it the reveal felt flat next to the React build.
    if (!showCorrect) return content;
    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: Stack(
        children: [
          content,
          const Positioned.fill(child: IgnorePointer(child: _ShimmerSweep())),
        ],
      ),
    );
  }
}

/// One-and-a-half pass white shimmer sweep (web: `x: -100% → 200%`, 1.5s).
class _ShimmerSweep extends StatefulWidget {
  const _ShimmerSweep();

  @override
  State<_ShimmerSweep> createState() => _ShimmerSweepState();
}

class _ShimmerSweepState extends State<_ShimmerSweep>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1500),
  );

  @override
  void initState() {
    super.initState();
    _c.forward();
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return RepaintBoundary(
      child: AnimatedBuilder(
        animation: _c,
        builder: (context, _) {
          final t = _c.value;
          return FractionalTranslation(
            translation: Offset(-1 + t * 3, 0),
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    Colors.transparent,
                    Colors.white.withValues(alpha: 0.10),
                    Colors.transparent,
                  ],
                ),
              ),
              child: const SizedBox.expand(),
            ),
          );
        },
      ),
    );
  }
}

/// Animated gradient progress bar — matches the web build's
/// `linear-gradient(90deg, primary, accent)` fills (and the urgent red pulse on
/// the timer) instead of a flat Material indicator.
class _GradientBar extends StatelessWidget {
  const _GradientBar({
    required this.value,
    required this.height,
    required this.duration,
    required this.colors,
    this.pulse = false,
  });

  final double value;
  final double height;
  final Duration duration;
  final List<Color> colors;
  final bool pulse;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(999),
      child: Container(
        height: height,
        color: AppColors.muted,
        child: TweenAnimationBuilder<double>(
          tween: Tween<double>(begin: 0, end: value.clamp(0.0, 1.0)),
          duration: duration,
          curve: Curves.easeOut,
          builder: (context, v, _) => Align(
            alignment: Alignment.centerLeft,
            child: FractionallySizedBox(
              widthFactor: v <= 0 ? 0.0001 : v,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(999),
                  gradient: LinearGradient(colors: colors),
                  boxShadow: pulse
                      ? [
                          BoxShadow(
                            color: colors.first.withValues(alpha: 0.5),
                            blurRadius: 8,
                          ),
                        ]
                      : null,
                ),
                child: const SizedBox.expand(),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
