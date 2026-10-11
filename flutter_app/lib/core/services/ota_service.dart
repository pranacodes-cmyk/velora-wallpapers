import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart' show rootBundle;
import 'package:http/http.dart' as http;
import 'package:package_info_plus/package_info_plus.dart';
import 'package:path_provider/path_provider.dart';

import '../env.dart';
import 'prefs.dart';

/// Self-hosted content OTA — served from our own backend storage and published
/// from GitHub (`.github/workflows/flutter-ota-publish.yml`).
///
/// What it updates without a Play release: every JSON content asset — prayers,
/// devotionals, parallax scenes, verse packs and all translations.
/// Compiled Dart/native code still ships through a normal store release; a
/// manifest can force that with `minAppBuild`.
///
/// Two delivery channels:
///  * **Urgent** (`"urgent": true` in the manifest) — for a bad string, a wrong
///    price or broken content that must not survive one more session. The
///    splash spends at most [manifestBudget] on the manifest and, only when the
///    urgent flag is set, up to [urgentBudget] more on the download, then
///    activates it on this very launch (first install included).
///  * **Normal** (default) — nothing blocks: the bundle downloads after first
///    paint and activates on the next cold start. This is the channel every
///    routine content push should use.
///  Either way a timeout, an offline device or a slow server simply keeps the
///  bundled assets; startup is never held hostage.
///  * A new bundle downloads into a versioned folder. It only becomes active
///    after *all* files are written (atomic switch), so a half-finished
///    download can never show broken content.
///  * A bundle downloaded after first paint activates on the next launch.
///  * Older bundles are pruned; a corrupt bundle self-heals by falling back to
///    the bundled asset.
class OtaService {
  OtaService._();

  // Private bucket read with the public anon key (a read-only policy allows it).
  static const _bucketUrl = '${Env.supabaseUrl}/storage/v1/object/ota';
  static const Map<String, String> _headers = {
    'apikey': Env.supabaseAnonKey,
    'Authorization': 'Bearer ${Env.supabaseAnonKey}',
  };

  /// Splash budget for the (tiny) manifest request. A slow network costs this
  /// much once per cold start and nothing more.
  static const manifestBudget = Duration(milliseconds: 900);

  /// Extra splash budget granted *only* to an urgent bundle's download.
  static const urgentBudget = Duration(milliseconds: 3500);

  static Directory? _root;
  static int _activeBundle = 0;
  static final Map<String, String> _memCache = {};
  static bool _syncing = false;

  /// `true` when the store build is older than the manifest's `minAppBuild`.
  static bool updateRequired = false;
  static String? storeUrl;

  static String _key(String name) => 'cw_ota_$name';

  // ---------------------------------------------------------------- lifecycle

  /// Called on the splash, before first paint. Never throws.
  static Future<void> bootstrap() async {
    if (kIsWeb) return;
    try {
      _root = Directory('${(await getApplicationSupportDirectory()).path}/ota');
      // Promote a bundle that finished downloading during the last session.
      final pending = Prefs.getInt(_key('pending'));
      if (pending > 0) {
        await Prefs.setInt(_key('active'), pending);
        await Prefs.setInt(_key('pending'), 0);
      }
      _activeBundle = Prefs.getInt(_key('active'));
      if (_activeBundle > 0 && !_bundleDir(_activeBundle).existsSync()) {
        _activeBundle = 0;
        await Prefs.setInt(_key('active'), 0);
      }
      // Bounded manifest peek. Urgent bundles are applied right here; normal
      // ones continue downloading in the background while the app runs.
      final manifest = await _manifest()
          .timeout(manifestBudget, onTimeout: () => null)
          .catchError((_) => null);
      if (manifest == null) {
        // Server slow/offline on the startup path — retry off the critical path.
        refreshInBackground();
        return;
      }
      await _gate(manifest);
      if (manifest['urgent'] == true) {
        await _apply(
          manifest,
          activateNow: true,
        ).timeout(urgentBudget, onTimeout: () {}).catchError((_) {});
      } else {
        _apply(manifest, activateNow: false).catchError((_) {});
      }
    } catch (_) {
      /* bundled assets remain in use */
    }
  }

  /// Fire-and-forget refresh (app resumed / after first paint).
  static void refreshInBackground() {
    if (kIsWeb) return;
    _sync().catchError((_) {});
  }

  /// Full background pass: manifest + download, nothing blocking.
  static Future<void> _sync() async {
    final manifest = await _manifest();
    if (manifest == null) return;
    await _gate(manifest);
    await _apply(manifest, activateNow: false);
  }

