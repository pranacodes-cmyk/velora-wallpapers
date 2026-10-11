import 'dart:collection';

import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';

import '../../core/widgets/color_boost.dart';

/// The `thumbnail_url` of a live wallpaper is usually a short muted clip under
/// `/previews/`, exactly like the web tile which renders it in a `<video>`.
/// Treating it as an image leaves the card empty, so detect it here.
bool isLivePreviewClip(String? url) {
  if (url == null || url.isEmpty) return false;
  final u = url.toLowerCase();
  return u.contains('/previews/') ||
      u.endsWith('.webm') ||
      u.endsWith('.mp4') ||
      u.endsWith('.mov');
}

/// Limited-concurrency preview playback — 1:1 with the web build
/// (`requestPreviewPlay` / `releasePreviewPlay` in `LiveWallpaperTile.tsx`):
/// at most [_max] clips *play* at once, the rest wait in a FIFO queue.
///
/// The important parity detail: a clip that loses its turn is only **paused**,
/// never torn down. Its last decoded frame stays on screen (that is what the
/// web `<video>` does), so scrolling back up never shows a black tile and
/// resuming costs nothing — no re-initialize, no shimmer, no flash.
class _ClipSlots {
  static const _max = 4;

  /// A clip must play for at least this long before it can lose its slot, so a
  /// grid with more tiles than slots cannot enter an eviction loop.
  static const _minHold = Duration(milliseconds: 2500);

  /// Insertion-ordered: first entry is the oldest holder.
  static final _holders = <Object, ({VoidCallback pause, DateTime since})>{};
  static final _waiting = Queue<({Object owner, VoidCallback resume})>();

  static bool acquire(Object owner, VoidCallback resume, VoidCallback pause) {
    if (_holders.containsKey(owner)) return true;
    if (_holders.length >= _max) {
      final now = DateTime.now();
      Object? evictable;
      for (final entry in _holders.entries) {
        if (now.difference(entry.value.since) >= _minHold) {
          evictable = entry.key;
          break;
        }
      }
      if (evictable == null) {
        park(owner, resume);
        return false;
      }
      final pauseOldest = _holders.remove(evictable)?.pause;
      pauseOldest?.call();
    }
    _waiting.removeWhere((entry) => identical(entry.owner, owner));
    _holders[owner] = (pause: pause, since: DateTime.now());
    return true;
  }

  static void release(Object owner) {
    _holders.remove(owner);
    _waiting.removeWhere((entry) => identical(entry.owner, owner));
    while (_holders.length < _max && _waiting.isNotEmpty) {
      _waiting.removeFirst().resume();
      break;
    }
  }

  static void park(Object owner, VoidCallback resume) {
    if (_waiting.any((entry) => identical(entry.owner, owner))) return;
    _waiting.add((owner: owner, resume: resume));
  }

  static void cancel(Object owner) {
    _waiting.removeWhere((entry) => identical(entry.owner, owner));
  }
}

/// Muted, looping preview clip used as the "thumbnail" of a live wallpaper.
class LivePreviewClip extends StatefulWidget {
  const LivePreviewClip({
    super.key,
    required this.url,
    this.fallbackUrl,
    this.autoplay = true,
    this.placeholder,
    this.boost = ColorBoostPreset.previewClip,
  });

  final String url;
  final String? fallbackUrl;
  final bool autoplay;
  final Widget? placeholder;
  final ColorBoostPreset boost;

  @override
  State<LivePreviewClip> createState() => _LivePreviewClipState();
}

class _LivePreviewClipState extends State<LivePreviewClip> {
  VideoPlayerController? _c;
  bool _ready = false;
  bool _hasSlot = false;
  bool _disposed = false;

  @override
  void initState() {
    super.initState();
    if (widget.autoplay) _start();
  }

