import { readFileSync } from "node:fs";
import { describe, expect, it } from "bun:test";

const src = (p: string) => readFileSync(new URL(`../flutter_app/${p}`, import.meta.url), "utf8");
const rc = src("lib/core/services/revenuecat_service.dart");
const sheet = src("lib/widgets/premium_sheet.dart");
const post = src("lib/screens/onboarding/post_onboarding_premium.dart");

// Source-contract guards: trial on/off is driven remotely by the RevenueCat offering.
describe("remote trial mode", () => {
  it("detects the trial from the store's free phase and defaults to on", () => {
    expect(rc).toContain("final phase = option.freePhase");
    expect(rc).toContain("if (phase == null) return null");
    expect(rc).toContain("Prefs.getBool(_trialKey, fallback: true)");
  });

  it("skips the 3-day-trial slide when the trial is off", () => {
    expect(post).toMatch(/if \(!RevenueCatService\.trialOffered\) \{\s*setState\(\(\) => _showSheet = true\);\s*return;/);
  });

  it("uses no-trial yearly copy when the trial is off", () => {
    expect(sheet).toContain("'premium.cta.${_selected.name}.titleNoTrial'");
    expect(sheet).toContain("'premium.plan.$name.subtitleNoTrial'");
  });

  it("ships the no-trial copy in all eight languages", () => {
    for (const l of ["en", "hi", "es", "pt", "fr", "de", "id", "fil"]) {
      const d = JSON.parse(src(`assets/translations/${l}.json`));
      expect(d["premium.cta.yearly.titleNoTrial"]).toBeTruthy();
      expect(d["premium.plan.yearly.subtitleNoTrial"]).toBeTruthy();
    }
  });
});
