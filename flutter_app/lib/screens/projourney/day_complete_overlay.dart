import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/services/pro_journeys.dart';
import '../../core/theme/app_colors.dart';
import '../challenge/challenge_widgets.dart';
import 'pj_ui.dart';

/// Full-screen moment when a Pro Journey day is complete — always the
/// midnight palette for contrast. Free users who finish their free Day 1 see
/// an invitation to continue with Pro.
/// Web mirror: `src/components/projourney/DayCompleteOverlay.tsx`.
class DayCompleteOverlay extends StatelessWidget {
  const DayCompleteOverlay({
    super.key,
    required this.journey,
    required this.result,
    required this.showPro,
    required this.onShare,
    required this.onPro,
    required this.onDone,
  });
  final ProJourneyDef journey;
  final ProDayResult result;
  final bool showPro;
  final VoidCallback onShare;
  final VoidCallback onPro;
  final VoidCallback onDone;

  static final _gold = HSLColor.fromAHSL(1, 42, 0.85, 0.55).toColor();
  static final _goldGlow = HSLColor.fromAHSL(1, 38, 1, 0.65).toColor();

  @override
  Widget build(BuildContext context) {
    final fg = AppColors.darkForeground;
    final muted = AppColors.darkMutedForeground;
    final primary = AppColors.darkPrimary;
    final reduce = MediaQuery.maybeOf(context)?.disableAnimations ?? false;
    final j = journey;
    final title = result.finished ? t('pj.${j.id}.doneTitle') : t('pj.cele.title', {'n': result.day});
    final from = (result.day - 1) / result.total;
    final to = result.day / result.total;

    Widget rise(int ms, Widget child) => PjRise(delay: Duration(milliseconds: ms), child: child);

    return Semantics(
      scopesRoute: true,
      namesRoute: true,
      label: title,
      child: Material(
        color: AppColors.darkBackground,
        child: Stack(children: [
          Positioned.fill(
            child: Opacity(
              opacity: 0.3,
              child: ImageFiltered(
                imageFilter: ui.ImageFilter.blur(sigmaX: 28, sigmaY: 28),
                child: Transform.scale(scale: 1.1, child: Image.asset(j.cover, fit: BoxFit.cover, gaplessPlayback: true)),
              ),
            ),
          ),
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  center: const Alignment(0, -0.4),
                  radius: 0.9,
                  colors: [_gold.withValues(alpha: 0.2), AppColors.darkBackground.withValues(alpha: 0)],
                ),
              ),
            ),
          ),
          SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 40),
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  PjPop(
                    child: SizedBox(
                      width: 136,
                      height: 136,
                      child: Stack(alignment: Alignment.center, children: [
                        Positioned.fill(
                          child: TweenAnimationBuilder<double>(
                            tween: Tween(begin: reduce ? to : from, end: to),
                            duration: reduce ? Duration.zero : const Duration(milliseconds: 1500),
                            curve: const Interval(0.2, 1, curve: Cubic(0.2, 0.8, 0.2, 1)),
                            builder: (_, v, __) => CustomPaint(painter: _RingPainter(v, fg.withValues(alpha: 0.12), _gold)),
                          ),
                        ),
                        Text(result.finished ? j.emoji : '✨', style: const TextStyle(fontSize: 44)),
                      ]),
                    ),
                  ),
                  const SizedBox(height: 20),
                  rise(150, Text(
                    upper('${t('pj.${j.id}.name')} · ${t('pj.progressShort', {'n': result.day, 'total': result.total})}'),
                    textAlign: TextAlign.center,
                    style: ChInk.eyebrow(11.5, primary, tracking: 0.2),
                  )),
                  const SizedBox(height: 8),
                  rise(220, ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 320),
                    child: Text(title, textAlign: TextAlign.center, style: ChInk.serif(32, color: fg, height: 1.1)),
                  )),
                  const SizedBox(height: 8),
                  rise(300, ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 320),
                    child: Text(
                      result.finished ? t('pj.${j.id}.doneSub') : t('pj.cele.next', {'n': result.day + 1}),
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 15, height: 1.5, color: muted),
                    ),
                  )),
                  if (result.finished) ...[
                    const SizedBox(height: 16),
                    PjPop(
                      delay: const Duration(milliseconds: 500),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                        decoration: BoxDecoration(
                          gradient: LinearGradient(colors: [_gold, _goldGlow]),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text(t('pj.cele.badge', {'badge': t('pj.${j.id}.badge')}),
                            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: ChInk.ctaForeground)),
                      ),
                    ),
                  ],
                  if (showPro) ...[
                    const SizedBox(height: 28),
                    rise(450, ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 384),
                      child: Container(
                        padding: const EdgeInsets.all(20),
                        decoration: BoxDecoration(
                          color: AppColors.darkCard.withValues(alpha: 0.85),
                          borderRadius: BorderRadius.circular(24),
                          border: Border.all(color: primary.withValues(alpha: 0.35)),
                        ),
                        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                          Row(children: [
                            LucideIconLite('crown', size: 16, color: primary),
                            const SizedBox(width: 8),
                            Expanded(child: Text(t('pj.cele.proTitle'), style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: fg))),
                          ]),
                          const SizedBox(height: 4),
                          Text(t('pj.cele.proSub'), style: TextStyle(fontSize: 13.5, height: 1.5, color: muted)),
                          const SizedBox(height: 16),
                          _DarkGoldButton(label: t('pj.cele.proCta'), gold: _gold, glow: _goldGlow, onTap: onPro),
                        ]),
                      ),
                    )),
                  ],
                  const SizedBox(height: 24),
                  rise(550, ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 384),
                    child: Row(children: [
                      Expanded(
                        child: _Pill(
                          label: t('pj.cele.share'),
                          icon: 'share-2',
                          fg: fg,
                          border: primary.withValues(alpha: 0.4),
                          onTap: onShare,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(child: _Pill(label: t('pj.cele.done'), fg: Colors.white, fill: primary, onTap: onDone)),
                    ]),
                  )),
                ]),
              ),
            ),
          ),
        ]),
      ),
    );
  }
}

