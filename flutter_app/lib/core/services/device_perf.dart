import 'dart:io';

import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter/widgets.dart';

/// Flutter port of the web app's `.low-end-device` / `.android-device`
/// throttling system (see `src/index.css` + `main.tsx`).
///
/// The web build tags the DOM as low-end when `navigator.deviceMemory <= 3`,
/// `hardwareConcurrency <= 4`, or the user prefers reduced motion, and then
/// disables infinite animations, backdrop blur, and mix-blend layers — the
/// effects that pegged Mali / Adreno GPUs and caused `nSyncAndDrawFrame` ANRs
/// on entry-level Androids (Itel A90, Redmi 13C, ...).
///
/// This helper reproduces that decision ONCE at startup so every screen can
/// cheaply ask `DevicePerf.isLowEnd` / `disableInfiniteAnimations` /
/// `disableBlur` before spending GPU budget on heavy visuals.
class DevicePerf {
  DevicePerf._();

  static bool _initialised = false;

  /// True on RAM<=3GB / cores<=4 class devices, matching the web threshold.
  static bool isLowEnd = false;

  /// Number of logical processors (0 = unknown).
  static int cores = 0;

  /// Physical RAM in MB (0 = unknown).
  static int ramMb = 0;

  /// Whether the OS reports a low-RAM device flag (Android `isLowRamDevice`).
  static bool osLowRam = false;

  /// Detect device class once. Safe to call multiple times; only runs once.
  static Future<void> init() async {
    if (_initialised) return;
    _initialised = true;

    cores = Platform.numberOfProcessors;

    try {
      final info = DeviceInfoPlugin();
      if (Platform.isAndroid) {
        final a = await info.androidInfo;
        osLowRam = a.isLowRamDevice;
        ramMb = _readTotalRamMb();
        // Web's heuristic is `deviceMemory <= 3 || cores <= 4`, but on a phone
        // core count alone is a poor signal (plenty of capable 4-core parts,
        // and emulators report 4) — tagging those low-end stripped the frosted
        // glass everywhere and made surfaces look flat/muddy. So require a
        // genuine memory signal: the OS low-RAM flag, or <= 3GB RAM. Very small
        // core counts still count as low-end.
        isLowEnd =
            osLowRam || (ramMb > 0 && ramMb <= 3072) || (cores > 0 && cores <= 2);
      } else if (Platform.isIOS) {
        // iOS devices in support range are not low-end for our purposes.
        isLowEnd = cores <= 2;
      } else {
        isLowEnd = cores <= 2;
      }
    } catch (_) {
      // If detection fails, assume a capable device (never strip visuals on a
      // guess — a wrong "low-end" verdict is what made the UI look cheap).
      isLowEnd = false;
    }
  }

  /// Total physical RAM in MB, read from `/proc/meminfo` (Android/Linux).
  /// Returns 0 when unavailable.
  static int _readTotalRamMb() {
    try {
      final text = File('/proc/meminfo').readAsStringSync();
      final m = RegExp(r'MemTotal:\s+(\d+)\s*kB').firstMatch(text);
      if (m == null) return 0;
      return (int.parse(m.group(1)!) / 1024).round();
    } catch (_) {
      return 0;
    }
  }

  /// Whether the running platform prefers reduced motion (accessibility).
  /// Pass a BuildContext when available for the most accurate answer.
  static bool prefersReducedMotion(BuildContext? context) {
    if (context == null) return false;
    return MediaQuery.maybeOf(context)?.disableAnimations ?? false;
  }

  /// Kill infinite/looping animations (ken-burns, shimmer, prayer aura, marquees)
  /// on low-end devices — the web app sets `animation-iteration-count: 1`.
  static bool disableInfiniteAnimations([BuildContext? context]) =>
      isLowEnd || prefersReducedMotion(context);

  /// Drop backdrop blur / glass filter passes on low-end devices — the single
  /// biggest GPU cost on Mali/Adreno parts (web drops `backdrop-filter`).
  static bool get disableBlur => isLowEnd;
}