  @override
  void didUpdateWidget(covariant LivePreviewClip oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.url == widget.url &&
        oldWidget.fallbackUrl == widget.fallbackUrl) {
      if (oldWidget.autoplay != widget.autoplay) {
        widget.autoplay ? _start() : _pauseOffscreen();
      }
      return;
    }
    _reset();
    if (widget.autoplay) _start();
  }

  void _pauseOffscreen() {
    _ClipSlots.cancel(this);
    if (_hasSlot) _ClipSlots.release(this);
    _hasSlot = false;
    _c?.pause();
  }

  void _reset() {
    _ClipSlots.cancel(this);
    if (_hasSlot) _ClipSlots.release(this);
    _hasSlot = false;
    _ready = false;
    final old = _c;
    _c = null;
    old?.dispose();
  }

  /// Takes a playback slot (or waits for one) and starts / resumes the clip.
  Future<void> _start() async {
    if (_disposed || _hasSlot || !widget.autoplay) return;
    if (!_ClipSlots.acquire(this, _start, _pauseForOthers)) return;
    _hasSlot = true;
    final existing = _c;
    if (existing != null && existing.value.isInitialized) {
      await existing.play();
      return;
    }
    await _load(widget.url);
  }

  /// Called when another on-screen clip needs this playback slot. The frame
  /// stays visible — only playback stops — so the tile never goes black.
  void _pauseForOthers() {
    _hasSlot = false;
    _c?.pause();
    if (_disposed || !widget.autoplay) return;
    _ClipSlots.park(this, _start);
  }

  Future<void> _load(String url, {bool allowFallback = true}) async {
    final c = VideoPlayerController.networkUrl(
      Uri.parse(url),
      // Several muted clips share the grid; without `mixWithOthers` Android
      // hands audio focus to one player at a time and the other tiles stall
      // on their first frame — that is why only a single tile animated.
      videoPlayerOptions: VideoPlayerOptions(mixWithOthers: true),
    );
    _c = c;
    try {
      // Order matters: `setVolume` / `setLooping` before `initialize()` throw on
      // Android (no texture yet). That threw us straight into the fallback +
      // retry path, so tiles ended up black or frozen.
      await c.initialize();
      await c.setLooping(true);
      await c.setVolume(0);
      if (!mounted || _disposed || !identical(_c, c)) {
        await c.dispose();
        return;
      }
      setState(() => _ready = true);
      if (_hasSlot) await c.play();
    } catch (_) {
      await c.dispose();
      if (identical(_c, c)) _c = null;
      final fallback = widget.fallbackUrl;
      if (!_disposed && allowFallback && fallback != null && fallback != url) {
        await _load(fallback, allowFallback: false);
        return;
      }
      _ClipSlots.release(this);
      _hasSlot = false;
      // A single network hiccup used to leave the tile black forever; one
      // delayed retry recovers it the way the web <video> element does.
      if (!_disposed && mounted && allowFallback) {
        Future.delayed(const Duration(milliseconds: 1400), () {
          if (!_disposed && mounted && !_hasSlot && widget.autoplay) _start();
        });
      }
    }
  }

  @override
  void dispose() {
    _disposed = true;
    _ClipSlots.cancel(this);
    if (_hasSlot) _ClipSlots.release(this);
    _c?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = _c;
    if (!_ready || c == null || !c.value.isInitialized) {
      return widget.placeholder ?? const ColoredBox(color: Color(0xFF10141D));
    }
    // The decoder hands back one bad edge row/column (the thin green line on
    // Android), so the video is overscanned and hard-clipped to its own box.
    return RepaintBoundary(
      child: ColorBoost(
        preset: widget.boost,
        child: ClipRect(
          clipBehavior: Clip.hardEdge,
          child: Transform.scale(
            // 1.2% was not enough on high-density panels: the decoder's bad
            // edge column is ~3 physical px, which still showed as the thin
            // green line down the right side of a tile. 5% hides it fully and
            // is invisible on a cover-fitted clip.
            scale: 1.05,
            // Default (`low`) resampling is what made the previews look soft;
            // the clips are upscaled to tile size, so ask for medium.
            filterQuality: FilterQuality.medium,
            child: FittedBox(
              fit: BoxFit.cover,
              child: SizedBox(
                width: c.value.size.width,
                height: c.value.size.height,
                child: VideoPlayer(c),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
