import 'dart:async';
import 'dart:ui';

import 'package:flutter/material.dart';

import '../core/localization/app_localizations.dart';
import '../core/services/analytics.dart';
import '../core/services/haptics.dart';
import '../core/services/rating_service.dart';
import '../core/theme/app_colors.dart';

/// 1:1 port of `src/components/RatingPrompt.tsx` — a 2-step, Jesus-toned
/// rating sheet: "Has this app blessed you?" → 🙌 opens native Play Store
/// review, 🤔 opens private email feedback. Strings mirror the web's
/// `ov.rating.*` copy (English source — no matching translation keys exist
/// yet in assets/translations).
void showRatingPromptDialog(BuildContext context) {
  showGeneralDialog(
    context: context,
    barrierDismissible: false,
    barrierColor: Colors.transparent,
    transitionDuration: const Duration(milliseconds: 220),
    pageBuilder: (_, __, ___) => const _RatingPromptSheet(),
    transitionBuilder: (_, anim, __, child) =>
        FadeTransition(opacity: anim, child: child),
  );
}

enum _Step { ask, thank, feedback }

class _RatingPromptSheet extends StatefulWidget {
  const _RatingPromptSheet();

  @override
  State<_RatingPromptSheet> createState() => _RatingPromptSheetState();
}

