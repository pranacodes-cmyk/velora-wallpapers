import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/services/bible_reader_service.dart';
import '../../core/services/challenge_data.dart';
import '../../core/services/haptics.dart';
import '../../core/theme/app_colors.dart';
import '../../widgets/lucide.dart';
import '../today/today_shared.dart' show kSerif, kSerifFallback;

/// Shared visuals for 75 Days of Light.
/// Web mirrors: `src/components/challenge/*`.

/* ── task glyphs ────────────────────────────────────────────────────────── */

/// Lucide glyph per daily task (web: `taskIcons.ts`).
const kTaskIcon = <String, String>{
  'read': 'book-open',
  'pray': 'hand-heart',
  'live': 'heart',
  'reflect': 'pen-line',
};

/* ── palette helpers ────────────────────────────────────────────────────── */

class ChInk {
  const ChInk._();
  static Color get gold => AppColors.premiumGold;
  static Color get goldGlow => AppColors.premiumGoldGlow;
  static const ctaForeground = Color(0xFF1B1408);
  static const amber200 = Color(0xFFFDE68A);
  static const amber100 = Color(0xFFFEF3C7);
  static const orange300 = Color(0xFFFDBA74);
  static const sky300 = Color(0xFF7DD3FC);

  static TextStyle serif(double size, {FontWeight weight = FontWeight.w600, Color? color, double height = 1.15, FontStyle? style}) =>
      TextStyle(
        fontFamily: kSerif,
        fontFamilyFallback: kSerifFallback,
        fontSize: size,
        fontWeight: weight,
        height: height,
        fontStyle: style,
        color: color ?? AppColors.foreground,
      );

  /// Uppercase eyebrow. Devanagari must not be letter-spaced.
  static TextStyle eyebrow(double size, Color color, {double tracking = 0.18}) => TextStyle(
        fontSize: size,
        fontWeight: FontWeight.w700,
        letterSpacing: L10n.current.lang == 'hi' ? 0 : size * tracking,
        color: color,
      );
}

String upper(String s) => L10n.current.lang == 'hi' ? s : s.toUpperCase();

/* ── buttons ────────────────────────────────────────────────────────────── */

class GoldButton extends StatelessWidget {
  const GoldButton({super.key, required this.label, this.icon, this.onTap, this.trailing, this.height = 52, this.fontSize = 15.5});
  final String label;
  final String? icon;
  final String? trailing;
  final VoidCallback? onTap;
  final double height;
  final double fontSize;

