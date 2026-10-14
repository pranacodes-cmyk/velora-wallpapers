import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/app_tabs.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/services/ads_service.dart';
import '../../core/services/analytics.dart';
import '../../core/services/challenge_data.dart';
import '../../core/services/challenge_reminders.dart';
import '../../core/services/challenge_store.dart';
import '../../core/services/haptics.dart';
import '../../core/services/rating_service.dart';
import '../../core/services/share_service.dart';
import '../../core/theme/app_colors.dart';
import '../../state/app_providers.dart';
import 'challenge_format.dart';
import 'challenge_screen.dart';
import 'challenge_widgets.dart';
import 'voyage.dart';

/// One day of 75 Days of Light: read (compulsory) · pray · live it · reflect.
/// Web mirror: `src/pages/ChallengeDay.tsx`.
class ChallengeDayScreen extends ConsumerStatefulWidget {
  const ChallengeDayScreen({super.key, this.day, this.fromHub = false, this.focusTask});

  /// Specific day (review); null = the day the user works on now.
  final int? day;

  /// Opened from the hub: pop back with the ad flag instead of replacing.
  final bool fromHub;

  /// Step tapped on the hub — scrolled into view once the page settles.
  final String? focusTask;

  @override
  ConsumerState<ChallengeDayScreen> createState() => _ChallengeDayScreenState();
}

class _ChallengeDayScreenState extends ConsumerState<ChallengeDayScreen> {
  final _scroll = ScrollController();
  final _endKey = GlobalKey();
  final _taskKeys = {for (final id in kTaskIds) id: GlobalKey()};
  late final TextEditingController _note;
  bool _readOpen = false;
  bool _readEnd = false;
  bool _noteSaved = false;
  ChapterText? _chapter;
  bool _chapterError = false;
  String _chapterKey = '';

  int get _dayNumber {
    final d = widget.day;
    return d == null ? ChallengeStore.view().day : d.clamp(1, kChallengeDays);
  }

  @override
  void initState() {
    super.initState();
    ChallengeStore.evaluate();
    ChallengeStore.revision.addListener(_onChange);
    _note = TextEditingController(text: ChallengeStore.readJournal()['$_dayNumber'] ?? '');
    Analytics.capture('challenge_day_viewed', {'day': _dayNumber, 'mode': _mode(ChallengeStore.view())});
    final focus = widget.focusTask;
    if (focus != null && focus != 'read') {
      Future.delayed(const Duration(milliseconds: 350), () {
        final ctx = _taskKeys[focus]?.currentContext;
        if (ctx != null && ctx.mounted) {
          Scrollable.ensureVisible(ctx, duration: const Duration(milliseconds: 450), curve: Curves.easeOutCubic);
        }
      });
    }
  }

  @override
  void dispose() {
    ChallengeStore.revision.removeListener(_onChange);
    _scroll.dispose();
    _note.dispose();
    super.dispose();
  }

  void _onChange() {
    if (mounted) setState(() {});
  }

  String _mode(ChallengeView v) {
    final n = _dayNumber;
    if (v.idle) return 'locked';
    // Today stays in "today" mode even after lighting, so the optional
    // reflection can still be recorded.
    if (n == v.day && v.state.status == 'active') return 'today';
    if (v.state.completed.containsKey('$n')) return 'review';
    return 'locked';
  }

  void _loadChapter(String lang, ChallengeDayPlan plan) {
    final key = '$lang:${plan.day}';
    if (_chapterKey == key) return;
    _chapterKey = key;
    _chapter = null;
    _chapterError = false;
    loadChapter(lang, plan.ref).then((c) {
      if (mounted && _chapterKey == key) setState(() => _chapter = c);
    }).catchError((_) {
      if (mounted && _chapterKey == key) setState(() => _chapterError = true);
    });
  }

  void _checkReadEnd() {
    if (_readEnd || !_readOpen) return;
    final ctx = _endKey.currentContext;
    if (ctx == null) return;
    final box = ctx.findRenderObject();
    if (box is! RenderBox || !box.attached) return;
    final y = box.localToGlobal(Offset.zero).dy;
    if (y < MediaQuery.of(context).size.height - 40) setState(() => _readEnd = true);
  }

