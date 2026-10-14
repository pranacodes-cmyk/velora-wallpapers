import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/app_tabs.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/services/ads_service.dart';
import '../../core/services/analytics.dart';
import '../../core/services/challenge_circle_service.dart';
import '../../core/services/challenge_data.dart';
import '../../core/services/challenge_reminders.dart';
import '../../core/services/challenge_store.dart';
import '../../core/services/haptics.dart';
import '../../core/services/share_service.dart';
import '../../core/theme/app_colors.dart';
import '../../state/app_providers.dart';
import '../../widgets/premium_sheet.dart';
import 'challenge_day_screen.dart';
import 'challenge_format.dart';
import 'challenge_sheets.dart';
import 'challenge_widgets.dart';
import 'journey_game.dart';
import 'voyage.dart';
import 'journey_avatar.dart';
import 'journey_buddies.dart';
import 'journey_walkthrough.dart';
import '../projourney/pro_journeys_section.dart';

/// Journey tab — 75 Days of Light as a lamb-led path to the cross.
/// Web mirror: `src/pages/Challenge.tsx`.
class ChallengeScreen extends ConsumerStatefulWidget {
  const ChallengeScreen({super.key, this.inTab = false, this.adPending = false});

  /// Rendered as the bottom-nav Journey tab (no back arrow, room for the bar).
  final bool inTab;

  /// A free user just completed a day: show one warm interstitial here.
  final bool adPending;

  @override
  ConsumerState<ChallengeScreen> createState() => _ChallengeScreenState();
}

class _ChallengeScreenState extends ConsumerState<ChallengeScreen> with WidgetsBindingObserver {
  Timer? _adTimer;
  String _refLabel = '';
  int _refDay = 0;
  String _refLang = '';

