import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/services/analytics.dart';
import '../../core/services/challenge_circle_service.dart';
import '../../core/services/challenge_reminders.dart';
import '../../core/services/challenge_store.dart';
import '../../core/services/haptics.dart';
import '../../core/theme/app_colors.dart';
import 'challenge_screen.dart' show TimeChips;
import 'challenge_widgets.dart';

/* ── settings: reminders · path · restart ───────────────────────────────── */

Future<void> showChallengeSettings(BuildContext context, {required String lang}) => showChallengeSheet<void>(
      context,
      title: t('ch.hub.settings'),
      closeLabel: t('ch.settings.done'),
      builder: (_) => _SettingsBody(lang: lang),
    );

class _SettingsBody extends StatefulWidget {
  const _SettingsBody({required this.lang});
  final String lang;
  @override
  State<_SettingsBody> createState() => _SettingsBodyState();
}

class _SettingsBodyState extends State<_SettingsBody> {
  bool _confirm = false;

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<int>(
      valueListenable: ChallengeStore.revision,
      builder: (context, _, __) {
        final s = ChallengeStore.state;
        final r = s.reminders;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: chCard(radius: 18, color: AppColors.background.withValues(alpha: 0.5)),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      LucideIconLite('bell', size: 18, color: AppColors.primary),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(t('ch.settings.reminders'),
                            style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.foreground)),
                      ),
                      ChSwitch(
                        on: r.enabled,
                        label: t('ch.settings.reminders'),
                        onToggle: () {
                          final enabled = !r.enabled;
                          ChallengeStore.setReminders(enabled: enabled);
                          if (enabled) ChallengeReminderService.requestPermission().then((_) => ChallengeReminderService.sync());
                          Analytics.capture('challenge_reminders_toggled', {'enabled': enabled});
                        },
                      ),
                    ],
                  ),
                  if (r.enabled) ...[
                    const SizedBox(height: 16),
                    Text(upper(t('ch.settings.morning')), style: ChInk.eyebrow(12.5, AppColors.mutedForeground, tracking: 0.14)),
                    const SizedBox(height: 8),
                    TimeChips(
                      times: const ['06:00', '07:00', '08:00', '09:00'],
                      selected: r.morning,
                      lang: widget.lang,
                      onSelect: (v) => ChallengeStore.setReminders(morning: v),
                    ),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        Expanded(
                          child: Text(t('ch.settings.evening'), style: TextStyle(fontSize: 14, height: 1.3, color: AppColors.foreground)),
                        ),
                        ChSwitch(
                          on: r.evening,
                          label: t('ch.settings.evening'),
                          onToggle: () => ChallengeStore.setReminders(evening: !r.evening),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 18),
            Text(upper(t('ch.settings.path')), style: ChInk.eyebrow(12.5, AppColors.mutedForeground, tracking: 0.14)),
            const SizedBox(height: 8),
            IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  for (final m in const ['grace', 'covenant']) ...[
                    if (m == 'covenant') const SizedBox(width: 8),
                    Expanded(
                      child: GestureDetector(
                        onTap: () {
                          haptic(HapticStyle.light);
                          ChallengeStore.setMode(m);
                          Analytics.capture('challenge_mode_changed', {'mode': m});
                        },
                        child: Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: s.mode == m ? AppColors.primary.withValues(alpha: 0.1) : AppColors.background.withValues(alpha: 0.5),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: s.mode == m ? AppColors.primary.withValues(alpha: 0.7) : AppColors.border.withValues(alpha: 0.7)),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(t('ch.mode.$m.t'), style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700, color: AppColors.foreground)),
                              const SizedBox(height: 4),
                              Text(t('ch.mode.$m.s'),
                                  maxLines: 3,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(fontSize: 12, height: 1.3, color: AppColors.mutedForeground)),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 20),
            if (!_confirm)
              OutlineButton(
                label: t('ch.settings.restart'),
                icon: 'rotate-ccw',
                color: AppColors.destructive,
                borderColor: AppColors.destructive.withValues(alpha: 0.4),
                onTap: () {
                  haptic(HapticStyle.light);
                  setState(() => _confirm = true);
                },
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
                    Text(t('ch.settings.restartConfirm'), style: TextStyle(fontSize: 14, height: 1.35, color: AppColors.foreground)),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(child: OutlineButton(label: t('ch.circle.cancel'), height: 42, onTap: () => setState(() => _confirm = false))),
                        const SizedBox(width: 8),
                        Expanded(
                          child: GestureDetector(
                            onTap: () {
                              haptic(HapticStyle.heavy);
                              Analytics.capture('challenge_restarted', {'completed': s.completed.length});
                              ChallengeStore.reset();
                              Navigator.of(context).pop();
                            },
                            child: Container(
                              height: 42,
                              alignment: Alignment.center,
                              decoration: BoxDecoration(color: AppColors.destructive, borderRadius: BorderRadius.circular(999)),
                              child: Text(t('ch.settings.confirm'),
                                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Colors.white)),
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
      },
    );
  }
}

