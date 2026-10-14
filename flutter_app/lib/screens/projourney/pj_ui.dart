import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../challenge/challenge_widgets.dart';

/// Shared visuals for Pro Journeys.
/// Web mirrors: `.pj-*` utilities in `src/index.css` and the gold CTA classes
/// in `src/pages/ProJourney.tsx`.
class PjInk {
  const PjInk._();

  /// `--poster-ink` / `--poster-scrim` (theme-independent cover overlays).
  static const posterInk = Colors.white;
  static final posterScrim = HSLColor.fromAHSL(1, 222, 0.5, 0.08).toColor();
  static final voyageGold = HSLColor.fromAHSL(1, 42, 0.92, 0.58).toColor();

  static LinearGradient get goldGradient => LinearGradient(colors: [ChInk.gold, ChInk.goldGlow]);

  /// `.pj-scrim` — bottom-up darkening for text on cover art.
  static LinearGradient get coverScrim => LinearGradient(
        begin: Alignment.bottomCenter,
        end: Alignment.topCenter,
        colors: [posterScrim.withValues(alpha: 0.92), posterScrim.withValues(alpha: 0.55), posterScrim.withValues(alpha: 0)],
        stops: const [0, 0.42, 0.72],
      );

  /// `.pj-hero-fade` — cover dissolving into the page background.
  static LinearGradient get heroFade => LinearGradient(
        begin: Alignment.bottomCenter,
        end: Alignment.topCenter,
        colors: [
          AppColors.background,
          AppColors.background.withValues(alpha: 0.65),
          posterScrim.withValues(alpha: 0.25),
          posterScrim.withValues(alpha: 0),
        ],
        stops: const [0, 0.22, 0.55, 0.78],
      );

  /// `.pj-halo` — soft decorative glow without blur passes.
  static BoxDecoration get halo => BoxDecoration(
        shape: BoxShape.circle,
        gradient: RadialGradient(colors: [
          AppColors.primary.withValues(alpha: 0.2),
          AppColors.primary.withValues(alpha: 0.06),
          AppColors.primary.withValues(alpha: 0),
        ], stops: const [0, 0.45, 0.7]),
      );

  static TextStyle eyebrow([double size = 11, Color? color]) => ChInk.eyebrow(size, color ?? AppColors.primary, tracking: 0.16);
}

/// Card surface (`rounded-[22px] bg-card ring-1 ring-border/60`).
BoxDecoration pjCard({double radius = 22, Color? border, Color? color}) => BoxDecoration(
      color: color ?? AppColors.card,
      borderRadius: BorderRadius.circular(radius),
      border: Border.all(color: border ?? AppColors.border.withValues(alpha: 0.6)),
    );

/// Gold gradient call to action with the slow `pj-shine` sweep.
class PjGoldButton extends StatefulWidget {
  const PjGoldButton({super.key, required this.label, this.icon, this.trailing, this.onTap, this.shine = true, this.height = 52});
  final String label;
  final String? icon;
  final String? trailing;
  final VoidCallback? onTap;
  final bool shine;
  final double height;

  @override
  State<PjGoldButton> createState() => _PjGoldButtonState();
}