  /// Where the lamb walks from on this visit (last position the user saw).
  int? _fromDays;
  int _sailKey = 0;
  bool _tourQueued = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    ChallengeStore.evaluate();
    ChallengeStore.revision.addListener(_onChallenge);
    ChallengeCircleService.scheduleProgressSync();
    unawaited(ChallengeReminderService.sync());
    if (widget.adPending) _scheduleAd();
    if (!widget.inTab || ref.read(activeTabProvider) == AppTabs.journey) _onVisible(initial: true);
  }

  @override
  void dispose() {
    _adTimer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    ChallengeStore.revision.removeListener(_onChallenge);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      ChallengeStore.evaluate();
    }
  }

  /// The hub came on screen: analytics + walk the lamb from its last-seen spot.
  void _onVisible({bool initial = false}) {
    final completed = ChallengeStore.completedCount(ChallengeStore.state);
    Analytics.capture('challenge_hub_viewed', {'status': ChallengeStore.state.status, 'completed': completed});
    final seen = getVoyageSeen();
    if (seen != null && seen < completed && !ChallengeStore.view().idle) {
      _fromDays = seen;
      _sailKey++;
      if (!initial && mounted) setState(() {});
    } else if (seen == null || seen > completed) {
      setVoyageSeen(completed);
    }
  }

  void _onChallenge() {
    if (!mounted) return;
    setState(() {});
    ChallengeCircleService.scheduleProgressSync();
    unawaited(ChallengeReminderService.sync());
  }

  void _scheduleAd() {
    if (ref.read(premiumProvider)) return;
    _adTimer?.cancel();
    _adTimer = Timer(const Duration(milliseconds: 900), () {
      if (!mounted) return;
      unawaited(AdsService.tryShowInterstitial('challenge_day_lit', onlyIfWarm: true));
    });
  }

  Future<void> _openDay({int? day, String? task}) async {
    final adPending = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => ChallengeDayScreen(day: day, fromHub: true, focusTask: task)),
    );
    if (adPending == true && mounted) _scheduleAd();
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

  void _loadRefLabel(String lang, ChallengeDayPlan plan) {
    if (_refDay == plan.day && _refLang == lang) return;
    _refDay = plan.day;
    _refLang = lang;
    _refLabel = '';
    readingLabel(lang, plan.ref).then((v) {
      if (mounted && _refDay == plan.day) setState(() => _refLabel = v);
    }).catchError((_) {});
  }

  void _openTask(ChallengeView v, String id) {
    haptic(HapticStyle.light);
    if (v.lit || v.finished) {
      _openDay(day: math.max(1, v.completed));
    } else {
      _openDay(task: id);
    }
  }

  @override
  Widget build(BuildContext context) {
    final lang = ref.watch(languageProvider);
    final isPremium = ref.watch(premiumProvider);
    if (widget.inTab) {
      ref.listen<int>(activeTabProvider, (prev, next) {
        if (next == AppTabs.journey && prev != AppTabs.journey) _onVisible();
      });
    }
    final v = ChallengeStore.view();
    final pad = MediaQuery.of(context).padding;
    final navInset = widget.inTab ? 104.0 + pad.bottom : 0.0;
    final bottom = widget.inTab ? 20.0 : 40.0 + pad.bottom;
    final introBottom = (widget.inTab ? 116.0 : 40.0) + pad.bottom;

    if (v.idle) {
      return ChallengeIntro(
        onBack: widget.inTab ? null : () => Navigator.of(context).maybePop(),
        bottomPadding: introBottom,
        navInset: widget.inTab ? 104.0 + pad.bottom : 0,
        onStart: (mode) async {
          if (ChallengeCircleService.identity == null) {
            final saved = await showCircleFlow(context, 'profile', lang: lang);
            if (saved == null || !mounted) return;
          }
          ChallengeStore.start(mode);
          setVoyageSeen(0);
          Analytics.capture('challenge_started', {'mode': mode, 'morning': '07:00', 'night': '21:00'});
          await ChallengeReminderService.requestPermission();
          await ChallengeReminderService.sync();
        },
      );
    }

    final plan = challengeDay(v.day);
    _loadRefLabel(lang, plan);
    final stage = stageForDay(v.lit || v.finished ? math.max(1, v.completed) : v.day);
    final cap = ChallengeStore.graceCap(isPremium);
    final notice = v.state.notice;

    if (!_tourQueued && !JourneyWalkthrough.seen) {
      _tourQueued = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        showModalBottomSheet<void>(
          context: context,
          isScrollControlled: true,
          useSafeArea: true,
          isDismissible: false,
          enableDrag: false,
          backgroundColor: Colors.transparent,
          builder: (_) => const JourneyWalkthrough(),
        );
      });
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      body: Padding(
        padding: EdgeInsets.only(bottom: navInset),
        child: Column(
          children: [
            _header(lang),
            Expanded(
              child: ListView(
                padding: EdgeInsets.fromLTRB(16, 4, 16, bottom),
                children: [
                  Center(
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 540),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          _poster(v, plan, stage),
                          if (notice != null) ...[const SizedBox(height: 16), _notice(notice, v)],
                          const SizedBox(height: 16),
                          v.finished ? _finished() : _steps(v, plan, cap, isPremium),
                          const SizedBox(height: 16),
                          MilestoneShelf(completed: v.completed, streak: v.streak),
                          const SizedBox(height: 24),
                          ProJourneysSection(isPremium: isPremium),
                          const SizedBox(height: 16),
                          JourneyBuddies(
                            isPremium: isPremium,
                            onJoin: () async {
                              final id = await showCircleFlow(context, 'join', lang: lang);
                              if (id != null && id.isNotEmpty) Analytics.capture('challenge_buddy_joined', const {});
                            },
                            onNeedProfile: () => showCircleFlow(context, 'profile', lang: lang),
                          ),
                          const SizedBox(height: 12),
                          _logbookRow(v),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _header(String lang) {
    final pad = MediaQuery.of(context).padding;
    return Container(
      color: AppColors.background,
      padding: EdgeInsets.fromLTRB(widget.inTab ? 20 : 16, math.max(14, pad.top), 16, 12),
      child: Row(
        children: [
          if (!widget.inTab) ...[
            RoundIconButton(icon: 'chevron-left', label: t('ch.back'), onTap: () => Navigator.of(context).maybePop()),
            const SizedBox(width: 10),
          ],
          Expanded(
            child: Text(t('ch.name'), maxLines: 1, overflow: TextOverflow.ellipsis, style: JourneyText.title()),
          ),
          RoundIconButton(
            icon: 'settings-2',
            label: t('ch.hub.settings'),
            onTap: () {
              haptic(HapticStyle.light);
              showChallengeSettings(context);
            },
          ),
        ],
      ),
    );
  }

  Widget _poster(ChallengeView v, ChallengeDayPlan plan, ChallengeStage stage) {
    final subtitle = v.finished ? t('ch.home.finished')
      : '${t('ch.day', {'day': v.lit ? math.max(1, v.completed) : plan.day})} · ${t('ch.stage.${stage.key}')}';
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Padding(padding: const EdgeInsets.symmetric(horizontal: 4), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(subtitle, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: AppColors.primary)),
      ])),
      const SizedBox(height: 12),
      ClipRRect(borderRadius: BorderRadius.circular(12), child: ListenableBuilder(
        listenable: ChallengeCircleService.revision,
        builder: (context, _) => VoyagePoster(
          key: ValueKey('hub-voyage-$_sailKey'), days: v.completed, fromDays: _fromDays,
          semanticLabel: t('ch.voyage.a11y', {'n': v.completed}),
          buddies: [
            for (final (m, _) in ChallengeCircleService.buddies(ChallengeCircleService.cached))
              (id: m.id, days: m.completedDays, avatar: m.avatar),
          ],
          onArrive: () { setVoyageSeen(v.completed); _fromDays = null; haptic(HapticStyle.medium); },
        ),
      )),
      const SizedBox(height: 12),
      Padding(padding: const EdgeInsets.symmetric(horizontal: 4), child: Row(children: [
        Text(t('ch.hub.daysProgress', {'n': v.completed}), style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: AppColors.mutedForeground)),
        const SizedBox(width: 12),
        Expanded(child: ClipRRect(borderRadius: BorderRadius.circular(4), child: LinearProgressIndicator(
          value: v.completed / kVoyageDays, minHeight: 6, backgroundColor: AppColors.muted, valueColor: AlwaysStoppedAnimation(AppColors.primary),
        ))),
        const SizedBox(width: 12),
        const JourneyInfoButton(kind: 'lamb'),
      ])),
    ]);
  }

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
          Padding(padding: const EdgeInsets.only(top: 2), child: LucideIconLite('anchor', size: 20, color: AppColors.primary)),
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

  Widget _finished() => Container(
        padding: const EdgeInsets.all(20),
        decoration: journeyCard(border: AppColors.primary.withValues(alpha: 0.3)),
        child: Column(
          children: [
            Text(t('ch.cele.finishedTitle'), textAlign: TextAlign.center, style: ChInk.serif(24)),
            const SizedBox(height: 4),
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 300),
              child: Text(t('ch.cele.finishedSub'),
                  textAlign: TextAlign.center, style: TextStyle(fontSize: 14, height: 1.35, color: AppColors.mutedForeground)),
            ),
            const SizedBox(height: 16),
            GoldButton(
              label: t('ch.finished.again'),
              height: 48,
              fontSize: 14.5,
              onTap: () {
                haptic(HapticStyle.medium);
                Analytics.capture('challenge_new_round');
                setVoyageSeen(0);
                ChallengeStore.reset();
              },
            ),
            const SizedBox(height: 8),
            OutlineButton(
              label: t('ch.cele.share'),
              icon: 'share-2',
              height: 48,
              onTap: () {
                haptic(HapticStyle.light);
                ShareService.share(title: t('ch.name'), text: t('ch.share.finished'), includeAppLink: true);
              },
            ),
          ],
        ),
      );

  Widget _chip({required String icon, required Color iconColor, required String text, String? label, VoidCallback? onTap}) {
    final chip = Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: AppColors.border.withValues(alpha: 0.6)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          LucideIconLite(icon, size: 14, color: iconColor),
          const SizedBox(width: 4),
          Text(text, style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: AppColors.foreground)),
        ],
      ),
    );
    return Semantics(
      label: label,
      button: onTap != null,
      child: onTap == null ? chip : GestureDetector(onTap: onTap, child: chip),
    );
  }

  Widget _steps(ChallengeView v, ChallengeDayPlan plan, int cap, bool isPremium) {
    final subs = <String, String>{
      'read': _refLabel.isNotEmpty ? _refLabel : t('ch.task.read.sub'),
      'pray': plan.focus.isNotEmpty ? plan.focus : t('ch.task.pray.sub'),
      'live': plan.action.isNotEmpty ? plan.action : t('ch.task.live.sub'),
      'reflect': t('ch.task.reflect.sub'),
    };
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TodayPath(
          taskIds: kTaskIds,
          icons: kTaskIcon,
          done: v.done,
          allDone: v.lit,
          subtitles: subs,
          onOpen: (id) => _openTask(v, id),
        ),
        const SizedBox(height: 12),
        Semantics(
          button: true,
          child: InkWell(
            onTap: () => _openTask(v, 'live'),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 16),
              decoration: BoxDecoration(border: Border(top: BorderSide(color: AppColors.border), bottom: BorderSide(color: AppColors.border))),
              child: Row(children: [
                Text(plan.missionEmoji, style: const TextStyle(fontSize: 26)),
                const SizedBox(width: 12),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(upper(t('ch.live.title', {'day': '${plan.day}'.padLeft(2, '0')})), style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w600, color: AppColors.primary)),
                  const SizedBox(height: 4),
                  Text(plan.action, style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600, color: AppColors.foreground)),
                  const SizedBox(height: 4),
                  Text(plan.how, style: TextStyle(fontSize: 13, height: 1.5, color: AppColors.mutedForeground)),
                ])),
                const SizedBox(width: 12),
                Icon(Icons.chevron_right, size: 18, color: AppColors.primary),
              ]),
            ),
          ),
        ),
        const SizedBox(height: 12),
        if (v.lit)
          MinuteTicker(
            builder: (_) => Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(22),
                border: Border.all(color: AppColors.primary.withValues(alpha: 0.2)),
              ),
              child: Column(
                children: [
                  Text(t('ch.lit.title', {'day': plan.day}),
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.foreground)),
                  const SizedBox(height: 2),
                  Text(
                    t('ch.lit.next', {'day': plan.day + 1, 'time': formatCountdown(ChallengeStore.untilMidnight())}),
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 13, color: AppColors.mutedForeground),
                  ),
                  const SizedBox(height: 8),
                  GestureDetector(
                    onTap: () => _openDay(day: plan.day),
                    child: Text(t('ch.cta.review', {'day': plan.day}),
                        style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: AppColors.primary)),
                  ),
                ],
              ),
            ),
          )
        else
          GoldButton(
            label: v.done.isNotEmpty ? t('ch.cta.continue', {'day': plan.day}) : t('ch.cta.begin', {'day': plan.day}),
            trailing: 'chevron-right',
            onTap: () {
              haptic(HapticStyle.medium);
              _openDay();
            },
          ),
      ],
    );
  }

  Widget _stepRow(ChallengeView v, String id, String sub) {
    final done = v.lit || v.done.contains(id);
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => _openTask(v, id),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          child: Row(
            children: [
              StepCheck(done: done),
              const SizedBox(width: 12),
              LucideIconLite(kTaskIcon[id]!, size: 20, strokeWidth: 1.8, color: done ? AppColors.primary : AppColors.fg(0.75)),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      t('ch.task.$id'),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 15.5,
                        height: 1.2,
                        fontWeight: FontWeight.w700,
                        color: done ? AppColors.mutedForeground : AppColors.foreground,
                        decoration: done ? TextDecoration.lineThrough : null,
                        decorationColor: AppColors.mutedForeground.withValues(alpha: 0.4),
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(sub, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12.5, color: AppColors.mutedForeground)),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              LucideIconLite('chevron-right', size: 16, color: AppColors.mutedForeground),
            ],
          ),
        ),
      ),
    );
  }

  Widget _logbookRow(ChallengeView v) => Semantics(
        button: true,
        child: GestureDetector(
          onTap: () {
            haptic(HapticStyle.light);
            showLogbook(
              context,
              completed: v.completed,
              currentDay: v.day,
              lit: v.lit,
              onOpenDay: (d) => _openDay(day: d),
            );
          },
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            decoration: BoxDecoration(
              color: AppColors.card,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.border.withValues(alpha: 0.5)),
            ),
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(12)),
                  child: LucideIconLite('book-open', size: 20, color: AppColors.primary),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(t('ch.logbook'), style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.foreground)),
                      Text(t(v.completed == 1 ? 'ch.hub.completedOne' : 'ch.hub.completed', {'n': v.completed}), style: TextStyle(fontSize: 12.5, color: AppColors.mutedForeground)),
                    ],
                  ),
                ),
                LucideIconLite('chevron-right', size: 16, color: AppColors.mutedForeground),
              ],
            ),
          ),
        ),
      );

}

