import 'dart:async';
import 'dart:io' show Platform;
import 'dart:ui' show FrameTiming, PlatformDispatcher;

import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/scheduler.dart';
import 'package:package_info_plus/package_info_plus.dart';

import 'analytics.dart';

/// Full-app telemetry for the Flutter build. Everything lands in the same
/// PostHog project as the Capacitor app, with the same `perf_*` naming so the
/// existing dashboards read both builds.
///
/// Events:
///   screen_viewed        {screen, prev_screen, prev_duration_ms, kind}
///   ui_tap               {label, screen, x_pct, y_pct}
///   perf_cold_start      {first_frame_ms, ready_ms}
///   perf_frame_stats     {screen, frames, janky, severe, jank_pct, p90_ms, max_ms}
///   perf_severe_stall    {screen, frame_ms, build_ms, raster_ms}
///   app_error            {type, message, stack, fatal, screen}
///   app_backgrounded     {session_ms, screen, screens_seen, taps}
///   app_foregrounded     {away_ms}
class Telemetry {
  Telemetry._();

  static final Stopwatch _sinceMain = Stopwatch()..start();
  static String currentScreen = 'boot';
  static DateTime _screenSince = DateTime.now();
  static DateTime _sessionStart = DateTime.now();
  static DateTime? _backgroundedAt;
  static int _taps = 0;
  static final Set<String> _screensSeen = {};
  static bool _started = false;
  static bool _coldStartSent = false;

  // -------------------------------------------------------------- startup
  /// Call first thing in `main()` (after ensureInitialized).
  static void markMain() {
    _sinceMain
      ..reset()
      ..start();
    _installErrorHandlers();
  }

  /// Call once PostHog is set up. Registers device/app super-properties and
  /// starts frame monitoring.
  static Future<void> start() async {
    if (_started) return;
    _started = true;
    try {
      final props = <String, Object>{};
      try {
        final p = await PackageInfo.fromPlatform();
        props['app_version'] = p.version;
        props['native_version'] = p.version;
        props['native_build'] = p.buildNumber;
      } catch (_) {}
      if (!kIsWeb && Platform.isAndroid) {
        try {
          final a = await DeviceInfoPlugin().androidInfo;
          props['device_model'] = a.model;
          props['device_brand'] = a.manufacturer;
          props['os_version'] = a.version.release;
          props['sdk_int'] = a.version.sdkInt;
        } catch (_) {}
      }
      final views = PlatformDispatcher.instance.views;
      if (views.isNotEmpty) {
        final v = views.first;
        props['screen_w'] = (v.physicalSize.width / v.devicePixelRatio).round();
        props['screen_h'] = (v.physicalSize.height / v.devicePixelRatio)
            .round();
        props['dpr'] = double.parse(v.devicePixelRatio.toStringAsFixed(2));
      }
      props['build_kind'] = 'flutter';
      props['cpu_cores'] = kIsWeb ? 0 : Platform.numberOfProcessors;
      props['low_end_device'] = !kIsWeb && Platform.numberOfProcessors <= 4;
      await Analytics.register(props);
    } catch (_) {}
    _startFrameMonitor();
  }

  /// Call when the first real screen (onboarding or shell) is ready.
  static void markReady() {
    if (_coldStartSent) return;
    _coldStartSent = true;
    final readyMs = _sinceMain.elapsedMilliseconds;
    WidgetsBinding.instance.waitUntilFirstFrameRasterized.then((_) {
      Analytics.capture('perf_cold_start', {
        'ready_ms': readyMs,
        'first_frame_ms': _sinceMain.elapsedMilliseconds,
        'slow': readyMs > 3000,
      });
    });
  }

  // -------------------------------------------------------------- screens
  static void screen(String name, {String kind = 'screen'}) {
    if (name == currentScreen) return;
    final now = DateTime.now();
    final prev = currentScreen;
    final dur = now.difference(_screenSince).inMilliseconds;
    currentScreen = name;
    _screenSince = now;
    _screensSeen.add(name);
    Analytics.capture('screen_viewed', {
      'screen': name,
      'prev_screen': prev,
      'prev_duration_ms': dur,
      'kind': kind,
    });
  }

  static const tabNames = ['today', 'journeys', 'wallpapers', 'quiz'];
  static void tab(int i) =>
      screen('tab:${i >= 0 && i < tabNames.length ? tabNames[i] : i}',
          kind: 'tab');

