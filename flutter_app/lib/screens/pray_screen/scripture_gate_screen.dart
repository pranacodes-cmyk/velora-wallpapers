import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/services/analytics.dart';
import '../../core/services/bible_gate_service.dart';
import '../../core/theme/app_colors.dart';
import '../../state/app_providers.dart';
import '../../widgets/lucide.dart';
import '../../widgets/premium_sheet.dart';

/// Pro Sacred Pause: one KJV verse at a time, continuing where the user left
/// off. Continue is always available — reading is invited, never forced.
/// `showcase` = opened from the Shield card: free users see a preview with a
/// paywall that opens ON TOP of this screen; the moment Pro lands the screen
/// turns live (progress saves) without the user having to close it.
class ScriptureGateScreen extends ConsumerStatefulWidget {
  const ScriptureGateScreen({super.key, this.showcase = false});
  final bool showcase;

  @override
  ConsumerState<ScriptureGateScreen> createState() => _ScriptureGateScreenState();
}

class _ScriptureGateScreenState extends ConsumerState<ScriptureGateScreen> {
  List<BibleVerse>? _verses;
  int _index = 0;
  bool _justUnlocked = false;

  bool get _preview => widget.showcase && !ref.read(premiumProvider);

  @override
  void initState() {
    super.initState();
    BibleGateService.loadPassage().then((v) {
      if (!mounted) return;
      setState(() => _verses = v);
      if (v.isNotEmpty) Analytics.capture('scripture_gate_shown', {'reference': v.first.reference, 'preview': _preview});
    });
  }

  void _upgrade() {
    Analytics.capture('scripture_gate_upgrade_tapped', {});
    showModalBottomSheet(
      context: context,
      useRootNavigator: true,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) => PremiumSheet(
        trigger: 'scripture_gate',
        onClose: () => Navigator.pop(sheetContext),
        onUnlock: () => ref.read(premiumProvider.notifier).setUnlocked(),
      ),
    );
  }

  Future<void> _finish() async {
    final v = _verses;
    if (v != null && v.isNotEmpty && !_preview) {
      await BibleGateService.markRead(v[_index].id, _index + 1);
      Analytics.capture('scripture_gate_completed', {'from': v.first.reference, 'to': v[_index].reference, 'verses_read': _index + 1});
    }
    if (mounted) Navigator.of(context).maybePop();
  }

  @override
  Widget build(BuildContext context) {
    final premium = ref.watch(premiumProvider);
    ref.listen<bool>(premiumProvider, (prev, next) {
      if (next && prev != true && widget.showcase) {
        BibleGateService.setEnabled(true);
        setState(() => _justUnlocked = true);
      }
    });
    final preview = widget.showcase && !premium;
    final verses = _verses;
    final verse = (verses != null && verses.isNotEmpty) ? verses[_index] : null;
    final last = verses == null || _index >= verses.length - 1;
    const pill = StadiumBorder();
    final primaryStyle = FilledButton.styleFrom(backgroundColor: AppColors.primary, foregroundColor: AppColors.primaryForeground, padding: const EdgeInsets.symmetric(vertical: 17), shape: pill);
    return Scaffold(
      backgroundColor: AppColors.background,
      body: DecoratedBox(
        decoration: BoxDecoration(gradient: RadialGradient(center: const Alignment(0, -.55), radius: 1.15, colors: [AppColors.primary.withValues(alpha: .16), AppColors.background])),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(28, 14, 28, 22),
            child: Column(children: [
              Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                LucideIcon('book-open', size: 14, color: AppColors.primary),
                const SizedBox(width: 6),
                Text('ENGLISH BIBLE · KJV', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, letterSpacing: 1.6, color: AppColors.primary)),
                if (preview) Container(margin: const EdgeInsets.only(left: 6), padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2), decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(99)), child: Text('PRO', style: TextStyle(fontSize: 8.5, fontWeight: FontWeight.w900, color: AppColors.primaryForeground))),
              ]),
              if (_justUnlocked)
                Container(
                  margin: const EdgeInsets.only(top: 14),
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: .14), borderRadius: BorderRadius.circular(99), border: Border.all(color: AppColors.goldBorder)),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    LucideIcon('crown', size: 14, color: AppColors.primary),
                    const SizedBox(width: 8),
                    Text('You’re Pro · Bible is now on your Shield', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: AppColors.foreground)),
                  ]),
                ),
              Expanded(
                child: Center(
                  child: SingleChildScrollView(
                    child: verse == null
                        ? Text(verses == null ? 'Opening Scripture…' : 'Scripture needs a connection the first time.', textAlign: TextAlign.center, style: TextStyle(fontSize: 14, color: AppColors.fg(0.6)))
                        : AnimatedSwitcher(
                            duration: const Duration(milliseconds: 300),
                            child: Column(key: ValueKey(verse.id), children: [
                              Text(verse.reference.toUpperCase(), textAlign: TextAlign.center, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, letterSpacing: 1.6, color: AppColors.primary)),
                              const SizedBox(height: 20),
                              Text('“${verse.text}”', textAlign: TextAlign.center, style: TextStyle(fontFamily: 'Cormorant Garamond', fontSize: 27, height: 1.3, fontWeight: FontWeight.w700, color: AppColors.foreground)),
                              const SizedBox(height: 28),
                              Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                                for (var i = 0; i < verses!.length; i++)
                                  AnimatedContainer(duration: const Duration(milliseconds: 250), margin: const EdgeInsets.symmetric(horizontal: 3), width: i <= _index ? 20 : 6, height: 6, decoration: BoxDecoration(color: i <= _index ? AppColors.primary : AppColors.primary.withValues(alpha: .25), borderRadius: BorderRadius.circular(99))),
                              ]),
                            ]),
                          ),
                  ),
                ),
              ),
              if (verse != null && !last)
                SizedBox(width: double.infinity, child: FilledButton(onPressed: () => setState(() => _index++), style: primaryStyle, child: const Text('Next verse', style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w900)))),
              if (preview && last)
                SizedBox(width: double.infinity, child: FilledButton.icon(onPressed: _upgrade, icon: LucideIcon('crown', size: 16, color: AppColors.primaryForeground), label: const Text('Read the whole Bible with Pro', style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w900)), style: primaryStyle)),
              const SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                child: (!preview && (verse == null || last))
                    ? FilledButton(onPressed: _finish, style: primaryStyle.copyWith(padding: const WidgetStatePropertyAll(EdgeInsets.symmetric(vertical: 15))), child: const Text('I’ve read this · Continue', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w900)))
                    : TextButton(onPressed: _finish, style: TextButton.styleFrom(foregroundColor: AppColors.foreground, padding: const EdgeInsets.symmetric(vertical: 14), shape: pill), child: Text(preview ? 'Close preview' : 'I’ve read this · Continue', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w900))),
              ),
            ]),
          ),
        ),
      ),
    );
  }
}