class _RatingPromptSheetState extends State<_RatingPromptSheet>
    with TickerProviderStateMixin {
  _Step _step = _Step.ask;
  late final AnimationController _heartCtrl = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 3000),
  )..repeat();

  void _track(String event, [Map<String, Object>? props]) =>
      Analytics.capture(event, props);

  @override
  void dispose() {
    _heartCtrl.dispose();
    super.dispose();
  }

  void _closeAndRelease() {
    if (mounted) Navigator.of(context, rootNavigator: true).pop();
  }

  Future<void> _handleLove() async {
    haptic(HapticStyle.medium);
    _track('rating_love_clicked');
    setState(() => _step = _Step.thank);
    Timer(const Duration(milliseconds: 1100), () async {
      await RatingService.openNativeRating();
      _track('rating_play_store_opened');
      _closeAndRelease();
    });
  }

  void _handleNotReally() {
    haptic(HapticStyle.soft);
    _track('rating_not_really_clicked');
    setState(() => _step = _Step.feedback);
  }

  Future<void> _handleSendFeedback() async {
    haptic(HapticStyle.soft);
    _track('rating_feedback_sent');
    await RatingService.openFeedback();
    _closeAndRelease();
  }

  void _handleDismiss() {
    haptic(HapticStyle.soft);
    _track('rating_dismissed', {'step': _step.name});
    // Soft dismiss — never a permanent opt-out.
    RatingService.markLater();
    _closeAndRelease();
  }

  void _handleBackdropTap() {
    // Backdrop taps are usually accidental — ignored, same as the web.
    _track('rating_backdrop_tap', {'step': _step.name});
  }

  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.of(context);
    return GestureDetector(
      onTap: _handleBackdropTap,
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 24, sigmaY: 24),
        child: Container(
          color: AppColors.background.withValues(alpha: 0.7),
          alignment: mq.size.width >= 640
              ? Alignment.center
              : Alignment.bottomCenter,
          padding: EdgeInsets.fromLTRB(16, 16, 16, 16 + mq.viewPadding.bottom),
          child: GestureDetector(
            onTap: () {},
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 384),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.all(28),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(28),
                  border: Border.all(color: AppColors.glassBorder),
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      AppColors.card,
                      AppColors.card.withValues(alpha: 0.96),
                    ],
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.background.withValues(alpha: 0.7),
                      blurRadius: 100,
                      offset: const Offset(0, 40),
                    ),
                  ],
                ),
                child: Stack(
                  clipBehavior: Clip.none,
                  children: [
                    Positioned(
                      top: -132,
                      left: 0,
                      right: 0,
                      child: IgnorePointer(
                        child: Center(
                          child: Container(
                            width: 360,
                            height: 240,
                            decoration: BoxDecoration(
                              gradient: RadialGradient(
                                colors: [
                                  AppColors.primary.withValues(alpha: 0.22),
                                  AppColors.primary.withValues(alpha: 0),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                    Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Align(
                          alignment: Alignment.topRight,
                          child: _CloseButton(onTap: _handleDismiss),
                        ),
                        AnimatedSwitcher(
                          duration: const Duration(milliseconds: 200),
                          child: _buildStep(),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildStep() {
    switch (_step) {
      case _Step.ask:
        return _AskStep(
          key: const ValueKey('ask'),
          heartCtrl: _heartCtrl,
          onLove: _handleLove,
          onNotReally: _handleNotReally,
        );
      case _Step.thank:
        return const _ThankStep(key: ValueKey('thank'));
      case _Step.feedback:
        return _FeedbackStep(
          key: const ValueKey('feedback'),
          onSend: _handleSendFeedback,
          onLater: _handleDismiss,
        );
    }
  }
}

class _CloseButton extends StatelessWidget {
  const _CloseButton({required this.onTap});
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Material(
    color: Colors.transparent,
    child: InkWell(
      onTap: onTap,
      customBorder: const CircleBorder(),
      child: Container(
        width: 32,
        height: 32,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: AppColors.background.withValues(alpha: 0.5),
          border: Border.all(color: AppColors.glassBorder),
        ),
        child: Icon(
          Icons.close,
          size: 16,
          color: AppColors.foreground.withValues(alpha: 0.6),
        ),
      ),
    ),
  );
}

class _PrimaryButton extends StatelessWidget {
  const _PrimaryButton({
    required this.icon,
    required this.label,
    required this.onTap,
  });
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Material(
    color: Colors.transparent,
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        height: 56,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [AppColors.primary, AppColors.accent],
          ),
          boxShadow: [
            BoxShadow(
              color: AppColors.primary.withValues(alpha: 0.4),
              blurRadius: 30,
              offset: const Offset(0, 10),
            ),
          ],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 20, color: Colors.white),
            const SizedBox(width: 8),
            Text(
              label,
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w900,
                color: Colors.white,
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

class _AskStep extends StatelessWidget {
  const _AskStep({
    super.key,
    required this.heartCtrl,
    required this.onLove,
    required this.onNotReally,
  });
  final AnimationController heartCtrl;
  final VoidCallback onLove;
  final VoidCallback onNotReally;

  @override
  Widget build(BuildContext context) => Column(
    mainAxisSize: MainAxisSize.min,
    children: [
      AnimatedBuilder(
        animation: heartCtrl,
        builder: (context, child) {
          final t = heartCtrl.value;
          final dy = -4 * (1 - (2 * t - 1).abs());
          return Transform.translate(offset: Offset(0, dy), child: child);
        },
        child: Container(
          width: 80,
          height: 80,
          margin: const EdgeInsets.only(bottom: 20),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: AppColors.primary.withValues(alpha: 0.4)),
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                AppColors.primary.withValues(alpha: 0.25),
                AppColors.accent.withValues(alpha: 0.15),
              ],
            ),
            boxShadow: [
              BoxShadow(
                color: AppColors.primary.withValues(alpha: 0.3),
                blurRadius: 40,
                offset: const Offset(0, 12),
              ),
            ],
          ),
          child: Icon(Icons.favorite, size: 40, color: AppColors.primary),
        ),
      ),
      Text(
        'Has this app blessed you? 🙏',
        textAlign: TextAlign.center,
        style: TextStyle(
          fontSize: 22,
          fontWeight: FontWeight.w900,
          letterSpacing: -0.3,
          color: AppColors.foreground,
        ),
      ),
      const SizedBox(height: 8),
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8),
        child: Text(
          "A 5-star rating helps spread the Word and brings these wallpapers & prayers to more believers around the world. ✨",
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 14,
            height: 1.5,
            color: AppColors.foreground.withValues(alpha: 0.65),
          ),
        ),
      ),
      const SizedBox(height: 28),
      _PrimaryButton(
        icon: Icons.star_rounded,
        label: 'Yes — bless this app 🙌',
        onTap: onLove,
      ),
      const SizedBox(height: 10),
      Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onNotReally,
          borderRadius: BorderRadius.circular(16),
          child: Container(
            height: 48,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              color: AppColors.background.withValues(alpha: 0.5),
              border: Border.all(color: AppColors.glassBorder),
            ),
            child: Text(
              'Not yet',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: AppColors.foreground.withValues(alpha: 0.7),
              ),
            ),
          ),
        ),
      ),
    ],
  );
}

