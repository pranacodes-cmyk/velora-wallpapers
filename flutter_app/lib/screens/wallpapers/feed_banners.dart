import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/services/analytics.dart';
import '../../core/services/content_data.dart';
import '../../core/services/haptics.dart';
import '../../core/services/prefs.dart';
import '../../core/services/share_service.dart';
import '../../core/theme/app_colors.dart';
import '../../widgets/lucide.dart';
import '../daily_verse/daily_verse_screen.dart';
import '../today/today_shared.dart';

/// 1:1 port of `src/components/NewTodayBanner.tsx` — deterministic daily count,
/// same `velora.banner.dismissed.<Y-M-D>` key, 8s auto-dismiss, same fade/slide.
class NewTodayBanner extends StatefulWidget {
  const NewTodayBanner({super.key});

  @override
  State<NewTodayBanner> createState() => _NewTodayBannerState();
}

class _NewTodayBannerState extends State<NewTodayBanner> {
  bool _visible = false;
  Timer? _timer;

  static int _todayCount() {
    final now = DateTime.now();
    final seed = now.year * 10000 + now.month * 100 + now.day;
    return (seed % 12) + 3;
  }

  static String _todayKey() {
    final now = DateTime.now();
    return 'velora.banner.dismissed.${now.year}-${now.month}-${now.day}';
  }

