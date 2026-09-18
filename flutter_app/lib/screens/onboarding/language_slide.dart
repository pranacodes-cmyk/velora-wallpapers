import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/services/analytics.dart';
import '../../core/services/haptics.dart';
import '../../core/services/prefs.dart';
import '../../state/app_providers.dart';
import 'onboarding_shared.dart';

/// 1:1 port of `src/components/onboarding/LanguageSlide.tsx`.
/// Step 0: full-screen language picker, device language pre-selected,
/// tap only moves the selection, the real switch happens on Continue.
const _nativePrompt = <String, String>{
  'en': 'Choose your language',
  'es': 'Elige tu idioma',
  'pt': 'Escolha seu idioma',
  'fil': 'Piliin ang iyong wika',
  'hi': 'अपनी भाषा चुनें',
  'id': 'Pilih bahasa Anda',
  'fr': 'Choisissez votre langue',
  'de': 'Wähle deine Sprache',
};

const _nativeContinue = <String, String>{
  'en': 'Continue',
  'es': 'Continuar',
  'pt': 'Continuar',
  'fil': 'Magpatuloy',
  'hi': 'आगे बढ़ें',
  'id': 'Lanjutkan',
  'fr': 'Continuer',
  'de': 'Weiter',
};

const _nativeHint = <String, String>{
  'en': 'You can change this any time in Settings.',
  'es': 'Puedes cambiarlo cuando quieras en Ajustes.',
  'pt': 'Você pode mudar isso quando quiser nos Ajustes.',
  'fil': 'Mababago mo ito anumang oras sa Settings.',
  'hi': 'आप इसे कभी भी सेटिंग्स में बदल सकते हैं।',
  'id': 'Anda bisa mengubahnya kapan saja di Pengaturan.',
  'fr': 'Vous pouvez le changer à tout moment dans les Réglages.',
  'de': 'Du kannst das jederzeit in den Einstellungen ändern.',
};

class LanguageSlide extends ConsumerStatefulWidget {
  const LanguageSlide({super.key, required this.onDone});

  final VoidCallback onDone;

  @override
  ConsumerState<LanguageSlide> createState() => _LanguageSlideState();
}

class _LanguageSlideState extends ConsumerState<LanguageSlide> {
  late String _picked = ref.read(languageProvider);
  bool _busy = false;

  void _choose(String code) {
    if (_busy || code == _picked) return;
    setState(() => _picked = code);
    haptic(HapticStyle.soft);
  }

  Future<void> _confirm() async {
    if (_busy) return;
    setState(() => _busy = true);
    haptic(HapticStyle.medium);
    await Prefs.setString(Onb.langPickedKey, _picked);
    Analytics.capture('onboarding_language_picked', {'lang': _picked});
    if (_picked != ref.read(languageProvider)) {
      await ref.read(languageProvider.notifier).change(_picked);
    }
    widget.onDone();
  }

  @override
  Widget build(BuildContext context) {
    final insets = MediaQuery.of(context).padding;
    final topPad = insets.top > 18 ? insets.top : 18.0;
    final bottomPad = insets.bottom > 24 ? insets.bottom : 24.0;

    return ColoredBox(
      color: Onb.canvas,
      child: Stack(
        children: [
          // Soft royal-gold glow behind the header
          Positioned(
            top: -MediaQuery.of(context).size.height * 0.18,
            left: -MediaQuery.of(context).size.width * 0.25,
            child: IgnorePointer(
              child: Container(
                width: MediaQuery.of(context).size.width * 1.5,
                height: MediaQuery.of(context).size.width * 1.5,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [Color(0x29E8B02C), Colors.transparent],
                    stops: [0, 0.62],
                  ),
                ),
              ),
            ),
          ),
          Padding(
            padding: EdgeInsets.fromLTRB(24, topPad, 24, bottomPad),
            child: Column(
              children: [
                SizedBox(height: clampVh(context, 18, 5, 54)),
                const Text(
                  'Prayly',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 3.4,
                    color: Onb.goldLabel,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  _nativePrompt[_picked] ?? _nativePrompt['en']!,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: clampVh(context, 20, 3.1, 27),
                    fontWeight: FontWeight.w700,
                    height: 1.2,
                    color: Onb.headlineColor,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  _nativeHint[_picked] ?? _nativeHint['en']!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 12.5,
                    height: 1.5,
                    color: Onb.subColor,
                  ),
                ),
                SizedBox(height: clampVh(context, 14, 3.4, 30)),
                Expanded(
                  child: SingleChildScrollView(
                    child: GridView.count(
                      crossAxisCount: 2,
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      mainAxisSpacing: clampVw(context, 8, 2, 12),
                      crossAxisSpacing: clampVw(context, 8, 2, 12),
                      childAspectRatio:
                          (MediaQuery.of(context).size.width / 2 - 30) /
                          clampVh(context, 76, 11, 104),
                      children: [
                        for (final opt in kLanguages)
                          _LangCard(
                            option: opt,
                            active: opt.code == _picked,
                            onTap: () => _choose(opt.code),
                          ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Opacity(
                  opacity: _busy ? 0.7 : 1,
                  child: GestureDetector(
                    onTap: _confirm,
                    child: Container(
                      width: double.infinity,
                      padding: EdgeInsets.symmetric(
                        vertical: clampVh(context, 13, 1.9, 17),
                      ),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(16),
                        gradient: Onb.goldGradient,
                        boxShadow: const [
                          BoxShadow(
                            color: Color(0xBFE8B02C),
                            blurRadius: 34,
                            spreadRadius: -16,
                            offset: Offset(0, 14),
                          ),
                        ],
                      ),
                      child: Text(
                        _nativeContinue[_picked] ?? _nativeContinue['en']!,
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: clampVw(context, 14.5, 4.2, 15.5),
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.15,
                          color: Onb.ctaText,
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _LangCard extends StatelessWidget {
  const _LangCard({
    required this.option,
    required this.active,
    required this.onTap,
  });

  final AppLanguage option;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 140),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          gradient: active
              ? const LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [Color(0x2EE8B02C), Color(0x0FFFB04F)],
                )
              : null,
          color: active ? null : const Color(0xE6101B2B),
          border: Border.all(
            color: active ? const Color(0x99EFC04F) : const Color(0x995A6478),
          ),
          boxShadow: active
              ? const [
                  BoxShadow(
                    color: Color(0x99E8B02C),
                    blurRadius: 26,
                    spreadRadius: -14,
                    offset: Offset(0, 10),
                  ),
                ]
              : null,
        ),
        child: Stack(
          children: [
            if (active)
              Positioned(
                top: 8,
                right: 8,
                child: Container(
                  width: 20,
                  height: 20,
                  decoration: const BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: Onb.goldGradient,
                  ),
                  child: const Icon(
                    Icons.check,
                    size: 12,
                    color: Onb.ctaText,
                    weight: 800,
                  ),
                ),
              ),
            Center(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      option.flag,
                      style: TextStyle(
                        fontSize: clampVh(context, 20, 2.9, 26),
                        height: 1,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      option.native,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: clampVw(context, 12.5, 3.6, 14),
                        fontWeight: FontWeight.w600,
                        height: 1.15,
                        color: Onb.headlineColor,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      option.label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: clampVw(context, 10, 2.8, 11),
                        height: 1.15,
                        color: Onb.dimColor,
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
}
