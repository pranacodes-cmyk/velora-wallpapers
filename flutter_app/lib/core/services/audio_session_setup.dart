import 'package:audio_session/audio_session.dart';
import 'package:flutter/foundation.dart';

/// The prayer screen plays two things at once: the ambient music bed and the
/// narrated prayer. Without an explicit session both `just_audio` players
/// request Android audio focus on their own, and the second request steals it
/// from the first — which is exactly why only the background music was audible
/// and the narration stayed silent.
///
/// One session is configured for the whole app; the narration player is then
/// created with `handleAudioSessionActivation: false` so it mixes into the same
/// session instead of fighting for it.
class AppAudioSession {
  AppAudioSession._();

  static bool _done = false;

  static Future<void> ensure() async {
    if (_done || kIsWeb) return;
    _done = true;
    try {
      final session = await AudioSession.instance;
      await session.configure(
        const AudioSessionConfiguration(
          avAudioSessionCategory: AVAudioSessionCategory.playback,
          avAudioSessionMode: AVAudioSessionMode.defaultMode,
          androidAudioAttributes: AndroidAudioAttributes(
            contentType: AndroidAudioContentType.music,
            usage: AndroidAudioUsage.media,
          ),
          androidAudioFocusGainType:
              AndroidAudioFocusGainType.gainTransientMayDuck,
          androidWillPauseWhenDucked: false,
        ),
      );
      await session.setActive(true);
    } catch (_) {
      // Audio still plays with the plugin defaults if this ever fails.
      _done = true;
    }
  }
}