  @override
  void initState() {
    super.initState();
    final dismissed = Prefs.getString(_todayKey()) == '1';
    if (dismissed) return;
    _visible = true;
    _timer = Timer(const Duration(seconds: 8), _dismiss);
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _dismiss() {
    if (!mounted) return;
    setState(() => _visible = false);
    Prefs.setString(_todayKey(), '1');
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedSwitcher(
      visible: _visible,
      child: Padding(
        padding: const EdgeInsets.only(left: 12, right: 12, bottom: 12),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [AppColors.glassRaised, AppColors.card],
            ),
            border: Border.all(color: AppColors.primary.withValues(alpha: 0.1)),
          ),
          child: Row(
            children: [
              Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: AppColors.primary.withValues(alpha: 0.12),
                ),
                child: Center(
                  child: LucideIcon(
                    'flame',
                    size: 14,
                    strokeWidth: 2.2,
                    color: AppColors.primary,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      t('ov.banner.count', {'count': _todayCount()}),
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        height: 1.15,
                        color: AppColors.foreground.withValues(alpha: 0.8),
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      t('ov.banner.subtitle'),
                      style: TextStyle(
                        fontSize: 9,
                        fontWeight: FontWeight.w500,
                        color: AppColors.mutedForeground.withValues(alpha: 0.6),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(999),
                  color: AppColors.primary.withValues(alpha: 0.1),
                ),
                child: Text(
                  t('ov.banner.new').toUpperCase(),
                  style: TextStyle(
                    fontSize: 8,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.96,
                    color: AppColors.primary,
                  ),
                ),
              ),
              const SizedBox(width: 2),
              Semantics(
                label: t('ov.banner.dismissAria'),
                button: true,
                child: InkWell(
                  onTap: _dismiss,
                  borderRadius: BorderRadius.circular(999),
                  child: SizedBox(
                    width: 24,
                    height: 24,
                    child: Center(
                      child: LucideIcon(
                        'x',
                        size: 14,
                        color: AppColors.foreground.withValues(alpha: 0.55),
                      ),
                    ),
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

/// Mirrors framer-motion's `AnimatePresence` height/opacity collapse.
class AnimatedSwitcher extends StatelessWidget {
  const AnimatedSwitcher({
    super.key,
    required this.visible,
    required this.child,
  });

  final bool visible;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return AnimatedSize(
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeOut,
      alignment: Alignment.topCenter,
      child: AnimatedOpacity(
        duration: const Duration(milliseconds: 300),
        opacity: visible ? 1 : 0,
        child: visible ? child : const SizedBox(width: double.infinity),
      ),
    );
  }
}

/// 1:1 port of `src/components/DailyVerseCard.tsx` — hero crop with the golden
/// ease-out fade, auto-changing pill, verse block, date column, share pill and
/// the stacked gold "Set Wallpaper" CTA.
class DailyVerseCard extends StatefulWidget {
  const DailyVerseCard({super.key});

  @override
  State<DailyVerseCard> createState() => _DailyVerseCardState();
}

class _DailyVerseCardState extends State<DailyVerseCard> {
  static const _months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];

  double _scale = 1;

  Future<void> _shareApp() async {
    final verse = ContentData.verseForDate();
    haptic(HapticStyle.soft);
    Analytics.capture('daily_verse_card_share_tapped', {
      'surface': 'today_home',
    });
    await ShareService.share(
      text: t('ov.card.shareText', {
        'text': verse.text,
        'ref': verse.reference,
      }),
      dialogTitle: t('ov.card.shareDialogTitle'),
    );
  }

  void _open() {
    final verse = ContentData.verseForDate();
    Analytics.capture('daily_verse_card_clicked', {
      'surface': 'today_home',
      'reference': verse.reference,
    });
    Navigator.of(
      context,
    ).push(MaterialPageRoute(builder: (_) => const DailyVerseScreen()));
  }

  @override
  Widget build(BuildContext context) {
    final verse = ContentData.verseForDate();
    final today = DateTime.now();
    final dateLabel = '${_months[today.month - 1]} ${today.day}';

    return Padding(
      padding: const EdgeInsets.only(left: 12, right: 12, bottom: 12),
      child: GestureDetector(
        onTap: _open,
        onTapDown: (_) => setState(() => _scale = 0.985),
        onTapUp: (_) => setState(() => _scale = 1),
        onTapCancel: () => setState(() => _scale = 1),
        child: AnimatedScale(
          scale: _scale,
          duration: const Duration(milliseconds: 120),
          child: Container(
            decoration: BoxDecoration(
              color: AppColors.card,
              borderRadius: BorderRadius.circular(24),
              border: Border.all(
                color: hsl(42, 70, 55).withValues(alpha: 0.28),
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.55),
                  blurRadius: 48,
                  spreadRadius: -18,
                  offset: const Offset(0, 22),
                ),
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.35),
                  blurRadius: 18,
                  spreadRadius: -8,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            clipBehavior: Clip.antiAlias,
            child: Stack(
              children: [
                // Hero photo lane — 40% width with the long golden fade.
                LayoutBuilder(
                  builder: (context, constraints) {
                    final laneWidth = constraints.maxWidth * 0.40;
                    // Keep the banner at the same stable proportions as the
                    // web card. IntrinsicHeight was occasionally resolving
                    // from the narrow text column during web/mobile layout,
                    // collapsing the tree crop into a thin half-height strip.
                    final cardHeight = (constraints.maxWidth / 2.48).clamp(
                      150.0,
                      166.0,
                    );
                    return Stack(
                      children: [
                        Positioned(
                          left: 0,
                          top: 0,
                          bottom: 0,
                          width: laneWidth,
                          child: Stack(
                            fit: StackFit.expand,
                            children: [
                              Image.asset(
                                'assets/images/daily-verse-tree-card.webp',
                                fit: BoxFit.cover,
                                alignment: const Alignment(-0.36, 0),
                              ),
                              DecoratedBox(
                                decoration: BoxDecoration(
                                  gradient: RadialGradient(
                                    center: const Alignment(-0.5, 0),
                                    radius: 1.2,
                                    colors: [
                                      hsl(42, 90, 55).withValues(alpha: 0.10),
                                      Colors.transparent,
                                    ],
                                    stops: const [0, 0.65],
                                  ),
                                ),
                              ),
                              Align(
                                alignment: Alignment.centerRight,
                                child: FractionallySizedBox(
                                  widthFactor: 0.78,
                                  child: DecoratedBox(
                                    decoration: BoxDecoration(
                                      gradient: LinearGradient(
                                        colors: [
                                          AppColors.card.withValues(alpha: 0),
                                          AppColors.card.withValues(
                                            alpha: 0.06,
                                          ),
                                          AppColors.card.withValues(
                                            alpha: 0.20,
                                          ),
                                          AppColors.card.withValues(
                                            alpha: 0.42,
                                          ),
                                          AppColors.card.withValues(
                                            alpha: 0.68,
                                          ),
                                          AppColors.card.withValues(
                                            alpha: 0.88,
                                          ),
                                          AppColors.card,
                                        ],
                                        stops: const [
                                          0,
                                          0.18,
                                          0.34,
                                          0.50,
                                          0.66,
                                          0.82,
                                          1,
                                        ],
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        // Top sheen hairlines.
                        Positioned(
                          left: 0,
                          right: 0,
                          top: 0,
                          height: 1,
                          child: DecoratedBox(
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                colors: [
                                  Colors.transparent,
                                  hsl(42, 90, 70).withValues(alpha: 0.55),
                                  Colors.transparent,
                                ],
                              ),
                            ),
                          ),
                        ),
                        SizedBox(
                          height: cardHeight,
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              SizedBox(width: constraints.maxWidth * 0.32),
                              Expanded(child: _middle(verse)),
                              _right(dateLabel),
                            ],
                          ),
                        ),
                      ],
                    );
                  },
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _middle(DailyVerse verse) {
    return Padding(
      padding: const EdgeInsets.only(left: 8, right: 6, top: 10, bottom: 10),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(999),
              color: AppColors.primary.withValues(alpha: 0.14),
              border: Border.all(
                color: AppColors.primary.withValues(alpha: 0.32),
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                LucideIcon('sun', size: 8, color: AppColors.primary),
                const SizedBox(width: 4),
                Text(
                  t('ov.card.autoChanging').toUpperCase(),
                  style: TextStyle(
                    fontSize: 7,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.91,
                    height: 1,
                    color: AppColors.primary,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 4),
          Text(
            t('ov.card.title'),
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w800,
              height: 1.1,
              letterSpacing: -0.2,
              color: AppColors.foreground,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            t('ov.card.desc'),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 8.5,
              fontWeight: FontWeight.w600,
              height: 1.32,
              color: AppColors.foreground.withValues(alpha: 0.8),
            ),
          ),
          const SizedBox(height: 4),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(10),
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  AppColors.muted.withValues(alpha: 0.6),
                  AppColors.muted.withValues(alpha: 0.35),
                ],
              ),
              border: Border.all(
                color: AppColors.primary.withValues(alpha: 0.28),
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.3),
                  blurRadius: 8,
                  spreadRadius: -4,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                RichText(
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  text: TextSpan(
                    children: [
                      TextSpan(
                        text: '“',
                        style: TextStyle(
                          fontSize: 10.5,
                          height: 1,
                          fontWeight: FontWeight.w700,
                          color: AppColors.primary,
                        ),
                      ),
                      TextSpan(
                        text: verse.text,
                        style: TextStyle(
                          fontSize: 8.5,
                          fontWeight: FontWeight.w600,
                          height: 1.32,
                          color: AppColors.foreground,
                        ),
                      ),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.only(left: 10, top: 2),
                  child: Text(
                    '— ${verse.reference}',
                    style: TextStyle(
                      fontSize: 7.5,
                      fontWeight: FontWeight.w700,
                      color: AppColors.primary,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _right(String dateLabel) {
    return SizedBox(
      width: 74,
      child: Stack(
        children: [
          Positioned(
            left: 0,
            top: 10,
            bottom: 10,
            width: 1,
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Colors.transparent,
                    hsl(42, 70, 55).withValues(alpha: 0.45),
                    hsl(42, 70, 55).withValues(alpha: 0.45),
                    Colors.transparent,
                  ],
                  stops: const [0, 0.3, 0.7, 1],
                ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 10),
            child: Column(
              children: [
                Text(
                  t('ov.card.today'),
                  style: TextStyle(
                    fontSize: 8.5,
                    height: 1,
                    fontWeight: FontWeight.w500,
                    letterSpacing: 0.3,
                    color: AppColors.mutedForeground,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  dateLabel,
                  style: TextStyle(
                    fontSize: 11,
                    height: 1,
                    fontWeight: FontWeight.w800,
                    color: AppColors.primary,
                    shadows: [
                      Shadow(
                        color: hsl(42, 88, 55).withValues(alpha: 0.45),
                        blurRadius: 12,
                      ),
                    ],
                  ),
                ),
                const Spacer(),
                Semantics(
                  label: t('ov.card.shareAria'),
                  button: true,
                  child: GestureDetector(
                    onTap: _shareApp,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 5,
                      ),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(999),
                        gradient: LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [
                            hsl(42, 90, 55).withValues(alpha: 0.18),
                            hsl(42, 90, 55).withValues(alpha: 0.08),
                          ],
                        ),
                        border: Border.all(
                          color: hsl(42, 88, 55).withValues(alpha: 0.55),
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: hsl(42, 88, 46).withValues(alpha: 0.45),
                            blurRadius: 10,
                            spreadRadius: -4,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          LucideIcon(
                            'share-2', // matches web Share2 outline
                            size: 10,
                            color: AppColors.primary,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            t('ov.card.shareLabel').toUpperCase(),
                            style: TextStyle(
                              fontSize: 7.5,
                              height: 1,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.75,
                              color: AppColors.primary,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                const Spacer(),
                Container(
                  width: 58,
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(10),
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [
                        hsl(42, 95, 62),
                        hsl(42, 88, 50),
                        hsl(38, 85, 45),
                      ],
                      stops: const [0, 0.5, 1],
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: hsl(42, 88, 46).withValues(alpha: 0.45),
                        blurRadius: 10,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Column(
                    children: [
                      LucideIcon('smartphone', size: 10, color: Colors.black),
                      const SizedBox(height: 2),
                      Text(
                        t('ov.card.setLabel').toUpperCase(),
                        style: const TextStyle(
                          fontSize: 6.5,
                          height: 1,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.52,
                          color: Colors.black87,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        t('ov.card.wallpaper'),
                        style: const TextStyle(
                          fontSize: 7.5,
                          height: 1.15,
                          fontWeight: FontWeight.w800,
                          letterSpacing: -0.1,
                          color: Colors.black,
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
    );
  }
}
