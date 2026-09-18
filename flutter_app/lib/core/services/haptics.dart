import 'package:flutter/services.dart';

/// Mirrors `src/utils/haptics.ts` — same trigger points, same intensities.
enum HapticStyle { soft, light, medium, heavy, selection, success }

Future<void> haptic(HapticStyle style) async {
  switch (style) {
    case HapticStyle.soft:
    case HapticStyle.selection:
      await HapticFeedback.selectionClick();
    case HapticStyle.light:
      await HapticFeedback.lightImpact();
    case HapticStyle.medium:
    case HapticStyle.success:
      await HapticFeedback.mediumImpact();
    case HapticStyle.heavy:
      await HapticFeedback.heavyImpact();
  }
}
