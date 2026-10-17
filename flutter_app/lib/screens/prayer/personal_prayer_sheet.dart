import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http/http.dart' as http;

import '../../core/env.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/services/ai_pastoral_store.dart';
import '../../core/services/haptics.dart';
import '../../core/services/share_service.dart';
import '../../core/theme/app_colors.dart';
import '../../widgets/lucide.dart';
import '../../core/theme/glass.dart';
import '../../state/app_providers.dart';
import '../../widgets/app_toast.dart';
import '../../widgets/premium_sheet.dart';
import '../today/today_shared.dart';

const _topics = <_Topic>[
  _Topic('pr.topic.anxiety', '😟'),
  _Topic('pr.topic.healing', '🌿'),
  _Topic('pr.topic.family', '🏡'),
  _Topic('pr.topic.work', '💼'),
  _Topic('pr.topic.grief', '🕊️'),
  _Topic('pr.topic.gratitude', '✨'),
  _Topic('pr.topic.guidance', '🧭'),
  _Topic('pr.topic.strength', '🔥'),
];

class _Topic {
  const _Topic(this.key, this.emoji);
  final String key;
  final String emoji;
}

/// Opens the personal prayer sheet — 1:1 of
/// `src/components/prayer/PersonalPrayerSheet.tsx`.
Future<void> showPersonalPrayerSheet(BuildContext context) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: Colors.transparent,
    barrierColor: Colors.black.withValues(alpha: 0.6),
    builder: (_) => const PersonalPrayerSheet(),
  );
}

class PersonalPrayerSheet extends ConsumerStatefulWidget {
  const PersonalPrayerSheet({super.key});

  @override
  ConsumerState<PersonalPrayerSheet> createState() =>
      _PersonalPrayerSheetState();
}

class _PersonalPrayerSheetState extends ConsumerState<PersonalPrayerSheet> {
  final _controller = TextEditingController();
  final _selected = <String>[];
  bool _loading = false;
  String? _prayer;
  late int _remaining = AiPastoralStore.remaining;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  bool get _isPremium => ref.read(premiumProvider);

  String _topicText() {
    final parts = <String>[];
    if (_selected.isNotEmpty) parts.add(_selected.join(', ').toLowerCase());
    final typed = _controller.text.trim();
    if (typed.isNotEmpty) parts.add(typed);
    return parts.join('. ');
  }

  bool get _canGenerate =>
      (_selected.isNotEmpty || _controller.text.trim().length >= 2) &&
      !_loading;

  void _reset() {
    setState(() {
      _selected.clear();
      _controller.clear();
      _prayer = null;
    });
  }

  Future<void> _close() async {
    await haptic(HapticStyle.soft);
    if (mounted) Navigator.of(context).maybePop();
  }

  Future<void> _toggleTopic(String label) async {
    await haptic(HapticStyle.soft);
    if (!mounted) return;
    setState(() {
      if (_selected.contains(label)) {
        _selected.remove(label);
      } else {
        _selected.add(label);
      }
    });
  }

