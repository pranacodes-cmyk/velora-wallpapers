import 'dart:async';

import 'package:flutter/material.dart';
import 'package:just_audio/just_audio.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/services/haptics.dart';
import '../../core/services/journey_narration_audio.dart';
import '../../core/services/journey_narration_script.dart';
import '../../core/services/journey_rich_content.dart';
import '../../core/theme/app_colors.dart';
import '../../widgets/lucide.dart';
import '../today/today_shared.dart' show hsl, TapScale;
import 'reflection_sheet.dart';

/// 1:1 port of `src/components/journey/RichDayExperience.tsx` plus the
/// `NarrationPlayer` header control. Renders a paced, multi-slide guided
/// devotional for days that have rich content instead of the default
/// 2-stage reader.
class RichDayExperience extends StatefulWidget {
  const RichDayExperience({
    super.key,
    required this.hue,
    required this.journeyId,
    required this.journeyTitle,
    required this.journeyEmoji,
    required this.day,
    required this.rich,
    required this.onExit,
    required this.onComplete,
  });

  final double hue;
  final String journeyId;
  final String journeyTitle;
  final String journeyEmoji;
  final int day;
  final RichDay rich;
  final VoidCallback onExit;
  final VoidCallback onComplete;

  @override
  State<RichDayExperience> createState() => _RichDayExperienceState();
}

class _RichDayExperienceState extends State<RichDayExperience> {
  int _index = 0;
  final Set<int> _checked = {};
  late List<double> _boundaries = narrationSlideBoundaries(widget.rich);
  int _lastAutoIdx = 0;
  final _scrollController = ScrollController();

  int get _total => widget.rich.slides.length;
  RichSlide get _slide => widget.rich.slides[_index];
  bool get _isLast => _index == _total - 1;

  void _handleNarrationProgress(double ratio, bool playing) {
    if (!playing) return;
    const lead = 0.01;
    var target = 0;
    for (var i = 0; i < _boundaries.length; i++) {
      if (ratio + lead < _boundaries[i]) {
        target = i;
        break;
      }
      target = i;
    }
    if (target > _lastAutoIdx) {
      _lastAutoIdx = target;
      if (target > _index && mounted) setState(() => _index = target);
    }
  }

  void _resetScroll() {
    if (_scrollController.hasClients) {
      _scrollController.jumpTo(0);
    }
  }

  void _next() {
    haptic(HapticStyle.medium);
    if (_isLast) {
      showReflectionSheet(
        context,
        context_: '${widget.journeyTitle} · Day ${widget.day}',
        hue: widget.hue,
        day: widget.day,
        onClose: widget.onComplete,
      );
    } else {
      setState(() => _index++);
      _resetScroll();
    }
  }

  void _prev() {
    haptic(HapticStyle.soft);
    if (_index == 0) {
      widget.onExit();
    } else {
      setState(() => _index--);
      _resetScroll();
    }
  }

