import 'package:flutter/material.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/theme/app_colors.dart';

/// Shared primitives for the Today screen port.
/// `hsl()` mirrors the CSS `hsl()` values used inline in `src/pages/Today.tsx`
/// so every colour is the exact same value as on web.
Color hsl(double h, double s, double l, [double a = 1]) =>
    HSLColor.fromAHSL(a, h, s / 100, l / 100).toColor();

/// `hsl(42 85% 52%)` — the Royal Gold locked across themes in the checklist.
final gold = hsl(42, 85, 52);

/// `hsl(222 60% 8%)` — ink used on gold fills.
final ink = hsl(222, 60, 8);

/// Serif stack used for scripture and headlines
/// (`'Georgia','Times New Roman',serif` on web).
const kSerif = 'Georgia';
const kSerifFallback = <String>['Times New Roman', 'serif'];

/// Section header: 3x14 gold bar + 11px 0.16em uppercase label.
class SectionLabel extends StatelessWidget {
  const SectionLabel(this.textKey, {super.key, this.literal});

  final String textKey;
  final String? literal;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 4, right: 4, bottom: 12),
      child: Row(
        children: [
          Container(
            width: 3,
            height: 14,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(999),
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  AppColors.primary,
                  AppColors.primary.withValues(alpha: 0.55),
                ],
              ),
              boxShadow: [
                BoxShadow(
                  color: AppColors.primary.withValues(alpha: 0.45),
                  blurRadius: 8,
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Text(
            literal ?? t(textKey),
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w800,
              letterSpacing: 11 * 0.16,
              color: AppColors.foreground.withValues(alpha: 0.8),
            ),
          ),
        ],
      ),
    );
  }
}

/// Scales down + fades a tap target, matching framer-motion `whileTap`.
class TapScale extends StatefulWidget {
  const TapScale({
    super.key,
    required this.child,
    required this.onTap,
    this.scale = 0.98,
  });

  final Widget child;
  final VoidCallback onTap;
  final double scale;

  @override
  State<TapScale> createState() => _TapScaleState();
}

class _TapScaleState extends State<TapScale> {
  bool _down = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: (_) => setState(() => _down = true),
      onTapCancel: () => setState(() => _down = false),
      onTapUp: (_) => setState(() => _down = false),
      onTap: widget.onTap,
      child: AnimatedScale(
        scale: _down ? widget.scale : 1,
        duration: const Duration(milliseconds: 110),
        curve: Curves.easeOut,
        child: widget.child,
      ),
    );
  }
}

/// Fade + rise entrance used everywhere on Today
/// (`initial={{opacity:0,y:N}} animate={{opacity:1,y:0}}`).
class FadeRise extends StatefulWidget {
  const FadeRise({
    super.key,
    required this.child,
    this.offsetY = 8,
    this.delay = Duration.zero,
    this.duration = const Duration(milliseconds: 500),
  });

  final Widget child;
  final double offsetY;
  final Duration delay;
  final Duration duration;

  @override
  State<FadeRise> createState() => _FadeRiseState();
}

class _FadeRiseState extends State<FadeRise> {
  bool _in = false;

  @override
  void initState() {
    super.initState();
    Future.delayed(widget.delay, () {
      if (mounted) setState(() => _in = true);
    });
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedSlide(
      offset: _in ? Offset.zero : Offset(0, widget.offsetY / 100),
      duration: widget.duration,
      curve: Curves.easeOutCubic,
      child: AnimatedOpacity(
        opacity: _in ? 1 : 0,
        duration: widget.duration,
        curve: Curves.easeOut,
        child: widget.child,
      ),
    );
  }
}

/// Month / weekday labels — same localized keys as web `monthLabel/dayLabel`.
String monthLabel(int monthIndexZeroBased) =>
    t('today.month.$monthIndexZeroBased');

/// Web uses `Date.getDay()` (0 = Sunday); Dart's `weekday` is 1 = Monday.
String dayLabel(DateTime date) => t('today.day.${date.weekday % 7}');

String twoDigits(int n) => n.toString().padLeft(2, '0');
