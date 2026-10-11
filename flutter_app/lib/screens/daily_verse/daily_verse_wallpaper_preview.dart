import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../core/services/content_data.dart';
import '../today/today_shared.dart';
import '../../core/widgets/color_boost.dart';
import '../../widgets/lucide_cross.dart';

/// Composited preview of the auto-generated daily-verse lockscreen wallpaper.
/// 1:1 visual port of the canvas drawing in `src/hooks/useVerseWallpaper.ts`
/// (bg photo + dark readability gradient + gold cross + date row + verse +
/// reference + "PRAYLY" brand footer), rendered with widgets instead of a
/// canvas so it composes naturally inside Flutter's layout system.
class DailyVerseWallpaperPreview extends StatelessWidget {
  const DailyVerseWallpaperPreview({
    super.key,
    required this.verse,
    required this.backgroundUrl,
  });

  final DailyVerse verse;
  final String? backgroundUrl;

  static const _gold = Color(0xFFF5CC6E);

  @override
  Widget build(BuildContext context) {
    return AspectRatio(
      aspectRatio: 9 / 16,
      child: Stack(
        fit: StackFit.expand,
        children: [
          if (backgroundUrl != null)
            ColorBoost(
              preset: ColorBoostPreset.still,
              child: CachedNetworkImage(
                imageUrl: backgroundUrl!,
                fit: BoxFit.cover,
                memCacheWidth: 600,
                fadeInDuration: Duration.zero,
                errorWidget: (_, _, _) =>
                    Container(color: const Color(0xFF070B18)),
                placeholder: (_, _) =>
                    Container(color: const Color(0xFF070B18)),
              ),
            )
          else
            Container(
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Color(0xFF070B18),
                    Color(0xFF14213F),
                    Color(0xFF090611),
                  ],
                  stops: [0, 0.45, 1],
                ),
              ),
            ),

          // Readability gradient — mirrors the multi-stop canvas overlay.
          DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  Colors.black.withValues(alpha: 0.18),
                  Colors.black.withValues(alpha: 0.28),
                  Colors.black.withValues(alpha: 0.55),
                  Colors.black.withValues(alpha: 0.62),
                  Colors.black.withValues(alpha: 0.55),
                  Colors.black.withValues(alpha: 0.40),
                  Colors.black.withValues(alpha: 0.55),
                ],
                stops: const [0, 0.20, 0.38, 0.55, 0.72, 0.88, 1],
              ),
            ),
          ),

          LayoutBuilder(
            builder: (context, c) {
              return Padding(
                padding: EdgeInsets.symmetric(horizontal: c.maxWidth * 0.08),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    // Gold cross
                    // Same soft gold glow the web mock applies to the cross.
                    DecoratedBox(
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                            color: _gold.withValues(alpha: 0.35),
                            blurRadius: 14,
                          ),
                        ],
                      ),
                      child: LucideCross(
                        color: _gold,
                        size: c.maxWidth * 0.16,
                        strokeWidth: 2.4,
                      ),
                    ),
                    SizedBox(height: c.maxHeight * 0.02),

                    // Date row with flanking hairlines
                    Row(
                      children: [
                        Expanded(child: _hairline()),
                        const SizedBox(width: 6),
                        Flexible(
                          flex: 5,
                          child: FittedBox(
                            fit: BoxFit.scaleDown,
                            child: Text(
                              _dateLabel(),
                              maxLines: 1,
                              style: TextStyle(
                                fontFamily: kSerif,
                                fontFamilyFallback: kSerifFallback,
                                fontWeight: FontWeight.bold,
                                color: _gold,
                                fontSize: 9,
                                letterSpacing: 2.2,
                                shadows: const [
                                  Shadow(color: Colors.black87, blurRadius: 4),
                                ],
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 6),
                        Expanded(child: _hairline()),
                      ],
                    ),
                    SizedBox(height: c.maxHeight * 0.035),

                    // Verse
                    Text(
                      '"${verse.text}"',
                      textAlign: TextAlign.center,
                      maxLines: 6,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontFamily: kSerif,
                        fontFamilyFallback: kSerifFallback,
                        fontStyle: FontStyle.italic,
                        fontWeight: FontWeight.w600,
                        color: Colors.white,
                        fontSize: c.maxWidth * 0.062,
                        height: 1.45,
                        shadows: const [
                          Shadow(
                            color: Colors.black87,
                            blurRadius: 10,
                            offset: Offset(0, 2),
                          ),
                        ],
                      ),
                    ),
                    SizedBox(height: c.maxHeight * 0.02),
                    Text(
                      '— ${verse.reference.toUpperCase()}',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontFamily: kSerif,
                        fontFamilyFallback: kSerifFallback,
                        fontWeight: FontWeight.bold,
                        color: _gold,
                        fontSize: c.maxWidth * 0.028,
                        letterSpacing: 1.5,
                        shadows: const [
                          Shadow(color: Colors.black54, blurRadius: 5),
                        ],
                      ),
                    ),
                  ],
                ),
              );
            },
          ),

          // Brand footer
          Positioned(
            left: 0,
            right: 0,
            bottom: 24,
            child: Column(
              children: [
                Container(
                  width: 26,
                  height: 26,
                  alignment: Alignment.center,
                  child: LucideCross(color: _gold, size: 14, strokeWidth: 2.4),
                ),
                Text(
                  'PRAYLY',
                  style: TextStyle(
                    fontFamily: kSerif,
                    fontFamilyFallback: kSerifFallback,
                    fontWeight: FontWeight.bold,
                    color: _gold,
                    fontSize: 11,
                    letterSpacing: 3,
                    shadows: const [
                      Shadow(color: Colors.black87, blurRadius: 6),
                    ],
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  'BIBLE PRAYER & VERSE',
                  style: TextStyle(
                    fontFamily: kSerif,
                    fontFamilyFallback: kSerifFallback,
                    fontWeight: FontWeight.w500,
                    color: Colors.white.withValues(alpha: 0.78),
                    fontSize: 6.5,
                    letterSpacing: 1.5,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _hairline() =>
      Container(height: 1, color: _gold.withValues(alpha: 0.55));

  static const _months = [
    'JANUARY',
    'FEBRUARY',
    'MARCH',
    'APRIL',
    'MAY',
    'JUNE',
    'JULY',
    'AUGUST',
    'SEPTEMBER',
    'OCTOBER',
    'NOVEMBER',
    'DECEMBER',
  ];

  String _dateLabel() {
    final now = DateTime.now();
    return '${_months[now.month - 1]} ${now.day} \u00b7 ${now.year}';
  }
}
