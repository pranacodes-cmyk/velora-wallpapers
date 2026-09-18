import 'package:flutter/material.dart';

import '../core/localization/app_localizations.dart';
import '../core/services/haptics.dart';
import '../core/services/streak_store.dart';
import '../core/theme/app_colors.dart';

/// 1:1 port of `src/components/StreakBadge.tsx` — gold pill with the flame +
/// count, tap opens the stats tooltip. No infinite animations (deliberately
/// removed on web for low-end Android performance).
class StreakBadge extends StatefulWidget {
  const StreakBadge({super.key});

  @override
  State<StreakBadge> createState() => _StreakBadgeState();
}

class _StreakBadgeState extends State<StreakBadge> {
  final _link = LayerLink();
  OverlayEntry? _tooltip;

  @override
  void dispose() {
    _tooltip?.remove();
    _tooltip = null;
    super.dispose();
  }

  void _toggleTooltip(StreakData streak) {
    if (_tooltip != null) {
      _tooltip!.remove();
      _tooltip = null;
      setState(() {});
      return;
    }
    _tooltip = OverlayEntry(
      builder: (_) => Stack(
        children: [
          // Backdrop: any tap closes (same as the web fixed-inset catcher).
          Positioned.fill(
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () => _toggleTooltip(streak),
              child: const SizedBox.expand(),
            ),
          ),
          CompositedTransformFollower(
            link: _link,
            targetAnchor: Alignment.bottomRight,
            followerAnchor: Alignment.topRight,
            offset: const Offset(0, 8),
            child: _Tooltip(streak: streak),
          ),
        ],
      ),
    );
    Overlay.of(context).insert(_tooltip!);
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<int>(
      valueListenable: StreakStore.revision,
      builder: (context, _, __) {
        final streak = StreakStore.load();
        if (streak.current < 1) return const SizedBox.shrink();

        final isHot = streak.current >= 7;
        final isOnFire = streak.current >= 3;

        return CompositedTransformTarget(
          link: _link,
          child: GestureDetector(
            onTap: () {
              haptic(HapticStyle.soft);
              _toggleTooltip(streak);
            },
            child: Container(
              padding: const EdgeInsets.fromLTRB(12, 8, 14, 8),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(999),
                gradient: isHot
                    ? LinearGradient(
                        begin: const Alignment(-0.8, -1),
                        end: const Alignment(0.8, 1),
                        colors: [AppColors.primary, AppColors.accent],
                      )
                    : null,
                color: isHot ? null : AppColors.primary.withValues(alpha: 0.14),
                border: isHot
                    ? null
                    : Border.all(
                        color: AppColors.primary.withValues(alpha: 0.22),
                      ),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.primary.withValues(
                      alpha: isHot ? 0.45 : 0.18,
                    ),
                    blurRadius: isHot ? 18 : 10,
                    offset: Offset(0, isHot ? 3 : 2),
                  ),
                ],
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    isOnFire
                        ? Icons.local_fire_department
                        : Icons.local_fire_department_outlined,
                    size: 17,
                    color: isHot ? Colors.white : AppColors.primary,
                  ),
                  const SizedBox(width: 6),
                  Text(
                    '${streak.current}',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w900,
                      height: 1,
                      letterSpacing: -0.3,
                      color: isHot ? Colors.white : AppColors.primary,
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

class _Tooltip extends StatelessWidget {
  const _Tooltip({required this.streak});

  final StreakData streak;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: Container(
        width: 224,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.glassBorder),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.4),
              blurRadius: 40,
              offset: const Offset(0, 12),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(12),
                    gradient: LinearGradient(
                      begin: const Alignment(-0.8, -1),
                      end: const Alignment(0.8, 1),
                      colors: [
                        AppColors.primary.withValues(alpha: 0.15),
                        AppColors.accent.withValues(alpha: 0.10),
                      ],
                    ),
                  ),
                  child: Icon(
                    Icons.local_fire_department,
                    size: 20,
                    color: AppColors.primary,
                  ),
                ),
                const SizedBox(width: 8),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      t('today.badge.dailyStreak'),
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w800,
                        color: AppColors.foreground,
                      ),
                    ),
                    Text(
                      t('today.badge.openDaily'),
                      style: TextStyle(
                        fontSize: 10,
                        color: AppColors.mutedForeground,
                      ),
                    ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: _Stat(
                    value: streak.current,
                    label: t('today.badge.current'),
                    color: AppColors.primary,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _Stat(
                    value: streak.longest,
                    label: t('today.badge.best'),
                    color: AppColors.accent,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(8),
                color: AppColors.primary.withValues(alpha: 0.06),
              ),
              child: Row(
                children: [
                  const Text('✝️', style: TextStyle(fontSize: 13)),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      t('today.badge.freshVerse'),
                      style: TextStyle(
                        fontSize: 10,
                        height: 1.35,
                        color: AppColors.mutedForeground,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            Text(
              streak.current >= 7
                  ? t('today.badge.msgHot')
                  : streak.current >= 3
                  ? t('today.badge.msgWarm')
                  : t('today.badge.msgCold'),
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 10,
                height: 1.6,
                color: AppColors.mutedForeground,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.value, required this.label, required this.color});

  final int value;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        color: color.withValues(alpha: 0.08),
      ),
      child: Column(
        children: [
          Text(
            '$value',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w900,
              color: color,
            ),
          ),
          Text(
            label.toUpperCase(),
            style: TextStyle(
              fontSize: 9,
              fontWeight: FontWeight.bold,
              letterSpacing: 0.8,
              color: AppColors.mutedForeground,
            ),
          ),
        ],
      ),
    );
  }
}
