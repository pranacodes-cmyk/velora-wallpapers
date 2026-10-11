import 'package:flutter/material.dart';

import '../core/localization/app_localizations.dart';
import '../core/services/personal_cross.dart';
import '../screens/today/today_shared.dart';

/// 1:1 port of `EngravedOverlay` in `src/components/PersonalizeCrossSheet.tsx`.
/// Same element order (verse first, then "JESUS LOVES" label, then the name),
/// same font sizes per length bucket, same colors, shadows and placeholder
/// dimming — the rail card and the full preview share this exact widget just
/// like the web app shares the component.
class EngravedOverlay extends StatelessWidget {
  const EngravedOverlay({
    super.key,
    required this.name,
    required this.verse,
    this.compact = false,
  });

  final String name;
  final PersonalVerse verse;
  final bool compact;

  static const _serif = 'Georgia';
  static const _serifFallback = <String>['Times New Roman', 'serif'];

  @override
  Widget build(BuildContext context) {
    final trimmed = name.trim();
    final displayName = trimmed.isEmpty ? t('px.yourNamePlaceholder') : trimmed;
    final isPlaceholder = trimmed.isEmpty;

    final verseSize = compact ? 10.0 : 11.0;
    final labelSize = compact ? 7.5 : 8.0;
    final nameSize = compact
        ? (displayName.length > 14
              ? 15.5
              : displayName.length > 9
              ? 17.5
              : 20.0)
        : (displayName.length > 14
              ? 17.5
              : displayName.length > 9
              ? 20.0
              : 22.0);


    return Positioned(
      left: 0,
      right: 0,
      bottom: 0,
      child: IgnorePointer(
        child: Padding(
          padding: EdgeInsets.only(
            left: 16,
            right: 16,
            bottom: compact ? 16 : 24,
          ),
          child: LayoutBuilder(
            builder: (context, c) {
              final maxW = c.maxWidth * (compact ? 0.88 : 0.82);
              return Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  // Verse block first.
                  SizedBox(
                    width: maxW,
                    child: Text(
                      '"${verse.text}"',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontFamily: _serif,
                        fontFamilyFallback: _serifFallback,
                        fontStyle: FontStyle.italic,
                        fontWeight: FontWeight.w500,
                        fontSize: verseSize,
                        height: 1.4,
                        color: hsl(
                          38,
                          60,
                          99,
                        ).withValues(alpha: isPlaceholder ? 0.7 : 1),
                        shadows: const [
                          Shadow(
                            color: Color(0xF2000000),
                            offset: Offset(0, 2),
                            blurRadius: 6,
                          ),
                          Shadow(color: Color(0xCC000000), blurRadius: 12),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 10),
                  // "Jesus loves ___" — the signature line under the verse.
                  SizedBox(
                    width: maxW,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          t('px.jesusLoves').toUpperCase(),
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: labelSize,
                            fontWeight: FontWeight.w800,
                            letterSpacing: labelSize * 0.32,
                            color: hsl(
                              42,
                              96,
                              70,
                            ).withValues(alpha: isPlaceholder ? 0.75 : 1),
                            shadows: [
                              const Shadow(
                                color: Color(0xF2000000),
                                offset: Offset(0, 1),
                                blurRadius: 3,
                              ),
                              Shadow(
                                color: hsl(42, 90, 45).withValues(alpha: 0.55),
                                blurRadius: 10,
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          displayName,
                          textAlign: TextAlign.center,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontFamily: _serif,
                            fontFamilyFallback: _serifFallback,
                            fontWeight: FontWeight.w700,
                            fontStyle: FontStyle.italic,
                            fontSize: nameSize,
                            height: 1,
                            letterSpacing: nameSize * 0.02,
                            color: hsl(
                              38,
                              55,
                              97,
                            ).withValues(alpha: isPlaceholder ? 0.7 : 1),
                            shadows: [
                              const Shadow(
                                color: Color(0xF2000000),
                                offset: Offset(0, 2),
                                blurRadius: 5,
                              ),
                              Shadow(
                                color: hsl(42, 90, 45).withValues(alpha: 0.55),
                                blurRadius: 16,
                              ),
                              const Shadow(
                                color: Color(0xB3000000),
                                blurRadius: 26,
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              );
            },
          ),
        ),
      ),
    );
  }
}
