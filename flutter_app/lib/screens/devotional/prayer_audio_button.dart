import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:just_audio/just_audio.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/services/analytics.dart';
import '../../core/services/audio_session_setup.dart';
import '../../core/services/haptics.dart';
import '../../core/services/prayer_audio.dart';
import '../../state/app_providers.dart';
import '../../widgets/premium_sheet.dart';
import '../today/today_shared.dart';

/// 1:1 port of `src/components/devotional/PrayerAudioButton.tsx`.
///
/// Premium → full auto-play experience (starts once the ambient music is
/// audible). Free → muted pill with the narration duration that opens the
/// Premium sheet.
class PrayerAudioButton extends ConsumerStatefulWidget {
  const PrayerAudioButton({
    super.key,
    required this.prayerIndex,
    required this.isActive,
    required this.musicReady,
  });

  final int prayerIndex;
  final bool isActive;

  /// Stands in for the web `prayer-music-ready` window event.
  final ValueNotifier<bool> musicReady;

  @override
  ConsumerState<PrayerAudioButton> createState() => _PrayerAudioButtonState();
}

class _PrayerAudioButtonState extends ConsumerState<PrayerAudioButton> {
  String? _url;
  AudioPlayer? _player;
  bool _playing = false;
  bool _loading = false;
  double _progress = 0;
  Duration _duration = Duration.zero;
  bool _userPaused = false;
  bool _hasError = false;
  Timer? _startTimer;
  final _subs = <StreamSubscription<dynamic>>[];

  @override
  void initState() {
    super.initState();
    _resolve();
    widget.musicReady.addListener(_onMusicReady);
  }

  @override
  void didUpdateWidget(PrayerAudioButton old) {
    super.didUpdateWidget(old);
    if (old.prayerIndex != widget.prayerIndex) {
      _disposePlayer();
      setState(() {
        _url = null;
        _progress = 0;
        _duration = Duration.zero;
        _userPaused = false;
        _hasError = false;
      });
      _resolve();
    }
    if (old.isActive && !widget.isActive) {
      _player?.pause();
    }
    if (!old.isActive && widget.isActive) {
      _maybeAutoPlay();
    }
  }

  @override
  void dispose() {
    widget.musicReady.removeListener(_onMusicReady);
    _startTimer?.cancel();
    _disposePlayer();
    super.dispose();
  }

  void _disposePlayer() {
    for (final s in _subs) {
      s.cancel();
    }
    _subs.clear();
    _player?.dispose();
    _player = null;
    _playing = false;
    _loading = false;
  }

  Future<void> _resolve() async {
    await AppAudioSession.ensure();
    final url = await PrayerAudio.resolve(widget.prayerIndex);
    if (!mounted) return;
    setState(() => _url = url);
    if (url == null) return;
    // Auto-play must never wait on the duration probe — a slow network made
    // narration silently miss its start window on device.
    _maybeAutoPlay();
    _probeDuration(url);
  }

  /// Fire-and-forget metadata probe so the pill can advertise the length.
  Future<void> _probeDuration(String url) async {
    final probe = AudioPlayer(handleAudioSessionActivation: false);
    try {
      final d = await probe.setUrl(url);
      if (mounted && d != null && _duration == Duration.zero) {
        setState(() => _duration = d);
      }
    } catch (_) {
      // Duration is decorative — the real player reports it once playing.
    } finally {
      await probe.dispose();
    }
  }

  AudioPlayer _ensurePlayer(String src) {
    final existing = _player;
    if (existing != null) return existing;
    // The ambient music bed owns the audio session; this player must mix into
    // it instead of requesting focus and muting itself.
    final p = AudioPlayer(handleAudioSessionActivation: false);
    _subs.add(
      p.positionStream.listen((pos) {
        final total = p.duration;
        if (total != null && total.inMilliseconds > 0 && mounted) {
          setState(() => _progress = pos.inMilliseconds / total.inMilliseconds);
        }
      }),
    );
    _subs.add(
      p.playerStateStream.listen((state) {
        if (!mounted) return;
        setState(() {
          _playing =
              state.playing &&
              state.processingState != ProcessingState.completed;
          _loading =
              state.processingState == ProcessingState.loading ||
              state.processingState == ProcessingState.buffering;
          if (state.processingState == ProcessingState.completed) _progress = 1;
        });
      }),
    );
    _subs.add(
      p.durationStream.listen((d) {
        if (d != null && mounted) setState(() => _duration = d);
      }),
    );
    p.setUrl(src).catchError((_) {
      if (mounted) setState(() => _hasError = true);
      return null;
    });
    _player = p;
    return p;
  }

  void _onMusicReady() => _maybeAutoPlay();

  /// Premium auto-play: wait until the ambient music has actually started so
  /// narration never beats the music to the user's ears (350ms grace, 2.5s
  /// safety fallback — same numbers as web).
  void _maybeAutoPlay() {
    if (!ref.read(premiumProvider)) return;
    if (!widget.isActive || _url == null || _userPaused) return;
    if (_player?.playing == true) return;
    _startTimer?.cancel();
    final delay = widget.musicReady.value
        ? const Duration(milliseconds: 350)
        : const Duration(milliseconds: 2500);
    _startTimer = Timer(delay, () {
      if (!mounted || !widget.isActive || _userPaused) return;
      final url = _url;
      if (url == null) return;
      setState(() {
        _loading = true;
        _hasError = false;
      });
      _ensurePlayer(url).play().catchError((_) {
        if (mounted)
          setState(() {
            _loading = false;
            _hasError = true;
          });
      });
    });
  }

