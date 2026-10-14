import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/services/ads_service.dart';
import '../../core/services/analytics.dart';
import '../../core/services/challenge_circle_service.dart';
import '../../core/services/challenge_data.dart';
import '../../core/services/challenge_reminders.dart';
import '../../core/services/challenge_store.dart';
import '../../core/services/haptics.dart';
import '../../core/theme/app_colors.dart';
import '../../state/app_providers.dart';
import '../../widgets/premium_sheet.dart';
import 'challenge_circle_screen.dart';
import 'challenge_day_screen.dart';
import 'challenge_format.dart';
import 'challenge_path.dart';
import 'challenge_sheets.dart';
import 'challenge_widgets.dart';

/// 75 Days of Light hub (intro when idle). Web mirror: `src/pages/Challenge.tsx`.
class ChallengeScreen extends ConsumerStatefulWidget {
  const ChallengeScreen({super.key, this.adPending = false});

  /// A free user just lit a day: show one warm interstitial here.
  final bool adPending;

  @override
  ConsumerState<ChallengeScreen> createState() => _ChallengeScreenState();
}

class _ChallengeScreenState extends ConsumerState<ChallengeScreen> with WidgetsBindingObserver {
  Timer? _adTimer;
  String _refLabel = '';
  int _refDay = 0;
  String _refLang = '';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    ChallengeStore.evaluate();
    ChallengeStore.revision.addListener(_onChallenge);
    ChallengeCircleService.revision.addListener(_onCircles);
    Analytics.capture('challenge_hub_viewed', {'status': ChallengeStore.state.status, 'completed': ChallengeStore.completedCount(ChallengeStore.state)});
    unawaited(ChallengeReminderService.sync());
    _refreshCircles();
    if (widget.adPending) _scheduleAd();
  }

  @override
  void dispose() {
    _adTimer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    ChallengeStore.revision.removeListener(_onChallenge);
    ChallengeCircleService.revision.removeListener(_onCircles);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      ChallengeStore.evaluate();
      _refreshCircles();
    }
  }

  void _onChallenge() {
    if (!mounted) return;
    setState(() {});
    unawaited(ChallengeReminderService.sync());
    ChallengeCircleService.scheduleProgressSync();
  }

  void _onCircles() {
    if (mounted) setState(() {});
  }

  Future<void> _refreshCircles() async {
    if (ChallengeCircleService.identity == null) return;
    try {
      await ChallengeCircleService.fetchOverview();
    } catch (_) {/* cached overview stays */}
  }

  void _scheduleAd() {
    if (ref.read(premiumProvider)) return;
    _adTimer?.cancel();
    _adTimer = Timer(const Duration(milliseconds: 900), () {
      if (!mounted) return;
      unawaited(AdsService.tryShowInterstitial('challenge_day_lit', onlyIfWarm: true));
    });
  }

  Future<void> _openDay([int? day]) async {
    final adPending = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => ChallengeDayScreen(day: day, fromHub: true)),
    );
    if (adPending == true && mounted) _scheduleAd();
  }

  void _openCircle([String? id]) {
    Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => ChallengeCircleScreen(circleId: id)));
  }

  void _openPremium() {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheet) => PremiumSheet(
        trigger: 'challenge_grace_oil',
        onClose: () => Navigator.pop(sheet),
        onUnlock: () => ref.read(premiumProvider.notifier).setUnlocked(),
      ),
    );
  }

  Future<void> _circleFlow(String flow) async {
    final id = await showCircleFlow(context, flow, lang: ref.read(languageProvider));
    if (id != null && mounted) _openCircle(id);
  }

  void _loadRefLabel(String lang, ChallengeDayPlan plan) {
    if (_refDay == plan.day && _refLang == lang) return;
    _refDay = plan.day;
    _refLang = lang;
    readingLabel(lang, plan.ref).then((v) {
      if (mounted && _refDay == plan.day) setState(() => _refLabel = v);
    }).catchError((_) {});
  }

  @override
  Widget build(BuildContext context) {
    final lang = ref.watch(languageProvider);
    final isPremium = ref.watch(premiumProvider);
    final v = ChallengeStore.view();

    if (v.idle) {
      return ChallengeIntro(
        onBack: () => Navigator.of(context).maybePop(),
        onStart: (mode, morning, evening) async {
          ChallengeStore.start(mode, morning, evening);
          Analytics.capture('challenge_started', {'mode': mode, 'morning': morning, 'evening': evening});
          await ChallengeReminderService.requestPermission();
          await ChallengeReminderService.sync();
        },
      );
    }

    final plan = challengeDay(v.day);
    _loadRefLabel(lang, plan);
    final stage = stageForDay(v.lit ? math.min(75, v.completed + 1) : v.day);
    final overview = ChallengeCircleService.cached;
    final circles = overview?.circles ?? const <Circle>[];
    final cheers = overview?.cheers ?? const <Cheer>[];
    final cap = ChallengeStore.graceCap(isPremium);
    final notice = v.state.notice;
    final pad = MediaQuery.of(context).padding;

    return Scaffold(
      backgroundColor: AppColors.background,
      body: Column(
        children: [
          Container(
            color: AppColors.background,
            padding: EdgeInsets.fromLTRB(16, math.max(12, pad.top), 16, 8),
            child: Row(
              children: [
                RoundIconButton(icon: 'chevron-left', label: t('ch.back'), onTap: () => Navigator.of(context).maybePop()),
                Expanded(
                  child: Text(t('ch.name'), textAlign: TextAlign.center, maxLines: 1, overflow: TextOverflow.ellipsis, style: ChInk.serif(19)),
                ),
                RoundIconButton(
                  icon: 'settings-2',
                  label: t('ch.hub.settings'),
                  onTap: () {
                    haptic(HapticStyle.light);
                    showChallengeSettings(context, lang: lang);
                  },
                ),
              ],
            ),
          ),
          Expanded(
            child: ListView(
              padding: EdgeInsets.fromLTRB(16, 8, 16, 40 + pad.bottom),
              children: [
                _hero(v, stage, cap, isPremium),
                if (notice != null) ...[const SizedBox(height: 20), _notice(notice, v)],
                if (cheers.isNotEmpty) ...[const SizedBox(height: 20), _cheers(cheers)],
                const SizedBox(height: 20),
                v.finished ? _finished() : _today(v, plan),
                const SizedBox(height: 20),
                _circleSection(circles),
                const SizedBox(height: 20),
                SectionLabel(t('ch.hub.milestones')),
                _milestones(v.completed),
                const SizedBox(height: 20),
                SectionLabel(
                  t('ch.hub.path'),
                  trailing: Text(t('ch.hub.completed', {'n': v.completed}),
                      style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: AppColors.mutedForeground)),
                ),
                ChallengePath(
                  completed: v.completed,
                  currentDay: v.day,
                  lit: v.lit,
                  onOpenDay: (d) => _openDay(d <= v.completed ? d : null),
                ),
                const SizedBox(height: 18),
                _verseFooter(),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _hero(ChallengeView v, ChallengeStage stage, int cap, bool isPremium) {
    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(30),
        border: Border.all(color: AppColors.primary.withValues(alpha: 0.25)),
        boxShadow: [BoxShadow(color: AppColors.primary.withValues(alpha: 0.45), blurRadius: 60, spreadRadius: -34, offset: const Offset(0, 24))],
      ),
      child: Stack(
        children: [
          Positioned.fill(child: Image.asset(heroArt(), fit: BoxFit.cover)),
          const Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [Color(0x1A000000), Color(0x40000000), Color(0xBF000000)],
                ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
            child: Column(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                  decoration: BoxDecoration(color: Colors.black.withValues(alpha: 0.35), borderRadius: BorderRadius.circular(999)),
                  child: Text(
                    upper('${t('ch.stage.${stage.key}')} · ${t('ch.lamp.${v.tier}')}'),
                    style: ChInk.eyebrow(11, ChInk.amber200, tracking: 0.2),
                  ),
                ),
                const SizedBox(height: 4),
                ChallengeLamp(
                  tier: v.tier,
                  intensity: v.intensity,
                  state: v.lit || v.finished ? LampState.lit : LampState.waiting,
                  width: 212,
                ),
                const SizedBox(height: 12),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.baseline,
                  textBaseline: TextBaseline.alphabetic,
                  children: [
                    Text('${v.completed}',
                        style: ChInk.serif(46, color: Colors.white, height: 1).copyWith(shadows: const [Shadow(color: Color(0x80000000), blurRadius: 18)])),
                    const SizedBox(width: 8),
                    Text(t('ch.of75'), style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: Color(0xBFFFFFFF))),
                  ],
                ),
                const SizedBox(height: 12),
                ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 300),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(999),
                    child: Stack(
                      children: [
                        Container(height: 8, color: const Color(0x33FFFFFF)),
                        FractionallySizedBox(
                          widthFactor: (v.completed / 75).clamp(0.0, 1.0),
                          child: Container(
                            height: 8,
                            decoration: const BoxDecoration(
                              gradient: LinearGradient(colors: [Color(0xFFFCD34D), Color(0xFFFEF08A)]),
                              boxShadow: [BoxShadow(color: Color(0xCCFDE047), blurRadius: 12)],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(child: _stat('flame', ChInk.orange300, '${v.streak}', t('ch.streak.label'))),
                    const SizedBox(width: 8),
                    Expanded(
                      child: GestureDetector(
                        onTap: () {
                          haptic(HapticStyle.light);
                          if (!isPremium && v.state.mode == 'grace') _openPremium();
                        },
                        child: _stat(
                          'droplet',
                          ChInk.sky300,
                          v.state.mode == 'covenant' ? '—' : t('ch.grace.count', {'n': v.state.graces, 'cap': cap}),
                          t('ch.grace'),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _stat(String icon, Color color, String value, String label) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(color: Colors.black.withValues(alpha: 0.35), borderRadius: BorderRadius.circular(16)),
        child: Row(
          children: [
            LucideIconLite(icon, size: 20, color: color),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(value, maxLines: 1, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800, height: 1, color: Colors.white)),
                  const SizedBox(height: 4),
                  Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 11.5, color: Color(0xB3FFFFFF))),
                ],
              ),
            ),
          ],
        ),
      );

  Widget _notice(ChallengeNotice notice, ChallengeView v) {
    final text = switch (notice.type) {
      'grace_used' => t('ch.notice.grace', {'n': notice.value}),
      'streak_reset' => t('ch.notice.reset', {'done': v.completed}),
      _ => t('ch.notice.restart', {'n': notice.value}),
    };
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.primary.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(padding: const EdgeInsets.only(top: 2), child: LucideIconLite('droplet', size: 20, color: AppColors.primary)),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(text, style: TextStyle(fontSize: 14, height: 1.35, color: AppColors.foreground)),
                const SizedBox(height: 8),
                GestureDetector(
                  onTap: ChallengeStore.clearNotice,
                  child: Text(t('ch.notice.ok'), style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: AppColors.primary)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _cheers(List<Cheer> cheers) => Container(
        padding: const EdgeInsets.all(14),
        decoration: chCard(radius: 18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            for (final c in cheers.take(3))
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(
                  children: [
                    Container(
                      width: 32,
                      height: 32,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(shape: BoxShape.circle, color: AppColors.muted),
                      child: Text(c.fromAvatar, style: const TextStyle(fontSize: 16)),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(t('ch.cheer.${c.kind}', {'name': c.fromName}),
                          style: TextStyle(fontSize: 14, height: 1.3, color: AppColors.foreground)),
                    ),
                  ],
                ),
              ),
            GestureDetector(
              onTap: () => ChallengeCircleService.markCheersSeen(cheers.map((c) => c.id).toList()).catchError((_) {}),
              child: Text(t('ch.notice.ok'), style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: AppColors.primary)),
            ),
          ],
        ),
      );

  Widget _finished() => Container(
        padding: const EdgeInsets.all(20),
        decoration: chCard(border: AppColors.primary.withValues(alpha: 0.3)),
        child: Column(
          children: [
            LucideIconLite('trophy', size: 36, color: AppColors.primary),
            const SizedBox(height: 8),
            Text(t('ch.cele.finishedTitle'), textAlign: TextAlign.center, style: ChInk.serif(24)),
            const SizedBox(height: 4),
            Text(t('ch.cele.finishedSub'), textAlign: TextAlign.center, style: TextStyle(fontSize: 14, color: AppColors.mutedForeground)),
            const SizedBox(height: 16),
            GoldButton(
              label: t('ch.finished.again'),
              onTap: () {
                haptic(HapticStyle.medium);
                Analytics.capture('challenge_new_round');
                ChallengeStore.reset();
              },
            ),
          ],
        ),
      );

  Widget _today(ChallengeView v, ChallengeDayPlan plan) {
    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: chCard(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(upper('${t('ch.hub.today')} · ${t('ch.day', {'day': plan.day})}'),
                          style: ChInk.eyebrow(12, AppColors.primary)),
                    ),
                    Text(t('ch.tasksDone', {'n': v.done.length}),
                        style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: AppColors.mutedForeground)),
                  ],
                ),
                const SizedBox(height: 6),
                Text(plan.title, style: ChInk.serif(23, height: 1.2)),
                if (_refLabel.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      LucideIconLite('book-open', size: 14, color: AppColors.mutedForeground),
                      const SizedBox(width: 6),
                      Text(_refLabel, style: TextStyle(fontSize: 13.5, color: AppColors.mutedForeground)),
                    ],
                  ),
                ],
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                for (var i = 0; i < kTaskIds.length; i++) ...[
                  if (i > 0) const SizedBox(width: 8),
                  Expanded(child: _taskTile(kTaskIds[i], v.done.contains(kTaskIds[i]))),
                ],
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: v.lit
                ? MinuteTicker(
                    builder: (_) => Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(16)),
                      child: Column(
                        children: [
                          Text(t('ch.lit.title', {'day': plan.day}), textAlign: TextAlign.center, style: ChInk.serif(18)),
                          const SizedBox(height: 2),
                          Text(
                            t('ch.lit.next', {'day': plan.day + 1, 'time': formatCountdown(ChallengeStore.untilMidnight())}),
                            textAlign: TextAlign.center,
                            style: TextStyle(fontSize: 13, color: AppColors.mutedForeground),
                          ),
                          const SizedBox(height: 10),
                          GestureDetector(
                            onTap: () => _openDay(plan.day),
                            child: Text(t('ch.cta.review', {'day': plan.day}),
                                style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: AppColors.primary)),
                          ),
                        ],
                      ),
                    ),
                  )
                : GoldButton(
                    label: v.done.isNotEmpty ? t('ch.cta.continue', {'day': plan.day}) : t('ch.cta.begin', {'day': plan.day}),
                    trailing: 'chevron-right',
                    onTap: () {
                      haptic(HapticStyle.medium);
                      _openDay();
                    },
                  ),
          ),
        ],
      ),
    );
  }

  Widget _taskTile(String id, bool done) => Column(
        children: [
          AspectRatio(
            aspectRatio: 1,
            child: Container(
              clipBehavior: Clip.antiAlias,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: done ? AppColors.primary.withValues(alpha: 0.6) : AppColors.border.withValues(alpha: 0.6)),
              ),
              child: Stack(
                fit: StackFit.expand,
                children: [
                  Opacity(opacity: done ? 1 : 0.8, child: Image.asset(kTaskArt[id]!, fit: BoxFit.cover)),
                  Positioned(
                    right: 4,
                    top: 4,
                    child: Container(
                      width: 20,
                      height: 20,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(shape: BoxShape.circle, color: done ? AppColors.primary : const Color(0x73000000)),
                      child: LucideIconLite(done ? 'check' : kTaskIcon[id]!, size: 12, color: Colors.white, strokeWidth: done ? 3 : 2),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 6),
          Text(t('ch.task.$id'),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: done ? AppColors.primary : AppColors.foreground)),
        ],
      );

  Widget _circleSection(List<Circle> circles) {
    final hasIdentity = ChallengeCircleService.identity != null;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SectionLabel(
          t('ch.hub.circle'),
          trailing: circles.isEmpty
              ? null
              : GestureDetector(
                  onTap: () => _openCircle(),
                  child: Text(t('ch.circle.open'), style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: AppColors.primary)),
                ),
        ),
        if (circles.isEmpty)
          Container(
            clipBehavior: Clip.antiAlias,
            decoration: chCard(),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(height: 144, width: double.infinity, child: Image.asset(kCircleArt, fit: BoxFit.cover)),
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(t('ch.circle.empty.t'), style: ChInk.serif(20)),
                      const SizedBox(height: 4),
                      Text(t('ch.circle.empty.s'), style: TextStyle(fontSize: 13.5, height: 1.35, color: AppColors.mutedForeground)),
                      const SizedBox(height: 14),
                      Row(
                        children: [
                          Expanded(child: _solidPrimary(t('ch.circle.create'), () => _circleFlow('create'))),
                          const SizedBox(width: 8),
                          Expanded(child: OutlineButton(label: t('ch.circle.join'), onTap: () => _circleFlow('join'))),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          )
        else ...[
          for (final c in circles.take(3))
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: GestureDetector(
                onTap: () => _openCircle(c.id),
                child: Container(
                  padding: const EdgeInsets.all(14),
                  decoration: chCard(radius: 18),
                  child: Row(
                    children: [
                      Container(
                        width: 44,
                        height: 44,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(12)),
                        child: Text(c.emoji, style: const TextStyle(fontSize: 22)),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(c.name, maxLines: 1, overflow: TextOverflow.ellipsis,
                                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.foreground)),
                            const SizedBox(height: 2),
                            Text(t('ch.circle.litToday', {'n': c.litToday, 'total': c.members.length}),
                                style: TextStyle(fontSize: 12.5, color: AppColors.mutedForeground)),
                          ],
                        ),
                      ),
                      SizedBox(
                        width: 8.0 + 24 * math.min(4, c.members.length),
                        height: 32,
                        child: Stack(
                          children: [
                            for (var i = 0; i < math.min(4, c.members.length); i++)
                              Positioned(
                                left: i * 24.0,
                                child: Container(
                                  width: 32,
                                  height: 32,
                                  alignment: Alignment.center,
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    color: c.members[i].litToday ? AppColors.primary.withValues(alpha: 0.25) : AppColors.muted,
                                    border: Border.all(color: AppColors.card, width: 2),
                                  ),
                                  child: Text(c.members[i].avatar, style: const TextStyle(fontSize: 14)),
                                ),
                              ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 4),
                      LucideIconLite('chevron-right', size: 16, color: AppColors.mutedForeground),
                    ],
                  ),
                ),
              ),
            ),
          Row(
            children: [
              Expanded(child: OutlineButton(label: t('ch.circle.add'), height: 42, onTap: () => _circleFlow('create'))),
              const SizedBox(width: 8),
              Expanded(child: OutlineButton(label: t('ch.circle.join'), height: 42, onTap: () => _circleFlow('join'))),
            ],
          ),
        ],
        if (!hasIdentity && circles.isEmpty) ...[
          const SizedBox(height: 8),
          Row(
            children: [
              LucideIconLite('users', size: 14, color: AppColors.mutedForeground),
              const SizedBox(width: 6),
              Expanded(child: Text(t('ch.circle.privacy'), style: TextStyle(fontSize: 12, color: AppColors.mutedForeground))),
            ],
          ),
        ],
      ],
    );
  }

  Widget _solidPrimary(String label, VoidCallback onTap) => GestureDetector(
        onTap: () {
          haptic(HapticStyle.light);
          onTap();
        },
        child: Container(
          height: 48,
          alignment: Alignment.center,
          decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(999)),
          child: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: AppColors.primaryForeground)),
        ),
      );

  Widget _milestones(int completed) => SizedBox(
        height: 124,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          itemCount: kMilestones.length,
          separatorBuilder: (_, __) => const SizedBox(width: 10),
          itemBuilder: (_, i) {
            final m = kMilestones[i];
            final got = completed >= m;
            final lamp = kLamps[math.min(4, (m - 1) ~/ 15)];
            return Container(
              width: 92,
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: got ? AppColors.primary.withValues(alpha: 0.1) : AppColors.card,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: got ? AppColors.primary.withValues(alpha: 0.4) : AppColors.border.withValues(alpha: 0.6)),
              ),
              child: Column(
                children: [
                  SizedBox(
                    height: 44,
                    child: Stack(
                      alignment: Alignment.center,
                      children: [
                        Opacity(
                          opacity: got ? 1 : 0.35,
                          child: ColorFiltered(
                            colorFilter: got
                                ? const ColorFilter.mode(Colors.transparent, BlendMode.dst)
                                : const ColorFilter.matrix(<double>[
                                    0.33, 0.33, 0.33, 0, 0, 0.33, 0.33, 0.33, 0, 0, 0.33, 0.33, 0.33, 0, 0, 0, 0, 0, 1, 0,
                                  ]),
                            child: Image.asset(lamp.asset, height: 40, fit: BoxFit.contain),
                          ),
                        ),
                        if (!got) LucideIconLite('lock', size: 14, color: AppColors.mutedForeground),
                      ],
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(t('ch.ms.$m'),
                      textAlign: TextAlign.center,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(fontSize: 11.5, height: 1.15, fontWeight: FontWeight.w700, color: got ? AppColors.foreground : AppColors.mutedForeground)),
                  const Spacer(),
                  Text(t('ch.day', {'day': m}), style: TextStyle(fontSize: 10.5, color: AppColors.mutedForeground)),
                ],
              ),
            );
          },
        ),
      );

  Widget _verseFooter() => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: Column(
          children: [
            Text('“${t('ch.verse')}”',
                textAlign: TextAlign.center,
                style: ChInk.serif(14, weight: FontWeight.w400, color: AppColors.mutedForeground, height: 1.5, style: FontStyle.italic)),
            const SizedBox(height: 4),
            Text(t('ch.verseRef'), style: TextStyle(fontSize: 12, color: AppColors.mutedForeground)),
          ],
        ),
      );
}

