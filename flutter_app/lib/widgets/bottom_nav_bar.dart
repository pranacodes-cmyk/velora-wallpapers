import 'dart:ui';

import 'package:flutter/material.dart';

import '../core/localization/app_localizations.dart';
import '../core/services/haptics.dart';
import '../core/theme/app_colors.dart';

/// 1:1 port of `src/components/BottomNav.tsx`:
/// floating glass pill, 4 tabs (Today / Wallpapers / Journeys / Quiz),
/// 20x3 gold indicator line on top of the active tab, radial glow behind the
/// active icon, 9px bold labels, soft haptic on tap and on drag-over.
class NavTab {
  const NavTab(this.icon, this.labelKey, {this.fillWhenActive = false});
  final IconData icon;
  final String labelKey;
  final bool fillWhenActive;
}

const kNavTabs = <NavTab>[
  NavTab(Icons.wb_sunny_outlined, 'nav.today', fillWhenActive: true),
  NavTab(Icons.image_outlined, 'nav.wallpapers'),
  NavTab(Icons.explore_outlined, 'nav.journeys'),
  NavTab(Icons.psychology_outlined, 'nav.quiz'),
];

class BottomNavBar extends StatelessWidget {
  const BottomNavBar({
    super.key,
    required this.activeIndex,
    required this.onChanged,
  });

  final int activeIndex;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).padding.bottom;

    return Positioned(
      left: 16,
      right: 16,
      bottom: 16 + bottomInset,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(28),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: AppColors.glass,
              borderRadius: BorderRadius.circular(28),
              border: Border.all(color: AppColors.glassBorder),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.5),
                  blurRadius: 40,
                  spreadRadius: -8,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            child: Row(
              children: [
                for (var i = 0; i < kNavTabs.length; i++)
                  Expanded(
                    child: _Tab(
                      tab: kNavTabs[i],
                      active: i == activeIndex,
                      onTap: () {
                        haptic(HapticStyle.soft);
                        onChanged(i);
                      },
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Tab extends StatelessWidget {
  const _Tab({required this.tab, required this.active, required this.onTap});

  final NavTab tab;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final iconColor = active
        ? AppColors.primary
        : AppColors.foreground.withValues(alpha: 0.7);
    final labelColor = active
        ? AppColors.primary
        : AppColors.foreground.withValues(alpha: 0.65);

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: SizedBox(
        height: 62,
        child: Stack(
          alignment: Alignment.center,
          children: [
            if (active)
              Positioned(
                top: -1,
                child: Container(
                  width: 20,
                  height: 3,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(99),
                    gradient: LinearGradient(
                      colors: [
                        AppColors.primary,
                        AppColors.primary.withValues(alpha: 0.7),
                      ],
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.primary.withValues(alpha: 0.4),
                        blurRadius: 10,
                      ),
                    ],
                  ),
                ),
              ),
            if (active)
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [
                      AppColors.primary.withValues(alpha: 0.1),
                      Colors.transparent,
                    ],
                    stops: const [0, 0.7],
                  ),
                ),
              ),
            Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(tab.icon, size: 21, color: iconColor),
                const SizedBox(height: 4),
                Text(
                  t(tab.labelKey),
                  style: TextStyle(
                    fontSize: 9,
                    height: 1,
                    fontWeight: FontWeight.w700,
                    color: labelColor,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
