import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http/http.dart' as http;

import '../../core/env.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/services/analytics.dart';
import '../../core/services/bible_chat_store.dart';
import '../../core/services/haptics.dart';
import '../../core/theme/app_colors.dart';
import '../../widgets/lucide.dart';
import '../../state/app_providers.dart';
import '../../widgets/app_toast.dart';
import '../../widgets/premium_sheet.dart';
import '../today/today_shared.dart';
import 'bible_chat_widgets.dart';

/// 1:1 port of `src/pages/Companion.tsx` — the full-screen Bible Chat.
///
/// Navigate to it with:
/// `Navigator.of(context).push(MaterialPageRoute(builder: (_) => const BibleChatScreen()))`
/// or pass an initial question (same as the web `?q=` param) to auto-send it:
/// `BibleChatScreen(initialQuestion: text)`.
class BibleChatScreen extends ConsumerStatefulWidget {
  const BibleChatScreen({super.key, this.initialQuestion});

  /// Pre-filled question that is auto-sent once, mirroring the web app's
  /// `?q=` query-param handling in `BibleCompanionCard` → `/companion?q=`.
  final String? initialQuestion;

  @override
  ConsumerState<BibleChatScreen> createState() => _BibleChatScreenState();
}

class _BibleChatScreenState extends ConsumerState<BibleChatScreen> {
  final _controller = TextEditingController();
  final _focusNode = FocusNode();
  final _scrollController = ScrollController();
  late List<BibleChatMessage> _messages = BibleChatStore.loadHistory();
  bool _loading = false;
  bool _focused = false;
  late int _remaining = BibleChatStore.getRemaining();
  bool _autoSent = false;

