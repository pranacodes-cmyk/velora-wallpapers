/// Single source of truth for the bottom-nav tab order.
///
/// The shell's `IndexedStack`, the nav bar, deep links and any screen that
/// gates work on "am I the visible tab?" all read these constants — a tab can
/// never again be inserted without every reader moving with it (that mismatch
/// is what once froze the live-wallpaper previews).
class AppTabs {
  const AppTabs._();

  static const int today = 0;
  static const int journeys = 1;
  static const int wallpapers = 2;
  static const int quiz = 3;

  /// Number of tabs in the shell.
  static const int count = 4;
  static const int lastIndex = count - 1;
}