class _RingPainter extends CustomPainter {
  _RingPainter(this.value, this.track, this.color);
  final double value;
  final Color track;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width / 120;
    final rect = Rect.fromCircle(center: size.center(Offset.zero), radius: 52 * s);
    final base = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 7 * s
      ..color = track;
    canvas.drawArc(rect, 0, math.pi * 2, false, base);
    if (value <= 0) return;
    final glow = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 7 * s
      ..strokeCap = StrokeCap.round
      ..color = color.withValues(alpha: 0.5)
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 6);
    final arc = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 7 * s
      ..strokeCap = StrokeCap.round
      ..color = color;
    final sweep = math.pi * 2 * value.clamp(0.0, 1.0);
    canvas.drawArc(rect, -math.pi / 2, sweep, false, glow);
    canvas.drawArc(rect, -math.pi / 2, sweep, false, arc);
  }

  @override
  bool shouldRepaint(_RingPainter old) => old.value != value || old.color != color;
}

class _Pill extends StatelessWidget {
  const _Pill({required this.label, required this.fg, this.icon, this.fill, this.border, required this.onTap});
  final String label;
  final String? icon;
  final Color fg;
  final Color? fill;
  final Color? border;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Semantics(
        button: true,
        label: label,
        excludeSemantics: true,
        child: GestureDetector(
          onTap: onTap,
          child: Container(
            height: 52,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: fill,
              borderRadius: BorderRadius.circular(999),
              border: border != null ? Border.all(color: border!) : null,
            ),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              if (icon != null) ...[LucideIconLite(icon!, size: 16, color: fg), const SizedBox(width: 8)],
              Flexible(child: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: fg))),
            ]),
          ),
        ),
      );
}

class _DarkGoldButton extends StatelessWidget {
  const _DarkGoldButton({required this.label, required this.gold, required this.glow, required this.onTap});
  final String label;
  final Color gold;
  final Color glow;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Semantics(
        button: true,
        label: label,
        excludeSemantics: true,
        child: GestureDetector(
          onTap: onTap,
          child: Container(
            height: 52,
            alignment: Alignment.center,
            decoration: BoxDecoration(gradient: LinearGradient(colors: [gold, glow]), borderRadius: BorderRadius.circular(999)),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              const LucideIconLite('crown', size: 16, color: ChInk.ctaForeground, strokeWidth: 2.4),
              const SizedBox(width: 8),
              Flexible(
                child: Text(label,
                    maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: ChInk.ctaForeground)),
              ),
            ]),
          ),
        ),
      );
}