  /// The manifest is a few hundred bytes; `null` means "could not read it".
  static Future<Map<String, dynamic>?> _manifest() async {
    if (_root == null) return null;
    try {
      final res = await http
          .get(
            Uri.parse(
              '$_bucketUrl/manifest.json?t='
              '${DateTime.now().millisecondsSinceEpoch ~/ 60000}',
            ),
            headers: _headers,
          )
          .timeout(const Duration(seconds: 8));
      if (res.statusCode != 200) return null;
      return jsonDecode(res.body) as Map<String, dynamic>;
    } catch (_) {
      return null;
    }
  }

  /// Hard update gate (store release required).
  static Future<void> _gate(Map<String, dynamic> manifest) async {
    try {
      final minBuild = (manifest['minAppBuild'] as num?)?.toInt() ?? 0;
      if (minBuild <= 0) return;
      final build =
          int.tryParse((await PackageInfo.fromPlatform()).buildNumber) ?? 0;
      updateRequired = build > 0 && build < minBuild;
      storeUrl = manifest['storeUrl'] as String?;
    } catch (_) {}
  }

  static Directory _bundleDir(int bundle) =>
      Directory('${_root!.path}/$bundle');

  // -------------------------------------------------------------- asset reads

  /// Reads a bundled asset, preferring the OTA copy when one is active.
  static Future<String> loadString(String assetPath) async {
    final cached = _memCache[assetPath];
    if (cached != null) return cached;
    if (!kIsWeb && _activeBundle > 0 && _root != null) {
      try {
        final f = File('${_bundleDir(_activeBundle).path}/$assetPath');
        if (f.existsSync()) {
          final raw = await f.readAsString();
          if (raw.trim().isNotEmpty) {
            _memCache[assetPath] = raw;
            return raw;
          }
        }
      } catch (_) {
        /* fall through to the bundled asset */
      }
    }
    final raw = await rootBundle.loadString(assetPath);
    _memCache[assetPath] = raw;
    return raw;
  }

  // ------------------------------------------------------------------- sync

  /// Downloads a bundle and switches to it atomically.
  ///
  /// [activateNow] is the difference between the two channels: an urgent bundle
  /// becomes the live content immediately (memory cache cleared, so screens that
  /// read after the splash already get the new strings), while a normal one is
  /// only marked pending and takes over on the next cold start — swapping
  /// content under a screen that is already drawn is what used to flicker.
  static Future<void> _apply(
    Map<String, dynamic> manifest, {
    required bool activateNow,
  }) async {
    if (_syncing || _root == null) return;
    _syncing = true;
    try {
      final bundle = (manifest['bundle'] as num?)?.toInt() ?? 0;
      if (bundle <= 0 || bundle <= _activeBundle) return;
      if (!activateNow && bundle == Prefs.getInt(_key('pending'))) return;

      final files = (manifest['files'] as Map?)?.cast<String, dynamic>() ?? {};
      if (files.isEmpty) return;

      final dir = _bundleDir(bundle);
      final staging = Directory('${dir.path}.part');
      if (staging.existsSync()) await staging.delete(recursive: true);
      await staging.create(recursive: true);

      for (final entry in files.entries) {
        final assetPath = entry.key;
        final meta = entry.value;
        final url = meta is Map ? meta['url'] as String? : meta as String?;
        final fileUrl = url == null || url.isEmpty
            ? '$_bucketUrl/$bundle/$assetPath'
            : (url.startsWith('http') ? url : '$_bucketUrl/$url');
        final r = await http
            .get(Uri.parse(fileUrl), headers: _headers)
            .timeout(const Duration(seconds: 20));
        if (r.statusCode != 200 || r.bodyBytes.isEmpty) {
          // Incomplete bundle: discard everything, keep the current content.
          await staging.delete(recursive: true);
          return;
        }
        final out = File('${staging.path}/$assetPath');
        await out.parent.create(recursive: true);
        await out.writeAsBytes(r.bodyBytes, flush: true);
      }

      // Atomic switch: rename only once every file landed.
      if (dir.existsSync()) await dir.delete(recursive: true);
      await staging.rename(dir.path);

      if (activateNow || _activeBundle == 0) {
        _activeBundle = bundle;
        _memCache.clear();
        await Prefs.setInt(_key('active'), bundle);
        await Prefs.setInt(_key('pending'), 0);
      } else {
        // Content is already on screen; swap on the next cold start.
        await Prefs.setInt(_key('pending'), bundle);
      }
      await _prune(keep: bundle);
    } catch (_) {
      /* silent: bundled/previous assets stay in use */
    } finally {
      _syncing = false;
    }
  }

  static Future<void> _prune({required int keep}) async {
    try {
      if (!_root!.existsSync()) return;
      for (final e in _root!.listSync()) {
        final name = e.path.split('/').last;
        final v = int.tryParse(name.replaceAll('.part', '')) ?? -1;
        if (v > 0 && v != keep && v != _activeBundle) {
          await e.delete(recursive: true);
        }
      }
    } catch (_) {}
  }
}
