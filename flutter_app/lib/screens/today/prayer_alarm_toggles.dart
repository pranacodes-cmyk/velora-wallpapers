import 'dart:convert';

import 'package:flutter/material.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/services/analytics.dart';
import '../../core/services/prayer_alarm_service.dart';
import '../../core/services/prefs.dart';
import '../../core/theme/app_colors.dart';
import '../../widgets/lucide.dart';
import '../../widgets/app_toast.dart';
import 'ios_switch.dart';
import 'today_shared.dart';
import 'today_ink.dart';

/// 1:1 port of `src/components/prayer/PrayerAlarmToggles.tsx` — two opt-in
/// prayer bells with editable times. Slot labels, custom-time storage key and
/// scheduling order all match the web component exactly.
enum _Slot { morning, evening }

const _labels = {
  _Slot.morning: 'Morning Prayer',
  _Slot.evening: 'Evening Prayer',
};
const _defaults = {
  _Slot.morning: (hour: 7, minute: 0),
  _Slot.evening: (hour: 21, minute: 0),
};

/// User-chosen times survive turning a bell off and back on.
const _customKey = 'prayly_alarm_custom_times_v1';

Map<String, ({int hour, int minute})> _loadCustom() {
  try {
    final raw = Prefs.getString(_customKey);
    if (raw == null) return {};
    final map = jsonDecode(raw) as Map<String, dynamic>;
    return map.map(
      (k, v) => MapEntry(k, (
        hour: (v['hour'] as num).toInt(),
        minute: (v['minute'] as num).toInt(),
      )),
    );
  } catch (_) {
    return {};
  }
}

Future<void> _saveCustom(Map<String, ({int hour, int minute})> next) async {
  try {
    await Prefs.setString(
      _customKey,
      jsonEncode(
        next.map((k, v) => MapEntry(k, {'hour': v.hour, 'minute': v.minute})),
      ),
    );
  } catch (_) {
    /* ignore */
  }
}

String _fmt(({int hour, int minute}) t) {
  final h12 = ((t.hour + 11) % 12) + 1;
  final ampm = t.hour >= 12 ? 'PM' : 'AM';
  final mm = t.minute.toString().padLeft(2, '0');
  return '$h12:$mm $ampm';
}

class PrayerAlarmToggles extends StatefulWidget {
  const PrayerAlarmToggles({super.key});

  @override
  State<PrayerAlarmToggles> createState() => _PrayerAlarmTogglesState();
}

class _PrayerAlarmTogglesState extends State<PrayerAlarmToggles> {
  late Map<String, ({int hour, int minute})> _custom = _loadCustom();

  PrayerTime? _scheduled(PrayerAlarmsConfig config, _Slot slot) {
    for (final t in config.times) {
      if (t.label.toLowerCase() == _labels[slot]!.toLowerCase()) return t;
    }
    return null;
  }

  bool _isOn(PrayerAlarmsConfig config, _Slot slot) =>
      config.enabled && _scheduled(config, slot) != null;

  /// While a bell is OFF the user's freshly picked time must win over the
  /// stale scheduled entry left in config — otherwise the row snaps back to
  /// the old default right after the picker closes.
  ({int hour, int minute}) _timeFor(PrayerAlarmsConfig config, _Slot slot) {
    final s = _scheduled(config, slot);
    final scheduled = s == null ? null : (hour: s.hour, minute: s.minute);
    if (_isOn(config, slot)) {
      return scheduled ?? _custom[slot.name] ?? _defaults[slot]!;
    }
    return _custom[slot.name] ?? scheduled ?? _defaults[slot]!;
  }

  List<PrayerTime> _othersOf(PrayerAlarmsConfig config, _Slot slot) => config
      .times
      .where((t) => t.label.toLowerCase() != _labels[slot]!.toLowerCase())
      .toList();

  Future<void> _applyTimes(
    PrayerAlarmsConfig config,
    List<PrayerTime> next,
  ) async {
    try {
      if (next.isEmpty) {
        await PrayerAlarms.disable();
      } else if (!config.enabled) {
        await PrayerAlarms.enable(times: next, soundEnabled: true);
      } else {
        await PrayerAlarms.update(times: next, soundEnabled: true);
      }
    } catch (_) {
      if (!mounted) return;
      AppToast.error(context, t('prayer.toast.updateError'));
    }
  }

  String _displayLabel(_Slot slot) => slot == _Slot.morning
      ? t('prayer.slot.morning')
      : t('prayer.slot.evening');

  Future<void> _toggle(PrayerAlarmsConfig config, _Slot slot, bool on) async {
    final tm = _timeFor(config, slot);
    final entry = PrayerTime(
      hour: tm.hour,
      minute: tm.minute,
      label: _labels[slot]!,
    );
    final others = _othersOf(config, slot);
    final next = on
        ? (slot == _Slot.morning ? [entry, ...others] : [...others, entry])
        : others;
    Analytics.capture('prayer_alarm_toggle', {
      'slot': slot.name,
      'on': on,
      'hour': tm.hour,
      'minute': tm.minute,
    });
    if (on && mounted) {
      AppToast.success(
        context,
        t('prayer.toast.bellOn', {
          'slot': _displayLabel(slot),
          'time': _fmt(tm),
        }),
      );
    }
    await _applyTimes(config, next);
  }