  Future<void> _togglePremium() async {
    final url = _url;
    if (url == null) return;
    await haptic(HapticStyle.soft);
    final p = _ensurePlayer(url);
    if (_playing) {
      _userPaused = true;
      await p.pause();
    } else {
      _userPaused = false;
      setState(() => _loading = true);
      Analytics.capture('prayer_played', {
        'prayer_index': widget.prayerIndex,
        'trigger': 'manual',
      });
      try {
        await p.play();
        if (mounted) setState(() => _hasError = false);
      } catch (_) {
        if (mounted) setState(() => _hasError = true);
      }
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _openPaywall() async {
    await haptic(HapticStyle.medium);
    Analytics.capture('paywall_shown', {
      'trigger': 'prayer_audio_locked',
      'prayer_index': widget.prayerIndex,
    });
    if (!mounted) return;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => PremiumSheet(
        trigger: 'prayer_audio',
        onClose: () => Navigator.of(ctx).maybePop(),
        onUnlock: () => ref.read(premiumProvider.notifier).setUnlocked(),
      ),
    );
  }

  static String _formatDuration(Duration d) {
    final sec = d.inSeconds;
    if (sec <= 0) return '';
    return '${sec ~/ 60}:${(sec % 60).toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    // Nothing to show until we know the audio exists.
    if (_url == null) return const SizedBox.shrink();
    final isPremium = ref.watch(premiumProvider);
    final durLabel = _formatDuration(_duration);

    if (!isPremium) {
      return FadeRise(
        offsetY: -4,
        duration: const Duration(milliseconds: 350),
        child: TapScale(
          scale: 0.94,
          onTap: _openPaywall,
          child: Container(
            constraints: const BoxConstraints(maxWidth: 260),
            padding: const EdgeInsets.fromLTRB(4, 4, 12, 4),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.07),
              borderRadius: BorderRadius.circular(999),
              border: Border.all(
                color: const Color(0xFFFFD700).withValues(alpha: 0.36),
              ),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFFFFB432).withValues(alpha: 0.32),
                  blurRadius: 16,
                  spreadRadius: -4,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                _Avatar(),
                const SizedBox(width: 8),
                Flexible(
                  child: Text(
                    '${t('pr.audio.tapListen')}${durLabel.isEmpty ? '' : ' · $durLabel'}',
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      letterSpacing: -0.15,
                      color: const Color(0xFFFEF3C7).withValues(alpha: 0.95),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }

    // -------- Premium user: full experience --------
    return FadeRise(
      offsetY: -4,
      duration: const Duration(milliseconds: 350),
      child: TapScale(
        scale: 0.94,
        onTap: _togglePremium,
        child: ClipRRect(
          borderRadius: BorderRadius.circular(999),
          child: Container(
            // 180 clipped "Listen in His voice · 1:24" down to an ellipsis.
            constraints: const BoxConstraints(maxWidth: 264),
            padding: const EdgeInsets.fromLTRB(6, 6, 12, 6),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(999),
              border: Border.all(
                color: const Color(0xFFFFD700).withValues(alpha: 0.38),
              ),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFFFFB432).withValues(alpha: 0.32),
                  blurRadius: 16,
                  spreadRadius: -4,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Stack(
              children: [
                // Progress fill
                Positioned.fill(
                  child: FractionallySizedBox(
                    alignment: Alignment.centerLeft,
                    widthFactor: _progress.clamp(0, 1),
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [
                            const Color(0xFFFFD700).withValues(alpha: 0.30),
                            const Color(0xFFFFB432).withValues(alpha: 0.18),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 28,
                      height: 28,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [
                            const Color(0xFFFFD700).withValues(alpha: 0.98),
                            const Color(0xFFFFAA28).withValues(alpha: 0.98),
                          ],
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: const Color(
                              0xFFFFB432,
                            ).withValues(alpha: 0.6),
                            blurRadius: 14,
                            spreadRadius: -2,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: _loading
                          ? const SizedBox(
                              width: 14,
                              height: 14,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Color(0xFF3A2000),
                              ),
                            )
                          : Icon(
                              _hasError
                                  ? Icons.refresh_rounded
                                  : _playing
                                  ? Icons.pause_rounded
                                  : Icons.play_arrow_rounded,
                              size: 16,
                              color: const Color(0xFF3A2000),
                            ),
                    ),
                    const SizedBox(width: 8),
                    Flexible(
                      child: Text(
                        _loading
                            ? t('pr.audio.preparing')
                            : _playing
                            ? t('pr.audio.listening')
                            : '${t('pr.audio.listen')}${durLabel.isEmpty ? '' : ' · $durLabel'}',
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          letterSpacing: -0.15,
                          color: const Color(
                            0xFFFEF3C7,
                          ).withValues(alpha: 0.95),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Jesus avatar with the pulsing golden halo ring (same asset as web).
class _Avatar extends StatefulWidget {
  @override
  State<_Avatar> createState() => _AvatarState();
}

class _AvatarState extends State<_Avatar> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1900),
  )..repeat();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 36,
      height: 36,
      child: Stack(
        alignment: Alignment.center,
        children: [
          RepaintBoundary(
            child: AnimatedBuilder(
              animation: _c,
              builder: (context, _) {
                final v = Curves.easeOut.transform(_c.value);
                return Transform.scale(
                  scale: 1 + 0.5 * v,
                  child: Opacity(
                    opacity: 0.5 * (1 - v),
                    child: Container(
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: const Color(0xFFFFD700).withValues(alpha: 0.5),
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(
                color: const Color(0xFFFFD700).withValues(alpha: 0.9),
                width: 1.5,
              ),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFFFFB432).withValues(alpha: 0.7),
                  blurRadius: 14,
                  spreadRadius: -2,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            clipBehavior: Clip.antiAlias,
            child: Image.asset(
              'assets/images/jesus-avatar.webp',
              fit: BoxFit.cover,
            ),
          ),
        ],
      ),
    );
  }
}
