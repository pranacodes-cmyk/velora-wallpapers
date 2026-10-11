import 'dart:ui';

import 'package:flutter/material.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/services/haptics.dart';
import '../../core/theme/app_colors.dart';
import '../../widgets/lucide.dart';
import 'today_shared.dart';
import 'today_ink.dart';

/// 1:1 port of `src/components/companion/BibleCompanionCard.tsx`.
/// Tap a chip or type + send → opens the companion chat with the text pre-sent.
const _chipKeys = ['anxious', 'family', 'hope', 'forgiveness', 'lost'];

class BibleCompanionCard extends StatefulWidget {
  const BibleCompanionCard({super.key, required this.onAsk});

  /// Mirrors `navigate('/companion?q=…')`.
  final void Function(String question) onAsk;

  @override
  State<BibleCompanionCard> createState() => _BibleCompanionCardState();
}

class _BibleCompanionCardState extends State<BibleCompanionCard>
    with SingleTickerProviderStateMixin {
  final _controller = TextEditingController();
  late final AnimationController _pulse = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1800),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _controller.dispose();
    _pulse.dispose();
    super.dispose();
  }

  void _go(String text) {
    final q = text.trim();
    if (q.isEmpty) return;
    haptic(HapticStyle.medium);
    widget.onAsk(q);
  }

  @override
  Widget build(BuildContext context) {
    final chips = _chipKeys
        .map(
          (k) => (
            label: t('ov.companion.chip.$k.label'),
            text: t('ov.companion.chip.$k.text'),
          ),
        )
        .toList();

    return FadeRise(
      offsetY: 14,
      delay: const Duration(milliseconds: 150),
      duration: const Duration(milliseconds: 600),
      child: Padding(
        padding: const EdgeInsets.only(
          left: 16,
          right: 16,
          top: 28,
          bottom: 12,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Feature headline ────────────────────────────────────────────
            Padding(
              padding: const EdgeInsets.only(left: 4, right: 4, bottom: 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 3,
                    ),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(999),
                      color: TodayInk.primary.withValues(alpha: 0.12),
                      border: Border.all(
                        color: TodayInk.primary.withValues(alpha: 0.35),
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        RepaintBoundary(
                          child: FadeTransition(
                          opacity: Tween<double>(
                            begin: 1,
                            end: 0.35,
                          ).animate(_pulse),
                          child: Container(
                            width: 6,
                            height: 6,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: TodayInk.primary,
                              boxShadow: [
                                BoxShadow(
                                  color: TodayInk.primary,
                                  blurRadius: 8,
                                ),
                              ],
                            ),
                           ),
                          ),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          t('ov.companion.badge').toUpperCase(),
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 2.2,
                            color: TodayInk.primary,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    t('ov.companion.title1'),
                    style: TextStyle(
                      fontFamily: kSerif,
                      fontFamilyFallback: kSerifFallback,
                      fontSize: 26,
                      height: 1.05,
                      letterSpacing: -0.5,
                      fontWeight: FontWeight.w900,
                      color: AppColors.foreground,
                    ),
                  ),
                  ShaderMask(
                    blendMode: BlendMode.srcIn,
                    shaderCallback: (rect) => LinearGradient(
                      colors: [TodayInk.primary, hsl(42, 95, 65)],
                    ).createShader(rect),
                    child: Text(
                      t('ov.companion.title2'),
                      style: const TextStyle(
                        fontFamily: kSerif,
                        fontFamilyFallback: kSerifFallback,
                        fontSize: 26,
                        height: 1.05,
                        letterSpacing: -0.5,
                        fontWeight: FontWeight.w900,
                        color: Colors.white,
                      ),
                    ),
                  ),
                  const SizedBox(height: 6),
                  ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 300),
                    child: Text(
                      t('ov.companion.subtitle'),
                      style: TextStyle(
                        fontSize: 13,
                        height: 1.35,
                        color: AppColors.mutedForeground,
                      ),
                    ),
                  ),
                ],
              ),
            ),

            // ── Tile ────────────────────────────────────────────────────────
            Container(
              clipBehavior: Clip.antiAlias,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(26),
                border: Border.all(
                  color: AppColors.tileBorder,
                  width: 1.5,
                ),
                gradient: RadialGradient(
                  center: Alignment.topCenter,
                  radius: AppColors.isLight ? 1.4 : 1.3,
                  colors: AppColors.tileGradient,
                  stops: AppColors.tileGradientStops,
                ),
                boxShadow: AppColors.tileShadow,
              ),
              child: Stack(
                children: [
                  // Gold aura — top right
                  Positioned(
                    top: -80,
                    right: -48,
                    child: _Aura(
                       color: AppColors.tileAurora,
                      size: 208,
                      blur: 8,
                    ),
                  ),
                  // Royal-blue aura — bottom left
                  Positioned(
                    bottom: -96,
                    left: -56,
                    child: _Aura(
                      color: hsl(220, 80, 55, 0.28),
                      size: 208,
                      blur: 40,
                    ),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Title row
                      Row(
                        children: [
                          Container(
                            width: 36,
                            height: 36,
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: TodayInk.primary.withValues(
                                  alpha: 0.55,
                                ),
                              ),
                              gradient: RadialGradient(
                                center: const Alignment(-0.4, -0.6),
                                radius: 1.2,
                                colors: [
                                  TodayInk.primary.withValues(alpha: 0.20),
                                  AppColors.card,
                                ],
                                stops: const [0, 0.7],
                              ),
                              boxShadow: [
                                BoxShadow(
                                  color: TodayInk.primary.withValues(
                                    alpha: 0.22,
                                  ),
                                  blurRadius: 18,
                                  spreadRadius: -8,
                                  offset: const Offset(0, 6),
                                ),
                              ],
                            ),
                            child: LucideIcon(
                              'message-circle-heart',
                              size: 18,
                              color: TodayInk.primary,
                              strokeWidth: 2.2,
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Flexible(
                                      child: Text(
                                        t('ov.companion.cardTitle'),
                                        style: TextStyle(
                                          fontSize: 17,
                                          height: 1,
                                          fontWeight: FontWeight.w900,
                                          letterSpacing: -0.17,
                                          color: AppColors.foreground,
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 6),
                                    LucideIcon(
                                      'feather',
                                      size: 14,
                                      color: hsl(42, 95, 55),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  t('ov.companion.cardSubtitle'),
                                  style: TextStyle(
                                    fontSize: 11.5,
                                    height: 1.2,
                                    color: AppColors.foreground.withValues(
                                      alpha: 0.65,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),

                      // Chips
                      Wrap(
                        spacing: 6,
                        runSpacing: 6,
                        children: [
                          for (final c in chips)
                            TapScale(
                              scale: 0.95,
                              onTap: () => _go(c.text),
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 10,
                                  vertical: 6,
                                ),
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(999),
                                  color: TodayInk.primary.withValues(
                                    alpha: 0.14,
                                  ),
                                  border: Border.all(
                                    color: TodayInk.primary.withValues(
                                      alpha: 0.32,
                                    ),
                                  ),
                                ),
                                child: Text(
                                  c.label,
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w700,
                                    color: TodayInk.primary,
                                  ),
                                ),
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(height: 12),

                      // Input + send
                      ClipRRect(
                        borderRadius: BorderRadius.circular(18),
                        child: BackdropFilter(
                          filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
                          child: Container(
                            padding: const EdgeInsets.fromLTRB(14, 6, 6, 6),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(18),
                              color: AppColors.background.withValues(
                                alpha: 0.5,
                              ),
                              border: Border.all(
                                color: TodayInk.primary.withValues(
                                  alpha: 0.28,
                                ),
                              ),
                            ),
                            child: Row(
                              children: [
                                Expanded(
                                  child: TextField(
                                    controller: _controller,
                                    maxLength: 400,
                                    // No setState here: rebuilding this whole
                                    // card (blur + animations) on every keypress
                                    // is what made typing feel like the screen
                                    // jumped into another state.
                                    onSubmitted: _go,
                                    textInputAction: TextInputAction.send,
                                    style: TextStyle(
                                      fontSize: 14,
                                      color: AppColors.foreground,
                                    ),
                                    decoration: InputDecoration(
                                      isDense: true,
                                      counterText: '',
                                      border: InputBorder.none,
                                      contentPadding:
                                          const EdgeInsets.symmetric(
                                            vertical: 8,
                                          ),
                                      hintText: t(
                                        'ov.companion.inputPlaceholder',
                                      ),
                                      hintStyle: TextStyle(
                                        fontSize: 14,
                                        color: AppColors.foreground.withValues(
                                          alpha: 0.45,
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                ValueListenableBuilder<TextEditingValue>(
                                  valueListenable: _controller,
                                  builder: (_, value, child) => Opacity(
                                    opacity: value.text.trim().isEmpty
                                        ? 0.4
                                        : 1,
                                    child: child,
                                  ),
                                  child: TapScale(
                                    scale: 0.9,
                                    onTap: () => _go(_controller.text),
                                    child: Container(
                                      width: 36,
                                      height: 36,
                                      alignment: Alignment.center,
                                      decoration: BoxDecoration(
                                        borderRadius: BorderRadius.circular(14),
                                        gradient: LinearGradient(
                                          begin: Alignment.topLeft,
                                          end: Alignment.bottomRight,
                                          colors: [
                                            hsl(42, 95, 55),
                                            hsl(38, 100, 50),
                                          ],
                                        ),
                                        boxShadow: [
                                          BoxShadow(
                                            color: hsl(42, 90, 50, 0.55),
                                            blurRadius: 14,
                                            spreadRadius: -4,
                                            offset: const Offset(0, 6),
                                          ),
                                        ],
                                      ),
                                      child: Icon(
                                        Icons.send_rounded,
                                        size: 16,
                                        color: hsl(222, 55, 14),
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ],
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

class _Aura extends StatelessWidget {
  const _Aura({required this.color, required this.size, required this.blur});
  final Color color;
  final double size;
  final double blur;

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: ImageFiltered(
        imageFilter: ImageFilter.blur(sigmaX: blur, sigmaY: blur),
        child: Container(
          width: size,
          height: size,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: RadialGradient(
              colors: [color, color.withValues(alpha: 0)],
              stops: const [0, 0.7],
            ),
          ),
        ),
      ),
    );
  }
}
