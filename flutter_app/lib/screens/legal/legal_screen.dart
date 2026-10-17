import 'package:flutter/material.dart';

import '../../core/services/haptics.dart';
import '../../core/theme/app_colors.dart';
import '../../widgets/lucide.dart';
import 'legal_platform.dart';

/// One section of a legal document — heading + body blocks.
class LegalSection {
  const LegalSection(this.title, this.blocks);
  final String title;
  final List<LegalBlock> blocks;
}

/// A body block: a paragraph or a bulleted list.
class LegalBlock {
  const LegalBlock.paragraph(this.text) : bullets = const [];
  const LegalBlock.bullets(this.bullets) : text = '';
  final String text;
  final List<String> bullets;
  bool get isBullets => bullets.isNotEmpty;
}

/// Shared shell for `src/pages/PrivacyPolicy.tsx` and
/// `src/pages/TermsOfService.tsx` — identical header, "Last updated" line,
/// 13px bold section headings and 11px muted body copy.
///
/// Inline markers in the copy: `**bold**` → foreground bold, `*italic*` →
/// italic, `` `code` `` and `~gold~` → primary colour (the web pages use
/// `text-primary` for e-mails, package name and code spans).
class LegalScreen extends StatelessWidget {
  const LegalScreen({
    super.key,
    required this.title,
    required this.lastUpdated,
    required this.sections,
    this.intro,
  });

  final String title;
  final String lastUpdated;
  final String? intro;
  final List<LegalSection> sections;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        bottom: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 20, 16, 12),
              child: Row(
                children: [
                  GestureDetector(
                    onTap: () async {
                      await haptic(HapticStyle.soft);
                      if (context.mounted) Navigator.of(context).maybePop();
                    },
                    child: Container(
                      width: 36,
                      height: 36,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: AppColors.card,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: AppColors.border.withValues(alpha: 0.3),
                        ),
                      ),
                      child: LucideIcon(
                        'arrow-left',
                        size: 16,
                        color: AppColors.foreground,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Text(
                    title,
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: AppColors.foreground,
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 112),
                children: [
                  Padding(
                    padding: const EdgeInsets.only(bottom: 16),
                    child: Text(
                      'Last updated: $lastUpdated',
                      style: TextStyle(
                        fontSize: 10,
                        color: AppColors.mutedForeground,
                      ),
                    ),
                  ),
                  if (intro != null)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 20),
                      child: _body(intro!),
                    ),
                  for (final section in sections) _section(section),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _section(LegalSection section) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Text(
              section.title,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: AppColors.foreground,
              ),
            ),
          ),
          for (var i = 0; i < section.blocks.length; i++)
            Padding(
              padding: EdgeInsets.only(top: i == 0 ? 0 : 8),
              child: section.blocks[i].isBullets
                  ? Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        for (final b in section.blocks[i].bullets)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 4, left: 16),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Padding(
                                  padding: const EdgeInsets.only(top: 6),
                                  child: Container(
                                    width: 3,
                                    height: 3,
                                    decoration: BoxDecoration(
                                      shape: BoxShape.circle,
                                      color: AppColors.mutedForeground,
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Expanded(child: _body(b)),
                              ],
                            ),
                          ),
                      ],
                    )
                  : _body(section.blocks[i].text),
            ),
        ],
      ),
    );
  }

  Widget _body(String raw) {
    final base = TextStyle(
      fontSize: 11,
      height: 1.6,
      color: AppColors.mutedForeground,
    );
    return RichText(
      text: TextSpan(style: base, children: _spans(legalForPlatform(raw), base)),
    );
  }

  static final _marker = RegExp(r'\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|~(.+?)~');

  List<InlineSpan> _spans(String raw, TextStyle base) {
    final spans = <InlineSpan>[];
    var index = 0;
    for (final m in _marker.allMatches(raw)) {
      if (m.start > index) {
        spans.add(TextSpan(text: raw.substring(index, m.start)));
      }
      if (m.group(1) != null) {
        spans.add(
          TextSpan(
            text: m.group(1),
            style: base.copyWith(
              fontWeight: FontWeight.w700,
              color: AppColors.foreground,
            ),
          ),
        );
      } else if (m.group(2) != null) {
        spans.add(
          TextSpan(
            text: m.group(2),
            style: base.copyWith(fontStyle: FontStyle.italic),
          ),
        );
      } else {
        spans.add(
          TextSpan(
            text: m.group(3) ?? m.group(4),
            style: base.copyWith(color: AppColors.primary),
          ),
        );
      }
      index = m.end;
    }
    if (index < raw.length) spans.add(TextSpan(text: raw.substring(index)));
    return spans;
  }
}
