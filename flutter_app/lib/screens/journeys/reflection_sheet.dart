import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http/http.dart' as http;

import '../../core/env.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/services/haptics.dart';
import '../../core/theme/app_colors.dart';
import '../../widgets/lucide.dart';
import '../../core/theme/glass.dart';
import '../../state/app_providers.dart';
import '../../widgets/app_toast.dart';
import '../../widgets/premium_sheet.dart';
import '../bible_chat/bible_chat_widgets.dart' show BibleChatMarkdown;
import '../today/today_shared.dart' show hsl, TapScale;

/// Free-tier rule for the post-chapter Journey AI reflection.
/// Port of `src/lib/journeyReflectionQuota.ts`: free users get Day 1 of
/// every journey free, Day 2+ requires Premium.
bool canUseJourneyReflection(int day, bool isPremium) {
  if (isPremium) return true;
  return day == 1;
}

/// Post-chapter reflection — 1:1 port of
/// `src/components/journey/ReflectionSheet.tsx`.
/// Opens as a bottom sheet; [onClose] fires journey completion when
/// dismissed (matches the web behaviour where skipping still completes).
Future<void> showReflectionSheet(
  BuildContext context, {
  required String context_,
  required double hue,
  int day = 1,
  required VoidCallback onClose,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: Colors.transparent,
    barrierColor: Colors.black.withValues(alpha: 0.6),
    isDismissible: false,
    enableDrag: false,
    builder: (_) => ReflectionSheet(
      context: context_,
      hue: hue,
      day: day,
      onClose: onClose,
    ),
  );
}

class ReflectionSheet extends ConsumerStatefulWidget {
  const ReflectionSheet({
    super.key,
    required this.context,
    required this.hue,
    this.day = 1,
    required this.onClose,
  });

  /// e.g. "Anxiety to Peace · Day 2".
  final String context;
  final double hue;
  final int day;
  final VoidCallback onClose;

  @override
  ConsumerState<ReflectionSheet> createState() => _ReflectionSheetState();
}

class _ReflectionSheetState extends ConsumerState<ReflectionSheet> {
  final _controller = TextEditingController();
  final _focusNode = FocusNode();
  bool _loading = false;
  String? _reply;

  bool get _isPremium => ref.read(premiumProvider);
  bool get _allowed => canUseJourneyReflection(widget.day, _isPremium);

  @override
  void initState() {
    super.initState();
    Future.delayed(const Duration(milliseconds: 350), () {
      if (mounted) _focusNode.requestFocus();
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    _focusNode.dispose();
    super.dispose();
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
        trigger: 'journey_reflection',
        onClose: () => Navigator.of(sheetCtx).maybePop(),
        onUnlock: () {
          ref.read(premiumProvider.notifier).setUnlocked();
          Navigator.of(sheetCtx).maybePop();
        },
      ),
    );
  }