  @override
  void initState() {
    super.initState();
    _focusNode.addListener(() {
      setState(() => _focused = _focusNode.hasFocus);
    });
    final q = widget.initialQuestion?.trim();
    if (q != null && q.isNotEmpty && !_autoSent) {
      _autoSent = true;
      Future.delayed(const Duration(milliseconds: 120), () => _send(q));
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    _focusNode.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  bool get _isPremium => ref.read(premiumProvider);

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scrollController.hasClients) return;
      _scrollController.animateTo(
        _scrollController.position.maxScrollExtent,
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeOut,
      );
    });
  }

  Future<void> _openPremium() async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (sheetCtx) => PremiumSheet(
        trigger: 'companion',
        onClose: () => Navigator.of(sheetCtx).maybePop(),
        onUnlock: () {
          ref.read(premiumProvider.notifier).setUnlocked();
          Navigator.of(sheetCtx).maybePop();
        },
      ),
    );
  }

  Future<void> _send([String? textOverride]) async {
    final text = (textOverride ?? _controller.text).trim();
    if (text.isEmpty || _loading) return;

    if (!_isPremium && _remaining <= 0) {
      await haptic(HapticStyle.medium);
      await _openPremium();
      return;
    }

    await haptic(HapticStyle.soft);
    final next = [..._messages, BibleChatMessage(role: 'user', content: text)];
    setState(() {
      _messages = next;
      _controller.clear();
      _loading = true;
    });
    unawaited(BibleChatStore.saveHistory(_messages));
    _scrollToBottom();

    if (!_isPremium) {
      final left = await BibleChatStore.consumeMessage();
      if (mounted) setState(() => _remaining = left);
    }

    Analytics.capture('companion_message_sent', {'message_count': next.length});

    var assistantSoFar = '';
    void upsertAssistant(String chunk) {
      assistantSoFar += chunk;
      final last = _messages.isNotEmpty ? _messages.last : null;
      setState(() {
        if (last != null && last.role == 'assistant') {
          _messages = [
            ..._messages.sublist(0, _messages.length - 1),
            last.copyWith(content: assistantSoFar),
          ];
        } else {
          _messages = [
            ..._messages,
            BibleChatMessage(role: 'assistant', content: assistantSoFar),
          ];
        }
      });
      _scrollToBottom();
    }

    try {
      final request = http.Request(
        'POST',
        Uri.parse('${Env.supabaseUrl}/functions/v1/bible-companion'),
      );
      request.headers.addAll({
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ${Env.supabaseAnonKey}',
      });
      request.body = jsonEncode({
        'messages': next.map((m) => m.toJson()).toList(),
        'lang': L10n.current.lang,
      });

      final streamed = await http.Client().send(request);

      if (streamed.statusCode < 200 || streamed.statusCode >= 300) {
        if (mounted) {
          if (streamed.statusCode == 429) {
            AppToast.error(context, t('chat.toast.busy'));
          } else if (streamed.statusCode == 402) {
            AppToast.error(context, t('chat.toast.noCredits'));
          } else {
            AppToast.error(context, t('chat.toast.error'));
          }
          setState(() => _loading = false);
        }
        return;
      }

      var buf = '';
      await for (final chunk in streamed.stream.transform(utf8.decoder)) {
        buf += chunk;
        var nl = buf.indexOf('\n');
        var stop = false;
        while (nl != -1) {
          var line = buf.substring(0, nl);
          buf = buf.substring(nl + 1);
          if (line.endsWith('\r')) line = line.substring(0, line.length - 1);
          if (line.startsWith(':') || line.trim().isEmpty) {
            nl = buf.indexOf('\n');
            continue;
          }
          if (!line.startsWith('data: ')) {
            nl = buf.indexOf('\n');
            continue;
          }
          final json = line.substring(6).trim();
          if (json == '[DONE]') {
            stop = true;
            break;
          }
          try {
            final parsed = jsonDecode(json) as Map<String, dynamic>;
            final choices = parsed['choices'] as List<dynamic>?;
            final delta = choices != null && choices.isNotEmpty
                ? (choices[0] as Map<String, dynamic>)['delta']
                : null;
            final content = delta is Map ? delta['content'] as String? : null;
            if (content != null && content.isNotEmpty) upsertAssistant(content);
          } catch (_) {
            buf = '$line\n$buf';
            break;
          }
          nl = buf.indexOf('\n');
        }
        if (stop) break;
      }
    } catch (_) {
      if (mounted) AppToast.error(context, t('chat.toast.error'));
    } finally {
      if (mounted) setState(() => _loading = false);
      await haptic(HapticStyle.soft);
    }
  }

  Future<void> _handleClearChat() async {
    if (_messages.isEmpty) return;
    await haptic(HapticStyle.medium);
    if (!mounted) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.card,
        title: Text(
          t('chat.header.title'),
          style: TextStyle(color: AppColors.foreground),
        ),
        content: Text(
          t('chat.confirm.clear'),
          style: TextStyle(color: AppColors.foreground.withValues(alpha: 0.85)),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text(t('common.cancel')),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text(t('chat.nav.clear')),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    setState(() => _messages = []);
    await BibleChatStore.clearHistory();
    if (mounted) AppToast.success(context, t('chat.toast.cleared'));
  }

  @override
  Widget build(BuildContext context) {
    final isPremium = ref.watch(premiumProvider);
    return Scaffold(
      backgroundColor: AppColors.background,
      // The composer already lifts itself by `viewInsets.bottom`; letting the
      // Scaffold resize as well double-shifted it off-screen the moment the
      // keyboard appeared, which looked like the keyboard never opening.
      resizeToAvoidBottomInset: false,
      body: Stack(
        children: [
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  center: const Alignment(0, -0.9),
                  radius: 1.1,
                  colors: [
                    AppColors.accent.withValues(alpha: 0.10),
                    Colors.transparent,
                  ],
                ),
              ),
            ),
          ),
          SafeArea(
            child: Column(
              children: [
                _header(isPremium),
                Expanded(
                  child: ListView(
                    controller: _scrollController,
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    children: [
                      if (_messages.isEmpty)
                        BibleChatEmptyState(onPick: (text) => _send(text)),
                      ..._messages.map(
                        (m) => Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: BibleChatBubble(message: m),
                        ),
                      ),
                      if (_loading &&
                          _messages.isNotEmpty &&
                          _messages.last.role == 'user')
                        const Padding(
                          padding: EdgeInsets.only(bottom: 12),
                          child: BibleChatTypingBubble(),
                        ),
                      const SizedBox(height: 8),
                    ],
                  ),
                ),
                _composer(),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _header(bool isPremium) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 8),
      child: Container(
        padding: const EdgeInsets.all(6),
        decoration: BoxDecoration(
          color: AppColors.card.withValues(alpha: 0.72),
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: AppColors.primary.withValues(alpha: 0.16)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.5),
              blurRadius: 28,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Row(
          children: [
            TapScale(
              onTap: () {
                haptic(HapticStyle.soft);
                Navigator.of(context).maybePop();
              },
              child: SizedBox(
                width: 36,
                height: 36,
                child: Icon(
                  Icons.arrow_back_ios_new_rounded,
                  size: 16,
                  color: AppColors.foreground,
                ),
              ),
            ),
            Stack(
              clipBehavior: Clip.none,
              children: [
                Container(
                  width: 36,
                  height: 36,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(16),
                    gradient: RadialGradient(
                      center: const Alignment(-0.4, -0.6),
                      colors: [hsl(45, 95, 70), hsl(42, 85, 45)],
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.primary.withValues(alpha: 0.55),
                        blurRadius: 16,
                        offset: const Offset(0, 6),
                      ),
                    ],
                  ),
                  child: LucideIcon(
                    'book-open',
                    size: 17,
                    color: hsl(222, 55, 12),
                  ),
                ),
                Positioned(
                  bottom: -1,
                  right: -1,
                  child: Container(
                    width: 10,
                    height: 10,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: hsl(140, 70, 55),
                      border: Border.all(color: AppColors.background, width: 2),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    t('chat.header.title'),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontFamily: 'Cormorant Garamond',
                      fontWeight: FontWeight.w600,
                      fontSize: 15.5,
                      letterSpacing: -0.15,
                      color: AppColors.foreground,
                    ),
                  ),
                  Text(
                    isPremium
                        ? t('chat.header.unlimited')
                        : _remaining > 0
                        ? t('chat.header.remaining', {
                            'remaining': _remaining,
                            'total': BibleChatStore.getDailyLimit(),
                          })
                        : t('chat.header.limitReached'),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 10.5,
                      fontWeight: FontWeight.w600,
                      color: AppColors.foreground.withValues(alpha: 0.55),
                    ),
                  ),
                ],
              ),
            ),
            if (_messages.isNotEmpty)
              TapScale(
                onTap: _handleClearChat,
                child: SizedBox(
                  width: 36,
                  height: 36,
                  child: Icon(
                    Icons.delete_outline_rounded,
                    size: 15,
                    color: AppColors.foreground.withValues(alpha: 0.65),
                  ),
                ),
              ),
            if (!isPremium)
              TapScale(
                onTap: () {
                  haptic(HapticStyle.soft);
                  _openPremium();
                },
                child: Container(
                  height: 36,
                  padding: const EdgeInsets.symmetric(horizontal: 10),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(16),
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [hsl(45, 95, 65), hsl(42, 85, 48)],
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      LucideIcon('crown', size: 14, color: hsl(222, 55, 12)),
                      const SizedBox(width: 4),
                      Text(
                        'Pro',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w900,
                          color: hsl(222, 55, 12),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _composer() {
    return Padding(
      padding: EdgeInsets.fromLTRB(
        12,
        8,
        12,
        MediaQuery.viewInsetsOf(context).bottom + 12,
      ),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 250),
        padding: const EdgeInsets.fromLTRB(16, 6, 6, 6),
        decoration: BoxDecoration(
          color: AppColors.card.withValues(alpha: 0.78),
          borderRadius: BorderRadius.circular(26),
          boxShadow: [
            BoxShadow(
              color: _focused
                  ? AppColors.primary.withValues(alpha: 0.35)
                  : Colors.black.withValues(alpha: 0.55),
              blurRadius: _focused ? 40 : 32,
              offset: const Offset(0, 12),
            ),
          ],
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Expanded(
              child: TextField(
                controller: _controller,
                focusNode: _focusNode,
                minLines: 1,
                maxLines: 5,
                // Never disabled — a disabled field refuses focus, so while an
                // answer was streaming the keyboard simply would not open.
                readOnly: false,
                onSubmitted: (_) => _send(),
                textInputAction: TextInputAction.send,
                style: TextStyle(
                  fontSize: 15,
                  color: AppColors.foreground,
                  height: 1.5,
                ),
                decoration: InputDecoration(
                  isDense: true,
                  border: InputBorder.none,
                  hintText: t('chat.input.placeholder'),
                  hintStyle: TextStyle(
                    color: AppColors.foreground.withValues(alpha: 0.4),
                  ),
                  contentPadding: const EdgeInsets.symmetric(vertical: 10),
                ),
              ),
            ),
            // Only the send button depends on the text, so it listens to the
            // controller instead of rebuilding the whole chat on every keypress.
            ValueListenableBuilder<TextEditingValue>(
              valueListenable: _controller,
              builder: (_, value, __) {
                final hasText = value.text.trim().isNotEmpty;
                return TapScale(
                  onTap: _loading || !hasText ? () {} : () => _send(),
                  child: Container(
                    width: 44,
                    height: 44,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(20),
                      gradient: hasText
                          ? LinearGradient(
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                              colors: [
                                hsl(45, 95, 68),
                                hsl(42, 90, 50),
                                hsl(38, 95, 45),
                              ],
                            )
                          : null,
                      color: hasText ? null : hsl(222, 18, 13),
                    ),
                    child: Opacity(
                      opacity: _loading || !hasText ? 0.4 : 1,
                      child: Icon(
                        Icons.send_rounded,
                        size: 17,
                        color: hasText
                            ? hsl(222, 55, 12)
                            : AppColors.foreground.withValues(alpha: 0.35),
                      ),
                    ),
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}
