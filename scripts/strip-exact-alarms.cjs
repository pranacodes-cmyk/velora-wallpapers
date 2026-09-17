/**
 * NO-OP (kept as a stub for setup-android.cjs / prepare-android-release.cjs).
 *
 * The app now ships the Prayer Reminder Alarms feature which legitimately
 * requires SCHEDULE_EXACT_ALARM / USE_EXACT_ALARM under Google Play's
 * "Alarm / Reminder" allowed use case (Christian prayer reminders).
 *
 * Previously this script stripped those permissions; we keep the file so
 * existing build scripts that call it continue to work, but it intentionally
 * does nothing now.
 */
console.log('ℹ️  strip-exact-alarms: no-op (exact-alarm permissions are required for Prayer Reminders).');
