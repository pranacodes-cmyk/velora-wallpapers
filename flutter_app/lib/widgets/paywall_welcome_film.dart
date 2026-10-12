import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:video_player/video_player.dart';

/// One lightweight CDN film, with a static first frame if playback is unavailable.
class PaywallWelcomeFilm extends StatefulWidget {
  const PaywallWelcomeFilm({super.key});

  @override
  State<PaywallWelcomeFilm> createState() => _PaywallWelcomeFilmState();
}

class _PaywallWelcomeFilmState extends State<PaywallWelcomeFilm>
    with WidgetsBindingObserver {
  static const _origin = 'https://velora-wallpapers.lovable.app';
  static const _poster = '$_origin/__l5e/assets-v1/995f99a0-1cd6-4b90-92f1-ce5ea1525e49/paywall-welcome.jpg';
  final _video = VideoPlayerController.networkUrl(Uri.parse(
    '$_origin/__l5e/assets-v1/3a0f6952-38cb-4ae8-919e-fd87a0b8ad75/paywall-welcome.mp4',
  ));
  bool _ready = false;
  bool _active = true;
  bool _started = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  Future<void> _initialize() async {
    try {
      // Configure while the controller is still idle; initialize applies these
      // values before returning, without extra platform round trips afterward.
      await _video.setVolume(0);
      await _video.setLooping(true);
      await _video.initialize();
      if (!mounted) return;
      setState(() => _ready = true);
      _syncPlayback();
    } catch (_) {
      // The poster remains visible when offline or unsupported.
    }
  }

  void _syncPlayback() {
    if (!_ready || !mounted) return;
    if (_active && !MediaQuery.disableAnimationsOf(context)) {
      _video.play();
    } else {
      _video.pause();
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_started && !MediaQuery.disableAnimationsOf(context)) {
      _started = true;
      _initialize();
    }
    _syncPlayback();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _active = state == AppLifecycleState.resumed;
    _syncPlayback();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _video.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => ClipRect(
    child: Stack(
      fit: StackFit.expand,
      children: [
        CachedNetworkImage(imageUrl: _poster, fit: BoxFit.cover, alignment: const Alignment(0, -0.46),
          errorWidget: (_, __, ___) => const SizedBox.shrink()),
        if (_ready && !_video.value.hasError)
          FittedBox(
            fit: BoxFit.cover,
            alignment: const Alignment(0, -0.46),
            child: SizedBox(
              width: _video.value.size.width,
              height: _video.value.size.height,
              child: VideoPlayer(_video),
            ),
          ),
      ],
    ),
  );
}