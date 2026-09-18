import 'package:flutter/foundation.dart';

import 'prefs.dart';

/// 1:1 port of the active-pack store in `src/data/verseMoodPacks.ts`.
/// Same localStorage key so existing users keep their activated pack.
/// The web app dispatches a `cw:verse-mood-pack-change` window event so every
/// listener re-renders; here a `ChangeNotifier` plays that role.
class ActiveVersePack extends ChangeNotifier {
  ActiveVersePack._();

  static final ActiveVersePack instance = ActiveVersePack._();

  static const storageKey = 'jwbp_active_mood_pack_v1';

  String? get value {
    final v = Prefs.getString(storageKey);
    return (v != null && v.trim().isNotEmpty) ? v : null;
  }

  Future<void> set(String? packId) async {
    if (packId != null) {
      await Prefs.setString(storageKey, packId);
    } else {
      await Prefs.remove(storageKey);
    }
    notifyListeners();
  }
}
