import 'package:flutter/material.dart';
import 'pray_screen_screen.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/services/pray_screen_service.dart';
import '../../core/theme/app_colors.dart';
import '../../state/app_providers.dart';
import '../../widgets/lucide.dart';
import '../../widgets/lucide_cross.dart';
import '../today/today_ink.dart';
import '../today/today_shared.dart';

class PrayScreenCard extends ConsumerWidget {
  const PrayScreenCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selected = PrayScreenService.selectedPackages.length;
    final active = PrayScreenService.enabled;
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 0, 12, 16),
      child: TapScale(
        onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const PrayScreenScreen())),
        child: Container(
          clipBehavior: Clip.antiAlias,
          decoration: BoxDecoration(
            // Clean surface + royal-blue frame — no gold wash behind the card
            // (matches `--tile-grad-soft` on web).
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [AppColors.glassRaised, AppColors.glassSoft],
            ),
            borderRadius: BorderRadius.circular(22),
            border: Border.all(
              color: const Color(0xFF23386B).withValues(alpha: 0.38),
              width: 1.4,
            ),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF16233F).withValues(alpha: 0.3),
                blurRadius: 26,
                spreadRadius: -16,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // thin royal-blue crest line across the top
              Container(
                height: 2.5,
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      Color(0x0023386B),
                      Color(0x8C23386B),
                      Color(0x0023386B),
                    ],
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 14, 14, 0),
                child: Row(
                  children: [
                    Text(
                      'PRAYSCREEN',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 1.6,
                        color: TodayInk.primary.withValues(alpha: 0.72),
                      ),
                    ),
                    const Spacer(),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3.5),
                      decoration: BoxDecoration(
                        color: TodayInk.accent.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(99),
                        border: Border.all(
                          color: TodayInk.accent.withValues(alpha: 0.28),
                        ),
                      ),
                      child: Text(
                        '★ STAR FEATURE',
                        style: TextStyle(
                          fontSize: 8,
                          letterSpacing: 0.6,
                          fontWeight: FontWeight.w900,
                          color: TodayInk.accent,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 14, 14),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // solid ink medallion with a royal-gold cross + halo
                    // (web: src/components/prayscreen/PrayScreenFeatureCard.tsx)
                    Container(
                      width: 52,
                      height: 52,
                      decoration: BoxDecoration(
                        // light: deep royal blue fill · dark: AMOLED black
                        color: AppColors.isLight
                            ? const Color(0xFF16264A)
                            : const Color(0xFF050505),
                        borderRadius: BorderRadius.circular(16),
                        boxShadow: [
                          BoxShadow(
                            color: const Color(0xFF0B1220).withValues(alpha: 0.55),
                            blurRadius: 16,
                            spreadRadius: -6,
                            offset: const Offset(0, 6),
                          ),
                        ],
                      ),
                      child: Stack(
                        alignment: Alignment.center,
                        children: [
                          // soft gold halo
                          Container(
                            margin: const EdgeInsets.all(5),
                            decoration: const BoxDecoration(
                              shape: BoxShape.circle,
                              gradient: RadialGradient(
                                colors: [
                                  Color(0x4DF2C13D),
                                  Color(0x00F2C13D),
                                ],
                                stops: [0.0, 0.72],
                              ),
                            ),
                          ),
                          // thin gold ring
                          Container(
                            margin: const EdgeInsets.all(4),
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              border: Border.all(
                                color: const Color(0xFFF2C13D).withValues(alpha: 0.30),
                              ),
                            ),
                          ),
                          const LucideCross(
                            size: 25,
                            color: Color(0xFFF7C948),
                            strokeWidth: 2.2,
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(width: 14),
                    Expanded(
                      child: Text(
                        'Pause the scroll. Choose God first.',
                        style: TextStyle(
                          fontSize: 16.5,
                          height: 1.25,
                          letterSpacing: 0,
                          fontWeight: FontWeight.w900,
                          color: AppColors.foreground,
                        ),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.only(top: 14, left: 6),
                      child: LucideIcon(
                        'chevron-right',
                        size: 18,
                        color: TodayInk.primary.withValues(alpha: 0.4),
                      ),
                    ),
                  ],
                ),
              ),
              // hairline + status footer
              Container(
                height: 1,
                color: TodayInk.primary.withValues(alpha: 0.10),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 11, 16, 12),
                child: Row(
                  children: [
                    Container(
                      width: 6,
                      height: 6,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: active
                            ? const Color(0xFF16A34A)
                            : TodayInk.primary.withValues(alpha: 0.3),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        active
                            ? '$selected apps guarded · Shield active'
                            : 'Guard distracting apps with a sacred pause',
                        style: TextStyle(
                          fontSize: 11.5,
                          height: 1.3,
                          fontWeight: FontWeight.w600,
                          color: AppColors.fg(0.55),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}