  void _finishTask(String id, ChallengeView v) {
    if (v.done.contains(id)) return;
    final isToday = _dayNumber == v.day && v.state.status == 'active';
    if (_mode(v) != 'today' && !(isToday && id == 'reflect')) return;
    final isPremium = ref.read(premiumProvider);
    final result = ChallengeStore.completeTask(id, isPremium);
    haptic(result.lit ? HapticStyle.heavy : HapticStyle.medium);
    Analytics.capture('challenge_task_done', {'task': id, 'day': _dayNumber});
    unawaited(ChallengeReminderService.sync());
    if (result.lit) {
      Analytics.capture('challenge_day_lit', {'day': result.day, 'streak': result.streak, 'mode': v.state.mode, 'finished': result.finished});
      _celebrate(result);
    } else {
      final next = kTaskIds.where((x) => x != id && !v.done.contains(x)).firstOrNull;
      if (next != null) {
        Future.delayed(const Duration(milliseconds: 280), () {
          final ctx = _taskKeys[next]?.currentContext;
          if (ctx != null && ctx.mounted) {
            Scrollable.ensureVisible(ctx, duration: const Duration(milliseconds: 450), curve: Curves.easeOutCubic, alignmentPolicy: ScrollPositionAlignmentPolicy.explicit);
          }
        });
      }
    }
  }

  Future<void> _celebrate(CompletionResult r) async {
    final lang = ref.read(languageProvider);
    final ref0 = await readingLabel(lang, challengeDay(r.day).ref).catchError((_) => '');
    if (!mounted) return;
    await Navigator.of(context).push(PageRouteBuilder<void>(
      opaque: true,
      transitionDuration: const Duration(milliseconds: 360),
      pageBuilder: (_, __, ___) => CelebrationView(
        result: r,
        onShare: () {
          Analytics.capture('challenge_day_shared', {'day': r.day});
          ShareService.share(
            title: t('ch.name'),
            text: r.finished ? t('ch.share.finished') : t('ch.share.day', {'day': r.day, 'ref': ref0}),
            includeAppLink: true,
          );
        },
      ),
      transitionsBuilder: (_, a, __, child) => FadeTransition(opacity: a, child: child),
    ));
    if (!mounted) return;
    setVoyageSeen(r.day);
    final adPending = !ref.read(premiumProvider) && r.day >= 2 && !r.finished;
    if (r.day == 7 || r.finished) {
      Future.delayed(const Duration(milliseconds: 1200), () => RatingService.maybeRequestRating());
    }
    if (widget.fromHub) {
      Navigator.of(context).pop(adPending);
    } else {
      // Opened from Home / a reminder: land on the Journey tab, where the
      // ship now sits one day further, with the same warm interstitial.
      ref.read(activeTabProvider.notifier).state = AppTabs.journey;
      Navigator.of(context).popUntil((route) => route.isFirst);
      if (adPending) {
        // adPending already excludes Pro; no `ref` here — this page is gone.
        Future.delayed(const Duration(milliseconds: 900), () {
          unawaited(AdsService.tryShowInterstitial('challenge_day_lit', onlyIfWarm: true));
        });
      }
    }
  }

  void _back() => Navigator.of(context).maybePop();

