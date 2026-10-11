import 'package:flutter/material.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/theme/app_colors.dart';
import '../../widgets/lucide.dart';

/// 1:1 port of `src/components/quiz/QuizRevive.tsx`.
class QuizRevive extends StatefulWidget {
  const QuizRevive({
    super.key,
    required this.streak,
    required this.onRevive,
    required this.onGiveUp,
    this.mode,
    this.reviveCount = 0,
    this.maxRevives = 3,
  });

  final int streak;
  final Future<void> Function() onRevive;
  final VoidCallback onGiveUp;
  final String? mode;
  final int reviveCount;
  final int maxRevives;

  @override
  State<QuizRevive> createState() => _QuizReviveState();
}

class _QuizReviveState extends State<QuizRevive> {
  bool _loading = false;

  Future<void> _handleRevive() async {
    if (_loading) return;
    setState(() => _loading = true);
    try {
      await widget.onRevive();
    } finally {
      Future.delayed(const Duration(milliseconds: 400), () {
        if (mounted) setState(() => _loading = false);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final isChallenge = widget.mode == 'challenge';
    final remaining = (widget.maxRevives - widget.reviveCount).clamp(
      0,
      1 << 30,
    );
    final isLast = remaining == 1;

    return ColoredBox(
      color: AppColors.background.withValues(alpha: 0.88),
      child: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(24, 20, 24, 24),
          child: ConstrainedBox(
            constraints: BoxConstraints(
              minHeight: MediaQuery.sizeOf(context).height * 0.62,
            ),
            child: Center(
              child: Container(
                width: double.infinity,
                constraints: const BoxConstraints(maxWidth: 380),
                padding: const EdgeInsets.all(28),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(24),
                  color: AppColors.card,
                  border: Border.all(color: AppColors.glassBorder),
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 80,
                      height: 80,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(20),
                        color: AppColors.glassSoft,
                        border: Border.all(color: AppColors.goldBorder),
                      ),
                      child: Icon(
                        isChallenge
                            ? Icons.sports_kabaddi
                            : Icons.local_fire_department,
                        size: 36,
                        color: AppColors.primary,
                      ),
                    ),
                    const SizedBox(height: 20),
                    Text(
                      isChallenge
                          ? t('quiz.revive.titleChallenge')
                          : t('quiz.revive.titleStreak'),
                      style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w900,
                        color: AppColors.foreground,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      isChallenge
                          ? t('quiz.revive.descChallenge')
                          : t('quiz.revive.descStreak', {
                              'count': widget.streak,
                            }),
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 14,
                        height: 1.4,
                        color: AppColors.foreground.withValues(alpha: 0.75),
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      isLast
                          ? t('quiz.revive.lastRevive')
                          : t('quiz.revive.watchAd'),
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 13,
                        height: 1.4,
                        color: AppColors.foreground.withValues(alpha: 0.6),
                      ),
                    ),
                    const SizedBox(height: 20),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 8,
                      ),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(999),
                        color: AppColors.glassSoft,
                        border: Border.all(
                          color: AppColors.primary.withValues(alpha: 0.2),
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          for (var i = 0; i < widget.maxRevives; i++)
                            Padding(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 2,
                              ),
                              child: Icon(
                                i < remaining
                                    ? Icons.favorite
                                    : Icons.favorite_border,
                                size: 14,
                                color: i < remaining
                                    ? AppColors.primary
                                    : AppColors.foreground.withValues(
                                        alpha: 0.25,
                                      ),
                              ),
                            ),
                          const SizedBox(width: 8),
                          Text(
                            t('quiz.revive.status', {
                              'current': remaining,
                              'total': widget.maxRevives,
                              'label': remaining == 1
                                  ? t('quiz.revive.reviveLabelOne')
                                  : t('quiz.revive.reviveLabelOther'),
                            }),
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              color: AppColors.foreground.withValues(
                                alpha: 0.85,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),
                    SizedBox(
                      width: double.infinity,
                      height: 48,
                      child: ElevatedButton(
                        onPressed: _loading ? null : _handleRevive,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                        child: _loading
                            ? Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  const SizedBox(
                                    width: 16,
                                    height: 16,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      color: Colors.white,
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Text(t('quiz.revive.loading')),
                                ],
                              )
                            : Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  LucideIcon('play', size: 18),
                                  const SizedBox(width: 8),
                                  Text(
                                    t('quiz.revive.btnRevive'),
                                    style: const TextStyle(
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ],
                              ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    SizedBox(
                      width: double.infinity,
                      height: 40,
                      child: TextButton(
                        onPressed: _loading ? null : widget.onGiveUp,
                        child: Text(
                          t('quiz.revive.btnGiveUp'),
                          style: TextStyle(
                            color: AppColors.foreground.withValues(alpha: 0.65),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
