import 'dart:math' as math;

import 'package:flutter/material.dart';
import '../../widgets/lucide.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/services/haptics.dart';
import '../../core/services/share_service.dart';
import '../../widgets/app_toast.dart';
import '../today/today_shared.dart';
import 'devotional_backgrounds.dart';
import 'prayer_audio_button.dart';

/// 1:1 port of `src/components/devotional/DevotionalSlide.tsx` — Ken-Burns
/// background, vignette, golden rays, halo aura, rising embers, glass prayer
/// card, Amen chip with ripples, personal-prayer chip and the gold Continue CTA.
class DevotionalSlide extends StatefulWidget {
  const DevotionalSlide({
    super.key,
    required this.prayer,
    required this.prayerIndex,
    required this.bgIndex,
    required this.isActive,
    required this.slideNumber,
    required this.totalSlides,
    required this.musicReady,
    this.onOpenPersonalPrayer,
    this.onContinue,
    this.continueLabel,
  });

  final String prayer;
  final int prayerIndex;
  final int bgIndex;
  final bool isActive;
  final int slideNumber;
  final int totalSlides;
  final ValueNotifier<bool> musicReady;
  final VoidCallback? onOpenPersonalPrayer;
  final VoidCallback? onContinue;
  final String? continueLabel;

  @override
  State<DevotionalSlide> createState() => _DevotionalSlideState();
}

