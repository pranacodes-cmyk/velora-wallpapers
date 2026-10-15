import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/services/analytics.dart';
import '../../core/services/haptics.dart';
import '../../core/services/pro_journeys.dart';
import '../../core/services/rating_service.dart';
import '../../core/services/share_service.dart';
import '../../core/theme/app_colors.dart';
import '../../state/app_providers.dart';
import '../challenge/challenge_widgets.dart';
import 'battle_setup.dart';
import 'breath_prayer.dart';
import 'day_complete_overlay.dart';
import 'chapter_reading.dart';
import '../../core/services/pro_journey_study.dart';
import 'pj_ui.dart';
import 'prayer_list.dart';
import 'pro_journey_screen.dart' show openProJourneyPaywall;

const _sessionSteps = <String>['read', 'word', 'practice', 'mission'];

/// One Pro Journey day as a three-beat session: Word → Practice → Mission.
/// Beats persist, so a user can finish the real-life mission later today.
/// Web mirror: `src/pages/ProJourneyDay.tsx`.
class ProJourneyDayScreen extends ConsumerStatefulWidget {
  const ProJourneyDayScreen({super.key, required this.id, this.day});
  final String id;
  final int? day;

  @override
  ConsumerState<ProJourneyDayScreen> createState() => _ProJourneyDayScreenState();
}

class _ProJourneyDayScreenState extends ConsumerState<ProJourneyDayScreen> {
  late final ProJourneyDef j = proJourneyById(widget.id) ?? kProJourneys.first;
  late final int day = () {
    final d = widget.day;
    if (d != null && d >= 1 && d <= j.days) return d;
    return ProJourneyStore.nextDay(j.id) ?? j.days;
  }();
  late final bool _reviewAtOpen = ProJourneyStore.isDayDone(j.id, day);
  late int _step;
  bool _read = false;
  final _note = TextEditingController();
  ProDayResult? _result;
  bool _leaving = false;
  final _scroll = ScrollController();

  bool get _review => _reviewAtOpen;

