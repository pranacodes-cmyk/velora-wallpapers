import 'dart:typed_data';

import 'package:flutter/material.dart';

import '../../core/services/analytics.dart';
import '../../core/services/haptics.dart';
import '../../core/services/ios_platform.dart';
import '../../core/theme/app_colors.dart';
import '../../widgets/app_toast.dart';
import '../../widgets/lucide.dart';
import '../today/today_shared.dart';
import 'ios_copy.dart';

/// Today's wallpaper rendered by the native iOS renderer — the exact image the
/// Shortcut puts on the Lock/Home Screen. [fallback] shows while it renders.
class IosWallpaperPreview extends StatefulWidget {
  const IosWallpaperPreview({
    super.key,
    this.fallback,
    this.display = false,
    this.radius = 0,
  });

  final Widget? fallback;

  /// true = what the Lock Screen shows right now (incl. "new verse" badge).
  final bool display;
  final double radius;

  @override
  State<IosWallpaperPreview> createState() => _IosWallpaperPreviewState();
}

class _IosWallpaperPreviewState extends State<IosWallpaperPreview> {
  Uint8List? _bytes;
  bool _requested = false;

  Future<void> _load(double logicalWidth, double dpr) async {
    if (_requested) return;
    _requested = true;
    final px = (logicalWidth * dpr).clamp(320.0, 1290.0);
    final data = await IosPlatform.renderPreview(width: px, display: widget.display);
    if (!mounted || data == null) return;
    setState(() => _bytes = data);
  }

