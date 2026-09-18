import 'package:flutter/foundation.dart';

import '../localization/app_localizations.dart';
import 'prefs.dart';

/// 1:1 port of `src/lib/personalCross.ts` — the engraved name + verse used by
/// the 3D cross preview. Same keys, same 22-character cap, same fallback onto
/// the onboarding name (`cw_user_name`) so the engraving is personalized out of
/// the box, and the same localized verse lines (`cross.<id>` content keys).
class PersonalVerse {
  const PersonalVerse({
    required this.id,
    required this.text,
    required this.reference,
  });

  final String id;
  final String text;
  final String reference;
}

const kPersonalVerses = <PersonalVerse>[
  PersonalVerse(
    id: 'john-3-16',
    text: 'For God so loved the world.',
    reference: 'John 3:16',
  ),
  PersonalVerse(
    id: 'phil-4-13',
    text: 'I can do all things through Christ.',
    reference: 'Philippians 4:13',
  ),
  PersonalVerse(
    id: 'psalm-23-1',
    text: 'The Lord is my shepherd.',
    reference: 'Psalm 23:1',
  ),
  PersonalVerse(
    id: 'jer-29-11',
    text: 'Plans to prosper you, not to harm you.',
    reference: 'Jeremiah 29:11',
  ),
  PersonalVerse(
    id: 'prov-3-5',
    text: 'Trust in the Lord with all your heart.',
    reference: 'Proverbs 3:5',
  ),
  PersonalVerse(
    id: 'isa-41-10',
    text: 'Fear not, for I am with you.',
    reference: 'Isaiah 41:10',
  ),
  PersonalVerse(
    id: 'rom-8-28',
    text: 'All things work together for good.',
    reference: 'Romans 8:28',
  ),
  PersonalVerse(
    id: 'psalm-46-10',
    text: 'Be still, and know that I am God.',
    reference: 'Psalm 46:10',
  ),
  PersonalVerse(
    id: 'matt-11-28',
    text: 'Come to me, and I will give you rest.',
    reference: 'Matthew 11:28',
  ),
  PersonalVerse(
    id: 'john-14-6',
    text: 'I am the way, the truth, and the life.',
    reference: 'John 14:6',
  ),
];

class PersonalCross {
  PersonalCross._();

  static const _nameKey = 'prayly.personalCross.name';
  static const _verseKey = 'prayly.personalCross.verseId';
  static const _onboardingNameKey = 'cw_user_name';

  /// Stands in for the `prayly.personalCross.changed` window event.
  static final revision = ValueNotifier<int>(0);

  /// Localized copy of an engraved verse (short line + translated reference).
  static PersonalVerse localize(PersonalVerse v) => PersonalVerse(
    id: v.id,
    text: tc('cross.${v.id}') ?? v.text,
    reference: tc('r.${v.reference}') ?? v.reference,
  );

  static List<PersonalVerse> verses() => kPersonalVerses.map(localize).toList();

  static String name() {
    try {
      final explicit = (Prefs.getString(_nameKey) ?? '').trim();
      if (explicit.isNotEmpty) {
        return explicit.substring(0, math_min(explicit.length, 22));
      }
      final onboarding = (Prefs.getString(_onboardingNameKey) ?? '').trim();
      return onboarding.substring(0, math_min(onboarding.length, 22));
    } catch (_) {
      return '';
    }
  }

  static PersonalVerse verse() {
    final id = Prefs.getString(_verseKey);
    final found = kPersonalVerses.where((v) => v.id == id);
    return localize(found.isEmpty ? kPersonalVerses.first : found.first);
  }

  static Future<void> setPersonal(String name, String verseId) async {
    final clean = name.trim();
    await Prefs.setString(
      _nameKey,
      clean.substring(0, math_min(clean.length, 22)),
    );
    await Prefs.setString(_verseKey, verseId);
    revision.value++;
  }

  /// Glow colour — drives the god-rays/halo tint in the preview and is passed
  /// to the native GLES wallpaper as `tintColor`.
  static GlowChoice glow() {
    final id = Prefs.getString(_glowKey);
    final found = kGlowColors.where((g) => g.id == id);
    return found.isEmpty ? kGlowColors.first : found.first;
  }

  static Future<void> setGlow(String id) async {
    await Prefs.setString(_glowKey, id);
    revision.value++;
  }

  static const _glowKey = 'prayly.personalCross.glow';
}

/// 1:1 port of `GlowChoice` / `GLOW_COLORS` in `src/lib/personalCross.ts`.
class GlowChoice {
  const GlowChoice({required this.id, required this.name, required this.hex});

  final String id;
  final String name;
  final String hex;
}

const kGlowColors = <GlowChoice>[
  GlowChoice(id: 'gold', name: 'Royal Gold', hex: '#FFB74D'),
  GlowChoice(id: 'dawn', name: 'Dawn Amber', hex: '#FF7A29'),
  GlowChoice(id: 'crimson', name: 'Sacred Crimson', hex: '#FF4D5E'),
  GlowChoice(id: 'heaven', name: 'Heaven Blue', hex: '#6FA8FF'),
  GlowChoice(id: 'olive', name: 'Olive Peace', hex: '#8FD98A'),
  GlowChoice(id: 'pearl', name: 'Pearl White', hex: '#FFF3DC'),
];

int math_min(int a, int b) => a < b ? a : b;
