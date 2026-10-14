import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/services/haptics.dart';
import '../../core/theme/app_colors.dart';
import '../challenge/challenge_widgets.dart';
import 'pj_ui.dart';

const _inDur = Duration(milliseconds: 4000);
const _outDur = Duration(milliseconds: 6000);

enum _Phase { idle, breatheIn, breatheOut, done }

/// One-minute breath prayer: six slow breaths (4 s in, 6 s out ≈ 6 breaths a
/// minute), praying one phrase on the in-breath and one on the out-breath.
/// Reduced motion swaps the animated orb for a counted, self-paced version.
/// Web mirror: `src/components/projourney/BreathPrayer.tsx`.
class BreathPrayer extends StatefulWidget {
  const BreathPrayer({
    super.key,
    this.inText,
    this.outText,
    this.cycles = 6,
    this.initiallyDone = false,
    this.framed = true,
    required this.onComplete,
  });
  final String? inText;
  final String? outText;
  final int cycles;

  /// Already completed (e.g. resumed day) — start in the finished state.
  final bool initiallyDone;

  /// False when the parent already shows the words inside its own card.
  final bool framed;
  final VoidCallback onComplete;

  @override
  State<BreathPrayer> createState() => _BreathPrayerState();
}

class _BreathPrayerState extends State<BreathPrayer> {
  late _Phase _phase = widget.initiallyDone ? _Phase.done : _Phase.idle;
  int _breath = 0;
  Timer? _timer;

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _run(int n) {
    setState(() {
      _breath = n;
      _phase = _Phase.breatheIn;
    });
    haptic(HapticStyle.soft);
    _timer = Timer(_inDur, () {
      if (!mounted) return;
      setState(() => _phase = _Phase.breatheOut);
      haptic(HapticStyle.soft);
      _timer = Timer(_outDur, () {
        if (!mounted) return;
        if (n >= widget.cycles) {
          setState(() => _phase = _Phase.done);
          haptic(HapticStyle.medium);
          widget.onComplete();
        } else {
          _run(n + 1);
        }
      });
    });
  }

  void _start() {
    _timer?.cancel();
    _run(1);
  }

  @override
  Widget build(BuildContext context) {
    final reduced = MediaQuery.maybeOf(context)?.disableAnimations ?? false;
    if (reduced && _phase != _Phase.done) return _reducedView();

    final running = _phase == _Phase.breatheIn || _phase == _Phase.breatheOut;
    final scale = switch (_phase) {
      _Phase.breatheIn => 1.0,
      _Phase.breatheOut => 0.58,
      _Phase.done => 0.86,
      _Phase.idle => 0.7,
    };
    final duration = switch (_phase) {
      _Phase.breatheIn => _inDur,
      _Phase.breatheOut => _outDur,
      _ => const Duration(milliseconds: 600),
    };
    final phrase = _phase == _Phase.breatheIn ? widget.inText : _phase == _Phase.breatheOut ? widget.outText : null;
    const ink = ChInk.ctaForeground;

    Widget center;
    if (running) {
      center = Column(mainAxisSize: MainAxisSize.min, children: [
        Text(upper(t(_phase == _Phase.breatheIn ? 'pj.br.in' : 'pj.br.out')), textAlign: TextAlign.center, style: ChInk.eyebrow(11, ink, tracking: 0.2)),
        if (phrase != null && phrase.isNotEmpty) ...[
          const SizedBox(height: 4),
          PjRise(
            key: ValueKey('$_breath-$_phase'),
            child: Text(phrase, textAlign: TextAlign.center, style: ChInk.serif(20, color: ink, height: 1.15)),
          ),
        ],
      ]);
    } else if (_phase == _Phase.done) {
      center = PjPop(child: Text(t('pj.br.done'), textAlign: TextAlign.center, style: ChInk.serif(20, color: ink, height: 1.15)));
    } else {
      center = Text(widget.inText ?? t('pj.br.in'), textAlign: TextAlign.center, style: ChInk.serif(18, color: ink, height: 1.15));
    }

    final label = running ? t('pj.br.count', {'n': _breath, 'total': widget.cycles}) : '';
    return Column(mainAxisSize: MainAxisSize.min, children: [
      Semantics(
        liveRegion: true,
        label: running ? '${t(_phase == _Phase.breatheIn ? 'pj.br.in' : 'pj.br.out')} ${phrase ?? ''}' : null,
        child: SizedBox(
          width: 232,
          height: 232,
          child: Stack(alignment: Alignment.center, children: [
            Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(color: AppColors.primary.withValues(alpha: 0.25), width: 1.5),
                ),
              ),
            ),
            Positioned.fill(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: AnimatedScale(
                  scale: scale,
                  duration: duration,
                  curve: const Cubic(0.45, 0, 0.55, 1),
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: RadialGradient(
                        center: const Alignment(0, -0.16),
                        colors: [
                          ChInk.goldGlow.withValues(alpha: 0.95),
                          ChInk.gold.withValues(alpha: 0.75),
                          ChInk.gold.withValues(alpha: 0.12),
                          ChInk.gold.withValues(alpha: 0),
                        ],
                        stops: const [0, 0.45, 0.72, 0.74],
                      ),
                      boxShadow: [BoxShadow(color: ChInk.gold.withValues(alpha: 0.35), blurRadius: 60)],
                    ),
                  ),
                ),
              ),
            ),
            Padding(padding: const EdgeInsets.symmetric(horizontal: 24), child: center),
          ]),
        ),
      ),
      const SizedBox(height: 12),
      SizedBox(
        height: 20,
        child: Text(label, style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: AppColors.mutedForeground, fontFeatures: const [FontFeature.tabularFigures()])),
      ),
      if (_phase == _Phase.idle) ...[
        const SizedBox(height: 8),
        GoldButton(label: t('pj.br.start'), onTap: _start),
      ],
      if (_phase == _Phase.done)
        TextButton(
          onPressed: _start,
          child: Text(t('pj.br.again'), style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: AppColors.primary)),
        ),
    ]);
  }

  Widget _reducedView() {
    final body = Column(mainAxisSize: MainAxisSize.min, children: [
      if (widget.framed && (widget.inText ?? '').isNotEmpty)
        Text(widget.inText!, textAlign: TextAlign.center, style: ChInk.serif(22, weight: FontWeight.w400, height: 1.3)),
      if (widget.framed && (widget.outText ?? '').isNotEmpty) ...[
        const SizedBox(height: 4),
        Text(widget.outText!, textAlign: TextAlign.center, style: ChInk.serif(22, weight: FontWeight.w400, color: AppColors.primary, style: FontStyle.italic, height: 1.3)),
      ],
      if (widget.framed) const SizedBox(height: 12),
      ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 300),
        child: Text(t('pj.br.reduced'), textAlign: TextAlign.center, style: TextStyle(fontSize: 13.5, height: 1.5, color: AppColors.mutedForeground)),
      ),
      const SizedBox(height: 16),
      GoldButton(
        label: t('pj.br.reducedDone'),
        height: 48,
        onTap: () {
          haptic(HapticStyle.medium);
          setState(() => _phase = _Phase.done);
          widget.onComplete();
        },
      ),
    ]);
    if (!widget.framed) return body;
    return Container(width: double.infinity, padding: const EdgeInsets.all(20), decoration: pjCard(), child: body);
  }
}