/* ── circles: profile → create / join ───────────────────────────────────── */

/// Returns the circle id once created or joined, else null.
Future<String?> showCircleFlow(BuildContext context, String flow, {required String lang, String initialCode = ''}) {
  final hasIdentity = ChallengeCircleService.identity != null;
  final title = !hasIdentity
      ? t('ch.circle.youTitle')
      : flow == 'create'
          ? t('ch.circle.newTitle')
          : t('ch.circle.joinTitle');
  return showChallengeSheet<String>(
    context,
    title: title,
    closeLabel: t('ch.back'),
    builder: (_) => _CircleFlowBody(flow: flow, lang: lang, initialCode: initialCode),
  );
}

class _CircleFlowBody extends StatefulWidget {
  const _CircleFlowBody({required this.flow, required this.lang, required this.initialCode});
  final String flow;
  final String lang;
  final String initialCode;
  @override
  State<_CircleFlowBody> createState() => _CircleFlowBodyState();
}

class _CircleFlowBodyState extends State<_CircleFlowBody> {
  late bool _profile = ChallengeCircleService.identity == null;
  late final _name = TextEditingController(text: ChallengeCircleService.identity?.name ?? '');
  late String _avatar = ChallengeCircleService.identity?.avatar ?? kCircleAvatars.first;
  final _circleName = TextEditingController();
  String _emoji = kCircleEmojis.first;
  late final _code = TextEditingController(text: widget.initialCode.toUpperCase());
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    _circleName.dispose();
    _code.dispose();
    super.dispose();
  }

  Future<void> _saveProfile() async {
    final clean = _name.text.trim();
    if (clean.isEmpty) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ChallengeCircleService.ensureIdentity(clean, _avatar, widget.lang);
      Analytics.capture('challenge_circle_profile_saved');
      haptic(HapticStyle.soft);
      if (mounted) setState(() => _profile = false);
    } catch (e) {
      if (mounted) setState(() => _error = circleErrorKey(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _submit() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final String id;
      if (widget.flow == 'create') {
        final name = _circleName.text.trim().isEmpty ? t('ch.circle.namePlaceholder') : _circleName.text.trim();
        id = await ChallengeCircleService.createCircle(name, _emoji);
        Analytics.capture('challenge_circle_created');
      } else {
        id = await ChallengeCircleService.joinCircle(_code.text);
        Analytics.capture('challenge_circle_joined');
      }
      haptic(HapticStyle.heavy);
      if (mounted) Navigator.of(context).pop(id);
    } catch (e) {
      haptic(HapticStyle.medium);
      if (mounted) setState(() => _error = circleErrorKey(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _paste() async {
    try {
      final data = await Clipboard.getData('text/plain');
      final matches = RegExp(r'\b[A-Z0-9]{6}\b').allMatches((data?.text ?? '').toUpperCase()).toList();
      if (matches.isNotEmpty) setState(() => _code.text = matches.last.group(0)!);
    } catch (_) {}
  }

  InputDecoration _field(String hint) => InputDecoration(
        hintText: hint,
        hintStyle: TextStyle(color: AppColors.mutedForeground.withValues(alpha: 0.7)),
        filled: true,
        fillColor: AppColors.background,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide(color: AppColors.border)),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide(color: AppColors.primary.withValues(alpha: 0.6), width: 2)),
        counterText: '',
      );

  Widget _label(String text) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Text(upper(text), style: ChInk.eyebrow(12, AppColors.mutedForeground, tracking: 0.16)),
      );

  Widget _emojiGrid(List<String> items, String selected, ValueChanged<String> onPick, {required int columns, double size = 24}) =>
      GridView.count(
        crossAxisCount: columns,
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        mainAxisSpacing: 8,
        crossAxisSpacing: 8,
        children: [
          for (final e in items)
            GestureDetector(
              onTap: () {
                haptic(HapticStyle.light);
                onPick(e);
              },
              child: Container(
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: selected == e ? AppColors.primary.withValues(alpha: 0.2) : AppColors.muted.withValues(alpha: 0.6),
                  borderRadius: BorderRadius.circular(16),
                  border: selected == e ? Border.all(color: AppColors.primary, width: 2) : null,
                ),
                child: Text(e, style: TextStyle(fontSize: size)),
              ),
            ),
        ],
      );

  Widget _errorText() => _error == null
      ? const SizedBox.shrink()
      : Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Text(t(_error!), style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.destructive)),
        );

  Widget _cta(String label, VoidCallback? onTap) => _busy
      ? SizedBox(height: 52, child: Center(child: SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.4, color: AppColors.primary))))
      : GoldButton(label: label, onTap: onTap);

  @override
  Widget build(BuildContext context) {
    final style = TextStyle(fontSize: 16, color: AppColors.foreground);
    if (_profile) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _label(t('ch.circle.yourName')),
          TextField(
            controller: _name,
            maxLength: 24,
            autofocus: true,
            style: style,
            onChanged: (_) => setState(() {}),
            decoration: _field(t('ch.circle.yourNamePlaceholder')),
          ),
          const SizedBox(height: 18),
          _label(t('ch.circle.avatar')),
          _emojiGrid(kCircleAvatars, _avatar, (v) => setState(() => _avatar = v), columns: 6),
          const SizedBox(height: 18),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: AppColors.muted.withValues(alpha: 0.5), borderRadius: BorderRadius.circular(16)),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                LucideIconLite('shield-check', size: 16, color: AppColors.primary),
                const SizedBox(width: 8),
                Expanded(child: Text(t('ch.circle.privacy'), style: TextStyle(fontSize: 12.5, height: 1.35, color: AppColors.mutedForeground))),
              ],
            ),
          ),
          const SizedBox(height: 18),
          _errorText(),
          _cta(t('ch.circle.continue'), _name.text.trim().isEmpty ? null : _saveProfile),
        ],
      );
    }
    if (widget.flow == 'create') {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _label(t('ch.circle.nameLabel')),
          TextField(controller: _circleName, maxLength: 32, autofocus: true, style: style, decoration: _field(t('ch.circle.namePlaceholder'))),
          const SizedBox(height: 18),
          _label(t('ch.circle.emojiLabel')),
          _emojiGrid(kCircleEmojis, _emoji, (v) => setState(() => _emoji = v), columns: 8, size: 21),
          const SizedBox(height: 18),
          _errorText(),
          _cta(t('ch.circle.create'), _submit),
        ],
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _label(t('ch.circle.codeLabel')),
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _code,
                autofocus: true,
                textAlign: TextAlign.center,
                textCapitalization: TextCapitalization.characters,
                maxLength: 6,
                inputFormatters: [
                  FilteringTextInputFormatter.allow(RegExp(r'[A-Za-z0-9]')),
                  TextInputFormatter.withFunction((o, n) => n.copyWith(text: n.text.toUpperCase())),
                ],
                onChanged: (_) => setState(() {}),
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, letterSpacing: 8, fontFamily: 'monospace', color: AppColors.foreground),
                decoration: _field('K7P2QX'),
              ),
            ),
            const SizedBox(width: 8),
            SizedBox(
              height: 52,
              child: OutlineButton(label: t('ch.circle.paste'), height: 52, onTap: _paste),
            ),
          ],
        ),
        const SizedBox(height: 18),
        _errorText(),
        _cta(t('ch.circle.join'), _code.text.length == 6 ? _submit : null),
      ],
    );
  }
}
