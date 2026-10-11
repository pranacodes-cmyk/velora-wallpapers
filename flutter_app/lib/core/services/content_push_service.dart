import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:permission_handler/permission_handler.dart';

import 'prefs.dart';

/// Daily content pushes — 1:1 port of `src/plugins/content-push.ts`.
///
/// Morning Verse (08:00) · Bible Quiz (12:30) · Companion (15:00) ·
/// Evening Journey (20:00). Scheduling lives in the native AlarmManager
/// bridge; this class only owns the opt-out flag, the Android 13+ runtime
/// permission and the foreground bookkeeping (app-open + Pro mirror).
class ContentPushes {
  ContentPushes._();

  static const _channel = MethodChannel(
    'com.jesuswallpaperbible.app/content_push',
  );

  static const _optOutKey = 'prayly:contentPush:optOut:v1';
  static const _permissionAskedKey = 'prayly:contentPush:permissionAsked:v1';

  static bool get optedOut => Prefs.getBool(_optOutKey);

  static Future<T?> _invoke<T>(
    String method, [
    Map<String, Object?>? args,
  ]) async {
    if (kIsWeb) return null;
    try {
      return await _channel.invokeMethod<T>(method, args);
    } catch (_) {
      return null;
    }
  }

  /// Android 13+ never posts anything without the runtime grant. Ask once,
  /// then leave it alone — a second silent request is a no-op anyway.
  static Future<bool> ensurePermission({bool force = false}) async {
    if (kIsWeb) return false;
    try {
      final status = await Permission.notification.status;
      if (status.isGranted) return true;
      if (status.isPermanentlyDenied) return false;
      if (!force && Prefs.getBool(_permissionAskedKey)) return false;
      await Prefs.setBool(_permissionAskedKey, true);
      final result = await Permission.notification.request();
      return result.isGranted;
    } catch (_) {
      return false;
    }
  }

  /// Called once after the first frame: ask for the grant (unless the user
  /// opted out), then repair the native schedule without churning alarms.
  static Future<void> bootstrap() async {
    if (kIsWeb) return;
    if (optedOut) return;
    final granted = await ensurePermission();
    if (!granted) return;
    await _invoke<int>('repair');
    await markAppOpen();
  }

  /// Full (re-)arm — used after the user re-enables pushes or grants the
  /// permission later from settings.
  static Future<int> enable() async {
    await Prefs.setBool(_optOutKey, false);
    await ensurePermission(force: true);
    return await _invoke<int>('enable') ?? 0;
  }

  static Future<void> disable() async {
    await Prefs.setBool(_optOutKey, true);
    await _invoke<bool>('disable');
  }

  static Future<bool> isEnabled() async =>
      await _invoke<bool>('getStatus') ?? false;

  static Future<void> markAppOpen() => _invoke<bool>('markAppOpen');

  /// Mirror the Pro flag natively so the receiver can quiet the morning verse
  /// push for users who already have the auto-updating verse wallpaper.
  static Future<void> syncProMode(bool pro) =>
      _invoke<bool>('setProMode', {'pro': pro});

  /// QA: fire one banner immediately, bypassing quiet hours and the daily cap.
  static Future<void> preview(String kind) =>
      _invoke<bool>('preview', {'kind': kind});

  static Future<Map<Object?, Object?>?> diagnostics() =>
      _invoke<Map<Object?, Object?>>('diagnostics');
}
