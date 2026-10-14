import 'package:flutter/material.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/services/analytics.dart';
import '../../core/services/challenge_circle_service.dart';
import '../../core/services/haptics.dart';
import '../../core/services/share_service.dart';
import '../../core/theme/app_colors.dart';
import 'challenge_widgets.dart';
import 'journey_avatar.dart';

/// Journey buddies — friends on the same road, one tap to pray for them.
/// Web mirror: `src/components/challenge/JourneyBuddies.tsx`.
class JourneyBuddies extends StatefulWidget {
  const JourneyBuddies({super.key, required this.onJoin, required this.onNeedProfile, required this.isPremium});
  final VoidCallback onJoin;
  final VoidCallback onNeedProfile;
  final bool isPremium;

  @override
  State<JourneyBuddies> createState() => _JourneyBuddiesState();
}

class _JourneyBuddiesState extends State<JourneyBuddies> {
  bool _busy = false;
  final _prayed = <String>{};
  final _nudged = <String>{};

  @override
  void initState() {
    super.initState();
    ChallengeCircleService.revision.addListener(_refresh);
    if (ChallengeCircleService.identity != null) {
      ChallengeCircleService.fetchOverview().catchError((_) => const CircleOverview([], [], {}));
    }
  }

  @override
  void dispose() {
    ChallengeCircleService.revision.removeListener(_refresh);
    super.dispose();
  }

  void _refresh() { if (mounted) setState(() {}); }

  void _error() {
    ScaffoldMessenger.maybeOf(context)?.showSnackBar(SnackBar(content: Text(t('ch.buddy.err'))));
  }

