import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/theme/app_colors.dart';
import 'today_ink.dart';

/// Home gift shortcut — gold gradient circle with a notification dot that
/// pulses until the user opens it once. Web mirror: `GiftButton` in Today.tsx.
class GiftButton extends StatefulWidget {
  const GiftButton({super.key, required this.onTap});
  final VoidCallback onTap;

  @override
  State<GiftButton> createState() => _GiftButtonState();
}

class _GiftButtonState extends State<GiftButton> with SingleTickerProviderStateMixin {
  static const _seenKey = 'prayly_gift_seen_v1';
  late final AnimationController _pulse =
      AnimationController(vsync: this, duration: const Duration(milliseconds: 1600))..repeat();
  bool _seen = true;

  @override
  void initState() {
    super.initState();
    SharedPreferences.getInstance().then((p) {
      if (mounted) setState(() => _seen = p.getBool(_seenKey) ?? false);
    });
  }

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  Future<void> _tap() async {
    widget.onTap();
    if (!_seen) {
      setState(() => _seen = true);
      (await SharedPreferences.getInstance()).setBool(_seenKey, true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final gold = TodayInk.primary;
    return Semantics(
      button: true,
      label: 'Life Calendar gift',
      child: GestureDetector(
        onTap: _tap,
        child: SizedBox(
          width: 44,
          height: 44,
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              Container(
                width: 44,
                height: 44,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [Color.lerp(gold, Colors.white, 0.25)!, gold],
                  ),
                  boxShadow: [BoxShadow(color: gold.withValues(alpha: 0.45), blurRadius: 14, offset: const Offset(0, 4))],
                ),
                child: Icon(Icons.card_giftcard_rounded, size: 22, color: AppColors.primaryForeground),
              ),
              if (!_seen)
                Positioned(
                  top: -1,
                  right: -1,
                  child: AnimatedBuilder(
                    animation: _pulse,
                    builder: (_, __) {
                      final v = _pulse.value;
                      return SizedBox(
                        width: 14,
                        height: 14,
                        child: Stack(alignment: Alignment.center, children: [
                          Container(
                            width: 14 + 10 * v,
                            height: 14 + 10 * v,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: AppColors.destructive.withValues(alpha: 0.5 * (1 - v)),
                            ),
                          ),
                          Container(
                            width: 13,
                            height: 13,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: AppColors.destructive,
                              border: Border.all(color: AppColors.background, width: 2),
                            ),
                          ),
                        ]),
                      );
                    },
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
