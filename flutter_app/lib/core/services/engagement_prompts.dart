import 'prefs.dart';

/// Port of the web `src/lib/paywallScheduler.ts` usage-milestone piece.
///
/// One-time "you've lived with Prayly for a few days" offer. Day 4 of real
/// usage is the single best moment to ask: the habit is formed, the free
/// limits have been felt, and nothing has been asked of the user yet.
/// Fires once per install, independent of every other paywall trigger.
class EngagementPrompts {
  EngagementPrompts._();

  static const _firstOpenKey = 'cw_first_open_at';
  static const _usageMilestoneKey = 'cw_paywall_usage_day4_shown';
  static const _usageMilestoneDays = 3; // 3 full days → day 4

  /// First-open timestamp, seeded from onboarding completion when available so
  /// existing installs don't restart their clock after an update.
  static int _firstOpenAt() {
    final stored = Prefs.getInt(_firstOpenKey);
    if (stored > 0) return stored;
    final onboarded =
        int.tryParse(Prefs.getString(StorageKeys.onboardingDoneAt) ?? '') ?? 0;
    final seed = onboarded > 0
        ? onboarded
        : DateTime.now().millisecondsSinceEpoch;
    Prefs.setInt(_firstOpenKey, seed);
    return seed;
  }

  static int daysSinceFirstOpen() =>
      (DateTime.now().millisecondsSinceEpoch - _firstOpenAt()) ~/
      const Duration(days: 1).inMilliseconds;

  /// True exactly once, on the first launch at/after day 4.
  static bool shouldShowUsageMilestone() {
    if (Prefs.getInt(_usageMilestoneKey) == 1) return false;
    if (daysSinceFirstOpen() < _usageMilestoneDays) return false;
    Prefs.setInt(_usageMilestoneKey, 1);
    return true;
  }
}
