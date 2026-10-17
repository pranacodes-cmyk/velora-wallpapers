import 'package:flutter_test/flutter_test.dart';
import '../lib/core/services/offering_rules.dart';

void main() {
  test('all four plans follow offering membership', () {
    expect(visibleOfferingPlans(['lifetime', 'monthly', 'yearly', 'weekly']),
      ['yearly', 'weekly', 'monthly', 'lifetime']);
    expect(visibleOfferingPlans(['monthly', 'lifetime']), ['monthly', 'lifetime']);
  });
  test('missing yearly falls back to an available package', () {
    expect(selectedOfferingPlan(['monthly', 'lifetime'], 'yearly'), 'monthly');
    expect(selectedOfferingPlan([], 'yearly'), null);
  });
  for (final plan in ['weekly', 'monthly', 'yearly']) {
    test('$plan uses actual free phase duration', () {
      expect(freeTrialPeriod(plan, 'P7D', 1), (count: 7, unit: 'day'));
      expect(freeTrialPeriod(plan, 'P1W', 2), (count: 2, unit: 'week'));
      expect(freeTrialPeriod(plan, null, 1), null);
    });
  }
  test('lifetime never offers subscription trials', () {
    expect(freeTrialPeriod('lifetime', 'P3D', 1), null);
  });
}