  // -------------------------------------------------------------- lifecycle
  static void lifecycle(AppLifecycleState s) {
    if (s == AppLifecycleState.paused) {
      if (_backgroundedAt != null) return;
      _backgroundedAt = DateTime.now();
      _flushFrames();
      Analytics.capture('app_backgrounded', {
        'session_ms': DateTime.now().difference(_sessionStart).inMilliseconds,
        'screen': currentScreen,
        'screen_ms': DateTime.now().difference(_screenSince).inMilliseconds,
        'screens_seen': _screensSeen.length,
        'taps': _taps,
      });
    } else if (s == AppLifecycleState.resumed && _backgroundedAt != null) {
      final away = DateTime.now().difference(_backgroundedAt!).inMilliseconds;
      _backgroundedAt = null;
      if (away > 30 * 60 * 1000) {
        _sessionStart = DateTime.now();
        _taps = 0;
        _screensSeen.clear();
      }
      _screenSince = DateTime.now();
      Analytics.capture('app_foregrounded', {
        'away_ms': away,
        'screen': currentScreen,
      });
    }
  }

  // -------------------------------------------------------------- errors
  static int _errors = 0;
  static void _installErrorHandlers() {
    final prevFlutter = FlutterError.onError;
    FlutterError.onError = (details) {
      reportError(details.exception, details.stack,
          type: 'flutter', context: details.context?.toString());
      if (prevFlutter != null) prevFlutter(details);
    };
    final prevPlatform = PlatformDispatcher.instance.onError;
    PlatformDispatcher.instance.onError = (error, stack) {
      reportError(error, stack, type: 'async');
      return prevPlatform?.call(error, stack) ?? true;
    };
  }

  static void reportError(Object error, StackTrace? stack,
      {String type = 'caught', String? context}) {
    if (_errors++ > 30) return; // never flood
    final s = stack?.toString() ?? '';
    Analytics.capture('app_error', {
      'type': type,
      'message': error.toString().substring(
          0, error.toString().length.clamp(0, 400)),
      'stack': s.substring(0, s.length.clamp(0, 1200)),
      'context': context,
      'screen': currentScreen,
    });
  }

  // -------------------------------------------------------------- frames
  static final List<int> _frameMs = [];
  static int _janky = 0;
  static int _severe = 0;
  static int _stallsSent = 0;
  static Timer? _flushTimer;

  static void _startFrameMonitor() {
    if (kIsWeb) return;
    SchedulerBinding.instance.addTimingsCallback(_onTimings);
    _flushTimer = Timer.periodic(const Duration(seconds: 45), (_) {
      _flushFrames();
    });
  }

  static void _onTimings(List<FrameTiming> timings) {
    for (final t in timings) {
      final total = t.totalSpan.inMilliseconds;
      _frameMs.add(total);
      if (total > 32) _janky++;
      if (total > 250) {
        _severe++;
        if (_stallsSent < 15) {
          _stallsSent++;
          Analytics.capture('perf_severe_stall', {
            'screen': currentScreen,
            'frame_ms': total,
            'build_ms': t.buildDuration.inMilliseconds,
            'raster_ms': t.rasterDuration.inMilliseconds,
            'anr_risk': total > 1000,
          });
        }
      }
    }
  }

  static void _flushFrames() {
    if (_frameMs.length < 20) return;
    if (_janky == 0) {
      _frameMs.clear();
      return;
    }
    final sorted = [..._frameMs]..sort();
    final p90 = sorted[(sorted.length * 0.9).floor().clamp(0, sorted.length - 1)];
    Analytics.capture('perf_frame_stats', {
      'screen': currentScreen,
      'frames': sorted.length,
      'janky': _janky,
      'severe': _severe,
      'jank_pct': double.parse((_janky * 100 / sorted.length).toStringAsFixed(1)),
      'p90_ms': p90,
      'max_ms': sorted.last,
    });
    _frameMs.clear();
    _janky = 0;
    _severe = 0;
  }

  static void dispose() => _flushTimer?.cancel();

  // -------------------------------------------------------------- taps
  static Offset? _downPos;
  static DateTime? _downAt;

  static void onPointerDown(PointerDownEvent e) {
    _downPos = e.position;
    _downAt = DateTime.now();
  }