  @override
  Widget build(BuildContext context) {
    final screen = MediaQuery.sizeOf(context);
    final aspect = screen.height > 0 ? (screen.width / screen.height).clamp(0.4, 0.8) : 9 / 19.5;
    final dpr = MediaQuery.devicePixelRatioOf(context);
    return AspectRatio(
      aspectRatio: aspect,
      child: LayoutBuilder(
        builder: (context, c) {
          if (c.maxWidth.isFinite) _load(c.maxWidth, dpr);
          return ClipRRect(
            borderRadius: BorderRadius.circular(widget.radius),
            child: Stack(
              fit: StackFit.expand,
              children: [
                if (widget.fallback != null) widget.fallback! else ColoredBox(color: AppColors.card),
                AnimatedOpacity(
                  opacity: _bytes == null ? 0 : 1,
                  duration: const Duration(milliseconds: 320),
                  curve: Curves.easeOut,
                  child: _bytes == null
                      ? const SizedBox.shrink()
                      : Image.memory(
                          _bytes!,
                          fit: BoxFit.cover,
                          gaplessPlayback: true,
                          filterQuality: FilterQuality.medium,
                        ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

/// After "Apply" on iPhone without an automation: the wallpaper is in Photos;
/// offer the one-time automatic setup.
Future<void> showIosSavedSheet(BuildContext context, {required VoidCallback onMakeAutomatic}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (sheetContext) => _IosSavedSheet(
      onMakeAutomatic: () {
        Navigator.of(sheetContext).pop();
        onMakeAutomatic();
      },
      onClose: () => Navigator.of(sheetContext).pop(),
    ),
  );
}

class _IosSavedSheet extends StatelessWidget {
  const _IosSavedSheet({required this.onMakeAutomatic, required this.onClose});

  final VoidCallback onMakeAutomatic;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.paddingOf(context).bottom;
    return Container(
      padding: EdgeInsets.fromLTRB(20, 12, 20, 20 + bottom),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
        border: Border.all(color: AppColors.goldBorder),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 38,
            height: 4,
            decoration: BoxDecoration(
              color: AppColors.foreground.withValues(alpha: 0.18),
              borderRadius: BorderRadius.circular(4),
            ),
          ),
          const SizedBox(height: 18),
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              SizedBox(
                width: 64,
                child: Container(
                  clipBehavior: Clip.antiAlias,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.glassBorder),
                  ),
                  child: const IosWallpaperPreview(display: true),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        LucideIcon('check', size: 16, color: AppColors.primary, strokeWidth: 2.6),
                        const SizedBox(width: 6),
                        Flexible(
                          child: Text(
                            IosCopy.t('saved.title'),
                            style: TextStyle(
                              fontSize: 17,
                              fontWeight: FontWeight.w900,
                              color: AppColors.foreground,
                              letterSpacing: -0.3,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      IosCopy.t('saved.body'),
                      style: TextStyle(
                        fontSize: 13,
                        height: 1.4,
                        fontWeight: FontWeight.w500,
                        color: AppColors.foreground.withValues(alpha: 0.72),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          _GoldButton(label: IosCopy.t('saved.auto'), icon: 'zap', onTap: onMakeAutomatic),
          const SizedBox(height: 10),
          TapScale(
            onTap: onClose,
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 10),
              child: Text(
                IosCopy.t('saved.later'),
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: AppColors.foreground.withValues(alpha: 0.6),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _GoldButton extends StatelessWidget {
  const _GoldButton({required this.label, required this.icon, required this.onTap});

  final String label;
  final String icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return TapScale(
      scale: 0.97,
      onTap: onTap,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 15),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [AppColors.premiumGoldGlow, AppColors.premiumGold],
          ),
          boxShadow: [
            BoxShadow(
              color: AppColors.premiumGold.withValues(alpha: 0.32),
              blurRadius: 22,
              offset: const Offset(0, 12),
            ),
          ],
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            LucideIcon(icon, size: 17, color: AppColors.background, strokeWidth: 2.4),
            const SizedBox(width: 8),
            Flexible(
              child: Text(
                label,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w900,
                  color: AppColors.background,
                  letterSpacing: -0.2,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// One-time setup for the daily automatic wallpaper on iPhone (Apple
/// Shortcuts personal automation + the Prayly action) and the widgets.
class IosWallpaperGuideScreen extends StatefulWidget {
  const IosWallpaperGuideScreen({super.key});

  @override
  State<IosWallpaperGuideScreen> createState() => _IosWallpaperGuideScreenState();
}

class _IosWallpaperGuideScreenState extends State<IosWallpaperGuideScreen>
    with WidgetsBindingObserver {
  IosAutomationStatus? _status;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    Analytics.capture('ios_wallpaper_guide_opened');
    _refresh();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _refresh();
  }

  Future<void> _refresh() async {
    final s = await IosPlatform.automationStatus();
    if (!mounted) return;
    final wasActive = _status?.active ?? false;
    setState(() => _status = s);
    if (!wasActive && s.active) {
      haptic(HapticStyle.heavy);
      Analytics.capture('ios_wallpaper_automation_detected');
    }
  }

  Future<void> _openShortcuts() async {
    haptic(HapticStyle.medium);
    Analytics.capture('ios_wallpaper_guide_open_shortcuts');
    await IosPlatform.openShortcutsApp();
  }

  Future<void> _test() async {
    haptic(HapticStyle.medium);
    Analytics.capture('ios_wallpaper_guide_test');
    final ok = await IosPlatform.runShortcut();
    if (!mounted) return;
    if (!ok) AppToast.error(context, IosCopy.t('guide.testFail'));
  }

  String _time(DateTime d) {
    final now = DateTime.now();
    final hh = d.hour.toString().padLeft(2, '0');
    final mm = d.minute.toString().padLeft(2, '0');
    final sameDay = d.year == now.year && d.month == now.month && d.day == now.day;
    return sameDay ? '$hh:$mm' : '${d.day}/${d.month} $hh:$mm';
  }

  @override
  Widget build(BuildContext context) {
    final status = _status;
    final supported = status?.supported ?? true;
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            _header(context),
            Expanded(
              child: ListView(
                padding: EdgeInsets.fromLTRB(16, 16, 16, 32 + MediaQuery.paddingOf(context).bottom),
                children: [
                  FadeRise(child: _hero()),
                  const SizedBox(height: 14),
                  FadeRise(delay: const Duration(milliseconds: 60), child: _statusPill(status)),
                  if (!supported) ...[
                    const SizedBox(height: 12),
                    _note(IosCopy.t('guide.needs16'), 'bell'),
                  ],
                  const SizedBox(height: 18),
                  FadeRise(
                    delay: const Duration(milliseconds: 100),
                    child: _part(1, IosCopy.t('guide.partA'), const ['guide.a1', 'guide.a2', 'guide.a3', 'guide.a4', 'guide.a5'], 1),
                  ),
                  const SizedBox(height: 12),
                  FadeRise(
                    delay: const Duration(milliseconds: 140),
                    child: _part(2, IosCopy.t('guide.partB'), const ['guide.b1', 'guide.b2', 'guide.b3', 'guide.b4'], 6),
                  ),
                  const SizedBox(height: 18),
                  _GoldButton(label: IosCopy.t('guide.openShortcuts'), icon: 'layers', onTap: _openShortcuts),
                  const SizedBox(height: 10),
                  _secondaryButton(),
                  const SizedBox(height: 6),
                  Center(
                    child: Text(
                      IosCopy.t('guide.testHint'),
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: AppColors.foreground.withValues(alpha: 0.55),
                      ),
                    ),
                  ),
                  const SizedBox(height: 18),
                  _part(3, IosCopy.t('guide.partC'), const ['guide.c1', 'guide.c2'], 0),
                  const SizedBox(height: 14),
                  _note(IosCopy.t('guide.safe'), 'shield-check'),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _header(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: AppColors.glass,
        border: Border(bottom: BorderSide(color: AppColors.glassBorder)),
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
        child: Row(
          children: [
            TapScale(
              scale: 0.9,
              onTap: () => Navigator.of(context).maybePop(),
              child: Container(
                width: 36,
                height: 36,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(14),
                  color: AppColors.foreground.withValues(alpha: 0.06),
                  border: Border.all(color: AppColors.foreground.withValues(alpha: 0.08)),
                ),
                child: LucideIcon('arrow-left', size: 18, color: AppColors.foreground.withValues(alpha: 0.8)),
              ),
            ),
            Expanded(
              child: Text(
                IosCopy.t('guide.title'),
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w900,
                  letterSpacing: -0.3,
                  color: AppColors.foreground,
                ),
              ),
            ),
            const SizedBox(width: 36),
          ],
        ),
      ),
    );
  }

  Widget _hero() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppColors.glassRaised, AppColors.card],
        ),
        border: Border.all(color: AppColors.goldBorder),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          SizedBox(
            width: 104,
            child: Container(
              padding: const EdgeInsets.all(3),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(20),
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [AppColors.premiumGoldGlow, AppColors.background, AppColors.premiumGold],
                ),
                boxShadow: [
                  BoxShadow(color: Colors.black.withValues(alpha: 0.45), blurRadius: 18, offset: const Offset(0, 10)),
                ],
              ),
              child: const IosWallpaperPreview(radius: 17),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  IosCopy.t('guide.heroTitle'),
                  style: TextStyle(
                    fontSize: 17,
                    height: 1.25,
                    fontWeight: FontWeight.w900,
                    letterSpacing: -0.3,
                    color: AppColors.foreground,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  IosCopy.t('guide.heroBody'),
                  style: TextStyle(
                    fontSize: 12.5,
                    height: 1.45,
                    fontWeight: FontWeight.w500,
                    color: AppColors.foreground.withValues(alpha: 0.72),
                  ),
                ),
                const SizedBox(height: 10),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(999),
                    color: AppColors.primary.withValues(alpha: 0.12),
                    border: Border.all(color: AppColors.primary.withValues(alpha: 0.28)),
                  ),
                  child: Text(
                    IosCopy.t('guide.time'),
                    style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: AppColors.primary),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _statusPill(IosAutomationStatus? s) {
    final active = s?.active ?? false;
    final last = s?.lastRun;
    final color = active ? const Color(0xFF34C759) : AppColors.foreground.withValues(alpha: 0.55);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        color: active ? const Color(0xFF34C759).withValues(alpha: 0.10) : AppColors.foreground.withValues(alpha: 0.04),
        border: Border.all(color: active ? const Color(0xFF34C759).withValues(alpha: 0.35) : AppColors.glassBorder),
      ),
      child: Row(
        children: [
          Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(shape: BoxShape.circle, color: color),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              active ? IosCopy.t('guide.status.active') : IosCopy.t('guide.status.idle'),
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: AppColors.foreground),
            ),
          ),
          if (last != null)
            Text(
              IosCopy.t('guide.status.last', {'time': _time(last)}),
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: AppColors.foreground.withValues(alpha: 0.55),
              ),
            ),
        ],
      ),
    );
  }

  Widget _part(int index, String title, List<String> keys, int firstStep) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 6),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(22),
        color: AppColors.card,
        border: Border.all(color: AppColors.glassBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 26,
                height: 26,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: LinearGradient(colors: [AppColors.premiumGoldGlow, AppColors.premiumGold]),
                ),
                child: Text(
                  '$index',
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w900, color: AppColors.background),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  title,
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w900,
                    letterSpacing: -0.2,
                    color: AppColors.foreground,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          for (var i = 0; i < keys.length; i++)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 22,
                    height: 22,
                    margin: const EdgeInsets.only(top: 1),
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(color: AppColors.primary.withValues(alpha: 0.45)),
                    ),
                    child: firstStep > 0
                        ? Text(
                            '${firstStep + i}',
                            style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w900, color: AppColors.primary),
                          )
                        : LucideIcon('chevron-right', size: 12, color: AppColors.primary, strokeWidth: 2.6),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      IosCopy.t(keys[i]),
                      style: TextStyle(
                        fontSize: 13.5,
                        height: 1.45,
                        fontWeight: FontWeight.w600,
                        color: AppColors.foreground.withValues(alpha: 0.86),
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

  Widget _secondaryButton() {
    return TapScale(
      scale: 0.97,
      onTap: _test,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          color: AppColors.glassRaised,
          border: Border.all(color: AppColors.primary.withValues(alpha: 0.42)),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            LucideIcon('play', size: 16, color: AppColors.primary, strokeWidth: 2.4),
            const SizedBox(width: 8),
            Text(
              IosCopy.t('guide.test'),
              style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w900, color: AppColors.primary),
            ),
          ],
        ),
      ),
    );
  }

  Widget _note(String text, String icon) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        color: AppColors.primary.withValues(alpha: 0.08),
        border: Border.all(color: AppColors.primary.withValues(alpha: 0.22)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          LucideIcon(icon, size: 16, color: AppColors.primary),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              text,
              style: TextStyle(
                fontSize: 12.5,
                height: 1.4,
                fontWeight: FontWeight.w600,
                color: AppColors.foreground.withValues(alpha: 0.8),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