  @override
  Widget build(BuildContext context) {
    final hue = widget.hue;
    return Scaffold(
      backgroundColor: AppColors.background,
      body: DecoratedBox(
        decoration: BoxDecoration(
          gradient: RadialGradient(
            center: Alignment.topLeft,
            radius: 1.4,
            colors: [hsl(hue, 60, 22, 0.55), Colors.transparent],
            stops: const [0, 0.55],
          ),
        ),
        child: SafeArea(
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                child: Row(
                  children: [
                    TapScale(
                      onTap: _prev,
                      child: Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          color: AppColors.fg(0.06),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: AppColors.fg(0.1),
                          ),
                        ),
                        child: LucideIcon(
                          'chevron-left',
                          color: AppColors.foreground,
                          size: 20,
                        ),
                      ),
                    ),
                    Expanded(
                      child: Text(
                        t('jn.rich.progress', {
                          'emoji': widget.journeyEmoji,
                          'title': widget.journeyTitle,
                          'day': widget.day,
                        }),
                        textAlign: TextAlign.center,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 9.5,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 9.5 * 0.18,
                          color: AppColors.fg(0.55),
                        ),
                      ),
                    ),
                    _NarrationPlayer(
                      journeyId: widget.journeyId,
                      day: widget.day,
                      hue: hue,
                      activeSlideIndex: _index,
                      boundaries: _boundaries,
                      onProgress: _handleNarrationProgress,
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
                child: Row(
                  children: [
                    for (var i = 0; i < _total; i++) ...[
                      if (i > 0) const SizedBox(width: 6),
                      Expanded(
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 500),
                          height: 4,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(999),
                            color: (i <= _index)
                                ? hsl(hue, 75, 60)
                                : AppColors.fg(0.1),
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              Expanded(
                child: SingleChildScrollView(
                  controller: _scrollController,
                  padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                  child: AnimatedSwitcher(
                    duration: const Duration(milliseconds: 350),
                    child: Column(
                      key: ValueKey(_index),
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        _SlideBody(
                          slide: _slide,
                          hue: hue,
                          checked: _checked,
                          onToggle: (i) {
                            haptic(HapticStyle.soft);
                            setState(() {
                              if (!_checked.remove(i)) _checked.add(i);
                            });
                          },
                        ),
                        const SizedBox(height: 28),
                        TapScale(
                          scale: 0.97,
                          onTap: _next,
                          child: Container(
                            width: double.infinity,
                            padding: const EdgeInsets.symmetric(vertical: 16),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(20),
                              gradient: LinearGradient(
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                                colors: [hsl(hue, 70, 55), hsl(hue, 75, 45)],
                              ),
                              boxShadow: [
                                BoxShadow(
                                  color: hsl(hue, 70, 45, 0.7),
                                  blurRadius: 32,
                                  spreadRadius: -10,
                                  offset: const Offset(0, 12),
                                ),
                              ],
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                if (_isLast) ...[
                                  LucideIcon(
                                    'check',
                                    size: 16,
                                    color: Colors.white,
                                  ),
                                  const SizedBox(width: 8),
                                ],
                                Text(
                                  _slide.continueLabel,
                                  style: TextStyle(
                                    fontSize: 15,
                                    fontWeight: FontWeight.w800,
                                    color: Colors.white,
                                  ),
                                ),
                                if (!_isLast) ...[
                                  const SizedBox(width: 8),
                                  Icon(
                                    Icons.arrow_forward,
                                    size: 16,
                                    color: Colors.white,
                                  ),
                                ],
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(height: 12),
                        Text(
                          t('jn.rich.slideCount', {
                            'current': _index + 1,
                            'total': _total,
                          }),
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 10 * 0.22,
                            color: AppColors.fg(0.4),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SlideBody extends StatelessWidget {
  const _SlideBody({
    required this.slide,
    required this.hue,
    required this.checked,
    required this.onToggle,
  });

  final RichSlide slide;
  final double hue;
  final Set<int> checked;
  final void Function(int) onToggle;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: 4),
        Text(
          slide.eyebrow,
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w800,
            letterSpacing: 10 * 0.3,
            color: hsl(hue, 75, 72),
          ),
        ),
        const SizedBox(height: 12),
        Text(
          slide.title,
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 26,
            fontWeight: FontWeight.w900,
            letterSpacing: -0.5,
            height: 1.15,
            color: AppColors.foreground,
          ),
        ),
        const SizedBox(height: 22),
        if (slide.kind == RichSlideKind.opening)
          Center(
            child: Container(
              width: 96,
              height: 96,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [hsl(hue, 80, 60, 0.35), hsl(hue, 70, 40, 0.05)],
                  stops: const [0, 0.7],
                ),
                border: Border.all(color: hsl(hue, 80, 65, 0.4)),
                boxShadow: [
                  BoxShadow(color: hsl(hue, 80, 55, 0.35), blurRadius: 60),
                ],
              ),
              child: Icon(
                Icons.air,
                size: 24,
                color: AppColors.fg(0.8),
              ),
            ),
          ),
        if (slide.kind == RichSlideKind.opening) const SizedBox(height: 26),
        if (slide.kind == RichSlideKind.verse && slide.verse != null)
          Container(
            padding: const EdgeInsets.all(22),
            margin: const EdgeInsets.only(bottom: 26),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [hsl(hue, 45, 12), hsl(hue, 55, 8)],
              ),
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: hsl(hue, 70, 55, 0.35)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  slide.verse!,
                  style: TextStyle(
                    fontSize: 18,
                    height: 1.7,
                    color: Colors.white,
                  ),
                ),
                if (slide.reference != null) ...[
                  const SizedBox(height: 14),
                  Text(
                    '— ${slide.reference}',
                    style: TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w800,
                      color: hsl(hue, 80, 75),
                    ),
                  ),
                ],
              ],
            ),
          ),
        for (final p in slide.paragraphs)
          Padding(
            padding: const EdgeInsets.only(bottom: 14),
            child: Text(
              p,
              style: TextStyle(
                fontSize: 16.5,
                height: 1.72,
                color: AppColors.fg(0.9),
              ),
            ),
          ),
        if (slide.breathPrayer != null)
          Container(
            margin: const EdgeInsets.only(top: 14),
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: hsl(hue, 50, 14, 0.55),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: hsl(hue, 70, 58, 0.28)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  t('jn.rich.breathPrayer'),
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 10 * 0.22,
                    color: hsl(hue, 80, 75),
                  ),
                ),
                const SizedBox(height: 10),
                RichText(
                  text: TextSpan(
                    style: TextStyle(
                      fontSize: 15.5,
                      height: 1.55,
                      color: AppColors.foreground,
                    ),
                    children: [
                      TextSpan(
                        text: '${t('jn.rich.inhale')} ',
                        style: TextStyle(
                          fontWeight: FontWeight.w800,
                          color: hsl(hue, 85, 78),
                        ),
                      ),
                      TextSpan(text: slide.breathPrayer!.inhale),
                    ],
                  ),
                ),
                const SizedBox(height: 6),
                RichText(
                  text: TextSpan(
                    style: TextStyle(
                      fontSize: 15.5,
                      height: 1.55,
                      color: AppColors.foreground,
                    ),
                    children: [
                      TextSpan(
                        text: '${t('jn.rich.exhale')} ',
                        style: TextStyle(
                          fontWeight: FontWeight.w800,
                          color: hsl(hue, 85, 78),
                        ),
                      ),
                      TextSpan(text: slide.breathPrayer!.exhale),
                    ],
                  ),
                ),
              ],
            ),
          ),
        if (slide.prayer != null)
          Container(
            margin: const EdgeInsets.only(top: 12),
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [hsl(hue, 45, 12), hsl(hue, 55, 8)],
              ),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: hsl(hue, 70, 55, 0.3)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  t('jn.rich.prayWithMe'),
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 10 * 0.22,
                    color: hsl(hue, 80, 75),
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  slide.prayer!,
                  style: TextStyle(
                    fontSize: 16,
                    height: 1.65,
                    fontStyle: FontStyle.italic,
                    color: AppColors.fg(0.95),
                  ),
                ),
              ],
            ),
          ),
        if (slide.tinyActions != null && slide.tinyActions!.isNotEmpty)
          Container(
            margin: const EdgeInsets.only(top: 12),
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: AppColors.fg(0.05),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: AppColors.fg(0.1)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  t('jn.rich.oneSmallThing'),
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 10 * 0.22,
                    color: AppColors.fg(0.55),
                  ),
                ),
                const SizedBox(height: 10),
                for (var i = 0; i < slide.tinyActions!.length; i++)
                  GestureDetector(
                    onTap: () => onToggle(i),
                    child: Container(
                      margin: const EdgeInsets.only(bottom: 6),
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: checked.contains(i)
                            ? hsl(hue, 60, 45, 0.15)
                            : Colors.transparent,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            width: 20,
                            height: 20,
                            margin: const EdgeInsets.only(top: 2),
                            decoration: BoxDecoration(
                              color: checked.contains(i)
                                  ? hsl(hue, 75, 55)
                                  : Colors.transparent,
                              borderRadius: BorderRadius.circular(6),
                              border: Border.all(
                                color: checked.contains(i)
                                    ? hsl(hue, 75, 55)
                                    : AppColors.fg(0.3),
                                width: 1.5,
                              ),
                            ),
                            child: checked.contains(i)
                                ? LucideIcon(
                                    'check',
                                    size: 14,
                                    color: Colors.white,
                                  )
                                : null,
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              slide.tinyActions![i],
                              style: TextStyle(
                                fontSize: 14.5,
                                height: 1.5,
                                color: checked.contains(i)
                                    ? AppColors.fg(0.55)
                                    : AppColors.fg(0.92),
                                decoration: checked.contains(i)
                                    ? TextDecoration.lineThrough
                                    : null,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ),
      ],
    );
  }
}

