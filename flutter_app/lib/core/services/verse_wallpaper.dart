import 'dart:io';
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/painting.dart';
import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import 'analytics.dart';
import 'content_data.dart';
import 'share_service.dart';

/// 1:1 port of the canvas renderer in `src/hooks/useVerseWallpaper.ts`.
///
/// Same 1170x2532 canvas, same layout constants, same gradient stops, cross,
/// date row, verse block, reference and Prayly branding footer — drawn with
/// `dart:ui` instead of a browser canvas, then shared as a real JPEG file
/// through the OS share sheet (the web build does exactly this on native via
/// Filesystem + Share).
class VerseWallpaper {
  const VerseWallpaper._();

  static const double w = 1170;
  static const double h = 2532;

  static const _gold = Color(0xFFF5CC6E);
  static const _goldSoft = Color(0xFFF5CC6E);
  static const _goldLine = Color(0xD9E8BC59); // rgba(232,188,89,0.85)

  static final Map<String, Uint8List> _cache = {};
  static final Map<String, Uint8List> _bgBytes = {};

  static const _months = [
    'JANUARY',
    'FEBRUARY',
    'MARCH',
    'APRIL',
    'MAY',
    'JUNE',
    'JULY',
    'AUGUST',
    'SEPTEMBER',
    'OCTOBER',
    'NOVEMBER',
    'DECEMBER',
  ];

  /// Renders today's verse wallpaper as JPEG-quality PNG bytes (Flutter's
  /// image encoder only emits PNG; the share sheet handles either).
  static Future<Uint8List?> render({DateTime? date}) async {
    final verse = ContentData.verseForDate(date);
    final bgUrl = ContentData.backgroundForDay(date)?.url;
    final key = '${bgUrl ?? ''}|${verse.reference}|${verse.text}';
    final hit = _cache[key];
    if (hit != null) return hit;

    ui.Image? bg;
    if (bgUrl != null) {
      try {
        var bytes = _bgBytes[bgUrl];
        if (bytes == null) {
          final res = await http.get(Uri.parse(bgUrl));
          if (res.statusCode == 200) {
            bytes = res.bodyBytes;
            _bgBytes[bgUrl] = bytes;
          }
        }
        if (bytes != null) {
          final codec = await ui.instantiateImageCodec(bytes);
          bg = (await codec.getNextFrame()).image;
        }
      } catch (_) {
        bg = null;
      }
    }

    final recorder = ui.PictureRecorder();
    final canvas = ui.Canvas(recorder, const ui.Rect.fromLTWH(0, 0, w, h));
    _paint(canvas, bg, verse.text, verse.reference, date ?? DateTime.now());
    final picture = recorder.endRecording();
    final image = await picture.toImage(w.round(), h.round());
    final data = await image.toByteData(format: ui.ImageByteFormat.png);
    image.dispose();
    bg?.dispose();
    if (data == null) return null;
    final bytes = data.buffer.asUint8List();
    _cache[key] = bytes;
    return bytes;
  }

