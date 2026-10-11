import 'package:flutter/material.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/services/haptics.dart';
import '../../core/theme/app_colors.dart';
import '../../widgets/lucide.dart';
import 'wallpapers_mode.dart';

/// Live / Photos / Both selector for the wallpapers feed header.
class ModePill extends StatefulWidget {
  const ModePill({required this.mode, required this.onChange});
  final WpMode mode;
  final ValueChanged<WpMode> onChange;

  @override
  State<ModePill> createState() => ModePillState();
}

class ModePillState extends State<ModePill> {
  final _link = LayerLink();
  OverlayEntry? _entry;

  @override
  void dispose() {
    _entry?.remove();
    super.dispose();
  }

  void _toggle() {
    haptic(HapticStyle.soft);
    if (_entry != null) {
      _close();
    } else {
      _open();
    }
  }

  void _close() {
    _entry?.remove();
    _entry = null;
    if (mounted) setState(() {});
  }

  void _open() {
    final options = [
      (WpMode.live, 'wp.mode.live', 'clapperboard'),
      (WpMode.photos, 'wp.mode.photos', 'image'),
      (WpMode.both, 'wp.mode.both', 'layers'),
    ];
    _entry = OverlayEntry(
      builder: (context) => Stack(
        children: [
          Positioned.fill(
            child: GestureDetector(
              behavior: HitTestBehavior.translucent,
              onTap: _close,
            ),
          ),
          CompositedTransformFollower(
            link: _link,
            targetAnchor: Alignment.bottomRight,
            followerAnchor: Alignment.topRight,
            offset: const Offset(0, 8),
            child: Material(
              color: Colors.transparent,
              child: Container(
                width: 160,
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: AppColors.card,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.glassBorder),
                  boxShadow: const [
                    BoxShadow(
                      color: Colors.black45,
                      blurRadius: 24,
                      offset: Offset(0, 8),
                    ),
                  ],
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    for (final opt in options)
                      GestureDetector(
                        onTap: () {
                          haptic(HapticStyle.soft);
                          widget.onChange(opt.$1);
                          _close();
                        },
                        child: Container(
                          width: double.infinity,
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 8,
                          ),
                          decoration: BoxDecoration(
                            color: opt.$1 == widget.mode
                                ? AppColors.glassRaised
                                : null,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Row(
                            children: [
                              LucideIcon(
                                opt.$3,
                                size: 15,
                                color: opt.$1 == widget.mode
                                    ? AppColors.primary
                                    : AppColors.mutedForeground,
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  t(opt.$2),
                                  style: TextStyle(
                                    fontSize: 12.5,
                                    fontWeight: FontWeight.w700,
                                    color: opt.$1 == widget.mode
                                        ? AppColors.foreground
                                        : AppColors.mutedForeground.withValues(
                                            alpha: 0.8,
                                          ),
                                  ),
                                ),
                              ),
                              if (opt.$1 == widget.mode)
                                LucideIcon(
                                  'check',
                                  size: 14,
                                  color: AppColors.primary,
                                ),
                            ],
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
    );
    Overlay.of(context).insert(_entry!);
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final labelKey = switch (widget.mode) {
      WpMode.live => 'wp.mode.live',
      WpMode.photos => 'wp.mode.photos',
      WpMode.both => 'wp.mode.both',
    };
    final icon = switch (widget.mode) {
      WpMode.live => 'clapperboard',
      WpMode.photos => 'image',
      WpMode.both => 'layers',
    };
    return CompositedTransformTarget(
      link: _link,
      child: GestureDetector(
        onTap: _toggle,
        child: Container(
          height: 36,
          padding: const EdgeInsets.symmetric(horizontal: 10),
          decoration: BoxDecoration(
            color: AppColors.glassRaised,
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: AppColors.goldBorder),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              LucideIcon(icon, size: 14, color: AppColors.primary),
              const SizedBox(width: 6),
              Text(
                t(labelKey),
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  color: AppColors.foreground.withValues(alpha: 0.85),
                ),
              ),
              const SizedBox(width: 4),
              LucideIcon(
                _entry != null ? 'chevron-up' : 'chevron-down',
                size: 14,
                color: AppColors.foreground.withValues(alpha: 0.55),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
