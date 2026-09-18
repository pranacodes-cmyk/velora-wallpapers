import 'package:flutter/material.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/services/haptics.dart';
import '../../core/services/personal_cross.dart';
import '../../core/theme/app_colors.dart';
import '../today/today_shared.dart';

/// 1:1 port of `PersonalizeCrossSheet` in
/// `src/components/PersonalizeCrossSheet.tsx` — name input (22 chars) plus the
/// verse picker, saved to the same storage keys so the Today rail and the
/// native wallpaper update instantly. The live preview tile is intentionally
/// absent on web too (kept lightweight), so it is absent here.
class PersonalizeCrossSheet extends StatefulWidget {
  const PersonalizeCrossSheet({super.key});

  @override
  State<PersonalizeCrossSheet> createState() => _PersonalizeCrossSheetState();
}

class _PersonalizeCrossSheetState extends State<PersonalizeCrossSheet> {
  late final TextEditingController _ctrl;
  late String _verseId;

  @override
  void initState() {
    super.initState();
    _ctrl = TextEditingController(text: PersonalCross.name());
    _verseId = PersonalCross.verse().id;
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  bool get _canSave => _ctrl.text.trim().isNotEmpty;

  Future<void> _save() async {
    if (!_canSave) return;
    await PersonalCross.setPersonal(_ctrl.text, _verseId);
    await haptic(HapticStyle.light);
    if (mounted) Navigator.of(context).maybePop();
  }

  @override
  Widget build(BuildContext context) {
    final verses = PersonalCross.verses();
    final maxH = MediaQuery.of(context).size.height * 0.92;

    return Container(
      constraints: BoxConstraints(maxHeight: maxH),
      decoration: BoxDecoration(
        color: AppColors.background,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
        border: Border(top: BorderSide(color: AppColors.glassBorder)),
        boxShadow: [
          BoxShadow(
            color: hsl(0, 0, 0, 0.7),
            blurRadius: 60,
            spreadRadius: -12,
            offset: const Offset(0, -24),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: SingleChildScrollView(
          padding: const EdgeInsets.only(top: 8, bottom: 32),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Grip
              Padding(
                padding: const EdgeInsets.only(top: 6, bottom: 8),
                child: Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: AppColors.foreground.withValues(alpha: 0.25),
                      borderRadius: BorderRadius.circular(999),
                    ),
                  ),
                ),
              ),

              // Header
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
                child: Row(
                  children: [
                    Container(
                      width: 32,
                      height: 32,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [gold, gold.withValues(alpha: 0.7)],
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: gold.withValues(alpha: 0.4),
                            blurRadius: 12,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: Icon(
                        Icons.auto_awesome,
                        size: 16,
                        color: hsl(220, 40, 10),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            t('px.sheet.title'),
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w900,
                              letterSpacing: -0.3,
                              color: AppColors.foreground,
                            ),
                          ),
                          Text(
                            t('px.sheet.subtitle'),
                            style: TextStyle(
                              fontSize: 10.5,
                              fontWeight: FontWeight.w600,
                              letterSpacing: 0.3,
                              color: AppColors.mutedForeground,
                            ),
                          ),
                        ],
                      ),
                    ),
                    TapScale(
                      onTap: () => Navigator.of(context).maybePop(),
                      child: Container(
                        width: 32,
                        height: 32,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: AppColors.foreground.withValues(alpha: 0.08),
                        ),
                        child: Icon(
                          Icons.close,
                          size: 16,
                          color: AppColors.foreground.withValues(alpha: 0.7),
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              // Name input
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(
                          Icons.edit,
                          size: 12,
                          color: gold.withValues(alpha: 0.8),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          t('px.sheet.nameLabel').toUpperCase(),
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 1.8,
                            color: gold.withValues(alpha: 0.8),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _ctrl,
                      maxLength: 22,
                      autofocus: _ctrl.text.isEmpty,
                      onChanged: (_) => setState(() {}),
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                        color: AppColors.foreground,
                      ),
                      decoration: InputDecoration(
                        counterText: '',
                        hintText: t('px.sheet.namePlaceholder'),
                        hintStyle: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.bold,
                          color: AppColors.foreground.withValues(alpha: 0.3),
                        ),
                        filled: true,
                        fillColor: AppColors.secondary.withValues(alpha: 0.5),
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 14,
                        ),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(16),
                          borderSide: BorderSide(
                            width: 1.5,
                            color: gold.withValues(alpha: 0.35),
                          ),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(16),
                          borderSide: BorderSide(
                            width: 1.5,
                            color: gold.withValues(alpha: 0.35),
                          ),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(16),
                          borderSide: BorderSide(
                            width: 1.5,
                            color: gold.withValues(alpha: 0.35),
                          ),
                        ),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.only(left: 4, top: 6),
                      child: Text(
                        t('px.sheet.namePrivacy', {'count': _ctrl.text.length}),
                        style: TextStyle(
                          fontSize: 10,
                          color: AppColors.mutedForeground,
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              // Verse picker
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      t('px.sheet.verseLabel').toUpperCase(),
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 1.8,
                        color: gold.withValues(alpha: 0.8),
                      ),
                    ),
                    const SizedBox(height: 8),
                    for (final v in verses) ...[
                      _VerseOption(
                        verse: v,
                        active: v.id == _verseId,
                        onTap: () => setState(() => _verseId = v.id),
                      ),
                      if (v.id != verses.last.id) const SizedBox(height: 8),
                    ],
                  ],
                ),
              ),

