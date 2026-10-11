import 'package:flutter/material.dart';

import '../core/theme/app_colors.dart';
import '../core/theme/app_theme.dart';

/// Temporary marker for screens that are queued for the 1:1 port.
/// Every placeholder names the exact web source file it must match, so nothing
/// can silently ship as "done" while it still differs from the web app.
class PortPlaceholder extends StatelessWidget {
  const PortPlaceholder({super.key, required this.title, required this.source});

  final String title;
  final String source;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                title,
                style: AppTheme.serif(size: 24, color: AppColors.foreground),
              ),
              const SizedBox(height: 10),
              Text(
                'Porting from $source',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 12,
                  color: AppColors.mutedForeground,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
