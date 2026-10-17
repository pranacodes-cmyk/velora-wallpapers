/// Checkout confirms entitlement access, never a verified revenue amount.
class CheckoutOutcome {
  const CheckoutOutcome({required this.active, required this.periodType, required this.isSandbox});
  final bool active;
  final String periodType;
  final bool isSandbox;
  bool get isTrial => periodType == 'TRIAL';
  String get event => isSandbox ? 'test_checkout_completed' : isTrial ? 'trial_started' : 'checkout_completed';
  Map<String, Object> get properties => {
    'period_type': periodType,
    'is_trial': isTrial,
    'is_sandbox': isSandbox,
    'revenue_verified': false,
    if (isTrial) 'price': 0,
  };
}

bool isMetaConversion(String name) =>
  {'purchase', 'fb_mobile_purchase', 'subscribe', 'starttrial'}.contains(name.toLowerCase());
