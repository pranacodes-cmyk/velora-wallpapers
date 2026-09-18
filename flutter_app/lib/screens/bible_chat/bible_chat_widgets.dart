import 'package:flutter/material.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/services/bible_chat_store.dart';
import '../../core/theme/app_colors.dart';
import '../today/today_shared.dart';

/// Starter prompts shown on the empty state — mirrors `STARTER_PROMPTS` in
/// `src/pages/Companion.tsx` (icon + i18n id, same order).
const kStarterPrompts = <(IconData, String)>[
  (Icons.air_rounded, 'anxious'),
  (Icons.volunteer_activism_rounded, 'someone'),
  (Icons.favorite_rounded, 'grace'),
  (Icons.menu_book_rounded, 'verse'),
  (Icons.auto_awesome_rounded, 'forgive'),
  (Icons.dark_mode_rounded, 'empty'),
];

/// User/assistant chat bubble — 1:1 of `Bubble()` in `src/pages/Companion.tsx`.
class BibleChatBubble extends StatelessWidget {
  const BibleChatBubble({super.key, required this.message});

  final BibleChatMessage message;

  @override
  Widget build(BuildContext context) {
    final isUser = message.role == 'user';
    if (isUser) {
      return Align(
        alignment: Alignment.centerRight,
        child: Container(
          constraints: BoxConstraints(
            maxWidth: MediaQuery.sizeOf(context).width * 0.84,
          ),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [hsl(45, 95, 65), hsl(42, 88, 50)],
            ),
            borderRadius: const BorderRadius.only(
              topLeft: Radius.circular(20),
              topRight: Radius.circular(20),
              bottomLeft: Radius.circular(20),
              bottomRight: Radius.circular(6),
            ),
            boxShadow: [
              BoxShadow(
                color: AppColors.primary.withValues(alpha: 0.5),
                blurRadius: 20,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: Text(
            message.content,
            style: TextStyle(
              fontSize: 14.5,
              height: 1.45,
              fontWeight: FontWeight.w600,
              color: hsl(222, 55, 10),
            ),
          ),
        ),
      );
    }

    // Assistant — no bubble background, refined typography w/ simple markdown.
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _AssistantAvatar(),
        const SizedBox(width: 10),
        Expanded(
          child: Padding(
            padding: const EdgeInsets.only(top: 2),
            child: BibleChatMarkdown(content: message.content),
          ),
        ),
      ],
    );
  }
}

class _AssistantAvatar extends StatelessWidget {
  const _AssistantAvatar();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 28,
      height: 28,
      margin: const EdgeInsets.only(top: 2),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        gradient: RadialGradient(
          center: const Alignment(-0.4, -0.6),
          radius: 1.1,
          colors: [hsl(45, 95, 70), hsl(42, 85, 45)],
        ),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withValues(alpha: 0.45),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Icon(Icons.menu_book_rounded, size: 14, color: hsl(222, 55, 12)),
    );
  }
}

/// Minimal markdown renderer for the assistant's reply, matching the
/// `ReactMarkdown` component overrides on web: bold `**`, italic `*`/`_`,
/// blockquote `>`, bullet `-`/`*` and numbered lists.
class BibleChatMarkdown extends StatelessWidget {
  const BibleChatMarkdown({super.key, required this.content});

  final String content;

  @override
  Widget build(BuildContext context) {
    final lines = content.split('\n');
    final children = <Widget>[];
    var i = 0;
    while (i < lines.length) {
      final line = lines[i];
      if (line.trimLeft().startsWith('>')) {
        final quoteLines = <String>[];
        while (i < lines.length && lines[i].trimLeft().startsWith('>')) {
          quoteLines.add(
            lines[i].trimLeft().replaceFirst(RegExp(r'^>\s?'), ''),
          );
          i++;
        }
        children.add(_Blockquote(text: quoteLines.join('\n')));
        continue;
      }
      final bullet = RegExp(r'^\s*[-*]\s+(.*)$').firstMatch(line);
      final numbered = RegExp(r'^\s*\d+\.\s+(.*)$').firstMatch(line);
      if (bullet != null || numbered != null) {
        final text = (bullet ?? numbered)!.group(1)!;
        children.add(_ListItem(text: text, ordered: numbered != null));
        i++;
        continue;
      }
      if (line.trim().isEmpty) {
        i++;
        continue;
      }
      children.add(
        Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: _RichInline(line),
        ),
      );
      i++;
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: children,
    );
  }
}

class _Blockquote extends StatelessWidget {
  const _Blockquote({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 6),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            AppColors.primary.withValues(alpha: 0.10),
            AppColors.primary.withValues(alpha: 0.04),
          ],
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border(left: BorderSide(color: AppColors.primary, width: 2.5)),
      ),
      child: Text(
        text,
        style: TextStyle(
          fontFamily: 'Georgia',
          fontStyle: FontStyle.italic,
          fontSize: 16,
          height: 1.55,
          color: hsl(40, 30, 92),
        ),
      ),
    );
  }
}

class _ListItem extends StatelessWidget {
  const _ListItem({required this.text, required this.ordered});
  final String text;
  final bool ordered;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 20, bottom: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            ordered ? '•' : '•',
            style: TextStyle(
              color: AppColors.foreground.withValues(alpha: 0.92),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(child: _RichInline(text)),
        ],
      ),
    );
  }
}

