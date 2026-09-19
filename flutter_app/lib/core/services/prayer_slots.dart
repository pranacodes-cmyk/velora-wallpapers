import 'dart:convert';

import 'package:flutter/foundation.dart';

import 'prefs.dart';
import 'today_tasks_store.dart';

/// 1:1 port of `src/lib/prayerSlots.ts`.
/// Same storage keys, same day-scoping, same unlock rules.
enum PrayerSlot { morning, evening }

String _slotName(PrayerSlot s) =>
    s == PrayerSlot.morning ? 'morning' : 'evening';

PrayerSlot? _parseSlot(String raw) => switch (raw) {
  'morning' => PrayerSlot.morning,
  'evening' => PrayerSlot.evening,
  _ => null,
};

class PrayerSlots {
  PrayerSlots._();

  static const eveningUnlockHour = 18;

  static const _openKey = 'cw_prayer_slot_opened';
  static const _unlockKey = 'cw_prayer_slot_unlocked';

  /// Stands in for the web `cw_prayer_slot_changed` window event.
  static final revision = ValueNotifier<int>(0);

  static String _todayKey() {
    // UTC day key to match web `prayerSlots.ts` (persisted `date` field), so a
    // saved slot set is considered "today's" on the same boundary as web.
    final d = DateTime.now().toUtc();
    return '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
  }

  static Set<PrayerSlot> _read(String key) {
    try {
      final raw = Prefs.getString(key);
      if (raw == null) return {};
      final parsed = jsonDecode(raw) as Map<String, dynamic>;
      if (parsed['date'] != _todayKey()) return {};
      final list = (parsed['slots'] as List?) ?? const [];
      return list.map((e) => _parseSlot('$e')).whereType<PrayerSlot>().toSet();
    } catch (_) {
      return {};
    }
  }

  static Future<void> _write(String key, Set<PrayerSlot> slots) async {
    await Prefs.setString(
      key,
      jsonEncode({'date': _todayKey(), 'slots': slots.map(_slotName).toList()}),
    );
    revision.value++;
  }

  static PrayerSlot currentSlot([DateTime? now]) =>
      (now ?? DateTime.now()).hour >= eveningUnlockHour
      ? PrayerSlot.evening
      : PrayerSlot.morning;

  static PrayerSlot otherSlot(PrayerSlot slot) =>
      slot == PrayerSlot.morning ? PrayerSlot.evening : PrayerSlot.morning;

  /// Is this slot at-or-past its natural unlock time today?
  static bool isSlotAtTime(PrayerSlot slot, [DateTime? now]) {
    if (slot == PrayerSlot.morning) return true;
    return (now ?? DateTime.now()).hour >= eveningUnlockHour;
  }

  static bool isOpened(PrayerSlot slot) => _read(_openKey).contains(slot);

  static Future<void> markOpened(PrayerSlot slot) async {
    final s = _read(_openKey);
    if (!s.contains(slot)) {
      s.add(slot);
      await _write(_openKey, s);
    }
    // Back-compat: legacy "prayers opened today" flag drives the Today checklist.
    await Prefs.setString(
      'cw_prayers_unlocked',
      jsonEncode({'date': _todayKey()}),
    );
    TodayTasksStore.refresh();
  }

  /// Only the slot for the CURRENT part of the day is freely unlocked; the
  /// other one always needs an explicit reveal (rewarded ad) unless it was
  /// already opened earlier today.
  static bool isUnlocked(PrayerSlot slot) {
    if (slot == currentSlot()) return true;
    if (_read(_openKey).contains(slot)) return true;
    return _read(_unlockKey).contains(slot);
  }

  static Future<void> markUnlocked(PrayerSlot slot) async {
    final s = _read(_unlockKey);
    if (s.contains(slot)) return;
    s.add(slot);
    await _write(_unlockKey, s);
  }
}
