import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/services/analytics.dart';
import '../../core/services/content_data.dart';
import '../../core/services/haptics.dart';
import '../../core/services/prefs.dart';
import '../../core/theme/app_colors.dart';
import 'today_shared.dart';

const _threeHoursMs = 3 * 60 * 60 * 1000;
const _dailyQStorageKey = 'daily-bible-q.v1';
const _calmDelayMs = 5000;

int _threeHourSeed() => DateTime.now().millisecondsSinceEpoch ~/ _threeHoursMs;

/// 1:1 port of `DailyQuestionCard` in `src/pages/Today.tsx`: one deterministic
/// question per 3-hour window, 2x2 answer grid that "calms" 5s after answering,
/// verdict + explanation, and the countdown / full-quiz CTA row.
class DailyQuestionCard extends StatefulWidget {
  const DailyQuestionCard({super.key, required this.onOpenQuiz});

  final VoidCallback onOpenQuiz;

  @override
  State<DailyQuestionCard> createState() => _DailyQuestionCardState();
}

class _DailyQuestionCardState extends State<DailyQuestionCard> {
  int _seed = _threeHourSeed();
  int? _picked;
  int? _answeredAt;
  bool _calmed = false;
  bool _poolReady = false;
  Timer? _rollTimer;
  Timer? _calmTimer;
  Timer? _countdownTimer;

