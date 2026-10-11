import 'dart:async';

import 'package:flutter/material.dart';
import '../../widgets/lucide.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/services/prayer_slots.dart';
import '../today/today_shared.dart';

/// 1:1 port of `src/components/devotional/LockedPrayerCard.tsx`.
class LockedPrayerCard extends StatefulWidget {
  const LockedPrayerCard({
    super.key,
    required this.onUnlock,
    required this.isLoading,
    this.title,
    this.subtitle,
    this.countdownLabel,
  });

  final VoidCallback onUnlock;
  final bool isLoading;
  final String? title;
  final String? subtitle;
  final String? countdownLabel;

  @override
  State<LockedPrayerCard> createState() => _LockedPrayerCardState();
}

class _LockedPrayerCardState extends State<LockedPrayerCard>
    with SingleTickerProviderStateMixin {
  Timer? _timer;
  late AnimationController _float;
  _Next _next = _compute();

  static _Next _compute() {
    final now = DateTime.now();
    final DateTime target;
    if (now.hour < PrayerSlots.eveningUnlockHour) {
      target = DateTime(
        now.year,
        now.month,
        now.day,
        PrayerSlots.eveningUnlockHour,
      );
    } else {
      target = DateTime(now.year, now.month, now.day + 1);
    }
    final label = now.hour < PrayerSlots.eveningUnlockHour
        ? t('dev.locked.eveningLabel')
        : t('dev.locked.nextLabel');
    var diffMs = target.difference(now).inMilliseconds;
    if (diffMs < 0) diffMs = 0;
    return _Next(
      h: diffMs ~/ 3600000,
      m: (diffMs % 3600000) ~/ 60000,
      s: (diffMs % 60000) ~/ 1000,
      label: label,
    );
  }

  @override
  void initState() {
    super.initState();
    _float = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat(reverse: true);
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() => _next = _compute());
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _float.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final title = widget.title ?? t('dev.locked.tomorrowTitle');
    final subtitle = widget.subtitle ?? t('dev.locked.tomorrowSubtitle');
    final cdLabel = widget.countdownLabel ?? '${_next.label} in';

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          // Locked glass card
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 340),
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.06),
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: Colors.white.withValues(alpha: 0.12)),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.3),
                    blurRadius: 32,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: Column(
                children: [
                  RepaintBoundary(
                    child: AnimatedBuilder(
                      animation: _float,
                      builder: (context, child) => Transform.translate(
                        offset: Offset(
                          0,
                          -6 * Curves.easeInOut.transform(_float.value),
                        ),
                        child: child,
                      ),
                      child: Container(
                        width: 64,
                        height: 64,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          gradient: LinearGradient(
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                            colors: [
                              const Color(0xFFFFD700).withValues(alpha: 0.25),
                              const Color(0xFFFFB432).withValues(alpha: 0.15),
                            ],
                          ),
                          border: Border.all(
                            color: const Color(
                              0xFFFFD700,
                            ).withValues(alpha: 0.3),
                          ),
                        ),
                        child: LucideIcon(
                          'lock',
                          size: 28,
                          color: const Color(0xFFFCD34D).withValues(alpha: 0.9),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    title,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: Colors.white.withValues(alpha: 0.9),
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    subtitle,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 13,
                      height: 1.55,
                      color: Colors.white.withValues(alpha: 0.5),
                    ),
                  ),
                  const SizedBox(height: 20),
                  Text(
                    cdLabel,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 10 * 0.18,
                      color: Colors.white.withValues(alpha: 0.4),
                    ),
                  ),
                  const SizedBox(height: 10),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      _unit(twoDigits(_next.h), t('dev.locked.h')),
                      const SizedBox(width: 8),
                      _unit(twoDigits(_next.m), t('dev.locked.m')),
                      const SizedBox(width: 8),
                      _unit(twoDigits(_next.s), t('dev.locked.s')),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 20),

          // Unlock button
          Opacity(
            opacity: widget.isLoading ? 0.6 : 1,
            child: TapScale(
              scale: 0.95,
              onTap: widget.isLoading ? () {} : widget.onUnlock,
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 32,
                  vertical: 16,
                ),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(999),
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      const Color(0xFFFFD700).withValues(alpha: 0.92),
                      const Color(0xFFFFB432).withValues(alpha: 0.92),
                    ],
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFFFFD700).withValues(alpha: 0.35),
                      blurRadius: 20,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (!widget.isLoading) ...[
                      LucideIcon('sun', size: 16, color: Color(0xFF3A2000)),
                      const SizedBox(width: 8),
                    ],
                    Text(
                      widget.isLoading
                          ? t('dev.toast.unlocking')
                          : t('dev.locked.ctaReveal'),
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 0.3,
                        color: Color(0xFF3A2000),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 20),
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 260),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  Icons.schedule_rounded,
                  size: 12,
                  color: Colors.white.withValues(alpha: 0.35),
                ),
                const SizedBox(width: 6),
                Flexible(
                  child: Text(
                    t('dev.locked.ctaWaitHint'),
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 11,
                      color: Colors.white.withValues(alpha: 0.35),
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

  Widget _unit(String value, String label) {
    return Column(
      children: [
        Container(
          width: 48,
          height: 48,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.06),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: const Color(0xFFFFD700).withValues(alpha: 0.18),
            ),
          ),
          child: Text(
            value,
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w900,
              fontFeatures: const [FontFeature.tabularFigures()],
              color: const Color(0xFFFDE68A).withValues(alpha: 0.95),
            ),
          ),
        ),
        const SizedBox(height: 4),
        Text(
          label.toUpperCase(),
          style: TextStyle(
            fontSize: 9,
            fontWeight: FontWeight.w700,
            letterSpacing: 9 * 0.12,
            color: Colors.white.withValues(alpha: 0.35),
          ),
        ),
      ],
    );
  }
}

class _Next {
  const _Next({
    required this.h,
    required this.m,
    required this.s,
    required this.label,
  });
  final int h;
  final int m;
  final int s;
  final String label;
}