  @override
  void initState() {
    super.initState();
    final isPremium = ref.read(premiumProvider);
    final open = ProJourneyStore.isDayOpen(j.id, day);
    final gated = !_review && proJourneyRequiresPro(day) && !isPremium;
    final steps = ProJourneyStore.stepsFor(j.id, day);
    final firstOpen = kJourneySteps.indexWhere((s) => !steps.contains(s));
    final study = ProJourneyStudy.entry(j.id, day);
    _read = _review || steps.contains('word') || study['read'] == true;
    _note.text = study['note'] is String ? study['note'] as String : '';
    _step = _review ? 0 : (!_read ? 0 : firstOpen == -1 ? 3 : firstOpen + 1);
    if (!_review && (!open || gated)) {
      _leaving = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) Navigator.of(context).maybePop();
      });
      return;
    }
    if (!_review) ProJourneyStore.start(j.id);
    Analytics.capture('pro_journey_day_viewed', {'id': j.id, 'day': day, 'review': _review});
  }

  @override
  void dispose() {
    _scroll.dispose();
    _note.dispose();
    super.dispose();
  }

  List<String> get _steps => _review ? kJourneySteps : ProJourneyStore.stepsFor(j.id, day);
  bool _has(String s) => _steps.contains(s);
  int get _firstOpen {
    final i = kJourneySteps.indexWhere((s) => !_steps.contains(s));
    return !_read ? 0 : i == -1 ? 3 : i + 1;
  }

  bool _reachable(int i) => _review || i <= _firstOpen;

  void _go(int i) {
    setState(() => _step = i);
    if (_scroll.hasClients) {
      _scroll.animateTo(0, duration: const Duration(milliseconds: 320), curve: Curves.easeOutCubic);
    }
  }

  void _mark(String s) {
    if (!_review) ProJourneyStore.markStep(j.id, day, s);
  }

  void _finish() {
    final r = ProJourneyStore.completeDay(j.id, day);
    if (r == null) return;
    haptic(HapticStyle.heavy);
    final isPremium = ref.read(premiumProvider);
    Analytics.capture('pro_journey_day_done', {'id': j.id, 'day': day, 'finished': r.finished, 'premium': isPremium});
    if (r.finished) Analytics.capture('pro_journey_finished', {'id': j.id});
    setState(() => _result = r);
  }

  void _close() => Navigator.of(context).maybePop();

  @override
  Widget build(BuildContext context) {
    if (_leaving) return Scaffold(backgroundColor: AppColors.background);
    final isPremium = ref.watch(premiumProvider);
    final plan = proJourneyDay(j, day);
    final name = t('pj.${j.id}.name');
    final result = _result;

    return ListenableBuilder(
      listenable: ProJourneyStore.revision,
      builder: (context, _) {
        final allDone = kJourneySteps.every(_has);
        return Scaffold(
          backgroundColor: AppColors.background,
          body: Stack(children: [
            Column(children: [
              _header(name),
              Expanded(
                child: ListView(
                  controller: _scroll,
                  padding: EdgeInsets.fromLTRB(16, 12, 16, 40 + MediaQuery.paddingOf(context).bottom),
                  children: [
                    Center(
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 560),
                        child: PjRise(
                          key: ValueKey(_step),
                          child: switch (_step) {
                            0 => _reading(plan),
                            1 => _word(plan),
                            2 => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                              Text(t('pj.step.practice'), style: TextStyle(fontSize: 20, fontWeight: FontWeight.w600, color: AppColors.foreground)),
                              for (final line in plan.exercise.split('\n').where((line) => line.isNotEmpty)) Padding(padding: const EdgeInsets.only(top: 16), child: Text(line, style: TextStyle(fontSize: 16, height: 1.75, color: AppColors.foreground))),
                              const SizedBox(height: 20), Divider(color: AppColors.border), const SizedBox(height: 20), _practice(plan),
                            ]),
                            _ => _mission(plan, allDone),
                          },
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ]),
            if (result != null)
              Positioned.fill(
                child: DayCompleteOverlay(
                  journey: j,
                  result: result,
                  showPro: !isPremium && !result.finished && proJourneyRequiresPro(result.day + 1),
                  onShare: () {
                    Analytics.capture('pro_journey_shared', {'id': j.id, 'day': result.day});
                    ShareService.share(
                      title: name,
                      text: result.finished
                          ? t('pj.share.done', {'name': name, 'days': j.days})
                          : t('pj.share.day', {'n': result.day, 'name': name}),
                      includeAppLink: true,
                    );
                  },
                  onPro: () => openProJourneyPaywall(context, ref, j, 'celebration'),
                  onDone: () {
                    final teased = !ref.read(premiumProvider) && !result.finished && proJourneyRequiresPro(result.day + 1);
                    _close();
                    // Never stack a rating ask on top of the Pro invitation.
                    if (!teased) {
                      Timer(const Duration(milliseconds: 1200), () => RatingService.maybeRequestRating());
                    }
                  },
                ),
              ),
          ]),
        );
      },
    );
  }

  /* ── header ── */

  Widget _header(String name) {
    final pad = MediaQuery.paddingOf(context);
    return Container(
      color: AppColors.background.withValues(alpha: 0.97),
      padding: EdgeInsets.fromLTRB(16, pad.top > 12 ? pad.top : 12.0, 16, 12),
      child: Column(children: [
        Row(children: [
          Container(
            width: 40,
            height: 40,
            clipBehavior: Clip.antiAlias,
            decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: AppColors.primary.withValues(alpha: 0.3))),
            child: Image.asset(j.cover, fit: BoxFit.cover, cacheWidth: 120),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(name, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.foreground)),
              Text('${t('pj.progress', {'n': day, 'total': j.days})} · ${t('pj.depth.stepOf', {'n': _step + 1})}',
                  style: TextStyle(fontSize: 12, color: AppColors.mutedForeground)),
            ]),
          ),
          RoundIconButton(icon: 'x', label: t('pj.close'), onTap: _close),
        ]),
        const SizedBox(height: 12),
        Row(children: [
          for (var i = 0; i < _sessionSteps.length; i++) ...[
            if (i > 0) const SizedBox(width: 6),
            Expanded(child: _stepTab(i)),
          ],
        ]),
      ]),
    );
  }

  Widget _stepTab(int i) {
    final s = _sessionSteps[i];
    final reachable = _reachable(i);
    final done = s == 'read' ? _read : _has(s);
    final current = i == _step;
    return Semantics(
      button: true,
      enabled: reachable,
      selected: current,
      label: t(s == 'read' ? 'pj.depth.read' : s == 'word' ? 'pj.depth.insight' : 'pj.step.$s'),
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: reachable
            ? () {
                haptic(HapticStyle.light);
                _go(i);
              }
            : null,
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          AnimatedContainer(
            duration: const Duration(milliseconds: 500),
            height: 6,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(99),
              gradient: done ? PjInk.goldGradient : null,
              color: done ? null : current ? AppColors.primary.withValues(alpha: 0.4) : AppColors.muted,
            ),
          ),
          const SizedBox(height: 4),
          Text(upper(t(s == 'read' ? 'pj.depth.read' : s == 'word' ? 'pj.depth.insight' : 'pj.step.$s')),
              maxLines: 3, overflow: TextOverflow.ellipsis, style: ChInk.eyebrow(10.5, current ? AppColors.primary : AppColors.mutedForeground, tracking: 0.12)),
        ]),
      ),
    );
  }

  Widget _nextButton() => GoldButton(
        label: t('pj.next'),
        trailing: 'chevron-right',
        onTap: () {
          haptic(HapticStyle.light);
          _go(_step + 1);
        },
      );

  Widget _reading(ProJourneyDayPlan plan) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
    Text(plan.title, style: ChInk.serif(30, height: 1.15)), const SizedBox(height: 16),
    Text(plan.context, style: TextStyle(fontSize: 16, height: 1.6, color: AppColors.mutedForeground)), const SizedBox(height: 24),
    ChapterReading(passage: plan.passage, onRead: () { setState(() => _read = true); ProJourneyStudy.save(j.id, day, true, _note.text); _go(1); }),
  ]);

  /* ── Word ── */

  Widget _word(ProJourneyDayPlan plan) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(upper(t('pj.progress', {'n': day, 'total': j.days})), style: ChInk.eyebrow(11.5, AppColors.primary, tracking: 0.2)),
            const SizedBox(height: 4),
            Text(plan.title, style: ChInk.serif(30, height: 1.1)),
          ]),
        ),
        const SizedBox(height: 16),
        for (final paragraph in plan.teaching.split('\n\n')) Padding(padding: const EdgeInsets.only(bottom: 20), child: Text(paragraph, style: TextStyle(fontSize: 17, height: 1.8, color: AppColors.foreground))),
        Divider(color: AppColors.border), const SizedBox(height: 16),
        Text(t('pj.depth.reflect'), style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: AppColors.primary)), const SizedBox(height: 12),
        Text(plan.reflect, style: TextStyle(fontSize: 16, height: 1.6, color: AppColors.foreground)), const SizedBox(height: 16),
        TextField(controller: _note, minLines: 4, maxLines: 8, maxLength: 4000,
          style: TextStyle(fontSize: 16, color: AppColors.foreground),
          decoration: InputDecoration(labelText: t('pj.depth.note'), hintText: t('pj.depth.noteHint')),
          onChanged: (value) => ProJourneyStudy.save(j.id, day, _read, value)),
        Text(t('pj.depth.private'), style: TextStyle(fontSize: 12, color: AppColors.mutedForeground)),
        const SizedBox(height: 16),
        GoldButton(
          label: t('pj.next'),
          trailing: 'chevron-right',
          onTap: () {
            haptic(HapticStyle.light);
            _mark('word');
            _go(2);
          },
        ),
      ]);

  /* ── Practice ── */

  Widget _practice(ProJourneyDayPlan plan) {
    final done = _has('practice');
    void onDone() => _mark('practice');

    switch (j.practice) {
      case PracticeKind.declare:
        return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Container(
            clipBehavior: Clip.antiAlias,
            decoration: BoxDecoration(
              color: AppColors.card,
              borderRadius: BorderRadius.circular(26),
              border: Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
            ),
            child: Stack(alignment: Alignment.center, children: [
              Positioned.fill(
                child: IgnorePointer(
                  child: Center(
                    child: AnimatedOpacity(
                      opacity: done ? 1 : 0.4,
                      duration: const Duration(milliseconds: 600),
                      child: Container(width: 256, height: 256, decoration: PjInk.halo),
                    ),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 32),
                child: Column(children: [
                  Text(upper(t('pj.dec.label')), textAlign: TextAlign.center, style: ChInk.eyebrow(11, AppColors.primary, tracking: 0.2)),
                  const SizedBox(height: 16),
                  ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 340),
                    child: Text(plan.practice, textAlign: TextAlign.center, style: ChInk.serif(27, height: 1.22)),
                  ),
                  const SizedBox(height: 20),
                  if (done)
                    PjDonePill(t('pj.dec.done'))
                  else
                    ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 300),
                      child: Text(t('pj.dec.hint'), textAlign: TextAlign.center, style: TextStyle(fontSize: 13.5, height: 1.5, color: AppColors.mutedForeground)),
                    ),
                ]),
              ),
            ]),
          ),
          const SizedBox(height: 16),
          if (!done && !_review)
            HoldButton(
              label: t('pj.dec.hold'),
              holdingLabel: t('pj.dec.holding'),
              duration: const Duration(milliseconds: 1800),
              onComplete: () {
                onDone();
                Analytics.capture('pro_journey_declared', {'id': j.id, 'day': day});
              },
            ),
          if (done || _review) _nextButton(),
        ]);

      case PracticeKind.breathe:
        return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(upper(t('pj.br.label')), style: ChInk.eyebrow(11, AppColors.primary, tracking: 0.2)),
              const SizedBox(height: 4),
              Text(t('pj.br.hint'), style: TextStyle(fontSize: 13.5, height: 1.5, color: AppColors.mutedForeground)),
            ]),
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.fromLTRB(16, 24, 16, 24),
            decoration: pjCard(radius: 26),
            child: Column(children: [
              Text(plan.breatheIn, textAlign: TextAlign.center, style: ChInk.serif(20, weight: FontWeight.w400, height: 1.35)),
              Text(plan.breatheOut,
                  textAlign: TextAlign.center, style: ChInk.serif(20, weight: FontWeight.w400, color: AppColors.primary, style: FontStyle.italic, height: 1.35)),
              const SizedBox(height: 16),
              BreathPrayer(inText: plan.breatheIn, outText: plan.breatheOut, framed: false, initiallyDone: done || _review, onComplete: onDone),
            ]),
          ),
          if (done || _review) ...[const SizedBox(height: 16), _nextButton()],
        ]);

      case PracticeKind.battle:
        final needsPlan = day == 1 && !ProJourneyStore.hasPlan && !_review;
        final checked = ProJourneyStore.checkinToday();
        final needsCheckin = day > 1 && checked == null && !_review;
        if (needsPlan) {
          return Container(padding: const EdgeInsets.all(16), decoration: pjCard(radius: 24), child: const BattleSetup());
        }
        if (needsCheckin) {
          return Container(
            padding: const EdgeInsets.all(20),
            decoration: pjCard(radius: 24),
            child: Column(children: [
              Text(t('pj.fr.check'), textAlign: TextAlign.center, style: ChInk.serif(22, height: 1.3)),
              const SizedBox(height: 16),
              Row(children: [
                Expanded(
                  child: GoldButton(
                    label: t('pj.fr.free'),
                    height: 48,
                    fontSize: 14.5,
                    onTap: () {
                      haptic(HapticStyle.medium);
                      ProJourneyStore.checkIn('free');
                      Analytics.capture('pro_journey_checkin', {'result': 'free', 'day': day});
                    },
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: OutlineButton(
                    label: t('pj.fr.slip'),
                    onTap: () {
                      haptic(HapticStyle.light);
                      ProJourneyStore.checkIn('slip');
                      Analytics.capture('pro_journey_checkin', {'result': 'slip', 'day': day});
                    },
                  ),
                ),
              ]),
            ]),
          );
        }
        return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          if (day > 1 && checked != null && !_review) ...[
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: checked == 'free' ? AppColors.primary.withValues(alpha: 0.1) : AppColors.muted.withValues(alpha: 0.6),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: checked == 'free' ? AppColors.primary.withValues(alpha: 0.25) : AppColors.border),
              ),
              child: Text(t(checked == 'free' ? 'pj.fr.freeMsg' : 'pj.fr.slipMsg'),
                  style: TextStyle(fontSize: 14, height: 1.5, color: AppColors.foreground)),
            ),
            const SizedBox(height: 16),
          ],
          _amenCard(t('pj.fr.prayer'), plan.practice, done),
          ..._amenAndNext(done, onDone),
        ]);

      default: // PracticeKind.intercede
        return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          _amenCard(t('pj.pl.prompt'), plan.practice, done),
          const SizedBox(height: 16),
          Container(padding: const EdgeInsets.all(16), decoration: pjCard(), child: const PrayerList(compact: true)),
          ..._amenAndNext(done, onDone),
        ]);
    }
  }

  List<Widget> _amenAndNext(bool done, VoidCallback onDone) => [
        if (!done && !_review) ...[
          const SizedBox(height: 16),
          HoldButton(
            label: t('pj.holdAmen'),
            holdingLabel: t('pj.amen'),
            duration: const Duration(milliseconds: 1600),
            onComplete: () {
              onDone();
              Analytics.capture('pro_journey_prayed', {'id': j.id, 'day': day});
            },
          ),
        ],
        if (done || _review) ...[const SizedBox(height: 16), _nextButton()],
      ];

  Widget _amenCard(String title, String text, bool done) => Container(
        padding: const EdgeInsets.all(16),
        decoration: pjCard(),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            LucideIconLite('hand-heart', size: 14, color: AppColors.primary),
            const SizedBox(width: 6),
            Expanded(child: Text(upper(title), style: PjInk.eyebrow())),
          ]),
          const SizedBox(height: 8),
          Text(text, style: ChInk.serif(19, weight: FontWeight.w400, style: FontStyle.italic, height: 1.5, color: AppColors.foreground.withValues(alpha: 0.9))),
          if (done) ...[const SizedBox(height: 12), PjDonePill(t('pj.amen'))],
        ]),
      );

  /* ── Mission ── */

  Widget _mission(ProJourneyDayPlan plan, bool allDone) {
    final checked = _has('mission');
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Container(
        padding: const EdgeInsets.all(20),
        decoration: pjCard(radius: 24),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(t('pj.mi.label', {'n': day.toString().padLeft(2, '0')}),
              style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: AppColors.primary)),
          const SizedBox(height: 12),
          ExcludeSemantics(child: Text(plan.emoji, style: const TextStyle(fontSize: 40, height: 1))),
          const SizedBox(height: 12),
          Text(plan.mission, style: TextStyle(fontSize: 20, fontWeight: FontWeight.w600, height: 1.35, color: AppColors.foreground)),
          const SizedBox(height: 20),
          Text(t('pj.depth.guide'), style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.primary)),
          for (final line in plan.guide.split('\n').where((line) => line.isNotEmpty)) Padding(padding: const EdgeInsets.only(top: 12), child: Text(line, style: TextStyle(fontSize: 15, height: 1.6, color: AppColors.foreground))),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.only(left: 12),
            decoration: BoxDecoration(border: Border(left: BorderSide(color: AppColors.primary.withValues(alpha: 0.5), width: 2))),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(t('pj.mi.why'), style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.primary)),
              const SizedBox(height: 4),
              Text(plan.why, style: TextStyle(fontSize: 14, height: 1.55, color: AppColors.mutedForeground)),
            ]),
          ),
          const SizedBox(height: 20),
          Semantics(
            button: true,
            toggled: checked,
            enabled: !_review,
            label: t('pj.mi.done'),
            excludeSemantics: true,
            child: GestureDetector(
              onTap: _review
                  ? null
                  : () {
                      haptic(checked ? HapticStyle.light : HapticStyle.medium);
                      if (checked) {
                        ProJourneyStore.unmarkStep(j.id, day, 'mission');
                      } else {
                        _mark('mission');
                        Analytics.capture('pro_journey_mission_done', {'id': j.id, 'day': day});
                      }
                    },
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                constraints: const BoxConstraints(minHeight: 48),
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                decoration: BoxDecoration(
                  color: checked ? AppColors.primary.withValues(alpha: 0.1) : null,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: checked ? AppColors.primary : AppColors.primary.withValues(alpha: 0.4)),
                ),
                child: Row(children: [
                  AnimatedContainer(
                    duration: const Duration(milliseconds: 180),
                    width: 20,
                    height: 20,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: checked ? AppColors.primary : null,
                      borderRadius: BorderRadius.circular(4),
                      border: checked ? null : Border.all(color: AppColors.primary, width: 2),
                    ),
                    child: checked ? LucideIconLite('check', size: 14, color: AppColors.primaryForeground, strokeWidth: 3.5) : null,
                  ),
                  const SizedBox(width: 12),
                  Expanded(child: Text(t('pj.mi.done'), style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w600, color: AppColors.foreground))),
                ]),
              ),
            ),
          ),
          if (!_review && !checked) ...[
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: Text(t('pj.mi.later'), textAlign: TextAlign.center, style: TextStyle(fontSize: 12.5, height: 1.5, color: AppColors.mutedForeground)),
            ),
          ],
        ]),
      ),
      const SizedBox(height: 16),
      if (_review)
        GoldButton(label: t('pj.close'), onTap: _close)
      else
        PjGoldButton(label: t('pj.complete', {'n': day}), icon: 'sparkles', shine: false, onTap: allDone ? _finish : null),
    ]);
  }
}