              // Save + skip
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 4),
                child: Column(
                  children: [
                    TapScale(
                      onTap: _save,
                      child: Opacity(
                        opacity: _canSave ? 1 : 0.4,
                        child: Container(
                          height: 50,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(16),
                            gradient: _canSave
                                ? LinearGradient(
                                    begin: Alignment.topLeft,
                                    end: Alignment.bottomRight,
                                    colors: [hsl(0, 85, 58), hsl(0, 75, 42)],
                                  )
                                : null,
                            color: _canSave ? null : AppColors.secondary,
                            boxShadow: _canSave
                                ? [
                                    BoxShadow(
                                      color: hsl(0, 85, 45, 0.6),
                                      blurRadius: 26,
                                      spreadRadius: -8,
                                      offset: const Offset(0, 10),
                                    ),
                                  ]
                                : null,
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(
                                Icons.auto_awesome,
                                size: 16,
                                color: _canSave
                                    ? hsl(30, 40, 98)
                                    : AppColors.mutedForeground,
                              ),
                              const SizedBox(width: 8),
                              Text(
                                _canSave
                                    ? t('px.sheet.saveCta')
                                    : t('px.sheet.saveCtaDisabled'),
                                style: TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w900,
                                  letterSpacing: 0.4,
                                  color: _canSave
                                      ? hsl(30, 40, 98)
                                      : AppColors.mutedForeground,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    TapScale(
                      onTap: () => Navigator.of(context).maybePop(),
                      child: Container(
                        height: 40,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(16),
                          color: AppColors.secondary.withValues(alpha: 0.5),
                          border: Border.all(color: AppColors.glassBorder),
                        ),
                        child: Text(
                          t('px.sheet.skipCta'),
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 0.3,
                            color: AppColors.foreground.withValues(alpha: 0.7),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _VerseOption extends StatelessWidget {
  const _VerseOption({
    required this.verse,
    required this.active,
    required this.onTap,
  });

  final PersonalVerse verse;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return TapScale(
      scale: 0.99,
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          gradient: active
              ? LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    gold.withValues(alpha: 0.18),
                    gold.withValues(alpha: 0.08),
                  ],
                )
              : null,
          color: active ? null : AppColors.secondary.withValues(alpha: 0.4),
          border: Border.all(
            width: active ? 1.5 : 1,
            color: active ? gold.withValues(alpha: 0.7) : AppColors.glassBorder,
          ),
          boxShadow: active
              ? [
                  BoxShadow(
                    color: gold.withValues(alpha: 0.2),
                    blurRadius: 14,
                    offset: const Offset(0, 4),
                  ),
                ]
              : null,
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 16,
              height: 16,
              margin: const EdgeInsets.only(top: 2),
              alignment: Alignment.center,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: active
                    ? gold
                    : AppColors.foreground.withValues(alpha: 0.1),
                border: active
                    ? null
                    : Border.all(
                        color: AppColors.foreground.withValues(alpha: 0.2),
                      ),
              ),
              child: active
                  ? Icon(Icons.check, size: 10, color: hsl(220, 40, 10))
                  : null,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '"${verse.text}"',
                    style: TextStyle(
                      fontFamily: 'Georgia',
                      fontFamilyFallback: const ['Times New Roman', 'serif'],
                      fontSize: 13,
                      fontStyle: FontStyle.italic,
                      fontWeight: FontWeight.w600,
                      height: 1.35,
                      color: AppColors.foreground,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '— ${verse.reference}'.toUpperCase(),
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 1.4,
                      color: gold.withValues(alpha: 0.9),
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
}