class _PjGoldButtonState extends State<PjGoldButton> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 2800));
  bool _down = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final reduce = MediaQuery.maybeOf(context)?.disableAnimations ?? false;
    if (widget.shine && !reduce) {
      if (!_c.isAnimating) _c.repeat();
    } else {
      _c.stop();
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    const fg = ChInk.ctaForeground;
    final enabled = widget.onTap != null;
    return Semantics(
      button: true,
      enabled: enabled,
      label: widget.label,
      excludeSemantics: true,
      child: GestureDetector(
        onTapDown: enabled ? (_) => setState(() => _down = true) : null,
        onTapCancel: () => setState(() => _down = false),
        onTapUp: (_) => setState(() => _down = false),
        onTap: widget.onTap,
        child: AnimatedScale(
          scale: _down ? 0.985 : 1,
          duration: const Duration(milliseconds: 110),
          child: Opacity(
            opacity: enabled ? 1 : 0.4,
            child: Container(
              height: widget.height,
              decoration: BoxDecoration(gradient: PjInk.goldGradient, borderRadius: BorderRadius.circular(999)),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(999),
                child: Stack(children: [
                  if (widget.shine)
                    Positioned.fill(
                      child: AnimatedBuilder(
                        animation: _c,
                        builder: (_, __) => FractionalTranslation(
                          translation: Offset(-1.2 + 2.4 * Curves.easeInOut.transform(_c.value), 0),
                          child: DecoratedBox(
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                begin: const Alignment(-1, -0.3),
                                end: const Alignment(1, 0.3),
                                colors: [Colors.white.withValues(alpha: 0), Colors.white.withValues(alpha: 0.35), Colors.white.withValues(alpha: 0)],
                                stops: const [0.3, 0.5, 0.7],
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  Center(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: Row(mainAxisSize: MainAxisSize.min, children: [
                        if (widget.icon != null) ...[LucideIconLite(widget.icon!, size: 16, color: fg, strokeWidth: 2.4), const SizedBox(width: 8)],
                        Flexible(
                          child: Text(widget.label,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontSize: 15.5, fontWeight: FontWeight.w800, color: fg)),
                        ),
                        if (widget.trailing != null) ...[const SizedBox(width: 6), LucideIconLite(widget.trailing!, size: 20, color: fg)],
                      ]),
                    ),
                  ),
                ]),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Small check badge (`challenge-pop` "Amen" / "Declared" pill).
class PjDonePill extends StatelessWidget {
  const PjDonePill(this.label, {super.key});
  final String label;
  @override
  Widget build(BuildContext context) => PjPop(
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(999)),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            LucideIconLite('check', size: 14, color: AppColors.primaryForeground, strokeWidth: 3),
            const SizedBox(width: 6),
            Text(label, style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: AppColors.primaryForeground)),
          ]),
        ),
      );
}

/// `challenge-pop` — scale-in with a little overshoot (skipped for reduced motion).
class PjPop extends StatelessWidget {
  const PjPop({super.key, required this.child, this.delay = Duration.zero});
  final Widget child;
  final Duration delay;
  @override
  Widget build(BuildContext context) {
    if (MediaQuery.maybeOf(context)?.disableAnimations ?? false) return child;
    final total = const Duration(milliseconds: 500) + delay;
    final start = delay.inMilliseconds / total.inMilliseconds;
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: total,
      curve: Interval(start, 1, curve: Curves.easeOutBack),
      builder: (_, v, c) => Opacity(opacity: v.clamp(0, 1), child: Transform.scale(scale: 0.6 + 0.4 * v, child: c)),
      child: child,
    );
  }
}

/// `challenge-rise` — fade up on first build (skipped for reduced motion).
class PjRise extends StatelessWidget {
  const PjRise({super.key, required this.child, this.delay = Duration.zero});
  final Widget child;
  final Duration delay;
  @override
  Widget build(BuildContext context) {
    if (MediaQuery.maybeOf(context)?.disableAnimations ?? false) return child;
    final total = const Duration(milliseconds: 550) + delay;
    final start = delay.inMilliseconds / total.inMilliseconds;
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: total,
      curve: Interval(start, 1, curve: const Cubic(0.2, 0.8, 0.2, 1)),
      builder: (_, v, c) => Opacity(opacity: v, child: Transform.translate(offset: Offset(0, 14 * (1 - v)), child: c)),
      child: child,
    );
  }
}

/// Rounded text field matching the web inputs.
class PjField extends StatelessWidget {
  const PjField({super.key, required this.controller, required this.hint, this.maxLength = 120, this.onChanged, this.onSubmitted, this.fontSize = 14.5});
  final TextEditingController controller;
  final String hint;
  final int maxLength;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;
  final double fontSize;

  @override
  Widget build(BuildContext context) {
    OutlineInputBorder border(Color c) =>
        OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: c));
    return TextField(
      controller: controller,
      maxLength: maxLength,
      onChanged: onChanged,
      onSubmitted: onSubmitted,
      textInputAction: onSubmitted != null ? TextInputAction.done : TextInputAction.next,
      style: TextStyle(fontSize: fontSize, color: AppColors.foreground),
      cursorColor: AppColors.primary,
      decoration: InputDecoration(
        isDense: true,
        counterText: '',
        hintText: hint,
        hintStyle: TextStyle(fontSize: fontSize, color: AppColors.mutedForeground.withValues(alpha: 0.7)),
        filled: true,
        fillColor: AppColors.background.withValues(alpha: 0.6),
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 13),
        enabledBorder: border(AppColors.border.withValues(alpha: 0.7)),
        focusedBorder: border(AppColors.primary.withValues(alpha: 0.6)),
      ),
    );
  }
}
