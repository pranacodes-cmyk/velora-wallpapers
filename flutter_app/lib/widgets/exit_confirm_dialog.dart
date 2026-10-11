import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../core/localization/app_localizations.dart';
import '../core/services/haptics.dart';
import '../core/theme/app_colors.dart';
import '../core/theme/app_theme.dart';

/// 1:1 port of `src/components/ExitConfirmDialog.tsx` — glass card with a gold
/// border, a circular log-out glyph, "Stay" (muted) and "Exit" (gold gradient).
Future<void> showExitConfirmDialog(BuildContext context) async {
  await showGeneralDialog<void>(
    context: context,
    barrierColor: Colors.black.withValues(alpha: 0.7),
    barrierDismissible: true,
    barrierLabel: t('ov.exit.title'),
    transitionDuration: const Duration(milliseconds: 260),
    pageBuilder: (_, __, ___) => const _ExitDialog(),
    transitionBuilder: (_, anim, __, child) {
      final curved = CurvedAnimation(
        parent: anim,
        curve: Curves.easeOutBack,
        reverseCurve: Curves.easeIn,
      );
      return FadeTransition(
        opacity: anim,
        child: Transform.translate(
          offset: Offset(0, 40 * (1 - curved.value)),
          child: Transform.scale(
            scale: 0.85 + 0.15 * curved.value,
            child: child,
          ),
        ),
      );
    },
  );
}

class _ExitDialog extends StatelessWidget {
  const _ExitDialog();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 300),
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: AppColors.glass,
              borderRadius: BorderRadius.circular(24),
              border: Border.all(
                color: AppColors.primary.withValues(alpha: 0.3),
              ),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(24, 28, 24, 16),
                  child: Column(
                    children: [
                      Container(
                        width: 64,
                        height: 64,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: AppColors.primary.withValues(alpha: 0.1),
                        ),
                        child: Icon(
                          Icons.logout_rounded,
                          size: 28,
                          color: AppColors.primary,
                        ),
                      ),
                      const SizedBox(height: 16),
                      Text(
                        t('ov.exit.title'),
                        textAlign: TextAlign.center,
                        style: AppTheme.serif(
                          size: 18,
                          weight: FontWeight.w700,
                          color: AppColors.foreground,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        t('ov.exit.body'),
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 13,
                          height: 1.5,
                          color: AppColors.mutedForeground,
                        ),
                      ),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
                  child: Row(
                    children: [
                      Expanded(
                        child: _DialogButton(
                          label: t('ov.exit.stay'),
                          background: AppColors.muted,
                          textColor: AppColors.foreground,
                          onTap: () {
                            haptic(HapticStyle.soft);
                            Navigator.of(context).maybePop();
                          },
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _DialogButton(
                          label: t('ov.exit.exit'),
                          gradient: LinearGradient(
                            colors: [
                              AppColors.primary,
                              AppColors.premiumGoldGlow,
                            ],
                          ),
                          textColor: Colors.black,
                          onTap: () {
                            haptic(HapticStyle.heavy);
                            SystemNavigator.pop();
                          },
                        ),
                      ),
                    ],
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

class _DialogButton extends StatefulWidget {
  const _DialogButton({
    required this.label,
    required this.textColor,
    required this.onTap,
    this.background,
    this.gradient,
  });

  final String label;
  final Color textColor;
  final VoidCallback onTap;
  final Color? background;
  final Gradient? gradient;

  @override
  State<_DialogButton> createState() => _DialogButtonState();
}

class _DialogButtonState extends State<_DialogButton> {
  bool _down = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: (_) => setState(() => _down = true),
      onTapCancel: () => setState(() => _down = false),
      onTapUp: (_) => setState(() => _down = false),
      onTap: widget.onTap,
      child: AnimatedScale(
        scale: _down ? 0.95 : 1,
        duration: const Duration(milliseconds: 110),
        child: Container(
          height: 46,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: widget.background,
            gradient: widget.gradient,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Text(
            widget.label,
            style: TextStyle(
              fontSize: 13,
              fontWeight: widget.gradient != null
                  ? FontWeight.w800
                  : FontWeight.w600,
              color: widget.textColor,
            ),
          ),
        ),
      ),
    );
  }
}
