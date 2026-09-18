import 'dart:ui';

import 'package:flutter/material.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/services/haptics.dart';
import '../today/today_shared.dart' show hsl;

/// Port of `src/components/journey/LockedDaySheet.tsx`.
class LockedDaySheet extends StatefulWidget {
  const LockedDaySheet({
    super.key,
    required this.journeyTitle,
    required this.journeyEmoji,
    required this.hue,
    required this.day,
    this.unlockAt,
    this.mode = 'time',
    required this.onUnlockWithPremium,
  });

  final String journeyTitle;
  final String journeyEmoji;
  final double hue;
  final int day;
  final int? unlockAt;
  final String mode; // 'time' | 'ad' (ad is unreachable — kept for parity)
  final VoidCallback onUnlockWithPremium;

  @override
  State<LockedDaySheet> createState() => _LockedDaySheetState();
}

class _LockedDaySheetState extends State<LockedDaySheet> {
  late Duration _remaining = Duration(
    milliseconds:
        (widget.unlockAt ?? 0) - DateTime.now().millisecondsSinceEpoch,
  );
  @override
  void initState() {
    super.initState();
    if (widget.mode == 'time') {
      _tick();
    }
  }

  void _tick() {
    Future.delayed(const Duration(seconds: 1), () {
      if (!mounted) return;
      setState(() {
        _remaining = Duration(
          milliseconds:
              (widget.unlockAt ?? 0) - DateTime.now().millisecondsSinceEpoch,
        );
      });
      _tick();
    });
  }

  String _format() {
    final ms = _remaining.inMilliseconds;
    if (ms <= 0) return t('jn.lock.timer.ready');
    final total = ms ~/ 1000;
    final h = total ~/ 3600;
    final m = (total % 3600) ~/ 60;
    final s = total % 60;
    if (h > 0) return t('jn.featured.meta.hm', {'h': h, 'm': m});
    if (m > 0) return '${m}m ${s.toString().padLeft(2, '0')}s';
    return '${s}s';
  }

  @override
  Widget build(BuildContext context) {
    final hue = widget.hue;
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [hsl(hue, 50, 14), hsl(hue, 55, 9)],
        ),
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
        border: Border.all(color: hsl(hue, 70, 55, 0.3)),
      ),
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).padding.bottom + 20,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(height: 12),
          Container(
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(999),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(24, 16, 24, 8),
            child: Column(
              children: [
                Container(
                  width: 64,
                  height: 64,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: RadialGradient(
                      colors: [hsl(hue, 80, 60, 0.35), hsl(hue, 70, 40, 0.05)],
                    ),
                    border: Border.all(color: hsl(hue, 80, 65, 0.4)),
                  ),
                  child: const Icon(
                    Icons.access_time_rounded,
                    color: Colors.white70,
                    size: 28,
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  '${widget.journeyEmoji} ${widget.journeyTitle}',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 10 * 0.28,
                    color: hsl(hue, 80, 75),
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  widget.mode == 'ad'
                      ? t('jn.lock.ready', {'day': widget.day})
                      : t('jn.lock.opensTomorrow', {'day': widget.day}),
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  widget.mode == 'ad'
                      ? t('jn.lock.adDesc')
                      : t('jn.lock.timeDesc'),
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 13,
                    height: 1.5,
                    color: Colors.white.withValues(alpha: 0.65),
                  ),
                ),
                if (widget.mode == 'time') ...[
                  const SizedBox(height: 18),
                  Text(
                    _format(),
                    style: TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.w900,
                      color: hsl(hue, 80, 78),
                      fontFeatures: const [FontFeature.tabularFigures()],
                    ),
                  ),
                ],
                const SizedBox(height: 22),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: () {
                      haptic(HapticStyle.medium);
                      widget.onUnlockWithPremium();
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: hsl(42, 85, 55),
                      foregroundColor: hsl(222, 60, 8),
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(18),
                      ),
                    ),
                    child: Text(
                      t('jn.lock.premiumBtn'),
                      style: const TextStyle(
                        fontSize: 14.5,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  t('jn.lock.premiumDesc'),
                  style: TextStyle(
                    fontSize: 11.5,
                    color: Colors.white.withValues(alpha: 0.45),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