/// Narration control shown in the header — ports `NarrationPlayer.tsx` onto
/// the Flutter app's existing narration-audio resolver (pre-generated R2
/// files, no on-demand backend synthesis client-side).
class _NarrationPlayer extends StatefulWidget {
  const _NarrationPlayer({
    required this.journeyId,
    required this.day,
    required this.hue,
    required this.activeSlideIndex,
    required this.boundaries,
    required this.onProgress,
  });

  final String journeyId;
  final int day;
  final double hue;
  final int activeSlideIndex;
  final List<double> boundaries;
  final void Function(double ratio, bool playing) onProgress;

  @override
  State<_NarrationPlayer> createState() => _NarrationPlayerState();
}

class _NarrationPlayerState extends State<_NarrationPlayer> {
  String? _url;
  AudioPlayer? _player;
  bool _loading = true;
  bool _playing = false;
  double _progress = 0;
  final _subs = <StreamSubscription<dynamic>>[];
  int _lastSyncedSlide = -1;
  bool _userPaused = false;
  int _resolveGeneration = 0;

  @override
  void initState() {
    super.initState();
    _resolve();
  }

  @override
  void didUpdateWidget(covariant _NarrationPlayer old) {
    super.didUpdateWidget(old);
    if (old.journeyId != widget.journeyId || old.day != widget.day) {
      _disposePlayer();
      _userPaused = false;
      setState(() {
        _url = null;
        _loading = true;
        _playing = false;
        _progress = 0;
      });
      _resolve();
    }
    if (old.activeSlideIndex != widget.activeSlideIndex) {
      _syncToActiveSlide();
    }
  }

