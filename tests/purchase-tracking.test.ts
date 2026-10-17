import { describe, it, expect } from "vitest";
import { checkoutTracking, isMetaConversion } from "../src/lib/purchaseTracking";

describe("checkout counting", () => {
  it("counts a free trial as trial_started with zero price, not Purchase", () => {
    expect(checkoutTracking("TRIAL")).toEqual({ event: "trial_started", properties: {
      period_type: "TRIAL", is_trial: true, is_sandbox: false, revenue_verified: false, price: 0,
    }});
  });
  it("does not pretend non-trial entitlement success proves payment", () => {
    const result = checkoutTracking("NORMAL");
    expect(result.event).toBe("checkout_completed");
    expect(result.properties.revenue_verified).toBe(false);
    expect(result.properties).not.toHaveProperty("price");
  });
  it("separates sandbox checkout from production conversions", () => {
    expect(checkoutTracking("TRIAL", true).event).toBe("test_checkout_completed");
  });
  it("does not infer payment from unknown entitlement period", () => {
    expect(checkoutTracking(undefined).properties.period_type).toBe("UNKNOWN");
    expect(checkoutTracking(undefined).properties.revenue_verified).toBe(false);
  });
  for (const name of ["Purchase", "fb_mobile_purchase", "Subscribe", "StartTrial"]) {
    it(`blocks duplicate client conversion ${name}`, () => expect(isMetaConversion(name)).toBe(true));
  }
  for (const name of ["fb_mobile_activate_app", "fb_mobile_first_app_launch", "fb_mobile_complete_registration", "fb_mobile_initiated_checkout", "ViewContent"]) {
    it(`preserves engagement event ${name}`, () => expect(isMetaConversion(name)).toBe(false));
  }
});