  @override
  Widget build(BuildContext context) {
    final lang = ref.watch(languageProvider);
    final v = ChallengeStore.view();
    final n = _dayNumber;
    final mode = _mode(v);
    final pad = MediaQuery.of(context).padding;

    // Not started (or restarted from settings): show the intro instead.
    if (v.idle) return const ChallengeScreen();

    if (mode == 'locked') {
      return Scaffold(
        backgroundColor: AppColors.background,
        body: Center(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 64,
                  height: 64,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(shape: BoxShape.circle, color: AppColors.muted),
                  child: LucideIconLite('lock', size: 28, color: AppColors.mutedForeground),
                ),
                const SizedBox(height: 16),
                Text(t('ch.day', {'day': n}), style: ChInk.serif(24)),
                const SizedBox(height: 8),
                Text(
                  v.lit && n == v.completed + 1 ? t('ch.lit.rest') : t('ch.d.locked', {'day': n, 'prev': math.max(1, n - 1)}),
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 14.5, height: 1.5, color: AppColors.mutedForeground),
                ),
                const SizedBox(height: 24),
                SizedBox(width: 160, child: OutlineButton(label: t('ch.back'), onTap: _back)),
              ],
            ),
          ),
        ),
      );
    }

    final plan = challengeDay(n);
    _loadChapter(lang, plan);
    final stage = stageForDay(n);
    final review = mode == 'review';
    final isToday = n == v.day && v.state.status == 'active';
    bool isDone(String id) => isToday ? v.done.contains(id) : review;
    final requiredDone = v.done.where(kRequiredTasks.contains).length;
    final doneCount = review ? 3 : requiredDone;
    final ch = _chapter;
    final chapterRef = ch != null && ch.bookName.isNotEmpty ? '${ch.bookName} ${plan.ref.chapter}' : '';
    final keyRef = ch != null && ch.bookName.isNotEmpty ? '${ch.bookName} ${plan.ref.chapter}:${plan.ref.verse}' : '';
    final keyVerse = ch != null && plan.ref.verse - 1 < ch.verses.length ? ch.verses[plan.ref.verse - 1] : '';
    final litOn = v.state.completed['$n'];
    final undo = mode == 'today' ? (String id) {
      haptic(HapticStyle.light);
      ChallengeStore.undoTask(id);
    } : null;

    return Scaffold(
      backgroundColor: AppColors.background,
      body: Column(
        children: [
          Container(
            color: AppColors.background,
            padding: EdgeInsets.fromLTRB(16, math.max(12, pad.top), 16, 12),
            child: Column(
              children: [
                Row(
                  children: [
                    RoundIconButton(icon: 'chevron-left', label: t('ch.back'), onTap: _back),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(t('ch.dayOf', {'day': n}), maxLines: 1, overflow: TextOverflow.ellipsis,
                              style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.foreground)),
                          Text(
                            review && litOn != null ? t('ch.d.review', {'date': formatDayMonth(litOn, lang)}) : t('ch.d.progress', {'n': doneCount}),
                            style: TextStyle(fontSize: 12, color: AppColors.mutedForeground),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    for (var i = 0; i < 4; i++) ...[
                      if (i > 0) const SizedBox(width: 6),
                      Expanded(
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 500),
                          height: 6,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(999),
                            color: (i < 3 ? i < doneCount : review || v.done.contains('reflect')) ? null : AppColors.muted,
                            gradient: (i < 3 ? i < doneCount : review || v.done.contains('reflect')) ? LinearGradient(colors: [ChInk.gold, ChInk.goldGlow]) : null,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
          Expanded(
            child: NotificationListener<ScrollNotification>(
              onNotification: (_) {
                _checkReadEnd();
                return false;
              },
              child: ListView(
                controller: _scroll,
                padding: EdgeInsets.fromLTRB(16, 4, 16, 32 + pad.bottom),
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(4, 4, 4, 6),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(upper('${t('ch.stage.${stage.key}')} · ${t('ch.day', {'day': n})}'), style: ChInk.eyebrow(11.5, AppColors.primary, tracking: 0.2)),
                        const SizedBox(height: 4),
                        Text(plan.title, style: ChInk.serif(26, height: 1.1)),
                        const SizedBox(height: 8),
                        Text(plan.insight, style: TextStyle(fontSize: 14, height: 1.4, color: AppColors.fg(0.8))),
                      ],
                    ),
                  ),
                  const SizedBox(height: 8),
                  _TaskCard(
                    key: _taskKeys['read'],
                    id: 'read',
                    title: t('ch.task.read'),
                    sub: chapterRef.isNotEmpty ? chapterRef : t('ch.task.read.sub'),
                    done: isDone('read'),
                    onUndo: undo == null ? null : () => undo('read'),
                    child: _readBody(plan, ch, chapterRef, keyRef, keyVerse, isDone('read'), v),
                  ),
                  const SizedBox(height: 12),
                  _TaskCard(
                    key: _taskKeys['pray'],
                    id: 'pray',
                    title: t('ch.task.pray'),
                    sub: t('ch.task.pray.sub'),
                    done: isDone('pray'),
                    onUndo: undo == null ? null : () => undo('pray'),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(upper(t('ch.pray.focus')), style: ChInk.eyebrow(10.5, AppColors.primary)),
                        const SizedBox(height: 4),
                        Text(plan.focus, style: TextStyle(fontSize: 15, height: 1.35, fontWeight: FontWeight.w700, color: AppColors.foreground)),
                        const SizedBox(height: 12),
                        Container(
                          padding: const EdgeInsets.all(14),
                          decoration: chCard(radius: 16, color: AppColors.background.withValues(alpha: 0.6), border: AppColors.border.withValues(alpha: 0.5)),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  LucideIconLite('hand-heart', size: 14, color: AppColors.mutedForeground),
                                  const SizedBox(width: 6),
                                  Text(t('ch.pray.withMe'), style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.mutedForeground)),
                                ],
                              ),
                              const SizedBox(height: 6),
                              Text(plan.prayer,
                                  style: ChInk.serif(16, weight: FontWeight.w400, height: 1.55, style: FontStyle.italic, color: AppColors.fg(0.9))),
                            ],
                          ),
                        ),
                        if (!isDone('pray')) ...[
                          const SizedBox(height: 14),
                          HoldButton(
                            label: t('ch.pray.hold'),
                            holdingLabel: t('ch.pray.amen'),
                            duration: const Duration(milliseconds: 1600),
                            onComplete: () => _finishTask('pray', ChallengeStore.view()),
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  _TaskCard(
                    key: _taskKeys['live'],
                    id: 'live',
                    title: t('ch.task.live'),
                    sub: t('ch.task.live.sub'),
                    done: isDone('live'),
                    onUndo: undo == null ? null : () => undo('live'),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(upper(t('ch.live.title', {'day': '$n'.padLeft(2, '0')})), style: ChInk.eyebrow(10.5, AppColors.primary)),
                        const SizedBox(height: 4),
                        Text('${plan.action} ${plan.missionEmoji}', style: TextStyle(fontSize: 22, height: 1.35, fontWeight: FontWeight.w700, color: AppColors.foreground)),
                        const SizedBox(height: 8),
                        Text(plan.how, style: TextStyle(fontSize: 15, height: 1.5, color: AppColors.fg(0.9))),
                        const SizedBox(height: 16),
                        Container(
                          padding: const EdgeInsets.only(left: 12),
                          decoration: BoxDecoration(border: Border(left: BorderSide(color: AppColors.primary.withValues(alpha: 0.5), width: 2))),
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text(t('ch.live.why'), style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.primary)),
                            const SizedBox(height: 4),
                            Text(plan.missionWhy, style: TextStyle(fontSize: 14, height: 1.5, color: AppColors.mutedForeground)),
                          ]),
                        ),
                        if (!isDone('live')) ...[
                          const SizedBox(height: 14),
                          OutlinedButton(
                            onPressed: () => _finishTask('live', v),
                            style: OutlinedButton.styleFrom(foregroundColor: AppColors.foreground, side: BorderSide(color: AppColors.primary.withValues(alpha: 0.4)), padding: const EdgeInsets.all(14), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8))),
                            child: Row(children: [
                              Icon(Icons.check_box_outline_blank, size: 22, color: AppColors.primary),
                              const SizedBox(width: 12),
                              Expanded(child: Text(t('ch.live.done'), style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600))),
                            ]),
                          ),
                          const SizedBox(height: 8),
                          Text(t('ch.live.later'), textAlign: TextAlign.center, style: TextStyle(fontSize: 12.5, color: AppColors.mutedForeground)),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  _TaskCard(
                    key: _taskKeys['reflect'],
                    id: 'reflect',
                    title: t('ch.task.reflect'),
                    sub: t('ch.task.reflect.sub'),
                    done: isDone('reflect'),
                    onUndo: undo == null ? null : () => undo('reflect'),
                    child: _reflectBody(plan, isDone('reflect'), review, v, n),
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
          ),
        ],
      ),
    );
  }

  Widget _readBody(ChallengeDayPlan plan, ChapterText? ch, String ref, String keyRef, String keyVerse, bool done, ChallengeView v) {
    if (_chapterError) {
      return Row(
        children: [
          Expanded(child: Text(t('ch.read.error'), style: TextStyle(fontSize: 14, color: AppColors.mutedForeground))),
          GestureDetector(
            onTap: () => setState(() => _chapterKey = ''),
            child: Text(t('ch.read.retry'), style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: AppColors.primary)),
          ),
        ],
      );
    }
    if (ch == null) return Text(t('ch.read.loading'), style: TextStyle(fontSize: 14, color: AppColors.mutedForeground));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.primary.withValues(alpha: 0.06),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.primary.withValues(alpha: 0.2)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(upper(t('ch.read.keyVerse')), style: ChInk.eyebrow(10.5, AppColors.primary)),
              const SizedBox(height: 6),
              Text('“$keyVerse”', style: ChInk.serif(18, weight: FontWeight.w400, height: 1.6)),
              const SizedBox(height: 6),
              Text(keyRef, style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: AppColors.mutedForeground)),
            ],
          ),
        ),
        const SizedBox(height: 14),
        if (!_readOpen)
          done
              ? OutlineButton(label: t('ch.read.btn', {'ref': ref}), icon: 'book-open', onTap: _openReading)
              : GoldButton(label: t('ch.read.btn', {'ref': ref}), icon: 'book-open', onTap: _openReading)
        else ...[
          Container(
            padding: const EdgeInsets.all(16),
            decoration: chCard(radius: 16, color: AppColors.background.withValues(alpha: 0.6), border: AppColors.border.withValues(alpha: 0.5)),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(ref, style: ChInk.serif(21)),
                const SizedBox(height: 12),
                for (var i = 0; i < ch.verses.length; i++)
                  Container(
                    margin: const EdgeInsets.only(bottom: 10),
                    padding: i + 1 == plan.ref.verse ? const EdgeInsets.symmetric(horizontal: 8, vertical: 2) : EdgeInsets.zero,
                    decoration: i + 1 == plan.ref.verse
                        ? BoxDecoration(color: AppColors.primary.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(8))
                        : null,
                    child: Text.rich(
                      TextSpan(children: [
                        TextSpan(
                          text: '${i + 1}  ',
                          style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: AppColors.primary, fontFamily: null),
                        ),
                        TextSpan(text: ch.verses[i]),
                      ]),
                      style: ChInk.serif(17, weight: FontWeight.w400, height: 1.75, color: AppColors.fg(0.9)),
                    ),
                  ),
                SizedBox(key: _endKey, height: 8),
              ],
            ),
          ),
          const SizedBox(height: 14),
          if (!done) ...[
            GoldButton(label: t('ch.read.done'), icon: 'check', onTap: _readEnd ? () => _finishTask('read', v) : null),
            if (!_readEnd) ...[
              const SizedBox(height: 8),
              Text(t('ch.read.hint'), textAlign: TextAlign.center, style: TextStyle(fontSize: 12.5, color: AppColors.mutedForeground)),
            ],
          ] else
            GestureDetector(
              onTap: () => setState(() => _readOpen = false),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    LucideIconLite('chevron-up', size: 16, color: AppColors.mutedForeground),
                    const SizedBox(width: 6),
                    Text(t('ch.read.hide'), style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: AppColors.mutedForeground)),
                  ],
                ),
              ),
            ),
        ],
      ],
    );
  }

  void _openReading() {
    haptic(HapticStyle.light);
    setState(() => _readOpen = true);
    Analytics.capture('challenge_chapter_opened', {'day': _dayNumber});
    WidgetsBinding.instance.addPostFrameCallback((_) => _checkReadEnd());
  }

  Widget _reflectBody(ChallengeDayPlan plan, bool done, bool review, ChallengeView v, int n) {
    final text = _note.text.trim();
    void save() {
      ChallengeStore.saveJournal(n, text);
      setState(() => _noteSaved = true);
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(plan.question, style: ChInk.serif(18, weight: FontWeight.w400, height: 1.35)),
        const SizedBox(height: 12),
        TextField(
          controller: _note,
          maxLines: 4,
          minLines: 3,
          maxLength: 600,
          onChanged: (_) => setState(() => _noteSaved = false),
          style: TextStyle(fontSize: 15, height: 1.5, color: AppColors.foreground),
          decoration: InputDecoration(
            hintText: t('ch.reflect.placeholder'),
            hintStyle: TextStyle(color: AppColors.mutedForeground.withValues(alpha: 0.7)),
            filled: true,
            fillColor: AppColors.background.withValues(alpha: 0.6),
            counterText: '',
            contentPadding: const EdgeInsets.all(14),
            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide(color: AppColors.border.withValues(alpha: 0.7))),
            focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide(color: AppColors.primary.withValues(alpha: 0.6))),
          ),
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            LucideIconLite('pen-line', size: 14, color: AppColors.mutedForeground),
            const SizedBox(width: 6),
            Expanded(child: Text(t('ch.reflect.private'), style: TextStyle(fontSize: 12, color: AppColors.mutedForeground))),
            if ((done || review) && text.isNotEmpty)
              GestureDetector(
                onTap: () {
                  save();
                  haptic(HapticStyle.light);
                },
                child: Text(_noteSaved ? t('ch.reflect.saved') : t('ch.reflect.save'),
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: AppColors.primary)),
              ),
          ],
        ),
        if (!done) ...[
          const SizedBox(height: 12),
          GoldButton(
            label: t('ch.reflect.save'),
            icon: 'check',
            onTap: text.length < 3
                ? null
                : () {
                    save();
                    FocusScope.of(context).unfocus();
                    _finishTask('reflect', v);
                  },
          ),
        ],
      ],
    );
  }
}