class _DevotionalSlideState extends State<DevotionalSlide>
    with TickerProviderStateMixin {
  late final AnimationController _ken = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 30),
  );
  late final AnimationController _rays = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 60),
  );
  late final AnimationController _aura = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 6),
  );
  late final AnimationController _embers = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 28),
  );

  bool _amenTapped = false;
  late int _amenCount;
  final _ripples = <int>[];

  // Sparse, slow-rising embers — deterministic per slide, same values as web.
  static const _emberSpecs = <_Ember>[
    _Ember(0.12, 0, 18, 18, 3),
    _Ember(0.28, 6, 22, -22, 2),
    _Ember(0.46, 11, 26, 12, 2.5),
    _Ember(0.64, 3, 20, -14, 3),
    _Ember(0.82, 9, 24, 20, 2),
    _Ember(0.92, 14, 28, -10, 2.5),
  ];

  @override
  void initState() {
    super.initState();
    _amenCount = math.Random().nextInt(12000) + 8000;
    if (widget.isActive) _startLoops();
  }

  @override
  void didUpdateWidget(DevotionalSlide old) {
    super.didUpdateWidget(old);
    if (widget.isActive && !old.isActive) {
      _startLoops();
    } else if (!widget.isActive && old.isActive) {
      _ken.stop();
      _rays.stop();
      _aura.stop();
      _embers.stop();
    }
  }

  void _startLoops() {
    _ken.repeat(reverse: true);
    _rays.repeat();
    _aura.repeat(reverse: true);
    _embers.repeat();
  }

  @override
  void dispose() {
    _ken.dispose();
    _rays.dispose();
    _aura.dispose();
    _embers.dispose();
    super.dispose();
  }

  Future<void> _handleShare() async {
    await haptic(HapticStyle.soft);
    final appLink = kAppPlayStoreUrl;
    final messages = [
      t('dev.slide.share.text1', {'prayer': widget.prayer, 'link': appLink}),
      t('dev.slide.share.text2', {'prayer': widget.prayer, 'link': appLink}),
      t('dev.slide.share.text3', {'prayer': widget.prayer, 'link': appLink}),
    ];
    final text = messages[math.Random().nextInt(messages.length)];
    await ShareService.share(
      title: t('dev.slide.share.title'),
      text: text,
      dialogTitle: t('dev.slide.share.dialog'),
    );
  }

  Future<void> _handleAmen() async {
    await haptic(HapticStyle.medium);
    if (!mounted) return;
    final id = DateTime.now().millisecondsSinceEpoch;
    setState(() {
      _amenTapped = true;
      _amenCount += 1;
      _ripples.add(id);
    });
    final msgs = [
      t('dev.amen.msg1'),
      t('dev.amen.msg2'),
      t('dev.amen.msg3'),
      t('dev.amen.msg4'),
      t('dev.amen.msg5'),
      t('dev.amen.msg6'),
    ];
    if (mounted) {
      AppToast.success(context, msgs[math.Random().nextInt(msgs.length)]);
    }
    Future.delayed(const Duration(milliseconds: 400), () {
      if (mounted) setState(() => _amenTapped = false);
    });
    Future.delayed(const Duration(milliseconds: 900), () {
      if (mounted && _ripples.isNotEmpty) {
        setState(() => _ripples.removeAt(0));
      }
    });
  }

  String get _amenFormatted => _amenCount >= 1000
      ? '${(_amenCount / 1000).toStringAsFixed(1)}K'
      : '$_amenCount';

  List<String> get _prayerLines => widget.prayer
      .replaceAll('. ', '.\n')
      .replaceAll(' Amen', '\nAmen')
      .split('\n')
      .where((l) => l.trim().isNotEmpty)
      .map((l) => l.trim())
      .toList();

  @override
  Widget build(BuildContext context) {
    final padTop = MediaQuery.paddingOf(context).top;
    final padBottom = MediaQuery.paddingOf(context).bottom;

    return Stack(
      fit: StackFit.expand,
      children: [
        // Background with slow Ken-Burns — only animates on the active slide.
        // Each animated layer gets its own repaint layer so one moving layer
        // never repaints the photo, the text and the buttons with it.
        RepaintBoundary(
          child: AnimatedBuilder(
            animation: _ken,
            builder: (context, child) => Transform.scale(
              scale: 1 + 0.08 * Curves.easeInOut.transform(_ken.value),
              child: child,
            ),
            child: Image.asset(
              kDevotionalBackgrounds[widget.bgIndex],
              fit: BoxFit.cover,
              gaplessPlayback: true,
              errorBuilder: (_, __, ___) =>
                  const ColoredBox(color: Color(0xFF050812)),
            ),
          ),
        ),

        // Cinematic vignette overlays
        IgnorePointer(
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                stops: const [0, 0.28, 0.52, 0.82, 1],
                colors: [
                  Colors.black.withValues(alpha: 0.42),
                  Colors.black.withValues(alpha: 0.18),
                  Colors.black.withValues(alpha: 0.18),
                  Colors.black.withValues(alpha: 0.6),
                  Colors.black.withValues(alpha: 0.82),
                ],
              ),
            ),
            child: const SizedBox.expand(),
          ),
        ),
        IgnorePointer(
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: RadialGradient(
                radius: 0.85,
                stops: const [0.38, 1],
                colors: [
                  Colors.transparent,
                  Colors.black.withValues(alpha: 0.5),
                ],
              ),
            ),
            child: const SizedBox.expand(),
          ),
        ),

        // Golden light rays from above — slow rotation, very soft
        IgnorePointer(
          child: RepaintBoundary(
          child: AnimatedBuilder(
            animation: _rays,
            builder: (context, _) => Align(
              alignment: Alignment.topCenter,
              child: FractionallySizedBox(
                heightFactor: 0.8,
                widthFactor: 1.6,
                child: Transform.rotate(
                  angle: _rays.value * 2 * math.pi,
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: SweepGradient(
                        center: Alignment.topCenter,
                        colors: [
                          Colors.transparent,
                          const Color(0xFFFFD278).withValues(alpha: 0.10),
                          Colors.transparent,
                          const Color(0xFFFFC85A).withValues(alpha: 0.08),
                          Colors.transparent,
                          const Color(0xFFFFDC8C).withValues(alpha: 0.10),
                          Colors.transparent,
                        ],
                        stops: const [0, 0.05, 0.1, 0.17, 0.22, 0.3, 0.39],
                      ),
                    ),
                    child: const SizedBox.expand(),
                  ),
                ),
              ),
            ),
          ),
          ),
        ),

        // Halo aura behind the card — pulses softly with Amen taps
        IgnorePointer(
          child: Center(
            child: RepaintBoundary(
            child: AnimatedBuilder(
              animation: _aura,
              builder: (context, _) {
                final pulse =
                    0.9 + 0.12 * Curves.easeInOut.transform(_aura.value);
                final boost = _amenTapped ? 1.4 : 1.0;
                return Transform.scale(
                  scale: pulse,
                  child: Container(
                    width: 420,
                    height: 420,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: RadialGradient(
                        stops: const [0, 0.35, 0.7],
                        colors: [
                          const Color(
                            0xFFFFC85A,
                          ).withValues(alpha: (0.18 * boost).clamp(0, 1)),
                          const Color(
                            0xFFFFB43C,
                          ).withValues(alpha: (0.08 * boost).clamp(0, 1)),
                          Colors.transparent,
                        ],
                      ),
                    ),
                  ),
                );
              },
            ),
            ),
          ),
        ),

        // Floating embers — sparse, rising slowly
        if (widget.isActive)
          IgnorePointer(
            child: RepaintBoundary(
              child: LayoutBuilder(
                builder: (context, c) => AnimatedBuilder(
                  animation: _embers,
                  builder: (context, _) => Stack(
                    children: [
                      for (final e in _emberSpecs)
                        _emberDot(e, c.maxWidth, c.maxHeight),
                    ],
                  ),
                ),
              ),
            ),
          ),

        // Content
        Positioned.fill(
          child: Padding(
            // +24 bottom so the Amen / "Pray for someone" / Continue stack can
            // never sit under the S23 Ultra gesture bar.
            padding: EdgeInsets.fromLTRB(16, padTop + 24, 16, padBottom + 24),
            child: Column(
              children: [
                // Slim audio control
                FadeRise(
                  offsetY: -10,
                  child: Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: PrayerAudioButton(
                      prayerIndex: widget.prayerIndex,
                      isActive: widget.isActive,
                      musicReady: widget.musicReady,
                    ),
                  ),
                ),

                // Prayer card
                Expanded(
                  child: Center(
                    child: FadeRise(
                      offsetY: 0,
                      delay: const Duration(milliseconds: 150),
                      duration: const Duration(milliseconds: 600),
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 380),
                        child: Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(20),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.07),
                            borderRadius: BorderRadius.circular(26),
                            border: Border.all(
                              color: Colors.white.withValues(alpha: 0.13),
                            ),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.28),
                                blurRadius: 28,
                                offset: const Offset(0, 8),
                              ),
                            ],
                          ),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              _hairline(),
                              const SizedBox(height: 12),
                              Flexible(
                                child: SingleChildScrollView(
                                  physics: const ClampingScrollPhysics(),
                                  child: Column(
                                    children: [
                                      for (
                                        var i = 0;
                                        i < _prayerLines.length;
                                        i++
                                      )
                                        FadeRise(
                                          offsetY: 10,
                                          delay: Duration(
                                            milliseconds: 200 + i * 80,
                                          ),
                                          child: Padding(
                                            padding: const EdgeInsets.only(
                                              bottom: 4,
                                            ),
                                            child: Text(
                                              _prayerLines[i],
                                              textAlign: TextAlign.center,
                                              style: TextStyle(
                                                fontFamily: kSerif,
                                                fontFamilyFallback:
                                                    kSerifFallback,
                                                fontSize: 16.5,
                                                height: 1.6,
                                                fontWeight: FontWeight.w300,
                                                color: Colors.white.withValues(
                                                  alpha: 0.95,
                                                ),
                                              ),
                                            ),
                                          ),
                                        ),
                                    ],
                                  ),
                                ),
                              ),
                              const SizedBox(height: 12),
                              _hairline(),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ),

                // Bottom actions
                FadeRise(
                  offsetY: 20,
                  delay: const Duration(milliseconds: 400),
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 420),
                    child: Column(
                      children: [
                        const SizedBox(height: 16),
                        Row(
                          children: [
                            Expanded(child: _amenChip()),
                            if (widget.onOpenPersonalPrayer != null) ...[
                              const SizedBox(width: 8),
                              Expanded(child: _personalChip()),
                            ],
                          ],
                        ),
                        if (widget.onContinue != null) ...[
                          const SizedBox(height: 10),
                          _continueCta(),
                        ],
                        if (widget.slideNumber == 1 && widget.totalSlides > 1)
                          Padding(
                            padding: const EdgeInsets.only(top: 2),
                            child: _SwipeHint(),
                          ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),

        // Floating share button — tucked into the top-right corner
        Positioned(
          top: padTop + 9.6,
          right: 9.6,
          child: TapScale(
            scale: 0.88,
            onTap: _handleShare,
            child: Container(
              width: 36,
              height: 36,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white.withValues(alpha: 0.1),
                border: Border.all(color: Colors.white.withValues(alpha: 0.16)),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.35),
                    blurRadius: 14,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: LucideIcon(
                'share-2',
                size: 15,
                color: Colors.white.withValues(alpha: 0.9),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _hairline() => Container(
    width: 40,
    height: 1,
    color: Colors.white.withValues(alpha: 0.18),
  );

  Widget _emberDot(_Ember e, double w, double h) {
    final total = _embers.duration!.inMilliseconds / 1000;
    final phase = ((_embers.value * total + (total - e.delay)) % e.dur) / e.dur;
    final y = h * (1 - phase);
    final opacity = phase < 0.1
        ? phase / 0.1
        : phase > 0.85
        ? (1 - phase) / 0.15
        : 1.0;
    return Positioned(
      left: e.left * w + e.drift * phase,
      top: y,
      child: Opacity(
        opacity: opacity.clamp(0, 1),
        child: Container(
          width: e.size,
          height: e.size,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: RadialGradient(
              colors: [
                const Color(0xFFFFDC8C).withValues(alpha: 0.95),
                const Color(0xFFFFB43C).withValues(alpha: 0.5),
                Colors.transparent,
              ],
              stops: const [0, 0.6, 1],
            ),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFFFFC85A).withValues(alpha: 0.7),
                blurRadius: 6,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _amenChip() {
    final onColor = _amenTapped
        ? const Color(0xFF3A2000)
        : const Color(0xFFFFE7A3);
    return TapScale(
      scale: 0.95,
      onTap: _handleAmen,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(999),
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: _amenTapped
                ? [
                    const Color(0xFFF6D365).withValues(alpha: 0.95),
                    const Color(0xFFFDA085).withValues(alpha: 0.95),
                  ]
                : [
                    const Color(0xFFFFD700).withValues(alpha: 0.22),
                    const Color(0xFFFFB432).withValues(alpha: 0.18),
                  ],
          ),
          border: Border.all(
            color: const Color(0xFFFFD700).withValues(alpha: 0.45),
          ),
          boxShadow: [
            BoxShadow(
              color: _amenTapped
                  ? const Color(0xFFFFD700).withValues(alpha: 0.45)
                  : const Color(0xFFFFB432).withValues(alpha: 0.25),
              blurRadius: _amenTapped ? 20 : 10,
              spreadRadius: _amenTapped ? 0 : -2,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              '🙏 ${t('dev.slide.amen')}',
              maxLines: 1,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.3,
                color: onColor,
              ),
            ),
            const SizedBox(width: 6),
            Text(
              '· $_amenFormatted',
              maxLines: 1,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                fontFeatures: const [FontFeature.tabularFigures()],
                color: onColor.withValues(alpha: 0.8),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _personalChip() {
    return TapScale(
      scale: 0.95,
      onTap: () async {
        await haptic(HapticStyle.medium);
        widget.onOpenPersonalPrayer?.call();
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(999),
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              const Color(0xFFFFD700).withValues(alpha: 0.18),
              const Color(0xFFFFB432).withValues(alpha: 0.12),
            ],
          ),
          border: Border.all(
            color: const Color(0xFFFFD700).withValues(alpha: 0.35),
          ),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFFFFB432).withValues(alpha: 0.25),
              blurRadius: 12,
              spreadRadius: -2,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.star_rounded, size: 14, color: Color(0xFFFFD76A)),
            const SizedBox(width: 6),
            Flexible(
              child: Text(
                t('dev.slide.prayForSomeone'),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  letterSpacing: -0.2,
                  color: const Color(0xFFFEF3C7).withValues(alpha: 0.95),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _continueCta() {
    return TapScale(
      scale: 0.97,
      onTap: () async {
        await haptic(HapticStyle.medium);
        widget.onContinue?.call();
      },
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 24),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(999),
          gradient: const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFFFFD76A), Color(0xFFFFB83A)],
          ),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFFFFB432).withValues(alpha: 0.6),
              blurRadius: 22,
              spreadRadius: -6,
              offset: const Offset(0, 8),
            ),
            BoxShadow(
              color: const Color(0xFFFFD700).withValues(alpha: 0.28),
              blurRadius: 22,
            ),
          ],
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              widget.continueLabel ?? t('dev.slide.continue'),
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w900,
                letterSpacing: 0.3,
                color: Color(0xFF2A1700),
              ),
            ),
            const SizedBox(width: 8),
            const Text(
              '→',
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w900,
                color: Color(0xFF2A1700),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Ember {
  const _Ember(this.left, this.delay, this.dur, this.drift, this.size);
  final double left;
  final double delay;
  final double dur;
  final double drift;
  final double size;
}

/// Gently bobbing swipe hint (`animate={{ y: [0,-4,0] }}`, 1.5s loop).
class _SwipeHint extends StatefulWidget {
  @override
  State<_SwipeHint> createState() => _SwipeHintState();
}

class _SwipeHintState extends State<_SwipeHint>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1500),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _c,
      builder: (context, child) => Transform.translate(
        offset: Offset(0, -4 * Curves.easeInOut.transform(_c.value)),
        child: child,
      ),
      child: Text(
        t('dev.slide.swipeHint'),
        textAlign: TextAlign.center,
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w500,
          color: Colors.white.withValues(alpha: 0.35),
        ),
      ),
    );
  }
}