  static void onPointerUp(PointerUpEvent e) {
    final d = _downPos;
    final at = _downAt;
    _downPos = null;
    if (d == null || at == null) return;
    if ((e.position - d).distance > 18) return; // scroll / swipe
    if (DateTime.now().difference(at).inMilliseconds > 700) return;
    if (_taps > 400) return;
    _taps++;
    String label = '';
    try {
      label = _labelAt(e.position, e.viewId);
    } catch (_) {}
    final views = PlatformDispatcher.instance.views;
    double xp = 0, yp = 0;
    if (views.isNotEmpty) {
      final v = views.first;
      final w = v.physicalSize.width / v.devicePixelRatio;
      final h = v.physicalSize.height / v.devicePixelRatio;
      if (w > 0 && h > 0) {
        xp = (e.position.dx / w * 100).roundToDouble();
        yp = (e.position.dy / h * 100).roundToDouble();
      }
    }
    Analytics.capture('ui_tap', {
      'label': label.isEmpty ? '(no text)' : label,
      'screen': currentScreen,
      'x_pct': xp,
      'y_pct': yp,
    });
  }

  /// Finds the visible text of what was tapped: the tapped paragraph itself,
  /// or the first text inside the smallest tapped box (a button/card).
  static String _labelAt(Offset pos, int viewId) {
    final result = HitTestResult();
    WidgetsBinding.instance.hitTestInView(result, pos, viewId);
    final views = PlatformDispatcher.instance.views;
    double screenArea = 1;
    if (views.isNotEmpty) {
      final v = views.first;
      screenArea = (v.physicalSize.width / v.devicePixelRatio) *
          (v.physicalSize.height / v.devicePixelRatio);
    }
    for (final entry in result.path) {
      final t = entry.target;
      if (t is RenderParagraph) return _trim(t.text.toPlainText());
      if (t is RenderBox && t.hasSize) {
        final area = t.size.width * t.size.height;
        if (area > screenArea * 0.35) break; // reached page-level containers
        final found = _firstText(t, 0);
        if (found != null) return _trim(found);
      }
    }
    return '';
  }

  static String? _firstText(RenderObject o, int depth) {
    if (depth > 12) return null;
    if (o is RenderParagraph) {
      final s = o.text.toPlainText().trim();
      if (s.isNotEmpty) return s;
    }
    String? out;
    o.visitChildren((c) {
      out ??= _firstText(c, depth + 1);
    });
    return out;
  }

  static String _trim(String s) {
    final one = s.replaceAll(RegExp(r'\s+'), ' ').trim();
    return one.length > 60 ? one.substring(0, 60) : one;
  }
}

/// Wraps the whole app to capture every tap without touching any widget.
class TelemetryTapCapture extends StatelessWidget {
  const TelemetryTapCapture({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) => Listener(
        behavior: HitTestBehavior.translucent,
        onPointerDown: Telemetry.onPointerDown,
        onPointerUp: Telemetry.onPointerUp,
        child: child,
      );
}

/// Tracks pushed pages, sheets and dialogs. Names come from the route name or
/// from the first `*Screen / *Sheet / *Page / *Dialog` widget inside it.
class TelemetryNavObserver extends NavigatorObserver {
  final List<String> _stack = [];
  static final _named = RegExp(r'(Screen|Sheet|Page|Dialog|Flow|Overlay|Detail|Preview)$');

  String _fallback(Route<dynamic> r) {
    final n = r.settings.name;
    if (n != null && n.isNotEmpty && n != '/') return n;
    if (r is PopupRoute) return 'popup';
    return 'page';
  }

  @override
  void didPush(Route<dynamic> route, Route<dynamic>? previousRoute) {
    if (previousRoute == null) return; // the home route — tabs handle it
    final back = Telemetry.currentScreen;
    _stack.add(back);
    final kind = route is PopupRoute ? 'sheet' : 'page';
    WidgetsBinding.instance.addPostFrameCallback((_) {
      var name = _fallback(route);
      if (route is ModalRoute) {
        final ctx = route.subtreeContext;
        if (ctx != null) name = _findName(ctx as Element) ?? name;
      }
      Telemetry.screen(name, kind: kind);
    });
  }

  @override
  void didPop(Route<dynamic> route, Route<dynamic>? previousRoute) {
    if (_stack.isEmpty) return;
    Telemetry.screen(_stack.removeLast(), kind: 'back');
  }

  String? _findName(Element root) {
    String? found;
    var visited = 0;
    void visit(Element e, int depth) {
      if (found != null || depth > 60 || visited > 1500) return;
      visited++;
      final t = e.widget.runtimeType.toString();
      if (_named.hasMatch(t) &&
          !t.startsWith('Material') &&
          t != 'BottomSheet' &&
          t != 'AlertDialog' &&
          t != 'Dialog') {
        found = t.replaceFirst('_', '');
        return;
      }
      e.visitChildren((c) => visit(c, depth + 1));
    }

    visit(root, 0);
    return found;
  }
}
