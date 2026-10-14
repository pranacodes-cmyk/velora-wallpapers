import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/services/analytics.dart';
import '../../core/services/challenge_circle_service.dart';
import '../../core/services/challenge_data.dart';
import '../../core/services/challenge_store.dart';
import '../../core/services/haptics.dart';
import '../../core/services/share_service.dart';
import '../../core/theme/app_colors.dart';
import '../../state/app_providers.dart';
import '../../widgets/app_toast.dart';
import 'challenge_sheets.dart';
import 'challenge_widgets.dart';

/// Family & friend circles: shared flame, leaderboard, cheers, invite.
/// Web mirror: `src/pages/ChallengeCircle.tsx`.
class ChallengeCircleScreen extends ConsumerStatefulWidget {
  const ChallengeCircleScreen({super.key, this.circleId, this.joinCode = ''});
  final String? circleId;
  final String joinCode;

  @override
  ConsumerState<ChallengeCircleScreen> createState() => _ChallengeCircleScreenState();
}

class _ChallengeCircleScreenState extends ConsumerState<ChallengeCircleScreen> with WidgetsBindingObserver {
  String? _selected;
  bool _loading = false;
  String? _error;
  bool _confirmLeave = false;

  @override
  void initState() {
    super.initState();
    _selected = widget.circleId;
    WidgetsBinding.instance.addObserver(this);
    ChallengeCircleService.revision.addListener(_onChange);
    ChallengeStore.revision.addListener(_onChallenge);
    Analytics.capture('challenge_circle_viewed', {'circles': ChallengeCircleService.cached?.circles.length ?? 0});
    _refresh();
    if (widget.joinCode.isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _flow('join', code: widget.joinCode));
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    ChallengeCircleService.revision.removeListener(_onChange);
    ChallengeStore.revision.removeListener(_onChallenge);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _refresh();
  }

  void _onChange() {
    if (mounted) setState(() {});
  }

  void _onChallenge() => ChallengeCircleService.scheduleProgressSync();