class _TaskCard extends StatelessWidget {
  const _TaskCard({super.key, required this.id, required this.title, required this.sub, required this.done, required this.child, this.onUndo});
  final String id;
  final String title;
  final String sub;
  final bool done;
  final Widget child;
  final VoidCallback? onUndo;

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      clipBehavior: Clip.antiAlias,
      decoration: chCard(border: done ? AppColors.primary.withValues(alpha: 0.45) : null),
      child: Stack(
        children: [
          if (done)
            Positioned(
              right: -40,
              top: -48,
              child: IgnorePointer(
                child: Container(
                  width: 144,
                  height: 144,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: RadialGradient(colors: [AppColors.primary.withValues(alpha: 0.18), AppColors.primary.withValues(alpha: 0)]),
                  ),
                ),
              ),
            ),
          Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    AnimatedContainer(
                      duration: const Duration(milliseconds: 220),
                      width: 40,
                      height: 40,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(12),
                        color: done ? AppColors.primary : AppColors.primary.withValues(alpha: 0.1),
                      ),
                      child: LucideIconLite(kTaskIcon[id]!, size: 20, strokeWidth: 1.9, color: done ? AppColors.primaryForeground : AppColors.primary),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(children: [
                            Expanded(child: Text(title, style: TextStyle(fontSize: 16, height: 1.2, fontWeight: FontWeight.w700, color: AppColors.foreground))),
                            if (id == 'reflect' && !done)
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                decoration: BoxDecoration(color: AppColors.muted.withValues(alpha: 0.6), borderRadius: BorderRadius.circular(999)),
                                child: Text(t('ch.task.optional'), style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 0.4, color: AppColors.mutedForeground)),
                              ),
                          ]),
                          const SizedBox(height: 2),
                          Text(sub, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 13, color: AppColors.mutedForeground)),
                        ],
                      ),
                    ),
                    if (done)
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(999)),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const LucideIconLite('check', size: 14, color: Colors.white, strokeWidth: 3),
                                const SizedBox(width: 4),
                                Text(t('ch.task.done'), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Colors.white)),
                              ],
                            ),
                          ),
                          if (onUndo != null) ...[
                            const SizedBox(height: 4),
                            GestureDetector(
                              onTap: onUndo,
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  LucideIconLite('rotate-ccw', size: 12, color: AppColors.mutedForeground),
                                  const SizedBox(width: 4),
                                  Text(t('ch.task.undo'), style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: AppColors.mutedForeground)),
                                ],
                              ),
                            ),
                          ],
                        ],
                      )
                    else
                      Container(
                        width: 28,
                        height: 28,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(color: AppColors.mutedForeground.withValues(alpha: 0.4), width: 2),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 12),
                child,
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Full-screen moment when a day is complete: the ship sails one day closer
/// to the cross. Always the midnight sea for contrast.
/// Web mirror: `src/components/challenge/CelebrationOverlay.tsx`.
class CelebrationView extends StatefulWidget {
  const CelebrationView({super.key, required this.result, required this.onShare});
  final CompletionResult result;
  final VoidCallback onShare;

