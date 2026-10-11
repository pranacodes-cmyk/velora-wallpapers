import 'package:flutter/material.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/services/haptics.dart';
import '../../core/theme/app_colors.dart';
import 'quiz_controller.dart';
import 'quiz_data.dart';

/// 1:1 port of `src/components/quiz/ProQuizPicker.tsx`.
Future<void> showProQuizPicker(
  BuildContext context, {
  required String kind, // "book" | "pack"
  required ValueChanged<String> onPickBook,
  required ValueChanged<String> onPickPack,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (ctx) => _ProQuizPickerSheet(
      kind: kind,
      onPickBook: onPickBook,
      onPickPack: onPickPack,
    ),
  );
}

class _ProQuizPickerSheet extends StatelessWidget {
  const _ProQuizPickerSheet({
    required this.kind,
    required this.onPickBook,
    required this.onPickPack,
  });

  final String kind;
  final ValueChanged<String> onPickBook;
  final ValueChanged<String> onPickPack;

  @override
  Widget build(BuildContext context) {
    final isBook = kind == 'book';
    final books = isBook
        ? QuizBank.listBooksWithCounts(4)
        : const <BookEntry>[];
    final mastery = isBook ? getBookMastery() : const <String, int>{};
    final maxHeight = MediaQuery.sizeOf(context).height * 0.85;

    return SafeArea(
      top: false,
      child: Container(
        constraints: BoxConstraints(maxHeight: maxHeight),
        decoration: BoxDecoration(
          color: AppColors.background,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
          border: Border.all(color: AppColors.glassBorder),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 12),
              decoration: BoxDecoration(
                color: AppColors.navBlur,
                border: Border(
                  bottom: BorderSide(color: AppColors.glassBorder),
                ),
                borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(24),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(
                        Icons.emoji_events,
                        size: 16,
                        color: Color(0xFFEAB93A),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        isBook
                            ? t('quiz.picker.book.title')
                            : t('quiz.picker.pack.title'),
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w900,
                          color: AppColors.foreground,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    isBook
                        ? t('quiz.picker.book.desc')
                        : t('quiz.picker.pack.desc'),
                    style: TextStyle(
                      fontSize: 12,
                      color: AppColors.mutedForeground,
                    ),
                  ),
                ],
              ),
            ),
            Flexible(
              child: ListView(
                padding: const EdgeInsets.all(16),
                shrinkWrap: true,
                children: [
                  if (isBook)
                    for (final b in books)
                      _bookTile(context, b, mastery[b.book] ?? 0)
                  else
                    for (final p in quizPacks) _packTile(context, p),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _bookTile(BuildContext context, BookEntry b, int best) {
    final mastered = best >= 3000;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () {
            haptic(HapticStyle.soft);
            Navigator.of(context).maybePop();
            onPickBook(b.book);
          },
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.card,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.glassBorder),
            ),
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(12),
                    gradient: mastered
                        ? LinearGradient(
                            colors: [AppColors.glassRaised, AppColors.card],
                          )
                        : null,
                    color: mastered ? null : AppColors.glassSoft,
                    border: Border.all(
                      color: mastered
                          ? AppColors.goldBorder
                          : AppColors.glassBorder,
                    ),
                  ),
                  child: Icon(
                    mastered ? Icons.emoji_events : Icons.menu_book_outlined,
                    size: 20,
                    color: mastered ? Colors.white : AppColors.primary,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              b.book,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.bold,
                                color: AppColors.foreground,
                              ),
                            ),
                          ),
                          const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 6,
                              vertical: 2,
                            ),
                            decoration: BoxDecoration(
                              color:
                                  (b.testament == 'Old'
                                          ? const Color(0xFFBF8B33)
                                          : const Color(0xFF3D7DD9))
                                      .withValues(alpha: 0.15),
                              borderRadius: BorderRadius.circular(999),
                            ),
                            child: Text(
                              b.testament == 'Old'
                                  ? t('quiz.picker.ot')
                                  : t('quiz.picker.nt'),
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                                color: b.testament == 'Old'
                                    ? const Color(0xFFBF8B33)
                                    : const Color(0xFF3D7DD9),
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '${t('quiz.picker.questions', {'count': b.count})} · '
                        '${t('quiz.picker.best', {'score': best > 0 ? best.toString() : '—'})}',
                        style: TextStyle(
                          fontSize: 11,
                          color: AppColors.mutedForeground,
                        ),
                      ),
                    ],
                  ),
                ),
                Text(
                  '›',
                  style: TextStyle(
                    fontSize: 13,
                    color: AppColors.mutedForeground,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _packTile(BuildContext context, QuizPack p) {
    final size = QuizBank.getPackSize(p.id);
    final disabled = size < 5;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: disabled
              ? null
              : () {
                  haptic(HapticStyle.soft);
                  Navigator.of(context).maybePop();
                  onPickPack(p.id);
                },
          child: Opacity(
            opacity: disabled ? 0.4 : 1,
            child: Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.card,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.glassBorder),
              ),
              child: Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(12),
                      gradient: LinearGradient(
                        colors: [
                          AppColors.primary.withValues(alpha: 0.18),
                          AppColors.accent.withValues(alpha: 0.12),
                        ],
                      ),
                    ),
                    child: Text(p.emoji, style: const TextStyle(fontSize: 20)),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          p.title,
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.bold,
                            color: AppColors.foreground,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          p.description,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 11,
                            color: AppColors.mutedForeground,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Text(
                    '›',
                    style: TextStyle(
                      fontSize: 13,
                      color: AppColors.mutedForeground,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