/// Inline `**bold**` / `*italic*` handling for a single line of text.
class _RichInline extends StatelessWidget {
  const _RichInline(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    final base = TextStyle(
      fontSize: 15,
      height: 1.7,
      color: AppColors.foreground.withValues(alpha: 0.92),
    );
    final spans = <InlineSpan>[];
    final pattern = RegExp(r'\*\*(.+?)\*\*|\*(.+?)\*|_(.+?)_');
    var last = 0;
    for (final m in pattern.allMatches(text)) {
      if (m.start > last)
        spans.add(TextSpan(text: text.substring(last, m.start)));
      if (m.group(1) != null) {
        spans.add(
          TextSpan(
            text: m.group(1),
            style: TextStyle(
              color: AppColors.primary,
              fontWeight: FontWeight.bold,
            ),
          ),
        );
      } else {
        final italic = m.group(2) ?? m.group(3);
        spans.add(
          TextSpan(
            text: italic,
            style: TextStyle(
              fontStyle: FontStyle.italic,
              color: AppColors.foreground.withValues(alpha: 0.8),
            ),
          ),
        );
      }
      last = m.end;
    }
    if (last < text.length) spans.add(TextSpan(text: text.substring(last)));
    return RichText(
      text: TextSpan(style: base, children: spans),
    );
  }
}

/// "Seeking Scripture for you…" shimmering status row — `TypingBubble()`.
class BibleChatTypingBubble extends StatefulWidget {
  const BibleChatTypingBubble({super.key});

  @override
  State<BibleChatTypingBubble> createState() => _BibleChatTypingBubbleState();
}

class _BibleChatTypingBubbleState extends State<BibleChatTypingBubble>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 2200),
  )..repeat();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        _AssistantAvatar(),
        const SizedBox(width: 10),
        AnimatedBuilder(
          animation: _controller,
          builder: (context, _) {
            return ShaderMask(
              shaderCallback: (bounds) {
                final t = _controller.value;
                return LinearGradient(
                  begin: Alignment(-1 + 4 * t, 0),
                  end: Alignment(1 + 4 * t, 0),
                  colors: [hsl(40, 15, 55), AppColors.primary, hsl(40, 15, 55)],
                ).createShader(bounds);
              },
              child: Text(
                t('chat.status.thinking'),
                style: const TextStyle(
                  fontFamily: 'Georgia',
                  fontStyle: FontStyle.italic,
                  fontSize: 13.5,
                  fontWeight: FontWeight.w500,
                  color: Colors.white,
                ),
              ),
            );
          },
        ),
      ],
    );
  }
}

/// Empty state with halo + heading + starter prompt list.
class BibleChatEmptyState extends StatelessWidget {
  const BibleChatEmptyState({super.key, required this.onPick});

  final ValueChanged<String> onPick;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 8),
      child: Column(
        children: [
          FadeRise(
            child: Column(
              children: [
                SizedBox(
                  width: 68,
                  height: 68,
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      Container(
                        width: 68,
                        height: 68,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          gradient: RadialGradient(
                            colors: [
                              AppColors.primary.withValues(alpha: 0.45),
                              AppColors.primary.withValues(alpha: 0.0),
                            ],
                          ),
                        ),
                      ),
                      Container(
                        width: 56,
                        height: 56,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(22),
                          gradient: RadialGradient(
                            center: const Alignment(-0.4, -0.6),
                            colors: [hsl(45, 95, 72), hsl(42, 85, 45)],
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: AppColors.primary.withValues(alpha: 0.55),
                              blurRadius: 32,
                              offset: const Offset(0, 14),
                            ),
                          ],
                        ),
                        child: Icon(
                          Icons.menu_book_rounded,
                          size: 28,
                          color: hsl(222, 55, 12),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
                Text(
                  t('chat.empty.title'),
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontFamily: 'Georgia',
                    fontWeight: FontWeight.w600,
                    fontSize: 22,
                    letterSpacing: -0.4,
                    color: AppColors.foreground,
                  ),
                ),
                const SizedBox(height: 8),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 24),
                  child: Text(
                    t('chat.empty.subtitle'),
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 13,
                      height: 1.4,
                      color: AppColors.foreground.withValues(alpha: 0.6),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          Row(
            children: [
              Expanded(
                child: Container(
                  height: 1,
                  color: AppColors.primary.withValues(alpha: 0.25),
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8),
                child: Text(
                  t('chat.empty.beginWith'),
                  style: TextStyle(
                    fontSize: 9.5,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 2,
                    color: AppColors.foreground.withValues(alpha: 0.45),
                  ),
                ),
              ),
              Expanded(
                child: Container(
                  height: 1,
                  color: AppColors.primary.withValues(alpha: 0.25),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          ...kStarterPrompts.map(
            (p) => Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: FadeRise(
                child: TapScale(
                  onTap: () => onPick(t('chat.starter.${p.$2}.text')),
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 10,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.card.withValues(alpha: 0.7),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                        color: AppColors.primary.withValues(alpha: 0.16),
                      ),
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 32,
                          height: 32,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(10),
                            gradient: RadialGradient(
                              center: const Alignment(-0.4, -0.6),
                              colors: [
                                AppColors.primary.withValues(alpha: 0.28),
                                AppColors.primary.withValues(alpha: 0.06),
                              ],
                            ),
                            border: Border.all(
                              color: AppColors.primary.withValues(alpha: 0.28),
                            ),
                          ),
                          child: Icon(p.$1, size: 14, color: AppColors.primary),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                t('chat.starter.${p.$2}.label'),
                                style: TextStyle(
                                  fontSize: 12.5,
                                  fontWeight: FontWeight.w600,
                                  height: 1.25,
                                  color: AppColors.foreground.withValues(
                                    alpha: 0.95,
                                  ),
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                t('chat.starter.${p.$2}.meta').toUpperCase(),
                                style: TextStyle(
                                  fontSize: 9,
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: 1.4,
                                  color: AppColors.foreground.withValues(
                                    alpha: 0.4,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        Text(
                          '›',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w300,
                            color: AppColors.foreground.withValues(alpha: 0.35),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
