import 'package:flutter/material.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/services/haptics.dart';
import '../../core/theme/app_colors.dart';
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
              child: ClipRRect(
                borderRadius: BorderRadius.circular(999),
                child: LinearProgressIndicator(
                  value: totalQuestions == 0
                      ? 0
                      : questionNumber / totalQuestions,
                  minHeight: 6,
                  backgroundColor: AppColors.muted,
                  valueColor: AlwaysStoppedAnimation(AppColors.primary),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        ClipRRect(
          borderRadius: BorderRadius.circular(999),
          child: LinearProgressIndicator(
            value: timerPercent,
            minHeight: 8,
            backgroundColor: AppColors.muted,
            valueColor: AlwaysStoppedAnimation(
              timerUrgent ? AppColors.destructive : AppColors.primary,
            ),
          ),
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
                      color: AppColors.primary.withValues(alpha: 0.15),
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

    return Material(
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
                    ? const Icon(Icons.check, size: 16, color: Colors.white)
                    : showWrong
                    ? const Icon(Icons.close, size: 16, color: Colors.white)
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
  }
}
