import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/services/analytics.dart';
import '../../core/services/challenge_store.dart';
import '../../core/services/haptics.dart';
import '../../core/services/pro_journeys.dart';
import '../../core/services/share_service.dart';
import '../../core/theme/app_colors.dart';
import '../../state/app_providers.dart';
import '../../widgets/premium_sheet.dart';
import '../challenge/challenge_widgets.dart';
import 'battle_setup.dart';
import 'breath_prayer.dart';
import 'pj_ui.dart';
import 'prayer_list.dart';
import 'pro_journey_day_screen.dart';
import 'stand_firm_sheet.dart';

/// Opens the premium sheet for a Pro Journey entry point.
void openProJourneyPaywall(BuildContext context, WidgetRef ref, ProJourneyDef j, String from) {
  haptic(HapticStyle.light);
  Analytics.capture('pro_journey_paywall', {'id': j.id, 'from': from});
  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (sheet) => PremiumSheet(
      trigger: 'pro_journey_${j.id}',
      onClose: () => Navigator.pop(sheet),
      onUnlock: () => ref.read(premiumProvider.notifier).setUnlocked(),
    ),
  );
}

/// Pro Journey detail — cinematic cover, today's call to action, the tool that
/// makes the journey unique, and the day-by-day path.
/// Web mirror: `src/pages/ProJourney.tsx`.
class ProJourneyScreen extends ConsumerStatefulWidget {
  const ProJourneyScreen({super.key, required this.id});
  final String id;

  @override
  ConsumerState<ProJourneyScreen> createState() => _ProJourneyScreenState();
}

class _ProJourneyScreenState extends ConsumerState<ProJourneyScreen> {
  late final ProJourneyDef j = proJourneyById(widget.id) ?? kProJourneys.first;

  @override
  void initState() {
    super.initState();
    final s = ProJourneyStore.status(j.id);
    Analytics.capture('pro_journey_viewed', {
      'id': j.id,
      'status': s.kind.name,
      'done': ProJourneyStore.doneCount(j.id),
      'premium': ref.read(premiumProvider),
    });
  }

  Future<void> _openDay(int day) async {
    await Navigator.of(context).push(MaterialPageRoute(builder: (_) => ProJourneyDayScreen(id: j.id, day: day)));
    if (mounted) setState(() {});
  }

  void _unlock(String from) => openProJourneyPaywall(context, ref, j, from);

