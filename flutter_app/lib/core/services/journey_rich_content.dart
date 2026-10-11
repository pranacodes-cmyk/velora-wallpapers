import 'dart:convert';

import 'package:flutter/services.dart';
import 'ota_service.dart';

/// Port of `src/data/journeyRichContent.ts`.
/// Loads `assets/data/journey_rich_content.json`, keyed as
/// `"$journeyId::$day"`, and caches the parsed result after first load.
class RichBreathPrayer {
  const RichBreathPrayer({required this.inhale, required this.exhale});

  final String inhale;
  final String exhale;

  factory RichBreathPrayer.fromJson(Map<String, dynamic> json) =>
      RichBreathPrayer(
        inhale: json['inhale'] as String? ?? '',
        exhale: json['exhale'] as String? ?? '',
      );
}

/// `RichSlide.kind` drives the visual treatment of the slide.
enum RichSlideKind { opening, verse, meaning, pray }

RichSlideKind _parseKind(String? raw) {
  switch (raw) {
    case 'verse':
      return RichSlideKind.verse;
    case 'meaning':
      return RichSlideKind.meaning;
    case 'pray':
      return RichSlideKind.pray;
    case 'opening':
    default:
      return RichSlideKind.opening;
  }
}

class RichSlide {
  const RichSlide({
    required this.kind,
    required this.eyebrow,
    required this.title,
    required this.paragraphs,
    this.verse,
    this.reference,
    this.breathPrayer,
    this.prayer,
    this.tinyActions,
    required this.continueLabel,
  });

  final RichSlideKind kind;
  final String eyebrow;
  final String title;
  final List<String> paragraphs;
  final String? verse;
  final String? reference;
  final RichBreathPrayer? breathPrayer;
  final String? prayer;
  final List<String>? tinyActions;
  final String continueLabel;

  factory RichSlide.fromJson(Map<String, dynamic> json) {
    final breathPrayerJson = json['breathPrayer'];
    return RichSlide(
      kind: _parseKind(json['kind'] as String?),
      eyebrow: json['eyebrow'] as String? ?? '',
      title: json['title'] as String? ?? '',
      paragraphs:
          (json['paragraphs'] as List?)?.map((e) => '$e').toList() ?? const [],
      verse: json['verse'] as String?,
      reference: json['reference'] as String?,
      breathPrayer: breathPrayerJson is Map
          ? RichBreathPrayer.fromJson(breathPrayerJson.cast<String, dynamic>())
          : null,
      prayer: json['prayer'] as String?,
      tinyActions: (json['tinyActions'] as List?)?.map((e) => '$e').toList(),
      continueLabel: json['continueLabel'] as String? ?? '',
    );
  }
}

class RichDay {
  const RichDay({required this.slides});

  final List<RichSlide> slides;

  factory RichDay.fromJson(Map<String, dynamic> json) => RichDay(
    slides:
        (json['slides'] as List?)
            ?.map((e) => RichSlide.fromJson((e as Map).cast<String, dynamic>()))
            .toList() ??
        const [],
  );
}

class JourneyRichContent {
  JourneyRichContent._();

  static const _assetPath = 'assets/data/journey_rich_content.json';
  static Map<String, RichDay>? _cache;

  static Future<Map<String, RichDay>> _load() async {
    final cached = _cache;
    if (cached != null) return cached;
    try {
      final raw = await OtaService.loadString(_assetPath);
      final decoded = jsonDecode(raw) as Map<String, dynamic>;
      final parsed = decoded.map(
        (key, value) => MapEntry(
          key,
          RichDay.fromJson((value as Map).cast<String, dynamic>()),
        ),
      );
      _cache = parsed;
      return parsed;
    } catch (_) {
      _cache = const {};
      return const {};
    }
  }

  /// Synchronous lookup — returns null until [preload] has completed at
  /// least once. Callers that can't await should call [preload] up front
  /// (e.g. in `initState`) and rebuild once it resolves.
  static Map<String, RichDay>? get cachedOrNull => _cache;

  static Future<void> preload() => _load();

  static Future<RichDay?> getRichDay(String journeyId, int day) async {
    final all = await _load();
    return all['$journeyId::$day'];
  }

  /// Synchronous variant for use after [preload]/[getRichDay] has already
  /// warmed the cache once (e.g. from build methods).
  static RichDay? getRichDaySync(String journeyId, int day) {
    return _cache?['$journeyId::$day'];
  }
}