  @override
  void dispose() {
    _disposePlayer();
    super.dispose();
  }

  void _disposePlayer() {
    _resolveGeneration += 1;
    for (final s in _subs) {
      s.cancel();
    }
    _subs.clear();
    _player?.dispose();
    _player = null;
  }

  Future<void> _resolve() async {
    final generation = ++_resolveGeneration;
    // Match React exactly: only English chapters prefetch and autoplay.
    // Other languages do not probe an English narration URL.
    if (L10n.current.lang != 'en') {
      if (mounted && generation == _resolveGeneration) {
        setState(() => _loading = false);
      }
      return;
    }
    final url = await JourneyNarrationAudio.resolve(
      widget.journeyId,
      widget.day,
    );
    if (!mounted || generation != _resolveGeneration) return;
    setState(() {
      _url = url;
      _loading = false;
    });
    // Match the web experience: narration starts automatically for English
    // chapters only. Other languages keep the visible Listen control.
    if (url != null && !_userPaused) {
      try {
        final p = await _ensurePlayer(url);
        if (mounted && generation == _resolveGeneration && !_userPaused) {
          await p.play().catchError((_) {});
        }
      } catch (_) {
        // Keep the chapter usable when a narration file is unavailable.
        if (mounted && generation == _resolveGeneration) {
          setState(() => _url = null);
        }
      }
    }
  }