  void _confirmRestart() {
    haptic(HapticStyle.light);
    showChallengeSheet<void>(
      context,
      title: t('pj.restart'),
      closeLabel: t('pj.close'),
      builder: (sheet) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text(t('pj.restartConfirm'), style: TextStyle(fontSize: 14.5, height: 1.5, color: AppColors.mutedForeground)),
        const SizedBox(height: 20),
        Row(children: [
          Expanded(child: OutlineButton(label: t('pj.cancel'), onTap: () => Navigator.of(sheet).pop())),
          const SizedBox(width: 8),
          Expanded(
            child: GoldButton(
              label: t('pj.restartYes'),
              height: 48,
              onTap: () {
                haptic(HapticStyle.medium);
                ProJourneyStore.restart(j.id);
                Analytics.capture('pro_journey_restarted', {'id': j.id});
                Navigator.of(sheet).pop();
              },
            ),
          ),
        ]),
      ]),
    );
  }

  void _editPlan() {
    haptic(HapticStyle.light);
    showChallengeSheet<void>(
      context,
      title: t('pj.fr.planTitle'),
      closeLabel: t('pj.close'),
      builder: (sheet) => BattleSetup(onSaved: () => Navigator.of(sheet).pop()),
    );
  }

  void _breatheNow() {
    haptic(HapticStyle.light);
    final day = math.max(1, math.min(j.days, ProJourneyStore.doneCount(j.id) == 0 ? 1 : ProJourneyStore.doneCount(j.id)));
    final plan = proJourneyDay(j, day);
    showChallengeSheet<void>(
      context,
      title: t('pj.pe.now'),
      closeLabel: t('pj.close'),
      builder: (_) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: BreathPrayer(
          inText: plan.breatheIn,
          outText: plan.breatheOut,
          onComplete: () => Analytics.capture('pro_journey_breathe_now', {'day': day}),
        ),
      ),
    );
  }

  void _share(String text) {
    haptic(HapticStyle.light);
    ShareService.share(title: t('pj.${j.id}.name'), text: text, includeAppLink: true);
  }

  @override
  Widget build(BuildContext context) {
    final isPremium = ref.watch(premiumProvider);
    return ListenableBuilder(
      listenable: ProJourneyStore.revision,
      builder: (context, _) {
        final status = ProJourneyStore.status(j.id);
        final done = ProJourneyStore.doneCount(j.id);
        final name = t('pj.${j.id}.name');
        final active = status.kind != JourneyStatusKind.fresh && status.kind != JourneyStatusKind.done;
        final pad = MediaQuery.paddingOf(context);
        return Scaffold(
          backgroundColor: AppColors.background,
          body: ListView(
            padding: EdgeInsets.only(bottom: 32 + pad.bottom),
            children: [
              _hero(name, status, isPremium),
              Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 560),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                      if (done > 0) ...[
                        _progress(done, name),
                        const SizedBox(height: 12),
                      ],
                      _cta(status, isPremium, name),
                      if (status.kind != JourneyStatusKind.fresh) ..._tool(isPremium),
                      const SizedBox(height: 24),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 4),
                        child: Text(t('pj.${j.id}.promise'), style: TextStyle(fontSize: 15, height: 1.6, color: AppColors.foreground.withValues(alpha: 0.85))),
                      ),
                      const SizedBox(height: 12),
                      _outcomes(),
                      const SizedBox(height: 24),
                      Padding(padding: const EdgeInsets.symmetric(horizontal: 4), child: Text(t('pj.path'), style: JourneyText.section())),
                      const SizedBox(height: 8),
                      for (var d = 1; d <= j.days; d++) _pathRow(d, isPremium),
                      if (j.id == 'peace' || j.id == 'freedom') ...[
                        const SizedBox(height: 24),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 8),
                          child: Text(t(j.id == 'peace' ? 'pj.pe.care' : 'pj.fr.help'),
                              textAlign: TextAlign.center, style: TextStyle(fontSize: 11.5, height: 1.5, color: AppColors.mutedForeground)),
                        ),
                      ],
                      if (active) ...[
                        const SizedBox(height: 16),
                        Center(
                          child: TextButton.icon(
                            onPressed: _confirmRestart,
                            icon: LucideIconLite('rotate-ccw', size: 14, color: AppColors.mutedForeground),
                            label: Text(t('pj.restart'), style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.mutedForeground)),
                          ),
                        ),
                      ],
                    ]),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  /* ── hero ── */

  Widget _hero(String name, JourneyStatus status, bool isPremium) {
    final size = MediaQuery.sizeOf(context);
    final pad = MediaQuery.paddingOf(context);
    final h = math.min(size.height * 0.58, 440.0);
    final chip = '${t('pj.days', {'n': j.days})}${!isPremium && status.kind == JourneyStatusKind.fresh ? ' · ${t('pj.status.locked')}' : ''}';
    return SizedBox(
      height: h,
      child: Stack(fit: StackFit.expand, children: [
        Image.asset(j.cover, fit: BoxFit.cover),
        Positioned(
          left: 0,
          right: 0,
          top: 0,
          height: 112,
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [PjInk.posterScrim.withValues(alpha: 0.55), PjInk.posterScrim.withValues(alpha: 0)],
              ),
            ),
          ),
        ),
        DecoratedBox(decoration: BoxDecoration(gradient: PjInk.heroFade)),
        Positioned(
          left: 16,
          top: math.max(12, pad.top),
          child: Semantics(
            button: true,
            label: t('pj.back'),
            child: GestureDetector(
              onTap: () => Navigator.of(context).maybePop(),
              child: Container(
                width: 40,
                height: 40,
                alignment: Alignment.center,
                decoration: BoxDecoration(shape: BoxShape.circle, color: PjInk.posterScrim.withValues(alpha: 0.45)),
                child: const LucideIconLite('chevron-left', size: 20, color: PjInk.posterInk),
              ),
            ),
          ),
        ),
        Positioned(
          right: 16,
          top: math.max(16, pad.top + 4),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(gradient: PjInk.goldGradient, borderRadius: BorderRadius.circular(999)),
            child: Text(t('pj.pro'), style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w900, letterSpacing: 1, color: ChInk.ctaForeground)),
          ),
        ),
        Positioned(
          left: 20,
          right: 20,
          bottom: 16,
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: AppColors.background.withValues(alpha: 0.85),
                borderRadius: BorderRadius.circular(999),
                boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.08), blurRadius: 4, offset: const Offset(0, 1))],
              ),
              child: Text(upper(chip), style: ChInk.eyebrow(11, AppColors.primary, tracking: 0.16)),
            ),
            const SizedBox(height: 4),
            Text('${j.emoji} $name', style: ChInk.serif(34, height: 1.05)),
            const SizedBox(height: 6),
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: Text(t('pj.${j.id}.tag'), style: TextStyle(fontSize: 15, height: 1.35, color: AppColors.foreground.withValues(alpha: 0.8))),
            ),
          ]),
        ),
      ]),
    );
  }

  Widget _progress(int done, String name) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 4),
        child: Row(children: [
          Text('$done/${j.days}',
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.mutedForeground, fontFeatures: const [FontFeature.tabularFigures()])),
          const SizedBox(width: 12),
          Expanded(
            child: Semantics(
              label: name,
              value: '$done/${j.days}',
              child: ClipRRect(
                borderRadius: BorderRadius.circular(99),
                child: SizedBox(
                  height: 6,
                  child: Stack(children: [
                    Positioned.fill(child: ColoredBox(color: AppColors.muted)),
                    TweenAnimationBuilder<double>(
                      tween: Tween(begin: 0, end: done / j.days),
                      duration: const Duration(milliseconds: 700),
                      curve: Curves.easeOutCubic,
                      builder: (_, v, __) => FractionallySizedBox(
                        widthFactor: v.clamp(0.0, 1.0),
                        heightFactor: 1,
                        child: DecoratedBox(
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(99),
                            gradient: LinearGradient(colors: [PjInk.voyageGold, ChInk.goldGlow]),
                          ),
                        ),
                      ),
                    ),
                  ]),
                ),
              ),
            ),
          ),
        ]),
      );

  /* ── primary call to action ── */

  Widget _cta(JourneyStatus status, bool isPremium, String name) {
    if (status.kind == JourneyStatusKind.done) {
      return Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: AppColors.primary.withValues(alpha: 0.35)),
        ),
        child: Column(children: [
          Container(
            width: 64,
            height: 64,
            alignment: Alignment.center,
            decoration: BoxDecoration(shape: BoxShape.circle, gradient: PjInk.goldGradient),
            child: Text(j.emoji, style: const TextStyle(fontSize: 30)),
          ),
          const SizedBox(height: 12),
          Text(upper('${t('pj.badge')} · ${t('pj.${j.id}.badge')}'), textAlign: TextAlign.center, style: ChInk.eyebrow(11, AppColors.primary)),
          const SizedBox(height: 4),
          Text(t('pj.${j.id}.doneTitle'), textAlign: TextAlign.center, style: ChInk.serif(24)),
          const SizedBox(height: 4),
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 320),
            child: Text(t('pj.${j.id}.doneSub'), textAlign: TextAlign.center, style: TextStyle(fontSize: 14, height: 1.5, color: AppColors.mutedForeground)),
          ),
          const SizedBox(height: 16),
          Row(children: [
            Expanded(
              child: OutlineButton(
                label: t('pj.cele.share'),
                icon: 'share-2',
                onTap: () => _share(t('pj.share.done', {'name': name, 'days': j.days})),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(child: GoldButton(label: t('pj.cta.again'), icon: 'rotate-ccw', height: 48, fontSize: 14.5, onTap: _confirmRestart)),
          ]),
        ]),
      );
    }

    if (status.kind == JourneyStatusKind.wait) {
      final nextLocked = !isPremium && proJourneyRequiresPro(status.day);
      return Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.primary.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: AppColors.primary.withValues(alpha: 0.2)),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(t('pj.wait.title', {'n': status.doneDay}),
              textAlign: TextAlign.center, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: AppColors.foreground)),
          const SizedBox(height: 2),
          MinuteTicker(
            builder: (_) => Text(
              t('pj.wait.sub', {'next': status.day, 'time': formatCountdown(ChallengeStore.untilMidnight())}),
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 13, color: AppColors.mutedForeground),
            ),
          ),
          if (nextLocked) ...[
            const SizedBox(height: 12),
            PjGoldButton(label: t('pj.cta.unlock', {'n': status.day}), icon: 'crown', onTap: () => _unlock('wait')),
          ],
          const SizedBox(height: 6),
          Center(
            child: TextButton(
              onPressed: () => _openDay(status.doneDay),
              child: Text(t('pj.cta.review'), style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: AppColors.primary)),
            ),
          ),
        ]),
      );
    }

    final day = status.kind == JourneyStatusKind.today ? status.day : 1;
    if (!isPremium && proJourneyRequiresPro(day)) {
      return Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: AppColors.primary.withValues(alpha: 0.35)),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(children: [
            LucideIconLite('lock', size: 16, color: AppColors.primary),
            const SizedBox(width: 8),
            Expanded(
              child: Text(t('pj.locked.title', {'total': j.days}),
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.foreground)),
            ),
          ]),
          const SizedBox(height: 4),
          Text(t('pj.locked.sub'), style: TextStyle(fontSize: 13.5, height: 1.5, color: AppColors.mutedForeground)),
          const SizedBox(height: 16),
          PjGoldButton(label: t('pj.cta.unlock', {'n': day}), icon: 'crown', onTap: () => _unlock('cta')),
        ]),
      );
    }

    final fresh = status.kind == JourneyStatusKind.fresh || (day == 1 && ProJourneyStore.stepsFor(j.id, 1).isEmpty);
    final label = fresh ? (isPremium ? t('pj.cta.start') : t('pj.cta.startFree')) : t('pj.cta.continue', {'n': day});
    void go() {
      haptic(HapticStyle.medium);
      _openDay(day);
    }

    return fresh && !isPremium
        ? PjGoldButton(label: label, trailing: 'chevron-right', onTap: go)
        : GoldButton(label: label, trailing: 'chevron-right', onTap: go);
  }

  /* ── outcomes ── */

  Widget _outcomes() => Container(
        padding: const EdgeInsets.all(16),
        decoration: pjCard(),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(upper(t('pj.outcomes')), style: PjInk.eyebrow()),
          const SizedBox(height: 8),
          for (var n = 1; n <= 3; n++)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Container(
                  width: 20,
                  height: 20,
                  margin: const EdgeInsets.only(top: 1),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(shape: BoxShape.circle, color: AppColors.primary.withValues(alpha: 0.15)),
                  child: LucideIconLite('check', size: 12, color: AppColors.primary, strokeWidth: 3),
                ),
                const SizedBox(width: 12),
                Expanded(child: Text(t('pj.${j.id}.out$n'), style: TextStyle(fontSize: 14.5, height: 1.35, color: AppColors.foreground))),
              ]),
            ),
        ]),
      );

  /* ── path ── */

  Widget _pathRow(int day, bool isPremium) {
    final isDone = ProJourneyStore.isDayDone(j.id, day);
    final open = ProJourneyStore.isDayOpen(j.id, day);
    final proLocked = !isPremium && proJourneyRequiresPro(day) && !isDone;
    final sub = isDone
        ? t('pj.day.done')
        : proLocked
            ? t('pj.day.pro')
            : open
                ? t('pj.day.today')
                : t('pj.day.locked', {'n': day - 1});
    final tappable = isDone || open || proLocked;
    final current = open && !proLocked;

    return Semantics(
      button: tappable,
      enabled: tappable,
      child: InkWell(
        onTap: !tappable
            ? null
            : () {
                haptic(HapticStyle.light);
                if (proLocked) {
                  _unlock('path');
                } else {
                  _openDay(day);
                }
              },
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 12),
          decoration: BoxDecoration(border: Border(bottom: BorderSide(color: AppColors.border.withValues(alpha: 0.6)))),
          child: Row(children: [
            Container(
              width: 36,
              height: 36,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: isDone ? AppColors.primary : current ? AppColors.primary.withValues(alpha: 0.1) : AppColors.muted,
                border: current ? Border.all(color: AppColors.primary, width: 2) : null,
              ),
              child: isDone
                  ? LucideIconLite('check', size: 16, color: AppColors.primaryForeground, strokeWidth: 3)
                  : proLocked
                      ? LucideIconLite('lock', size: 14, color: AppColors.mutedForeground)
                      : Text('$day',
                          style: TextStyle(
                            fontSize: 12.5,
                            fontWeight: FontWeight.w700,
                            color: current ? AppColors.primary : AppColors.mutedForeground,
                          )),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(t('pj.progress', {'n': day, 'total': j.days}),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: isDone || current ? AppColors.foreground : AppColors.foreground.withValues(alpha: 0.7),
                    )),
                Text(sub,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: proLocked ? FontWeight.w700 : FontWeight.w400,
                      color: proLocked ? AppColors.primary : AppColors.mutedForeground,
                    )),
              ]),
            ),
            if (tappable) LucideIconLite('chevron-right', size: 16, color: AppColors.mutedForeground),
          ]),
        ),
      ),
    );
  }

  /* ── journey tool ── */

  List<Widget> _tool(bool isPremium) {
    final s = ProJourneyStore.state;
    switch (j.practice) {
      case PracticeKind.intercede:
        return [
          const SizedBox(height: 24),
          Container(padding: const EdgeInsets.all(16), decoration: pjCard(radius: 24), child: const PrayerList()),
        ];
      case PracticeKind.breathe:
        return [
          const SizedBox(height: 24),
          _toolRow(
            leading: Container(
              width: 48,
              height: 48,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  center: const Alignment(0, -0.16),
                  colors: [ChInk.goldGlow.withValues(alpha: 0.95), ChInk.gold.withValues(alpha: 0.8), ChInk.gold.withValues(alpha: 0.5)],
                ),
              ),
              child: const LucideIconLite('wind', size: 20, color: ChInk.ctaForeground),
            ),
            title: t('pj.pe.now'),
            sub: t('pj.pe.nowSub'),
            onTap: _breatheNow,
          ),
        ];
      case PracticeKind.battle:
        final f = s.freedom;
        if (!ProJourneyStore.isStarted(j.id) && f.battle == null) return const [];
        final free = ProJourneyStore.daysFree();
        return [
          const SizedBox(height: 24),
          _toolRow(
            highlight: true,
            leading: Container(
              width: 48,
              height: 48,
              alignment: Alignment.center,
              decoration: BoxDecoration(shape: BoxShape.circle, gradient: PjInk.goldGradient),
              child: const LucideIconLite('shield-alert', size: 24, color: ChInk.ctaForeground),
            ),
            title: t('pj.sos.btn'),
            sub: t('pj.sos.btnSub'),
            onTap: () {
              haptic(HapticStyle.medium);
              showStandFirmSheet(context);
            },
          ),
          if (f.battle != null) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: pjCard(),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Row(children: [
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(upper(t('pj.fr.yourBattle')), style: PjInk.eyebrow()),
                      const SizedBox(height: 4),
                      Text('${kBattleEmoji[f.battle] ?? ''} ${t('pj.fr.b.${f.battle}')}',
                          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: AppColors.foreground)),
                      if (f.sos > 0) ...[
                        const SizedBox(height: 2),
                        Text(t('pj.sos.count', {'n': f.sos}), style: TextStyle(fontSize: 12, color: AppColors.mutedForeground)),
                      ],
                    ]),
                  ),
                  const SizedBox(width: 16),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: AppColors.primary.withValues(alpha: 0.2)),
                    ),
                    child: Column(children: [
                      Text('$free', style: ChInk.serif(30, height: 1).copyWith(fontFeatures: const [FontFeature.tabularFigures()])),
                      const SizedBox(height: 4),
                      Text(upper(t('pj.fr.daysFree')), style: ChInk.eyebrow(10.5, AppColors.primary, tracking: 0.12)),
                    ]),
                  ),
                ]),
                if (f.when.isNotEmpty && f.then.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  Divider(height: 1, color: AppColors.border.withValues(alpha: 0.6)),
                  const SizedBox(height: 12),
                  Row(children: [
                    Expanded(child: Text(upper(t('pj.fr.yourPlan')), style: PjInk.eyebrow(11, AppColors.mutedForeground))),
                    GestureDetector(
                      onTap: _editPlan,
                      child: Row(mainAxisSize: MainAxisSize.min, children: [
                        LucideIconLite('pencil', size: 12, color: AppColors.primary),
                        const SizedBox(width: 4),
                        Text(t('pj.fr.edit'), style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: AppColors.primary)),
                      ]),
                    ),
                  ]),
                  const SizedBox(height: 4),
                  Text(t('pj.fr.planLine', {'when': f.when, 'then': f.then}),
                      style: TextStyle(fontSize: 14.5, height: 1.35, color: AppColors.foreground)),
                ],
              ]),
            ),
          ],
        ];
      default: // PracticeKind.declare
        final declared = [for (var d = 1; d <= j.days; d++) if (ProJourneyStore.isDayDone(j.id, d)) d];
        if (declared.isEmpty) return const [];
        final lines = declared.map((d) => '✦ ${proJourneyDay(j, d).practice}').join('\n');
        return [
          const SizedBox(height: 24),
          Container(
            clipBehavior: Clip.antiAlias,
            decoration: BoxDecoration(
              color: AppColors.card,
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
            ),
            child: Stack(children: [
              Positioned(right: -64, top: -64, child: IgnorePointer(child: Container(width: 192, height: 192, decoration: PjInk.halo))),
              Padding(
                padding: const EdgeInsets.all(20),
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  Text(upper(t('pj.id.card')), style: PjInk.eyebrow()),
                  const SizedBox(height: 2),
                  Text(t('pj.id.cardSub'), style: TextStyle(fontSize: 12.5, color: AppColors.mutedForeground)),
                  const SizedBox(height: 12),
                  for (var d = 1; d <= j.days; d++) _identityLine(d, declared.contains(d), isPremium),
                  const SizedBox(height: 8),
                  OutlineButton(
                    label: t('pj.id.share'),
                    icon: 'share-2',
                    onTap: () {
                      Analytics.capture('pro_journey_identity_shared', {'n': declared.length});
                      _share(t('pj.share.card', {'lines': lines}));
                    },
                  ),
                ]),
              ),
            ]),
          ),
        ];
    }
  }

  Widget _identityLine(int d, bool has, bool isPremium) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Opacity(
          opacity: has ? 1 : 0.6,
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Container(
              width: 16,
              height: 16,
              margin: const EdgeInsets.only(top: 3),
              alignment: Alignment.center,
              decoration: BoxDecoration(shape: BoxShape.circle, color: has ? AppColors.primary : AppColors.muted),
              child: has
                  ? LucideIconLite('check', size: 10, color: AppColors.primaryForeground, strokeWidth: 3.5)
                  : LucideIconLite('lock', size: 8, color: AppColors.mutedForeground),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                has ? proJourneyDay(j, d).practice : t('pj.id.locked', {'n': d}),
                style: has ? ChInk.serif(15.5, weight: FontWeight.w400, height: 1.35) : TextStyle(fontSize: 14, height: 1.35, color: AppColors.mutedForeground),
              ),
            ),
          ]),
        ),
      );

  Widget _toolRow({required Widget leading, required String title, required String sub, required VoidCallback onTap, bool highlight = false}) {
    return Semantics(
      button: true,
      label: '$title. $sub',
      excludeSemantics: true,
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: highlight
              ? BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(22),
                  border: Border.all(color: AppColors.primary.withValues(alpha: 0.4)),
                )
              : pjCard(),
          child: Row(children: [
            leading,
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(title, style: TextStyle(fontSize: 15.5, fontWeight: highlight ? FontWeight.w700 : FontWeight.w600, color: AppColors.foreground)),
                const SizedBox(height: 2),
                Text(sub, style: TextStyle(fontSize: 12.5, color: AppColors.mutedForeground)),
              ]),
            ),
            LucideIconLite('chevron-right', size: 16, color: highlight ? AppColors.primary : AppColors.mutedForeground),
          ]),
        ),
      ),
    );
  }
}
