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
        // Android doesn't expose total RAM via device_info_plus; use the
        // OS low-RAM flag + core count as the signal, mirroring the web
        // heuristic (deviceMemory<=3 || cores<=4).
        isLowEnd = osLowRam || cores <= 4;
      } else if (Platform.isIOS) {
        // iOS devices in support range are not low-end for our purposes.
        isLowEnd = cores <= 2;
      } else {
        isLowEnd = cores <= 4;
      }
    } catch (_) {
      // If detection fails, be conservative only on very low core counts.
      isLowEnd = cores > 0 && cores <= 4;
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