  Future<void> _invite(int count) async {
    haptic(HapticStyle.light);
    if (ChallengeCircleService.identity == null) { widget.onNeedProfile(); return; }
    setState(() => _busy = true);
    try {
      final code = await ChallengeCircleService.myBuddyCode();
      Analytics.capture('challenge_invite_tapped', {'buddies': count});
      await ShareService.share(title: t('ch.name'), text: t('ch.buddy.msg', {'code': code}), dialogTitle: t('ch.invite.cta'));
    } catch (_) {
      _error();
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _pray(CircleMember m, String circleId) async {
    haptic(HapticStyle.medium);
    setState(() => _prayed.add(m.id));
    try {
      await ChallengeCircleService.sendCheer(circleId, m.id, 'pray');
      Analytics.capture('challenge_buddy_prayed', const {});
      ChallengeCircleService.fetchOverview().catchError((_) => const CircleOverview([], [], {}));
    } catch (_) {
      if (mounted) setState(() => _prayed.remove(m.id));
      _error();
    }
  }

  Future<void> _remind(CircleMember m, String circleId) async {
    haptic(HapticStyle.light);
    setState(() => _nudged.add(m.id));
    try {
      await ChallengeCircleService.sendCheer(circleId, m.id, 'nudge');
      Analytics.capture('challenge_buddy_nudged', const {});
      if (mounted) {
        ScaffoldMessenger.maybeOf(context)?.showSnackBar(SnackBar(content: Text(t('ch.buddy.remindSent', {'name': m.name}))));
      }
      ChallengeCircleService.fetchOverview().catchError((_) => const CircleOverview([], [], {}));
    } catch (_) {
      if (mounted) setState(() => _nudged.remove(m.id));
      _error();
    }
  }

  @override
  Widget build(BuildContext context) {
    final overview = ChallengeCircleService.cached;
    final buddies = ChallengeCircleService.buddies(overview);
    final cheer = (overview?.cheers.isNotEmpty ?? false) ? overview!.cheers.first : null;
    final gold = AppColors.primary;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: gold.withValues(alpha: 0.25)),
        boxShadow: [BoxShadow(color: gold.withValues(alpha: 0.12), blurRadius: 32, offset: const Offset(0, 14))],
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        if (cheer != null) ...[
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(color: gold.withValues(alpha: 0.10), borderRadius: BorderRadius.circular(16), border: Border.all(color: gold.withValues(alpha: 0.25))),
            child: Row(children: [
              ClipOval(child: JourneyAvatar(avatar: cheer.fromAvatar, size: 36)),
              const SizedBox(width: 12),
              Expanded(child: Text(t('ch.buddy.${cheer.kind}.got', {'name': cheer.fromName}),
                  style: TextStyle(fontSize: 13, height: 1.35, fontWeight: FontWeight.w500, color: AppColors.foreground))),
              TextButton(
                onPressed: () { haptic(HapticStyle.light); ChallengeCircleService.markCheersSeen([cheer.id]).catchError((_) {}); },
                child: Text(t('ch.buddy.amen'), style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: gold)),
              ),
            ]),
          ),
          const SizedBox(height: 12),
        ],
        if (buddies.isEmpty)
          Column(children: [
            SizedBox(width: 100, height: 56, child: Stack(children: [
              Positioned(left: 0, child: Stack(clipBehavior: Clip.none, children: [
                _ring(ClipOval(child: JourneyAvatar(avatar: ChallengeCircleService.identity?.avatar ?? '🐑', size: 56))),
                if (widget.isPremium) Positioned(left: -2, bottom: -4, child: _proBadge()),
              ])),
              Positioned(right: 0, child: _ring(Container(
                width: 56, height: 56, alignment: Alignment.center,
                decoration: BoxDecoration(shape: BoxShape.circle, color: gold.withValues(alpha: 0.06), border: Border.all(color: gold.withValues(alpha: 0.5), width: 2)),
                child: Text('+', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w300, color: gold)),
              ))),
            ])),
            const SizedBox(height: 12),
            Text(t('ch.buddy.emptyTitle'), textAlign: TextAlign.center, style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: AppColors.foreground)),
            const SizedBox(height: 4),
            Text(t('ch.buddy.emptySub'), textAlign: TextAlign.center, style: TextStyle(fontSize: 13, height: 1.5, color: AppColors.mutedForeground)),
          ])
        else ...[
          Text('${t('ch.buddy.title')} · ${buddies.length}'.toUpperCase(),
              style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, letterSpacing: 1.8, color: gold)),
          const SizedBox(height: 4),
          for (final (m, circleId) in buddies.take(8)) _row(m, circleId),
        ],
        const SizedBox(height: 16),
        SizedBox(
          height: 48,
          child: FilledButton.icon(
            onPressed: _busy ? null : () => _invite(buddies.length),
            style: FilledButton.styleFrom(backgroundColor: gold, foregroundColor: AppColors.primaryForeground, shape: const StadiumBorder()),
            icon: LucideIconLite('share-2', size: 16, color: AppColors.primaryForeground),
            label: Text(t('ch.invite.cta'), style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
          ),
        ),
        const SizedBox(height: 8),
        Text(t('ch.invite.verse'), textAlign: TextAlign.center, style: TextStyle(fontSize: 11.5, color: AppColors.mutedForeground)),
        TextButton(
          onPressed: () { haptic(HapticStyle.light); widget.onJoin(); },
          child: Text(t('ch.buddy.haveCode'), style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.mutedForeground)),
        ),
      ]),
    );
  }

  Widget _ring(Widget child) => Container(
        decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: AppColors.card, width: 3)),
        child: child,
      );

  Widget _row(CircleMember m, String circleId) {
    final gold = AppColors.primary;
    final done = m.sentToday.contains('pray') || _prayed.contains(m.id);
    final didNudge = m.sentToday.contains('nudge') || _nudged.contains(m.id);
    final frac = (m.completedDays / 75).clamp(0.0, 1.0);
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10),
      decoration: BoxDecoration(border: Border(top: BorderSide(color: AppColors.border))),
      child: Row(children: [
        SizedBox(width: 44, height: 44, child: Stack(clipBehavior: Clip.none, children: [
          Container(
            decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: AppColors.border, width: 2)),
            child: ClipOval(child: JourneyAvatar(avatar: m.avatar, size: 40)),
          ),
          if (m.litToday)
            Positioned(right: -2, bottom: -2, child: Container(
              width: 16, height: 16, alignment: Alignment.center,
              decoration: BoxDecoration(shape: BoxShape.circle, color: gold, border: Border.all(color: AppColors.card, width: 2)),
              child: Icon(Icons.check, size: 10, color: AppColors.primaryForeground),
            )),
        ])),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Flexible(child: Text(m.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w600, color: AppColors.foreground))),
            if (m.isPro) ...[const SizedBox(width: 6), _proBadge()],
          ]),
          const SizedBox(height: 4),
          Row(children: [
            Expanded(child: ClipRRect(
              borderRadius: BorderRadius.circular(99),
              child: LinearProgressIndicator(value: frac, minHeight: 6, backgroundColor: AppColors.muted, color: gold),
            )),
            const SizedBox(width: 8),
            Text('${t('ch.buddy.day', {'n': m.completedDays})} · ${m.litToday ? t('ch.buddy.done') : t('ch.buddy.notYet')}',
                style: TextStyle(fontSize: 11.5, color: AppColors.mutedForeground)),
          ]),
        ])),
        const SizedBox(width: 10),
        if (!m.litToday) ...[
          Tooltip(
            message: didNudge ? t('ch.buddy.reminded') : t('ch.buddy.remind'),
            child: SizedBox(width: 36, height: 36, child: OutlinedButton(
              onPressed: didNudge ? null : () => _remind(m, circleId),
              style: OutlinedButton.styleFrom(
                padding: EdgeInsets.zero, shape: const CircleBorder(), side: BorderSide(color: AppColors.border),
                foregroundColor: AppColors.mutedForeground,
              ),
              child: didNudge
                  ? Icon(Icons.check, size: 14, color: AppColors.mutedForeground)
                  : Icon(Icons.notifications_none_rounded, size: 15, color: AppColors.mutedForeground),
            )),
          ),
          const SizedBox(width: 6),
        ],
        OutlinedButton.icon(
          onPressed: done ? null : () => _pray(m, circleId),
          style: OutlinedButton.styleFrom(
            foregroundColor: gold, shape: const StadiumBorder(), side: BorderSide(color: gold.withValues(alpha: 0.4)),
            padding: const EdgeInsets.symmetric(horizontal: 12), minimumSize: const Size(0, 36),
          ),
          icon: done ? Icon(Icons.check, size: 14, color: gold) : LucideIconLite('hand-heart', size: 14, color: gold),
          label: Text(done ? t('ch.buddy.prayed') : t('ch.buddy.pray'), style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700)),
        ),
      ]),
    );
  }

  Widget _proBadge() => Container(
    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
    decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.14), borderRadius: BorderRadius.circular(99), border: Border.all(color: AppColors.primary.withValues(alpha: 0.35))),
    child: Text('PRO', style: TextStyle(fontSize: 8, fontWeight: FontWeight.w900, color: AppColors.primary)),
  );
}
