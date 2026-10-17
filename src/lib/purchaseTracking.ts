/** Checkout confirms access, not money collected. RevenueCat owns revenue. */
export function checkoutTracking(periodType: string | undefined, isSandbox = false) {
  const period = String(periodType ?? "UNKNOWN").toUpperCase();
  return {
    event: isSandbox ? "test_checkout_completed" : period === "TRIAL" ? "trial_started" : "checkout_completed",
    properties: {
      period_type: period,
      is_trial: period === "TRIAL",
      is_sandbox: isSandbox,
      revenue_verified: false,
      ...(period === "TRIAL" ? { price: 0 } : {}),
    },
  };
}

/** Only RevenueCat's native integration may send subscription conversions. */
export function isMetaConversion(name: string): boolean {
  return ["purchase", "fb_mobile_purchase", "subscribe", "starttrial"].includes(name.toLowerCase());
}