  Future<AudioPlayer> _ensurePlayer(String url) async {
    final existing = _player;
    if (existing != null) return existing;
    final p = AudioPlayer();
    _subs.add(
      p.positionStream.listen((pos) {
        final d = p.duration;
        if (d != null && d.inMilliseconds > 0) {
          final ratio = pos.inMilliseconds / d.inMilliseconds;
          if (mounted) setState(() => _progress = ratio);
          widget.onProgress(ratio, p.playing);
        }
      }),
    );
    _subs.add(
      p.playerStateStream.listen((state) {
        if (!mounted) return;
        final playing =
            state.playing && state.processingState != ProcessingState.completed;
        setState(() {
          _playing = playing;
          if (state.processingState == ProcessingState.completed) _progress = 1;
        });
        widget.onProgress(_progress, playing);
      }),
    );
    _player = p;
    try {
      await p.setUrl(url);
    } catch (_) {
      if (identical(_player, p)) _player = null;
      for (final s in _subs) {
        await s.cancel();
      }
      _subs.clear();
      await p.dispose();
      rethrow;
    }
    return p;
  }

  void _syncToActiveSlide() {
    final p = _player;
    final d = p?.duration;
    if (p == null || d == null || d.inMilliseconds <= 0) return;
    if (widget.boundaries.isEmpty) return;
    if (_lastSyncedSlide == widget.activeSlideIndex) return;
    final i = widget.activeSlideIndex;
    final startRatio = i == 0 ? 0.0 : widget.boundaries[i - 1];
    final endRatio = i < widget.boundaries.length ? widget.boundaries[i] : 1.0;
    final current = p.position.inMilliseconds / d.inMilliseconds;
    const tol = 0.005;
    if (current < startRatio - tol || current > endRatio + tol) {
      p.seek(Duration(milliseconds: (startRatio * d.inMilliseconds).round()));
    }
    _lastSyncedSlide = i;
  }

  /// Web parity (`ensureUrl` in NarrationPlayer.tsx): the pill is always
  /// tappable, and the narration URL is resolved lazily on the first tap for
  /// languages that never prefetch.
  Future<String?> _ensureUrl() async {
    if (_url != null) return _url;
    if (mounted) setState(() => _loading = true);
    final url = await JourneyNarrationAudio.resolve(
      widget.journeyId,
      widget.day,
    );
    if (!mounted) return url;
    setState(() {
      _url = url;
      _loading = false;
    });
    return url;
  }

  Future<void> _toggle() async {
    haptic(HapticStyle.soft);
    final url = await _ensureUrl();
    if (url == null || !mounted) return;
    try {
      final p = await _ensurePlayer(url);
      if (_playing) {
        _userPaused = true;
        await p.pause();
      } else {
        _userPaused = false;
        await p.play().catchError((_) {});
      }
    } catch (_) {
      // Narration file unavailable — keep the chapter usable.
    }
  }

  @override
  Widget build(BuildContext context) {
    return TapScale(
      onTap: _toggle,
      child: Container(
        // Web: pl-1.5 pr-3 py-1.5 around a 28px control = 40px tall pill,
        // vertically centred against the 40px glass back button.
        height: 40,
        width: 116,
        margin: const EdgeInsets.only(left: 8),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(999),
          color: AppColors.glass,
          border: Border.all(color: AppColors.glassBorder),
        ),
        clipBehavior: Clip.antiAlias,
        child: Stack(
          children: [
            FractionallySizedBox(
              widthFactor: _progress.clamp(0, 1).toDouble(),
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      hsl(widget.hue, 70, 55, 0.28),
                      hsl(widget.hue, 80, 65, 0.18),
                    ],
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.only(left: 6, right: 12),
              child: Row(
                mainAxisSize: MainAxisSize.max,
                children: [
                  Container(
                    width: 28,
                    height: 28,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [
                          hsl(widget.hue, 75, 60),
                          hsl(widget.hue, 80, 48),
                        ],
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: hsl(widget.hue, 70, 45, 0.55),
                          blurRadius: 14,
                          spreadRadius: -2,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: _loading
                        ? const Padding(
                            padding: EdgeInsets.all(7),
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : Icon(
                            _playing ? Icons.pause : Icons.play_arrow,
                            size: 15,
                            color: Colors.white,
                          ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      _loading
                          ? t('jn.narration.preparing')
                          : _playing
                          ? t('jn.narration.listening')
                          : t('jn.narration.listen'),
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: AppColors.foreground.withValues(alpha: 0.85),
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        letterSpacing: -0.2,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
