import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';

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

/// Mirrors the web build's limited-concurrency preview playback: only a handful
/// of clips decode at once so scrolling stays smooth on mid-range Android.
class _ClipSlots {
  static const _max = 4;
  static final _holders = <Object>{};

  static bool acquire(Object owner) {
    if (_holders.contains(owner)) return true;
    if (_holders.length >= _max) return false;
    _holders.add(owner);
    return true;
  }

  static void release(Object owner) => _holders.remove(owner);
}

/// Muted, looping preview clip used as the "thumbnail" of a live wallpaper.
class LivePreviewClip extends StatefulWidget {
  const LivePreviewClip({
    super.key,
    required this.url,
    this.autoplay = true,
    this.placeholder,
  });

  final String url;
  final bool autoplay;
  final Widget? placeholder;

  @override
  State<LivePreviewClip> createState() => _LivePreviewClipState();
}

class _LivePreviewClipState extends State<LivePreviewClip> {
  VideoPlayerController? _c;
  bool _ready = false;
  bool _hasSlot = false;

  @override
  void initState() {
    super.initState();
    if (widget.autoplay) _start();
  }

  Future<void> _start() async {
    _hasSlot = _ClipSlots.acquire(this);
    if (!_hasSlot) return;
    final c = VideoPlayerController.networkUrl(Uri.parse(widget.url));
    _c = c;
    try {
      await c.setVolume(0);
      await c.setLooping(true);
      await c.initialize();
      if (!mounted) {
        await c.dispose();
        return;
      }
      setState(() => _ready = true);
      await c.play();
    } catch (_) {
      _ClipSlots.release(this);
      _hasSlot = false;
    }
  }

  @override
  void dispose() {
    if (_hasSlot) _ClipSlots.release(this);
    _c?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = _c;
    if (!_ready || c == null) {
      return widget.placeholder ?? const SizedBox.expand();
    }
    return FittedBox(
      fit: BoxFit.cover,
      child: SizedBox(
        width: c.value.size.width,
        height: c.value.size.height,
        child: VideoPlayer(c),
      ),
    );
  }
}
