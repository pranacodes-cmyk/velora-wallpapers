import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/services/challenge_data.dart';
import '../../core/services/haptics.dart';
import '../../core/theme/app_colors.dart';
import 'challenge_widgets.dart';

/// The 75-day path: five stage cards (one lamp each), fifteen stepping stones
/// per stage laid out as a snake. Web mirror: `ChallengePath.tsx`.
class ChallengePath extends StatelessWidget {
  const ChallengePath({super.key, required this.completed, required this.currentDay, required this.lit, required this.onOpenDay});
  final int completed;
  final int currentDay;
  final bool lit;
  final ValueChanged<int> onOpenDay;

  static const _cols = 5;
  static const _stone = 44.0;
  static const _gap = 8.0;

  @override
  Widget build(BuildContext context) => Column(
        children: [
          for (final stage in kStages) ...[
            _stage(stage),
            const SizedBox(height: 12),
          ],
        ],
      );

  Widget _stage(ChallengeStage stage) {
    final unlocked = completed >= stage.from - 1;
    final stageDone = (completed - (stage.from - 1)).clamp(0, 15);
    final lamp = kLamps[stage.index];
    return Container(
      clipBehavior: Clip.antiAlias,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: unlocked ? AppColors.card : AppColors.card.withValues(alpha: 0.6),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: unlocked ? AppColors.primary.withValues(alpha: 0.25) : AppColors.border),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Opacity(
                opacity: unlocked ? 1 : 0.4,
                child: SizedBox(width: 64, height: 40, child: Image.asset(lamp.asset, fit: BoxFit.contain)),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(upper(t('ch.stage.range', {'from': stage.from, 'to': stage.to})), style: ChInk.eyebrow(10, AppColors.primary, tracking: 0.2)),
                    const SizedBox(height: 2),
                    Text.rich(
                      TextSpan(children: [
                        TextSpan(text: '${t('ch.stage.${stage.key}')} · '),
                        TextSpan(text: t('ch.lamp.${stage.index}'), style: TextStyle(color: AppColors.mutedForeground)),
                      ]),
                      style: ChInk.serif(19, height: 1.2),
                    ),
                  ],
                ),
              ),
              Text('$stageDone/15', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: AppColors.mutedForeground)),
            ],
          ),
          const SizedBox(height: 12),
          LayoutBuilder(builder: (context, c) {
            final w = c.maxWidth;
            final cell = w / _cols;
            Offset center(int i) {
              final row = i ~/ _cols;
              final col = row.isEven ? i % _cols : _cols - 1 - (i % _cols);
              return Offset((col + 0.5) * cell, row * (_stone + _gap) + _stone / 2);
            }

            const height = 3 * _stone + 2 * _gap;
            final progressPoints = math.min(15, stageDone + (stageDone < 15 && unlocked ? 1 : 0));
            return SizedBox(
              height: height,
              child: Stack(
                children: [
                  Positioned.fill(
                    child: CustomPaint(
                      painter: _PathPainter(
                        points: [for (var i = 0; i < 15; i++) center(i)],
                        progress: stageDone > 0 ? progressPoints : 0,
                        base: AppColors.border,
                        gold: AppColors.primary,
                      ),
                    ),
                  ),
                  for (var i = 0; i < 15; i++)
                    Positioned(
                      left: center(i).dx - _stone / 2,
                      top: center(i).dy - _stone / 2,
                      child: _node(stage.from + i),
                    ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }

  Widget _node(int day) {
    final isDone = day <= completed;
    final isCurrent = !isDone && day == currentDay && !lit;
    final isNextTomorrow = !isDone && day == completed + 1 && lit;
    final star = isDone && (day % 15 == 0 || day == 1 || day == 7);
    final Widget inner;
    if (isDone) {
      inner = const LucideIconLite('check', size: 16, color: ChInk.ctaForeground, strokeWidth: 3);
    } else if (!isCurrent && !isNextTomorrow && day > currentDay) {
      inner = Opacity(opacity: 0.6, child: LucideIconLite('lock', size: 14, color: AppColors.mutedForeground));
    } else {
      inner = Text('$day', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: isCurrent ? AppColors.primary : AppColors.mutedForeground));
    }
    return Semantics(
      button: isDone || isCurrent,
      label: t('ch.day', {'day': day}),
      child: GestureDetector(
        onTap: isDone || isCurrent
            ? () {
                haptic(HapticStyle.soft);
                onOpenDay(day);
              }
            : null,
        child: SizedBox(
          width: _stone,
          height: _stone,
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              Container(
                width: _stone,
                height: _stone,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: isDone ? LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [ChInk.goldGlow, ChInk.gold]) : null,
                  color: isDone
                      ? null
                      : Color.alphaBlend(
                          isCurrent ? AppColors.primary.withValues(alpha: 0.15) : AppColors.muted.withValues(alpha: 0.5),
                          AppColors.card,
                        ),
                  border: isDone ? null : Border.all(color: isCurrent ? AppColors.primary : AppColors.border, width: isCurrent ? 2 : 1),
                  boxShadow: isDone
                      ? [BoxShadow(color: AppColors.primary.withValues(alpha: 0.6), blurRadius: 14, spreadRadius: -6, offset: const Offset(0, 6))]
                      : isCurrent
                          ? [BoxShadow(color: AppColors.primary.withValues(alpha: 0.45), blurRadius: 16, spreadRadius: -2)]
                          : null,
                ),
                child: inner,
              ),
              if (star)
                Positioned(
                  right: -4,
                  top: -4,
                  child: Container(
                    width: 18,
                    height: 18,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: AppColors.card,
                      border: Border.all(color: AppColors.primary.withValues(alpha: 0.7), width: 2),
                    ),
                    child: Text('★', style: TextStyle(fontSize: 9, height: 1, color: AppColors.primary)),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PathPainter extends CustomPainter {
  _PathPainter({required this.points, required this.progress, required this.base, required this.gold});
  final List<Offset> points;
  final int progress;
  final Color base;
  final Color gold;

  @override
  void paint(Canvas canvas, Size size) {
    final dash = Paint()
      ..color = base
      ..strokeWidth = 2
      ..strokeCap = StrokeCap.round
      ..style = PaintingStyle.stroke;
    for (var i = 0; i < points.length - 1; i++) {
      final a = points[i], b = points[i + 1];
      final len = (b - a).distance;
      final dir = (b - a) / len;
      for (double d = 0; d < len; d += 7) {
        canvas.drawLine(a + dir * d, a + dir * math.min(len, d + 2), dash);
      }
    }
    if (progress > 1) {
      final p = Path()..moveTo(points[0].dx, points[0].dy);
      for (var i = 1; i < progress; i++) {
        p.lineTo(points[i].dx, points[i].dy);
      }
      canvas.drawPath(
        p,
        Paint()
          ..color = gold
          ..strokeWidth = 3
          ..strokeCap = StrokeCap.round
          ..strokeJoin = StrokeJoin.round
          ..style = PaintingStyle.stroke,
      );
    }
  }

  @override
  bool shouldRepaint(covariant _PathPainter old) => old.progress != progress || old.base != base || old.gold != gold;
}