  Future<void> _submit() async {
    final trimmed = _controller.text.trim();
    if (trimmed.isEmpty || _loading) return;
    if (!_allowed) {
      await haptic(HapticStyle.medium);
      await _openPremium();
      return;
    }
    await haptic(HapticStyle.medium);
    setState(() => _loading = true);
    try {
      final resp = await http
          .post(
            Uri.parse('${Env.supabaseUrl}/functions/v1/ai-pastoral'),
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ${Env.supabaseAnonKey}',
            },
            body: jsonEncode({
              'kind': 'reflection',
              'text': trimmed,
              'context': widget.context,
              'lang': L10n.current.lang,
            }),
          )
          .timeout(const Duration(seconds: 25));
      if (resp.statusCode < 200 || resp.statusCode >= 300) {
        throw Exception('ai-pastoral ${resp.statusCode}');
      }
      final content = '${(jsonDecode(resp.body) as Map)['content'] ?? ''}';
      if (content.isEmpty) throw Exception('Empty response');
      await haptic(HapticStyle.soft);
      if (mounted) setState(() => _reply = content);
    } catch (e) {
      if (mounted) AppToast.error(context, t('jn.reflect.error'));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _finish() async {
    await haptic(HapticStyle.soft);
    if (mounted) Navigator.of(context).maybePop();
    widget.onClose();
  }

  @override
  Widget build(BuildContext context) {
    final hue = widget.hue;
    final maxH = MediaQuery.sizeOf(context).height * 0.88;

    return Container(
      constraints: BoxConstraints(maxHeight: maxH),
      decoration: BoxDecoration(
        color: AppColors.background,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [AppColors.glassRaised, AppColors.background],
          stops: const [0, 0.6],
        ),
      ),
      child: Stack(
        children: [
          Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(height: 12),
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: AppColors.foreground.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(999),
                  ),
                ),
              ),
              // Header scrolls with the body. Keeping it outside the scroll
              // view overflowed the sheet on tall/narrow phones, which clipped
              // the star badge and stacked the title over the subtitle.
              Flexible(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      _header(hue),
                      _reply == null ? _compose(hue) : _replyView(),
                    ],
                  ),
                ),
              ),
              SafeArea(
                top: false,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 12, 20, 14),
                  child: _footerButton(),
                ),
              ),
            ],
          ),
          Positioned(
            top: 12,
            right: 12,
            child: TapScale(
              onTap: _finish,
              child: GlassPanel(
                radius: 16,
                child: SizedBox(
                  width: 36,
                  height: 36,
                  child: LucideIcon(
                    'x',
                    size: 16,
                    color: AppColors.foreground.withValues(alpha: 0.7),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _header(double hue) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 8, 24, 16),
      child: Column(
        children: [
          Container(
            width: 56,
            height: 56,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(24),
              color: AppColors.glassSoft,
              border: Border.all(color: AppColors.goldBorder),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.5),
                  blurRadius: 20,
                  spreadRadius: -10,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            child: Icon(Icons.star_rounded, size: 24, color: AppColors.primary),
          ),
          const SizedBox(height: 12),
          Text(
            widget.context.toUpperCase(),
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w800,
              letterSpacing: 2.2,
              color: AppColors.foreground.withValues(alpha: 0.55),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            t('jn.reflect.title'),
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w900,
              letterSpacing: -0.4,
              color: AppColors.foreground,
              height: 1.2,
            ),
          ),
          const SizedBox(height: 6),
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 280),
            child: Text(
              t('jn.reflect.subtitle'),
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 13,
                height: 1.5,
                color: AppColors.foreground.withValues(alpha: 0.65),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _compose(double hue) {
    final prompts = [
      t('jn.reflect.prompts.0'),
      t('jn.reflect.prompts.1'),
      t('jn.reflect.prompts.2'),
      t('jn.reflect.prompts.3'),
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (!_allowed)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: TapScale(
              onTap: () {
                haptic(HapticStyle.soft);
                _openPremium();
              },
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 10),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(16),
                  color: AppColors.glassSoft,
                  border: Border.all(color: AppColors.goldBorder),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    LucideIcon('crown', size: 14, color: AppColors.primary),
                    const SizedBox(width: 6),
                    Text(
                      t('jn.reflect.premiumNudge'),
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                        color: AppColors.primary,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        Wrap(
          spacing: 6,
          runSpacing: 6,
          children: [
            for (final p in prompts)
              TapScale(
                onTap: () {
                  haptic(HapticStyle.soft);
                  if (_controller.text.isEmpty) {
                    _controller.text = '$p: ';
                    _controller.selection = TextSelection.collapsed(
                      offset: _controller.text.length,
                    );
                  }
                  _focusNode.requestFocus();
                },
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 7,
                  ),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(999),
                    color: AppColors.primary.withValues(alpha: 0.1),
                    border: Border.all(
                      color: AppColors.primary.withValues(alpha: 0.22),
                    ),
                  ),
                  child: Text(
                    p,
                    style: TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w700,
                      color: AppColors.primary,
                    ),
                  ),
                ),
              ),
          ],
        ),
        const SizedBox(height: 14),
        GlassPanel(
          radius: 22,
          padding: const EdgeInsets.all(16),
          child: Column(
            children: [
              TextField(
                controller: _controller,
                focusNode: _focusNode,
                maxLines: 6,
                minLines: 6,
                maxLength: 600,
                onChanged: (_) => setState(() {}),
                enabled: !_loading,
                style: TextStyle(
                  fontSize: 15,
                  height: 1.55,
                  color: AppColors.foreground,
                ),
                decoration: InputDecoration(
                  isDense: true,
                  counterText: '',
                  border: InputBorder.none,
                  hintText: t('jn.reflect.placeholder'),
                  hintStyle: TextStyle(
                    fontSize: 15,
                    color: AppColors.foreground.withValues(alpha: 0.4),
                  ),
                ),
              ),
              Row(
                children: [
                  Text(
                    t('jn.reflect.charCount', {
                      'count': '${_controller.text.length}',
                    }),
                    style: TextStyle(
                      fontSize: 10.5,
                      fontWeight: FontWeight.w700,
                      color: AppColors.foreground.withValues(alpha: 0.4),
                    ),
                  ),
                  const Spacer(),
                  TapScale(
                    onTap: _finish,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        vertical: 4,
                        horizontal: 6,
                      ),
                      child: Text(
                        t('jn.reflect.skip'),
                        style: TextStyle(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w700,
                          color: AppColors.foreground.withValues(alpha: 0.55),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _replyView() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: const EdgeInsets.all(14),
          margin: const EdgeInsets.only(bottom: 12),
          decoration: BoxDecoration(
            color: AppColors.muted.withValues(alpha: 0.4),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Text(
            t('jn.reflect.yourLine', {'text': _controller.text.trim()}),
            style: TextStyle(
              fontSize: 13.5,
              height: 1.55,
              fontStyle: FontStyle.italic,
              fontFamily: 'Cormorant Garamond',
              color: AppColors.foreground.withValues(alpha: 0.7),
            ),
          ),
        ),
        GlassPanel(
          radius: 22,
          padding: const EdgeInsets.all(16),
          child: BibleChatMarkdown(content: _reply!),
        ),
      ],
    );
  }

  Widget _footerButton() {
    if (_reply != null) {
      return TapScale(
        scale: 0.97,
        onTap: _finish,
        child: Container(
          width: double.infinity,
          height: 56,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [AppColors.primary, hsl(45, 90, 55)],
            ),
            boxShadow: [
              BoxShadow(
                color: AppColors.primary.withValues(alpha: 0.55),
                blurRadius: 24,
                spreadRadius: -10,
                offset: const Offset(0, 12),
              ),
            ],
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              LucideIcon('check', size: 18, color: Colors.white),
              const SizedBox(width: 8),
              Text(
                t('jn.reflect.finish'),
                style: const TextStyle(
                  fontSize: 14.5,
                  fontWeight: FontWeight.w900,
                  letterSpacing: -0.2,
                  color: Colors.white,
                ),
              ),
            ],
          ),
        ),
      );
    }
    final canSubmit = _controller.text.trim().isNotEmpty && !_loading;
    return Opacity(
      opacity: canSubmit ? 1 : 0.4,
      child: TapScale(
        scale: 0.97,
        onTap: _submit,
        child: Container(
          width: double.infinity,
          height: 56,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [AppColors.primary, hsl(45, 90, 55)],
            ),
            boxShadow: [
              BoxShadow(
                color: AppColors.primary.withValues(alpha: 0.55),
                blurRadius: 24,
                spreadRadius: -10,
                offset: const Offset(0, 12),
              ),
            ],
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (_loading)
                const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(
                    strokeWidth: 2.5,
                    color: Colors.white,
                  ),
                )
              else
                const Icon(Icons.send_rounded, size: 16, color: Colors.white),
              const SizedBox(width: 8),
              Text(
                _loading ? t('jn.reflect.loading') : t('jn.reflect.submit'),
                style: const TextStyle(
                  fontSize: 14.5,
                  fontWeight: FontWeight.w900,
                  letterSpacing: -0.2,
                  color: Colors.white,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