  Future<void> _pickTime(PrayerAlarmsConfig config, _Slot slot) async {
    final current = _timeFor(config, slot);
    final picked = await showTimePicker(
      context: context,
      initialTime: TimeOfDay(hour: current.hour, minute: current.minute),
      helpText: t('prayer.ariaChangeTime', {'label': _displayLabel(slot)}),
    );
    if (picked == null) return;
    final value = (hour: picked.hour, minute: picked.minute);

    final nextCustom = {..._custom, slot.name: value};
    setState(() => _custom = nextCustom);
    await _saveCustom(nextCustom);
    Analytics.capture('prayer_alarm_time_edit', {
      'slot': slot.name,
      'hour': value.hour,
      'minute': value.minute,
    });

    // Picking a time is an explicit "I want this bell" — standard clock-app
    // behaviour. A bell that was OFF turns itself ON so the promised toast is
    // always true (before, the toast claimed a time that was never armed and
    // the row snapped back to the default).
    final wasOn = _isOn(config, slot);
    final entry = PrayerTime(
      hour: value.hour,
      minute: value.minute,
      label: _labels[slot]!,
    );
    final others = _othersOf(config, slot);
    final next = slot == _Slot.morning
        ? [entry, ...others]
        : [...others, entry];
    await _applyTimes(config, next);
    if (!mounted) return;
    AppToast.success(
      context,
      wasOn
          ? t('prayer.toast.timeMoved', {
              'label': _displayLabel(slot),
              'time': _fmt(value),
            })
          : t('prayer.toast.bellOn', {
              'slot': _displayLabel(slot),
              'time': _fmt(value),
            }),
    );
  }

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<int>(
      valueListenable: PrayerAlarms.revision,
      builder: (context, _, __) {
        final config = PrayerAlarms.load();

        return FadeRise(
          offsetY: 10,
          child: Container(
            margin: const EdgeInsets.only(
              left: 12,
              right: 12,
              top: 12,
              bottom: 8,
            ),
            clipBehavior: Clip.antiAlias,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: TodayInk.glassBorder),
              // Web: flat `hsl(var(--card))` surface — no gold/blue wash, which
              // is what made this card look muddy in light mode.
              color: AppColors.card,
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF1B2440).withValues(alpha: 0.18),
                  blurRadius: 20,
                  spreadRadius: -14,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Header
                Padding(
                  padding: const EdgeInsets.only(
                    left: 16,
                    right: 16,
                    top: 14,
                    bottom: 8,
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 24,
                        height: 24,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(8),
                          color: TodayInk.primary.withValues(alpha: 0.18),
                        ),
                        child: LucideIcon(
                          'bell',
                          size: 14,
                          color: TodayInk.primary,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          '${t('prayer.header').toUpperCase()} ⏰',
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 2.4,
                            color: TodayInk.primary.withValues(alpha: 0.85),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.only(
                    left: 16,
                    right: 16,
                    bottom: 4,
                  ),
                  child: Text(
                    t('prayer.subtitle'),
                    style: TextStyle(
                      fontSize: 11.5,
                      height: 1.35,
                      color: AppColors.foreground.withValues(alpha: 0.55),
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.only(left: 8, right: 8, bottom: 8),
                  child: Column(
                    children: [
                      _AlarmRow(
                        time: _timeFor(config, _Slot.morning),
                        label: _displayLabel(_Slot.morning),
                        on: _isOn(config, _Slot.morning),
                        onToggle: (on) => _toggle(config, _Slot.morning, on),
                        onEdit: () => _pickTime(config, _Slot.morning),
                      ),
                      Container(
                        margin: const EdgeInsets.symmetric(horizontal: 16),
                        height: 1,
                        color: TodayInk.glassBorder,
                      ),
                      _AlarmRow(
                        time: _timeFor(config, _Slot.evening),
                        label: _displayLabel(_Slot.evening),
                        on: _isOn(config, _Slot.evening),
                        onToggle: (on) => _toggle(config, _Slot.evening, on),
                        onEdit: () => _pickTime(config, _Slot.evening),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _AlarmRow extends StatelessWidget {
  const _AlarmRow({
    required this.time,
    required this.label,
    required this.on,
    required this.onToggle,
    required this.onEdit,
  });

  final ({int hour, int minute}) time;
  final String label;
  final bool on;
  final ValueChanged<bool> onToggle;
  final VoidCallback onEdit;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
      child: Row(
        children: [
          Expanded(
            child: TapScale(
              onTap: onEdit,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(
                        _fmt(time),
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w800,
                          letterSpacing: -0.2,
                          color: AppColors.foreground,
                        ),
                      ),
                      const SizedBox(width: 6),
                      Icon(
                        Icons.edit_outlined,
                        size: 12,
                        color: TodayInk.primary.withValues(alpha: 0.7),
                      ),
                      if (on) ...[
                        const SizedBox(width: 6),
                        Text(
                          t('prayer.on').toUpperCase(),
                          style: TextStyle(
                            fontSize: 9,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 1.6,
                            color: TodayInk.primary,
                          ),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 11,
                      color: AppColors.foreground.withValues(alpha: 0.55),
                    ),
                  ),
                ],
              ),
            ),
          ),
          IosSwitch(on: on, glow: true, onTap: () => onToggle(!on)),
        ],
      ),
    );
  }
}
