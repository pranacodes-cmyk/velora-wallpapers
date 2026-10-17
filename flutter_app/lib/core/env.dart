/// Shared configuration — identical to the web app so both clients talk to the
/// exact same backend, purchase project and analytics project.
class Env {
  const Env._();

  static const supabaseUrl = 'https://jbwhlogvldhsnxtpxwih.supabase.co';
  static const supabaseAnonKey =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impid2hsb2d2bGRoc254dHB4d2loIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMDk5NjcsImV4cCI6MjA5MjU4NTk2N30.ghe30JyFFO7NZr8xwL_r8UOxURkEbmqwwwKTompUb7w';

  /// RevenueCat — Google Play public SDK key (same as `src/services/revenuecat.ts`).
  static const revenueCatAndroidKey = 'goog_XgbEkcJHOfiAMIUudVojRoiMWCs';
  static const revenueCatIosKey = 'appl_waMoLfyPfiADOxbkRaKRBIUIoOp';

  /// Server-side entitlement identifier — must never change.
  /// AdMob iOS ad units. Empty = ads stay off on iOS (rewarded unlocks are
  /// granted directly) until the iOS AdMob app exists; then also set
  /// `GADApplicationIdentifier` in ios/Runner/Info.plist.
  static const admobIosRewardedUnit = '';
  static const admobIosInterstitialUnit = '';

  static const entitlementId = 'Jesus Wallpaper & Bible Prayer Pro';

  static const productWeekly = 'prayly_weekly';
  static const productMonthly = 'prayly_monthly';
  static const productYearly = 'prayly_yearly';
  static const productLifetime = 'prayly_lifetime';

  /// PostHog — same project/host, so all existing dashboards keep working.
  static const posthogKey = 'phc_pPcqndZ2eNEGuMjjCcrMoWtRjLufyyiphm5QEjn5HAiq';
  static const posthogHost = 'https://us.i.posthog.com';

  static const androidPackage = 'com.jesuswallpaperbible.app';
}