class _ThankStep extends StatelessWidget {
  const _ThankStep({super.key});

  @override
  Widget build(BuildContext context) => Column(
    mainAxisSize: MainAxisSize.min,
    children: [
      Row(
        mainAxisSize: MainAxisSize.min,
        children: List.generate(5, (i) {
          return TweenAnimationBuilder<double>(
            tween: Tween(begin: 0, end: 1),
            duration: Duration(milliseconds: 300 + i * 80),
            curve: Curves.easeOutBack,
            builder: (context, v, child) => Transform.scale(
              scale: v,
              child: Opacity(opacity: v.clamp(0, 1), child: child),
            ),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 3),
              child: Icon(
                Icons.star_rounded,
                size: 36,
                color: AppColors.primary,
              ),
            ),
          );
        }),
      ),
      const SizedBox(height: 20),
      Text(
        'God bless you 🙏✨',
        textAlign: TextAlign.center,
        style: TextStyle(
          fontSize: 22,
          fontWeight: FontWeight.w900,
          letterSpacing: -0.3,
          color: AppColors.foreground,
        ),
      ),
      const SizedBox(height: 8),
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8),
        child: Text(
          "Opening the Play Store — one tap on 5 stars helps us reach more believers. Thank you, brother/sister! ❤️",
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 14,
            height: 1.5,
            color: AppColors.foreground.withValues(alpha: 0.65),
          ),
        ),
      ),
    ],
  );
}

class _FeedbackStep extends StatelessWidget {
  const _FeedbackStep({super.key, required this.onSend, required this.onLater});
  final VoidCallback onSend;
  final VoidCallback onLater;

  @override
  Widget build(BuildContext context) => Column(
    mainAxisSize: MainAxisSize.min,
    children: [
      Container(
        width: 80,
        height: 80,
        margin: const EdgeInsets.only(bottom: 20),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(24),
          color: AppColors.accent.withValues(alpha: 0.15),
          border: Border.all(color: AppColors.accent.withValues(alpha: 0.35)),
        ),
        child: Icon(
          Icons.chat_bubble_outline,
          size: 40,
          color: AppColors.accent,
        ),
      ),
      Text(
        "Share what's on your heart",
        textAlign: TextAlign.center,
        style: TextStyle(
          fontSize: 22,
          fontWeight: FontWeight.w900,
          letterSpacing: -0.3,
          color: AppColors.foreground,
        ),
      ),
      const SizedBox(height: 8),
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8),
        child: Text(
          "Tell us what we can do better — every message is read and shapes the next blessing we ship. 🕊️",
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 14,
            height: 1.5,
            color: AppColors.foreground.withValues(alpha: 0.65),
          ),
        ),
      ),
      const SizedBox(height: 24),
      _PrimaryButton(
        icon: Icons.chat_bubble,
        label: 'Send Feedback',
        onTap: onSend,
      ),
      const SizedBox(height: 10),
      Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onLater,
          borderRadius: BorderRadius.circular(16),
          child: Container(
            height: 44,
            alignment: Alignment.center,
            child: Text(
              'Maybe later',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: AppColors.foreground.withValues(alpha: 0.55),
              ),
            ),
          ),
        ),
      ),
    ],
  );
}