  static void _paint(
    ui.Canvas canvas,
    ui.Image? bg,
    String verseText,
    String reference,
    DateTime today,
  ) {
    const full = ui.Rect.fromLTWH(0, 0, w, h);

    // ---- background (or the web's fallback gradient) ----
    if (bg != null) {
      canvas.drawImageRect(
        bg,
        ui.Rect.fromLTWH(0, 0, bg.width.toDouble(), bg.height.toDouble()),
        full,
        ui.Paint(),
      );
    } else {
      canvas.drawRect(
        full,
        ui.Paint()
          ..shader = const LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0xFF070B18), Color(0xFF14213F), Color(0xFF090611)],
            stops: [0, 0.45, 1],
          ).createShader(full),
      );
    }

    // ---- readability gradient (same stops as web) ----
    canvas.drawRect(
      full,
      ui.Paint()
        ..shader = const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            Color(0x2E000000), // 0.18
            Color(0x47000000), // 0.28
            Color(0x8C000000), // 0.55
            Color(0x9E000000), // 0.62
            Color(0x8C000000), // 0.55
            Color(0x66000000), // 0.40
            Color(0x8C000000), // 0.55
          ],
          stops: [0, 0.20, 0.38, 0.55, 0.72, 0.88, 1],
        ).createShader(full),
    );

    final blockCenterY = h * 0.42;
    final crossY = blockCenterY - 220;

    // ---- cross ----
    final crossPaint = ui.Paint()
      ..color = _gold
      ..style = ui.PaintingStyle.stroke
      ..strokeCap = ui.StrokeCap.round
      ..strokeWidth = 7
      ..maskFilter = const ui.MaskFilter.blur(ui.BlurStyle.normal, 11);
    const crossH = 72.0;
    const crossArm = 28.0;
    final crossArmY = crossY - crossH / 2 + 22;
    final glow = ui.Paint()
      ..color = const Color(0xF2F5CC6E)
      ..style = ui.PaintingStyle.stroke
      ..strokeCap = ui.StrokeCap.round
      ..strokeWidth = 7
      ..maskFilter = const ui.MaskFilter.blur(ui.BlurStyle.normal, 22);
    for (final p in [glow, crossPaint..maskFilter = null]) {
      canvas.drawLine(
        ui.Offset(w / 2, crossY - crossH / 2),
        ui.Offset(w / 2, crossY + crossH / 2),
        p,
      );
      canvas.drawLine(
        ui.Offset(w / 2 - crossArm, crossArmY),
        ui.Offset(w / 2 + crossArm, crossArmY),
        p,
      );
    }

    // ---- date row ----
    final dateLabel =
        '${_months[today.month - 1]} ${today.day} · ${today.year}';
    final dateY = crossY + 78;
    final datePainter = _text(
      dateLabel,
      fontSize: 24,
      weight: FontWeight.w700,
      color: _goldSoft,
      letterSpacing: 8,
      shadow: const ui.Shadow(color: Color(0xD9000000), blurRadius: 16),
    );
    datePainter.paint(
      canvas,
      ui.Offset(w / 2 + 4 - datePainter.width / 2, dateY - datePainter.height),
    );

    final linePaint = ui.Paint()
      ..color = _goldLine
      ..strokeWidth = 1;
    final halfText = datePainter.width / 2 + 24;
    const lineLen = 60.0;
    canvas.drawLine(
      ui.Offset(w / 2 - halfText - lineLen, dateY - 8),
      ui.Offset(w / 2 - halfText, dateY - 8),
      linePaint,
    );
    canvas.drawLine(
      ui.Offset(w / 2 + halfText, dateY - 8),
      ui.Offset(w / 2 + halfText + lineLen, dateY - 8),
      linePaint,
    );

    // ---- verse ----
    const maxTextWidth = w - 140;
    const fontSize = 64.0;
    const lineHeight = fontSize * 1.45;
    final versePainter = _text(
      '"$verseText"',
      fontSize: fontSize,
      weight: FontWeight.w600,
      color: const Color(0xFFFFFFFF),
      italic: true,
      height: 1.45,
      maxWidth: maxTextWidth,
      shadow: const ui.Shadow(
        color: Color(0xE6000000),
        blurRadius: 32,
        offset: ui.Offset(0, 5),
      ),
    );
    final textStartY = dateY + 100;
    versePainter.paint(
      canvas,
      ui.Offset(w / 2 - versePainter.width / 2, textStartY - fontSize),
    );
    final totalTextH = versePainter.computeLineMetrics().length * lineHeight;

    // ---- reference ----
    final refPainter = _text(
      '— ${reference.toUpperCase()}',
      fontSize: 28,
      weight: FontWeight.bold,
      color: _gold,
      letterSpacing: 5,
      shadow: const ui.Shadow(color: Color(0xA6000000), blurRadius: 14),
    );
    refPainter.paint(
      canvas,
      ui.Offset(
        w / 2 + 3 - refPainter.width / 2,
        textStartY + totalTextH + 44 - refPainter.height,
      ),
    );

    // ---- branding footer ----
    final brandY = h - 180;
    final divRect = ui.Rect.fromLTWH(w / 2 - 140, brandY - 46, 280, 1.5);
    canvas.drawRect(
      divRect,
      ui.Paint()
        ..shader = const LinearGradient(
          colors: [Color(0x00F5CC6E), Color(0xD9F5CC6E), Color(0x00F5CC6E)],
          stops: [0, 0.5, 1],
        ).createShader(divRect),
    );

    final brandCross = ui.Paint()
      ..color = _gold
      ..style = ui.PaintingStyle.stroke
      ..strokeCap = ui.StrokeCap.round
      ..strokeWidth = 3.5;
    final brandGlow = ui.Paint()
      ..color = const Color(0xD9F5CC6E)
      ..style = ui.PaintingStyle.stroke
      ..strokeCap = ui.StrokeCap.round
      ..strokeWidth = 3.5
      ..maskFilter = const ui.MaskFilter.blur(ui.BlurStyle.normal, 12);
    final bcx = w / 2;
    final bcy = brandY;
    for (final p in [brandGlow, brandCross]) {
      canvas.drawLine(ui.Offset(bcx, bcy - 18), ui.Offset(bcx, bcy + 12), p);
      canvas.drawLine(
        ui.Offset(bcx - 9, bcy - 9),
        ui.Offset(bcx + 9, bcy - 9),
        p,
      );
    }

    final wordmark = _text(
      'PRAYLY',
      fontSize: 36,
      weight: FontWeight.w700,
      color: _goldSoft,
      letterSpacing: 6,
      shadow: const ui.Shadow(color: Color(0xD9000000), blurRadius: 16),
    );
    wordmark.paint(
      canvas,
      ui.Offset(w / 2 + 3 - wordmark.width / 2, brandY + 52 - wordmark.height),
    );

    final tagline = _text(
      'BIBLE PRAYER & VERSE',
      fontSize: 20,
      weight: FontWeight.w500,
      color: const Color(0xC7FFFFFF), // rgba(255,255,255,0.78)
      letterSpacing: 4,
      shadow: const ui.Shadow(color: Color(0xB3000000), blurRadius: 12),
    );
    tagline.paint(
      canvas,
      ui.Offset(w / 2 + 2 - tagline.width / 2, brandY + 86 - tagline.height),
    );
  }

  static TextPainter _text(
    String value, {
    required double fontSize,
    required FontWeight weight,
    required Color color,
    double letterSpacing = 0,
    double height = 1,
    bool italic = false,
    double maxWidth = w,
    ui.Shadow? shadow,
  }) {
    final painter = TextPainter(
      text: TextSpan(
        text: value,
        style: TextStyle(
          // The web renderer uses Georgia / Times New Roman; Android's serif
          // family is the platform equivalent.
          fontFamily: 'serif',
          fontSize: fontSize,
          fontWeight: weight,
          fontStyle: italic ? FontStyle.italic : FontStyle.normal,
          color: color,
          letterSpacing: letterSpacing,
          height: height,
          shadows: shadow == null ? null : [shadow],
        ),
      ),
      textAlign: TextAlign.center,
      textDirection: TextDirection.ltr,
    )..layout(maxWidth: maxWidth);
    return painter;
  }

  /// Writes the rendered wallpaper to the cache directory and opens the OS
  /// share sheet with the same caption the web build uses.
  static Future<bool> share({DateTime? date}) async {
    final verse = ContentData.verseForDate(date);
    final bytes = await render(date: date);
    if (bytes == null) return false;
    final caption =
        '"${verse.text}" — ${verse.reference} ✝️\n\n📲 Get Prayly: Bible '
        'Prayer & Verse: $kAppPlayStoreUrl';
    try {
      final dir = await getTemporaryDirectory();
      final file = File(
        '${dir.path}/daily-verse-${DateTime.now().millisecondsSinceEpoch}.png',
      );
      await file.writeAsBytes(bytes, flush: true);
      final result = await SharePlus.instance.share(
        ShareParams(
          files: [XFile(file.path, mimeType: 'image/png')],
          text: caption,
          subject: 'Daily Bible Verse',
        ),
      );

      Analytics.capture('share_invoked', {
        'method': 'native_image',
        'status': result.status == ShareResultStatus.dismissed
            ? 'cancelled'
            : 'shown',
        'title': 'Daily Bible Verse',
      });
      return true;
    } catch (_) {
      // Same fallback order as the web hook: text-only share.
      await ShareService.share(
        title: 'Daily Bible Verse',
        text: '"${verse.text}" — ${verse.reference} ✝️',
      );
      return true;
    }
  }

  /// Saves the wallpaper to the device's documents dir (web `download()`).
  static Future<String?> saveToFile({DateTime? date}) async {
    final verse = ContentData.verseForDate(date);
    final bytes = await render(date: date);
    if (bytes == null) return null;
    final dir = await getApplicationDocumentsDirectory();
    final name =
        'daily-verse-${verse.reference.replaceAll(RegExp(r'\s'), '-')}.png';
    final file = File('${dir.path}/$name');
    await file.writeAsBytes(bytes, flush: true);
    return file.path;
  }
}
