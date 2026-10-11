// Port of `src/lib/narrationScript.ts` — shared narration script composer.
// Used by the narration player so the text sent to the backend (and the
// resulting cached MP3) stays byte-identical to the web build's script.
import 'journey_rich_content.dart';

String composeNarrationScript(RichDay rich) {
  final parts = <String>[];

  for (var idx = 0; idx < rich.slides.length; idx++) {
    final s = rich.slides[idx];
    if (idx > 0) parts.add(''); // paragraph break

    if (s.kind == RichSlideKind.verse && s.verse != null) {
      final ref = s.reference != null
          ? s.reference!
                .replaceFirstMapped(
                  RegExp(r'(\d+):(\d+)'),
                  (m) => 'chapter ${m[1]}, verse ${m[2]}',
                )
                .replaceFirstMapped(
                  RegExp(r'^(\w+)\s+(chapter)'),
                  (m) => '${m[1]}, ${m[2]}',
                )
          : 'scripture';
      parts.add(s.title);
      parts.add('');
      parts.add('From $ref…');
      parts.add('');
      parts.add('"${s.verse}"');
      parts.add('');
      parts.addAll(s.paragraphs);
      continue;
    }

    if (s.kind == RichSlideKind.pray) {
      if (s.title.isNotEmpty) parts.add(s.title);
      parts.add('');
      final breathPrayer = s.breathPrayer;
      if (breathPrayer != null) {
        parts.add(
          'Breathe in… ${breathPrayer.inhale}. Breathe out… ${breathPrayer.exhale}.',
        );
        parts.add('');
      }
      parts.addAll(s.paragraphs);
      if (s.prayer != null) {
        parts.add('');
        final softened = s.prayer!
            .replaceFirstMapped(
              RegExp(r'^(Lord|Jesus|Father|God)([,.])', caseSensitive: false),
              (m) => '${m[1]},${m[2]}',
            )
            .replaceAllMapped(
              RegExp(r'(Lord|Jesus|Father|God),', caseSensitive: false),
              (m) => '${m[1]},',
            );
        parts.add(softened);
      }
      continue;
    }

    parts.add(s.title);
    parts.add('');
    parts.addAll(s.paragraphs);
  }

  final trimmed = parts.map((p) => p.trim()).toList();
  final result = <String>[];
  for (var i = 0; i < trimmed.length; i++) {
    if (trimmed[i].isEmpty && i > 0 && trimmed[i - 1].isEmpty) continue;
    result.add(trimmed[i]);
  }
  return result.join('\n\n');
}

/// Per-slide cumulative character ratio (0..1) within the composed script.
/// Used by the player to auto-advance slides as the voice progresses.
List<double> narrationSlideBoundaries(RichDay rich) {
  final lens = rich.slides.map((s) {
    final parts = <String>[s.title];
    if (s.kind == RichSlideKind.verse && s.verse != null) {
      parts.add(s.verse!);
      parts.add(s.reference ?? '');
    }
    final breathPrayer = s.breathPrayer;
    if (breathPrayer != null) {
      parts.add(breathPrayer.inhale);
      parts.add(breathPrayer.exhale);
    }
    parts.addAll(s.paragraphs);
    if (s.prayer != null) parts.add(s.prayer!);
    return parts.join(' ').length;
  }).toList();

  final total = lens.fold<int>(0, (a, b) => a + b);
  final safeTotal = total == 0 ? 1 : total;
  final cum = <double>[];
  var acc = 0;
  for (final l in lens) {
    acc += l;
    cum.add(acc / safeTotal);
  }
  return cum;
}
