import 'package:flutter/material.dart';

import '../core/theme/app_colors.dart';

/// Flutter stand-in for the web app's `sonner` toasts: same dark glass card,
/// same title + description shape, same top-of-content placement feel.
class AppToast {
  const AppToast._();

  static void success(
    BuildContext context,
    String title, {
    String? description,
  }) => _show(context, title, description, AppColors.primary);

  static void error(
    BuildContext context,
    String title, {
    String? description,
  }) => _show(context, title, description, AppColors.destructive);

  static void _show(
    BuildContext context,
    String title,
    String? description,
    Color accent,
  ) {
    final messenger = ScaffoldMessenger.maybeOf(context);
    if (messenger == null) return;
    messenger.clearSnackBars();
    messenger.showSnackBar(
      SnackBar(
        backgroundColor: AppColors.card,
        behavior: SnackBarBehavior.floating,
        elevation: 0,
        duration: const Duration(milliseconds: 2600),
        margin: const EdgeInsets.fromLTRB(16, 0, 16, 96),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(color: accent.withValues(alpha: 0.28)),
        ),
        content: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              title,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w800,
                height: 1.25,
                color: AppColors.foreground.withValues(alpha: 0.95),
              ),
            ),
            if (description != null && description.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 2),
                child: Text(
                  description,
                  style: TextStyle(
                    fontSize: 11.5,
                    height: 1.35,
                    color: AppColors.foreground.withValues(alpha: 0.6),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