  Future<void> _refresh() async {
    if (ChallengeCircleService.identity == null) return;
    setState(() => _loading = true);
    try {
      await ChallengeCircleService.fetchOverview();
      _error = null;
    } catch (e) {
      _error = circleErrorKey(e);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _flow(String flow, {String code = ''}) async {
    final id = await showCircleFlow(context, flow, lang: ref.read(languageProvider), initialCode: code);
    if (id != null && mounted) setState(() => _selected = id);
  }

  @override
  Widget build(BuildContext context) {
    final overview = ChallengeCircleService.cached;
    final circles = overview?.circles ?? const <Circle>[];
    Circle? circle;
    for (final c in circles) {
      if (c.id == _selected) circle = c;
    }
    circle ??= circles.isNotEmpty ? circles.first : null;
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
                  child: Text(t('ch.circle.title'), textAlign: TextAlign.center, maxLines: 1, overflow: TextOverflow.ellipsis, style: ChInk.serif(19)),
                ),
                RoundIconButton(icon: 'plus', label: t('ch.circle.add'), onTap: () => _flow('create')),
              ],
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              color: AppColors.primary,
              onRefresh: _refresh,
              child: ListView(
                padding: EdgeInsets.fromLTRB(16, 8, 16, 40 + pad.bottom),
                children: [
                  if (circles.length > 1) ...[
                    SizedBox(
                      height: 40,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        itemCount: circles.length,
                        separatorBuilder: (_, __) => const SizedBox(width: 8),
                        itemBuilder: (_, i) {
                          final c = circles[i];
                          final active = c.id == circle?.id;
                          return GestureDetector(
                            onTap: () {
                              haptic(HapticStyle.light);
                              setState(() {
                                _selected = c.id;
                                _confirmLeave = false;
                              });
                            },
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 14),
                              alignment: Alignment.center,
                              decoration: BoxDecoration(
                                color: active ? AppColors.primary.withValues(alpha: 0.15) : Colors.transparent,
                                borderRadius: BorderRadius.circular(999),
                                border: Border.all(color: active ? AppColors.primary : AppColors.border.withValues(alpha: 0.7)),
                              ),
                              child: ConstrainedBox(
                                constraints: const BoxConstraints(maxWidth: 170),
                                child: Text('${c.emoji}  ${c.name}',
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(
                                      fontSize: 13.5,
                                      fontWeight: FontWeight.w700,
                                      color: active ? AppColors.foreground : AppColors.mutedForeground,
                                    )),
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],
                  if (circle == null) _empty() else ..._circle(circle),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _empty() => Container(
        clipBehavior: Clip.antiAlias,
        decoration: chCard(),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SizedBox(height: 176, child: Image.asset(kCircleArt, fit: BoxFit.cover)),
            Padding(
              padding: const EdgeInsets.all(20),
              child: _loading && ChallengeCircleService.identity != null
                  ? Row(
                      children: [
                        SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary)),
                        const SizedBox(width: 10),
                        Text(t('ch.circle.loading'), style: TextStyle(fontSize: 14, color: AppColors.mutedForeground)),
                      ],
                    )
                  : Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(t('ch.circle.empty.t'), style: ChInk.serif(22)),
                        const SizedBox(height: 4),
                        Text(t('ch.circle.empty.s'), style: TextStyle(fontSize: 14, height: 1.35, color: AppColors.mutedForeground)),
                        if (_error != null) ...[
                          const SizedBox(height: 12),
                          GestureDetector(
                            onTap: _refresh,
                            child: Text('${t(_error!)}  ${t('ch.circle.retry')}',
                                style: TextStyle(fontSize: 13, color: AppColors.destructive, fontWeight: FontWeight.w600)),
                          ),
                        ],
                        const SizedBox(height: 16),
                        Row(
                          children: [
                            Expanded(child: GoldButton(label: t('ch.circle.create'), height: 48, fontSize: 14, onTap: () => _flow('create'))),
                            const SizedBox(width: 8),
                            Expanded(child: OutlineButton(label: t('ch.circle.join'), onTap: () => _flow('join'))),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Text(t('ch.circle.privacy'), style: TextStyle(fontSize: 12, height: 1.35, color: AppColors.mutedForeground)),
                      ],
                    ),
            ),
          ],
        ),
      );

  List<Widget> _circle(Circle circle) {
    final ranked = [...circle.members]..sort((a, b) {
        final d = b.completedDays.compareTo(a.completedDays);
        if (d != 0) return d;
        final s = b.streak.compareTo(a.streak);
        if (s != 0) return s;
        return (b.litToday ? 1 : 0).compareTo(a.litToday ? 1 : 0);
      });
    return [
      Container(
        clipBehavior: Clip.antiAlias,
        padding: const EdgeInsets.all(20),
        decoration: chCard(radius: 28, border: AppColors.primary.withValues(alpha: 0.3)),
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            Positioned(
              right: -84,
              top: -84,
              child: IgnorePointer(
                child: Container(
                  width: 192,
                  height: 192,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: RadialGradient(colors: [AppColors.primary.withValues(alpha: 0.22), AppColors.primary.withValues(alpha: 0)]),
                  ),
                ),
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Container(
                      width: 56,
                      height: 56,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(16)),
                      child: Text(circle.emoji, style: const TextStyle(fontSize: 28)),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(circle.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: ChInk.serif(23)),
                          const SizedBox(height: 2),
                          Text(
                            '${t('ch.circle.members', {'n': circle.members.length})} · ${t('ch.circle.litToday', {'n': circle.litToday, 'total': circle.members.length})}',
                            style: TextStyle(fontSize: 13, color: AppColors.mutedForeground),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    LucideIconLite('flame', size: 16, color: AppColors.primary),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(t('ch.circle.flame'), style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: AppColors.foreground)),
                    ),
                    Text(t('ch.circle.flameSub', {'days': circle.totalDays}), style: TextStyle(fontSize: 12.5, color: AppColors.mutedForeground)),
                  ],
                ),
                const SizedBox(height: 8),
                ClipRRect(
                  borderRadius: BorderRadius.circular(999),
                  child: Stack(
                    children: [
                      Container(height: 10, color: AppColors.muted),
                      FractionallySizedBox(
                        widthFactor: math.max(0.02, circle.flame).clamp(0.0, 1.0),
                        child: Container(
                          height: 10,
                          decoration: BoxDecoration(
                            gradient: LinearGradient(colors: [const Color(0xFFFBBF24), ChInk.gold, const Color(0xFFFEF08A)]),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                SizedBox(
                  height: 36,
                  child: Stack(
                    children: [
                      for (var i = 0; i < circle.members.length && i < 10; i++)
                        Positioned(
                          left: i * 28.0,
                          child: Container(
                            width: 36,
                            height: 36,
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: circle.members[i].litToday ? AppColors.primary.withValues(alpha: 0.3) : AppColors.muted,
                              border: Border.all(color: AppColors.card, width: 2),
                            ),
                            child: Opacity(
                              opacity: circle.members[i].litToday ? 1 : 0.7,
                              child: Text(circle.members[i].avatar, style: const TextStyle(fontSize: 16)),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
      const SizedBox(height: 16),
      Container(
        padding: const EdgeInsets.all(16),
        decoration: chCard(radius: 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(upper(t('ch.circle.code')), style: ChInk.eyebrow(11, AppColors.mutedForeground)),
                      const SizedBox(height: 2),
                      Text(circle.code,
                          style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800, letterSpacing: 6, fontFamily: 'monospace', color: AppColors.foreground)),
                    ],
                  ),
                ),
                RoundIconButton(
                  icon: 'copy',
                  label: t('ch.circle.copy'),
                  onTap: () async {
                    await Clipboard.setData(ClipboardData(text: circle.code));
                    haptic(HapticStyle.light);
                    if (mounted) AppToast.success(context, t('ch.circle.copied'));
                  },
                ),
              ],
            ),
            const SizedBox(height: 12),
            GoldButton(
              label: t('ch.circle.invite'),
              icon: 'share-2',
              onTap: () {
                haptic(HapticStyle.light);
                Analytics.capture('challenge_invite_shared', {'members': circle.members.length});
                ShareService.share(title: t('ch.name'), text: t('ch.invite.share', {'name': circle.name, 'code': circle.code}), includeAppLink: true);
              },
            ),
          ],
        ),
      ),
      const SizedBox(height: 16),
      for (var i = 0; i < ranked.length; i++) ...[
        _MemberRow(member: ranked[i], rank: i + 1, circleId: circle.id, onSent: _refresh),
        const SizedBox(height: 10),
      ],
      const SizedBox(height: 8),
      if (!_confirmLeave)
        GestureDetector(
          onTap: () => setState(() => _confirmLeave = true),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                LucideIconLite('log-out', size: 16, color: AppColors.mutedForeground),
                const SizedBox(width: 8),
                Text(t('ch.circle.leave'), style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: AppColors.mutedForeground)),
              ],
            ),
          ),
        )
      else
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.destructive.withValues(alpha: 0.05),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.destructive.withValues(alpha: 0.4)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(t('ch.circle.leaveConfirm', {'name': circle.name}), style: TextStyle(fontSize: 14, color: AppColors.foreground)),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(child: OutlineButton(label: t('ch.circle.cancel'), height: 42, onTap: () => setState(() => _confirmLeave = false))),
                  const SizedBox(width: 8),
                  Expanded(
                    child: GestureDetector(
                      onTap: () => _leave(circle),
                      child: Container(
                        height: 42,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(color: AppColors.destructive, borderRadius: BorderRadius.circular(999)),
                        child: Text(t('ch.circle.leave'), style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Colors.white)),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
    ];
  }

  Future<void> _leave(Circle circle) async {
    try {
      final next = await ChallengeCircleService.leaveCircle(circle.id);
      Analytics.capture('challenge_circle_left');
      if (!mounted) return;
      setState(() {
        _selected = null;
        _confirmLeave = false;
      });
      if (next.circles.isEmpty) Navigator.of(context).maybePop();
    } catch (e) {
      if (mounted) AppToast.error(context, t(circleErrorKey(e)));
    }
  }
}

class _MemberRow extends StatefulWidget {
  const _MemberRow({required this.member, required this.rank, required this.circleId, required this.onSent});
  final CircleMember member;
  final int rank;
  final String circleId;
  final Future<void> Function() onSent;

  @override
  State<_MemberRow> createState() => _MemberRowState();
}

class _MemberRowState extends State<_MemberRow> {
  String? _busy;
  late Set<String> _sent = {...widget.member.sentToday};

  @override
  void didUpdateWidget(covariant _MemberRow old) {
    super.didUpdateWidget(old);
    _sent = {..._sent, ...widget.member.sentToday};
  }

  Future<void> _cheer(String kind) async {
    if (_busy != null || _sent.contains(kind)) return;
    setState(() => _busy = kind);
    haptic(HapticStyle.light);
    try {
      await ChallengeCircleService.sendCheer(widget.circleId, widget.member.id, kind);
      if (!mounted) return;
      setState(() => _sent = {..._sent, kind});
      Analytics.capture('challenge_cheer_sent', {'kind': kind});
      AppToast.success(context, t('ch.cheer.sent', {'name': widget.member.name}));
      widget.onSent();
    } catch (e) {
      if (mounted) AppToast.error(context, t(circleErrorKey(e)));
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final m = widget.member;
    final lamp = kLamps[lampTierFor(m.completedDays)];
    final status = !m.started
        ? t('ch.circle.notStarted')
        : m.litToday
            ? t('ch.circle.lit')
            : t('ch.circle.progress', {'n': m.todayDone});
    const cheers = [('cheer', 'thumbs-up', 'ch.circle.cheer'), ('pray', 'hand-heart', 'ch.circle.pray'), ('nudge', 'bell-ring', 'ch.circle.nudge')];
    final options = cheers.where((c) => c.$1 != 'nudge' || (m.started && !m.litToday)).toList();

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: m.isMe ? AppColors.primary.withValues(alpha: 0.07) : AppColors.card,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: m.isMe ? AppColors.primary.withValues(alpha: 0.45) : AppColors.border.withValues(alpha: 0.6)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              SizedBox(
                width: 20,
                child: Text('${widget.rank}', textAlign: TextAlign.center, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: AppColors.mutedForeground)),
              ),
              const SizedBox(width: 10),
              SizedBox(
                width: 44,
                height: 44,
                child: Stack(
                  clipBehavior: Clip.none,
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(shape: BoxShape.circle, color: AppColors.muted),
                      child: Text(m.avatar, style: const TextStyle(fontSize: 20)),
                    ),
                    if (m.litToday)
                      Positioned(
                        right: -2,
                        bottom: -2,
                        child: Container(
                          width: 20,
                          height: 20,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: AppColors.primary,
                            border: Border.all(color: AppColors.card, width: 2),
                          ),
                          child: const LucideIconLite('flame', size: 11, color: Colors.white),
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text.rich(
                      TextSpan(children: [
                        TextSpan(text: m.name),
                        if (m.isMe) TextSpan(text: '  · ${t('ch.circle.you')}', style: TextStyle(fontSize: 12, color: AppColors.primary)),
                      ]),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.foreground),
                    ),
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        Text(t('ch.day', {'day': m.completedDays}), style: TextStyle(fontSize: 12.5, color: AppColors.mutedForeground)),
                        if (m.streak > 0) ...[
                          const SizedBox(width: 8),
                          const LucideIconLite('flame', size: 12, color: Color(0xFFFB923C)),
                          Text('${m.streak}', style: TextStyle(fontSize: 12.5, color: AppColors.mutedForeground)),
                        ],
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(status,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontSize: 12.5,
                                fontWeight: m.litToday ? FontWeight.w700 : FontWeight.w400,
                                color: m.litToday ? AppColors.primary : AppColors.mutedForeground,
                              )),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              Opacity(
                opacity: m.started ? 1 : 0.35,
                child: SizedBox(width: 48, height: 32, child: Image.asset(lamp.asset, fit: BoxFit.contain)),
              ),
            ],
          ),
          const SizedBox(height: 10),
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: Stack(
              children: [
                Container(height: 6, color: AppColors.muted),
                FractionallySizedBox(
                  widthFactor: (m.completedDays / 75).clamp(0.0, 1.0),
                  child: Container(height: 6, decoration: BoxDecoration(gradient: LinearGradient(colors: [ChInk.gold, ChInk.goldGlow]))),
                ),
              ],
            ),
          ),
          if (!m.isMe) ...[
            const SizedBox(height: 12),
            Row(
              children: [
                for (var i = 0; i < options.length; i++) ...[
                  if (i > 0) const SizedBox(width: 8),
                  Expanded(child: _cheerButton(options[i].$1, options[i].$2, options[i].$3)),
                ],
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _cheerButton(String kind, String icon, String label) {
    final done = _sent.contains(kind);
    final color = done ? AppColors.primary : AppColors.foreground;
    return GestureDetector(
      onTap: done || _busy != null ? null : () => _cheer(kind),
      child: Container(
        height: 36,
        padding: const EdgeInsets.symmetric(horizontal: 8),
        decoration: BoxDecoration(
          color: done ? AppColors.primary.withValues(alpha: 0.1) : Colors.transparent,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: done ? AppColors.primary.withValues(alpha: 0.4) : AppColors.border.withValues(alpha: 0.7)),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (_busy == kind)
              SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary))
            else
              LucideIconLite(done ? 'check' : icon, size: 14, color: color),
            const SizedBox(width: 6),
            Flexible(
              child: Text(done ? t('ch.circle.sent') : t(label),
                  maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: color)),
            ),
          ],
        ),
      ),
    );
  }
}
