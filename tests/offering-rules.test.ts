import { describe, expect, it } from "bun:test";
import { freeTrialPeriod, selectedOfferingPlan, visibleOfferingPlans } from "../src/lib/offeringRules";

describe("offering-driven plan testing", () => {
  it("shows all four configured plans and no missing plans", () => {
    expect(visibleOfferingPlans(["lifetime", "monthly", "yearly", "weekly"])).toEqual(["yearly", "weekly", "monthly", "lifetime"]);
    expect(visibleOfferingPlans(["monthly", "lifetime"])).toEqual(["monthly", "lifetime"]);
  });
  it("selects an available plan when yearly is absent", () => {
    expect(selectedOfferingPlan(["monthly", "lifetime"], "yearly")).toBe("monthly");
    expect(selectedOfferingPlan(["monthly", "lifetime"], "lifetime")).toBe("lifetime");
    expect(selectedOfferingPlan([], "yearly")).toBeUndefined();
  });
  for (const plan of ["weekly", "monthly", "yearly"]) {
    it(`${plan} supports an actual store trial without assuming 3 days`, () => {
      expect(freeTrialPeriod(plan, "P7D")).toEqual({ count: 7, unit: "day" });
      expect(freeTrialPeriod(plan, "P1W", 2)).toEqual({ count: 2, unit: "week" });
      expect(freeTrialPeriod(plan, null)).toBeNull();
    });
  }
  it("lifetime cannot claim a free subscription trial", () => {
    expect(freeTrialPeriod("lifetime", "P3D")).toBeNull();
  });
  it("invalid and unknown durations never promise a trial", () => {
    expect(freeTrialPeriod("yearly", "P0D")).toBeNull();
    expect(freeTrialPeriod("weekly", "P1D", 0)).toBeNull();
    expect(freeTrialPeriod("monthly", "invalid")).toBeNull();
  });
});