  @override
  void initState() {
    super.initState();
    _restore();
    // The quiz bank streams in after first paint (same as the web idle import).
    Future.delayed(const Duration(milliseconds: 300), () async {
      await ContentData.loadDeferred();
      if (mounted) setState(() => _poolReady = true);
    });
    // Roll forward when the 3h window advances.
    _rollTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      final s = _threeHourSeed();
      if (s != _seed && mounted) {
        setState(() {
          _seed = s;
          _picked = null;
          _answeredAt = null;
          _calmed = false;
        });
        Prefs.remove(_dailyQStorageKey);
      }
    });
    _countdownTimer = Timer.periodic(const Duration(minutes: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _rollTimer?.cancel();
    _calmTimer?.cancel();
    _countdownTimer?.cancel();
    super.dispose();
  }

  void _restore() {
    try {
      final raw = Prefs.getString(_dailyQStorageKey);
      if (raw == null) return;
      final data = jsonDecode(raw) as Map<String, dynamic>;
      if (data['seed'] != _threeHourSeed()) return;
      _picked = (data['picked'] as num?)?.toInt();
      _answeredAt = (data['at'] as num?)?.toInt();
      if (_answeredAt != null) {
        final elapsed = DateTime.now().millisecondsSinceEpoch - _answeredAt!;
        if (elapsed >= _calmDelayMs) {
          _calmed = true;
        } else {
          _scheduleCalm(_calmDelayMs - elapsed);
        }
      }
    } catch (_) {}
  }

  void _scheduleCalm(int ms) {
    _calmTimer?.cancel();
    _calmTimer = Timer(Duration(milliseconds: ms), () {
      if (mounted) setState(() => _calmed = true);
    });
  }

  String _formatUntilNextThreeHour() {
    final nextBoundary = (_threeHourSeed() + 1) * _threeHoursMs;
    final totalMin =
        ((nextBoundary - DateTime.now().millisecondsSinceEpoch) ~/ 60000);
    final safe = totalMin < 1 ? 1 : totalMin;
    final h = safe ~/ 60;
    final m = safe % 60;
    if (h >= 1) return t('today.countdown.hm', {'h': h, 'm': m});
    return t('today.countdown.m', {'m': m});
  }

  void _handlePick(int i, QuizQuestion q) {
    if (_picked != null) return;
    haptic(i == q.correctIndex ? HapticStyle.medium : HapticStyle.soft);
    final at = DateTime.now().millisecondsSinceEpoch;
    setState(() {
      _picked = i;
      _answeredAt = at;
      _calmed = false;
    });
    _scheduleCalm(_calmDelayMs);
    Prefs.setString(
      _dailyQStorageKey,
      jsonEncode({'seed': _seed, 'picked': i, 'at': at}),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (!_poolReady) return const SizedBox.shrink();
    final q = ContentData.questionForSeed(_seed);
    if (q == null) return const SizedBox.shrink();

    final answered = _picked != null;
    final isCorrect = _picked == q.correctIndex;
    final refresh = _formatUntilNextThreeHour();

    return FadeRise(
      offsetY: 14,
      delay: const Duration(milliseconds: 250),
      duration: const Duration(milliseconds: 600),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 0, 12, 20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SectionLabel('today.section.dailyQuestion'),
            Container(
              clipBehavior: Clip.antiAlias,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(22),
                color: AppColors.card,
                border: Border.all(color: AppColors.glassBorder),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.5),
                    blurRadius: 26,
                    spreadRadius: -16,
                    offset: const Offset(0, 10),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Eyebrow
                  Text(
                    t('today.question.label').toUpperCase(),
                    style: TextStyle(
                      fontSize: 9.5,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 9.5 * 0.22,
                      color: AppColors.primary.withValues(alpha: 0.85),
                    ),
                  ),
                  const SizedBox(height: 14),

                  // Question
                  Text(
                    q.question,
                    style: TextStyle(
                      fontFamily: kSerif,
                      fontFamilyFallback: kSerifFallback,
                      fontSize: 17,
                      height: 1.4,
                      fontWeight: FontWeight.bold,
                      letterSpacing: -0.085,
                      color: AppColors.foreground,
                    ),
                  ),
                  const SizedBox(height: 14),

                  // 2x2 options
                  GridView.count(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    crossAxisCount: 2,
                    mainAxisSpacing: 8,
                    crossAxisSpacing: 8,
                    childAspectRatio: 2.6,
                    children: [
                      for (var i = 0; i < q.options.take(4).length; i++)
                        _OptionTile(
                          label: q.options[i],
                          answered: answered,
                          calmed: _calmed,
                          showRight: answered && i == q.correctIndex,
                          showWrong:
                              answered && _picked == i && i != q.correctIndex,
                          onTap: () => _handlePick(i, q),
                        ),
                    ],
                  ),

                  // Verdict + explanation
                  if (answered) ...[
                    const SizedBox(height: 12),
                    FadeRise(
                      offsetY: 6,
                      duration: const Duration(milliseconds: 350),
                      child: Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(12),
                          color: _calmed
                              ? AppColors.foreground.withValues(alpha: 0.04)
                              : isCorrect
                              ? const Color(0xFF34D399).withValues(alpha: 0.12)
                              : const Color(0xFFFBBF24).withValues(alpha: 0.10),
                          border: Border.all(
                            color: _calmed
                                ? AppColors.foreground.withValues(alpha: 0.10)
                                : isCorrect
                                ? const Color(
                                    0xFF34D399,
                                  ).withValues(alpha: 0.35)
                                : const Color(
                                    0xFFFBBF24,
                                  ).withValues(alpha: 0.30),
                          ),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              isCorrect
                                  ? '✓ AMEN — CORRECT!'
                                  : 'NOT QUITE — KEEP GROWING',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 11 * 0.08,
                                color: isCorrect
                                    ? const Color(0xFF6EE7B7)
                                    : const Color(0xFFFCD34D),
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              q.explanation,
                              style: TextStyle(
                                fontSize: 12,
                                height: 1.5,
                                fontWeight: FontWeight.w500,
                                color: AppColors.foreground.withValues(
                                  alpha: 0.85,
                                ),
                              ),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              q.reference,
                              style: TextStyle(
                                fontSize: 10.5,
                                fontWeight: FontWeight.bold,
                                letterSpacing: 10.5 * 0.04,
                                color: AppColors.primary.withValues(alpha: 0.9),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],

                  // CTA row
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.only(top: 12),
                    decoration: BoxDecoration(
                      border: Border(
                        top: BorderSide(
                          color: AppColors.foreground.withValues(alpha: 0.08),
                        ),
                      ),
                    ),
                    child: answered
                        ? Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Expanded(
                                child: Text(
                                  'NEW QUESTION IN $refresh'.toUpperCase(),
                                  style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.bold,
                                    letterSpacing: 10 * 0.1,
                                    color: AppColors.foreground.withValues(
                                      alpha: 0.55,
                                    ),
                                  ),
                                ),
                              ),
                              TapScale(
                                scale: 0.96,
                                onTap: () {
                                  haptic(HapticStyle.medium);
                                  Analytics.capture('today_quiz_start_tapped', {
                                    'surface': 'quiz_card_answered',
                                  });
                                  widget.onOpenQuiz();
                                },
                                child: Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 14,
                                    vertical: 8,
                                  ),
                                  decoration: BoxDecoration(
                                    borderRadius: BorderRadius.circular(999),
                                    gradient: LinearGradient(
                                      begin: Alignment.topCenter,
                                      end: Alignment.bottomCenter,
                                      colors: [
                                        hsl(42, 92, 60),
                                        hsl(38, 88, 48),
                                      ],
                                    ),
                                    boxShadow: [
                                      BoxShadow(
                                        color: AppColors.primary.withValues(
                                          alpha: 0.55,
                                        ),
                                        blurRadius: 16,
                                        spreadRadius: -4,
                                        offset: const Offset(0, 6),
                                      ),
                                    ],
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Icon(
                                        Icons.star,
                                        size: 14,
                                        color: AppColors.background,
                                      ),
                                      const SizedBox(width: 6),
                                      Text(
                                        'Start full quiz',
                                        style: TextStyle(
                                          fontSize: 12,
                                          fontWeight: FontWeight.w800,
                                          color: AppColors.background,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ],
                          )
                        : Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                'TAP AN ANSWER TO BEGIN',
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                  letterSpacing: 10 * 0.15,
                                  color: AppColors.foreground.withValues(
                                    alpha: 0.55,
                                  ),
                                ),
                              ),
                              Text(
                                'NEW IN $refresh'.toUpperCase(),
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                  letterSpacing: 10 * 0.08,
                                  color: AppColors.foreground.withValues(
                                    alpha: 0.4,
                                  ),
                                ),
                              ),
                            ],
                          ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _OptionTile extends StatelessWidget {
  const _OptionTile({
    required this.label,
    required this.answered,
    required this.calmed,
    required this.showRight,
    required this.showWrong,
    required this.onTap,
  });

  final String label;
  final bool answered;
  final bool calmed;
  final bool showRight;
  final bool showWrong;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final neutralBg = AppColors.foreground.withValues(alpha: 0.04);
    final neutralBorder = AppColors.foreground.withValues(alpha: 0.10);

    final bg = calmed
        ? neutralBg
        : showRight
        ? hsl(140, 60, 40, 0.22)
        : showWrong
        ? hsl(0, 70, 50, 0.18)
        : neutralBg;
    final border = calmed
        ? showRight
              ? hsl(140, 65, 45, 0.45)
              : showWrong
              ? hsl(0, 65, 55, 0.35)
              : neutralBorder
        : showRight
        ? hsl(140, 70, 45, 0.65)
        : showWrong
        ? hsl(0, 75, 55, 0.6)
        : neutralBorder;
    final color = calmed
        ? AppColors.foreground.withValues(alpha: 0.85)
        : showRight
        ? hsl(140, 75, 55)
        : showWrong
        ? hsl(0, 75, 60)
        : AppColors.foreground.withValues(alpha: 0.9);

    return TapScale(
      scale: answered ? 1 : 0.96,
      onTap: answered ? () {} : onTap,
      child: AnimatedOpacity(
        opacity: answered && !calmed && !showRight && !showWrong ? 0.5 : 1,
        duration: const Duration(milliseconds: 700),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 700),
          alignment: Alignment.center,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            color: bg,
            border: Border.all(color: border),
          ),
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: color,
            ),
          ),
        ),
      ),
    );
  }
}