  @override
  State<CelebrationView> createState() => _CelebrationViewState();
}

class _CelebrationViewState extends State<CelebrationView> {
  bool _arrived = false;

  @override
  Widget build(BuildContext context) {
    final result = widget.result;
    final fg = AppColors.darkForeground;
    final muted = AppColors.darkMutedForeground;
    final gold = AppColors.darkPrimary;
    final island = result.islandReached;
    final stage = stageForDay(result.day);

    Widget chip(String icon, String label, {bool solid = false, Color? iconColor}) => Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          decoration: BoxDecoration(
            color: solid ? gold : gold.withValues(alpha: 0.15),
            borderRadius: BorderRadius.circular(999),
            border: solid ? null : Border.all(color: gold.withValues(alpha: 0.3)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              LucideIconLite(icon, size: 16, color: solid ? ChInk.ctaForeground : (iconColor ?? gold)),
              const SizedBox(width: 6),
              Flexible(
                child: Text(label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: solid ? ChInk.ctaForeground : (iconColor == null ? gold : fg))),
              ),
            ],
          ),
        );

    Widget rise(int delayMs, Widget child) => TweenAnimationBuilder<double>(
          tween: Tween(begin: 0, end: 1),
          duration: Duration(milliseconds: 520 + delayMs),
          curve: Interval(delayMs / (520 + delayMs), 1, curve: Curves.easeOutCubic),
          builder: (_, v, c) => Opacity(opacity: v, child: Transform.translate(offset: Offset(0, 14 * (1 - v)), child: c)),
          child: child,
        );

    return PopScope(
      canPop: true,
      child: Scaffold(
        backgroundColor: AppColors.darkBackground,
        body: Stack(
          children: [
            Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: RadialGradient(
                    center: const Alignment(0, -0.4),
                    radius: 0.85,
                    colors: [gold.withValues(alpha: 0.18), AppColors.darkBackground.withValues(alpha: 0)],
                  ),
                ),
              ),
            ),
            SafeArea(
              child: Center(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      rise(
                        0,
                        ConstrainedBox(
                          constraints: const BoxConstraints(maxWidth: 400),
                          child: Container(
                            clipBehavior: Clip.antiAlias,
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(28),
                              border: Border.all(color: gold.withValues(alpha: 0.3)),
                              boxShadow: [BoxShadow(color: gold.withValues(alpha: 0.5), blurRadius: 70, spreadRadius: -30, offset: const Offset(0, 30))],
                            ),
                            child: VoyagePoster(
                              days: result.day,
                              fromDays: result.day - 1,
                              labels: true,
                              night: true,
                              sailDelay: const Duration(milliseconds: 550),
                              sailDuration: const Duration(milliseconds: 2000),
                              semanticLabel: t('ch.voyage.a11y', {'n': result.day}),
                              onArrive: () {
                                if (!mounted) return;
                                setState(() => _arrived = true);
                                haptic(island || result.finished ? HapticStyle.heavy : HapticStyle.medium);
                              },
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 24),
                      rise(
                        200,
                        Text(
                          result.finished ? t('ch.cele.finishedTitle') : t('ch.cele.title', {'day': result.day}),
                          textAlign: TextAlign.center,
                          style: ChInk.serif(32, color: fg, height: 1.15),
                        ),
                      ),
                      const SizedBox(height: 6),
                      rise(
                        300,
                        ConstrainedBox(
                          constraints: const BoxConstraints(maxWidth: 320),
                          child: Text(result.finished ? t('ch.cele.finishedSub') : t('ch.cele.sub'),
                              textAlign: TextAlign.center, style: TextStyle(fontSize: 15, height: 1.45, color: muted)),
                        ),
                      ),
                      const SizedBox(height: 20),
                      rise(
                        400,
                        ConstrainedBox(
                          constraints: const BoxConstraints(minHeight: 38),
                          child: Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            alignment: WrapAlignment.center,
                            children: [
                              chip('flame', t('ch.streak', {'n': result.streak})),
                              if (island && _arrived)
                                TweenAnimationBuilder<double>(
                                  tween: Tween(begin: 0.6, end: 1),
                                  duration: const Duration(milliseconds: 420),
                                  curve: Curves.easeOutBack,
                                  builder: (_, s, c) => Transform.scale(scale: s, child: c),
                                  child: chip('map-pin', t('ch.cele.island', {'island': t('ch.stage.${stage.key}')}), solid: true),
                                ),
                              if (result.graceEarned) chip('anchor', t('ch.cele.grace'), iconColor: AppColors.accent),
                            ],
                          ),
                        ),
                      ),
                      if (!result.finished) ...[
                        const SizedBox(height: 16),
                        rise(500, Text(upper(t('ch.cele.next', {'day': result.day + 1})), textAlign: TextAlign.center, style: ChInk.eyebrow(12, muted))),
                      ],
                      const SizedBox(height: 32),
                      rise(
                        550,
                        ConstrainedBox(
                          constraints: const BoxConstraints(maxWidth: 380),
                          child: Row(
                            children: [
                              Expanded(
                                child: OutlineButton(
                                  label: t('ch.cele.share'),
                                  icon: 'share-2',
                                  color: fg,
                                  borderColor: gold.withValues(alpha: 0.4),
                                  height: 52,
                                  onTap: widget.onShare,
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(child: GoldButton(label: t('ch.cele.done'), onTap: () => Navigator.of(context).pop())),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