/* ── logbook ────────────────────────────────────────────────────────────── */

/// Every day of the journey, grouped by milestone. Completed days reopen for review.
/// Web mirror: `LogbookSheet.tsx`.
Future<void> showLogbook(
  BuildContext context, {
  required int completed,
  required int currentDay,
  required bool lit,
  required ValueChanged<int?> onOpenDay,
}) {
  return showChallengeSheet<void>(
    context,
    title: t('ch.logbook'),
    closeLabel: t('ch.settings.done'),
    builder: (sheet) => Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(t(completed == 1 ? 'ch.hub.completedOne' : 'ch.hub.completed', {'n': completed}), style: TextStyle(fontSize: 13.5, color: AppColors.mutedForeground)),
        const SizedBox(height: 16),
        for (var i = 0; i < kStages.length; i++) ...[
          if (i > 0) const SizedBox(height: 16),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Expanded(
                child: Text(
                  '${t('ch.island.n', {'n': i + 1})} · ${t('ch.stage.${kStages[i].key}')}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.foreground),
                ),
              ),
              Text(t('ch.stage.range', {'from': kStages[i].from, 'to': kStages[i].to}),
                  style: TextStyle(fontSize: 12, color: AppColors.mutedForeground)),
            ],
          ),
          const SizedBox(height: 6),
          LayoutBuilder(builder: (context, box) {
            const gap = 3.0;
            final cell = (box.maxWidth - gap * 14) / 15;
            return Wrap(
              spacing: gap,
              runSpacing: gap,
              children: [
                for (var d = kStages[i].from; d <= kStages[i].to; d++)
                  _LogCell(
                    day: d,
                    size: cell,
                    got: d <= completed,
                    today: !lit && d == currentDay,
                    onTap: () {
                      haptic(HapticStyle.light);
                      Navigator.of(sheet).pop();
                      onOpenDay(d <= completed ? d : null);
                    },
                  ),
              ],
            );
          }),
        ],
      ],
    ),
  );
}

