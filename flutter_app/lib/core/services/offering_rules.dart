/// Store-independent offering rules shared by paywall and onboarding.
const offeringPlanOrder = ['yearly', 'weekly', 'monthly', 'lifetime'];

List<String> visibleOfferingPlans(Iterable<String> available) =>
    offeringPlanOrder.where(available.contains).toList();

String? selectedOfferingPlan(Iterable<String> available, String? selected) {
  final plans = visibleOfferingPlans(available);
  if (plans.contains(selected)) return selected;
  return plans.isEmpty ? null : plans.first;
}

({int count, String unit})? freeTrialPeriod(
  String plan,
  String? isoPeriod,
  int cycles,
) {
  if (plan == 'lifetime' || isoPeriod == null || cycles < 1) return null;
  final match = RegExp(r'^P(\d+)([DWMY])$').firstMatch(isoPeriod);
  if (match == null) return null;
  final count = int.tryParse(match.group(1) ?? '') ?? 0;
  final units = {'D': 'day', 'W': 'week', 'M': 'month', 'Y': 'year'};
  final unit = units[match.group(2)];
  if (count < 1 || unit == null) return null;
  return (count: count * cycles, unit: unit);
}