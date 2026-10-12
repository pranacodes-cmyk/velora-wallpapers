import 'package:flutter/material.dart';
import 'package:permission_handler/permission_handler.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/services/content_push_service.dart';
import '../../core/services/haptics.dart';
import '../../core/services/prefs.dart';
import '../../core/theme/app_colors.dart';
import '../../widgets/lucide.dart';
import 'today_shared.dart';

const _cooldownKey = 'prayly:permissionNudge:lastShownAt';
const _cooldownMs = 7 * 24 * 60 * 60 * 1000; // 7 days

class PermissionNudge extends StatefulWidget {
  const PermissionNudge({super.key});

  @override
  State<PermissionNudge> createState() => _PermissionNudgeState();
}

class _PermissionNudgeState extends State<PermissionNudge> {
  bool _visible = false;

  @override
  void initState() {
    super.initState();
    _check();
  }

  Future<void> _check() async {
    final status = await Permission.notification.status;
    if (status.isGranted) return;

    final last = Prefs.getInt(_cooldownKey) ?? 0;
    if (DateTime.now().millisecondsSinceEpoch - last < _cooldownMs) return;

    if (mounted) setState(() => _visible = true);
  }

  void _onTap() async {
    haptic(HapticStyle.medium);
    final granted = await ContentPushes.enable();
    if (granted > 0) {
      if (mounted) setState(() => _visible = false);
    } else {
      // If still not granted (user denied again or settings), mark cooldown
      await Prefs.setInt(_cooldownKey, DateTime.now().millisecondsSinceEpoch);
      if (mounted) setState(() => _visible = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!_visible) return const SizedBox.shrink();

    return FadeRise(
      offsetY: 12,
      delay: const Duration(milliseconds: 350),
      duration: const Duration(milliseconds: 600),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 16, 12, 12),
        child: TapScale(
          scale: 0.985,
          onTap: _onTap,
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(22),
              color: AppColors.card,
              border: Border.all(color: AppColors.primary.withValues(alpha: 0.2)),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.65),
                  blurRadius: 26,
                  spreadRadius: -16,
                  offset: const Offset(0, 10),
                ),
              ],
            ),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(16),
                    color: AppColors.primary.withValues(alpha: 0.1),
                    border: Border.all(color: AppColors.primary.withValues(alpha: 0.2)),
                  ),
                  child: LucideIcon(
                    'bell',
                    size: 20,
                    color: AppColors.primary,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        t('ov.notif.title'),
                        style: TextStyle(
                          fontSize: 13.5,
                          height: 1.2,
                          fontWeight: FontWeight.w800,
                          color: AppColors.foreground,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        t('ov.notif.body'),
                        style: TextStyle(
                          fontSize: 11,
                          height: 1.375,
                          color: AppColors.foreground.withValues(alpha: 0.7),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(12),
                    color: AppColors.primary,
                  ),
                  child: Text(
                    t('ov.notif.enable'),
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 11 * 0.06,
                      color: AppColors.background,
                    ),
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