class _LogCell extends StatelessWidget {
  const _LogCell({required this.day, required this.size, required this.got, required this.today, required this.onTap});
  final int day;
  final double size;
  final bool got;
  final bool today;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final enabled = got || today;
    return Semantics(
      button: enabled,
      enabled: enabled,
      label: t('ch.day', {'day': day}),
      child: GestureDetector(
        onTap: enabled ? onTap : null,
        child: Container(
          width: size,
          height: size,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(6),
            color: got
                ? AppColors.primary
                : today
                    ? AppColors.primary.withValues(alpha: 0.1)
                    : AppColors.muted,
            border: today && !got ? Border.all(color: AppColors.primary, width: 2) : null,
          ),
          child: FittedBox(
            fit: BoxFit.scaleDown,
            child: Text(
              '$day',
              textScaler: TextScaler.noScaling,
              style: TextStyle(
                fontSize: 9.5,
                fontWeight: FontWeight.w800,
                color: got
                    ? AppColors.primaryForeground
                    : today
                        ? AppColors.primary
                        : AppColors.mutedForeground.withValues(alpha: 0.7),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/* ── intro (idle) ───────────────────────────────────────────────────────── */

/// First visit to the Journey: the pilgrimage, how it works and path choice.
/// Web mirror: `src/components/challenge/ChallengeIntro.tsx`.
class ChallengeIntro extends ConsumerStatefulWidget {
  const ChallengeIntro({super.key, this.onBack, required this.onStart, this.bottomPadding = 40, this.navInset = 0});
  final VoidCallback? onBack;
  final Future<void> Function(String mode) onStart;
  final double bottomPadding;
  final double navInset;

  @override
  ConsumerState<ChallengeIntro> createState() => _ChallengeIntroState();
}

class _ChallengeIntroState extends ConsumerState<ChallengeIntro> {
  String _mode = 'grace';
  bool _launching = false;
  int _startAttempt = 0;

  void _start() {
    setState(() => _launching = true);
    Future.delayed(const Duration(milliseconds: 1100), () async {
      if (!mounted) return;
      await widget.onStart(_mode);
      if (mounted) setState(() { _launching = false; _startAttempt++; });
    });
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(languageProvider);
    final pad = MediaQuery.of(context).padding;
    final steps = [
      ('list-checks', 'ch.intro.step1.t', 'ch.intro.step1.s'),
      ('map-pin', 'ch.intro.step2.t', 'ch.intro.step2.s'),
      ('sparkles', 'ch.intro.step3.t', 'ch.intro.step3.s'),
    ];

    return Scaffold(
      backgroundColor: AppColors.background,
      body: Padding(
        padding: EdgeInsets.only(bottom: widget.navInset),
        child: Column(
          children: [
          Container(
            color: AppColors.background,
            padding: EdgeInsets.fromLTRB(widget.onBack == null ? 20 : 16, math.max(14, pad.top), 16, 12),
            child: Row(
              children: [
                if (widget.onBack != null) ...[
                  RoundIconButton(icon: 'chevron-left', label: t('ch.back'), onTap: widget.onBack!),
                  const SizedBox(width: 10),
                ],
                Expanded(
                  child: Column(children: [
                    Text(t('ch.tab').toUpperCase(), style: TextStyle(fontSize: 11.5, letterSpacing: 2, fontWeight: FontWeight.w600, color: AppColors.primary)),
                    const SizedBox(height: 4),
                    Text(t('ch.name'), textAlign: TextAlign.center, maxLines: 2, style: TextStyle(fontSize: 27, height: 1.15, fontWeight: FontWeight.w700, color: AppColors.foreground)),
                  ]),
                ),
                if (widget.onBack != null) const SizedBox(width: 50),
              ],
            ),
          ),
          Expanded(
            child: ListView(
              padding: EdgeInsets.fromLTRB(16, 4, 16, widget.navInset > 0 ? 20 : widget.bottomPadding + 8),
              children: [
                Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 540),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        _GoldFrame(
                          child: VoyagePoster(
                            days: _launching ? 2 : 0, fromDays: _launching ? 0 : null,
                            sailDelay: Duration.zero, sailDuration: const Duration(milliseconds: 1000),
                            semanticLabel: t('ch.intro.kicker'),
                          ),
                        ),
                        const SizedBox(height: 16),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                          child: Text(t('ch.intro.sub'), textAlign: TextAlign.center, style: TextStyle(fontSize: 14.5, height: 1.5, color: AppColors.mutedForeground)),
                        ),
                        const SizedBox(height: 28),
                        _sectionTitle(t('ch.intro.how')),
                        for (var i = 0; i < steps.length; i++) ...[
                          if (i > 0) const SizedBox(height: 10),
                          _GoldFrame(soft: true, child: _introStep(i, steps[i].$1, steps[i].$2, steps[i].$3)),
                        ],
                        const SizedBox(height: 10),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 8),
                          child: Text(t('ch.intro.read.s'), textAlign: TextAlign.center, style: TextStyle(fontSize: 12.5, height: 1.35, color: AppColors.mutedForeground)),
                        ),
                        const SizedBox(height: 28),
                        _sectionTitle(t('ch.intro.path')),
                        _modeCard('grace'),
                        const SizedBox(height: 10),
                        _modeCard('covenant'),
                        const SizedBox(height: 28),
                        HoldButton(
                          icon: 'map-pin',
                          label: _launching ? t('ch.intro.lit') : t('ch.intro.hold'),
                          key: ValueKey(_startAttempt),
                          holdingLabel: t('ch.intro.holding'),
                          disabled: _launching,
                          onComplete: _start,
                        ),
                        const SizedBox(height: 20),
                        CustomPaint(
                          painter: _CornerPainter(AppColors.primary.withValues(alpha: 0.6)),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                            child: Column(children: [
                              Text('“${t('ch.verse')}”',
                                  textAlign: TextAlign.center,
                                  style: ChInk.serif(14, weight: FontWeight.w400, color: AppColors.foreground.withValues(alpha: 0.85), height: 1.45, style: FontStyle.italic)),
                              const SizedBox(height: 6),
                              Text(t('ch.verseRef').toUpperCase(), textAlign: TextAlign.center, style: TextStyle(fontSize: 11.5, letterSpacing: 1.6, fontWeight: FontWeight.w600, color: AppColors.primary)),
                            ]),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
          ],
        ),
      ),
    );
  }

  Widget _sectionTitle(String text) {
    Widget line(bool left) => Expanded(
          child: Container(
            height: 1,
            decoration: BoxDecoration(
              gradient: LinearGradient(colors: [
                AppColors.primary.withValues(alpha: left ? 0 : 0.5),
                AppColors.primary.withValues(alpha: left ? 0.5 : 0),
              ]),
            ),
          ),
        );
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(children: [
        line(true),
        const SizedBox(width: 10),
        Text(text.toUpperCase(), style: TextStyle(fontSize: 11.5, letterSpacing: 1.8, fontWeight: FontWeight.w600, color: AppColors.primary)),
        const SizedBox(width: 10),
        line(false),
      ]),
    );
  }

  Widget _ring(String icon, {bool filled = false}) => Container(
        width: 40,
        height: 40,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: filled ? AppColors.primary : AppColors.card,
          border: Border.all(color: AppColors.primary.withValues(alpha: 0.35)),
          boxShadow: [BoxShadow(color: AppColors.primary.withValues(alpha: 0.07), spreadRadius: 4)],
        ),
        child: LucideIconLite(icon, size: 18, strokeWidth: 1.9, color: filled ? AppColors.primaryForeground : AppColors.primary),
      );

  Widget _introStep(int i, String icon, String title, String subtitle) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _ring(icon),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text.rich(TextSpan(children: [
                    TextSpan(text: '0${i + 1}  ', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 1, color: AppColors.primary)),
                    TextSpan(text: t(title)),
                  ]), style: TextStyle(fontSize: 15, height: 1.3, fontWeight: FontWeight.w600, color: AppColors.foreground)),
                  const SizedBox(height: 4),
                  Text(t(subtitle), style: TextStyle(fontSize: 13.5, height: 1.35, color: AppColors.mutedForeground)),
                ],
              ),
            ),
          ],
        ),
      );

  Widget _modeCard(String m) {
    final active = _mode == m;
    final accent = m == 'grace' ? AppColors.primary : AppColors.destructive;
    return Semantics(
      selected: active,
      inMutuallyExclusiveGroup: true,
      button: true,
      child: GestureDetector(
        onTap: () {
          haptic(HapticStyle.light);
          setState(() => _mode = m);
        },
        child: _GoldFrame(
          soft: !active,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 180),
            color: active ? AppColors.primary.withValues(alpha: 0.06) : Colors.transparent,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _ring(m == 'grace' ? 'sun' : 'flame', filled: active),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Wrap(
                        spacing: 8,
                        runSpacing: 4,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          Text(t('ch.mode.$m.t'), style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.foreground)),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                            decoration: BoxDecoration(
                              color: accent.withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(99),
                              border: Border.all(color: accent.withValues(alpha: 0.25)),
                            ),
                            child: Text(t('ch.mode.$m.badge').toUpperCase(), style: TextStyle(fontSize: 10.5, letterSpacing: 0.6, fontWeight: FontWeight.w700, color: accent)),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(t('ch.mode.$m.s'), style: TextStyle(fontSize: 13.5, height: 1.35, color: AppColors.mutedForeground)),
                    ],
                  ),
                ),
                const SizedBox(width: 10),
                AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  width: 24,
                  height: 24,
                  margin: const EdgeInsets.only(top: 4),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: active ? AppColors.primary : Colors.transparent,
                    border: Border.all(color: active ? AppColors.primary : AppColors.mutedForeground.withValues(alpha: 0.35), width: 2),
                  ),
                  child: active ? LucideIconLite('check', size: 14, strokeWidth: 3, color: AppColors.primaryForeground) : null,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

}

