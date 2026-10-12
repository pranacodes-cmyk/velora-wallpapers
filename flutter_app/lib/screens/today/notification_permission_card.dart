import 'package:flutter/material.dart';
import 'package:permission_handler/permission_handler.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/services/content_push_service.dart';
import '../../core/services/prefs.dart';
import '../../core/theme/app_colors.dart';

/// One clear Home retry after the first Android notification request is denied.
/// Dismissing it is permanent; Settings remains available for later changes.
class NotificationPermissionCard extends StatefulWidget {
  const NotificationPermissionCard({super.key});

  @override
  State<NotificationPermissionCard> createState() => _NotificationPermissionCardState();
}

class _NotificationPermissionCardState extends State<NotificationPermissionCard> {
  bool _visible = false;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    ContentPushes.permissionRevision.addListener(_refresh);
    _refresh();
  }

  @override
  void dispose() {
    ContentPushes.permissionRevision.removeListener(_refresh);
    super.dispose();
  }

  Future<void> _refresh() async {
    if (Prefs.getBool(ContentPushes.permissionRetryDismissedKey)) return;
    if (!await ContentPushes.permissionWasAsked) return;
    final status = await Permission.notification.status;
    if (!mounted) return;
    setState(() => _visible = status.isDenied || status.isPermanentlyDenied);
  }

  Future<void> _enable() async {
    if (_busy) return;
    setState(() => _busy = true);
    final status = await Permission.notification.status;
    if (status.isPermanentlyDenied) {
      await openAppSettings();
    } else {
      await ContentPushes.ensurePermission(force: true);
    }
    final after = await Permission.notification.status;
    if (!mounted) return;
    setState(() {
      _busy = false;
      _visible = !after.isGranted;
    });
    if (after.isGranted) await ContentPushes.enable();
  }

  Future<void> _dismiss() async {
    await Prefs.setBool(ContentPushes.permissionRetryDismissedKey, true);
    if (mounted) setState(() => _visible = false);
  }

  @override
  Widget build(BuildContext context) {
    if (!_visible) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 4),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: AppColors.primary.withValues(alpha: 0.35)),
        ),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.notifications_active_outlined, color: AppColors.primary, size: 22),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(t('ov.notif.retry.title'), style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.foreground)),
                    const SizedBox(height: 4),
                    Text(t('ov.notif.retry.body'), style: TextStyle(fontSize: 12, height: 1.35, color: AppColors.mutedForeground)),
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 8,
                      runSpacing: 6,
                      children: [
                        FilledButton(
                          onPressed: _busy ? null : _enable,
                          child: Text(_busy ? t('ov.notif.opening') : t('ov.notif.retry.cta')),
                        ),
                        TextButton(onPressed: _dismiss, child: Text(t('ov.notif.later'))),
                      ],
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