  Future<void> _openPremium() async {
    await haptic(HapticStyle.soft);
    if (!mounted) return;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (sheetCtx) => PremiumSheet(
        trigger: 'personal_prayer',
        onClose: () => Navigator.of(sheetCtx).maybePop(),
        onUnlock: () {
          ref.read(premiumProvider.notifier).setUnlocked();
          Navigator.of(sheetCtx).maybePop();
        },
      ),
    );
  }

  Future<void> _generate() async {
    if (!_canGenerate) return;
    if (!_isPremium && _remaining <= 0) {
      await haptic(HapticStyle.medium);
      await _openPremium();
      return;
    }
    await haptic(HapticStyle.medium);
    if (!mounted) return;
    setState(() => _loading = true);
    final topic = _topicText();
    try {
      final resp = await http
          .post(
            Uri.parse('${Env.supabaseUrl}/functions/v1/ai-pastoral'),
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ${Env.supabaseAnonKey}',
            },
            body: jsonEncode({
              'kind': 'prayer',
              'text': topic,
              'lang': L10n.current.lang,
            }),
            // Never let a stalled function pin the sheet in its loading state.
          )
          .timeout(const Duration(seconds: 25));
      if (resp.statusCode < 200 || resp.statusCode >= 300) {
        String? message;
        try {
          message = (jsonDecode(resp.body) as Map)['error'] as String?;
        } catch (_) {}
        if (mounted) {
          AppToast.error(context, message ?? t('pr.personal.toast.genError'));
          setState(() => _loading = false);
        }
        return;
      }
      final content = '${(jsonDecode(resp.body) as Map)['content'] ?? ''}';
      await AiPastoralStore.save(topic, content);
      final left = _isPremium ? _remaining : await AiPastoralStore.consume();
      await haptic(HapticStyle.heavy);
      if (mounted) {
        setState(() {
          _prayer = content;
          _remaining = left;
        });
      }
    } catch (_) {
      if (mounted) AppToast.error(context, t('pr.personal.toast.connError'));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _copy() async {
    final p = _prayer;
    if (p == null) return;
    await haptic(HapticStyle.soft);
    try {
      await Clipboard.setData(ClipboardData(text: p));
      if (mounted) AppToast.success(context, t('pr.personal.toast.copied'));
    } catch (_) {
      if (mounted) AppToast.error(context, t('pr.personal.toast.copyError'));
    }
  }

  Future<void> _share() async {
    final p = _prayer;
    if (p == null) return;
    await haptic(HapticStyle.soft);
    await ShareService.share(
      title: t('pr.personal.shareTitle'),
      text:
          '$p\n\n━━━━━━━\n✝️ Made with Prayly: Bible Prayer & Verse\n'
          '$kAppPlayStoreUrl',
      dialogTitle: t('pr.personal.shareDialogTitle'),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isPremium = ref.watch(premiumProvider);
    final maxH = MediaQuery.sizeOf(context).height * 0.92;

    return Container(
      constraints: BoxConstraints(maxHeight: maxH),
      decoration: BoxDecoration(
        color: AppColors.background,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
        border: Border(
          top: BorderSide(color: AppColors.primary.withValues(alpha: 0.25)),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.4),
            blurRadius: 60,
            offset: const Offset(0, -20),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Drag handle
          Padding(
            padding: const EdgeInsets.only(top: 10, bottom: 4),
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.foreground.withValues(alpha: 0.25),
                borderRadius: BorderRadius.circular(999),
              ),
            ),
          ),
          _header(isPremium),
          Flexible(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
              child: _prayer == null ? _composer(isPremium) : _result(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _header(bool isPremium) {
    final badge = isPremium
        ? t('pr.personal.badge.unlimited')
        : _remaining > 0
        ? t('pr.personal.badge.free')
        : t('pr.personal.badge.unlock');
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 4, 20, 12),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [hsl(42, 95, 55), hsl(38, 100, 50)],
              ),
              boxShadow: [
                BoxShadow(
                  color: hsl(42, 90, 50).withValues(alpha: 0.5),
                  blurRadius: 16,
                  spreadRadius: -6,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            child: Icon(Icons.star_rounded, size: 18, color: hsl(222, 55, 14)),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  t('pr.personal.title'),
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w900,
                    letterSpacing: -0.16,
                    height: 1,
                    color: AppColors.foreground,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  badge.toUpperCase(),
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.6,
                    color: AppColors.foreground.withValues(alpha: 0.55),
                  ),
                ),
              ],
            ),
          ),
          TapScale(
            onTap: _close,
            child: GlassPanel(
              radius: 16,
              child: SizedBox(
                width: 36,
                height: 36,
                child: LucideIcon('x', size: 16, color: AppColors.foreground),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _label(String text) => Padding(
    padding: const EdgeInsets.only(bottom: 10),
    child: Text(
      text.toUpperCase(),
      style: TextStyle(
        fontSize: 10,
        fontWeight: FontWeight.w800,
        letterSpacing: 2.2,
        color: AppColors.foreground.withValues(alpha: 0.55),
      ),
    ),
  );

  Widget _composer(bool isPremium) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 16),
          child: Text(
            t('pr.personal.intro'),
            style: TextStyle(
              fontSize: 13,
              height: 1.55,
              color: AppColors.foreground.withValues(alpha: 0.75),
            ),
          ),
        ),
        _label(t('pr.personal.whatNeed')),
        Wrap(
          spacing: 6,
          runSpacing: 6,
          children: [for (final topic in _topics) _topicChip(topic)],
        ),
        const SizedBox(height: 20),
        _label(t('pr.personal.orShare')),
        GlassPanel(
          radius: 16,
          padding: const EdgeInsets.all(14),
          child: TextField(
            controller: _controller,
            maxLines: 4,
            minLines: 4,
            maxLength: 500,
            onChanged: (_) => setState(() {}),
            style: TextStyle(
              fontSize: 14,
              height: 1.5,
              color: AppColors.foreground,
            ),
            decoration: InputDecoration(
              isDense: true,
              counterText: '',
              border: InputBorder.none,
              hintText: t('pr.personal.placeholder'),
              hintStyle: TextStyle(
                fontSize: 14,
                color: AppColors.foreground.withValues(alpha: 0.4),
              ),
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.only(top: 4),
          child: Align(
            alignment: Alignment.centerRight,
            child: Text(
              t('pr.personal.charCount', {
                'count': '${_controller.text.length}',
              }),
              style: TextStyle(
                fontSize: 10,
                color: AppColors.foreground.withValues(alpha: 0.4),
              ),
            ),
          ),
        ),
        const SizedBox(height: 16),
        Opacity(
          opacity: _canGenerate ? 1 : 0.4,
          child: TapScale(
            scale: 0.97,
            onTap: _generate,
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 14),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [AppColors.primary, hsl(42, 95, 55)],
                ),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.primary.withValues(alpha: 0.55),
                    blurRadius: 28,
                    spreadRadius: -10,
                    offset: const Offset(0, 12),
                  ),
                ],
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  if (_loading)
                    SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                        strokeWidth: 2.5,
                        color: AppColors.primaryForeground,
                      ),
                    )
                  else
                    Icon(
                      Icons.star_rounded,
                      size: 16,
                      color: AppColors.primaryForeground,
                    ),
                  const SizedBox(width: 8),
                  Text(
                    _loading
                        ? t('pr.personal.writing')
                        : t('pr.personal.write'),
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.2,
                      color: AppColors.primaryForeground,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        if (!isPremium && _remaining == 0)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: TapScale(
              onTap: _openPremium,
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 10),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  color: AppColors.primary.withValues(alpha: 0.08),
                  border: Border.all(
                    color: AppColors.primary.withValues(alpha: 0.25),
                  ),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    LucideIcon('crown', size: 14, color: AppColors.primary),
                    const SizedBox(width: 6),
                    Text(
                      t('pr.personal.unlockUnlimited'),
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: AppColors.primary,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }

  Widget _topicChip(_Topic topic) {
    final label = t(topic.key);
    final on = _selected.contains(label);
    return TapScale(
      onTap: () => _toggleTopic(label),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(999),
          gradient: on
              ? LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [AppColors.glassRaised, AppColors.glassSoft],
                )
              : null,
          color: on ? null : AppColors.card,
          border: Border.all(
            color: on
                ? AppColors.primary.withValues(alpha: 0.55)
                : AppColors.glassBorder,
          ),
          boxShadow: on
              ? [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.4),
                    blurRadius: 12,
                    spreadRadius: -4,
                    offset: const Offset(0, 4),
                  ),
                ]
              : null,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(topic.emoji, style: const TextStyle(fontSize: 12.5)),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w700,
                color: on
                    ? AppColors.primary
                    : AppColors.foreground.withValues(alpha: 0.85),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _result() {
    return FadeRise(
      offsetY: 12,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(24),
              color: AppColors.glass,
              border: Border.all(color: AppColors.goldBorder),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.58),
                  blurRadius: 26,
                  spreadRadius: -14,
                  offset: const Offset(0, 10),
                ),
              ],
            ),
            child: Stack(
              children: [
                Positioned(
                  left: 0,
                  top: -26,
                  child: Text(
                    '“',
                    style: TextStyle(
                      fontSize: 80,
                      height: 1,
                      fontFamily: kSerif,
                      fontFamilyFallback: kSerifFallback,
                      color: AppColors.primary.withValues(alpha: 0.3),
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.only(left: 12),
                  child: Text(
                    _prayer ?? '',
                    style: TextStyle(
                      fontSize: 15.5,
                      height: 1.7,
                      fontFamily: kSerif,
                      fontFamilyFallback: kSerifFallback,
                      color: AppColors.foreground.withValues(alpha: 0.95),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _actionBtn(
                  Icons.content_copy_rounded,
                  t('pr.personal.action.copy'),
                  _copy,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _actionBtn(
                  Icons.ios_share_rounded,
                  t('pr.personal.action.share'),
                  _share,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _actionBtn(
                  Icons.favorite_rounded,
                  t('pr.personal.action.saved'),
                  () async {
                    await haptic(HapticStyle.soft);
                    if (mounted) {
                      AppToast.success(context, t('pr.personal.toast.saved'));
                    }
                  },
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          TapScale(
            onTap: () async {
              await haptic(HapticStyle.soft);
              _reset();
            },
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 12),
              alignment: Alignment.center,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                color: AppColors.primary.withValues(alpha: 0.08),
                border: Border.all(
                  color: AppColors.primary.withValues(alpha: 0.25),
                ),
              ),
              child: Text(
                t('pr.personal.writeAnother'),
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: AppColors.primary,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _actionBtn(IconData icon, String label, VoidCallback onTap) {
    return TapScale(
      onTap: onTap,
      child: GlassPanel(
        radius: 16,
        padding: const EdgeInsets.symmetric(vertical: 10),
        child: Column(
          children: [
            Icon(icon, size: 16, color: AppColors.primary),
            const SizedBox(height: 4),
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 10.5,
                fontWeight: FontWeight.w700,
                color: AppColors.foreground.withValues(alpha: 0.85),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