/// Gold gradient hairline frame (web: `.gold-frame`, `.gold-frame--soft`).
class _GoldFrame extends StatelessWidget {
  const _GoldFrame({required this.child, this.soft = false});
  final Widget child;
  final bool soft;

  @override
  Widget build(BuildContext context) {
    final p = AppColors.primary;
    final b = AppColors.border;
    return Container(
      padding: const EdgeInsets.all(1.5),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: soft
              ? [p.withValues(alpha: 0.45), b.withValues(alpha: 0.45), p.withValues(alpha: 0.25)]
              : [p.withValues(alpha: 0.85), p.withValues(alpha: 0.12), b.withValues(alpha: 0.5), p.withValues(alpha: 0.55)],
          stops: soft ? const [0, 0.45, 1] : const [0, 0.38, 0.62, 1],
        ),
        boxShadow: soft ? null : [BoxShadow(color: p.withValues(alpha: 0.3), blurRadius: 40, spreadRadius: -26, offset: const Offset(0, 18))],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(18.5),
        child: ColoredBox(color: AppColors.card, child: child),
      ),
    );
  }
}

/// Two gold corner brackets around the verse (web: `.corner-frame`).
class _CornerPainter extends CustomPainter {
  _CornerPainter(this.color);
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5;
    const l = 18.0, r = 10.0;
    canvas.drawPath(
      Path()
        ..moveTo(0, l)
        ..lineTo(0, r)
        ..arcToPoint(const Offset(r, 0), radius: const Radius.circular(r))
        ..lineTo(l, 0),
      paint,
    );
    canvas.drawPath(
      Path()
        ..moveTo(size.width, size.height - l)
        ..lineTo(size.width, size.height - r)
        ..arcToPoint(Offset(size.width - r, size.height), radius: const Radius.circular(r))
        ..lineTo(size.width - l, size.height),
      paint,
    );
  }

  @override
  bool shouldRepaint(_CornerPainter old) => old.color != color;
}