  @override
  Widget build(BuildContext context) {
    final enabled = onTap != null;
    return Semantics(
      button: true,
      enabled: enabled,
      label: label,
      child: Opacity(
        opacity: enabled ? 1 : 0.45,
        child: _Pressable(
          onTap: onTap,
          child: Container(
            height: height,
            width: double.infinity,
            alignment: Alignment.center,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            decoration: BoxDecoration(
              color: AppColors.primary,
              borderRadius: BorderRadius.circular(999),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (icon != null) ...[LucideIconLite(icon!, size: 18, color: AppColors.primaryForeground), const SizedBox(width: 8)],
                Flexible(
                  child: Text(label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(fontSize: fontSize, fontWeight: FontWeight.w800, color: AppColors.primaryForeground)),
                ),
                if (trailing != null) ...[const SizedBox(width: 6), LucideIconLite(trailing!, size: 20, color: AppColors.primaryForeground)],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class OutlineButton extends StatelessWidget {
  const OutlineButton({super.key, required this.label, this.icon, this.onTap, this.color, this.height = 48, this.borderColor});
  final String label;
  final String? icon;
  final VoidCallback? onTap;
  final Color? color;
  final Color? borderColor;
  final double height;

  @override
  Widget build(BuildContext context) {
    final c = color ?? AppColors.foreground;
    return Semantics(
      button: true,
      label: label,
      child: _Pressable(
        onTap: onTap,
        child: Container(
          height: height,
          alignment: Alignment.center,
          padding: const EdgeInsets.symmetric(horizontal: 14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: borderColor ?? AppColors.border),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (icon != null) ...[LucideIconLite(icon!, size: 16, color: c), const SizedBox(width: 7)],
              Flexible(
                child: Text(label,
                    maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700, color: c)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Pressable extends StatefulWidget {
  const _Pressable({required this.child, this.onTap});
  final Widget child;
  final VoidCallback? onTap;
  @override
  State<_Pressable> createState() => _PressableState();
}

class _PressableState extends State<_Pressable> {
  bool _down = false;
  @override
  Widget build(BuildContext context) => GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapDown: widget.onTap == null ? null : (_) => setState(() => _down = true),
        onTapCancel: () => setState(() => _down = false),
        onTapUp: (_) => setState(() => _down = false),
        onTap: widget.onTap,
        child: AnimatedScale(scale: _down ? 0.985 : 1, duration: const Duration(milliseconds: 110), child: widget.child),
      );
}

/// Press-and-hold commitment button: gold fill sweeps while held.
class HoldButton extends StatefulWidget {
  const HoldButton({super.key, required this.label, required this.holdingLabel, required this.onComplete, this.duration = const Duration(milliseconds: 1300), this.icon, this.disabled = false});
  final String label;
  final String holdingLabel;
  final VoidCallback onComplete;
  final Duration duration;
  final String? icon;
  final bool disabled;

  @override
  State<HoldButton> createState() => _HoldButtonState();
}

class _HoldButtonState extends State<HoldButton> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: widget.duration)
    ..addListener(_tick)
    ..addStatusListener((s) {
      if (s == AnimationStatus.completed && !_done) {
        _done = true;
        haptic(HapticStyle.heavy);
        widget.onComplete();
      }
    });
  bool _done = false;
  bool _holding = false;
  int _step = 0;

  void _tick() {
    final step = (_c.value * 5).floor();
    if (step > _step) {
      _step = step;
      haptic(HapticStyle.light);
    }
  }

  void _begin() {
    if (widget.disabled || _done) return;
    _step = 0;
    setState(() => _holding = true);
    haptic(HapticStyle.soft);
    _c.forward(from: 0);
  }

  void _stop() {
    if (_done) return;
    setState(() => _holding = false);
    _c.animateBack(0, duration: const Duration(milliseconds: 220), curve: Curves.easeOut);
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: widget.label,
      onTap: widget.disabled || _done
          ? null
          : () {
              _done = true;
              haptic(HapticStyle.heavy);
              widget.onComplete();
            },
      child: Opacity(
        opacity: widget.disabled ? 0.5 : 1,
        child: Listener(
          behavior: HitTestBehavior.opaque,
          onPointerDown: (_) => _begin(),
          onPointerUp: (_) => _stop(),
          onPointerCancel: (_) => _stop(),
          child: AnimatedBuilder(
            animation: _c,
            builder: (_, __) {
              final p = _c.value;
              final fg = p > 0.5 ? ChInk.ctaForeground : AppColors.foreground;
              return Container(
                height: 56,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(999),
                  color: AppColors.card,
                  border: Border.all(color: AppColors.primary.withValues(alpha: 0.4)),
                  boxShadow: [BoxShadow(color: AppColors.primary.withValues(alpha: 0.35), blurRadius: 28, spreadRadius: -14, offset: const Offset(0, 10))],
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(999),
                  child: Stack(
                    children: [
                      Positioned.fill(
                        child: FractionallySizedBox(
                          alignment: Alignment.centerLeft,
                          widthFactor: p,
                          child: DecoratedBox(decoration: BoxDecoration(gradient: LinearGradient(colors: [ChInk.gold, ChInk.goldGlow]))),
                        ),
                      ),
                      Center(
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              if (widget.icon != null) ...[LucideIconLite(widget.icon!, size: 20, color: fg), const SizedBox(width: 8)],
                              Flexible(
                                child: Text(
                                  _holding ? widget.holdingLabel : widget.label,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: fg),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}

class ChSwitch extends StatelessWidget {
  const ChSwitch({super.key, required this.on, required this.onToggle, required this.label});
  final bool on;
  final VoidCallback onToggle;
  final String label;

  @override
  Widget build(BuildContext context) => Semantics(
        toggled: on,
        label: label,
        child: GestureDetector(
          onTap: () {
            haptic(HapticStyle.light);
            onToggle();
          },
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 180),
            width: 48,
            height: 28,
            padding: const EdgeInsets.all(2),
            decoration: BoxDecoration(borderRadius: BorderRadius.circular(999), color: on ? AppColors.primary : AppColors.muted),
            alignment: on ? Alignment.centerRight : Alignment.centerLeft,
            child: Container(
              width: 24,
              height: 24,
              decoration: const BoxDecoration(shape: BoxShape.circle, color: Colors.white, boxShadow: [BoxShadow(color: Color(0x33000000), blurRadius: 3)]),
            ),
          ),
        ),
      );
}

/// Lucide icon with the challenge defaults.
class LucideIconLite extends StatelessWidget {
  const LucideIconLite(this.name, {super.key, this.size = 16, this.color, this.strokeWidth = 2});
  final String name;
  final double size;
  final Color? color;
  final double strokeWidth;
  @override
  Widget build(BuildContext context) => LucideIcon(name, size: size, color: color, strokeWidth: strokeWidth);
}

/* ── round header button + section label ────────────────────────────────── */

class RoundIconButton extends StatelessWidget {
  const RoundIconButton({super.key, required this.icon, required this.label, required this.onTap, this.dark = false});
  final String icon;
  final String label;
  final VoidCallback onTap;
  final bool dark;

  @override
  Widget build(BuildContext context) => Semantics(
        button: true,
        label: label,
        child: GestureDetector(
          onTap: onTap,
          child: Container(
            width: 40,
            height: 40,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: dark ? Colors.black.withValues(alpha: 0.3) : AppColors.card,
              border: dark ? null : Border.all(color: AppColors.border.withValues(alpha: 0.6)),
            ),
            child: LucideIconLite(icon, size: 20, color: dark ? Colors.white : AppColors.foreground),
          ),
        ),
      );
}

class SectionLabel extends StatelessWidget {
  const SectionLabel(this.text, {super.key, this.trailing});
  final String text;
  final Widget? trailing;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Row(
          children: [
            Expanded(child: Text(upper(text), style: ChInk.eyebrow(13, AppColors.mutedForeground, tracking: 0.16))),
            if (trailing != null) trailing!,
          ],
        ),
      );
}

/// Rounded card surface used across challenge screens.
BoxDecoration chCard({Color? border, double radius = 26, Color? color}) => BoxDecoration(
      color: color ?? AppColors.card,
      borderRadius: BorderRadius.circular(radius),
      border: Border.all(color: border ?? AppColors.border.withValues(alpha: 0.6)),
    );

/* ── journey surfaces ───────────────────────────────────────────────────── */

/// Journey type scale (web: `text-[28px] font-bold`, section `text-[19px]`).
class JourneyText {
  const JourneyText._();
  static TextStyle title() => TextStyle(
        fontSize: 28,
        fontWeight: FontWeight.w700,
        height: 1.15,
        letterSpacing: -0.56,
        color: AppColors.foreground,
      );
  static TextStyle section() =>
      TextStyle(fontSize: 19, fontWeight: FontWeight.w700, height: 1.2, color: AppColors.foreground);
}

/// Quiet card surface for the Journey hub.
BoxDecoration journeyCard({double radius = 18, Color? border, Color? color}) => BoxDecoration(
      color: color ?? AppColors.card,
      borderRadius: BorderRadius.circular(radius),
      border: Border.all(color: border ?? AppColors.border.withValues(alpha: 0.6)),
      boxShadow: [
        BoxShadow(
          color: AppColors.foreground.withValues(alpha: AppColors.isLight ? 0.05 : 0.10),
          blurRadius: 2,
          offset: const Offset(0, 1),
        ),
      ],
    );

/// Compact pill action: outline by default, solid primary when [filled].
class JourneyPillButton extends StatelessWidget {
  const JourneyPillButton({super.key, required this.label, this.icon, this.filled = false, this.onTap, this.height = 42});
  final String label;
  final String? icon;
  final bool filled;
  final VoidCallback? onTap;
  final double height;

  @override
  Widget build(BuildContext context) {
    final fg = filled ? AppColors.primaryForeground : AppColors.foreground;
    return Semantics(
      button: true,
      label: label,
      child: _Pressable(
        onTap: onTap,
        child: Container(
          height: height,
          padding: const EdgeInsets.symmetric(horizontal: 14),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: filled ? AppColors.primary : null,
            borderRadius: BorderRadius.circular(999),
            border: filled ? null : Border.all(color: AppColors.border),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (icon != null) ...[LucideIconLite(icon!, size: 16, color: fg), const SizedBox(width: 6)],
              Flexible(
                child: Text(label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 14, fontWeight: filled ? FontWeight.w800 : FontWeight.w700, color: fg)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Small round check used for daily steps (web: `h-7 w-7 rounded-full`).
class StepCheck extends StatelessWidget {
  const StepCheck({super.key, required this.done, this.size = 28});
  final bool done;
  final double size;

  @override
  Widget build(BuildContext context) => AnimatedContainer(
        duration: const Duration(milliseconds: 220),
        curve: Curves.easeOutBack,
        width: size,
        height: size,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: done ? AppColors.primary : Colors.transparent,
          border: done ? null : Border.all(color: AppColors.mutedForeground.withValues(alpha: 0.35), width: 2),
        ),
        child: done ? LucideIconLite('check', size: size * 0.57, color: AppColors.primaryForeground, strokeWidth: 3) : null,
      );
}

/* ── bottom sheet scaffold ──────────────────────────────────────────────── */

Future<T?> showChallengeSheet<T>(BuildContext context, {required String title, required String closeLabel, required WidgetBuilder builder}) {
  return showModalBottomSheet<T>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (sheet) => Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(sheet).viewInsets.bottom),
      child: Container(
        constraints: BoxConstraints(maxHeight: MediaQuery.of(sheet).size.height * 0.9),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
          border: Border(top: BorderSide(color: AppColors.border.withValues(alpha: 0.6))),
        ),
        child: SafeArea(
          top: false,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(height: 10),
              Container(width: 40, height: 4, decoration: BoxDecoration(color: AppColors.muted, borderRadius: BorderRadius.circular(2))),
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 14, 12, 6),
                child: Row(
                  children: [
                    Expanded(child: Text(title, style: ChInk.serif(21))),
                    TextButton(
                      onPressed: () => Navigator.of(sheet).pop(),
                      child: Text(closeLabel, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.primary)),
                    ),
                  ],
                ),
              ),
              Flexible(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(20, 6, 20, 20),
                  child: builder(sheet),
                ),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

/* ── reading helpers (offline Bible) ────────────────────────────────────── */

final Map<String, Future<ReaderEdition>> _editions = {};

Future<ReaderEdition> challengeEdition(String lang) =>
    _editions[lang] ??= BibleReaderService.edition(lang).catchError((Object e) {
      _editions.remove(lang);
      throw e;
    });

class ChapterText {
  const ChapterText(this.bookName, this.verses);
  final String bookName;
  final List<String> verses;
}

Future<String> readingLabel(String lang, ReadingRef ref) async {
  final e = await challengeEdition(lang);
  final i = bookFileIndex(lang, ref.book, e.books.map((b) => b.canonicalId).toList());
  if (i < 0 || i >= e.books.length) return '';
  return '${e.books[i].name} ${ref.chapter}';
}

Future<ChapterText> loadChapter(String lang, ReadingRef ref) async {
  final e = await challengeEdition(lang);
  final i = bookFileIndex(lang, ref.book, e.books.map((b) => b.canonicalId).toList());
  final chapters = await BibleReaderService.book(lang, i);
  final verses = ref.chapter - 1 < chapters.length ? chapters[ref.chapter - 1] : const <String>[];
  if (verses.isEmpty) throw StateError('empty chapter');
  return ChapterText(i < e.books.length ? e.books[i].name : '', verses);
}

/// "5h 12m" countdown to the next day.
String formatCountdown(Duration d) {
  final h = d.inHours;
  final m = d.inMinutes % 60;
  if (h <= 0) return t('ch.time.m', {'m': math.max(1, m)});
  return t('ch.time.hm', {'h': h, 'm': m});
}

/// Rebuilds every minute (countdowns).
class MinuteTicker extends StatefulWidget {
  const MinuteTicker({super.key, required this.builder});
  final WidgetBuilder builder;
  @override
  State<MinuteTicker> createState() => _MinuteTickerState();
}

class _MinuteTickerState extends State<MinuteTicker> {
  Timer? _t;
  @override
  void initState() {
    super.initState();
    _t = Timer.periodic(const Duration(seconds: 30), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _t?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.builder(context);
}