/* ── intro (idle) ───────────────────────────────────────────────────────── */

class ChallengeIntro extends ConsumerStatefulWidget {
  const ChallengeIntro({super.key, required this.onBack, required this.onStart});
  final VoidCallback onBack;
  final Future<void> Function(String mode, String morning, bool evening) onStart;

  @override
  ConsumerState<ChallengeIntro> createState() => _ChallengeIntroState();
}

class _ChallengeIntroState extends ConsumerState<ChallengeIntro> {
  static const _times = ['06:00', '07:00', '08:00', '09:00'];
  String _mode = 'grace';
  String _morning = '07:00';
  bool _evening = true;
  bool _igniting = false;

  void _start() {
    setState(() => _igniting = true);
    Future.delayed(const Duration(milliseconds: 900), () => widget.onStart(_mode, _morning, _evening));
  }

  @override
  Widget build(BuildContext context) {
    final lang = ref.watch(languageProvider);
    final pad = MediaQuery.of(context).padding;
    const stageKeys = ['spark', 'ember', 'glow', 'radiance', 'beacon'];
    final steps = [
      ('book-open', 'ch.intro.step1.t', 'ch.intro.step1.s'),
      ('flame', 'ch.intro.step2.t', 'ch.intro.step2.s'),
      ('users', 'ch.intro.step3.t', 'ch.intro.step3.s'),
    ];

    return Scaffold(
      backgroundColor: AppColors.background,
      body: ListView(
        padding: EdgeInsets.only(bottom: 40 + pad.bottom),
        children: [
          Stack(
            children: [
              Positioned.fill(child: Image.asset(heroArt(), fit: BoxFit.cover)),
              Positioned.fill(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [Colors.transparent, AppColors.background.withValues(alpha: 0.3), AppColors.background],
                      stops: const [0, 0.55, 1],
                    ),
                  ),
                ),
              ),
              Padding(
                padding: EdgeInsets.fromLTRB(20, math.max(14, pad.top), 20, 24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    RoundIconButton(icon: 'chevron-left', label: t('ch.back'), dark: true, onTap: widget.onBack),
                    Center(
                      child: Column(
                        children: [
                          ChallengeLamp(tier: 0, intensity: _igniting ? 1 : 0.35, state: _igniting ? LampState.lit : LampState.ember, width: 196),
                          const SizedBox(height: 4),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                            decoration: BoxDecoration(color: Colors.black.withValues(alpha: 0.35), borderRadius: BorderRadius.circular(999)),
                            child: Text(upper(t('ch.intro.kicker')), style: ChInk.eyebrow(11, ChInk.amber200, tracking: 0.22)),
                          ),
                          const SizedBox(height: 8),
                          Text(t('ch.name'), textAlign: TextAlign.center, style: ChInk.serif(34, height: 1.05)),
                          const SizedBox(height: 12),
                          ConstrainedBox(
                            constraints: const BoxConstraints(maxWidth: 330),
                            child: Text(t('ch.intro.sub'),
                                textAlign: TextAlign.center, style: TextStyle(fontSize: 15, height: 1.5, color: AppColors.fg(0.8))),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    for (var i = 0; i < kTaskIds.length; i++) ...[
                      if (i > 0) const SizedBox(width: 8),
                      Expanded(
                        child: Container(
                          padding: const EdgeInsets.fromLTRB(4, 8, 4, 10),
                          decoration: chCard(radius: 16, color: AppColors.card.withValues(alpha: 0.8)),
                          child: Column(
                            children: [
                              ClipRRect(
                                borderRadius: BorderRadius.circular(12),
                                child: Image.asset(kTaskArt[kTaskIds[i]]!, width: 56, height: 56, fit: BoxFit.cover),
                              ),
                              const SizedBox(height: 6),
                              Text(t('ch.task.${kTaskIds[i]}'),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.foreground)),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 28),
                SectionLabel(t('ch.intro.how')),
                for (var i = 0; i < steps.length; i++)
                  Container(
                    margin: const EdgeInsets.only(bottom: 10),
                    padding: const EdgeInsets.all(14),
                    decoration: chCard(radius: 16, color: AppColors.card.withValues(alpha: 0.8)),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 40,
                          height: 40,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(12)),
                          child: LucideIconLite(steps[i].$1, size: 20, color: AppColors.primary),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text.rich(
                                TextSpan(children: [
                                  TextSpan(text: '${i + 1}.  ', style: TextStyle(color: AppColors.primary)),
                                  TextSpan(text: t(steps[i].$2)),
                                ]),
                                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.foreground),
                              ),
                              const SizedBox(height: 2),
                              Text(t(steps[i].$3), style: TextStyle(fontSize: 13.5, height: 1.35, color: AppColors.mutedForeground)),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                const SizedBox(height: 18),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(color: AppColors.primary.withValues(alpha: 0.25)),
                    gradient: RadialGradient(
                      center: Alignment.topCenter,
                      radius: 1.2,
                      colors: [AppColors.primary.withValues(alpha: 0.14), Colors.transparent],
                    ),
                  ),
                  child: Column(
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          for (var i = 0; i < kLamps.length; i++)
                            Expanded(
                              child: Column(
                                children: [
                                  Opacity(
                                    opacity: 0.55 + i * 0.11,
                                    child: Padding(
                                      padding: const EdgeInsets.symmetric(horizontal: 3),
                                      child: Image.asset(kLamps[i].asset, fit: BoxFit.contain),
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(t('ch.stage.${stageKeys[i]}'),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w500, color: AppColors.mutedForeground)),
                                ],
                              ),
                            ),
                        ],
                      ),
                      Divider(height: 24, color: AppColors.primary.withValues(alpha: 0.15)),
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Padding(padding: const EdgeInsets.only(top: 2), child: LucideIconLite('sparkles', size: 16, color: AppColors.primary)),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(t('ch.intro.read.t'), style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.foreground)),
                                const SizedBox(height: 2),
                                Text(t('ch.intro.read.s'), style: TextStyle(fontSize: 13, height: 1.35, color: AppColors.mutedForeground)),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 28),
                SectionLabel(t('ch.intro.path')),
                for (final m in const ['grace', 'covenant']) _modeCard(m),
                const SizedBox(height: 18),
                _reminderCard(lang),
                const SizedBox(height: 22),
                HoldButton(
                  icon: 'heart-handshake',
                  label: _igniting ? t('ch.intro.lit') : t('ch.intro.hold'),
                  holdingLabel: t('ch.intro.holding'),
                  disabled: _igniting,
                  onComplete: _start,
                ),
                const SizedBox(height: 16),
                Text('“${t('ch.verse')}”',
                    textAlign: TextAlign.center,
                    style: ChInk.serif(14, weight: FontWeight.w400, color: AppColors.mutedForeground, height: 1.5, style: FontStyle.italic)),
                const SizedBox(height: 4),
                Text(t('ch.verseRef'), textAlign: TextAlign.center, style: TextStyle(fontSize: 12, color: AppColors.mutedForeground)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _modeCard(String m) {
    final active = _mode == m;
    final badgeColor = m == 'grace' ? const Color(0xFF10B981) : const Color(0xFFF43F5E);
    return Semantics(
      selected: active,
      button: true,
      child: GestureDetector(
        onTap: () {
          haptic(HapticStyle.light);
          setState(() => _mode = m);
        },
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: active ? AppColors.primary.withValues(alpha: 0.1) : AppColors.card.withValues(alpha: 0.8),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: active ? AppColors.primary.withValues(alpha: 0.7) : AppColors.border.withValues(alpha: 0.6)),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                margin: const EdgeInsets.only(top: 2),
                width: 20,
                height: 20,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: active ? AppColors.primary : Colors.transparent,
                  border: Border.all(color: active ? AppColors.primary : AppColors.mutedForeground.withValues(alpha: 0.4), width: 2),
                ),
                child: active ? const LucideIconLite('check', size: 12, color: Colors.white, strokeWidth: 3) : null,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Wrap(
                      spacing: 8,
                      runSpacing: 4,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        Text(t('ch.mode.$m.t'), style: TextStyle(fontSize: 15.5, fontWeight: FontWeight.w700, color: AppColors.foreground)),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(color: badgeColor.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(999)),
                          child: Text(upper(t('ch.mode.$m.badge')), style: ChInk.eyebrow(10.5, badgeColor, tracking: 0.05)),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(t('ch.mode.$m.s'), style: TextStyle(fontSize: 13.5, height: 1.35, color: AppColors.mutedForeground)),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _reminderCard(String lang) => Container(
        padding: const EdgeInsets.all(16),
        decoration: chCard(radius: 24, color: AppColors.card.withValues(alpha: 0.8)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 40,
                  height: 40,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: const Color(0xFFFBBF24).withValues(alpha: 0.15), borderRadius: BorderRadius.circular(12)),
                  child: const LucideIconLite('sunrise', size: 20, color: Color(0xFFF59E0B)),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(t('ch.intro.reminder'), style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.foreground)),
                      const SizedBox(height: 2),
                      Text(t('ch.intro.reminderSub'), style: TextStyle(fontSize: 13, height: 1.35, color: AppColors.mutedForeground)),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            TimeChips(times: _times, selected: _morning, lang: lang, onSelect: (v) => setState(() => _morning = v)),
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(child: Text(t('ch.intro.evening'), style: TextStyle(fontSize: 14, color: AppColors.foreground))),
                ChSwitch(on: _evening, label: t('ch.intro.evening'), onToggle: () => setState(() => _evening = !_evening)),
              ],
            ),
          ],
        ),
      );
}

class TimeChips extends StatelessWidget {
  const TimeChips({super.key, required this.times, required this.selected, required this.lang, required this.onSelect});
  final List<String> times;
  final String selected;
  final String lang;
  final ValueChanged<String> onSelect;

  @override
  Widget build(BuildContext context) => Row(
        children: [
          for (var i = 0; i < times.length; i++) ...[
            if (i > 0) const SizedBox(width: 8),
            Expanded(
              child: GestureDetector(
                onTap: () {
                  haptic(HapticStyle.light);
                  onSelect(times[i]);
                },
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 160),
                  height: 42,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: selected == times[i] ? AppColors.primary : AppColors.background.withValues(alpha: 0.6),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: selected == times[i] ? AppColors.primary : AppColors.border.withValues(alpha: 0.7)),
                  ),
                  child: FittedBox(
                    fit: BoxFit.scaleDown,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      child: Text(formatClock(times[i], lang),
                          style: TextStyle(
                            fontSize: 13.5,
                            fontWeight: FontWeight.w700,
                            color: selected == times[i] ? AppColors.primaryForeground : AppColors.foreground,
                          )),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ],
      );
}
