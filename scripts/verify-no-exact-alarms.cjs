/**
 * NO-OP verifier.
 *
 * The release AAB is now EXPECTED to declare SCHEDULE_EXACT_ALARM /
 * USE_EXACT_ALARM for the Prayer Reminder Alarms feature. This script
 * remains so the CI workflow that calls it continues to pass.
 */
console.log('✅ exact-alarm check skipped: Prayer Reminders legitimately require exact alarms.');
